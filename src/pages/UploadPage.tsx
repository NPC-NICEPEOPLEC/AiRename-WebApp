import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FileText, Upload, Home, History } from 'lucide-react';

interface FileItem {
  id: string;
  file: File;
  originalName: string;
}

export default function UploadPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // 支持的文件类型
  const supportedTypes = [
    '.txt', '.md', '.doc', '.docx', '.xls', '.xlsx', 
    '.py', '.pdf', '.ppt', '.pptx', '.png', '.jpg', '.jpeg', '.gif'
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

  // 处理文件选择
  const handleFiles = (fileList: FileList) => {
    const newFiles: FileItem[] = [];
    const errors: string[] = [];

    Array.from(fileList).forEach((file) => {
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
        originalName: file.name
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
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  // 删除文件
  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  // 继续处理
  const handleContinue = () => {
    if (files.length === 0) {
      alert('请先上传文件');
      return;
    }
    
    // 将文件数据传递到处理页面
    navigate('/process', { state: { files } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      {/* 头部导航 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <FileText className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">IntelliRename</h1>
            </div>
            <nav className="flex items-center space-x-6">
              <Link 
                to="/" 
                className="flex items-center text-blue-600 font-medium"
              >
                <Home className="w-4 h-4 mr-1" />
                首页
              </Link>
              <Link 
                to="/history" 
                className="flex items-center text-gray-600 hover:text-blue-600 transition-colors"
              >
                <History className="w-4 h-4 mr-1" />
                历史记录
              </Link>
            </nav>
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
          </div>
        </div>

        {/* 已上传文件列表 */}
        {files.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">
                已上传文件 ({files.length} 个文件)
              </h2>
            </div>
            
            <div className="divide-y divide-gray-200">
              {files.map((file) => (
                <div key={file.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <span className="text-sm font-medium text-gray-900">{file.originalName}</span>
                      <div className="text-xs text-gray-500">
                        {(file.file.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(file.id)}
                    className="text-red-600 hover:text-red-900 text-sm"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
            
            <div className="px-6 py-4 bg-gray-50 flex justify-end">
              <button
                onClick={handleContinue}
                className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                继续处理
              </button>
            </div>
          </div>
        )}

        {/* 使用说明 */}
        {files.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">使用说明</h2>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">1</span>
                <span>拖拽或选择您要重命名的文档文件（支持多种格式）</span>
              </div>
              <div className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">2</span>
                <span>确认文件列表后，点击"继续处理"进入下一步</span>
              </div>
              <div className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">3</span>
                <span>AI 将逐一分析文档内容并生成智能文件名建议</span>
              </div>
              <div className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">4</span>
                <span>您可以编辑调整建议的文件名，最后下载重命名文件包</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}