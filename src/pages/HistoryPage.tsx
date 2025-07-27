import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Clock, Download, Trash2, Home, History, CheckSquare, Square, File, Image } from 'lucide-react';
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
    
    const confirmMessage = `确定要删除选中的 ${selectedFiles.size} 个文件记录吗？此操作不可撤销。`;
    
    if (window.confirm(confirmMessage)) {
      const updatedRecords = fileRecords.filter(record => !selectedFiles.has(record.id));
      setFileRecords(updatedRecords);
      setSelectedFiles(new Set());
      
      // 重新构建旧格式数据保存到localStorage
      updateLocalStorage(updatedRecords);
    }
  };

  // 清空所有历史记录
  const clearAllHistory = () => {
    const confirmMessage = showLast24Hours 
      ? '确定要清空24小时内的所有历史记录吗？此操作不可撤销。'
      : '确定要清空所有历史记录吗？此操作不可撤销。';
    
    if (window.confirm(confirmMessage)) {
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
    }
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
    
    return `ir智能命名更新${year}${month}${day}_${hours}${minutes}${seconds}.${extension}`;
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
  const getFileIcon = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(extension || '')) {
      return <Image className="w-4 h-4 text-blue-500" />;
    }
    if (['txt', 'md', 'doc', 'docx', 'pdf'].includes(extension || '')) {
      return <FileText className="w-4 h-4 text-green-500" />;
    }
    return <File className="w-4 h-4 text-gray-500" />;
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
                className="flex items-center text-gray-600 hover:text-blue-600 transition-colors"
              >
                <Home className="w-4 h-4 mr-1" />
                首页
              </Link>
              <Link 
                to="/history" 
                className="flex items-center text-blue-600 font-medium"
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
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-medium text-gray-900">处理历史记录</h2>
                <p className="text-sm text-gray-500 mt-1">查看您之前处理过的文件记录，可选择文件进行操作</p>
              </div>
              <div className="flex items-center space-x-3">
                {selectedFiles.size > 0 && (
                  <>
                    <button
                      onClick={downloadSelectedFiles}
                      className="flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      下载选中 ({selectedFiles.size})
                    </button>
                    <button
                      onClick={deleteSelectedFiles}
                      className="flex items-center px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      删除选中
                    </button>
                  </>
                )}
                {filteredRecords.length > 0 && (
                  <button
                    onClick={clearAllHistory}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
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
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    showLast24Hours 
                      ? 'bg-blue-100 text-blue-700 font-medium' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  最近24小时
                </button>
                <button
                  onClick={() => setShowLast24Hours(false)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    !showLast24Hours 
                      ? 'bg-blue-100 text-blue-700 font-medium' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  全部记录
                </button>
                <span className="text-sm text-gray-500">
                  共 {filteredRecords.length} 条记录
                </span>
              </div>
              
              {filteredRecords.length > 0 && (
                <button
                  onClick={handleSelectAll}
                  className="flex items-center text-sm text-blue-600 hover:text-blue-700 transition-colors"
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
              <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {showLast24Hours ? '24小时内暂无历史记录' : '暂无历史记录'}
              </h3>
              <p className="text-gray-500 mb-6">
                {showLast24Hours 
                  ? '您在过去24小时内还没有处理过任何文件' 
                  : '您还没有处理过任何文件'
                }
              </p>
              <Link
                to="/"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                开始上传文件
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredRecords.map((record) => (
                <div key={record.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-4">
                    {/* 复选框 */}
                    <button
                      onClick={() => handleFileSelect(record.id)}
                      className="flex-shrink-0 text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      {selectedFiles.has(record.id) ? (
                        <CheckSquare className="w-5 h-5" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                    
                    {/* 文件图标 */}
                    <div className="flex-shrink-0">
                      {getFileIcon(record.originalName)}
                    </div>
                    
                    {/* 文件信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {formatTime(record.timestamp)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">原文件名</p>
                          <p className="text-sm text-gray-900 truncate" title={record.originalName}>
                            {record.originalName}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">新文件名</p>
                          <p className="text-sm font-medium text-gray-900 truncate" title={record.newName}>
                            {record.newName}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* 文件扩展名标签 */}
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
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
    </div>
  );
}