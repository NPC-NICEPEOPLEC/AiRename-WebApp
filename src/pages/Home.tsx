import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
    
    // 支持的文件类型 - 与后端保持一致
    const supportedExtensions = [
      // 文本文档
      '.txt', '.md', '.rtf', '.tex', '.log', '.csv', '.tsv',
      // Microsoft Office
      '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      // OpenOffice/LibreOffice
      '.odt', '.ods', '.odp', '.odg', '.odf',
      // 代码文件
      '.py', '.js', '.html', '.htm', '.css', '.json', '.xml', '.yaml', '.yml',
      '.java', '.cpp', '.c', '.h', '.php', '.rb', '.go', '.rs', '.swift', '.kt',
      '.sql', '.sh', '.bat', '.ps1', '.r', '.m', '.scala', '.pl', '.lua',
      // PDF和电子书
      '.pdf', '.epub', '.mobi', '.azw', '.azw3',
      // 图片格式
      '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.tif', '.webp', '.svg',
      '.ico', '.psd', '.ai', '.eps', '.raw', '.cr2', '.nef', '.arw',
      // 音视频格式
      '.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a',
      '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v',
      // 压缩文件
      '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz',
      // 其他常见格式
      '.ics', '.vcf', '.kml', '.gpx', '.dwg', '.dxf', '.step', '.stl'
    ];
    
    // 过滤文件类型和大小
    const validFiles = fileList.filter(file => {
      const fileName = file.name.toLowerCase();
      const isValidType = supportedExtensions.some(ext => fileName.endsWith(ext));
      const isValidSize = file.size <= maxSize;
      return isValidType && isValidSize;
    }).slice(0, maxFiles);

    if (validFiles.length === 0) {
      alert('请选择有效的文件格式（支持文档、表格、图片、代码、音视频等60+种常见格式，大小不超过 200MB）');
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
      if (fileName.endsWith('.txt') || fileName.endsWith('.md') || fileName.endsWith('.py') || 
          fileName.endsWith('.js') || fileName.endsWith('.html') || fileName.endsWith('.htm') ||
          fileName.endsWith('.css') || fileName.endsWith('.json') || fileName.endsWith('.xml') ||
          fileName.endsWith('.yaml') || fileName.endsWith('.yml') || fileName.endsWith('.java') ||
          fileName.endsWith('.cpp') || fileName.endsWith('.c') || fileName.endsWith('.h') ||
          fileName.endsWith('.php') || fileName.endsWith('.rb') || fileName.endsWith('.go') ||
          fileName.endsWith('.rs') || fileName.endsWith('.swift') || fileName.endsWith('.kt') ||
          fileName.endsWith('.sql') || fileName.endsWith('.sh') || fileName.endsWith('.bat') ||
          fileName.endsWith('.ps1') || fileName.endsWith('.r') || fileName.endsWith('.m') ||
          fileName.endsWith('.scala') || fileName.endsWith('.pl') || fileName.endsWith('.lua') ||
          fileName.endsWith('.rtf') || fileName.endsWith('.tex') || fileName.endsWith('.log') ||
          fileName.endsWith('.csv') || fileName.endsWith('.tsv')) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsText(file, 'UTF-8');
        });
      }
      
      // Word文档和OpenOffice文档
      if (fileName.endsWith('.doc') || fileName.endsWith('.docx') || 
          fileName.endsWith('.odt')) {
        const arrayBuffer = await file.arrayBuffer();
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value;
      }
      
      // Excel文件和OpenOffice表格
      if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx') || 
          fileName.endsWith('.ods')) {
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
      
      // PowerPoint文件和OpenOffice演示文稿 - 暂时返回文件名信息
      if (fileName.endsWith('.ppt') || fileName.endsWith('.pptx') || 
          fileName.endsWith('.odp')) {
        return `演示文稿: ${file.name}\n文件大小: ${(file.size / 1024 / 1024).toFixed(2)}MB\n创建时间: ${new Date(file.lastModified).toLocaleString()}`;
      }
      
      // 电子书文件
      if (fileName.endsWith('.epub') || fileName.endsWith('.mobi') || 
          fileName.endsWith('.azw') || fileName.endsWith('.azw3')) {
        return `电子书文件: ${file.name}\n文件大小: ${(file.size / 1024 / 1024).toFixed(2)}MB\n文件类型: ${file.type}\n最后修改: ${new Date(file.lastModified).toLocaleString()}`;
      }
      
      // 图片文件 - 返回文件信息
      if (fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || 
          fileName.endsWith('.gif') || fileName.endsWith('.bmp') || fileName.endsWith('.tiff') ||
          fileName.endsWith('.tif') || fileName.endsWith('.webp') || fileName.endsWith('.svg') ||
          fileName.endsWith('.ico') || fileName.endsWith('.psd') || fileName.endsWith('.ai') ||
          fileName.endsWith('.eps') || fileName.endsWith('.raw') || fileName.endsWith('.cr2') ||
          fileName.endsWith('.nef') || fileName.endsWith('.arw')) {
        return `图片文件: ${file.name}\n文件大小: ${(file.size / 1024 / 1024).toFixed(2)}MB\n文件类型: ${file.type}\n最后修改: ${new Date(file.lastModified).toLocaleString()}`;
      }
      
      // 音频文件
      if (fileName.endsWith('.mp3') || fileName.endsWith('.wav') || fileName.endsWith('.flac') ||
          fileName.endsWith('.aac') || fileName.endsWith('.ogg') || fileName.endsWith('.wma') ||
          fileName.endsWith('.m4a')) {
        return `音频文件: ${file.name}\n文件大小: ${(file.size / 1024 / 1024).toFixed(2)}MB\n文件类型: ${file.type}\n最后修改: ${new Date(file.lastModified).toLocaleString()}`;
      }
      
      // 视频文件
      if (fileName.endsWith('.mp4') || fileName.endsWith('.avi') || fileName.endsWith('.mkv') ||
          fileName.endsWith('.mov') || fileName.endsWith('.wmv') || fileName.endsWith('.flv') ||
          fileName.endsWith('.webm') || fileName.endsWith('.m4v')) {
        return `视频文件: ${file.name}\n文件大小: ${(file.size / 1024 / 1024).toFixed(2)}MB\n文件类型: ${file.type}\n最后修改: ${new Date(file.lastModified).toLocaleString()}`;
      }
      
      // 压缩文件
      if (fileName.endsWith('.zip') || fileName.endsWith('.rar') || fileName.endsWith('.7z') ||
          fileName.endsWith('.tar') || fileName.endsWith('.gz') || fileName.endsWith('.bz2') ||
          fileName.endsWith('.xz')) {
        return `压缩文件: ${file.name}\n文件大小: ${(file.size / 1024 / 1024).toFixed(2)}MB\n文件类型: ${file.type}\n最后修改: ${new Date(file.lastModified).toLocaleString()}`;
      }
      
      // 其他专业格式文件
      if (fileName.endsWith('.ics') || fileName.endsWith('.vcf') || fileName.endsWith('.kml') ||
          fileName.endsWith('.gpx') || fileName.endsWith('.dwg') || fileName.endsWith('.dxf') ||
          fileName.endsWith('.step') || fileName.endsWith('.stl') || fileName.endsWith('.odg') ||
          fileName.endsWith('.odf')) {
        return `专业格式文件: ${file.name}\n文件大小: ${(file.size / 1024 / 1024).toFixed(2)}MB\n文件类型: ${file.type}\n最后修改: ${new Date(file.lastModified).toLocaleString()}`;
      }
      
      // 默认情况
      return `文件: ${file.name}\n文件大小: ${(file.size / 1024 / 1024).toFixed(2)}MB\n文件类型: ${file.type}\n最后修改: ${new Date(file.lastModified).toLocaleString()}`;
      
    } catch (error) {
      console.error('文件读取失败:', error);
      return `文件读取失败: ${file.name}\n错误信息: ${error instanceof Error ? error.message : '未知错误'}`;
    }
  };

  // 🔒 安全提示：为了保护API密钥安全，此功能已禁用
  // 请使用"处理文件"页面的安全功能进行文件重命名
  const generateFileName = async (content: string, originalName: string): Promise<string> => {
    // 安全考虑：不在前端直接调用API，避免密钥暴露
    throw new Error('为了安全考虑，请使用"处理文件"页面进行文件重命名操作');
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
      <header className="mondrian-card border-0 rounded-none shadow-lg">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-24">
            <div className="flex items-center space-x-6 mondrian-accent pl-6">
              <div className="p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, var(--mondrian-blue), var(--mondrian-red))' }}>
                <FileText className="h-8 w-8 text-white" />
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-bold" style={{ color: 'var(--mondrian-black)' }}>智能文件重命名</h1>
                <p className="text-base font-medium" style={{ color: 'var(--mondrian-blue)' }}>让每个文件都有意义的名字</p>
              </div>
            </div>
            <div className="text-sm" style={{ color: 'var(--apple-gray-500)' }}>
              AI驱动的智能文档命名系统
            </div>
          </div>
        </div>
      </header>

      {/* 主要内容 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 安全提示 */}
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-yellow-800">安全提示</h3>
              <p className="mt-1 text-sm text-yellow-700">
                为了保护API密钥安全，此页面的AI重命名功能已禁用。请使用"处理文件"页面进行安全的文件重命名操作。
              </p>
            </div>
          </div>
        </div>

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