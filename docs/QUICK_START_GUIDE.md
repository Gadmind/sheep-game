# 🚀 快速启动指南

## ⚡ 三秒启动

### 方法1：双击启动文件（最简单）

在项目文件夹中找到并**双击**以下任一文件：

| 文件名 | 说明 | 推荐度 |
|--------|------|--------|
| `start.bat` | 自动检测环境 | ⭐⭐⭐⭐⭐ |
| `start-python.bat` | 使用Python | ⭐⭐⭐⭐ |
| `start-node.bat` | 使用Node.js | ⭐⭐⭐⭐ |
| `start-simple.bat` | 简单Python | ⭐⭐⭐⭐ |

**就这么简单！**

---

## 📋 详细步骤

### Step 1: 找到文件

进入文件夹：
```
c:\Users\29292\Desktop\sheep-game
```

### Step 2: 双击运行

双击 `start.bat` 文件

### Step 3: 等待

命令窗口会显示：
```
============================================================
Sheep Game - Local Server Starter
============================================================

[OK] Python detected
[INFO] Starting server with Python...
```

### Step 4: 开始游戏

- 浏览器会自动打开
- 显示游戏界面
- 点击"新游戏"开始

---

## 🔧 如果不自动打开浏览器

手动在浏览器地址栏输入：
```
http://localhost:8000
```

---

## ❌ 常见错误解决

### 错误1：编码乱码（已修复）

**现象：**
```
'鍣ㄥ惎鍔ㄥ櫒' 不是内部或外部命令...
```

**解决：**
- ✅ 使用新版本的 `start.bat`（已改为纯英文）
- 或使用其他启动文件

### 错误2：端口被占用

**现象：**
```
Address already in use
```

**解决：**
```bash
# 使用其他端口
python -m http.server 8080
# 然后访问 http://localhost:8080
```

### 错误3：Python或Node未找到

**解决方案A：** 直接打开
```
双击 index.html 文件
```

**解决方案B：** 安装环境
- Python: https://www.python.org/downloads/
- Node.js: https://nodejs.org/

---

## 🎯 推荐启动方式

根据您的情况：

### 您已安装Python 3.10.6 ✅

**最佳方式：**
```
双击：start-python.bat
```

**或命令行：**
```bash
python server.py
```

### 您已安装Node.js v18.15.0 ✅

**最佳方式：**
```
双击：start-node.bat
```

**或命令行：**
```bash
node server.js
```

---

## 📝 命令行启动

### 打开命令行的方法

**方法1（最简单）：**
1. 打开项目文件夹
2. 在地址栏输入 `cmd`
3. 按回车

**方法2：**
1. 在文件夹空白处按 Shift+右键
2. 选择"在此处打开PowerShell窗口"

### 输入命令

```bash
# 最简单的方式
python server.py

# 或使用内置服务器
python -m http.server 8000

# 或使用Node.js
node server.js
```

---

## ✅ 启动成功标志

### 命令窗口显示
```
============================================================
Sheep Game - Local Server
============================================================
Server started!
Address: http://localhost:8000
Press Ctrl+C to stop
============================================================
Browser opened

Game running...
```

### 浏览器
- 自动打开游戏页面
- 看到"羊了个羊"标题
- 可以点击按钮

---

## 🎮 开始游戏

启动成功后：
1. 浏览器会打开游戏
2. 点击"新游戏"
3. 开始玩！

---

## 📱 手机访问

### 步骤

1. **查看电脑IP**
```bash
ipconfig
```
找到类似 `192.168.1.100` 的地址

2. **启动服务器**
```bash
python server.py
```

3. **手机浏览器访问**
```
http://192.168.1.100:8000
```

---

## 💡 故障排除

### 问题：乱码错误

**已修复！** 新版本 `start.bat` 使用纯英文。

如果还有问题，直接使用：
```
start-python.bat
或
start-node.bat
```

### 问题：无法启动

尝试最简单的方式：
```bash
python -m http.server 8000
```

或直接双击：
```
index.html
```

---

## 🎊 总结

**最简单的启动方式：**

```
1. 双击 start-python.bat
   或
   双击 start-node.bat

2. 等待浏览器打开

3. 开始游戏！
```

**访问地址：**
```
http://localhost:8000
```

---

**就是这么简单！立即开始吧！** 🎮

---

*Updated: 2026-01-28*  
*Version: v2.0.3.2*
