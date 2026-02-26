/**
 * 五子棋 AI 核心逻辑 - 供 gomoku-ai-worker.js 使用，避免与 gomoku.js 重复
 * 兼容 Worker (importScripts) 与主线程 (script) 加载
 */
(function (global) {
    'use strict';

    const BOARD_SIZE = 15;
    const BLACK = 1;
    const WHITE = 2;
    const EMPTY = 0;

    function copyBoard(board) {
        return board.map(row => row.slice());
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

    function evaluateBoard(board, color) {
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

    function positionScore(r, c) {
        const center = BOARD_SIZE / 2 - 0.5;
        const d = Math.abs(r - center) + Math.abs(c - center);
        return Math.max(0, 15 - d);
    }

    function wouldWin(board, r, c, color) {
        if (board[r][c] !== EMPTY) return false;
        board[r][c] = color;
        const win = checkWin(board, r, c, color);
        board[r][c] = EMPTY;
        return win;
    }

    function wouldOpenFour(board, r, c, color) {
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

    function wouldOpenThree(board, r, c, color) {
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

    function getEmptyCells(board) {
        const cells = [];
        for (let i = 0; i < BOARD_SIZE; i++)
            for (let j = 0; j < BOARD_SIZE; j++)
                if (board[i][j] === EMPTY) cells.push({ r: i, c: j });
        return cells;
    }

    function getCandidateCells(board, radius) {
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
        return list.length ? list : getEmptyCells(board);
    }

    function quickEval(board, color) {
        const opp = color === BLACK ? WHITE : BLACK;
        return evaluateBoard(board, color) - evaluateBoard(board, opp);
    }

    function minimax(board, depth, alpha, beta, isMax, color, winner) {
        const opp = color === BLACK ? WHITE : BLACK;
        if (depth === 0 || winner !== null) {
            if (winner === color) return 500000 - depth;
            if (winner === opp) return -500000 + depth;
            return quickEval(board, color);
        }
        let cells = getCandidateCells(board, 1);
        if (cells.length === 0) return quickEval(board, color);
        if (depth >= 2) {
            const scored = cells.map(({ r, c }) => {
                if (isMax) {
                    board[r][c] = color;
                    const s = checkWin(board, r, c, color) ? 500000 : quickEval(board, color);
                    board[r][c] = EMPTY;
                    return { r, c, s };
                } else {
                    board[r][c] = opp;
                    const s = checkWin(board, r, c, opp) ? -500000 : quickEval(board, color);
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
                const nextWinner = checkWin(board, r, c, color) ? color : winner;
                v = Math.max(v, minimax(board, depth - 1, alpha, beta, false, color, nextWinner));
                board[r][c] = EMPTY;
                alpha = Math.max(alpha, v);
                if (beta <= alpha) break;
            }
            return v;
        } else {
            let v = Infinity;
            for (const el of cells) {
                const r = el.r, c = el.c;
                board[r][c] = opp;
                const nextWinner = checkWin(board, r, c, opp) ? opp : winner;
                v = Math.min(v, minimax(board, depth - 1, alpha, beta, true, color, nextWinner));
                board[r][c] = EMPTY;
                beta = Math.min(beta, v);
                if (beta <= alpha) break;
            }
            return v;
        }
    }

    function aiEasy(board, aiColor) {
        const oppColor = aiColor === BLACK ? WHITE : BLACK;
        const cells = getCandidateCells(board, 2);
        if (cells.length === 0) {
            const empty = getEmptyCells(board);
            return empty.length ? empty[0] : null;
        }
        for (const { r, c } of cells) {
            if (wouldWin(board, r, c, oppColor)) return { r, c };
        }
        let blockOpenFour = [];
        for (const { r, c } of cells) {
            if (wouldOpenFour(board, r, c, oppColor)) blockOpenFour.push({ r, c });
        }
        if (blockOpenFour.length > 0) {
            let best = blockOpenFour[0], bestS = -Infinity;
            for (const cell of blockOpenFour) {
                board[cell.r][cell.c] = aiColor;
                const s = quickEval(board, aiColor) + positionScore(cell.r, cell.c);
                board[cell.r][cell.c] = EMPTY;
                if (s > bestS) { bestS = s; best = cell; }
            }
            return best;
        }
        let blockOpenThree = [];
        for (const { r, c } of cells) {
            if (wouldOpenThree(board, r, c, oppColor)) blockOpenThree.push({ r, c });
        }
        if (blockOpenThree.length > 0) {
            let best = blockOpenThree[0], bestS = -Infinity;
            for (const cell of blockOpenThree) {
                board[cell.r][cell.c] = aiColor;
                const s = quickEval(board, aiColor) + positionScore(cell.r, cell.c);
                board[cell.r][cell.c] = EMPTY;
                if (s > bestS) { bestS = s; best = cell; }
            }
            return best;
        }
        let best = null, bestScore = -Infinity;
        for (const { r, c } of cells) {
            board[r][c] = aiColor;
            const s = quickEval(board, aiColor) + positionScore(r, c);
            board[r][c] = EMPTY;
            if (s > bestScore) { bestScore = s; best = { r, c }; }
        }
        return best || cells[0];
    }

    function aiMedium(board, aiColor) {
        const oppColor = aiColor === BLACK ? WHITE : BLACK;
        const cells = getCandidateCells(board, 2);
        if (cells.length === 0) {
            const empty = getEmptyCells(board);
            return empty.length ? empty[0] : null;
        }
        for (const { r, c } of cells) {
            if (wouldWin(board, r, c, aiColor)) return { r, c };
        }
        const mustBlock = [];
        for (const { r, c } of cells) {
            if (wouldWin(board, r, c, oppColor)) mustBlock.push({ r, c });
        }
        if (mustBlock.length > 0) return mustBlock[0];
        const blockOpenFour = [];
        for (const { r, c } of cells) {
            if (wouldOpenFour(board, r, c, oppColor)) blockOpenFour.push({ r, c });
        }
        if (blockOpenFour.length > 0) {
            let best = blockOpenFour[0], bestScore = -Infinity;
            for (const cell of blockOpenFour) {
                board[cell.r][cell.c] = aiColor;
                const score = minimax(board, 3, -Infinity, Infinity, false, aiColor, null);
                board[cell.r][cell.c] = EMPTY;
                if (score > bestScore) { bestScore = score; best = cell; }
            }
            return best;
        }
        const scored = cells.map(({ r, c }) => {
            board[r][c] = aiColor;
            const s = checkWin(board, r, c, aiColor) ? 500000 : (evaluateBoard(board, aiColor) - evaluateBoard(board, oppColor) + positionScore(r, c));
            board[r][c] = EMPTY;
            return { r, c, s };
        });
        scored.sort((a, b) => b.s - a.s);
        const top = scored.slice(0, 22);
        let best = null;
        let bestScore = -Infinity;
        for (const { r, c } of top) {
            board[r][c] = aiColor;
            if (checkWin(board, r, c, aiColor)) {
                board[r][c] = EMPTY;
                return { r, c };
            }
            const score = minimax(board, 3, -Infinity, Infinity, false, aiColor, null);
            board[r][c] = EMPTY;
            if (score > bestScore) { bestScore = score; best = { r, c }; }
        }
        return best || top[0] || cells[0];
    }

    function aiHard(board, aiColor) {
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

        const oppColor = aiColor === BLACK ? WHITE : BLACK;
        const cells = getCandidateCells(board, 1);
        if (cells.length === 0) {
            const empty = getEmptyCells(board);
            return empty.length ? empty[0] : null;
        }
        for (const { r, c } of cells) {
            if (wouldWin(board, r, c, aiColor)) return { r, c };
        }
        const mustBlock = [];
        for (const { r, c } of cells) {
            if (wouldWin(board, r, c, oppColor)) mustBlock.push({ r, c });
        }
        if (mustBlock.length > 0) return mustBlock[0];

        const scored = cells.map(({ r, c }) => {
            board[r][c] = aiColor;
            const s = evaluateBoard(board, aiColor) - evaluateBoard(board, oppColor) + positionScore(r, c);
            board[r][c] = EMPTY;
            return { r, c, s };
        });
        scored.sort((a, b) => b.s - a.s);
        const top = scored.slice(0, 15);
        let best = null;
        let bestScore = -Infinity;
        for (const { r, c } of top) {
            board[r][c] = aiColor;
            const score = minimax(board, 4, -Infinity, Infinity, false, aiColor, null);
            board[r][c] = EMPTY;
            if (score > bestScore) {
                bestScore = score;
                best = { r, c };
            }
        }
        return best || top[0] || cells[0];
    }

    function getFallbackMove(board) {
        try {
            if (!board || !Array.isArray(board)) return null;
            const cells = getCandidateCells(board, 2);
            if (cells && cells.length > 0) return { r: cells[0].r, c: cells[0].c };
            const empty = getEmptyCells(board);
            if (empty && empty.length > 0) return { r: empty[0].r, c: empty[0].c };
        } catch (e) {}
        return null;
    }

    function getAIMove(board, difficulty, aiColor) {
        try {
            const b = copyBoard(board);
            let move = null;
            if (difficulty === 'easy') move = aiEasy(b, aiColor);
            else if (difficulty === 'medium') move = aiMedium(b, aiColor);
            else move = aiHard(b, aiColor);
            if (move && typeof move.r === 'number' && typeof move.c === 'number') return move;
        } catch (e) {}
        return getFallbackMove(board);
    }

    global.GOMOKU_CORE = {
        getAIMove,
        getFallbackMove,
        BOARD_SIZE,
        BLACK,
        WHITE,
        EMPTY
    };
})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : this);
