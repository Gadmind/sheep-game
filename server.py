#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
羊了个羊 - 简单HTTP服务器
使用方法：python server.py
默认端口：8000
"""

import http.server
import socketserver
import os
import webbrowser
from pathlib import Path

# 配置
PORT = 8000
DIRECTORY = Path(__file__).parent

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIRECTORY), **kwargs)
    
    def end_headers(self):
        # 添加缓存控制头
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()

def start_server():
    """启动HTTP服务器"""
    try:
        with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
            print("=" * 60)
            print("🐑 羊了个羊 - 本地服务器")
            print("=" * 60)
            print(f"✅ 服务器已启动！")
            print(f"📡 访问地址: http://localhost:{PORT}")
            print(f"📂 目录: {DIRECTORY}")
            print(f"⚡ 按 Ctrl+C 停止服务器")
            print("=" * 60)
            
            # 自动打开浏览器
            try:
                webbrowser.open(f'http://localhost:{PORT}')
                print("🌐 已自动打开浏览器")
            except:
                print("💡 请手动在浏览器中打开: http://localhost:{PORT}")
            
            print("\n🎮 游戏运行中...")
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n\n⛔ 服务器已停止")
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"❌ 端口 {PORT} 已被占用")
            print(f"💡 请尝试其他端口或关闭占用该端口的程序")
        else:
            print(f"❌ 错误: {e}")

if __name__ == "__main__":
    start_server()
