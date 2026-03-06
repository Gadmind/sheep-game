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

// 五子棋房间： roomId -> { black, white, spectators: Set, board, moveHistory, currentTurn, gameOver, disconnectTimeout }
const rooms = new Map();
const LOBBY = 'lobby';

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

/** 检查 socket 是否仍连接 */
function isSocketConnected(socketId) {
    return io.sockets.sockets.has(socketId);
}

/** 获取房间列表（供大厅展示），按创建者/可加入分组 */
function getRoomListForSocket(socketId) {
    const validRooms = Array.from(rooms.entries())
        .filter(([, room]) => {
            if (!isSocketConnected(room.black)) return false;
            if (room.white && !isSocketConnected(room.white)) return false;
            return true;
        })
        .map(([roomId, room]) => ({
            roomId,
            status: room.white ? 'playing' : 'waiting',
            spectatorCount: room.spectators ? room.spectators.size : 0,
            isMine: room.black === socketId
        }));
    return {
        myRooms: validRooms.filter(r => r.isMine),
        otherRooms: validRooms.filter(r => !r.isMine)
    };
}

/** 广播房间列表给大厅所有人（每人收到自己的分组列表） */
function broadcastRoomList() {
    io.in(LOBBY).fetchSockets().then(sockets => {
        sockets.forEach(s => s.emit('roomList', getRoomListForSocket(s.id)));
    });
}

