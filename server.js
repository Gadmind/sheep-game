#!/usr/bin/env node
/**
 * 羊了个羊 - Node.js HTTP服务器
 * 使用方法：node server.js
 * 默认端口：8000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// 配置
const PORT = 8000;
const HOST = 'localhost';

// MIME类型映射
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.md': 'text/markdown',
};

// 创建服务器
const server = http.createServer((req, res) => {
    // 解析URL
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    // 获取文件扩展名
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeType = mimeTypes[extname] || 'application/octet-stream';

    // 读取文件
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // 文件未找到
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h1>404 - 文件未找到</h1>', 'utf-8');
            } else {
                // 服务器错误
                res.writeHead(500);
                res.end(`服务器错误: ${error.code}`, 'utf-8');
            }
        } else {
            // 成功
            res.writeHead(200, { 
                'Content-Type': mimeType + '; charset=utf-8',
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Expires': '0'
            });
            res.end(content, 'utf-8');
        }
    });
});

// 启动服务器
server.listen(PORT, HOST, () => {
    console.log('='.repeat(60));
    console.log('🐑 羊了个羊 - 本地服务器');
    console.log('='.repeat(60));
    console.log(`✅ 服务器已启动！`);
    console.log(`📡 访问地址: http://${HOST}:${PORT}`);
    console.log(`📂 目录: ${__dirname}`);
    console.log(`⚡ 按 Ctrl+C 停止服务器`);
    console.log('='.repeat(60));
    
    // 自动打开浏览器
    const url = `http://${HOST}:${PORT}`;
    const start = process.platform === 'darwin' ? 'open' : 
                  process.platform === 'win32' ? 'start' : 'xdg-open';
    
    exec(`${start} ${url}`, (err) => {
        if (!err) {
            console.log('🌐 已自动打开浏览器');
        } else {
            console.log(`💡 请手动在浏览器中打开: ${url}`);
        }
    });
    
    console.log('\n🎮 游戏运行中...\n');
});

// 错误处理
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ 端口 ${PORT} 已被占用`);
        console.error('💡 请尝试其他端口或关闭占用该端口的程序');
    } else {
        console.error(`❌ 服务器错误: ${error.message}`);
    }
    process.exit(1);
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n\n⛔ 服务器已停止');
    process.exit(0);
});
