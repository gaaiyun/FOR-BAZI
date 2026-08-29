# FOR-BAZI 部署指南

> 开发、测试、生产环境部署详细步骤

---

## 目录

- [环境要求](#环境要求)
- [开发环境](#开发环境)
- [生产部署](#生产部署)
- [桌面应用构建](#桌面应用构建)
- [环境变量](#环境变量)
- [故障排除](#故障排除)

---

## 环境要求

### 必需

| 依赖 | 最低版本 | 推荐版本 | 用途 |
|------|---------|---------|------|
| Python | 3.10 | 3.12 | 后端 + 引擎 |
| Node.js | 18 | 20 LTS | 前端构建 |
| npm | 9 | 10 | 包管理 |

### 可选

| 依赖 | 最低版本 | 用途 |
|------|---------|------|
| Rust | 1.70 | Tauri 桌面应用 |
| Docker | 24.0 | 容器化部署 |

---

## 开发环境

### 1. 克隆项目

```bash
git clone https://github.com/YOUR_USERNAME/FOR-BAZI.git
cd FOR-BAZI
```

### 2. 后端设置

```bash
# 创建虚拟环境
python -m venv .venv

# 激活虚拟环境
# Windows (PowerShell)
.venv\Scripts\Activate.ps1
# Windows (CMD)
.venv\Scripts\activate.bat
# macOS/Linux
source .venv/bin/activate

# 安装依赖
pip install -r backend/requirements.txt

# 配置环境变量
cp .env.example .env  # 如果有模板
# 或手动创建 .env 文件（见环境变量章节）
```

### 3. 启动后端

```bash
# 方式一：uvicorn 直接启动
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# 方式二：Python 模块启动
python -m backend.main

# 方式三：使用 launcher.py
python launcher.py
```

验证后端启动：

```bash
curl http://localhost:8000/health
# 应返回: {"status": "ok"}
```

### 4. 前端设置

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端启动后访问 http://localhost:5173

### 5. 验证完整流程

1. 打开 http://localhost:5173
2. 输入出生信息：男，1985-06-15 09:20
3. 点击"生成命盘"
4. 验证命盘数据正确显示
5. 导航到各页面验证数据渲染

---

## 生产部署

### 方式一：传统部署

#### 后端

```bash
# 安装生产依赖
pip install -r backend/requirements.txt
pip install gunicorn

# 使用 gunicorn 启动（Linux/macOS）
gunicorn backend.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 120

# Windows 使用 uvicorn
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 4
```

#### 前端

```bash
cd frontend

# 生产构建
npm run build

# 产出物在 frontend/dist/ 目录
# 使用 Nginx 或其他 Web 服务器托管静态文件
```

#### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/FOR-BAZI/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE 支持
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }

    # 健康检查代理
    location /health {
        proxy_pass http://127.0.0.1:8000;
    }
}
```

### 方式二：Docker 部署

#### Dockerfile（后端）

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### Dockerfile（前端）

```dockerfile
FROM node:20-alpine AS build

WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

#### docker-compose.yml

```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "8000:8000"
    environment:
      - BAZI_DEBUG=false
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    restart: unless-stopped

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped
```

启动：

```bash
docker-compose up -d
```

### 方式三：云平台部署

#### Vercel（前端）

```bash
cd frontend
npx vercel
```

#### Railway / Fly.io（后端）

```bash
# Railway
railway login
railway init
railway up

# Fly.io
fly auth login
fly launch
fly deploy
```

---

## 桌面应用构建

### 安装 Rust

```bash
# Windows
winget install Rustlang.Rustup

# macOS
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Linux
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 安装 Tauri CLI

```bash
npm install -g @tauri-apps/cli
```

### 构建步骤

```bash
cd frontend

# 开发模式（带 DevTools）
npx tauri dev

# 生产构建
npx tauri build
```

### 产出物

| 平台 | 产出物 | 路径 |
|------|--------|------|
| Windows | `.exe` + `.msi` | `src-tauri/target/release/bundle/` |
| macOS | `.dmg` + `.app` | `src-tauri/target/release/bundle/` |
| Linux | `.deb` + `.AppImage` | `src-tauri/target/release/bundle/` |

### 构建配置

编辑 `frontend/src-tauri/tauri.conf.json`：

```json
{
  "productName": "FOR-BAZI",
  "version": "2.0.0",
  "identifier": "com.for-bazi.app",
  "build": {
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "app": {
    "title": "FOR-BAZI · 玄冥 Cyber-Bazi",
    "windows": [
      {
        "width": 1280,
        "height": 800,
        "resizable": true,
        "fullscreen": false
      }
    ]
  }
}
```

---

## 环境变量

### .env 文件模板

所有变量都带 `BAZI_` 前缀（见 `backend/config.py` 的 `env_prefix`）。

```env
# ── Cloudflare Workers AI（默认 AI 服务商）───────────────────────
BAZI_CF_ACCOUNT_ID=your-cloudflare-account-id
BAZI_CF_API_TOKEN=your-cloudflare-api-token
BAZI_CF_MODEL=@cf/zai-org/glm-4.7-flash

# ── 其他 AI 服务商（可选，用户也可在「设置」页自行填写）─────────
BAZI_OPENAI_API_KEY=sk-your-key-here
BAZI_OPENAI_BASE_URL=https://api.minimaxi.com/v1
BAZI_OPENAI_MODEL=MiniMax-M2.7

BAZI_ANTHROPIC_API_KEY=your-glm-api-key-here
BAZI_ANTHROPIC_BASE_URL=https://open.bigmodel.cn/api/anthropic

# ── 后端配置 ──────────────────────────────────────────────────────
BAZI_DEBUG=false
BAZI_HOST=0.0.0.0
BAZI_PORT=8000

# ── CORS 配置（逗号分隔）─────────────────────────────────────────
# BAZI_CORS_ORIGINS=http://localhost:5173,https://your-domain.com
```

### 环境变量说明

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `BAZI_CF_ACCOUNT_ID` | - | Cloudflare 账户 ID（默认服务商必填） |
| `BAZI_CF_API_TOKEN` | - | Cloudflare API Token，需含 Workers AI 读权限 |
| `BAZI_CF_MODEL` | `@cf/zai-org/glm-4.7-flash` | Workers AI 模型，**必须支持 function calling** |
| `BAZI_OPENAI_API_KEY` | - | OpenAI 兼容服务商的 Key |
| `BAZI_OPENAI_BASE_URL` | `https://api.minimaxi.com/v1` | OpenAI 兼容 API 地址 |
| `BAZI_ANTHROPIC_API_KEY` | - | Anthropic 兼容服务商的 Key |
| `BAZI_ANTHROPIC_BASE_URL` | `https://api.minimaxi.com/anthropic` | Anthropic 兼容地址（**不要带 `/v1`**，SDK 会自己拼 `/v1/messages`） |
| `BAZI_DEBUG` | `false` | 调试模式（开启后日志更详细） |
| `BAZI_HOST` | `0.0.0.0` | 后端监听地址 |
| `BAZI_PORT` | `8000` | 后端监听端口 |
| `BAZI_CORS_ORIGINS` | `["http://localhost:5173"]` | CORS 允许源 |

### Cloudflare Workers AI 配置

默认服务商走 Workers AI 的 OpenAI 兼容端点，凭据存在服务端 `.env`，用户无需在浏览器里填 Key。

1. **取 Account ID**：Cloudflare 控制台右侧栏，或 `npx wrangler whoami`
2. **建 API Token**：控制台 → My Profile → API Tokens → Create Token，
   权限至少包含 `Account → Workers AI → Read`
3. 填入 `.env` 后重启后端

端点会拼成 `https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai/v1`，
由 OpenAI SDK 以 `Authorization: Bearer <token>` 调用。

> **模型必须支持 function calling。** ReAct 循环每轮都会传工具 schema，
> 不支持工具调用的模型会静默忽略它们，导致排盘工具从不被调用。
> 免费额度内可用且支持工具调用的：`@cf/zai-org/glm-4.7-flash`（中文原生，131K 上下文）、
> `@cf/qwen/qwen3-30b-a3b-fp8`、`@cf/meta/llama-3.3-70b-instruct-fp8-fast`。
> DeepSeek V4 与 GLM-5.3 Flash 需要 Workers 付费计划。

未配置时不会 500——后端会通过 SSE 返回一条说明该填哪个变量的错误。

---

## 故障排除

### 后端启动失败

**问题**: `ModuleNotFoundError: No module named 'backend'`

```bash
# 确保在项目根目录运行
cd /path/to/FOR-BAZI
python -m uvicorn backend.main:app --reload
```

**问题**: `lunar-python` 安装失败

```bash
# 升级 pip
python -m pip install --upgrade pip
pip install lunar-python
```

**问题**: 端口被占用

```bash
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :8000
kill -9 <PID>
```

### 前端启动失败

**问题**: `npm install` 报错

```bash
# 清除缓存
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**问题**: TypeScript 编译错误

```bash
# 检查类型错误
npx tsc --noEmit

# 常见修复：确保所有依赖已安装
npm install
```

### API 调用失败

**问题**: 前端调用后端返回 404

检查 Vite 代理配置 (`vite.config.ts`)：

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
    '/health': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
},
```

**问题**: SSE 流式连接断开

- 检查网络代理是否缓冲响应
- Nginx 配置中添加 `proxy_buffering off`
- 增加 `proxy_read_timeout`

### 桌面应用构建失败

**问题**: Rust 编译错误

```bash
# 更新 Rust
rustup update

# 清除构建缓存
cd frontend/src-tauri
cargo clean
```

**问题**: WebView2 未安装（Windows 7/8）

Windows 10/11 自带 WebView2。旧系统需手动安装：
https://developer.microsoft.com/en-us/microsoft-edge/webview2/

---

## 性能优化

### 后端

- **缓存**: 命盘计算结果缓存256条，相同参数直接返回
- **异步**: FastAPI 异步处理，支持高并发
- **Workers**: 生产环境使用多 worker

### 前端

- **代码分割**: 所有页面 lazy-loaded
- **Tree shaking**: Vite 自动移除未使用代码
- **图片优化**: 使用 SVG 图标，无大图
- **缓存**: Zustand persist 到 localStorage

### 桌面应用

- **包体积**: Tauri 使用系统 WebView，仅 3-10MB
- **启动速度**: WebView2 预加载，启动 < 1秒
- **内存占用**: 约 50-100MB