/** 玩家离开当前所在的游戏房间（排除 excludeRoomId），确保只能在一个房间内 */
function leaveOtherGameRooms(socket, excludeRoomId) {
    for (const rid of socket.rooms) {
        if (rid === socket.id || rid === LOBBY || rid === excludeRoomId) continue;
        const room = rooms.get(rid);
        if (!room) continue;
        const isSpectator = room.spectators && room.spectators.has(socket.id);
        socket.leave(rid);
        if (room) {
            if (isSpectator) {
                room.spectators.delete(socket.id);
            } else {
                socket.to(rid).emit('opponentLeft');
                if (room.disconnectTimeout) clearTimeout(room.disconnectTimeout);
                rooms.delete(rid);
            }
            broadcastRoomList();
        }
        break;
    }
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
    const urlPath = req.url.split('?')[0];
    let filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);

    // 防止路径遍历攻击：确保文件路径在项目目录内
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(__dirname) + path.sep) && resolvedPath !== path.resolve(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>403 - 禁止访问</h1>', 'utf-8');
        return;
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h1>404 - 文件未找到</h1><p>尝试访问: ' + escapeHtml(filePath) + '</p>', 'utf-8');
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
    socket.join(LOBBY);

    socket.on('getRoomList', () => {
        socket.emit('roomList', getRoomListForSocket(socket.id));
    });

    socket.on('createRoom', () => {
        leaveOtherGameRooms(socket, null);
        const roomId = randomRoomId();
        rooms.set(roomId, {
            black: socket.id,
            white: null,
            spectators: new Set(),
            board: createEmptyBoard(),
            moveHistory: [],
            currentTurn: 'black',
            gameOver: false,
            disconnectTimeout: null
        });
        socket.join(roomId);
        console.log(`[Room] 房间创建成功: ${roomId}, 创建者: ${socket.id}`);
        socket.emit('roomCreated', { roomId });
        broadcastRoomList();
    });

    socket.on('joinRoom', ({ roomId }) => {
        leaveOtherGameRooms(socket, roomId);
        const room = rooms.get(roomId);
        if (!room) {
            socket.emit('error', { message: '房间不存在' });
            return;
        }

        if (!isSocketConnected(room.black)) {
            rooms.delete(roomId);
            socket.emit('error', { message: '房间创建者已离开，房间已失效' });
            broadcastRoomList();
            return;
        }
        if (room.white && !isSocketConnected(room.white)) {
            room.white = null;
        }

        if (room.disconnectTimeout) {
            clearTimeout(room.disconnectTimeout);
            room.disconnectTimeout = null;
        }

        // 重连：黑方或白方
        if (room.black === socket.id || room.white === socket.id) {
            socket.join(roomId);
            socket.emit('roomJoined', { roomId, role: room.black === socket.id ? 'black' : 'white' });
            const payload = {
                board: room.board,
                moveHistory: room.moveHistory,
                currentTurn: room.currentTurn,
                hasOpponent: !!room.white
            };
            socket.emit('gameStart', payload);
            broadcastRoomList();
            return;
        }

        // 新玩家加入：房间等待中则作为白方
        if (!room.white) {
            room.white = socket.id;
            socket.join(roomId);
            socket.emit('roomJoined', { roomId, role: 'white' });
            const payload = {
                board: room.board,
                moveHistory: room.moveHistory,
                currentTurn: room.currentTurn,
                hasOpponent: true
            };
            io.to(roomId).emit('gameStart', payload);
            console.log(`[Room] 玩家 ${socket.id} 作为白方加入房间 ${roomId}`);
        } else {
            socket.emit('error', { message: '房间已有两名玩家，请选择观战' });
        }
        broadcastRoomList();
    });

    socket.on('spectateRoom', ({ roomId }) => {
        leaveOtherGameRooms(socket, roomId);
        const room = rooms.get(roomId);
        if (!room) {
            socket.emit('error', { message: '房间不存在' });
            return;
        }
        if (!isSocketConnected(room.black) || (room.white && !isSocketConnected(room.white))) {
            if (!isSocketConnected(room.black)) rooms.delete(roomId);
            socket.emit('error', { message: '房间玩家已离开，无法观战' });
            broadcastRoomList();
            return;
        }
        room.spectators.add(socket.id);
        socket.join(roomId);
        socket.emit('roomJoined', { roomId, role: 'spectator' });
        const payload = {
            board: room.board,
            moveHistory: room.moveHistory,
            currentTurn: room.currentTurn,
            gameOver: room.gameOver || false,
            winner: room.winner || null
        };
        socket.emit('gameStart', payload);
        broadcastRoomList();
        console.log(`[Room] 玩家 ${socket.id} 观战加入房间 ${roomId}`);
    });

    socket.on('move', ({ row, col, color }) => {
        const roomId = Array.from(socket.rooms).find(r => r !== socket.id && r !== LOBBY && rooms.has(r));
        if (!roomId || !rooms.has(roomId)) return;
        const room = rooms.get(roomId);
        if (!room || room.gameOver) return;
        if (!room.white) return;
        if (room.spectators && room.spectators.has(socket.id)) return;
        if (typeof row !== 'number' || typeof col !== 'number' ||
            row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return;
        if (room.board[row][col] !== EMPTY) return;
        const turnColor = room.currentTurn;
        if (color !== turnColor) return;
        const num = color === 'black' ? BLACK : WHITE;
        room.board[row][col] = num;
        room.moveHistory.push({ r: row, c: col, color: num });
        room.currentTurn = color === 'black' ? 'white' : 'black';
        
        const won = checkWin(room.board, row, col, num);
        io.to(roomId).emit('move', { row, col, color });
        
        if (won) {
            room.gameOver = true;
            room.winner = color;
            io.to(roomId).emit('gameOver', { winner: color, reason: 'win' });
        } else if (isBoardFull(room.board)) {
            room.gameOver = true;
            room.winner = 'draw';
            io.to(roomId).emit('gameOver', { winner: 'draw', reason: 'draw' });
        }
    });

    socket.on('undoRequest', ({ roomId }) => {
        socket.to(roomId).emit('undoRequest');
    });

    socket.on('undoAccept', ({ roomId }) => {
        if (!rooms.has(roomId) || !socket.rooms.has(roomId)) return;
        const room = rooms.get(roomId);
        if (!room || room.gameOver || room.moveHistory.length < 2) return;
        const m2 = room.moveHistory.pop();
        const m1 = room.moveHistory.pop();
        room.board[m1.r][m1.c] = EMPTY;
        room.board[m2.r][m2.c] = EMPTY;
        room.gameOver = false;
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
        if (!rooms.has(roomId) || !socket.rooms.has(roomId)) return;
        const room = rooms.get(roomId);
        if (!room || room.gameOver) return;
        if (room.spectators && room.spectators.has(socket.id)) return;
        const winner = room.black === socket.id ? 'white' : 'black';
        room.gameOver = true;
        room.winner = winner;
        io.to(roomId).emit('gameOver', { winner, reason: 'resign' });
    });

    socket.on('leaveRoom', ({ roomId }) => {
        if (!roomId) return;
        const room = rooms.get(roomId);
        const isSpectator = room && room.spectators && room.spectators.has(socket.id);
        socket.leave(roomId);
        if (room) {
            if (isSpectator) {
                room.spectators.delete(socket.id);
            } else {
                // 游戏结束后延迟通知，确保对方已收到 gameOver 并看到胜负弹框
                const delay = room.gameOver ? 1500 : 0;
                const doLeave = () => {
                    socket.to(roomId).emit('opponentLeft');
                    if (room.disconnectTimeout) clearTimeout(room.disconnectTimeout);
                    rooms.delete(roomId);
                    broadcastRoomList();
                };
                if (delay > 0) setTimeout(doLeave, delay);
                else doLeave();
            }
        }
    });

    socket.on('disconnect', () => {
        socket.leave(LOBBY);
        for (const [rid, room] of rooms.entries()) {
            if (room.spectators && room.spectators.has(socket.id)) {
                room.spectators.delete(socket.id);
                broadcastRoomList();
                break;
            }
            if (room.black === socket.id || room.white === socket.id) {
                room.disconnectTimeout = setTimeout(() => {
                    io.to(rid).emit('opponentLeft');
                    rooms.delete(rid);
                    broadcastRoomList();
                }, 30000);
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
