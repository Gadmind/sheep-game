#!/usr/bin/env node
/**
 * 游戏大厅 - Node.js HTTP 服务器 + Socket.IO 五子棋联机
 * 使用方法：node server.js
 * 默认端口：8000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { Server } = require('socket.io');

// 配置
const PORT = 8000;
const HOST = '0.0.0.0'; // 修改为 0.0.0.0 以允许所有网卡访问
const BOARD_SIZE = 15;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

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

// 五子棋房间： roomId -> { black, white, board, moveHistory, currentTurn, disconnectTimeout }
const rooms = new Map();

function createEmptyBoard() {
    return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY));
}

function isBoardFull(board) {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === EMPTY) return false;
        }
    }
    return true;
}

function checkWin(board, r, c, color) {
    const dr = [0, 1, 1, 1];
    const dc = [1, 0, 1, -1];
    for (let d = 0; d < 4; d++) {
        let count = 1;
        let nr = r + dr[d], nc = c + dc[d];
        while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === color) {
            count++;
            nr += dr[d];
            nc += dc[d];
        }
        nr = r - dr[d];
        nc = c - dc[d];
        while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === color) {
            count++;
            nr -= dr[d];
            nc -= dc[d];
        }
        if (count >= 5) return true;
    }
    return false;
}

function randomRoomId() {
    return Math.random().toString(36).slice(2, 10);
}

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
    // 移除查询参数
    const urlPath = req.url.split('?')[0];
    let filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);
    
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h1>404 - 文件未找到</h1><p>尝试访问: ' + filePath + '</p>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end(`服务器错误: ${error.code}`, 'utf-8');
            }
        } else {
            res.writeHead(200, {
                'Content-Type': mimeType + '; charset=utf-8',
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Expires': '0'
            });
            res.end(content, 'utf-8');
        }
    });
});

// 挂载 Socket.IO
const io = new Server(server, { 
    path: '/socket.io',
    cors: {
        origin: "*", // 允许跨域，防止从本地文件访问或不同端口访问时失败
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log(`[Socket] 玩家连接: ${socket.id}`);

    socket.on('createRoom', () => {
        const roomId = randomRoomId();
        rooms.set(roomId, {
            black: socket.id,
            white: null,
            board: createEmptyBoard(),
            moveHistory: [],
            currentTurn: 'black',
            disconnectTimeout: null
        });
        socket.join(roomId);
        console.log(`[Room] 房间创建成功: ${roomId}, 创建者: ${socket.id}`);
        socket.emit('roomCreated', { roomId });
    });

    socket.on('joinRoom', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (!room) {
            console.log(`[Room] 加入失败: 房间 ${roomId} 不存在`);
            socket.emit('error', { message: '房间不存在' });
            return;
        }

        // 处理重连逻辑
        if (room.disconnectTimeout) {
            console.log(`[Room] 玩家重连: ${roomId}`);
            clearTimeout(room.disconnectTimeout);
            room.disconnectTimeout = null;
        }

        if (room.white && room.black && room.white !== socket.id && room.black !== socket.id) {
            console.log(`[Room] 加入失败: 房间 ${roomId} 已满`);
            socket.emit('error', { message: '房间已满' });
            return;
        }

        if (!room.white && room.black !== socket.id) {
            room.white = socket.id;
            console.log(`[Room] 玩家 ${socket.id} 作为白方加入房间 ${roomId}`);
        } else {
            console.log(`[Room] 玩家 ${socket.id} 重新连接到房间 ${roomId}`);
        }

        socket.join(roomId);
        socket.emit('roomJoined', { roomId });
        // 双方就绪，广播 gameStart
        const payload = {
            board: room.board,
            moveHistory: room.moveHistory,
            currentTurn: room.currentTurn
        };
        io.to(roomId).emit('gameStart', payload);
    });

    socket.on('move', ({ row, col, color }) => {
        const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
        if (!roomId) return;
        const room = rooms.get(roomId);
        if (!room || room.board[row][col] !== EMPTY) return;
        const turnColor = room.currentTurn;
        if (color !== turnColor) return;
        const num = color === 'black' ? BLACK : WHITE;
        room.board[row][col] = num;
        room.moveHistory.push({ r: row, c: col, color: num });
        room.currentTurn = color === 'black' ? 'white' : 'black';
        
        const won = checkWin(room.board, row, col, num);
        io.to(roomId).emit('move', { row, col, color });
        
        if (won) {
            io.to(roomId).emit('gameOver', { winner: color, reason: 'win' });
        } else if (isBoardFull(room.board)) {
            io.to(roomId).emit('gameOver', { winner: 'draw', reason: 'draw' });
        }
    });

    socket.on('undoRequest', ({ roomId }) => {
        socket.to(roomId).emit('undoRequest');
    });

    socket.on('undoAccept', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (!room || room.moveHistory.length < 2) return;
        const m2 = room.moveHistory.pop();
        const m1 = room.moveHistory.pop();
        room.board[m1.r][m1.c] = EMPTY;
        room.board[m2.r][m2.c] = EMPTY;
        // 撤回两手后，回合回到撤手前的人（联机一般是成对撤回）
        // 保持 currentTurn 不变即可，因为撤回了两手（一人一手）
        io.to(roomId).emit('undoAccept', {
            board: room.board,
            moveHistory: room.moveHistory,
            currentTurn: room.currentTurn
        });
    });

    socket.on('undoReject', ({ roomId }) => {
        socket.to(roomId).emit('undoReject');
    });

    socket.on('resign', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (!room) return;
        const winner = room.black === socket.id ? 'white' : 'black';
        io.to(roomId).emit('gameOver', { winner, reason: 'resign' });
    });

    socket.on('leaveRoom', ({ roomId }) => {
        socket.leave(roomId);
        const room = rooms.get(roomId);
        if (room) {
            socket.to(roomId).emit('opponentLeft');
            if (room.disconnectTimeout) clearTimeout(room.disconnectTimeout);
            rooms.delete(roomId);
        }
    });

    socket.on('disconnect', () => {
        for (const [rid, room] of rooms.entries()) {
            if (room.black === socket.id || room.white === socket.id) {
                // 如果是正常断开（不是 leaveRoom），给 30 秒重连机会
                room.disconnectTimeout = setTimeout(() => {
                    socket.to(rid).emit('opponentLeft');
                    rooms.delete(rid);
                }, 30000); // 30秒重连时间
                break;
            }
        }
    });
});

// 启动服务器
server.listen(PORT, HOST, () => {
    const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
    const url = `http://${displayHost}:${PORT}`;
    
    console.log('='.repeat(60));
    console.log('🎮 游戏大厅 - 五子棋服务器');
    console.log('='.repeat(60));
    console.log(`✅ 服务器已启动！`);
    console.log(`📡 访问地址: ${url}`);
    console.log(`📂 运行目录: ${__dirname}`);
    console.log(`⚡ 监听网卡: ${HOST} (所有接口)`);
    console.log(`⚡ 端口: ${PORT}`);
    console.log(`⚡ 按 Ctrl+C 停止服务器`);
    console.log('='.repeat(60));

    try {
        const start = process.platform === 'darwin' ? 'open' :
            process.platform === 'win32' ? 'start' : 'xdg-open';
        exec(`${start} ${url}`, (err) => {
            if (!err) {
                console.log('🌐 已自动打开浏览器');
            } else {
                console.log(`💡 请手动在浏览器中打开: ${url}`);
            }
        });
    } catch (e) {
        console.log(`💡 请手动在浏览器中打开: ${url}`);
    }

    console.log('\n🎮 游戏服务运行中...\n');
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ 端口 ${PORT} 已被占用`);
        console.error('💡 请尝试其他端口或关闭占用该端口的程序');
    } else {
        console.error(`❌ 服务器错误: ${error.message}`);
    }
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log('\n\n⛔ 服务器已停止');
    process.exit(0);
});
