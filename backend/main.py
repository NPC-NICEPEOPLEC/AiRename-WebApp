import os
import re
from openai import OpenAI
from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Query
from fastapi.middleware.cors import CORSMiddleware # 导入 CORS 中间件
from dotenv import load_dotenv
from typing import Literal
import io
import zipfile
import xml.etree.ElementTree as ET

# --- 1. 初始化和配置 ---

load_dotenv()

app = FastAPI(
    title="IntelliRename API",
    description="一个使用 AI 模型智能处理文档的后端服务。",
    version="1.0.0",
)

# --- 配置 CORS 中间件 ---
# 这是至关重要的一步，允许您的前端(例如 http://localhost:5173)
# 与您的后端(例如 http://localhost:8000)进行跨域通信。
origins = [
    "http://localhost",
    "http://localhost:5173", # 您的 Vite 前端开发服务器地址
    "http://localhost:5176", # 当前前端服务器地址
    "http://127.0.0.1",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5176",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # 允许所有 HTTP 方法
    allow_headers=["*"], # 允许所有 HTTP 头
)


# --- 配置 DeepSeek API ---
deepseek_api_key = os.getenv("DEEPSEEK_API_KEY")
if deepseek_api_key:
    try:
        print(f"正在初始化 DeepSeek 客户端...")
        print(f"API Key: {deepseek_api_key[:10]}...{deepseek_api_key[-4:]}")
        print(f"Base URL: https://api.deepseek.com/v1")
        
        deepseek_client = OpenAI(
            api_key=deepseek_api_key,
            base_url="https://api.deepseek.com/v1",
            timeout=30.0
        )
        print("DeepSeek 客户端初始化成功")
    except Exception as e:
        print(f"初始化 DeepSeek 客户端时出错: {e}")
        print(f"错误类型: {type(e).__name__}")
        deepseek_client = None
else:
    print("警告: 未找到 DeepSeek API 密钥，服务可能无法正常工作。")
    deepseek_client = None


# --- 2. 定义核心的 AI Prompt ---
PROMPT_TEMPLATE = """
# Role
智能文档理解与命名专家

## Profile
* author: eureka
* version: 2.1
* description: 作为一名专注于语义理解与结构提炼的 AI 专家，负责阅读各类文档，精准提炼核心价值，生成逻辑清晰的概要与高度识别性的标题，以提升文档的可管理性与搜索效率。

## Attention
请深入阅读用户提供的文档内容，调用语言理解、结构建模与语义抽象等能力，识别其主题、重点信息及核心意图。以结构清晰、语言专业的方式，输出高质量的"文档概要"与"文档标题"。

## Constraints
* 必须完整覆盖文档中的关键信息与价值点，避免遗漏。
* 文档标题必须高度凝练，具备唯一性、识别性与搜索友好性。
* 概要内容应逻辑清晰、语义准确，不进行主观推断或夸大。
* 严禁直接复制文档中的句子作为标题使用。
* 所有输出必须使用正式书面语表达，避免口语化。

## Definition
* **文档概要**：基于深度理解后的简洁总结，应涵盖文档主题、核心意图、关键结构与主要内容点，控制在 2~4 句之间。
* **文档标题**：从概要中提炼出的文档命名，应具备可识别性、概括性与可记忆性，控制在 15 字以内（如为中文）或 10 个词以内（如为英文）。

## Response Format
请严格使用以下格式返回：

**文档概要**：
<用 2~4 句描述文档核心内容>

**文档标题**：
<一句话标题，15 字以内>

---
现在，请处理以下文档：
[任务类型标签: {file_type_tag}]

[文档原文开始]
{file_content}
[文档原文结束]
"""


# --- 3. 核心处理函数 ---

