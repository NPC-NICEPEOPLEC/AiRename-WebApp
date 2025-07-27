import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Clock, Download, Trash2, Home, History, CheckSquare, Square, File, Image, AlertTriangle, X } from 'lucide-react';
import JSZip from 'jszip';

// 新的文件记录接口
interface FileRecord {
  id: string;
  timestamp: number;
  originalName: string;
  newName: string;
  fileExtension: string;
  batchId: string; // 用于标识同一批处理的文件
}

// 保持向后兼容的旧格式接口
interface LegacyHistoryItem {
  id: string;
  timestamp: number;
  originalFiles: string[];
  processedFiles: { originalName: string; newName: string }[];
  totalFiles: number;
}

export default function HistoryPage() {
  const [fileRecords, setFileRecords] = useState<FileRecord[]>([]);
  const [showLast24Hours, setShowLast24Hours] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deleteAction, setDeleteAction] = useState<'selected' | 'clear'>('selected');

  // 从localStorage加载历史记录并转换格式
  useEffect(() => {
    const savedHistory = localStorage.getItem('intellirename_history');
    if (savedHistory) {
      try {
        const legacyHistory: LegacyHistoryItem[] = JSON.parse(savedHistory);
        const convertedRecords: FileRecord[] = [];
        
        // 转换旧格式到新格式
        legacyHistory.forEach(item => {
          item.processedFiles.forEach(file => {
            const extension = file.originalName.split('.').pop() || '';
            convertedRecords.push({
              id: `${item.id}_${file.originalName}_${Date.now()}`,
              timestamp: item.timestamp,
              originalName: file.originalName,
              newName: file.newName,
              fileExtension: extension,
              batchId: item.id
            });
          });
        });
        
        setFileRecords(convertedRecords);
      } catch (error) {
        console.error('Failed to parse history:', error);
      }
    }
  }, []);

  // 过滤24小时内的记录
  const filteredRecords = showLast24Hours 
    ? fileRecords.filter(record => {
        const now = Date.now();
        const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
        return record.timestamp >= twentyFourHoursAgo;
      })
    : fileRecords;

  // 处理全选/取消全选
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filteredRecords.map(record => record.id)));
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
    setSelectAll(newSelected.size === filteredRecords.length);
  };

  // 更新全选状态
  useEffect(() => {
    setSelectAll(selectedFiles.size === filteredRecords.length && filteredRecords.length > 0);
  }, [selectedFiles.size, filteredRecords.length]);

  // 删除选中的文件记录
  const deleteSelectedFiles = () => {
    if (selectedFiles.size === 0) return;
    setDeleteAction('selected');
    setShowDeleteConfirm(true);
  };

  // 确认删除选中文件
  const confirmDeleteSelected = () => {
    const updatedRecords = fileRecords.filter(record => !selectedFiles.has(record.id));
    setFileRecords(updatedRecords);
    setSelectedFiles(new Set());
    updateLocalStorage(updatedRecords);
    setShowDeleteConfirm(false);
  };

  // 清空所有历史记录
  const clearAllHistory = () => {
    setDeleteAction('clear');
    setShowClearConfirm(true);
  };

  // 确认清空历史记录
  const confirmClearHistory = () => {
    if (showLast24Hours) {
      // 只删除24小时内的记录
      const now = Date.now();
      const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
      const remainingRecords = fileRecords.filter(record => record.timestamp < twentyFourHoursAgo);
      setFileRecords(remainingRecords);
      updateLocalStorage(remainingRecords);
    } else {
      // 清空所有记录
      setFileRecords([]);
      localStorage.removeItem('intellirename_history');
    }
    setSelectedFiles(new Set());
    setShowClearConfirm(false);
  };

  // 更新localStorage（转换回旧格式）
  const updateLocalStorage = (records: FileRecord[]) => {
    const batchMap = new Map<string, LegacyHistoryItem>();
    
    records.forEach(record => {
      if (!batchMap.has(record.batchId)) {
        batchMap.set(record.batchId, {
          id: record.batchId,
          timestamp: record.timestamp,
          originalFiles: [],
          processedFiles: [],
          totalFiles: 0
        });
      }
      
      const batch = batchMap.get(record.batchId)!;
      batch.originalFiles.push(record.originalName);
      batch.processedFiles.push({
        originalName: record.originalName,
        newName: record.newName
      });
      batch.totalFiles = batch.processedFiles.length;
    });
    
    const legacyHistory = Array.from(batchMap.values());
    localStorage.setItem('intellirename_history', JSON.stringify(legacyHistory));
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
    
    return `irAiRename${year}${month}${day}_${hours}${minutes}${seconds}.${extension}`;
  };

  // 下载选中的文件名映射表
  const downloadSelectedFiles = async () => {
    if (selectedFiles.size === 0) {
      alert('请先选择要下载的文件');
      return;
    }

    try {
      const selectedRecords = fileRecords.filter(record => selectedFiles.has(record.id));
      
      if (selectedRecords.length === 1) {
        // 单个文件下载为文本文件
        const record = selectedRecords[0];
        const content = `原始文件名: ${record.originalName}\n新文件名: ${record.newName}\n处理时间: ${formatTime(record.timestamp)}`;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = generateFileName('txt');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // 多个文件下载为CSV文件
        const csvHeader = '原始文件名,新文件名,处理时间\n';
        const csvContent = selectedRecords.map(record => 
          `"${record.originalName}","${record.newName}","${formatTime(record.timestamp)}"`
        ).join('\n');
        const fullCsvContent = csvHeader + csvContent;
        
        const blob = new Blob([fullCsvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = generateFileName('csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      
      // 下载成功提示
      alert(`成功下载 ${selectedRecords.length} 个文件的重命名记录！`);
      
    } catch (error) {
      console.error('下载失败:', error);
      alert('下载失败，请重试');
    }
  };

  // 获取文件图标
  const getFileIcon = (filename: string, colorClass: string = '') => {
    const extension = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(extension || '')) {
      return <Image className={`w-4 h-4 ${colorClass || 'text-blue-500'}`} />;
    }
    if (['txt', 'md', 'doc', 'docx', 'pdf'].includes(extension || '')) {
      return <FileText className={`w-4 h-4 ${colorClass || 'text-green-500'}`} />;
    }
    return <File className={`w-4 h-4 ${colorClass || 'text-gray-500'}`} />;
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 确认删除弹窗组件
  const DeleteConfirmModal = ({ show, onClose, onConfirm, type }: {
    show: boolean;
    onClose: () => void;
    onConfirm: () => void;
    type: 'selected' | 'clear';
  }) => {
    if (!show) return null;

    const getTitle = () => {
      if (type === 'selected') {
        return `删除选中的 ${selectedFiles.size} 个文件记录`;
      }
      return showLast24Hours ? '清空24小时记录' : '清空所有记录';
    };

    const getMessage = () => {
      if (type === 'selected') {
        return `您即将删除选中的 ${selectedFiles.size} 个文件记录。`;
      }
      return showLast24Hours 
        ? '您即将清空24小时内的所有历史记录。'
        : '您即将清空所有历史记录。';
    };

    return (
      <div className="fixed inset-0 flex items-center justify-center z-50" style={{background: 'rgba(0, 0, 0, 0.6)'}}>
        <div className="mondrian-card max-w-md w-full mx-4 relative" style={{
          background: 'var(--mondrian-white)',
          border: '3px solid var(--mondrian-red)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}>
          {/* 装饰性元素 */}
          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full" style={{background: 'var(--mondrian-yellow)'}}></div>
          <div className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full" style={{background: 'var(--mondrian-blue)'}}></div>
          
          <div className="p-6">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4" style={{background: 'linear-gradient(135deg, var(--mondrian-red), rgba(255, 59, 48, 0.8))'}}>
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium mb-1" style={{color: 'var(--mondrian-black)'}}>
                  {getTitle()}
                </h3>
                <div className="w-16 h-1 rounded-full" style={{background: 'var(--mondrian-red)'}}></div>
              </div>
            </div>
            
            <div className="mb-6 p-4 rounded-lg" style={{background: 'rgba(255, 59, 48, 0.05)', border: '1px solid rgba(255, 59, 48, 0.2)'}}>
               <p className="text-sm font-medium" style={{color: 'var(--apple-gray-700)'}}>
                 {getMessage()}
               </p>
             </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="apple-button px-6 py-3 text-sm font-medium rounded-lg transition-all hover:scale-105"
                style={{background: 'var(--apple-gray-100)', color: 'var(--apple-gray-600)'}}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--apple-gray-200)';
                  e.currentTarget.style.color = 'var(--apple-gray-700)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--apple-gray-100)';
                  e.currentTarget.style.color = 'var(--apple-gray-600)';
                }}
              >
                取消
              </button>
              <button
                onClick={onConfirm}
                className="apple-button px-6 py-3 text-sm font-medium text-white rounded-lg transition-all hover:scale-105"
                style={{background: 'var(--mondrian-red)'}}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--apple-red)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--mondrian-red)'}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen" style={{background: 'linear-gradient(135deg, var(--mondrian-white) 0%, rgba(0, 122, 255, 0.03) 100%)'}}>
      {/* 头部导航 */}
      <header className="mondrian-card" style={{background: 'var(--mondrian-white)', borderBottom: '3px solid var(--mondrian-blue)'}}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-24">
            <div className="flex items-center space-x-6 mondrian-accent pl-6">
              <div className="p-3 rounded-xl" style={{background: 'linear-gradient(135deg, var(--mondrian-blue), var(--mondrian-red)'}}>
                <FileText className="h-8 w-8 text-white" />
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-bold" style={{color: 'var(--mondrian-black)'}}>《AiRename - 智能重命名助手》</h1>
                <p className="text-base font-medium" style={{color: 'var(--mondrian-blue)'}}>让每个文件都有意义的名字</p>
              </div>
              <div className="ml-4 text-sm" style={{color: 'var(--mondrian-red)'}}>
                让每个文件都有意义的名字
              </div>
            </div>
            <nav className="flex items-center space-x-6">
              <Link 
                to="/" 
                className="apple-button flex items-center px-4 py-2 rounded-lg transition-all"
                style={{background: 'var(--apple-gray-100)', color: 'var(--apple-gray-600)'}}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--mondrian-yellow)';
                  e.currentTarget.style.color = 'var(--mondrian-black)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--apple-gray-100)';
                  e.currentTarget.style.color = 'var(--apple-gray-600)';
                }}
              >
                <Home className="w-4 h-4 mr-1" />
                首页
              </Link>
              <Link 
                to="/history" 
                className="apple-button flex items-center px-4 py-2 rounded-lg font-medium"
                style={{background: 'var(--mondrian-red)', color: 'white'}}
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
        <div className="mondrian-card" style={{background: 'var(--mondrian-white)'}}>
          <div className="px-6 py-4" style={{borderBottom: '2px solid var(--mondrian-blue)'}}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center mb-2">
                  <div className="w-4 h-4 mr-3" style={{background: 'var(--mondrian-red)'}}></div>
                  <h2 className="text-lg font-medium" style={{color: 'var(--mondrian-black)'}}>处理历史记录</h2>
                  <div className="flex-1 h-px ml-4" style={{background: 'linear-gradient(to right, var(--mondrian-blue), transparent)'}}></div>
                </div>
                <p className="text-sm mt-1" style={{color: 'var(--apple-gray-600)'}}>查看您之前处理过的文件记录，可选择文件进行操作</p>
              </div>
              <div className="flex items-center space-x-3">
                {selectedFiles.size > 0 && (
                  <>
                    <button
                      onClick={downloadSelectedFiles}
                      className="apple-button flex items-center px-4 py-2 text-sm rounded-lg transition-all"
                      style={{background: 'var(--mondrian-blue)', color: 'white'}}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      下载选中 ({selectedFiles.size})
                    </button>
                    <button
                      onClick={deleteSelectedFiles}
                      className="apple-button flex items-center px-4 py-2 text-sm rounded-lg transition-all"
                      style={{background: 'var(--mondrian-red)', color: 'white'}}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      删除选中
                    </button>
                  </>
                )}
                {filteredRecords.length > 0 && (
                  <button
                    onClick={clearAllHistory}
                    className="text-sm font-medium transition-all hover:scale-105"
                    style={{color: 'var(--mondrian-red)'}}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--apple-red)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--mondrian-red)'}
                  >
                    {showLast24Hours ? '清空24小时记录' : '清空所有记录'}
                  </button>
                )}
              </div>
            </div>
            
            {/* 过滤选项和全选 */}
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowLast24Hours(true)}
                  className="apple-button px-4 py-2 text-sm rounded-lg transition-all"
                  style={{
                    background: showLast24Hours ? 'var(--mondrian-blue)' : 'var(--apple-gray-100)',
                    color: showLast24Hours ? 'white' : 'var(--apple-gray-600)'
                  }}
                >
                  最近24小时
                </button>
                <button
                  onClick={() => setShowLast24Hours(false)}
                  className="apple-button px-4 py-2 text-sm rounded-lg transition-all"
                  style={{
                    background: !showLast24Hours ? 'var(--mondrian-blue)' : 'var(--apple-gray-100)',
                    color: !showLast24Hours ? 'white' : 'var(--apple-gray-600)'
                  }}
                >
                  全部记录
                </button>
                <div className="w-px h-6" style={{background: 'var(--mondrian-blue)'}}></div>
                <span className="text-sm font-medium" style={{color: 'var(--apple-gray-600)'}}>
                  共 {filteredRecords.length} 条记录
                </span>
              </div>
              
              {filteredRecords.length > 0 && (
                <button
                  onClick={handleSelectAll}
                  className="flex items-center text-sm transition-all hover:scale-105"
                  style={{color: 'var(--mondrian-blue)'}}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--mondrian-red)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--mondrian-blue)'}
                >
                  {selectAll ? (
                    <CheckSquare className="w-4 h-4 mr-1" />
                  ) : (
                    <Square className="w-4 h-4 mr-1" />
                  )}
                  {selectAll ? '取消全选' : '全选'}
                </button>
              )}
            </div>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="relative mb-6">
                <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center" style={{background: 'linear-gradient(135deg, var(--mondrian-blue), var(--apple-blue)'}}>
                  <Clock className="h-10 w-10 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full" style={{background: 'var(--mondrian-red)'}}></div>
                <div className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full" style={{background: 'var(--mondrian-yellow)'}}></div>
              </div>
              <h3 className="text-lg font-medium mb-2" style={{color: 'var(--mondrian-black)'}}>
                {showLast24Hours ? '24小时内暂无历史记录' : '暂无历史记录'}
              </h3>
              <p className="mb-6" style={{color: 'var(--apple-gray-600)'}}>
                {showLast24Hours 
                  ? '您在过去24小时内还没有处理过任何文件' 
                  : '您还没有处理过任何文件'
                }
              </p>
              <Link
                to="/"
                className="apple-button inline-flex items-center px-6 py-3 text-sm font-medium rounded-lg transition-all"
                style={{background: 'var(--mondrian-blue)', color: 'white'}}
              >
                开始上传文件
              </Link>
            </div>
          ) : (
            <div className="space-y-2 p-4">
              {filteredRecords.map((record) => (
                <div key={record.id} className="mondrian-card p-4 transition-all hover:scale-[1.01]" style={{
                  background: selectedFiles.has(record.id) ? 'linear-gradient(135deg, rgba(255, 59, 48, 0.1), rgba(255, 59, 48, 0.05))' : 'var(--mondrian-white)',
                  border: selectedFiles.has(record.id) ? '2px solid var(--mondrian-red)' : '1px solid var(--apple-gray-200)'
                }}>
                  <div className="flex items-center space-x-4">
                    {/* 复选框 */}
                    <button
                      onClick={() => handleFileSelect(record.id)}
                      className="flex-shrink-0 p-2 rounded-lg transition-all hover:scale-110"
                      style={{background: selectedFiles.has(record.id) ? 'var(--mondrian-red)' : 'var(--apple-gray-100)'}}
                    >
                      {selectedFiles.has(record.id) ? (
                        <CheckSquare className="w-4 h-4 text-white" />
                      ) : (
                        <Square className="w-4 h-4" style={{color: 'var(--apple-gray-400)'}} />
                      )}
                    </button>
                    
                    {/* 文件图标 */}
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{background: 'linear-gradient(135deg, var(--mondrian-blue), var(--apple-blue)'}}>
                      {getFileIcon(record.originalName, 'text-white')}
                    </div>
                    
                    {/* 文件信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{background: 'var(--mondrian-yellow)'}}>
                          <Clock className="w-3 h-3" style={{color: 'var(--mondrian-black)'}} />
                        </div>
                        <span className="text-xs font-medium" style={{color: 'var(--apple-gray-600)'}}>
                          {formatTime(record.timestamp)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <div className="flex items-center mb-1">
                            <div className="w-2 h-2 rounded-full mr-2" style={{background: 'var(--mondrian-blue)'}}></div>
                            <p className="text-xs font-medium" style={{color: 'var(--apple-gray-600)'}}>原文件名</p>
                          </div>
                          <p className="text-sm font-medium truncate" title={record.originalName} style={{color: 'var(--mondrian-black)'}}>
                            {record.originalName}
                          </p>
                        </div>
                        <div>
                          <div className="flex items-center mb-1">
                            <div className="w-2 h-2 rounded-full mr-2" style={{background: 'var(--mondrian-red)'}}></div>
                            <p className="text-xs font-medium" style={{color: 'var(--apple-gray-600)'}}>新文件名</p>
                          </div>
                          <p className="text-sm font-medium truncate" title={record.newName} style={{color: 'var(--mondrian-red)'}}>
                            {record.newName}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* 文件扩展名标签 */}
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium" style={{
                        background: 'var(--mondrian-yellow)',
                        color: 'var(--mondrian-black)'
                      }}>
                        .{record.fileExtension}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 删除确认弹窗 */}
      <DeleteConfirmModal
        show={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDeleteSelected}
        type="selected"
      />
      
      <DeleteConfirmModal
        show={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={confirmClearHistory}
        type="clear"
      />
    </div>
  );
}