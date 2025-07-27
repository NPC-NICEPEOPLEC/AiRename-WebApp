import React, { useState, useRef, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Upload, Download, Edit2, Trash2, Play, FileText, Image, File, CheckCircle, Clock, AlertCircle, Home, History, CheckSquare, Square } from 'lucide-react';
import JSZip from 'jszip';

interface FileItem {
  id: string;
  file: File;
  originalName: string;
  newName: string;
  editedName: string;
  isEditing: boolean;
  isProcessing: boolean;
  isProcessed: boolean;
}

const ProcessPage: React.FC = () => {
  const location = useLocation();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState(-1);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 从路由状态中获取文件数据
  useEffect(() => {
    if (location.state && location.state.files) {
      const uploadedFiles = location.state.files as { id: string; file: File; originalName: string }[];
      const processFiles: FileItem[] = uploadedFiles.map(fileData => ({
        id: fileData.id,
        file: fileData.file,
        originalName: fileData.originalName,
        newName: fileData.originalName,
        editedName: fileData.originalName,
        isEditing: false,
        isProcessing: false,
        isProcessed: false
      }));
      setFiles(processFiles);
    }
  }, [location.state]);

  // 检查API配置
  const isApiConfigured = () => {
    const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
    const apiUrl = import.meta.env.VITE_DEEPSEEK_API_BASE_URL;
    return apiKey && apiKey !== 'your_deepseek_api_key_here' && apiUrl;
  };

  // 文件上传处理
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(event.target.files || []);
    const newFiles: FileItem[] = uploadedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      originalName: file.name,
      newName: file.name,
      editedName: file.name,
      isEditing: false,
      isProcessing: false,
      isProcessed: false
    }));
    setFiles(prev => [...prev, ...newFiles]);
  };

  // 读取文件内容
  const readFileContent = async (file: File): Promise<string> => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const isTextFile = ['txt', 'md', 'json', 'js', 'ts', 'jsx', 'tsx', 'css', 'html', 'xml', 'csv'].includes(fileExtension || '');
    const isImageFile = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(fileExtension || '');
    const isBinaryFile = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(fileExtension || '');

    if (isTextFile) {
      try {
        const content = await file.text();
        if (content.trim()) {
          return `这是一个${fileExtension?.toUpperCase()}文件，文件内容：\n${content.slice(0, 2000)}${content.length > 2000 ? '...(内容已截断)' : ''}`;
        }
      } catch (error) {
        console.warn('读取文本文件失败:', error);
      }
    }

    // 为图片和二进制文件提供详细的元数据信息
    const fileInfo = {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified).toLocaleString('zh-CN'),
      extension: fileExtension?.toUpperCase() || '未知'
    };

    if (isImageFile) {
      return `这是一个图片文件，详细信息：\n` +
             `- 原始文件名：${fileInfo.name}\n` +
             `- 文件大小：${(fileInfo.size / 1024 / 1024).toFixed(2)}MB\n` +
             `- 图片格式：${fileInfo.extension}\n` +
             `- 最后修改时间：${fileInfo.lastModified}\n` +
             `请根据文件名模式、拍摄时间等信息推断图片的用途和内容。`;
    }

    if (isBinaryFile) {
      return `这是一个${fileInfo.extension}文档，详细信息：\n` +
             `- 原始文件名：${fileInfo.name}\n` +
             `- 文件大小：${(fileInfo.size / 1024 / 1024).toFixed(2)}MB\n` +
             `- 文档类型：${fileInfo.extension}\n` +
             `- 最后修改时间：${fileInfo.lastModified}\n` +
             `请根据文件名、大小、修改时间等信息推断文档的内容和用途。`;
    }

    // 其他文件类型
    return `这是一个${fileInfo.extension}文件，详细信息：\n` +
           `- 原始文件名：${fileInfo.name}\n` +
           `- 文件大小：${(fileInfo.size / 1024).toFixed(2)}KB\n` +
           `- 文件类型：${fileInfo.type || '未知'}\n` +
           `- 最后修改时间：${fileInfo.lastModified}\n` +
           `请根据可用信息推断文件的用途和内容。`;
  };

  // 调用 DeepSeek API
  const callDeepSeekAPI = async (content: string, filename: string): Promise<string> => {
    try {
      const prompt = `你是一位智能文档理解与命名专家，专门负责深度分析文档内容并生成高质量的文件名。

## 专家档案
**身份**: 智能文档理解与命名专家  
**专长**: 文档内容深度分析、信息提取、专业命名  
**经验**: 15年+ 文档管理与知识组织经验  
**语言**: 中文为主，支持多语言文档  

## 核心任务
你需要对提供的文档信息进行**全面深度分析**，然后生成一个比原文件名更有意义、更专业的新文件名。

## 分析要求
1. **深度理解**: 仔细分析文档的所有可用信息（内容、文件名、大小、类型、时间等）
2. **信息提取**: 从文档信息中提取关键要素：
   - 主题或内容类型
   - 时间信息（日期、版本、期间等）
   - 项目或主体名称
   - 文档性质（报告、计划、记录、分析等）
   - 重要关键词
3. **智能推理**: 根据文件名模式、内容特征推断文档的实际用途和重要性
4. **专业命名**: 生成比原名更专业、更有描述性的文件名

## 命名原则
- **描述性**: 新文件名必须比原文件名更能描述文档内容
- **专业性**: 使用专业、规范的词汇
- **简洁性**: 控制在15个中文字符以内
- **唯一性**: 包含足够的区分信息
- **可搜索性**: 包含关键词，便于检索
- **规范性**: 符合文件命名规范，避免特殊字符

## 特殊处理规则
- **图片文件**: 根据文件名推断拍摄时间、地点、事件或用途
- **办公文档**: 识别文档类型（报告、计划、总结等）和主题
- **代码文件**: 识别项目名称、功能模块或技术特征
- **截图文件**: 根据命名模式推断截图内容类型
- **日期文件**: 提取并规范化日期格式，添加描述性信息

## 响应格式
请严格按照以下JSON格式返回，不要使用代码块标记：
{
  "summary": "对文档信息的深度分析总结，说明文档的主要特征和推断的用途",
  "title": "基于深度分析生成的新文件名（不含扩展名，必须比原文件名更有意义）"
}

## 分析示例

**示例1 - 图片文件**
输入: "这是一个图片文件，原始文件名：IMG_20240315_143022，文件大小：2.5MB，图片格式：JPG"
输出:
{
  "summary": "根据文件名分析，这是2024年3月15日14:30拍摄的照片，可能是重要事件或场景的记录",
  "title": "2024年3月15日重要场景记录"
}

**示例2 - 办公文档**
输入: "这是一个Word文档，原始文件名：文档1，文件大小：1.2MB，最后修改时间：2024/1/15"
输出:
{
  "summary": "这是一个在2024年1月15日修改的Word文档，文件较大说明内容丰富，需要根据实际用途重新命名",
  "title": "2024年1月工作文档"
}

现在请对以下文档进行**深度分析**:

文档信息: ${content}
原始文件名: ${filename}

请仔细分析所有可用信息，生成一个比原文件名更有意义的新文件名。`;

      const response = await fetch(`${import.meta.env.VITE_DEEPSEEK_API_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 2000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error('API密钥无效或已过期，请检查.env文件中的VITE_DEEPSEEK_API_KEY配置');
        }
        throw new Error(`API 请求失败: ${response.status} - ${errorData.error?.message || '未知错误'}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content;
      
      if (!aiResponse) {
        throw new Error('AI 响应为空');
      }

      // 解析 JSON 响应
      try {
        const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) || aiResponse.match(/{[\s\S]*}/);
        if (jsonMatch) {
          const jsonStr = jsonMatch[1] || jsonMatch[0];
          const parsed = JSON.parse(jsonStr);
          return parsed.title || '智能重命名文件';
        } else {
          // 如果没有找到JSON格式，尝试直接解析
          const parsed = JSON.parse(aiResponse);
          return parsed.title || '智能重命名文件';
        }
      } catch (parseError) {
        console.warn('JSON 解析失败，使用原始响应:', parseError);
        // 清理响应文本
        const cleanedResponse = aiResponse
          .replace(/```json|```/g, '')
          .replace(/[\r\n]/g, '')
          .replace(/[<>:"/\\|?*]/g, '')
          .trim();
        return cleanedResponse.slice(0, 50) || '智能重命名文件';
      }
    } catch (error) {
      console.error('DeepSeek API 调用失败:', error);
      throw error;
    }
  };

  // 处理单个文件
  const processFile = async (fileItem: FileItem, index: number) => {
    try {
      setFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { ...f, isProcessing: true } : f
      ));

      const content = await readFileContent(fileItem.file);
      const newName = await callDeepSeekAPI(content, fileItem.originalName);
      
      // 保留原文件扩展名
      const extension = fileItem.originalName.split('.').pop();
      const finalName = extension ? `${newName}.${extension}` : newName;

      setFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { 
          ...f, 
          newName: finalName,
          editedName: finalName,
          isProcessing: false,
          isProcessed: true
        } : f
      ));
    } catch (error) {
      console.error('处理文件失败:', error);
      setFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { 
          ...f, 
          newName: fileItem.originalName,
          editedName: fileItem.originalName,
          isProcessing: false,
          isProcessed: true
        } : f
      ));
      alert(`处理文件 "${fileItem.originalName}" 时出错: ${error}`);
    }
  };

  // 一键处理所有文件
  const handleBatchProcess = async () => {
    setIsProcessing(true);
    setCurrentProcessingIndex(0);

    for (let i = 0; i < files.length; i++) {
      if (!files[i].isProcessed) {
        setCurrentProcessingIndex(i);
        await processFile(files[i], i);
        // 添加延迟避免API限制
        if (i < files.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    setIsProcessing(false);
    setCurrentProcessingIndex(-1);
    
    // 处理完成后自动保存到历史记录
    saveToHistory();
  };

  // 编辑功能
  const startEditing = (id: string) => {
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, isEditing: true } : f
    ));
  };

  const saveEdit = (id: string, newName: string) => {
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, editedName: newName, isEditing: false } : f
    ));
  };

  const cancelEdit = (id: string) => {
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, isEditing: false } : f
    ));
  };

  // 删除文件
  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    // 同时从选中列表中移除
    setSelectedFiles(prev => {
      const newSelected = new Set(prev);
      newSelected.delete(id);
      return newSelected;
    });
  };

  // 处理全选/取消全选
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map(f => f.id)));
    }
    setSelectAll(!selectAll);
  };

  // 处理单个文件选择
  const handleFileSelect = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
    setSelectAll(newSelected.size === files.length);
  };

  // 更新全选状态
  useEffect(() => {
    setSelectAll(selectedFiles.size === files.length && files.length > 0);
  }, [selectedFiles.size, files.length]);

  // 保存到历史记录
  const saveToHistory = () => {
    const batchId = Math.random().toString(36).substr(2, 9);
    const timestamp = Date.now();
    
    // 为每个文件创建单独的记录
    const fileRecords = files.map(f => {
      const extension = f.originalName.split('.').pop() || '';
      return {
        id: Math.random().toString(36).substr(2, 9),
        timestamp,
        originalName: f.originalName,
        newName: f.editedName,
        fileExtension: extension,
        batchId
      };
    });

    // 创建兼容旧格式的历史记录项
    const legacyHistoryItem = {
      id: batchId,
      timestamp,
      originalFiles: files.map(f => f.originalName),
      processedFiles: files.map(f => ({
        originalName: f.originalName,
        newName: f.editedName
      })),
      totalFiles: files.length
    };

    const existingHistory = localStorage.getItem('intellirename_history');
    let history = [];
    if (existingHistory) {
      try {
        history = JSON.parse(existingHistory);
      } catch (error) {
        console.error('Failed to parse existing history:', error);
      }
    }

    history.unshift(legacyHistoryItem);
    // 只保留最近50条记录
    if (history.length > 50) {
      history = history.slice(0, 50);
    }

    localStorage.setItem('intellirename_history', JSON.stringify(history));
  };

  // 生成文件名（按照用户要求的格式）
  const generateFileName = (extension: string = 'zip') => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `irAiRename${year}${month}${day}_${hours}${minutes}${seconds}.${extension}`;
  };

  // 生成ZIP文件（只包含选中的文件）
  const generateZip = async () => {
    if (selectedFiles.size === 0) {
      alert('请先选择要下载的文件');
      return;
    }

    const zip = new JSZip();
    const selectedFileItems = files.filter(f => selectedFiles.has(f.id));
    
    selectedFileItems.forEach(fileItem => {
      zip.file(fileItem.editedName, fileItem.file);
    });
    
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = generateFileName('zip');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // 保存到历史记录
    saveToHistory();
  };

  // 获取文件图标
  const getFileIcon = (filename: string, colorClass: string = '') => {
    const extension = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(extension || '')) {
      return <Image className={`w-5 h-5 ${colorClass || 'text-blue-500'}`} />;
    }
    if (['txt', 'md', 'doc', 'docx', 'pdf'].includes(extension || '')) {
      return <FileText className={`w-5 h-5 ${colorClass || 'text-green-500'}`} />;
    }
    return <File className={`w-5 h-5 ${colorClass || 'text-gray-500'}`} />;
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, var(--mondrian-white) 0%, var(--mondrian-gray) 100%)' }}>
      {/* 头部导航 - 蒙德里安风格 */}
      <header className="mondrian-card border-0 rounded-none shadow-lg">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-24">
            <div className="flex items-center space-x-6 mondrian-accent pl-6">
              <div className="p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, var(--mondrian-blue), var(--mondrian-red))' }}>
                <FileText className="h-8 w-8 text-white" />
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-bold" style={{ color: 'var(--mondrian-black)' }}>《AiRename - 智能重命名助手》</h1>
                <p className="text-base font-medium" style={{ color: 'var(--mondrian-blue)' }}>让每个文件都有意义的名字</p>
              </div>
            </div>
            <nav className="flex items-center space-x-4">
              <Link 
                to="/" 
                className="apple-button flex items-center font-medium transition-all duration-200 hover:bg-gray-50"
                style={{ color: 'var(--mondrian-black)' }}
              >
                <Home className="w-5 h-5 mr-2" />
                首页
              </Link>
              <Link 
                to="/history" 
                className="apple-button flex items-center font-medium transition-all duration-200"
                style={{ color: 'var(--mondrian-blue)', borderColor: 'var(--mondrian-blue)' }}
              >
                <History className="w-5 h-5 mr-2" />
                历史记录
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        <div className="mondrian-card p-8" style={{background: 'var(--mondrian-white)'}}>
          <div className="text-center mb-8">
            <div className="mondrian-accent mb-4" style={{width: '60px', height: '4px', background: 'var(--mondrian-blue)', margin: '0 auto'}}></div>
            <h1 className="text-4xl font-bold mb-4" style={{color: 'var(--mondrian-black)'}}>AiRename - 文档智能命名</h1>
            <p className="text-lg" style={{color: 'var(--apple-gray-600)'}}>使用AI技术为您的文档生成专业、有意义的文件名</p>
          </div>

          {/* API配置状态 */}
          {!isApiConfigured() && (
            <div className="mb-6 p-4 rounded-lg" style={{background: 'var(--mondrian-yellow)', border: '2px solid var(--mondrian-red)'}}>
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" style={{color: 'var(--mondrian-red)'}} />
                <div style={{color: 'var(--mondrian-black)'}}>
                  <p className="font-medium mb-2">⚠️ 需要配置DeepSeek API密钥</p>
                  <p className="text-sm mb-2">请在.env文件中设置有效的VITE_DEEPSEEK_API_KEY。</p>
                  <div className="text-sm space-y-1">
                    <p><strong>获取方式：</strong></p>
                    <p>• 官方平台：<a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{color: 'var(--mondrian-blue)'}}>platform.deepseek.com/api_keys</a> (注意：已暂停新用户赠款)</p>
                    <p>• 第三方平台：<a href="https://api.siliconflow.cn" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{color: 'var(--mondrian-blue)'}}>SiliconFlow</a> (可能提供免费额度)</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 文件上传区域 */}
          <div className="mb-8">
            <div 
              className="border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer relative overflow-hidden"
              style={{
                borderColor: 'var(--mondrian-blue)',
                background: 'linear-gradient(135deg, var(--mondrian-white) 0%, rgba(0, 122, 255, 0.02) 100%)'
              }}
              onClick={() => fileInputRef.current?.click()}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--mondrian-red)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--mondrian-blue)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div className="absolute top-4 left-4 w-3 h-3 rounded-full" style={{background: 'var(--mondrian-red)'}}></div>
              <div className="absolute top-4 right-4 w-3 h-3 rounded-full" style={{background: 'var(--mondrian-yellow)'}}></div>
              <div className="relative z-10">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{background: 'linear-gradient(135deg, var(--mondrian-blue), var(--apple-blue))'}}>
                  <Upload className="w-8 h-8 text-white" />
                </div>
                <p className="text-lg mb-2 font-medium" style={{color: 'var(--mondrian-black)'}}>点击上传文件或拖拽文件到此处</p>
                <p className="text-sm" style={{color: 'var(--apple-gray-600)'}}>支持各种文档、图片和文本文件</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* 操作按钮 */}
          {files.length > 0 && (
            <div className="mb-6">
              {/* 选择操作栏 */}
              <div className="flex items-center justify-between mb-4 p-4 mondrian-card" style={{background: 'linear-gradient(135deg, var(--mondrian-white) 0%, rgba(0, 122, 255, 0.02) 100%)'}}>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center transition-all hover:scale-105"
                    style={{color: 'var(--mondrian-blue)'}}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--mondrian-red)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--mondrian-blue)'}
                  >
                    {selectAll ? (
                      <CheckSquare className="w-5 h-5 mr-2" />
                    ) : (
                      <Square className="w-5 h-5 mr-2" />
                    )}
                    全选
                  </button>
                  <div className="w-px h-6" style={{background: 'var(--mondrian-blue)'}}></div>
                  <span className="text-sm font-medium" style={{color: 'var(--apple-gray-600)'}}>
                    已选择 {selectedFiles.size} / {files.length} 个文件
                  </span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleBatchProcess}
                    disabled={isProcessing || !isApiConfigured()}
                    className="apple-button flex items-center px-6 py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: isProcessing || !isApiConfigured() ? 'var(--apple-gray-300)' : 'var(--mondrian-blue)',
                      color: 'white'
                    }}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {isProcessing ? '处理中...' : '一键处理'}
                  </button>
                  <button
                    onClick={generateZip}
                    disabled={selectedFiles.size === 0}
                    className="apple-button flex items-center px-6 py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: selectedFiles.size === 0 ? 'var(--apple-gray-300)' : 'var(--mondrian-red)',
                      color: selectedFiles.size === 0 ? 'var(--mondrian-black)' : 'white'
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" style={{color: selectedFiles.size === 0 ? 'var(--mondrian-black)' : 'white'}} />
                    {selectedFiles.size === 0 ? '下载选中文件' : `下载选中文件 (${selectedFiles.size})`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 文件列表 */}
          {files.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center mb-6">
                <div className="w-4 h-4 mr-3" style={{background: 'var(--mondrian-red)'}}></div>
                <h2 className="text-2xl font-semibold" style={{color: 'var(--mondrian-black)'}}>文件列表</h2>
                <div className="flex-1 h-px ml-4" style={{background: 'linear-gradient(to right, var(--mondrian-blue), transparent)'}}></div>
              </div>
              {files.map((fileItem, index) => (
                <div key={fileItem.id} className="mondrian-card p-6 transition-all hover:scale-[1.01]" style={{
                  background: currentProcessingIndex === index ? 'linear-gradient(135deg, rgba(0, 122, 255, 0.1), rgba(0, 122, 255, 0.05))' : 
                  selectedFiles.has(fileItem.id) ? 'linear-gradient(135deg, rgba(255, 59, 48, 0.1), rgba(255, 59, 48, 0.05))' : 'var(--mondrian-white)',
                  border: currentProcessingIndex === index ? '2px solid var(--mondrian-blue)' : 
                  selectedFiles.has(fileItem.id) ? '2px solid var(--mondrian-red)' : '1px solid var(--apple-gray-200)'
                }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      {/* 选择框 */}
                      <button
                        onClick={() => handleFileSelect(fileItem.id)}
                        className="flex-shrink-0 p-2 rounded-lg transition-all hover:scale-110"
                        style={{background: selectedFiles.has(fileItem.id) ? 'var(--mondrian-red)' : 'var(--apple-gray-100)'}}
                      >
                        {selectedFiles.has(fileItem.id) ? (
                          <CheckSquare className="w-5 h-5 text-white" />
                        ) : (
                          <Square className="w-5 h-5" style={{color: 'var(--apple-gray-400)'}} />
                        )}
                      </button>
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{background: 'linear-gradient(135deg, var(--mondrian-blue), var(--apple-blue)'}}>
                        {getFileIcon(fileItem.originalName, 'text-white')}
                      </div>
                      <div className="flex-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="flex items-center mb-1">
                              <div className="w-2 h-2 rounded-full mr-2" style={{background: 'var(--mondrian-yellow)'}}></div>
                              <p className="text-sm font-medium" style={{color: 'var(--apple-gray-600)'}}>原文件名</p>
                            </div>
                            <p className="font-medium" style={{color: 'var(--mondrian-black)'}}>{fileItem.originalName}</p>
                          </div>
                          <div>
                            <div className="flex items-center mb-1">
                              <div className="w-2 h-2 rounded-full mr-2" style={{background: 'var(--mondrian-red)'}}></div>
                              <p className="text-sm font-medium" style={{color: 'var(--apple-gray-600)'}}>新文件名</p>
                            </div>
                            {fileItem.isEditing ? (
                              <div className="flex items-center space-x-2">
                                <input
                                  type="text"
                                  defaultValue={fileItem.editedName}
                                  className="flex-1 px-4 py-2 rounded-lg transition-all focus:outline-none focus:scale-105"
                                  style={{
                                    border: '2px solid var(--mondrian-blue)',
                                    background: 'var(--mondrian-white)',
                                    color: 'var(--mondrian-black)'
                                  }}
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                      saveEdit(fileItem.id, (e.target as HTMLInputElement).value);
                                    }
                                  }}
                                  onFocus={(e) => e.target.style.borderColor = 'var(--mondrian-red)'}
                                  onBlur={(e) => e.target.style.borderColor = 'var(--mondrian-blue)'}
                                  autoFocus
                                />
                                <button
                                  onClick={(e) => {
                                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                    saveEdit(fileItem.id, input.value);
                                  }}
                                  className="apple-button px-4 py-2 rounded-lg transition-all"
                                  style={{background: 'var(--mondrian-red)', color: 'white'}}
                                >
                                  保存
                                </button>
                                <button
                                  onClick={() => cancelEdit(fileItem.id)}
                                  className="apple-button px-4 py-2 rounded-lg transition-all"
                                  style={{background: 'var(--apple-gray-500)', color: 'white'}}
                                >
                                  取消
                                </button>
                              </div>
                            ) : (
                              <p className="font-medium" style={{
                                color: fileItem.editedName !== fileItem.originalName ? 'var(--mondrian-red)' : 'var(--mondrian-black)'
                              }}>
                                {fileItem.editedName}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      {fileItem.isProcessing && (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{background: 'var(--mondrian-blue)'}}>
                          <Clock className="w-4 h-4 text-white animate-spin" />
                        </div>
                      )}
                      {fileItem.isProcessed && !fileItem.isProcessing && (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{background: 'var(--mondrian-red)'}}>
                          <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                      )}
                      {!fileItem.isEditing && (
                        <button
                          onClick={() => startEditing(fileItem.id)}
                          className="p-2 rounded-lg transition-all hover:scale-110"
                          style={{background: 'var(--apple-gray-100)'}}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--mondrian-yellow)';
                            e.currentTarget.style.transform = 'scale(1.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--apple-gray-100)';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          <Edit2 className="w-5 h-5" style={{color: 'var(--apple-gray-600)'}} />
                        </button>
                      )}
                      <button
                        onClick={() => removeFile(fileItem.id)}
                        className="p-2 rounded-lg transition-all hover:scale-110"
                        style={{background: 'var(--apple-gray-100)'}}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--mondrian-red)';
                          e.currentTarget.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--apple-gray-100)';
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      >
                        <Trash2 className="w-5 h-5" style={{color: 'var(--apple-gray-600)'}} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {files.length === 0 && (
            <div className="text-center py-12">
              <div className="relative mb-6">
                <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center" style={{background: 'linear-gradient(135deg, var(--mondrian-blue), var(--apple-blue))'}}>
                  <FileText className="w-10 h-10 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full" style={{background: 'var(--mondrian-red)'}}></div>
                <div className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full" style={{background: 'var(--mondrian-yellow)'}}></div>
              </div>
              <p className="text-xl font-medium mb-2" style={{color: 'var(--mondrian-black)'}}>还没有上传任何文件</p>
              <p style={{color: 'var(--apple-gray-600)'}}>上传文件开始智能重命名</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcessPage;