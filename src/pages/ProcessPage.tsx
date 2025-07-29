import React, { useState, useRef, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Upload, Download, Edit2, Trash2, Play, Pause, FileText, Image, File, CheckCircle, Clock, AlertCircle, Home, History, CheckSquare, Square } from 'lucide-react';
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
  const [isPaused, setIsPaused] = useState(false);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState(-1);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const shouldStopProcessing = useRef(false);

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
    const backendUrl = import.meta.env.VITE_BACKEND_API_URL;
    return backendUrl && backendUrl !== '';
  };

  // 支持的文件类型 - 与后端保持一致
  const supportedTypes = [
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

  // 验证文件
  const validateFile = (file: File): string | null => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!supportedTypes.includes(extension)) {
      return `不支持的文件类型: ${extension}`;
    }
    if (file.size > 200 * 1024 * 1024) { // 200MB
      return '文件大小超过 200MB 限制';
    }
    return null;
  };

  // 文件上传处理
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(event.target.files || []);
    const newFiles: FileItem[] = [];
    const errors: string[] = [];

    uploadedFiles.forEach((file) => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
        return;
      }

      // 检查是否已存在
      if (files.some(f => f.originalName === file.name)) {
        errors.push(`${file.name}: 文件已存在`);
        return;
      }

      newFiles.push({
        id: Math.random().toString(36).substr(2, 9),
        file,
        originalName: file.name,
        newName: file.name,
        editedName: file.name,
        isEditing: false,
        isProcessing: false,
        isProcessed: false
      });
    });

    if (errors.length > 0) {
      alert('以下文件无法添加:\n' + errors.join('\n'));
    }

    if (newFiles.length > 0) {
      const totalFiles = files.length + newFiles.length;
      if (totalFiles > 10) {
        alert('最多只能同时处理 10 个文件');
        return;
      }
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  // 拖拽处理
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const uploadedFiles = Array.from(e.dataTransfer.files);
      const newFiles: FileItem[] = [];
      const errors: string[] = [];

      uploadedFiles.forEach((file) => {
        const error = validateFile(file);
        if (error) {
          errors.push(`${file.name}: ${error}`);
          return;
        }

        // 检查是否已存在
        if (files.some(f => f.originalName === file.name)) {
          errors.push(`${file.name}: 文件已存在`);
          return;
        }

        newFiles.push({
          id: Math.random().toString(36).substr(2, 9),
          file,
          originalName: file.name,
          newName: file.name,
          editedName: file.name,
          isEditing: false,
          isProcessing: false,
          isProcessed: false
        });
      });

      if (errors.length > 0) {
        alert('以下文件无法添加:\n' + errors.join('\n'));
      }

      if (newFiles.length > 0) {
        const totalFiles = files.length + newFiles.length;
        if (totalFiles > 10) {
          alert('最多只能同时处理 10 个文件');
          return;
        }
        setFiles(prev => [...prev, ...newFiles]);
      }
    }
  };

  // 读取文件内容（保留但不使用，因为直接发送原始文件到后端）
  // const readFileContent = async (file: File): Promise<string> => {
  //   const fileExtension = file.name.split('.').pop()?.toLowerCase();
  //   const isTextFile = ['txt', 'md', 'rtf', 'tex', 'log', 'csv', 'tsv', 'json', 'js', 'ts', 'jsx', 'tsx', 'css', 'html', 'htm', 'xml', 'yaml', 'yml', 'java', 'cpp', 'c', 'h', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'sql', 'sh', 'bat', 'ps1', 'r', 'm', 'scala', 'pl', 'lua', 'py'].includes(fileExtension || '');
  //   const isImageFile = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp', 'svg', 'ico', 'psd', 'ai', 'eps', 'raw', 'cr2', 'nef', 'arw'].includes(fileExtension || '');
  //   const isBinaryFile = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'odg', 'odf', 'epub', 'mobi', 'azw', 'azw3'].includes(fileExtension || '');
  //   const isMediaFile = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v'].includes(fileExtension || '');
  //   const isArchiveFile = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(fileExtension || '');
  //   const isSpecialFile = ['ics', 'vcf', 'kml', 'gpx', 'dwg', 'dxf', 'step', 'stl'].includes(fileExtension || '');

  //   if (isTextFile) {
  //     try {
  //       const content = await file.text();
  //       if (content.trim()) {
  //         return `这是一个${fileExtension?.toUpperCase()}文件，文件内容：\n${content.slice(0, 2000)}${content.length > 2000 ? '...(内容已截断)' : ''}`;
  //       }
  //     } catch (error) {
  //       console.warn('读取文本文件失败:', error);
  //     }
  //   }

  //   // 为图片和二进制文件提供详细的元数据信息
  //   const fileInfo = {
  //     name: file.name,
  //     size: file.size,
  //     type: file.type,
  //     lastModified: new Date(file.lastModified).toLocaleString('zh-CN'),
  //     extension: fileExtension?.toUpperCase() || '未知'
  //   };

  //   if (isImageFile) {
  //     return `这是一个图片文件，详细信息：\n` +
  //            `- 原始文件名：${fileInfo.name}\n` +
  //            `- 文件大小：${(fileInfo.size / 1024 / 1024).toFixed(2)}MB\n` +
  //            `- 图片格式：${fileInfo.extension}\n` +
  //            `- 最后修改时间：${fileInfo.lastModified}\n` +
  //            `请根据文件名模式、拍摄时间等信息推断图片的用途和内容。`;
  //   }

  //   if (isBinaryFile) {
  //     return `这是一个${fileInfo.extension}文档，详细信息：\n` +
  //            `- 原始文件名：${fileInfo.name}\n` +
  //            `- 文件大小：${(fileInfo.size / 1024 / 1024).toFixed(2)}MB\n` +
  //            `- 文档类型：${fileInfo.extension}\n` +
  //            `- 最后修改时间：${fileInfo.lastModified}\n` +
  //            `请根据文件名、大小、修改时间等信息推断文档的内容和用途。`;
  //   }

  //   if (isMediaFile) {
  //     return `这是一个${fileInfo.extension}媒体文件，详细信息：\n` +
  //            `- 原始文件名：${fileInfo.name}\n` +
  //            `- 文件大小：${(fileInfo.size / 1024 / 1024).toFixed(2)}MB\n` +
  //            `- 媒体类型：${fileInfo.extension}\n` +
  //            `- 最后修改时间：${fileInfo.lastModified}\n` +
  //            `请根据文件名、时间等信息推断媒体文件的用途和内容。`;
  //   }

  //   if (isArchiveFile) {
  //     return `这是一个${fileInfo.extension}压缩文件，详细信息：\n` +
  //            `- 原始文件名：${fileInfo.name}\n` +
  //            `- 文件大小：${(fileInfo.size / 1024 / 1024).toFixed(2)}MB\n` +
  //            `- 压缩格式：${fileInfo.extension}\n` +
  //            `- 最后修改时间：${fileInfo.lastModified}\n` +
  //            `请根据文件名等信息推断压缩包的用途和可能包含的内容。`;
  //   }

  //   if (isSpecialFile) {
  //     return `这是一个${fileInfo.extension}专业格式文件，详细信息：\n` +
  //            `- 原始文件名：${fileInfo.name}\n` +
  //            `- 文件大小：${(fileInfo.size / 1024 / 1024).toFixed(2)}MB\n` +
  //            `- 文件格式：${fileInfo.extension}\n` +
  //            `- 最后修改时间：${fileInfo.lastModified}\n` +
  //            `请根据文件名、格式等信息推断文件的专业用途和内容。`;
  //   }

  //   // 其他文件类型
  //   return `这是一个${fileInfo.extension}文件，详细信息：\n` +
  //          `- 原始文件名：${fileInfo.name}\n` +
  //          `- 文件大小：${(fileInfo.size / 1024).toFixed(2)}KB\n` +
  //          `- 文件类型：${fileInfo.type || '未知'}\n` +
  //          `- 最后修改时间：${fileInfo.lastModified}\n` +
  //          `请根据可用信息推断文件的用途和内容。`;
  // };

  // 调用后端 API - 直接发送原始文件
  const callDeepSeekAPI = async (file: File): Promise<string> => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_API_URL;
      
      if (!backendUrl) {
        throw new Error('后端API配置缺失，请检查.env文件中的VITE_BACKEND_API_URL配置');
      }

      // 创建FormData并直接发送原始文件
      const formData = new FormData();
      formData.append('file', file, file.name); // 确保文件名正确传递
      formData.append('file_type', '通用文档');
      
      console.log('发送文件到后端:', {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size
      });

      const response = await fetch(`${backendUrl}/process-document/`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error('API密钥无效或已过期，请检查后端.env文件中的DEEPSEEK_API_KEY配置');
        }
        throw new Error(`后端API请求失败: ${response.status} - ${errorData.detail || '未知错误'}`);
      }

      const data = await response.json();
      
      if (!data.ai_result || !data.ai_result.title) {
        throw new Error('后端API响应格式错误');
      }

      return data.ai_result.title || '智能重命名文件';
    } catch (error) {
      console.error('后端API调用失败:', error);
      throw error;
    }
  };

  // 处理单个文件
  const processFile = async (fileItem: FileItem) => {
    try {
      setFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { ...f, isProcessing: true } : f
      ));

      // 直接发送原始文件到后端进行处理
      const newName = await callDeepSeekAPI(fileItem.file);
      
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
    if (isProcessing) {
      // 如果正在处理，则暂停
      shouldStopProcessing.current = true;
      setIsPaused(true);
      setIsProcessing(false);
      return;
    }

    // 重置停止标志
    shouldStopProcessing.current = false;
    
    if (isPaused) {
      // 如果已暂停，则继续处理
      setIsPaused(false);
    } else {
      // 开始新的处理
      setIsPaused(false);
      setCurrentProcessingIndex(0);
    }
    
    setIsProcessing(true);
    const startIndex = isPaused ? currentProcessingIndex : 0;
    
    for (let i = startIndex; i < files.length; i++) {
      // 检查是否被暂停
      if (shouldStopProcessing.current) {
        break;
      }
      
      if (!files[i].isProcessed) {
        setCurrentProcessingIndex(i);
        await processFile(files[i]);
        
        // 在延迟期间也检查是否被暂停
        if (i < files.length - 1 && !shouldStopProcessing.current) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // 如果没有被暂停，说明处理完成
    if (!shouldStopProcessing.current) {
      setIsProcessing(false);
      setIsPaused(false);
      setCurrentProcessingIndex(-1);
      
      // 处理完成后自动保存到历史记录
      saveToHistory();
    }
  };

  // 处理自动处理逻辑
  useEffect(() => {
    if (files.length > 0 && location.state?.autoProcess && isApiConfigured() && !isProcessing) {
      // 延迟执行确保状态更新完成
      const timer = setTimeout(() => {
        handleBatchProcess();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [files, location.state?.autoProcess, isProcessing, handleBatchProcess]);

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
    
    // 为每个文件创建单独的记录（保留但不使用）
    // const fileRecords = files.map(f => {
    //   const extension = f.originalName.split('.').pop() || '';
    //   return {
    //     id: Math.random().toString(36).substr(2, 9),
    //     timestamp,
    //     originalName: f.originalName,
    //     newName: f.editedName,
    //     fileExtension: extension,
    //     batchId
    //   };
    // });

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

    const existingHistory = localStorage.getItem('airename_history');
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

    localStorage.setItem('airename_history', JSON.stringify(history));
  };

  // 生成文件名（按照用户要求的格式）
  const generateFileName = (extension: string) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `AiRename${year}${month}${day}_${hours}${minutes}${seconds}.${extension}`;
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
                <h1 className="text-2xl font-bold" style={{ color: 'var(--mondrian-black)' }}>智能文件重命名</h1>
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
                  <p className="font-medium mb-2">⚠️ 需要配置后端API服务</p>
                  <p className="text-sm mb-2">请确保后端服务器正在运行，并在.env文件中设置VITE_BACKEND_API_URL。</p>
                  <div className="text-sm space-y-1">
                    <p><strong>后端配置：</strong></p>
                    <p>• 后端服务器地址：<code style={{background: 'var(--apple-gray-100)', padding: '2px 4px', borderRadius: '4px'}}>http://localhost:8001</code></p>
                    <p>• 确保后端服务器已启动并配置了有效的DeepSeek API密钥</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 文件上传区域 */}
          <div className="mb-8">
            <div 
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer relative overflow-hidden ${
                dragActive ? 'border-red-500 bg-red-50' : ''
              }`}
              style={{
                borderColor: dragActive ? 'var(--mondrian-red)' : 'var(--mondrian-blue)',
                background: dragActive 
                  ? 'linear-gradient(135deg, rgba(255, 59, 48, 0.1), rgba(255, 59, 48, 0.05))' 
                  : 'linear-gradient(135deg, var(--mondrian-white) 0%, rgba(0, 122, 255, 0.02) 100%)'
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onMouseEnter={(e) => {
                if (!dragActive) {
                  e.currentTarget.style.borderColor = 'var(--mondrian-red)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!dragActive) {
                  e.currentTarget.style.borderColor = 'var(--mondrian-blue)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
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
                    disabled={!isApiConfigured()}
                    className="apple-button flex items-center px-6 py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: !isApiConfigured() ? 'var(--apple-gray-300)' : 
                                 isProcessing ? 'var(--mondrian-white)' : 'var(--mondrian-blue)',
                      color: !isApiConfigured() ? 'white' : 
                             isProcessing ? 'var(--mondrian-black)' : 'white',
                      border: isProcessing ? '2px solid var(--apple-gray-200)' : 'none',
                      display: 'none'
                    }}
                  >
                    {isProcessing ? (
                      <Pause className="w-4 h-4 mr-2" style={{color: 'var(--mondrian-black)'}} />
                    ) : (
                      <Play className="w-4 h-4 mr-2" />
                    )}
                    {isProcessing ? '暂停处理' : isPaused ? '继续处理' : '一键处理'}
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