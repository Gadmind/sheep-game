# 🚀 本地服务器启动指南

## 快速开始

选择以下任一方式启动本地服务器：

---

## 🎯 方法1：一键启动（推荐）

### Windows系统
双击运行 `start.bat` 文件

**功能：**
- ✅ 自动检测Python或Node.js
- ✅ 自动选择合适的服务器
- ✅ 自动打开浏览器
- ✅ 无需手动输入命令

---

## 🐍 方法2：Python服务器

### 前提条件
- 安装Python 3.x

### 启动步骤

#### Windows:
```bash
# 方式1：使用提供的脚本
python server.py

# 方式2：使用Python内置模块
python -m http.server 8000
```

#### Mac/Linux:
```bash
# 方式1：使用提供的脚本
python3 server.py

# 方式2：使用Python内置模块
python3 -m http.server 8000
```

### 访问地址
```
http://localhost:8000
```

### 功能特点
- ✅ 无需安装额外依赖
- ✅ 自动打开浏览器
- ✅ 支持热重载（刷新即可）
- ✅ 显示访问日志

---

## 📦 方法3：Node.js服务器

### 前提条件
- 安装Node.js

### 启动步骤

```bash
# 使用提供的脚本
node server.js
```

### 访问地址
```
http://localhost:8000
```

### 功能特点
- ✅ 性能优秀
- ✅ 自动打开浏览器
- ✅ MIME类型完整
- ✅ 错误处理完善

---

## 🌐 方法4：使用npx（无需安装）

### 前提条件
- 安装Node.js（npx随Node.js一起安装）

### 启动步骤

```bash
# 方式1：http-server
npx http-server -p 8000 -o

# 方式2：serve
npx serve -p 8000

# 方式3：live-server（支持自动刷新）
npx live-server --port=8000
```

### 功能对比

| 工具 | 自动刷新 | 端口 | 推荐度 |
|------|---------|------|--------|
| http-server | ❌ | 8000 | ⭐⭐⭐ |
| serve | ❌ | 8000 | ⭐⭐⭐ |
| live-server | ✅ | 8000 | ⭐⭐⭐⭐⭐ |

**推荐使用 live-server**（支持自动刷新，开发更方便）

---

## 🖥️ 方法5：VS Code Live Server

### 前提条件
- 使用VS Code编辑器
- 安装Live Server扩展

### 启动步骤
1. 在VS Code中打开项目文件夹
2. 右键点击 `index.html`
3. 选择 "Open with Live Server"
4. 自动在浏览器中打开

### 功能特点
- ✅ 自动刷新（修改代码后自动更新）
- ✅ 端口可配置
- ✅ 集成在编辑器中
- ✅ 开发体验极佳

---

## 🔥 方法6：直接打开（最简单）

### 适用场景
- 快速查看效果
- 不需要服务器功能
- 临时测试

### 步骤
```bash
# Windows
start index.html

# Mac
open index.html

# Linux
xdg-open index.html

# 或直接双击 index.html 文件
```

### 注意事项
⚠️ 某些功能可能受限（如localStorage在某些浏览器中）
⚠️ 推荐使用本地服务器方式

---

## ⚙️ 端口配置

### 修改默认端口（8000）

#### Python服务器
```python
# 编辑 server.py
PORT = 8080  # 改为8080或其他端口
```

#### Node.js服务器
```javascript
// 编辑 server.js
const PORT = 8080;  // 改为8080或其他端口
```

#### 命令行参数
```bash
# Python
python -m http.server 8080

# npx
npx http-server -p 8080
```

---

## 🔍 常见问题

### Q1: 端口被占用怎么办？

**Windows查看端口占用：**
```bash
netstat -ano | findstr :8000
```

**关闭占用端口的进程：**
```bash
taskkill /PID <进程ID> /F
```

**或者使用其他端口：**
```bash
python -m http.server 8080
```

### Q2: 无法自动打开浏览器？