def extract_docx_text(docx_bytes: bytes) -> str:
    """从DOCX文件字节流中提取文本内容，不依赖python-docx库。"""
    try:
        print(f"开始解析DOCX文件，文件大小: {len(docx_bytes)} 字节")
        
        # 使用zipfile读取DOCX文件（DOCX本质上是一个ZIP文件）
        with zipfile.ZipFile(io.BytesIO(docx_bytes), 'r') as docx_zip:
            # 列出ZIP文件中的所有文件
            file_list = docx_zip.namelist()
            print(f"DOCX文件内容: {file_list}")
            
            # 读取document.xml文件，这里包含了文档的主要文本内容
            try:
                document_xml = docx_zip.read('word/document.xml')
                print(f"成功读取document.xml，大小: {len(document_xml)} 字节")
            except KeyError:
                print("无法找到word/document.xml文件")
                return "无法找到文档内容文件"
            
            # 解析XML
            root = ET.fromstring(document_xml)
            print(f"XML根节点: {root.tag}")
            
            # 定义多个可能的命名空间
            namespaces = {
                'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
                'w14': 'http://schemas.microsoft.com/office/word/2010/wordml',
                'w15': 'http://schemas.microsoft.com/office/word/2012/wordml'
            }
            
            # 尝试多种方式提取文本
            text_content = []
            
            # 方法1: 使用命名空间查找w:t元素
            text_elements = root.findall('.//w:t', namespaces)
            print(f"使用命名空间找到 {len(text_elements)} 个文本元素")
            
            for element in text_elements:
                if element.text:
                    text_content.append(element.text)
                    print(f"提取文本片段: {element.text[:50]}...")
            
            # 方法2: 如果命名空间方法失败，尝试不使用命名空间
            if not text_content:
                print("命名空间方法失败，尝试直接查找文本元素")
                # 查找所有包含文本的元素
                for elem in root.iter():
                    if elem.text and elem.text.strip():
                        # 过滤掉一些非内容元素
                        if elem.tag.endswith('}t') or 'text' in elem.tag.lower():
                            text_content.append(elem.text.strip())
                            print(f"直接提取文本: {elem.text.strip()[:50]}...")
            
            # 方法3: 如果还是没有内容，尝试获取所有文本节点
            if not text_content:
                print("尝试获取所有文本节点")
                all_text = []
                for elem in root.iter():
                    if elem.text and elem.text.strip():
                        all_text.append(elem.text.strip())
                
                # 过滤掉明显的非内容文本（如数字、单个字符等）
                text_content = [t for t in all_text if len(t) > 2 and not t.isdigit()]
                print(f"过滤后的文本片段数量: {len(text_content)}")
            
            if not text_content:
                print("警告: 未能提取到任何文本内容")
                return "文档内容为空或无法解析"
            
            # 合并文本并处理换行
            full_text = ' '.join(text_content)
            print(f"合并后的文本长度: {len(full_text)} 字符")
            print(f"文本预览: {full_text[:200]}...")
            
            # 简单的段落分割和清理
            import re
            # 移除多余的空白字符
            full_text = re.sub(r'\s+', ' ', full_text)
            # 按句号、问号、感叹号分割
            sentences = re.split(r'[。！？.!?]+', full_text)
            paragraphs = [s.strip() for s in sentences if s.strip() and len(s.strip()) > 3]
            
            result = '\n'.join(paragraphs)
            print(f"最终提取结果长度: {len(result)} 字符")
            return result
            
    except Exception as e:
        print(f"提取DOCX内容时出错: {e}")
        print(f"错误类型: {type(e).__name__}")
        import traceback
        print(f"错误堆栈: {traceback.format_exc()}")
        return f"无法提取DOCX文档内容: {str(e)}"

def parse_ai_response(response_text: str) -> dict:
    """使用正则表达式解析 AI 返回的结构化文本。"""
    try:
        # 匹配带星号的格式：**文档概要**：
        summary_match = re.search(r"\*\*文档概要\*\*：\s*(.*?)\s*\*\*文档标题\*\*：", response_text, re.DOTALL)
        summary = summary_match.group(1).strip() if summary_match else ""

        title_match = re.search(r"\*\*文档标题\*\*：\s*(.*)", response_text, re.DOTALL)
        title = title_match.group(1).strip() if title_match else ""

        if not summary or not title:
            return {}
        return {"summary": summary, "title": title}
    except Exception as e:
        print(f"解析AI响应时出错: {e}")
        return {}

