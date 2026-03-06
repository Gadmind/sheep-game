/**
 * 五子棋 AI 核心逻辑 - 供 gomoku-ai-worker.js 使用
 * 兼容 Worker (importScripts) 与主线程 (script) 加载
 *
 * 优化点：
 *  1. Zobrist 哈希 + 置换表（TT），避免重复计算相同局面
 *  2. scoreAround 局部评估，替代走法排序中的全棋盘 quickEval
 *  3. 根节点 α-β 共享，让前序搜索结果剪枝后续候选点
 *  4. wouldOpenN 合并 wouldOpenFour / wouldOpenThree
 *  5. aiEasy 先检查自身能否立即赢棋
 *  6. aiHard 迭代加深 + 1.5s 时间预算，自适应搜索深度
 */
(function (global) {
    'use strict';

    const BOARD_SIZE = 15;
    const BLACK = 1;
    const WHITE = 2;
    const EMPTY = 0;

    // ── Zobrist 哈希表（模块加载时初始化一次）──────────────────────────────
    // 每个格子×颜色分配一个随机 32 位整数，增量更新代价极低
    const ZOBRIST = (function () {
        const t = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            t[r] = [];
            for (let c = 0; c < BOARD_SIZE; c++) {
                t[r][c] = [
                    Math.random() * 0x100000000 >>> 0,  // BLACK
                    Math.random() * 0x100000000 >>> 0   // WHITE
                ];
            }
        }
        return t;
    })();

    /** 从棋盘状态全量计算哈希（仅在搜索入口调用一次） */
    function computeHash(board) {
        let h = 0;
        for (let r = 0; r < BOARD_SIZE; r++)
            for (let c = 0; c < BOARD_SIZE; c++)
                if (board[r][c] !== EMPTY)
                    h = (h ^ ZOBRIST[r][c][board[r][c] - 1]) >>> 0;
        return h;
    }

    // 置换表标志
    const TT_EXACT = 0;
    const TT_LOWER = 1;  // fail-high：实际值 >= score
    const TT_UPPER = 2;  // fail-low ：实际值 <= score
    const TT_MAX_SIZE = 300000;
    let transTable = new Map();

    // ── 基础工具 ─────────────────────────────────────────────────────────────

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
                count++; nr += dr[d]; nc += dc[d];
            }
            nr = r - dr[d]; nc = c - dc[d];
            while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === color) {
                count++; nr -= dr[d]; nc -= dc[d];
            }
            if (count >= 5) return true;
        }
        return false;
    }

    // ── 评估函数 ─────────────────────────────────────────────────────────────

    function scoreDirection(board, startR, startC, dr, dc, length, color) {
        const opp = color === BLACK ? WHITE : BLACK;
        let score = 0, i = 0;
        while (i < length) {
            if (board[startR + i * dr][startC + i * dc] !== color) { i++; continue; }
            let count = 0;
            const start = i;
            while (i < length && board[startR + i * dr][startC + i * dc] === color) { count++; i++; }
            const leftBlock  = (start === 0) || (board[startR + (start - 1) * dr][startC + (start - 1) * dc] === opp);
            const rightBlock = (i >= length) || (board[startR + i * dr][startC + i * dc] === opp);
            const blocked = (leftBlock ? 1 : 0) + (rightBlock ? 1 : 0);
            if      (count >= 5) score += 500000;
            else if (count === 4) score += blocked === 0 ? 80000 : (blocked === 1 ? 8000 : 0);
            else if (count === 3) score += blocked === 0 ? 8000  : (blocked === 1 ? 800  : 0);
            else if (count === 2) score += blocked === 0 ? 800   : (blocked === 1 ? 80   : 0);
            else if (count === 1) score += blocked === 0 ? 80    : 8;
        }
        return score;
    }

    /** 全棋盘评估（仅用于叶节点，保证精度） */
    function evaluateBoard(board, color) {
        let total = 0;
        for (let i = 0; i < BOARD_SIZE; i++) {
            total += scoreDirection(board, i, 0, 0, 1, BOARD_SIZE, color);
            total += scoreDirection(board, 0, i, 1, 0, BOARD_SIZE, color);
        }
        for (let d = -(BOARD_SIZE - 1); d < BOARD_SIZE; d++) {
            const startR = d >= 0 ? 0 : -d;
            const startC = d >= 0 ? d : 0;
            const len = BOARD_SIZE - Math.abs(d);
            if (len >= 5) total += scoreDirection(board, startR, startC, 1,  1, len, color);
        }
        for (let d = 0; d < 2 * BOARD_SIZE - 1; d++) {
            const startR = d < BOARD_SIZE ? 0 : d - BOARD_SIZE + 1;
            const startC = d < BOARD_SIZE ? d : BOARD_SIZE - 1;
            const len = d < BOARD_SIZE ? d + 1 : 2 * BOARD_SIZE - 1 - d;
            if (len >= 5) total += scoreDirection(board, startR, startC, 1, -1, len, color);
        }
        return total;
    }

    /**
     * 快速局部评估：仅扫描经过 (r,c) 的 4 条线（各向延伸 ≤4 格），
     * 比 evaluateBoard 快约 10×，专用于走法排序启发
     */
    function scoreAround(board, r, c, color) {
        let score = 0;
        const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
        for (const [dr, dc] of DIRS) {
            // 向后最多走 4 步找线段起点
            let sr = r, sc = c;
            for (let k = 0; k < 4; k++) {
                const nr = sr - dr, nc = sc - dc;
                if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
                sr = nr; sc = nc;
            }
            // 向前最多走 4 步找线段终点
            let er = r, ec = c;
            for (let k = 0; k < 4; k++) {
                const nr = er + dr, nc = ec + dc;
                if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
                er = nr; ec = nc;
            }
            const len = Math.max(Math.abs(er - sr), Math.abs(ec - sc)) + 1;
            score += scoreDirection(board, sr, sc, dr, dc, len, color);
        }
        return score;
    }

    /** 全棋盘差分评估（用于叶节点） */
    function quickEval(board, color) {
        const opp = color === BLACK ? WHITE : BLACK;
        return evaluateBoard(board, color) - evaluateBoard(board, opp);
    }

    /** 局部差分评估（用于走法排序，不调用 evaluateBoard） */
    function quickEvalAround(board, r, c, color) {
        const opp = color === BLACK ? WHITE : BLACK;
        return scoreAround(board, r, c, color) - scoreAround(board, r, c, opp);
    }

    function positionScore(r, c) {
        const center = BOARD_SIZE / 2 - 0.5;
        const d = Math.abs(r - center) + Math.abs(c - center);
        return Math.max(0, 15 - d);
    }

    // ── 棋型判断 ─────────────────────────────────────────────────────────────

    function wouldWin(board, r, c, color) {
        if (board[r][c] !== EMPTY) return false;
        board[r][c] = color;
        const win = checkWin(board, r, c, color);
        board[r][c] = EMPTY;
        return win;
    }

    /**
     * 检查落子后是否形成两端开放的 n 连（n=4→活四，n=3→活三）
     * 合并原来的 wouldOpenFour / wouldOpenThree，消除重复代码
     */
    function wouldOpenN(board, r, c, color, n) {
        if (board[r][c] !== EMPTY) return false;
        const dr = [0, 1, 1, 1], dc = [1, 0, 1, -1];
        board[r][c] = color;
        for (let d = 0; d < 4; d++) {
            let count = 1;
            let nr = r + dr[d], nc = c + dc[d];
            while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === color) {
                count++; nr += dr[d]; nc += dc[d];
            }
            const leftEmpty = nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === EMPTY;
            nr = r - dr[d]; nc = c - dc[d];
            while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === color) {
                count++; nr -= dr[d]; nc -= dc[d];
            }
            const rightEmpty = nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === EMPTY;
            // 活四允许 count >= 4；活三精确匹配 count === 3
            const matches = n >= 4 ? count >= n : count === n;
            if (matches && leftEmpty && rightEmpty) {
                board[r][c] = EMPTY;
                return true;
            }
        }
        board[r][c] = EMPTY;
        return false;
    }

    // ── 候选点生成 ────────────────────────────────────────────────────────────

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

    /** 按局部启发打分并截取前 topN 个候选点（用于根节点预筛） */
    function getTopCandidates(board, aiColor, topN) {
        const cells = getCandidateCells(board, 1);
        const scored = cells.map(({ r, c }) => {
            board[r][c] = aiColor;
            const s = checkWin(board, r, c, aiColor)
                ? 500000
                : (quickEvalAround(board, r, c, aiColor) + positionScore(r, c));
            board[r][c] = EMPTY;
            return { r, c, s };
        });
        scored.sort((a, b) => b.s - a.s);
        return scored.slice(0, topN);
    }

    // ── Minimax + α-β + 置换表 ────────────────────────────────────────────────

    /**
     * @param {number[][]} board  - 当前棋盘（原地修改并还原）
     * @param {number}     depth  - 剩余搜索深度
     * @param {number}     alpha
     * @param {number}     beta
     * @param {boolean}    isMax  - true = AI 走棋
     * @param {number}     color  - AI 颜色（始终不变，评估视角固定）
     * @param {number|null} winner - 已分出胜负时的颜色，否则 null
     * @param {number}     hash   - 当前棋盘的 Zobrist 哈希（32位无符号整数）
     */
    function minimax(board, depth, alpha, beta, isMax, color, winner, hash) {
        const opp = color === BLACK ? WHITE : BLACK;
        const origAlpha = alpha;

        // ── 置换表查询 ──────────────────────────────────────────────────────
        const ttEntry = transTable.get(hash);
        if (ttEntry && ttEntry.depth >= depth) {
            if (ttEntry.flag === TT_EXACT) return ttEntry.score;
            if (ttEntry.flag === TT_LOWER) alpha = Math.max(alpha, ttEntry.score);
            if (ttEntry.flag === TT_UPPER) beta  = Math.min(beta,  ttEntry.score);
            if (alpha >= beta) return ttEntry.score;
        }

        // ── 终止条件 ──────────────────────────────────────────────────────
        if (depth === 0 || winner !== null) {
            let score;
            if   (winner === color) score = 500000 - depth;
            else if (winner === opp) score = -500000 + depth;
            else                     score = quickEval(board, color);
            transTable.set(hash, { score, depth, flag: TT_EXACT });
            return score;
        }

        let cells = getCandidateCells(board, 1);
        if (cells.length === 0) return quickEval(board, color);

        // ── 走法排序（使用局部快速评估，替代原来的全棋盘 quickEval）────────
        if (depth >= 2) {
            cells = cells.map(({ r, c }) => {
                const stone = isMax ? color : opp;
                board[r][c] = stone;
                const s = checkWin(board, r, c, stone)
                    ? (isMax ? 500000 : -500000)
                    : quickEvalAround(board, r, c, color);
                board[r][c] = EMPTY;
                return { r, c, s };
            }).sort((a, b) => isMax ? b.s - a.s : a.s - b.s);
        }

        // ── 递归搜索 ──────────────────────────────────────────────────────
        let v = isMax ? -Infinity : Infinity;
        for (const { r, c } of cells) {
            const stone = isMax ? color : opp;
            board[r][c] = stone;
            const newHash    = (hash ^ ZOBRIST[r][c][stone - 1]) >>> 0;
            const nextWinner = checkWin(board, r, c, stone) ? stone : winner;
            const child = minimax(board, depth - 1, alpha, beta, !isMax, color, nextWinner, newHash);
            board[r][c] = EMPTY;

            if (isMax) { if (child > v) v = child; if (v > alpha) alpha = v; }
            else        { if (child < v) v = child; if (v < beta)  beta  = v; }
            if (beta <= alpha) break;
        }

        // ── 存入置换表 ────────────────────────────────────────────────────
        if (transTable.size >= TT_MAX_SIZE) transTable.clear();
        const flag = v <= origAlpha ? TT_UPPER : (v >= beta ? TT_LOWER : TT_EXACT);
        transTable.set(hash, { score: v, depth, flag });

        return v;
    }

    // ── AI 难度实现 ────────────────────────────────────────────────────────────

    function aiEasy(board, aiColor) {
        const oppColor = aiColor === BLACK ? WHITE : BLACK;
        const cells = getCandidateCells(board, 2);
        if (cells.length === 0) return getEmptyCells(board)[0] || null;

        // 1. 立即赢棋（原来缺失，补上）
        for (const { r, c } of cells) if (wouldWin(board, r, c, aiColor)) return { r, c };
        // 2. 阻止对手立即赢棋
        for (const { r, c } of cells) if (wouldWin(board, r, c, oppColor)) return { r, c };

        // 辅助：从候选集合中选局部评分最高的格子
        function pickBest(subset) {
            let best = subset[0], bestS = -Infinity;
            for (const cell of subset) {
                board[cell.r][cell.c] = aiColor;
                const s = quickEvalAround(board, cell.r, cell.c, aiColor) + positionScore(cell.r, cell.c);
                board[cell.r][cell.c] = EMPTY;
                if (s > bestS) { bestS = s; best = cell; }
            }
            return best;
        }

        // 3. 阻止对手活四
        const blockOpenFour = cells.filter(({ r, c }) => wouldOpenN(board, r, c, oppColor, 4));
        if (blockOpenFour.length > 0) return pickBest(blockOpenFour);

        // 4. 阻止对手活三
        const blockOpenThree = cells.filter(({ r, c }) => wouldOpenN(board, r, c, oppColor, 3));
        if (blockOpenThree.length > 0) return pickBest(blockOpenThree);

        // 5. 贪心：选局部评分最高
        return pickBest(cells);
    }

    function aiMedium(board, aiColor) {
        const oppColor = aiColor === BLACK ? WHITE : BLACK;
        const cells = getCandidateCells(board, 2);
        if (cells.length === 0) return getEmptyCells(board)[0] || null;

        for (const { r, c } of cells) if (wouldWin(board, r, c, aiColor)) return { r, c };
        for (const { r, c } of cells) if (wouldWin(board, r, c, oppColor)) return { r, c };

        const hash0 = computeHash(board);
        transTable.clear();

        // 阻止对手活四：对每个候选位置跑 minimax(3)，共享根节点 alpha
        const blockOpenFour = cells.filter(({ r, c }) => wouldOpenN(board, r, c, oppColor, 4));
        if (blockOpenFour.length > 0) {
            let best = blockOpenFour[0], bestScore = -Infinity, alpha = -Infinity;
            for (const cell of blockOpenFour) {
                board[cell.r][cell.c] = aiColor;
                const score = minimax(board, 3, alpha, Infinity, false, aiColor, null,
                    (hash0 ^ ZOBRIST[cell.r][cell.c][aiColor - 1]) >>> 0);
                board[cell.r][cell.c] = EMPTY;
                if (score > bestScore) { bestScore = score; best = cell; alpha = bestScore; }
            }
            return best;
        }

        // 预筛：用局部评分选 top-22 候选，然后跑 minimax(3)
        // 根节点 alpha 在循环间累积，使后续候选点能被剪枝
        const scored = cells.map(({ r, c }) => {
            board[r][c] = aiColor;
            const s = checkWin(board, r, c, aiColor)
                ? 500000
                : (quickEvalAround(board, r, c, aiColor) + positionScore(r, c));
            board[r][c] = EMPTY;
            return { r, c, s };
        });
        scored.sort((a, b) => b.s - a.s);
        const top = scored.slice(0, 22);

        let best = null, bestScore = -Infinity, alpha = -Infinity;
        for (const { r, c } of top) {
            board[r][c] = aiColor;
            if (checkWin(board, r, c, aiColor)) { board[r][c] = EMPTY; return { r, c }; }
            const score = minimax(board, 3, alpha, Infinity, false, aiColor, null,
                (hash0 ^ ZOBRIST[r][c][aiColor - 1]) >>> 0);
            board[r][c] = EMPTY;
            if (score > bestScore) { bestScore = score; best = { r, c }; alpha = bestScore; }
        }
        return best || top[0] || cells[0];
    }

    function aiHard(board, aiColor) {
        // 空棋盘直接占中心
        if (!board.some(row => row.some(v => v !== EMPTY))) {
            return { r: Math.floor(BOARD_SIZE / 2), c: Math.floor(BOARD_SIZE / 2) };
        }

        const oppColor = aiColor === BLACK ? WHITE : BLACK;
        const cells = getCandidateCells(board, 1);
        if (cells.length === 0) return getEmptyCells(board)[0] || null;

        for (const { r, c } of cells) if (wouldWin(board, r, c, aiColor)) return { r, c };
        for (const { r, c } of cells) if (wouldWin(board, r, c, oppColor)) return { r, c };

        // 预筛 top-15 候选（局部评分排序，比原来的全棋盘扫描快）
        const top = getTopCandidates(board, aiColor, 15);
        const hash0 = computeHash(board);
        transTable.clear();

        // ── 迭代加深：从 depth=2 增到 depth=8，超时即停 ───────────────────
        const TIME_LIMIT_MS = 1500;
        const startTime = Date.now();
        let best = top[0];

        for (let depth = 2; depth <= 8; depth += 2) {
            if (Date.now() - startTime >= TIME_LIMIT_MS) break;

            let iterBest = null, iterBestScore = -Infinity, alpha = -Infinity;
            for (const { r, c } of top) {
                if (Date.now() - startTime >= TIME_LIMIT_MS) break;
                board[r][c] = aiColor;
                const score = minimax(board, depth - 1, alpha, Infinity, false, aiColor, null,
                    (hash0 ^ ZOBRIST[r][c][aiColor - 1]) >>> 0);
                board[r][c] = EMPTY;
                if (score > iterBestScore) {
                    iterBestScore = score;
                    iterBest = { r, c };
                    alpha = iterBestScore;  // 根节点 alpha 累积
                }
                // 已找到必胜手，无需继续
                if (iterBestScore >= 400000) break;
            }
            if (iterBest) best = iterBest;
            if (iterBestScore >= 400000) break;
        }
        return best || top[0] || cells[0];
    }

    // ── 公共入口 ──────────────────────────────────────────────────────────────

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
            if (difficulty === 'easy')        move = aiEasy(b, aiColor);
            else if (difficulty === 'medium') move = aiMedium(b, aiColor);
            else                              move = aiHard(b, aiColor);
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
