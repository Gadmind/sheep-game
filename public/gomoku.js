/**
 * 五子棋 - 人机对战 + Socket 联机，支持悔棋、认输
 */
(function () {
    'use strict';

    const BOARD_SIZE = 15;
    const CELL = 30;
    const PADDING = 15;
    const BLACK = 1;
    const WHITE = 2;

    const EMPTY = 0;

    let board = [];
    let moveHistory = [];
    let currentTurn = BLACK;
    let gameOver = false;
    let winner = null;
    let mode = 'ai';
    let difficulty = 'easy';
    let playerColorPreference = BLACK; // 用户选择的颜色
    let myColor = null;
    let roomId = null;
    let socket = null;
    let isSpectator = false;
    let isWaitingForOpponent = false;
    let pendingUndoRequest = false;
    let aiThinking = false;      // AI 计算中，用于显示「AI 思考中」提示
    let onlineMovePending = false; // 联机落子已发送，等待服务器确认，防止重复点击

    let canvas, ctx;

    /** Web Worker 用于 AI 计算，避免阻塞主线程 */
    let aiWorker = null;
    let aiWorkerTaskId = 0;
    let aiWorkerResolve = null;

    const $ = (id) => document.getElementById(id);
    const show = (el) => { if (el) el.style.display = ''; };
    const hide = (el) => { el.style.display = 'none'; };

    function initBoard() {
        board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY));
        moveHistory = [];
        currentTurn = BLACK;
        gameOver = false;
        winner = null;
        pendingUndoRequest = false;
        aiThinking = false;
        onlineMovePending = false;
    }

    function checkWin(r, c, color) {
        return getWinLine(r, c, color) !== null;
    }

    /** 获取五连的棋子坐标，若无则返回 null */
    function getWinLine(r, c, color) {
        const dr = [0, 1, 1, 1];
        const dc = [1, 0, 1, -1];
        for (let d = 0; d < 4; d++) {
            const line = [{ r, c }];
            let nr = r + dr[d], nc = c + dc[d];
            while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === color) {
                line.push({ r: nr, c: nc });
                nr += dr[d];
                nc += dc[d];
            }
            nr = r - dr[d];
            nc = c - dc[d];
            while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === color) {
                line.unshift({ r: nr, c: nc });
                nr -= dr[d];
                nc -= dc[d];
            }
            if (line.length >= 5) return line.slice(0, 5);
        }
        return null;
    }

    function isDraw() {
        for (let i = 0; i < BOARD_SIZE; i++)
            for (let j = 0; j < BOARD_SIZE; j++)
                if (board[i][j] === EMPTY) return false;
        return true;
    }

    function placeStone(r, c, color) {
        if (board[r][c] !== EMPTY) return false;
        board[r][c] = color;
        moveHistory.push({ r, c, color });
        const won = checkWin(r, c, color);
        const draw = isDraw();
        if (won) {
            gameOver = true;
            winner = color;
        } else if (draw) {
            gameOver = true;
            winner = 'draw';
        } else {
            currentTurn = color === BLACK ? WHITE : BLACK;
        }
        return true;
    }

    function undoLastTwo() {
        if (moveHistory.length < 2) return false;
        const m2 = moveHistory.pop();
        const m1 = moveHistory.pop();
        board[m1.r][m1.c] = EMPTY;
        board[m2.r][m2.c] = EMPTY;
        currentTurn = playerColorPreference;
        gameOver = false;
        winner = null;
        return true;
    }

    function undoLastOne() {
        if (moveHistory.length < 1) return false;
        const m = moveHistory.pop();
        board[m.r][m.c] = EMPTY;
        currentTurn = m.color;
        gameOver = false;
        winner = null;
        return true;
    }

    // AI 计算统一委托给 gomoku-core.js（GOMOKU_CORE），避免重复代码
    function getFallbackMove() {
        if (window.GOMOKU_CORE) return window.GOMOKU_CORE.getFallbackMove(board);
        return null;
    }

    function getAIMove() {
        if (window.GOMOKU_CORE) {
            const move = window.GOMOKU_CORE.getAIMove(board, difficulty, currentTurn);
            if (move && typeof move.r === 'number' && typeof move.c === 'number') return move;
        }
        return getFallbackMove();
    }

    /** 初始化 AI Worker（纯浏览器实现，不使用 Node.js） */
    function initAIWorker() {
        if (typeof Worker === 'undefined') return false;
        try {
            const workerUrl = new URL('gomoku-ai-worker.js', window.location.href).href;
            aiWorker = new Worker(workerUrl);
            aiWorker.onmessage = function (e) {
                const { taskId, move, error } = e.data;
                if (taskId === aiWorkerTaskId && aiWorkerResolve) {
                    aiWorkerResolve(move || getFallbackMove());
                    aiWorkerResolve = null;
                }
            };
            aiWorker.onerror = function () {
                aiWorker = null;
                if (aiWorkerResolve) {
                    aiWorkerResolve(getAIMove());
                    aiWorkerResolve = null;
                }
            };
            return true;
        } catch (e) {
            console.warn('AI Worker init failed, using main thread:', e);
            return false;
        }
    }

    /** 通过 Worker 异步获取 AI 落子，失败则回退到主线程同步计算 */
    function getAIMoveAsync() {
        return new Promise(function (resolve) {
            if (!aiWorker) {
                if (!initAIWorker()) {
                    resolve(getAIMove());
                    return;
                }
            }
            const taskId = ++aiWorkerTaskId;
            aiWorkerResolve = resolve;
            const aiColor = currentTurn;
            aiWorker.postMessage({
                board: board.map(r => r.slice()),
                difficulty: difficulty,
                aiColor: aiColor,
                taskId: taskId
            });
        });
    }

    // ----- Canvas -----
    function drawBoard() {
        if (!ctx) return;
        const size = BOARD_SIZE * CELL + PADDING * 2;
        ctx.fillStyle = '#DEB887';
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = '#5D4E37';
        ctx.lineWidth = 1;
        for (let i = 0; i < BOARD_SIZE; i++) {
            ctx.beginPath();
            ctx.moveTo(PADDING + i * CELL, PADDING);
            ctx.lineTo(PADDING + i * CELL, PADDING + (BOARD_SIZE - 1) * CELL);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(PADDING, PADDING + i * CELL);
            ctx.lineTo(PADDING + (BOARD_SIZE - 1) * CELL, PADDING + i * CELL);
            ctx.stroke();
        }
        const dots = [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]];
        ctx.fillStyle = '#5D4E37';
        dots.forEach(([x, y]) => {
            ctx.beginPath();
            ctx.arc(PADDING + x * CELL, PADDING + y * CELL, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function drawStones() {
        if (!ctx) return;
        const lastMove = moveHistory.length > 0 ? moveHistory[moveHistory.length - 1] : null;
        let winLine = null;
        if (gameOver && winner && winner !== 'draw' && lastMove && lastMove.color === winner) {
            winLine = getWinLine(lastMove.r, lastMove.c, winner);
        }
        const winSet = winLine ? new Set(winLine.map(p => p.r * BOARD_SIZE + p.c)) : null;
        for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
                if (board[i][j] === EMPTY) continue;
                const x = PADDING + j * CELL;
                const y = PADDING + i * CELL;
                const isWinStone = winSet && winSet.has(i * BOARD_SIZE + j);
                const grad = ctx.createRadialGradient(x - 4, y - 4, 0, x, y, CELL / 2);
                if (board[i][j] === BLACK) {
                    grad.addColorStop(0, '#444');
                    grad.addColorStop(1, '#1a1a1a');
                } else {
                    grad.addColorStop(0, '#fff');
                    grad.addColorStop(1, '#ddd');
                }
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(x, y, CELL / 2 - 1, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = board[i][j] === BLACK ? '#333' : '#999';
                ctx.lineWidth = 1;
                ctx.stroke();

                if (isWinStone) {
                    ctx.strokeStyle = '#e74c3c';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(x, y, CELL / 2 - 1, 0, Math.PI * 2);
                    ctx.stroke();
                } else if (lastMove && lastMove.r === i && lastMove.c === j) {
                    ctx.fillStyle = '#ff0000';
                    ctx.beginPath();
                    ctx.arc(x, y, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }

    function render() {
        drawBoard();
        drawStones();
    }

    function pixelToCoord(x, y) {
        const left = canvas.getBoundingClientRect().left;
        const top = canvas.getBoundingClientRect().top;
        const px = x - left;
        const py = y - top;
        const c = Math.round((px - PADDING) / CELL);
        const r = Math.round((py - PADDING) / CELL);
        if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) return { r, c };
        return null;
    }

    function updateActionButtons() {
        const undoBtn = $('btn-undo');
        const resignBtn = $('btn-resign');
        if (undoBtn) undoBtn.disabled = gameOver;
        if (resignBtn) resignBtn.disabled = gameOver;
    }

    function updateStatus() {
        const statusEl = $('game-status');
        const turnEl = $('turn-indicator');
        updateActionButtons();
        if (gameOver) {
            turnEl.className = 'turn-indicator';
            if (winner === 'draw') statusEl.textContent = '游戏结束：和棋';
            else if (mode === 'online' && !isSpectator) {
                statusEl.textContent = winner === myColor ? '恭喜！你赢了！' : '很遗憾，你输了';
            } else if (mode === 'online' && isSpectator) {
                statusEl.textContent = '对局结束';
            }
            else if (winner === BLACK) statusEl.textContent = '游戏结束：黑方胜';
            else statusEl.textContent = '游戏结束：白方胜';
            return;
        }
        
        const isMyTurn = mode === 'online' ? (myColor === currentTurn) : (currentTurn === BLACK);
        turnEl.className = 'turn-indicator ' + (currentTurn === BLACK ? 'black' : 'white');
        
        if (mode === 'online') {
            if (isWaitingForOpponent) {
                statusEl.textContent = '等待对手加入...';
                statusEl.style.color = '#7f8c8d';
            } else if (isSpectator) {
                statusEl.textContent = '观战中 · ' + (currentTurn === BLACK ? '黑方落子' : '白方落子');
                statusEl.style.color = '#7f8c8d';
            } else if (isMyTurn) {
                statusEl.textContent = '轮到你了';
                statusEl.style.color = '#e67e22';
            } else {
                statusEl.textContent = '对方正在思考...';
                statusEl.style.color = '#7f8c8d';
            }
        } else {
            if (aiThinking) {
                statusEl.textContent = 'AI 思考中...';
                statusEl.style.color = '#7f8c8d';
            } else {
                statusEl.textContent = currentTurn === BLACK ? '黑方落子' : '白方落子';
                statusEl.style.color = '';
            }
        }
    }

    function showGameOver(text) {
        $('game-over-title').textContent = '游戏结束';
        $('game-over-text').textContent = text;
        show($('game-over-modal'));
    }

    function hideGameOver() {
        hide($('game-over-modal'));
    }

    function canPlayerMove() {
        if (gameOver) return false;
        if (isSpectator) return false;
        if (mode === 'online' && isWaitingForOpponent) return false;
        if (mode === 'online' && onlineMovePending) return false;
        if (mode === 'ai') return currentTurn === playerColorPreference;
        if (mode === 'online') return myColor === currentTurn;
        return false;
    }

    function doAIMove() {
        if (gameOver) return;
        const aiColor = playerColorPreference === BLACK ? WHITE : BLACK;
        currentTurn = aiColor;
        aiThinking = true;
        updateStatus();
        getAIMoveAsync().then(function (move) {
            aiThinking = false;
            if (gameOver) return;
            try {
                if (!move || typeof move.r !== 'number' || typeof move.c !== 'number') {
                    move = getFallbackMove();
                }
                if (!move) {
                    currentTurn = playerColorPreference;
                    return;
                }
                let r = move.r, c = move.c;
                if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || board[r][c] !== EMPTY) {
                    move = getFallbackMove();
                    if (!move) {
                        currentTurn = playerColorPreference;
                        return;
                    }
                    r = move.r;
                    c = move.c;
                }
                if (!placeStone(r, c, aiColor)) {
                    move = getFallbackMove();
                    if (move) placeStone(move.r, move.c, aiColor);
                }
                if (canvas && !ctx && canvas.getContext) ctx = canvas.getContext('2d');
                render();
                updateStatus();
                if (gameOver) {
                    if (winner === aiColor) showGameOver('AI 获胜');
                    else if (winner === 'draw') showGameOver('和棋');
                }
            } catch (e) {
                aiThinking = false;
                console.warn('doAIMove error:', e);
                try {
                    currentTurn = aiColor;
                    const fallback = getFallbackMove();
                    if (fallback && placeStone(fallback.r, fallback.c, aiColor)) {
                        if (canvas && !ctx && canvas.getContext) ctx = canvas.getContext('2d');
                        render();
                        updateStatus();
                    } else {
                        currentTurn = playerColorPreference;
                    }
                } catch (e2) {
                    console.warn('doAIMove fallback error:', e2);
                    currentTurn = playerColorPreference;
                }
            }
            updateStatus();
        });
    }

    function onCellClick(r, c) {
        if (!canPlayerMove()) return;
        const colorToPlace = mode === 'online' ? myColor : playerColorPreference;
        if (placeStone(r, c, colorToPlace)) {
            render();
            updateStatus();
            if (mode === 'online' && socket) {
                onlineMovePending = true;
                const colorStr = myColor === BLACK ? 'black' : 'white';
                socket.emit('move', { row: r, col: c, color: colorStr });
            }
            if (gameOver) {
                if (winner === colorToPlace) showGameOver('你赢了！');
                else if (winner === 'draw') showGameOver('和棋');
                return;
            }
            if (mode === 'ai') {
                setTimeout(doAIMove, 50);
            }
        }
    }

    function updateCreateRoomButton() {
        const btn = $('btn-create-room');
        if (!btn) return;
        btn.disabled = !!(roomId && mode === 'online');
    }

    function renderRoomItem(room) {
        const li = document.createElement('li');
        li.className = 'room-item';
        const statusText = room.status === 'waiting' ? '等待中' : '对局中';
        const specText = room.spectatorCount > 0 ? ` · ${room.spectatorCount}人观战` : '';

        const infoDiv = document.createElement('div');
        infoDiv.className = 'room-item-info';
        const idSpan = document.createElement('span');
        idSpan.className = 'room-item-id';
        idSpan.textContent = room.roomId;
        const statusSpan = document.createElement('span');
        statusSpan.className = 'room-item-status ' + room.status;
        statusSpan.textContent = statusText + specText;
        infoDiv.appendChild(idSpan);
        infoDiv.appendChild(statusSpan);

        const btnsDiv = document.createElement('div');
        btnsDiv.className = 'room-item-btns';
        const btn = document.createElement('button');
        btn.type = 'button';
        if (room.isMine) {
            btn.className = 'btn btn-secondary btn-join-room';
            btn.dataset.roomId = room.roomId;
            btn.textContent = '进入';
        } else if (room.status === 'waiting') {
            btn.className = 'btn btn-primary btn-join-room';
            btn.dataset.roomId = room.roomId;
            btn.textContent = '加入';
        } else {
            btn.className = 'btn btn-secondary btn-spectate-room';
            btn.dataset.roomId = room.roomId;
            btn.textContent = '观战';
        }
        btnsDiv.appendChild(btn);

        li.appendChild(infoDiv);
        li.appendChild(btnsDiv);
        return li;
    }

    function renderRoomList(data) {
        const myList = $('room-list-my');
        const myEmpty = $('room-list-my-empty');
        const otherList = $('room-list-other');
        const otherEmpty = $('room-list-other-empty');
        if (!myList || !otherList) return;
        const myRooms = data && data.myRooms ? data.myRooms : [];
        const otherRooms = data && data.otherRooms ? data.otherRooms : [];
        myList.innerHTML = '';
        otherList.innerHTML = '';
        myEmpty.style.display = myRooms.length === 0 ? '' : 'none';
        otherEmpty.style.display = otherRooms.length === 0 ? '' : 'none';
        myRooms.forEach(room => myList.appendChild(renderRoomItem(room)));
        otherRooms.forEach(room => otherList.appendChild(renderRoomItem(room)));
    }

    // ----- Socket -----
    function connectSocket() {
        if (window.location.protocol === 'file:') {
            alert('警告：你正在通过文件协议直接打开页面。联机功能需要通过服务器访问才能正常工作。\n请运行 npm run dev 并访问显示的地址');
            return;
        }

        if (socket && socket.connected) return;

        if (!socket) {
            const connEl = $('connection-status');
            if (connEl) connEl.textContent = '(连接中...)';
            socket = io({ 
                path: '/socket.io', 
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000
            });

            socket.on('connect', () => {
                console.log('Socket connected');
                socket.emit('getRoomList');
                const statusEl = $('room-status');
                if (statusEl && mode === 'online') statusEl.textContent = '已连接';
                const connEl = $('connection-status');
                if (connEl) connEl.textContent = '(已连接)';
                updateStatus();
            });

            socket.on('connect_error', (err) => {
                console.error('Socket connection error:', err);
                const statusEl = $('room-status');
                if (statusEl) statusEl.textContent = '连接服务器失败...';
                const connEl = $('connection-status');
                if (connEl) connEl.textContent = '(连接失败)';
                alert('无法连接服务器，请确保已运行 npm run dev 并访问显示的地址（默认 http://localhost:3000）');
            });

            socket.on('error', (data) => {
                if (data && data.message) alert(data.message);
            });

            socket.on('roomList', (list) => {
                renderRoomList(list);
            });

            socket.on('roomCreated', (data) => {
                roomId = data.roomId;
                myColor = BLACK;
                isSpectator = false;
                $('display-room-id').textContent = roomId;
                $('room-status').textContent = '等待对手加入...';
                show($('room-info'));
                show($('room-list-wrap'));
                updateCreateRoomButton();
                socket.emit('getRoomList');
            });

            socket.on('roomJoined', (data) => {
                roomId = data.roomId;
                isSpectator = data.role === 'spectator';
                myColor = data.role === 'black' ? BLACK : (data.role === 'white' ? WHITE : null);
                $('display-room-id').textContent = roomId;
                $('room-status').textContent = isSpectator ? '观战中' : '已加入对局';
                show($('room-info'));
                show($('room-list-wrap'));
                updateCreateRoomButton();
            });

            socket.on('gameStart', (data) => {
                board = data.board || Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY));
                moveHistory = data.moveHistory || [];
                currentTurn = data.currentTurn === 'white' ? WHITE : BLACK;
                gameOver = data.gameOver || false;
                winner = data.winner ? (data.winner === 'black' ? BLACK : (data.winner === 'white' ? WHITE : 'draw')) : null;
                isWaitingForOpponent = data.hasOpponent === false;
                hide($('setup-panel'));
                show($('game-panel'));
                hide($('online-setup'));
                const roomInfoEl = $('game-room-info');
                const roomIdEl = $('game-room-id');
                if (roomInfoEl && roomIdEl && roomId) {
                    roomIdEl.textContent = roomId;
                    show(roomInfoEl);
                }
                if (isSpectator) {
                    hide($('action-btns'));
                    show($('spectator-notice'));
                } else {
                    show($('action-btns'));
                    hide($('spectator-notice'));
                }
                render();
                updateStatus();
            });

            socket.on('move', (data) => {
                onlineMovePending = false;
                const color = data.color === 'black' ? BLACK : WHITE;
                if (placeStone(data.row, data.col, color)) {
                    render();
                    updateStatus();
                    if (gameOver) {
                        if (winner === myColor) showGameOver('你赢了！');
                        else if (winner === 'draw') showGameOver('和棋');
                        else showGameOver('你输了');
                    }
                }
            });

            socket.on('undoRequest', () => {
                pendingUndoRequest = true;
                show($('undo-request-modal'));
            });

            socket.on('undoAccept', (data) => {
                board = data.board;
                moveHistory = data.moveHistory || [];
                currentTurn = data.currentTurn === 'white' ? WHITE : BLACK;
                gameOver = false;
                winner = null;
                render();
                updateStatus();
            });

            socket.on('undoReject', () => {
                pendingUndoRequest = false;
                hide($('undo-request-modal'));
                alert('对方拒绝了悔棋');
            });

            socket.on('gameOver', (data) => {
                onlineMovePending = false;
                gameOver = true;
                winner = data.winner === 'black' ? BLACK : (data.winner === 'white' ? WHITE : 'draw');
                updateStatus();
                let msg = '';
                if (isSpectator) {
                    msg = data.reason === 'resign' ? '一方认输，对局结束' : (data.reason === 'draw' ? '和棋' : '对局结束');
                } else if (data.reason === 'resign') {
                    msg = winner === myColor ? '对方认输，你赢了！' : '你认输了';
                } else if (data.reason === 'win') {
                    msg = winner === myColor ? '你赢了！' : '你输了';
                } else if (data.reason === 'draw') {
                    msg = '棋盘已满，和棋';
                } else {
                    msg = winner === myColor ? '你赢了！' : (winner === 'draw' ? '和棋' : '你输了');
                }
                showGameOver(msg || '游戏结束');
            });

            socket.on('opponentLeft', () => {
                onlineMovePending = false;
                // 延迟处理，确保 gameOver 事件先到达，双方都能看到胜负弹框
                setTimeout(() => {
                    if (!gameOver) {
                        if (isSpectator) {
                            alert('对局已结束，玩家已离开');
                        } else {
                            alert('对方已离开游戏');
                        }
                        backToLobby();
                    }
                }, 800);
            });

            socket.on('disconnect', () => {
                console.log('Socket disconnected');
                const connEl = $('connection-status');
                if (connEl) connEl.textContent = '(已断开)';
                if (mode === 'online' && !gameOver) {
                    const statusEl = $('game-status');
                    if (statusEl) statusEl.textContent = '网络连接断开，尝试重连...';
                }
            });
        } else {
            socket.connect();
        }
    }

    function startAIGame() {
        initBoard();
        hide($('setup-panel'));
        hide($('game-room-info'));
        show($('game-panel'));
        render();
        updateStatus();
        initAIWorker(); // 预初始化 Worker，首次 AI 落子时无额外延迟
        if (playerColorPreference === WHITE) {
            setTimeout(doAIMove, 500);
        }
    }

    function requestUndo() {
        if (gameOver) return;
        if (mode === 'ai') {
            if (undoLastTwo()) {
                render();
                updateStatus();
            }
        } else if (socket && socket.connected && !pendingUndoRequest) {
            socket.emit('undoRequest', { roomId });
        }
    }

    function resign() {
        if (gameOver) return;
        if (mode === 'ai') {
            gameOver = true;
            winner = playerColorPreference === BLACK ? WHITE : BLACK;
            showGameOver('你认输了，AI 获胜');
            updateStatus();
        } else if (socket && socket.connected) {
            socket.emit('resign', { roomId });
        }
    }

    function backToLobby() {
        aiThinking = false;
        onlineMovePending = false;
        isSpectator = false;
        isWaitingForOpponent = false;
        if (mode === 'online' && socket) {
            socket.emit('leaveRoom', { roomId });
        }
        roomId = null;
        myColor = null;
        hide($('game-panel'));
        hide($('game-room-info'));
        show($('setup-panel'));
        $('game-over-modal').style.display = 'none';
        $('undo-request-modal').style.display = 'none';
        if (mode === 'ai') {
            show($('ai-difficulty-group'));
            show($('ai-color-group'));
            show($('btn-start-ai'));
        } else {
            show($('online-setup'));
            show($('room-actions'));
            show($('room-list-wrap'));
            hide($('room-info'));
            updateCreateRoomButton();
            if (socket && socket.connected) socket.emit('getRoomList');
        }
    }

    function bindEvents() {
        canvas = $('gomoku-board');
        if (!canvas) return;
        ctx = canvas.getContext('2d');

        canvas.addEventListener('click', (e) => {
            const pos = pixelToCoord(e.clientX, e.clientY);
            if (pos) onCellClick(pos.r, pos.c);
        });

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                mode = btn.dataset.mode;
                if (mode === 'ai') {
                    if (roomId && socket && socket.connected) {
                        socket.emit('leaveRoom', { roomId });
                        roomId = null;
                        myColor = null;
                        isWaitingForOpponent = false;
                    }
                    hide($('online-setup'));
                    show($('ai-difficulty-group'));
                    show($('ai-color-group'));
                    show($('btn-start-ai'));
                } else {
                    show($('online-setup'));
                    hide($('ai-difficulty-group'));
                    hide($('ai-color-group'));
                    hide($('btn-start-ai'));
                    show($('room-actions'));
                    show($('room-list-wrap'));
                    hide($('room-info'));
                    updateCreateRoomButton();
                    connectSocket();
                }
            });
        });

        document.querySelectorAll('#ai-difficulty-group .difficulty-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#ai-difficulty-group .difficulty-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                difficulty = btn.dataset.difficulty;
            });
        });

        document.querySelectorAll('#ai-color-group .color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#ai-color-group .color-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                playerColorPreference = btn.dataset.color === 'black' ? BLACK : WHITE;
            });
        });

        $('btn-start-ai').addEventListener('click', startAIGame);

        $('btn-create-room').addEventListener('click', () => {
            if (roomId && mode === 'online') return;
            if (!socket) connectSocket();
            if (!socket) return;
            if (socket.connected) socket.emit('createRoom');
            else socket.once('connect', () => socket.emit('createRoom'));
        });

        $('btn-refresh-rooms').addEventListener('click', () => {
            if (socket && socket.connected) socket.emit('getRoomList');
        });

        document.getElementById('room-list-wrap')?.addEventListener('click', (e) => {
            const joinBtn = e.target.closest('.btn-join-room');
            const spectateBtn = e.target.closest('.btn-spectate-room');
            if (joinBtn) {
                const id = joinBtn.dataset.roomId;
                if (!id) return;
                if (!socket || !socket.connected) {
                    alert('请等待连接服务器...');
                    return;
                }
                socket.emit('joinRoom', { roomId: id });
            } else if (spectateBtn) {
                const id = spectateBtn.dataset.roomId;
                if (!id) return;
                if (!socket || !socket.connected) {
                    alert('请等待连接服务器...');
                    return;
                }
                socket.emit('spectateRoom', { roomId: id });
            }
        });

        $('btn-undo').addEventListener('click', requestUndo);
        $('btn-resign').addEventListener('click', () => {
            if (confirm('确定认输吗？')) resign();
        });
        $('btn-back-lobby').addEventListener('click', backToLobby);
        $('btn-leave-spectate')?.addEventListener('click', backToLobby);

        $('undo-accept').addEventListener('click', () => {
            if (socket) socket.emit('undoAccept', { roomId });
            pendingUndoRequest = false;
            hide($('undo-request-modal'));
        });
        $('undo-reject').addEventListener('click', () => {
            if (socket) socket.emit('undoReject', { roomId });
            pendingUndoRequest = false;
            hide($('undo-request-modal'));
        });

        $('btn-game-over-ok').addEventListener('click', () => {
            hideGameOver();
            // 仅关闭弹框，停留在游戏界面，用户可点击「返回大厅」再离开
        });
    }

    function init() {
        bindEvents();
        document.querySelectorAll('.mode-btn').forEach(b => {
            if (b.dataset.mode === 'ai') b.classList.add('active');
            else b.classList.remove('active');
        });
        document.querySelectorAll('.difficulty-btn').forEach(b => {
            if (b.dataset.difficulty === difficulty) b.classList.add('active');
            else b.classList.remove('active');
        });
        document.querySelectorAll('.color-btn').forEach(b => {
            const col = b.dataset.color === 'black' ? BLACK : WHITE;
            if (col === playerColorPreference) b.classList.add('active');
            else b.classList.remove('active');
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
