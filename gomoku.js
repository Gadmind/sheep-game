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
    let pendingUndoRequest = false;

    let canvas, ctx;

    const $ = (id) => document.getElementById(id);
    const show = (el) => { el.style.display = ''; };
    const hide = (el) => { el.style.display = 'none'; };

    function initBoard() {
        board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY));
        moveHistory = [];
        currentTurn = BLACK;
        gameOver = false;
        winner = null;
        pendingUndoRequest = false;
    }

    function checkWin(r, c, color) {
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

    function getEmptyCells() {
        const cells = [];
        for (let i = 0; i < BOARD_SIZE; i++)
            for (let j = 0; j < BOARD_SIZE; j++)
                if (board[i][j] === EMPTY) cells.push({ r: i, c: j });
        return cells;
    }

    /** 获取候选落子点：有子时只考虑已有棋子周围 2 格内的空位，否则返回天元附近 */
    function getCandidateCells(radius) {
        radius = radius || 2;
        const hasStone = [];
        for (let i = 0; i < BOARD_SIZE; i++)
            for (let j = 0; j < BOARD_SIZE; j++)
                if (board[i][j] !== EMPTY) hasStone.push({ r: i, c: j });
        if (hasStone.length === 0) {
            const center = Math.floor(BOARD_SIZE / 2);
            const out = [];
            for (let dr = -1; dr <= 1; dr++)
                for (let dc = -1; dc <= 1; dc++)
                    if (board[center + dr] && board[center + dr][center + dc] === EMPTY)
                        out.push({ r: center + dr, c: center + dc });
            return out.length ? out : [{ r: center, c: center }];
        }
        const set = new Set();
        for (const { r, c } of hasStone) {
            for (let dr = -radius; dr <= radius; dr++)
                for (let dc = -radius; dc <= radius; dc++) {
                    const nr = r + dr, nc = c + dc;
                    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === EMPTY)
                        set.add(nr * BOARD_SIZE + nc);
                }
        }
        const list = Array.from(set).map(key => ({ r: (key / BOARD_SIZE) | 0, c: key % BOARD_SIZE }));
        return list.length ? list : getEmptyCells();
    }

    // ----- AI 评估：单条线得分（五连/活四/冲四/活三/双三等），权重大幅提高 -----
    function scoreLine(arr, color) {
        const opp = color === BLACK ? WHITE : BLACK;
        let score = 0;
        let i = 0;
        while (i < arr.length) {
            if (arr[i] !== color) { i++; continue; }
            let count = 0;
            const start = i;
            while (i < arr.length && arr[i] === color) { count++; i++; }
            const leftBlock = (start - 1 < 0) || (arr[start - 1] === opp);
            const rightBlock = (i >= arr.length) || (arr[i] === opp);
            const blocked = (leftBlock ? 1 : 0) + (rightBlock ? 1 : 0);
            if (count >= 5) score += 500000;
            else if (count === 4) score += blocked === 0 ? 80000 : (blocked === 1 ? 8000 : 0);
            else if (count === 3) score += blocked === 0 ? 8000 : (blocked === 1 ? 800 : 0);
            else if (count === 2) score += blocked === 0 ? 800 : (blocked === 1 ? 80 : 0);
            else if (count === 1) score += blocked === 0 ? 80 : 8;
        }
        return score;
    }

    function evaluateBoard(color) {
        let total = 0;
        for (let i = 0; i < BOARD_SIZE; i++) {
            total += scoreLine(board[i].slice(), color);
            total += scoreLine(board.map(r => r[i]), color);
        }
        for (let d = -BOARD_SIZE; d <= BOARD_SIZE; d++) {
            const diag = [], anti = [];
            for (let i = 0; i < BOARD_SIZE; i++) {
                const j = i + d;
                if (j >= 0 && j < BOARD_SIZE) diag.push(board[i][j]);
                const k = BOARD_SIZE - 1 - i + d;
                if (k >= 0 && k < BOARD_SIZE) anti.push(board[i][k]);
            }
            if (diag.length >= 5) total += scoreLine(diag, color);
            if (anti.length >= 5) total += scoreLine(anti, color);
        }
        return total;
    }

    /** 位置分：偏好天元及星位 */
    function positionScore(r, c) {
        const center = BOARD_SIZE / 2 - 0.5;
        const d = Math.abs(r - center) + Math.abs(c - center);
        return Math.max(0, 15 - d);
    }

    /** 检测某色在 (r,c) 落子后是否成五 */
    function wouldWin(r, c, color) {
        if (board[r][c] !== EMPTY) return false;
        board[r][c] = color;
        const win = checkWin(r, c, color);
        board[r][c] = EMPTY;
        return win;
    }

    /** 检测某色在 (r,c) 落子后是否形成活四（四子两端空） */
    function wouldOpenFour(r, c, color) {
        if (board[r][c] !== EMPTY) return false;
        const dr = [0, 1, 1, 1];
        const dc = [1, 0, 1, -1];
        board[r][c] = color;
        for (let d = 0; d < 4; d++) {
            let count = 1;
            let nr = r + dr[d], nc = c + dc[d];
            while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === color) {
                count++;
                nr += dr[d];
                nc += dc[d];
            }
            const leftEmpty = (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === EMPTY);
            nr = r - dr[d];
            nc = c - dc[d];
            while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === color) {
                count++;
                nr -= dr[d];
                nc -= dc[d];
            }
            const rightEmpty = (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === EMPTY);
            if (count >= 4 && leftEmpty && rightEmpty) {
                board[r][c] = EMPTY;
                return true;
            }
        }
        board[r][c] = EMPTY;
        return false;
    }

    /** 检测某色在 (r,c) 落子后是否形成活三（三子两端空，下一手可活四） */
    function wouldOpenThree(r, c, color) {
        if (board[r][c] !== EMPTY) return false;
        const dr = [0, 1, 1, 1];
        const dc = [1, 0, 1, -1];
        board[r][c] = color;
        for (let d = 0; d < 4; d++) {
            let count = 1;
            let nr = r + dr[d], nc = c + dc[d];
            while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === color) {
                count++;
                nr += dr[d];
                nc += dc[d];
            }
            const leftEmpty = (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === EMPTY);
            nr = r - dr[d];
            nc = c - dc[d];
            while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === color) {
                count++;
                nr -= dr[d];
                nc -= dc[d];
            }
            const rightEmpty = (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === EMPTY);
            if (count === 3 && leftEmpty && rightEmpty) {
                board[r][c] = EMPTY;
                return true;
            }
        }
        board[r][c] = EMPTY;
        return false;
    }

    /** 单步评估差（用于排序），不恢复 winner */
    function quickEval(color) {
        const opp = color === BLACK ? WHITE : BLACK;
        return evaluateBoard(color) - evaluateBoard(opp);
    }

    /** 简单：必防成五/活四/活三，其余评估选最优 */
    function aiEasy() {
        const cells = getCandidateCells(2);
        if (cells.length === 0) return getEmptyCells().length ? getEmptyCells()[0] : null;
        const aiColor = currentTurn;
        const oppColor = aiColor === BLACK ? WHITE : BLACK;
        const mustBlock = [];
        for (const { r, c } of cells) {
            if (wouldWin(r, c, oppColor)) mustBlock.push({ r, c });
        }
        if (mustBlock.length > 0) return mustBlock[0];
        const blockOpenFour = [];
        for (const { r, c } of cells) {
            if (wouldOpenFour(r, c, oppColor)) blockOpenFour.push({ r, c });
        }
        if (blockOpenFour.length > 0) {
            let best = blockOpenFour[0], bestS = -Infinity;
            for (const cell of blockOpenFour) {
                board[cell.r][cell.c] = aiColor;
                const s = quickEval(aiColor) + positionScore(cell.r, cell.c);
                board[cell.r][cell.c] = EMPTY;
                if (s > bestS) { bestS = s; best = cell; }
            }
            return best;
        }
        const blockOpenThree = [];
        for (const { r, c } of cells) {
            if (wouldOpenThree(r, c, oppColor)) blockOpenThree.push({ r, c });
        }
        if (blockOpenThree.length > 0) {
            let best = blockOpenThree[0], bestS = -Infinity;
            for (const cell of blockOpenThree) {
                board[cell.r][cell.c] = aiColor;
                const s = quickEval(aiColor) + positionScore(cell.r, cell.c);
                board[cell.r][cell.c] = EMPTY;
                if (s > bestS) { bestS = s; best = cell; }
            }
            return best;
        }
        let best = null, bestScore = -Infinity;
        for (const { r, c } of cells) {
            board[r][c] = aiColor;
            const s = quickEval(aiColor) + positionScore(r, c);
            board[r][c] = EMPTY;
            if (s > bestScore) { bestScore = s; best = { r, c }; }
        }
        return best || cells[0];
    }

    /** 中等：必杀/必防成五/活四 + 4 层 minimax（2 步前瞻），根候选排序取前 22 */
    function aiMedium() {
        const cells = getCandidateCells(2);
        if (cells.length === 0) return getEmptyCells().length ? getEmptyCells()[0] : null;
        const aiColor = currentTurn;
        const oppColor = aiColor === BLACK ? WHITE : BLACK;
        for (const { r, c } of cells) {
            if (wouldWin(r, c, aiColor)) return { r, c };
        }
        const mustBlock = [];
        for (const { r, c } of cells) {
            if (wouldWin(r, c, oppColor)) mustBlock.push({ r, c });
        }
        if (mustBlock.length > 0) return mustBlock[0];
        const blockOpenFour = [];
        for (const { r, c } of cells) {
            if (wouldOpenFour(r, c, oppColor)) blockOpenFour.push({ r, c });
        }
        if (blockOpenFour.length > 0) {
            const prevWinner = winner;
            let best = blockOpenFour[0], bestScore = -Infinity;
            for (const cell of blockOpenFour) {
                board[cell.r][cell.c] = aiColor;
                currentTurn = oppColor;
                const score = minimax(3, -Infinity, Infinity, false, aiColor);
                board[cell.r][cell.c] = EMPTY;
                winner = prevWinner;
                currentTurn = aiColor;
                if (score > bestScore) { bestScore = score; best = cell; }
            }
            winner = prevWinner;
            return best;
        }
        const scored = cells.map(({ r, c }) => {
            board[r][c] = aiColor;
            const s = checkWin(r, c, aiColor) ? 500000 : (evaluateBoard(aiColor) - evaluateBoard(oppColor) + positionScore(r, c));
            board[r][c] = EMPTY;
            return { r, c, s };
        });
        scored.sort((a, b) => b.s - a.s);
        const top = scored.slice(0, 22);
        const prevWinner = winner;
        let best = null;
        let bestScore = -Infinity;
        const depth = 4;
        for (const { r, c } of top) {
            board[r][c] = aiColor;
            if (checkWin(r, c, aiColor)) {
                board[r][c] = EMPTY;
                winner = prevWinner;
                return { r, c };
            }
            currentTurn = oppColor;
            const score = minimax(depth - 1, -Infinity, Infinity, false, aiColor);
            board[r][c] = EMPTY;
            currentTurn = aiColor;
            winner = prevWinner;
            if (score > bestScore) { bestScore = score; best = { r, c }; }
        }
        winner = prevWinner;
        return best || top[0] || cells[0];
    }

    function minimax(depth, alpha, beta, isMax, color) {
        const opp = color === BLACK ? WHITE : BLACK;
        const win = winner;
        if (depth === 0 || win !== null) {
            if (win === color) return 500000 - depth;
            if (win === opp) return -500000 + depth;
            return quickEval(color);
        }
        let cells = getCandidateCells(1);
        if (cells.length === 0) return quickEval(color);
        if (depth >= 2) {
            const scored = cells.map(({ r, c }) => {
                if (isMax) {
                    board[r][c] = color;
                    const s = checkWin(r, c, color) ? 500000 : quickEval(color);
                    board[r][c] = EMPTY;
                    return { r, c, s };
                } else {
                    board[r][c] = opp;
                    const s = checkWin(r, c, opp) ? -500000 : quickEval(color);
                    board[r][c] = EMPTY;
                    return { r, c, s };
                }
            });
            scored.sort((a, b) => isMax ? (b.s - a.s) : (a.s - b.s));
            cells = scored;
        }
        if (isMax) {
            let v = -Infinity;
            for (const el of cells) {
                const r = el.r, c = el.c;
                board[r][c] = color;
                const prevWin = winner;
                if (checkWin(r, c, color)) winner = color;
                else currentTurn = opp;
                v = Math.max(v, minimax(depth - 1, alpha, beta, false, color));
                board[r][c] = EMPTY;
                winner = prevWin;
                currentTurn = color;
                alpha = Math.max(alpha, v);
                if (beta <= alpha) break;
            }
            return v;
        } else {
            let v = Infinity;
            for (const el of cells) {
                const r = el.r, c = el.c;
                board[r][c] = opp;
                const prevWin = winner;
                if (checkWin(r, c, opp)) winner = opp;
                else currentTurn = color;
                v = Math.min(v, minimax(depth - 1, alpha, beta, true, color));
                board[r][c] = EMPTY;
                winner = prevWin;
                currentTurn = opp;
                beta = Math.min(beta, v);
                if (beta <= alpha) break;
            }
            return v;
        }
    }

    /** 困难：必杀/必防成五/活四 + 5 层 minimax（约 2.5 步前瞻），根候选排序取前 15，内层走子排序 */
    function aiHard() {
        // --- 1. 开局优化：如果棋盘为空，直接下天元 ---
        let hasAnyStone = false;
        for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
                if (board[i][j] !== EMPTY) {
                    hasAnyStone = true;
                    break;
                }
            }
            if (hasAnyStone) break;
        }
        if (!hasAnyStone) {
            return { r: Math.floor(BOARD_SIZE / 2), c: Math.floor(BOARD_SIZE / 2) };
        }

        const cells = getCandidateCells(1); // 缩小到 1 格范围，极大提升速度
        if (cells.length === 0) return getEmptyCells().length ? getEmptyCells()[0] : null;
        const aiColor = currentTurn;
        const oppColor = aiColor === BLACK ? WHITE : BLACK;
        
        // 1. 必杀检查
        for (const { r, c } of cells) {
            if (wouldWin(r, c, aiColor)) return { r, c };
        }
        // 2. 必防检查
        const mustBlock = [];
        for (const { r, c } of cells) {
            if (wouldWin(r, c, oppColor)) mustBlock.push({ r, c });
        }
        if (mustBlock.length > 0) return mustBlock[0];

        const prevWinner = winner;
        // 3. 预评分排序
        const scored = cells.map(({ r, c }) => {
            board[r][c] = aiColor;
            const s = evaluateBoard(aiColor) - evaluateBoard(oppColor) + positionScore(r, c);
            board[r][c] = EMPTY;
            return { r, c, s };
        });
        scored.sort((a, b) => b.s - a.s);
        
        const top = scored.slice(0, 15); // 只取前 15 个最优点进行深搜
        const depth = 5; // 降低到 5 层，保证响应速度
        let best = null;
        let bestScore = -Infinity;

        for (const { r, c } of top) {
            board[r][c] = aiColor;
            currentTurn = oppColor;
            // 使用 alpha-beta 剪枝的 minimax
            const score = minimax(depth - 1, -Infinity, Infinity, false, aiColor);
            board[r][c] = EMPTY;
            currentTurn = aiColor;
            winner = prevWinner;

            if (score > bestScore) {
                bestScore = score;
                best = { r, c };
            }
        }
        winner = prevWinner;
        return best || top[0] || cells[0];
    }

    /** 兜底：保证在有空位时返回一个合法落子点，避免 AI 不落子 */
    function getFallbackMove() {
        try {
            if (!board || !Array.isArray(board)) return null;
            const cells = getCandidateCells(2);
            if (cells && cells.length > 0) return { r: cells[0].r, c: cells[0].c };
            const empty = getEmptyCells();
            if (empty && empty.length > 0) return { r: empty[0].r, c: empty[0].c };
        } catch (e) {
            console.warn('getFallbackMove error:', e);
        }
        return null;
    }

    function getAIMove() {
        try {
            let move = null;
            if (difficulty === 'easy') move = aiEasy();
            else if (difficulty === 'medium') move = aiMedium();
            else move = aiHard();
            if (move && typeof move.r === 'number' && typeof move.c === 'number') return move;
        } catch (e) {
            console.warn('AI move error:', e);
        }
        return getFallbackMove();
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
        for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
                if (board[i][j] === EMPTY) continue;
                const x = PADDING + j * CELL;
                const y = PADDING + i * CELL;
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

                // 绘制最后落子的标记（红点）
                if (lastMove && lastMove.r === i && lastMove.c === j) {
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

    function updateStatus() {
        const statusEl = $('game-status');
        const turnEl = $('turn-indicator');
        if (gameOver) {
            turnEl.className = 'turn-indicator';
            if (winner === 'draw') statusEl.textContent = '游戏结束：和棋';
            else if (mode === 'online') {
                statusEl.textContent = winner === myColor ? '恭喜！你赢了！' : '很遗憾，你输了';
            }
            else if (winner === BLACK) statusEl.textContent = '游戏结束：黑方胜';
            else statusEl.textContent = '游戏结束：白方胜';
            return;
        }
        
        const isMyTurn = mode === 'online' ? (myColor === currentTurn) : (currentTurn === BLACK);
        turnEl.className = 'turn-indicator ' + (currentTurn === BLACK ? 'black' : 'white');
        
        if (mode === 'online') {
            if (isMyTurn) {
                statusEl.textContent = '轮到你了';
                statusEl.style.color = '#e67e22';
            } else {
                statusEl.textContent = '对方正在思考...';
                statusEl.style.color = '#7f8c8d';
            }
        } else {
            statusEl.textContent = currentTurn === BLACK ? '黑方落子' : '白方落子';
            statusEl.style.color = '';
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
        if (mode === 'ai') return currentTurn === playerColorPreference;
        if (mode === 'online') return myColor === currentTurn;
        return false;
    }

    function doAIMove() {
        if (gameOver) return;
        const aiColor = playerColorPreference === BLACK ? WHITE : BLACK;
        currentTurn = aiColor;
        try {
            let move = getAIMove();
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
    }

    function onCellClick(r, c) {
        if (!canPlayerMove()) return;
        if (placeStone(r, c, playerColorPreference)) {
            render();
            updateStatus();
            if (gameOver) {
                if (winner === playerColorPreference) showGameOver('你赢了！');
                else if (winner === 'draw') showGameOver('和棋');
                return;
            }
            if (mode === 'ai') {
                setTimeout(doAIMove, 50);
            } else if (mode === 'online' && socket) {
                const colorStr = myColor === BLACK ? 'black' : 'white';
                socket.emit('move', { row: r, col: c, color: colorStr });
            }
        }
    }

    // ----- Socket -----
    function connectSocket() {
        if (window.location.protocol === 'file:') {
            alert('警告：你正在通过文件协议直接打开页面。联机功能需要通过服务器访问才能正常工作。\n请运行 node server.js 并访问 http://localhost:8000');
            return;
        }

        if (socket && socket.connected) return;

        if (!socket) {
            socket = io({ 
                path: '/socket.io', 
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000
            });

            socket.on('connect', () => {
                console.log('Socket connected');
                updateStatus();
            });

            socket.on('connect_error', (err) => {
                console.error('Socket connection error:', err);
                $('room-status').textContent = '连接服务器失败...';
            });

            socket.on('error', (data) => {
                if (data && data.message) alert(data.message);
            });

            socket.on('roomCreated', (data) => {
                roomId = data.roomId;
                myColor = BLACK; // 服务器端 black 对应黑色
                $('display-room-id').textContent = roomId;
                $('room-status').textContent = '等待对手加入...';
                show($('room-info'));
                hide($('room-actions'));
            });

            socket.on('roomJoined', (data) => {
                myColor = WHITE; // 服务器端 white 对应白色
                roomId = data.roomId;
                $('display-room-id').textContent = roomId;
                $('room-status').textContent = '已加入，等待游戏开始';
                show($('room-info'));
                hide($('room-actions'));
            });

            socket.on('gameStart', (data) => {
                board = data.board || Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY));
                moveHistory = data.moveHistory || [];
                currentTurn = data.currentTurn === 'white' ? WHITE : BLACK;
                gameOver = false;
                winner = null;
                hide($('setup-panel'));
                show($('game-panel'));
                hide($('online-setup'));
                render();
                updateStatus();
            });

            socket.on('move', (data) => {
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
                gameOver = true;
                winner = data.winner === 'black' ? BLACK : (data.winner === 'white' ? WHITE : 'draw');
                updateStatus();
                if (data.reason === 'resign') {
                    showGameOver(winner === myColor ? '对方认输，你赢了！' : '你认输了');
                } else if (data.reason === 'win') {
                    showGameOver(winner === myColor ? '你赢了！' : '你输了');
                } else if (data.reason === 'draw') {
                    showGameOver('棋盘已满，和棋');
                }
            });

            socket.on('opponentLeft', () => {
                if (!gameOver) {
                    alert('对方已离开游戏');
                    backToLobby();
                }
            });

            socket.on('disconnect', () => {
                console.log('Socket disconnected');
                if (mode === 'online' && !gameOver) {
                    $('game-status').textContent = '网络连接断开，尝试重连...';
                }
            });
        } else {
            socket.connect();
        }
    }

    function startAIGame() {
        initBoard();
        hide($('setup-panel'));
        show($('game-panel'));
        render();
        updateStatus();
        if (playerColorPreference === WHITE) {
            setTimeout(doAIMove, 500);
        }
    }

    function startOnlineGame() {
        if (!roomId) return;
        socket.emit('startGame', { roomId });
    }

    function requestUndo() {
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
        if (mode === 'online' && socket) {
            socket.emit('leaveRoom', { roomId });
        }
        hide($('game-panel'));
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
            hide($('room-info'));
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
                    hide($('online-setup'));
                    show($('ai-difficulty-group'));
                    show($('ai-color-group'));
                    show($('btn-start-ai'));
                } else {
                    show($('online-setup'));
                    hide($('ai-difficulty-group'));
                    hide($('ai-color-group'));
                    hide($('btn-start-ai'));
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
            if (!socket) connectSocket();
            if (socket.connected) socket.emit('createRoom');
            else socket.once('connect', () => socket.emit('createRoom'));
        });

        $('btn-join-room').addEventListener('click', () => {
            const id = $('room-id-input').value.trim();
            if (!id) { alert('请输入房间号'); return; }
            if (!socket) connectSocket();
            const doJoin = () => socket.emit('joinRoom', { roomId: id });
            if (socket.connected) doJoin();
            else socket.once('connect', doJoin);
        });

        $('btn-undo').addEventListener('click', requestUndo);
        $('btn-resign').addEventListener('click', () => {
            if (confirm('确定认输吗？')) resign();
        });
        $('btn-back-lobby').addEventListener('click', backToLobby);

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
            backToLobby();
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