手动在浏览器中输入地址：
```
http://localhost:8000
```

### Q3: 修改代码后不生效？

**方法1：强制刷新**
```
Ctrl + F5 （Windows/Linux）
Cmd + Shift + R （Mac）
```

**方法2：清除缓存**
- 打开开发者工具（F12）
- 右键点击刷新按钮
- 选择"清空缓存并硬性重新加载"

### Q4: 显示 "Cannot GET /"？

检查是否在正确的目录：
```bash
# 确保在项目根目录
cd c:\Users\29292\Desktop\sheep-game
python server.py
```

---

## 📱 移动设备访问

### 局域网访问

1. **查看本机IP地址**

**Windows:**
```bash
ipconfig
# 查找 IPv4 地址，如：192.168.1.100
```

**Mac/Linux:**
```bash
ifconfig
# 或
ip addr show
```

2. **启动服务器**
```bash
python server.py
```

3. **在移动设备上访问**
```
http://192.168.1.100:8000
```

**注意：**
- 确保设备在同一局域网
- 防火墙可能需要允许访问
- 某些路由器可能需要配置

---

## 🛠️ 高级配置

### 自定义服务器设置

#### Python版 - 修改 server.py

```python
# 监听所有网络接口（允许局域网访问）
with socketserver.TCPServer(("0.0.0.0", PORT), MyHTTPRequestHandler) as httpd:
    # ...

# 添加HTTPS支持（需要证书）
# import ssl
# httpd.socket = ssl.wrap_socket(httpd.socket, 
#     certfile='./cert.pem', 
#     server_side=True)
```

#### Node.js版 - 修改 server.js

```javascript
// 监听所有网络接口
const HOST = '0.0.0.0';

// 添加CORS支持
res.setHeader('Access-Control-Allow-Origin', '*');
```

---

## 📊 服务器对比

| 方法 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| start.bat | 一键启动 | 仅Windows | ⭐⭐⭐⭐⭐ |
| Python | 简单快速 | 需要Python | ⭐⭐⭐⭐⭐ |
| Node.js | 性能好 | 需要Node | ⭐⭐⭐⭐ |
| npx | 无需配置 | 首次较慢 | ⭐⭐⭐⭐ |
| VS Code | 开发友好 | 需要VS Code | ⭐⭐⭐⭐⭐ |
| 直接打开 | 最简单 | 功能受限 | ⭐⭐⭐ |

---

## 🎯 推荐方案

### 对于普通用户
1. **双击 start.bat**（Windows）
2. 或 **python server.py**

### 对于开发者
1. **npx live-server --port=8000**（自动刷新）
2. 或 **VS Code Live Server**（最佳开发体验）

### 对于快速测试
1. **直接双击 index.html**

---

## 📝 启动成功标志

服务器启动成功后，你应该看到：

```
============================================================
🐑 羊了个羊 - 本地服务器
============================================================
✅ 服务器已启动！
📡 访问地址: http://localhost:8000
📂 目录: c:\Users\29292\Desktop\sheep-game
⚡ 按 Ctrl+C 停止服务器
============================================================
🌐 已自动打开浏览器

🎮 游戏运行中...
```

浏览器会自动打开并显示游戏界面。

---

## 🔐 安全提示

### 本地开发
- ✅ 仅在本机访问：安全
- ✅ 局域网访问：相对安全
- ⚠️ 公网访问：不推荐

### 生产部署
如果要部署到服务器：
- 使用Nginx或Apache
- 配置HTTPS
- 设置防火墙
- 定期更新

---

## 🎊 启动完成

选择你喜欢的方式，启动服务器，开始游戏吧！

**推荐命令：**
```bash
# Windows用户（最简单）
start.bat

# 或使用Python
python server.py

# 或使用Node.js
node server.js

# 或使用npx（推荐开发）
npx live-server --port=8000
```

---

**文档版本：** v1.0  
**更新日期：** 2026-01-28

---

*让游戏在本地完美运行！* 🚀
