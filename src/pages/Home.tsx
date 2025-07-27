import { useState, useCallback } from 'react';
import { Upload, FileText, Download, Edit3, Check, X } from 'lucide-react';

interface FileItem {
  id: string;
  originalName: string;
  suggestedName: string;
  editedName: string;
  content: string;
  isEditing: boolean;
  isProcessing: boolean;
}

export default function Home() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // 处理文件拖拽
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  // 处理文件放置
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  }, []);

  // 处理文件选择
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      handleFiles(selectedFiles);
    }
  };

  // 处理文件上传和AI分析
  const handleFiles = async (fileList: File[]) => {
    const maxFiles = parseInt(import.meta.env.VITE_MAX_FILES_COUNT || '10');
    const maxSize = 200 * 1024 * 1024; // 200MB
    
    // 支持的文件类型
    const supportedExtensions = ['.txt', '.md', '.doc', '.docx', '.xls', '.xlsx', '.py', '.pdf', '.ppt', '.pptx', '.png', '.jpg', '.jpeg', '.gif'];
    
    // 过滤文件类型和大小
    const validFiles = fileList.filter(file => {
      const fileName = file.name.toLowerCase();
      const isValidType = supportedExtensions.some(ext => fileName.endsWith(ext));
      const isValidSize = file.size <= maxSize;
      return isValidType && isValidSize;
    }).slice(0, maxFiles);

    if (validFiles.length === 0) {
      alert('请选择有效的文件格式（支持 .txt, .md, .doc, .docx, .xls, .xlsx, .py, .pdf, .ppt, .pptx, .png, .jpg, .jpeg, .gif，大小不超过 200MB）');
      return;
    }

    setIsUploading(true);
    
    try {
      const newFiles: FileItem[] = [];
      
      for (const file of validFiles) {
        const content = await readFileContent(file);
        const fileItem: FileItem = {
          id: Math.random().toString(36).substr(2, 9),
          originalName: file.name,
          suggestedName: '',
          editedName: '',
          content,
          isEditing: false,
          isProcessing: true
        };
        newFiles.push(fileItem);
      }
      
      setFiles(prev => [...prev, ...newFiles]);
      
      // 为每个文件调用AI API
      for (const fileItem of newFiles) {
        try {
          const suggestedName = await generateFileName(fileItem.content, fileItem.originalName);
          setFiles(prev => prev.map(f => 
            f.id === fileItem.id 
              ? { ...f, suggestedName, editedName: suggestedName, isProcessing: false }
              : f
          ));
        } catch (error) {
          console.error('AI处理失败:', error);
          setFiles(prev => prev.map(f => 
            f.id === fileItem.id 
              ? { ...f, suggestedName: fileItem.originalName, editedName: fileItem.originalName, isProcessing: false }
              : f
          ));
        }
      }
    } catch (error) {
      console.error('文件处理失败:', error);
      alert('文件处理失败，请重试');
    } finally {
      setIsUploading(false);
    }
  };

  // 读取文件内容
  const readFileContent = async (file: File): Promise<string> => {
    const fileName = file.name.toLowerCase();
    
    try {
      // 文本文件直接读取
      if (fileName.endsWith('.txt') || fileName.endsWith('.md') || fileName.endsWith('.py')) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsText(file, 'UTF-8');
        });
      }
      
      // Word文档
      if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value;
      }
      
      // Excel文件
      if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
        const arrayBuffer = await file.arrayBuffer();
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        let content = '';
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          content += XLSX.utils.sheet_to_txt(sheet) + '\n';
        });
        return content;
      }
      
      // PDF文件
      if (fileName.endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        const pdfParse = await import('pdf-parse');
        const data = await pdfParse.default(arrayBuffer);
        return data.text;
      }
      
      // PowerPoint文件 - 暂时返回文件名信息
      if (fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) {
        return `PowerPoint演示文稿: ${file.name}\n文件大小: ${(file.size / 1024 / 1024).toFixed(2)}MB\n创建时间: ${new Date(file.lastModified).toLocaleString()}`;
      }
      
      // 图片文件 - 返回文件信息
      if (fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.gif')) {
        return `图片文件: ${file.name}\n文件大小: ${(file.size / 1024 / 1024).toFixed(2)}MB\n文件类型: ${file.type}\n最后修改: ${new Date(file.lastModified).toLocaleString()}`;
      }
      
      // 默认情况
      return `文件: ${file.name}\n文件大小: ${(file.size / 1024 / 1024).toFixed(2)}MB\n文件类型: ${file.type}\n最后修改: ${new Date(file.lastModified).toLocaleString()}`;
      
    } catch (error) {
      console.error('文件读取失败:', error);
      return `文件读取失败: ${file.name}\n错误信息: ${error instanceof Error ? error.message : '未知错误'}`;
    }
  };

  // 调用AI API生成文件名
  const generateFileName = async (content: string, originalName: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
    const baseUrl = import.meta.env.VITE_DEEPSEEK_API_BASE_URL;
    
    if (!apiKey || !baseUrl) {
      throw new Error('API配置缺失');
    }

    // 使用专业的文档理解与命名专家prompt
    const systemPrompt = `# Role

智能文档理解与命名专家

## Profile

* author: eureka
* version: 2.1
* description: 作为一名专注于语义理解与结构提炼的 AI 专家，负责阅读各类文档，精准提炼核心价值，生成逻辑清晰的概要与高度识别性的标题，以提升文档的可管理性与搜索效率。

## Constraints

* 必须完整覆盖文档中的关键信息与价值点，避免遗漏。
* 文档标题必须高度凝练，具备唯一性、识别性与搜索友好性。
* 概要内容应逻辑清晰、语义准确，不进行主观推断或夸大。
* 严禁直接复制文档中的句子作为标题使用。
* 所有输出必须使用正式书面语表达，避免口语化。

## Response Format

请严格使用以下格式返回：

**文档概要**：
<用 2~4 句描述文档核心内容>

**文档标题**：
<一句话标题，15 字以内>`;

    const userPrompt = `请深入阅读以下文档内容，调用语言理解、结构建模与语义抽象等能力，识别其主题、重点信息及核心意图。以结构清晰、语言专业的方式，输出高质量的"文档概要"与"文档标题"。

原文件名：${originalName}

文档内容：
${content.substring(0, 3000)}

请按照指定格式返回文档概要和标题。`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content?.trim();
    
    if (!aiResponse) {
      throw new Error('AI返回空结果');
    }

    // 提取文档标题
    const titleMatch = aiResponse.match(/\*\*文档标题\*\*[：:](.*?)(?=\n|$)/s);
    let suggestedName = titleMatch ? titleMatch[1].trim() : '';
    
    // 如果没有找到标题，尝试其他格式
    if (!suggestedName) {
      const lines = aiResponse.split('\n').filter(line => line.trim());
      suggestedName = lines[lines.length - 1].trim();
    }
    
    // 清理标题，移除特殊字符
    suggestedName = suggestedName.replace(/[<>:"/\\|?*]/g, '').trim();
    
    if (!suggestedName || suggestedName.length < 2) {
      // 如果AI生成失败，使用原文件名
      suggestedName = originalName.replace(/\.[^/.]+$/, '');
    }

    return suggestedName;
  };

  // 编辑文件名
  const startEditing = (id: string) => {
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, isEditing: true } : f
    ));
  };

  const saveEdit = (id: string) => {
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, isEditing: false } : f
    ));
  };

  const cancelEdit = (id: string) => {
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, isEditing: false, editedName: f.suggestedName } : f
    ));
  };

  const updateEditedName = (id: string, newName: string) => {
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, editedName: newName } : f
    ));
  };

  // 删除文件
  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  // 生成并下载ZIP文件
  const generateZip = async () => {
    if (files.length === 0) {
      alert('请先上传文件');
      return;
    }

    setIsGenerating(true);
    
    try {
      // 动态导入JSZip
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      // 添加文件到ZIP
      files.forEach(file => {
        const fileName = file.editedName || file.suggestedName || file.originalName;
        const extension = file.originalName.split('.').pop() || 'txt';
        const finalName = fileName.endsWith(`.${extension}`) ? fileName : `${fileName}.${extension}`;
        zip.file(finalName, file.content);
      });
      
      // 生成ZIP文件
      const content = await zip.generateAsync({ type: 'blob' });
      
      // 下载文件
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'renamed_files.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('生成ZIP失败:', error);
      alert('生成下载包失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      {/* 头部导航 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <FileText className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AiRename</h1>
                <h2 className="text-lg font-medium text-gray-600">智能重命名助手</h2>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              让每个文件都有意义的名字 - AI驱动的智能文档命名系统
            </div>
          </div>
        </div>
      </header>

      {/* 主要内容 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 文件上传区域 */}
        <div className="mb-8">
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              拖拽文件到此处或点击选择
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              支持 .txt, .md, .doc, .docx, .xls, .xlsx, .py, .pdf, .ppt, .pptx, .png, .jpg, .jpeg, .gif 文件，单个文件最大 200MB，最多同时处理 10 个文件
            </p>
            <input
              type="file"
              multiple
              accept=".txt,.md,.doc,.docx,.xls,.xlsx,.py,.pdf,.ppt,.pptx,.png,.jpg,.jpeg,.gif"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isUploading}
            />
            {isUploading && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
                <div className="text-blue-600 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <span className="text-sm font-medium">智能分析: 应用将自动上传并分析您的文件。请稍候片刻。</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 文件列表和预览表格 */}
        {files.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900">
                  文件重命名预览 ({files.length} 个文件)
                </h2>
                <button
                  onClick={generateZip}
                  disabled={isGenerating || files.some(f => f.isProcessing)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      生成中...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      下载重命名文件包
                    </>
                  )}
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      原文件名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      AI 建议新名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {files.map((file) => (
                    <tr key={file.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 text-gray-400 mr-3" />
                          <span className="text-sm text-gray-900">{file.originalName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {file.isProcessing ? (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                            <span className="text-sm text-gray-500">智能分析: 应用将自动上传并分析您的文件。请稍候片刻。</span>
                          </div>
                        ) : file.isEditing ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={file.editedName}
                              onChange={(e) => updateEditedName(file.id, e.target.value)}
                              className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
                            <button
                              onClick={() => saveEdit(file.id)}
                              className="text-green-600 hover:text-green-800"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => cancelEdit(file.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-900">{file.editedName}</span>
                            <button
                              onClick={() => startEditing(file.id)}
                              className="ml-2 text-blue-600 hover:text-blue-800"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => removeFile(file.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 使用说明 */}
        {files.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mt-8">
            <h2 className="text-lg font-medium text-gray-900 mb-4">使用说明</h2>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">1</span>
                <span>拖拽或选择您要重命名的文档文件（支持 .txt, .md, .doc, .docx, .xls, .xlsx, .py, .pdf, .ppt, .pptx, .png, .jpg, .jpeg, .gif 格式）</span>
              </div>
              <div className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">2</span>
                <span>AI 将自动分析文档内容并生成智能文件名建议</span>
              </div>
              <div className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">3</span>
                <span>您可以在预览表格中编辑和调整 AI 建议的文件名</span>
              </div>
              <div className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">4</span>
                <span>确认无误后，点击下载按钮获取重命名后的文件压缩包</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}