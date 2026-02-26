/**
 * 五子棋 AI Web Worker - 后台线程执行 AI 计算，不阻塞主线程
 * 核心逻辑在 gomoku-core.js，通过 importScripts 加载
 */
importScripts('gomoku-core.js');

const CORE = self.GOMOKU_CORE;

self.onmessage = function (e) {
    const { board, difficulty, aiColor, taskId } = e.data;
    try {
        const move = CORE.getAIMove(board, difficulty, aiColor);
        self.postMessage({ taskId, move, error: false });
    } catch (err) {
        const fallback = CORE.getFallbackMove(board);
        self.postMessage({ taskId, move: fallback, error: true });
    }
};