async def process_with_deepseek(full_prompt: str) -> str:
    """使用 DeepSeek 模型处理 Prompt。"""
    if not deepseek_client:
        raise HTTPException(status_code=501, detail="DeepSeek 服务未在后端配置。")
    
    # 尝试使用requests直接调用API
    import requests
    import json
    
    api_key = os.getenv("DEEPSEEK_API_KEY")
    url = "https://api.deepseek.com/v1/chat/completions"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    data = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "user", "content": full_prompt}
        ]
    }
    
    # 重试机制
    max_retries = 3
    for attempt in range(max_retries):
        try:
            print(f"尝试调用 DeepSeek API (第 {attempt + 1} 次)...")
            # 禁用代理以避免连接问题
            proxies = {
                'http': None,
                'https': None
            }
            response = requests.post(url, headers=headers, json=data, timeout=30, proxies=proxies)
            
            print(f"API响应状态码: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                return result['choices'][0]['message']['content']
            elif response.status_code == 401:
                raise HTTPException(status_code=401, detail="API密钥无效或已过期，请检查后端.env文件中的DEEPSEEK_API_KEY配置。")
            elif response.status_code == 429:
                raise HTTPException(status_code=429, detail="API调用频率超限，请稍后重试。")
            else:
                error_text = response.text
                print(f"API返回错误: {error_text}")
                if attempt < max_retries - 1:
                    print(f"请求失败，正在重试...")
                    import asyncio
                    await asyncio.sleep(1)
                    continue
                else:
                    raise HTTPException(status_code=500, detail=f"DeepSeek API调用失败: {error_text}")
                    
        except requests.exceptions.ConnectionError as e:
            print(f"连接错误 (尝试 {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                print(f"连接错误，正在重试...")
                import asyncio
                await asyncio.sleep(2)  # 等待2秒后重试
                continue
            else:
                raise HTTPException(status_code=503, detail="无法连接到DeepSeek服务，请检查网络连接或API服务状态。")
        except requests.exceptions.Timeout as e:
            print(f"请求超时 (尝试 {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                print(f"请求超时，正在重试...")
                import asyncio
                await asyncio.sleep(1)
                continue
            else:
                raise HTTPException(status_code=504, detail="API请求超时，请检查网络连接或稍后重试。")
        except Exception as e:
            error_message = str(e)
            print(f"调用 DeepSeek API 时发生错误 (尝试 {attempt + 1}/{max_retries}): {error_message}")
            print(f"错误类型: {type(e).__name__}")
            
            if attempt < max_retries - 1:
                print(f"未知错误，正在重试...")
                import asyncio
                await asyncio.sleep(1)
                continue
            else:
                raise HTTPException(status_code=500, detail=f"调用 DeepSeek 服务时出错: {error_message}")
    
    # 如果所有重试都失败
    raise HTTPException(status_code=500, detail="DeepSeek API调用失败，已达到最大重试次数。")


# --- 4. API 端点 (Endpoints) ---

@app.post("/api/process-document/")
async def api_process_document(
    file: UploadFile = File(...),
    file_type: str = Form("通用文档")
):
    """接收单个文档，使用 DeepSeek 模型进行处理，并返回结果。"""
    # 文件大小限制：200MB
    MAX_FILE_SIZE = 200 * 1024 * 1024  # 200MB
    
    # 检查文件大小
    content_bytes = await file.read()
    if len(content_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"文件大小超过限制。最大支持 200MB，当前文件大小: {len(content_bytes) / (1024*1024):.2f}MB")
    
    # 支持的文件格式 - 涵盖全球常见的文档、图文、文本类型
    allowed_extensions = {
        # 文本文档
        '.txt', '.md', '.rtf', '.tex', '.log', '.csv', '.tsv',
        # Microsoft Office
        '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        # OpenOffice/LibreOffice
        '.odt', '.ods', '.odp', '.odg', '.odf',
        # 代码文件
        '.py', '.js', '.html', '.htm', '.css', '.json', '.xml', '.yaml', '.yml',
        '.java', '.cpp', '.c', '.h', '.php', '.rb', '.go', '.rs', '.swift', '.kt',
        '.sql', '.sh', '.bat', '.ps1', '.r', '.m', '.scala', '.pl', '.lua',
        # PDF和电子书
        '.pdf', '.epub', '.mobi', '.azw', '.azw3',
        # 图片格式
        '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.tif', '.webp', '.svg',
        '.ico', '.psd', '.ai', '.eps', '.raw', '.cr2', '.nef', '.arw',
        # 音视频格式
        '.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a',
        '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v',
        # 压缩文件
        '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz',
        # 其他常见格式
        '.ics', '.vcf', '.kml', '.gpx', '.dwg', '.dxf', '.step', '.stl'
    }
    
    # 处理文件名和扩展名
    filename = file.filename or 'unknown_file'
    print(f"原始文件名: {filename}")
    print(f"文件Content-Type: {file.content_type}")
    
    if filename == 'blob' or not filename or filename == 'unknown_file':
        # 如果文件名为空或为blob，根据content_type推断扩展名
        content_type = file.content_type or ''
        print(f"使用Content-Type推断文件类型: {content_type}")
        if 'text/plain' in content_type:
            file_extension = '.txt'
        elif 'text/markdown' in content_type:
            file_extension = '.md'
        elif 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' in content_type:
            file_extension = '.docx'
        elif 'application/msword' in content_type:
            file_extension = '.doc'
        elif 'application/pdf' in content_type:
            file_extension = '.pdf'
        elif 'image/png' in content_type:
            file_extension = '.png'
        elif 'image/jpeg' in content_type:
            file_extension = '.jpg'
        elif 'image/gif' in content_type:
            file_extension = '.gif'
        else:
            file_extension = '.txt'  # 默认为文本文件
    else:
        file_extension = os.path.splitext(filename.lower())[1]
    
    print(f"识别的文件扩展名: {file_extension}")
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"不支持的文件格式: {file_extension}。支持的格式: {', '.join(sorted(allowed_extensions))}"
        )

    # 根据文件扩展名处理内容
    if file_extension in ['.txt', '.md', '.py', '.js', '.html', '.htm', '.css', '.json', '.xml', '.yaml', '.yml',
                          '.java', '.cpp', '.c', '.h', '.php', '.rb', '.go', '.rs', '.swift', '.kt',
                          '.sql', '.sh', '.bat', '.ps1', '.r', '.m', '.scala', '.pl', '.lua', '.rtf',
                          '.tex', '.log', '.csv', '.tsv']:
        try:
            content_str = content_bytes.decode('utf-8')
        except UnicodeDecodeError:
            try:
                content_str = content_bytes.decode('gbk')
            except UnicodeDecodeError:
                try:
                    content_str = content_bytes.decode('latin-1')
                except UnicodeDecodeError:
                    content_str = f"文档名称: {file.filename}\n文件大小: {len(content_bytes) / 1024:.2f} KB\n文件类型: {file_extension}\n\n注意：无法解码文件内容，可能是二进制文件或编码格式不支持。"
    elif file_extension in ['.doc', '.docx']:
        if file_extension == '.docx':
            try:
                # 使用自定义函数提取DOCX内容（不依赖python-docx）
                print(f"开始提取DOCX内容，文件大小: {len(content_bytes)} 字节")
                content_str = extract_docx_text(content_bytes)
                print(f"提取到的内容长度: {len(content_str)} 字符")
                print(f"提取到的内容预览: {content_str[:200]}...")
                
                if not content_str.strip() or "无法提取" in content_str or "无法找到" in content_str:
                    print("DOCX内容提取失败，使用元数据")
                    content_str = f"文档名称: {file.filename}\n文件大小: {len(content_bytes) / 1024:.2f} KB\n文件类型: Word文档(.docx)\n\n注意：文档内容为空或无法提取文本内容。"
                else:
                    print("DOCX内容提取成功")
            except Exception as e:
                print(f"提取DOCX内容时出错: {e}")
                content_str = f"文档名称: {file.filename}\n文件大小: {len(content_bytes) / 1024:.2f} KB\n文件类型: Word文档(.docx)\n\n注意：无法提取文档内容，可能是文档格式问题。建议转换为.txt格式以获得最佳智能命名体验。"
        else:
            # .doc格式暂不支持
            content_str = f"文档名称: {file.filename}\n文件大小: {len(content_bytes) / 1024:.2f} KB\n文件类型: Word文档(.doc)\n\n注意：当前版本暂不支持.doc格式内容提取，建议转换为.docx或.txt格式以获得最佳智能命名体验。"
    elif file_extension in ['.xls', '.xlsx']:
        content_str = f"文档名称: {file.filename}\n文件大小: {len(content_bytes) / 1024:.2f} KB\n文件类型: Excel表格\n\n注意：当前版本暂不支持Excel文档内容提取，建议导出为.txt或.csv格式以获得最佳智能命名体验。"
    elif file_extension == '.pdf':
        content_str = f"文档名称: {file.filename}\n文件大小: {len(content_bytes) / 1024:.2f} KB\n文件类型: PDF文档\n\n注意：当前版本暂不支持PDF文档内容提取，建议转换为.txt格式以获得最佳智能命名体验。"
    elif file_extension in ['.ppt', '.pptx']:
        content_str = f"文档名称: {file.filename}\n文件大小: {len(content_bytes) / 1024:.2f} KB\n文件类型: PowerPoint演示文稿\n\n注意：当前版本暂不支持PowerPoint文档内容提取，建议导出为.txt格式以获得最佳智能命名体验。"
    elif file_extension in ['.odt', '.ods', '.odp', '.odg', '.odf']:
        content_str = f"文档名称: {file.filename}\n文件大小: {len(content_bytes) / 1024:.2f} KB\n文件类型: OpenOffice/LibreOffice文档\n\n注意：当前版本暂不支持OpenOffice文档内容提取，建议导出为.txt或.docx格式以获得最佳智能命名体验。"
    elif file_extension in ['.epub', '.mobi', '.azw', '.azw3']:
        content_str = f"文档名称: {file.filename}\n文件大小: {len(content_bytes) / 1024:.2f} KB\n文件类型: 电子书文件\n\n注意：当前版本暂不支持电子书内容提取，建议转换为.txt格式以获得最佳智能命名体验。"
    elif file_extension in ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.tif', '.webp', '.svg',
                            '.ico', '.psd', '.ai', '.eps', '.raw', '.cr2', '.nef', '.arw']:
        content_str = f"文档名称: {file.filename}\n文件大小: {len(content_bytes) / 1024:.2f} KB\n文件类型: 图片文件({file_extension})\n\n注意：当前版本暂不支持图片内容识别，智能命名将基于文件名和基本信息进行。建议添加描述性文字文件以获得更好的命名效果。"
    elif file_extension in ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a']:
        content_str = f"文档名称: {file.filename}\n文件大小: {len(content_bytes) / 1024:.2f} KB\n文件类型: 音频文件({file_extension})\n\n注意：当前版本暂不支持音频内容分析，智能命名将基于文件名和基本信息进行。"
    elif file_extension in ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v']:
        content_str = f"文档名称: {file.filename}\n文件大小: {len(content_bytes) / 1024:.2f} KB\n文件类型: 视频文件({file_extension})\n\n注意：当前版本暂不支持视频内容分析，智能命名将基于文件名和基本信息进行。"
    elif file_extension in ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz']:
        content_str = f"文档名称: {file.filename}\n文件大小: {len(content_bytes) / 1024:.2f} KB\n文件类型: 压缩文件({file_extension})\n\n注意：当前版本暂不支持压缩文件内容分析，智能命名将基于文件名和基本信息进行。建议解压后处理其中的文档文件。"
    elif file_extension in ['.ics', '.vcf', '.kml', '.gpx', '.dwg', '.dxf', '.step', '.stl']:
        content_str = f"文档名称: {file.filename}\n文件大小: {len(content_bytes) / 1024:.2f} KB\n文件类型: 专业格式文件({file_extension})\n\n注意：当前版本对此专业格式的支持有限，智能命名将基于文件名和基本信息进行。"
    else:
        content_str = f"文档名称: {file.filename}\n文件大小: {len(content_bytes) / 1024:.2f} KB\n文件类型: {file_extension}\n\n注意：当前版本对此文件类型的支持有限，建议使用.txt、.md、.docx或代码文件格式以获得最佳智能命名体验。"

    full_prompt = PROMPT_TEMPLATE.format(file_content=content_str, file_type_tag=file_type)
    
    print(f"正在使用 deepseek 模型处理文档: {file.filename}...")
    ai_response_text = await process_with_deepseek(full_prompt)
    
    print("AI 响应接收成功。正在解析...")
    print(f"AI 原始响应: {ai_response_text}")
    parsed_result = parse_ai_response(ai_response_text)
    
    if not parsed_result:
        print(f"解析失败的AI响应: {ai_response_text}")
        raise HTTPException(status_code=500, detail=f"AI 响应格式不正确，无法解析。原始响应: {ai_response_text[:200]}...")

    print(f"解析成功: {parsed_result}")
    return {
        "original_filename": file.filename,
        "model_used": "deepseek",
        "ai_result": parsed_result
    }

@app.get("/")
def read_root():
    return {"message": "IntelliRename Backend is running."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)