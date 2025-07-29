# AiRename Vercel 部署指南

## 项目概述
AiRename 是一个智能文档重命名 Web 应用，使用 React + Vite 前端和 FastAPI 后端，支持一键部署到 Vercel。

## 部署前检查清单

### ✅ 已完成的配置
- [x] 统一应用名称为 "AiRename"
- [x] 配置 `vercel.json` 文件
- [x] 创建 `.env.production` 文件
- [x] 配置 CORS 支持 Vercel 域名
- [x] 后端依赖文件 `backend/requirements.txt`
- [x] 前端构建配置正确
- [x] TypeScript 类型检查通过
- [x] 项目构建成功

## 部署步骤

### 1. 推送代码到 GitHub
```bash
git add .
git commit -m "准备 Vercel 部署"
git push origin main
```

### 2. 在 Vercel 控制台部署
1. 访问 [vercel.com](https://vercel.com)
2. 登录并点击 "New Project"
3. 导入您的 GitHub 仓库
4. Vercel 会自动检测到 `vercel.json` 配置

### 3. 配置环境变量
在 Vercel 项目设置中添加以下环境变量：

#### 必需的环境变量
```
DEEPSEEK_API_KEY=your_deepseek_api_key_here
VITE_DEEPSEEK_API_KEY=your_deepseek_api_key_here
VITE_DEEPSEEK_API_BASE_URL=https://api.deepseek.com
VITE_APP_NAME=AiRename
VITE_MAX_FILE_SIZE=209715200
VITE_MAX_FILES_COUNT=10
```

#### 获取 DeepSeek API 密钥
1. **官方平台**（需要充值）：https://platform.deepseek.com/api_keys
2. **第三方平台**（推荐）：
   - 硅基流动：https://api.siliconflow.cn （价格更便宜）
   - 百度千帆：https://qianfan.baidubce.com （价格最便宜）

### 4. 部署完成
- Vercel 会自动构建和部署您的应用
- 前端将部署为静态站点
- 后端将部署为 Serverless 函数
- API 路由会自动映射到 `/api/*`

## 项目架构

### 前端 (React + Vite)
- 构建输出：`dist/` 目录
- 环境变量：使用 `VITE_` 前缀
- API 调用：通过 `/api` 路径访问后端

### 后端 (FastAPI)
- 入口文件：`backend/main.py`
- 运行时：Python 3.9+
- 函数超时：30 秒
- 文件上传限制：200MB

## 重要注意事项

### 1. API 密钥安全
- 永远不要在代码中硬编码 API 密钥
- 使用 Vercel 环境变量管理敏感信息
- 前端和后端都需要配置 DeepSeek API 密钥

### 2. CORS 配置
- 后端已配置支持所有 Vercel 子域名
- 支持 `https://*.vercel.app` 域名模式

### 3. 文件上传限制
- Vercel Serverless 函数有 50MB 请求体限制
- 应用配置的 200MB 限制在本地开发时有效
- 生产环境建议使用文件分块上传或外部存储

### 4. 函数执行时间
- 免费计划：10 秒超时
- Pro 计划：60 秒超时
- 当前配置：30 秒超时

## 故障排除

### 常见问题
1. **API 调用失败**：检查环境变量是否正确设置
2. **CORS 错误**：确认域名在 CORS 配置中
3. **构建失败**：检查依赖版本兼容性
4. **函数超时**：优化 AI 模型调用或增加超时时间

### 调试方法
1. 查看 Vercel 函数日志
2. 使用浏览器开发者工具检查网络请求
3. 检查环境变量是否正确传递

## 本地开发

### 启动开发环境
```bash
# 前端
npm run dev

# 后端
cd backend
source venv/bin/activate
python main.py
```

### 环境变量
- 开发环境：使用 `.env` 文件
- 生产环境：使用 `.env.production` 文件
- Vercel 部署：使用 Vercel 控制台环境变量

## 更新部署

每次代码更新后，只需推送到 GitHub，Vercel 会自动重新部署：
```bash
git add .
git commit -m "更新功能"
git push origin main
```

---

🎉 **部署完成后，您的 AiRename 应用就可以在 Vercel 提供的域名上访问了！**