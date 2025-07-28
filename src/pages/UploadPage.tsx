import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FileText, Upload, Home, History, Trash2, Play } from 'lucide-react';

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
    
    // 跳转到处理页面，传递文件数据和自动处理标志
    navigate('/process', {
      state: {
        files: files.map(f => ({
          id: f.id,
          file: f.file,
          originalName: f.originalName
        })),
        autoProcess: true // 添加自动处理标志
      }
    });
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
                className="apple-button flex items-center font-medium transition-all duration-200"
                style={{ color: 'var(--mondrian-blue)', borderColor: 'var(--mondrian-blue)' }}
              >
                <Home className="w-5 h-5 mr-2" />
                首页
              </Link>
              <Link 
                to="/history" 
                className="apple-button flex items-center font-medium transition-all duration-200 hover:bg-gray-50"
                style={{ color: 'var(--mondrian-black)' }}
              >
                <History className="w-5 h-5 mr-2" />
                历史记录
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* 主要内容 */}
      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        {/* 文件上传区域 - 蒙德里安风格 */}
        <div className="mb-12">
          <div
            className={`mondrian-card relative border-3 border-dashed p-12 text-center transition-all duration-300 ${
              dragActive 
                ? 'border-blue-500 shadow-lg transform scale-105' 
                : 'border-gray-300 hover:border-blue-400 hover:shadow-md'
            }`}
            style={{
              background: dragActive 
                ? 'linear-gradient(135deg, rgba(49, 130, 206, 0.05), rgba(214, 158, 46, 0.05))'
                : 'var(--mondrian-white)'
            }}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="mb-6">
              <div className="inline-flex p-4 rounded-2xl mb-4" style={{ background: 'linear-gradient(135deg, var(--mondrian-blue), var(--mondrian-yellow))' }}>
                <Upload className="h-16 w-16 text-white" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--mondrian-black)' }}>
              拖拽文件到此处或点击选择
            </h3>
            <p className="text-lg mb-6" style={{ color: 'var(--mondrian-blue)' }}>
              智能分析文件内容，生成有意义的文件名
            </p>
            <div className="bg-gray-50 rounded-xl p-6 mb-6 border-l-4" style={{ borderLeftColor: 'var(--mondrian-red)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--mondrian-black)' }}>
                支持格式：文档(.txt, .md, .doc, .docx, .pdf等)、表格(.xls, .xlsx, .csv等)、图片(.png, .jpg, .gif等)、代码(.py, .js, .java等)、音视频(.mp3, .mp4等)及60+种常见格式
              </p>
              <p className="text-sm mt-2" style={{ color: 'var(--mondrian-blue)' }}>
                单个文件最大 200MB，最多同时处理 10 个文件
              </p>
            </div>
            <input
              type="file"
              multiple
              accept=".txt,.md,.doc,.docx,.xls,.xlsx,.py,.pdf,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.rtf,.csv,.json,.xml,.html,.css,.js,.java,.cpp,.php,.go,.mp3,.mp4,.zip,.rar"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isUploading}
            />
          </div>
        </div>

        {/* 已上传文件列表 */}
        {files.length > 0 && (
          <div className="mondrian-card mb-12">
            <div className="px-8 py-6 border-b-2" style={{ borderBottomColor: 'var(--mondrian-border)' }}>
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 rounded-full" style={{ background: 'var(--mondrian-red)' }}></div>
                <div className="w-3 h-3 rounded-full" style={{ background: 'var(--mondrian-blue)' }}></div>
                <div className="w-3 h-3 rounded-full" style={{ background: 'var(--mondrian-yellow)' }}></div>
                <h2 className="text-xl font-bold ml-4" style={{ color: 'var(--mondrian-black)' }}>
                  已上传文件 ({files.length} 个文件)
                </h2>
              </div>
            </div>
            
            <div className="divide-y-2" style={{ borderColor: 'var(--mondrian-border)' }}>
              {files.map((file) => (
                <div key={file.id} className="px-8 py-6 flex items-center justify-between hover:bg-gray-50 transition-colors duration-200">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 rounded-lg" style={{ background: 'linear-gradient(135deg, var(--mondrian-blue), var(--mondrian-yellow))' }}>
                      <FileText className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <span className="text-lg font-medium" style={{ color: 'var(--mondrian-black)' }}>{file.originalName}</span>
                      <div className="text-sm mt-1" style={{ color: 'var(--mondrian-blue)' }}>
                        {(file.file.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(file.id)}
                    className="apple-button text-sm font-medium transition-all duration-200 hover:transform hover:scale-105"
                    style={{ color: 'var(--mondrian-red)', borderColor: 'var(--mondrian-red)' }}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    删除
                  </button>
                </div>
              ))}
            </div>
            
            <div className="px-8 py-6 bg-gray-50 flex justify-end border-t-2" style={{ borderTopColor: 'var(--mondrian-border)' }}>
              <button
                onClick={handleContinue}
                className="inline-flex items-center px-8 py-4 text-lg font-bold rounded-xl text-white transition-all duration-200 hover:transform hover:scale-105 hover:shadow-lg"
                style={{ background: 'linear-gradient(135deg, var(--mondrian-blue), var(--mondrian-red))' }}
              >
                <Play className="w-6 h-6 mr-2" />
                继续处理
              </button>
            </div>
          </div>
        )}

        {/* 使用说明 - 蒙德里安风格 */}
        {files.length === 0 && (
          <div className="mondrian-card">
            <div className="px-8 py-6 border-b-2" style={{ borderBottomColor: 'var(--mondrian-border)' }}>
              <h2 className="text-xl font-bold" style={{ color: 'var(--mondrian-black)' }}>使用说明</h2>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: 'var(--mondrian-red)' }}>1</div>
                  <div>
                    <h3 className="font-semibold mb-2" style={{ color: 'var(--mondrian-black)' }}>选择文件</h3>
                    <p className="text-sm" style={{ color: 'var(--mondrian-blue)' }}>拖拽或选择您要重命名的文档文件（支持多种格式）</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: 'var(--mondrian-blue)' }}>2</div>
                  <div>
                    <h3 className="font-semibold mb-2" style={{ color: 'var(--mondrian-black)' }}>确认处理</h3>
                    <p className="text-sm" style={{ color: 'var(--mondrian-blue)' }}>确认文件列表后，点击"继续处理"进入下一步</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: 'var(--mondrian-yellow)' }}>3</div>
                  <div>
                    <h3 className="font-semibold mb-2" style={{ color: 'var(--mondrian-black)' }}>AI 分析</h3>
                    <p className="text-sm" style={{ color: 'var(--mondrian-blue)' }}>AI 将逐一分析文档内容并生成智能文件名建议</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: 'var(--mondrian-black)' }}>4</div>
                  <div>
                    <h3 className="font-semibold mb-2" style={{ color: 'var(--mondrian-black)' }}>下载结果</h3>
                    <p className="text-sm" style={{ color: 'var(--mondrian-blue)' }}>您可以编辑调整建议的文件名，最后下载重命名文件包</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}