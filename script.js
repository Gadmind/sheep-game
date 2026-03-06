/**
 * 《羊了个羊》完整实现
 * 核心功能：多层卡片堆叠、三消匹配、道具系统、游戏状态管理
 * 优化版本：性能优化、本地存储、难度选择、更好的用户体验
 */

// 游戏配置
const CONFIG = {
    // 基础配置
    layers: 4,           // 层数
    rows: 9,             // 每层行数（9行布局）
    cols: 7,             // 每层列数（7列布局）
    cardTypes: 16,        // 卡片类型数量
    cardsPerType: 12,    // 每种类型的卡片数量
    maxSlot: 7,          // 卡槽最大容量

    // 难度调节：修改 difficulty 后，新游戏会使用对应难度（layers/rows/cols/cardTypes/maxSlot 等）
    difficulty: 'easy', // easy, normal, hard, debug（默认选中简单模式）
    difficulties: {
        debug: {
            layers: 2,
            rows: 2,
            cols: 2,
            cardTypes: 3,
            cardsPerType: 6,
            maxSlot: 7
        },
        easy: {
            layers: 3,
            rows: 3,             // 每层行数（9行布局）
            cols: 3,             // 每层列数（7列布局）
            cardTypes: 3,        // 卡片类型数量
            cardsPerType: 9,    // 每种类型的卡片数量
            maxSlot: 7        // 卡槽最大容量
        },
        normal: {
            layers: 4,
            rows: 9,             // 每层行数（9行布局）
            cols: 7,             // 每层列数（7列布局）
            cardTypes: 16,        // 卡片类型数量
            cardsPerType: 15,    // 每种类型的卡片数量
            maxSlot: 7          // 卡槽最大容量
        },
        hard: {
            layers: 5,
            rows: 9,             // 每层行数（9行布局）
            cols: 7,             // 每层列数（7列布局）
            cardTypes: 16,        // 卡片类型数量
            cardsPerType: 24,    // 每种类型的卡片数量
            maxSlot: 7         // 卡槽最大容量
        }
    },

    // 堆叠布局：true = 左右对称布局，false = 原随机金字塔
    symmetricLayout: true,

    // 游戏参数
    initialTools: {
        remove: 3,
        undo: 3,
        shuffle: 1,
        hint: 3
    },

    // 动画配置
    animationDuration: 300,
    matchAnimationDuration: 600,
    // 胜利庆祝文案（用于动态生成爱心 / 文字形状）
    celebrationText: '❤',

        // 本地存储键名
    storageKeys: {
        highScore: 'sheep_game_high_score',
        settings: 'sheep_game_settings',
        stats: 'sheep_game_stats'
    }
};

/**
 * 根据当前难度返回合并后的有效配置（CONFIG + CONFIG.difficulties[difficulty]）
 * 难度来源：this.settings.difficulty ?? CONFIG.difficulty
 * @param {Object} settings - 当前设置（含 difficulty）
 * @returns {Object} 合并后的配置
 */
function getEffectiveConfig(settings) {
    const difficulty = (settings && settings.difficulty) || CONFIG.difficulty;
    const diffConfig = CONFIG.difficulties && CONFIG.difficulties[difficulty];
    if (!diffConfig) {
        return { ...CONFIG };
    }
    return { ...CONFIG, ...diffConfig };
}

/**
 * 根据当前日期（及可选难度）生成整数 seed（同一天同一难度下布局固定）
 * @param {string} [difficulty] - 难度标识，传入则同一天不同难度不同布局
 * @returns {number}
 */
function getDateSeed(difficulty) {
    const d = new Date();
    const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` + (difficulty ? `-${difficulty}` : '');
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (h * 31 + str.charCodeAt(i)) >>> 0;
    }
    return h || 1;
}

/**
 * 可复现随机数生成器（mulberry32），相同 seed 得到相同序列
 * @param {number} seed
 * @returns {function(): number} 返回 [0, 1) 的随机数
 */
function createSeededRandom(seed) {
    return function () {
        let t = (seed += 0x6D2B79F5) | 0;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// 卡片颜色映射（用于替代图片）- 16 种明显区分的颜色
const CARD_COLORS = [
    '#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0',
    '#118AB2', '#EF476F', '#9D4EDD', '#FF9F1C',
    '#2A9D8F', '#E76F51', '#264653', '#E9C46A',
    '#8D99AE', '#F4A261', '#5E60CE', '#06AED5'
];

// 卡片符号映射 - 16 种彼此不相似的图标
// 尽量避免形态/语义过于接近（比如多个星星或多个天气符号）
const CARD_SYMBOLS = [
    '🐑', // 羊
    '🦊', // 狐狸
    '🐼', // 熊猫
    '🦄', // 独角兽
    '🍎', // 苹果
    '🍋', // 柠檬
    '🍉', // 西瓜
    '🥕', // 胡萝卜
    '⚽', // 足球
    '🎲', // 骰子
    '🎧', // 耳机
    '📚', // 书本
    '🎈', // 气球
    '🧩', // 拼图
    '🔑', // 钥匙
    '💎'  // 宝石
];

// ==================== 工具类：本地存储管理 ====================
class StorageManager {
    static save(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('存储失败:', error);
            return false;
        }
    }

    static load(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('读取失败:', error);
            return defaultValue;
        }
    }

    static remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('删除失败:', error);
            return false;
        }
    }

    static clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('清空失败:', error);
            return false;
        }
    }
}

// ==================== 工具类：性能优化 ====================
class PerformanceHelper {
    /**
     * 防抖函数
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * 节流函数
     */
    static throttle(func, limit) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * 批量创建DOM元素
     */
    static createElements(count, creator) {
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < count; i++) {
            fragment.appendChild(creator(i));
        }
        return fragment;
    }
}

// ==================== 空间索引类：优化卡片查询性能 ====================
/**
 * 网格空间索引
 * 将卡片按网格位置索引，快速查询指定位置的卡片
 */
class GridIndex {
    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        // 使用 Map 存储：key 为 "row,col"，value 为卡片数组（按层排序）
        this.grid = new Map();
    }

    /**
     * 获取网格键（将浮点数位置转换为整数网格坐标）
     */
    getGridKey(row, col) {
        // 将浮点数位置转换为整数网格坐标
        // 例如：1.5 -> 1, 2.3 -> 2
        const gridRow = Math.floor(row);
        const gridCol = Math.floor(col);
        return `${gridRow},${gridCol}`;
    }

    /**
     * 获取卡片可能占据的所有网格位置
     * 一张卡片可能占据多个网格（如果它跨越网格边界）
     */
    getCardGridKeys(card) {
        const keys = new Set();
        const row = card.row;
        const col = card.col;

        // 卡片占据的网格范围（考虑0.5偏移）
        const minRow = Math.floor(row);
        const maxRow = Math.floor(row + 1);
        const minCol = Math.floor(col);
        const maxCol = Math.floor(col + 1);

        // 添加所有可能占据的网格
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
                    keys.add(`${r},${c}`);
                }
            }
        }

        return Array.from(keys);
    }

    /**
     * 添加卡片到索引
     */
    addCard(card) {
        const keys = this.getCardGridKeys(card);
        keys.forEach(key => {
            if (!this.grid.has(key)) {
                this.grid.set(key, []);
            }
            const cards = this.grid.get(key);
            cards.push(card);
            // 按层排序，上层卡片在前
            cards.sort((a, b) => b.layer - a.layer);
        });
    }

    /**
     * 从索引中移除卡片
     */
    removeCard(card) {
        const keys = this.getCardGridKeys(card);
        keys.forEach(key => {
            const cards = this.grid.get(key);
            if (cards) {
                const index = cards.indexOf(card);
                if (index !== -1) {
                    cards.splice(index, 1);
                }
            }
        });
    }

    /**
     * 更新卡片在索引中的位置（当卡片位置改变时）
     */
    updateCard(card, oldRow, oldCol) {
        // 先移除旧位置
        const oldKeys = this.getCardGridKeys({ row: oldRow, col: oldCol });
        oldKeys.forEach(key => {
            const cards = this.grid.get(key);
            if (cards) {
                const index = cards.indexOf(card);
                if (index !== -1) {
                    cards.splice(index, 1);
                }
            }
        });

        // 再添加到新位置
        this.addCard(card);
    }

    /**
     * 获取指定位置的最上层卡片
     * @param {number} row - 行坐标
     * @param {number} col - 列坐标
     * @returns {Object|null} 最上层的卡片，如果没有则返回null
     */
    getTopCardAt(row, col) {
        const key = this.getGridKey(row, col);
        const cards = this.grid.get(key);

        if (!cards || cards.length === 0) {
            return null;
        }

        // 返回最上层（layer最大）且未移除的卡片
        for (const card of cards) {
            if (!card.removed) {
                return card;
            }
        }

        return null;
    }

    /**
     * 获取指定位置的所有卡片（按层从高到低排序）
     */
    getCardsAt(row, col) {
        const key = this.getGridKey(row, col);
        return this.grid.get(key) || [];
    }

    /**
     * 检查指定位置是否有卡片
     */
    hasCardAt(row, col) {
        const key = this.getGridKey(row, col);
        const cards = this.grid.get(key);
        return cards && cards.length > 0 && cards.some(c => !c.removed);
    }

    /**
     * 清空索引
     */
    clear() {
        this.grid.clear();
    }

    /**
     * 重建索引（当所有卡片位置改变时）
     */
    rebuild(cards) {
        this.clear();
        cards.forEach(card => {
            if (card && !card.removed) {
                this.addCard(card);
            }
        });
    }
}

// ==================== 可见区域掩码系统 ====================
/**
 * 可见区域掩码计算器
 * 计算每张卡片被上层遮挡后的实际可见区域
 */
class VisibilityMask {
    /**
     * 计算卡片的可见区域（矩形区域列表）
     * @param {Object} card - 要计算的卡片
     * @param {Array} allCards - 所有卡片数组
     * @param {GridIndex} gridIndex - 空间索引
     * @returns {Array} 可见区域列表，每个区域为 {x, y, width, height}
     */
    static calculateVisibleRegions(card, allCards, gridIndex) {
        if (!card || card.removed) return [];

        // 卡片的基础区域（归一化到0-1坐标系）
        const cardRegion = {
            x: card.col,
            y: card.row,
            width: 1,
            height: 1
        };

        // 获取所有可能遮挡当前卡片的上层卡片
        const occluders = this.getOccludingCards(card, allCards, gridIndex);

        // 如果没有遮挡，整个卡片都可见
        if (occluders.length === 0) {
            return [cardRegion];
        }

        // 计算被遮挡后的可见区域
        let visibleRegions = [cardRegion];

        // 逐个减去遮挡区域
        for (const occluder of occluders) {
            const occluderRegion = {
                x: occluder.col,
                y: occluder.row,
                width: 1,
                height: 1
            };

            visibleRegions = this.subtractRegions(visibleRegions, occluderRegion);

            // 如果已经没有可见区域，提前退出
            if (visibleRegions.length === 0) {
                break;
            }
        }

        return visibleRegions;
    }

    /**
     * 获取遮挡指定卡片的上层卡片
     */
    static getOccludingCards(card, allCards, gridIndex) {
        const occluders = [];
        const gridKeys = gridIndex.getCardGridKeys(card);

        // 收集所有可能遮挡的上层卡片
        const candidateCards = new Set();
        gridKeys.forEach(key => {
            const [row, col] = key.split(',').map(Number);
            const cardsAtPos = gridIndex.getCardsAt(row, col);
            cardsAtPos.forEach(c => {
                if (c && !c.removed && c.layer > card.layer) {
                    candidateCards.add(c);
                }
            });
        });

        // 检查每个候选卡片是否真的遮挡
        candidateCards.forEach(upperCard => {
            if (this.regionsOverlap(
                { x: card.col, y: card.row, width: 1, height: 1 },
                { x: upperCard.col, y: upperCard.row, width: 1, height: 1 }
            )) {
                occluders.push(upperCard);
            }
        });

        // 按层排序，从高到低
        occluders.sort((a, b) => b.layer - a.layer);
        return occluders;
    }

    /**
     * 检查两个区域是否重叠
     */
    static regionsOverlap(region1, region2) {
        return !(
            region1.x + region1.width <= region2.x ||
            region2.x + region2.width <= region1.x ||
            region1.y + region1.height <= region2.y ||
            region2.y + region2.height <= region1.y
        );
    }

    /**
     * 从区域列表中减去一个区域
     * 返回剩余的可视区域列表
     */
    static subtractRegions(regions, subtractRegion) {
        const result = [];

        for (const region of regions) {
            // 如果区域不重叠，直接保留
            if (!this.regionsOverlap(region, subtractRegion)) {
                result.push(region);
                continue;
            }

            // 计算重叠部分
            const overlapX = Math.max(region.x, subtractRegion.x);
            const overlapY = Math.max(region.y, subtractRegion.y);
            const overlapRight = Math.min(region.x + region.width, subtractRegion.x + subtractRegion.width);
            const overlapBottom = Math.min(region.y + region.height, subtractRegion.y + subtractRegion.height);

            // 如果完全被遮挡，跳过
            if (overlapX >= region.x && overlapY >= region.y &&
                overlapRight <= region.x + region.width &&
                overlapBottom <= region.y + region.height &&
                overlapRight - overlapX === region.width &&
                overlapBottom - overlapY === region.height) {
                continue; // 完全被遮挡
            }

            // 计算剩余区域（可能产生多个矩形）
            // 上方区域
            if (region.y < overlapY) {
                result.push({
                    x: region.x,
                    y: region.y,
                    width: region.width,
                    height: overlapY - region.y
                });
            }

            // 下方区域
            if (region.y + region.height > overlapBottom) {
                result.push({
                    x: region.x,
                    y: overlapBottom,
                    width: region.width,
                    height: (region.y + region.height) - overlapBottom
                });
            }

            // 左侧区域
            if (region.x < overlapX) {
                result.push({
                    x: region.x,
                    y: Math.max(region.y, overlapY),
                    width: overlapX - region.x,
                    height: Math.min(region.y + region.height, overlapBottom) - Math.max(region.y, overlapY)
                });
            }

            // 右侧区域
            if (region.x + region.width > overlapRight) {
                result.push({
                    x: overlapRight,
                    y: Math.max(region.y, overlapY),
                    width: (region.x + region.width) - overlapRight,
                    height: Math.min(region.y + region.height, overlapBottom) - Math.max(region.y, overlapY)
                });
            }
        }

        return result;
    }

    /**
     * 检查点是否在可见区域内
     * @param {number} x - 点的x坐标（归一化）
     * @param {number} y - 点的y坐标（归一化）
     * @param {Array} visibleRegions - 可见区域列表
     * @returns {boolean} 点是否在可见区域内
     */
    static isPointInVisibleRegions(x, y, visibleRegions) {
        for (const region of visibleRegions) {
            if (x >= region.x && x < region.x + region.width &&
                y >= region.y && y < region.y + region.height) {
                return true;
            }
        }
        return false;
    }

    /**
     * 计算可见区域的面积比例
     */
    static getVisibleAreaRatio(visibleRegions) {
        if (visibleRegions.length === 0) return 0;

        let totalArea = 0;
        visibleRegions.forEach(region => {
            totalArea += region.width * region.height;
        });

        return totalArea; // 归一化后，完整卡片面积为1
    }
}

// 游戏主类
class SheepGame {
    constructor() {
        // 游戏状态
        this.state = {
            deck: [],              // 牌堆三维数组
            visibleCards: [],      // 当前可见的卡片
            selectedCards: [],     // 已选中的卡片（在槽位中）
            moves: [],             // 操作历史（用于撤销）
            score: 0,              // 分数
            moveCount: 0,          // 步数
            startTime: null,       // 游戏开始时间
            gameOver: false,       // 游戏是否结束
            victory: false,        // 是否胜利
            tools: { ...CONFIG.initialTools } // 道具数量
        };

        // 加载游戏数据（先加载，以便 getEffectiveConfig 使用 this.settings.difficulty）
        this.highScore = StorageManager.load(CONFIG.storageKeys.highScore, 0);
        this.settings = StorageManager.load(CONFIG.storageKeys.settings, {
            soundEnabled: true,
            difficulty: CONFIG.difficulty,
            celebrationText: CONFIG.celebrationText || '❤'
        });
        this.stats = StorageManager.load(CONFIG.storageKeys.stats, {
            gamesPlayed: 0,
            gamesWon: 0,
            totalScore: 0
        });

        // 音效状态
        this.soundEnabled = this.settings.soundEnabled;

        /** @type {number|null} 庆祝动效的 requestAnimationFrame ID，用于再玩一局时取消上一次动效 */
        this._celebrationAnimationId = null;

        // 初始化
        this.init();
        this.bindEvents();
        this.updateHighScoreDisplay();
    }

    /**
     * 更新最高分显示
     */
    updateHighScoreDisplay() {
        const highScoreEl = document.getElementById('high-score');
        if (highScoreEl) {
            highScoreEl.textContent = this.highScore;

            // 如果当前分数超过最高分，添加高亮效果
            if (this.state.score > this.highScore) {
                highScoreEl.style.animation = 'bounce 0.5s';
                setTimeout(() => {
                    highScoreEl.style.animation = '';
                }, 500);
            }
        }
    }

    /**
     * 更新难度选择按钮的选中状态
     */
    updateDifficultyButtons() {
        const current = (this.settings && this.settings.difficulty) || CONFIG.difficulty;
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            const key = btn.getAttribute('data-difficulty');
            btn.classList.toggle('active', key === current);
        });
    }

    /**
     * 保存最高分
     */
    saveHighScore() {
        if (this.state.score > this.highScore) {
            this.highScore = this.state.score;
            StorageManager.save(CONFIG.storageKeys.highScore, this.highScore);
            this.updateHighScoreDisplay();
            return true;
        }
        return false;
    }

    /**
     * 更新统计数据
     */
    updateStats(isVictory) {
        this.stats.gamesPlayed++;
        if (isVictory) {
            this.stats.gamesWon++;
        }
        this.stats.totalScore += this.state.score;
        StorageManager.save(CONFIG.storageKeys.stats, this.stats);
    }

    /**
     * 保存设置
     */
    saveSettings() {
        this.settings.soundEnabled = this.soundEnabled;
        // 不覆盖 difficulty，保留用户/默认选择；仅缺省时用 CONFIG.difficulty
        if (this.settings.difficulty == null || this.settings.difficulty === '') {
            this.settings.difficulty = CONFIG.difficulty;
        }
        // 胜利庆祝文案也写回设置（如果未设置则用默认）
        if (!this.settings.celebrationText) {
            this.settings.celebrationText = CONFIG.celebrationText || '❤';
        }
        StorageManager.save(CONFIG.storageKeys.settings, this.settings);
    }

    // 初始化游戏
    init() {
        // 若上次庆祝动效仍在运行，取消并隐藏画布，避免第二次胜利时弹框不出现
        if (this._celebrationAnimationId != null) {
            cancelAnimationFrame(this._celebrationAnimationId);
            this._celebrationAnimationId = null;
        }
        const celebrationCanvas = document.getElementById('celebration-canvas');
        if (celebrationCanvas) celebrationCanvas.classList.remove('active');

        // 当前难度的有效配置（CONFIG + difficulties[difficulty]）
        this._effectiveConfig = getEffectiveConfig(this.settings);
        this.gridIndex = new GridIndex(this._effectiveConfig.rows, this._effectiveConfig.cols);

        // 重置游戏状态
        this.state = {
            deck: [],
            visibleCards: [],
            selectedCards: [],
            removedCards: [],      // 移出区域的卡片
            moves: [],
            score: 0,
            moveCount: 0,
            startTime: new Date(),
            gameOver: false,
            victory: false,
            tools: { ...CONFIG.initialTools }
        };

        // 生成牌堆
        this.generateDeck();

        // 构建空间索引
        this.gridIndex.rebuild(this.state.deck);

        // 计算可见卡片
        this.updateVisibleCards();

        // 渲染界面
        this.render();

        // 更新UI
        this.updateUI();

        // 显示欢迎消息
        this.showMessage('游戏开始！消除所有卡片即可获胜', 'success');
    }

    // 生成牌堆（金字塔式堆叠算法）
    generateDeck() {
        const cfg = this._effectiveConfig || getEffectiveConfig(this.settings);
        const { layers, rows, cols, cardTypes } = cfg;

        // 以当日日期 + 难度为 seed，同一天同一难度下布局固定
        const difficulty = (this.settings && this.settings.difficulty) || CONFIG.difficulty;
        this._deckRandom = createSeededRandom(getDateSeed(difficulty));

        // 1. 初始化卡片数组（不再使用三维数组，改用一维数组存储）
        this.state.deck = [];

        // 2. 生成金字塔式位置（支持半格偏移）；可选对称布局
        const useSymmetric = (this.settings && this.settings.symmetricLayout !== undefined)
            ? this.settings.symmetricLayout
            : CONFIG.symmetricLayout;
        const allPositions = useSymmetric
            ? this.generateSymmetricPyramidPositions(layers, rows, cols)
            : this.generatePyramidPositions(layers, rows, cols);
        const maxPositions = allPositions.length;

        // 布局已由日期 seed 固定；牌型顺序用 Math.random，每次开局不同
        this._deckRandom = null;

        // 3. 计算目标卡片总数：
        //    - 在 210 到 240 之间
        //    - 不能超过可用位置数
        //    - 必须是 3 的倍数（方便三消）
        const MIN_TOTAL_CARDS = 210;
        const MAX_TOTAL_CARDS = 240;

        let targetTotal = Math.min(MAX_TOTAL_CARDS, maxPositions);
        // 向下取到最近的 3 的倍数
        targetTotal -= (targetTotal % 3);

        if (targetTotal < MIN_TOTAL_CARDS) {
            console.warn(
                '[SheepGame] 可用位置不足以满足 210~240 张卡片的要求，' +
                `当前可用位置=${maxPositions}，实际生成卡片数=${targetTotal}（仍保证为 3 的倍数）`
            );
        }

        // 4. 根据目标总数为每种类型分配卡片数量（每种类型也是 3 的倍数）
        const totalTriplets = Math.floor(targetTotal / 3);
        const baseTripletsPerType = Math.floor(totalTriplets / cardTypes);
        let remainingTriplets = totalTriplets - baseTripletsPerType * cardTypes;

        const allCards = [];
        for (let type = 0; type < cardTypes; type++) {
            // 均匀分配 triplet，余数前几种类型多 1 个 triplet
            let triplets = baseTripletsPerType;
            if (remainingTriplets > 0) {
                triplets++;
                remainingTriplets--;
            }
            const countForType = triplets * 3;
            for (let i = 0; i < countForType; i++) {
                allCards.push(type);
            }
        }

        // 安全检查：如果因为整数分配产生误差，这里再裁剪到目标总数
        if (allCards.length > targetTotal) {
            allCards.length = targetTotal;
        }

        // 5. 洗牌
        this.shuffleArray(allCards);

        // 6. 放置卡片（不超过可用位置数）
        const cardsToPlace = Math.min(allCards.length, maxPositions);
        for (let i = 0; i < cardsToPlace; i++) {
            const [layer, row, col] = allPositions[i];

            // 创建卡片对象（添加三维坐标）
            const card = {
                id: `card-${i}`,
                type: allCards[i],
                layer: layer,     // z坐标（层数）
                row: row,         // y坐标（可以是小数，支持0.5偏移）
                col: col,         // x坐标（可以是小数，支持0.5偏移）
                // 三维坐标（用于空间索引和堆叠计算）
                x: col,          // 列坐标（x轴）
                y: row,          // 行坐标（y轴）
                z: layer,        // 层坐标（z轴，深度）
                visible: false,
                removed: false,
                zIndex: layer * 1000 + i
            };

            this.state.deck.push(card);
        }

        // 7. 构建空间索引
        this.gridIndex.rebuild(this.state.deck);

        // 8. 验证可解性（这里通常是通过的，因为每种类型都是 3 的倍数）
        this.validateDeckSolvability();

        // 调试输出：查看实际卡片总数
        console.log(
            `[SheepGame] 本局生成卡片总数=${this.state.deck.length}（` +
            `范围期望：${MIN_TOTAL_CARDS}~${MAX_TOTAL_CARDS}，` +
            `是否为 3 的倍数=${this.state.deck.length % 3 === 0}）`
        );
    }

    /**
     * 生成金字塔式位置
     * 上层卡片可以偏移0.5格，压在多张下层卡片上
     * 
     * 金字塔效果说明：
     * - 底层(layer 0)：完全对齐网格 (0, 0), (0, 1), (0, 2)...
     * - 上层(layer 1+)：50%概率偏移0.5格 (0.5, 0.5), (1.5, 2.5)...
     * - 偏移的卡片会压在多张下层卡片的交界处
     * - 例如：位置(1.5, 1.5)的卡片会同时压住(1,1), (1,2), (2,1), (2,2)
     */
    generatePyramidPositions(layers, rows, cols) {
        const positions = [];
        const occupied = new Set();

        for (let layer = 0; layer < layers; layer++) {
            const layerDensity = 0.6;
            const cardsInLayer = Math.floor(rows * cols * layerDensity);

            // 上层使用偏移位置（金字塔效果）；使用日期 seed 时布局固定
            const rnd = this._deckRandom || Math.random;
            const useOffset = layer > 0 && rnd() > 0.5;
            const offset = useOffset ? 0.5 : 0;

            for (let i = 0; i < cardsInLayer; i++) {
                // 随机生成位置（可以有0.5偏移）
                // 例如：row=1.5 表示在第1格和第2格之间
                const row = Math.floor(rnd() * (rows - 1)) + offset;
                const col = Math.floor(rnd() * (cols - 1)) + offset;

                const key = `${layer},${row},${col}`;
                if (!occupied.has(key)) {
                    occupied.add(key);
                    positions.push([layer, row, col]);
                }
            }
        }

        return positions;
    }

    /**
     * 生成对称的金字塔式位置（左右轴对称）
     * - 每层只从「左半区」采样位置，再镜像到右半区，保证左右对称
     * - 密度与金字塔 0.5 偏移逻辑与原方法一致，仅分布改为对称
     * - 扩展：若需上下也对称，可对 row 做同样镜像（四象限对称）
     */
    generateSymmetricPyramidPositions(layers, rows, cols) {
        const positions = [];
        const midCol = (cols - 1) / 2;

        const rnd = this._deckRandom || Math.random;
        for (let layer = 0; layer < layers; layer++) {
            const layerDensity = 0.6;
            const cardsInLayer = Math.floor(rows * cols * layerDensity);
            const useOffset = layer > 0 && rnd() > 0.5;
            const offset = useOffset ? 0.5 : 0;

            // 左半区候选：(layer, row, col) 且 col <= midCol；行/列与金字塔一致支持 0.5 偏移
            const leftHalf = [];
            for (let r = 0; r < rows; r++) {
                const row = r + offset;
                if (row >= rows) continue; // 避免越界
                for (let colIndex = 0; colIndex <= midCol; colIndex++) {
                    const col = colIndex + offset;
                    if (col > midCol) continue;
                    leftHalf.push([layer, row, col]);
                }
            }

            this.shuffleArray(leftHalf);

            const layerPositions = [];
            for (const pos of leftHalf) {
                if (layerPositions.length >= cardsInLayer) break;
                const [l, row, col] = pos;
                const mirrorCol = cols - 1 - col;
                layerPositions.push([l, row, col]);
                if (col !== mirrorCol && layerPositions.length < cardsInLayer) {
                    layerPositions.push([l, row, mirrorCol]);
                }
            }
            // 严格每层 cardsInLayer 个（多则截断）
            positions.push(...layerPositions.slice(0, cardsInLayer));
        }

        return positions;
    }

    /**
     * 验证牌堆的可解性（适配一维数组）
     * 确保每种类型的卡片数量都是3的倍数
     */
    validateDeckSolvability() {
        const typeCounts = {};

        // 统计每种类型的卡片数量
        this.state.deck.forEach(card => {
            if (card) {
                typeCounts[card.type] = (typeCounts[card.type] || 0) + 1;
            }
        });

        // 检查是否所有类型都是3的倍数
        let isValid = true;
        for (const type in typeCounts) {
            if (typeCounts[type] % 3 !== 0) {
                console.warn(`卡片类型 ${type} 数量不是3的倍数: ${typeCounts[type]}`);
                isValid = false;
            }
        }

        // 如果不符合要求，调整卡片数量
        if (!isValid) {
            this.adjustDeckForSolvability(typeCounts);
        }

        return isValid;
    }

    /**
     * 调整牌堆以确保可解性（适配一维数组）
     * 移除多余的卡片使每种类型都是3的倍数
     */
    adjustDeckForSolvability(typeCounts) {
        console.log('正在调整牌堆以确保可解性...');

        for (const type in typeCounts) {
            const count = typeCounts[type];
            const remainder = count % 3;

            if (remainder !== 0) {
                const toRemove = remainder;
                let removed = 0;

                // 从数组中移除多余的卡片（从底层开始）
                for (let i = 0; i < this.state.deck.length && removed < toRemove; i++) {
                    const card = this.state.deck[i];
                    if (card && card.type === parseInt(type)) {
                        this.state.deck.splice(i, 1);
                        removed++;
                        i--; // 调整索引
                    }
                }
            }
        }

        console.log('牌堆调整完成，现在可以完全消除');
    }

    // 更新可见卡片（基于可见区域掩码）
    updateVisibleCards() {
        this.state.visibleCards = [];

        // 重置所有卡片的可见状态和可见区域
        this.state.deck.forEach(card => {
            if (card) {
                card.visible = false;
                card.visibleRegions = [];
                card.visibleAreaRatio = 0;
            }
        });

        // 计算每张卡片的可见区域
        this.state.deck.forEach(card => {
            if (!card || card.removed) return;

            // 计算可见区域掩码
            const visibleRegions = VisibilityMask.calculateVisibleRegions(
                card,
                this.state.deck,
                this.gridIndex
            );

            // 存储可见区域信息
            card.visibleRegions = visibleRegions;
            card.visibleAreaRatio = VisibilityMask.getVisibleAreaRatio(visibleRegions);

            // 如果有可见区域，标记为可见
            if (visibleRegions.length > 0 && card.visibleAreaRatio > 0) {
                card.visible = true;
                this.state.visibleCards.push(card);
            }
        });
    }

    /**
     * 检查卡片是否被上层卡片覆盖（使用空间索引优化）
     * 一张上层卡片如果与下层卡片有足够的重叠面积，就算覆盖
     */
    isCardCoveredByUpperCards(card) {
        // 使用空间索引：只检查卡片位置的最上层卡片
        const gridKeys = this.gridIndex.getCardGridKeys(card);

        for (const key of gridKeys) {
            const [row, col] = key.split(',').map(Number);
            const topCard = this.gridIndex.getTopCardAt(row, col);

            // 如果最上层卡片存在且层数大于当前卡片，说明被覆盖
            if (topCard && topCard.layer > card.layer) {
                // 检查是否真的覆盖（有重叠）
                if (this.checkCardsOverlap(card, topCard)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * 检查两张卡片是否重叠（金字塔式覆盖判定）
     * 
     * 覆盖规则：
     * - 使用中心点检测：下层卡片的中心点在上层卡片范围内
     * - 或重叠面积超过25%
     * 
     * 示例：
     * 上层卡片在(1.5, 1.5)，会覆盖：
     * - (1, 1) ✓ 中心(1.5, 1.5)在上层卡片内
     * - (1, 2) ✓ 中心(1.5, 2.5)在上层卡片内
     * - (2, 1) ✓ 中心(2.5, 1.5)在上层卡片内
     * - (2, 2) ✓ 中心(2.5, 2.5)在上层卡片内
     */
    checkCardsOverlap(lowerCard, upperCard) {
        // 计算下层卡片的中心点
        const lowerCenterRow = lowerCard.row + 0.5;
        const lowerCenterCol = lowerCard.col + 0.5;

        // 计算上层卡片的边界范围
        const upperLeft = upperCard.col;
        const upperRight = upperCard.col + 1;
        const upperTop = upperCard.row;
        const upperBottom = upperCard.row + 1;

        // 方法1：中心点检测（主要方法）
        // 如果下层卡片的中心点在上层卡片范围内，则被覆盖
        // 使用 >= 和 <= 让边界情况也算覆盖
        const centerInside =
            lowerCenterRow >= upperTop && lowerCenterRow <= upperBottom &&
            lowerCenterCol >= upperLeft && lowerCenterCol <= upperRight;

        if (centerInside) {
            return true;
        }

        // 方法2：面积重叠检测（辅助方法，处理边缘情况）
        // 降低阈值到25%，让金字塔效果更明显
        const OVERLAP_THRESHOLD = 0.25;

        // 计算下层卡片的边界
        const lowerLeft = lowerCard.col;
        const lowerRight = lowerCard.col + 1;
        const lowerTop = lowerCard.row;
        const lowerBottom = lowerCard.row + 1;

        // 计算重叠区域
        const overlapLeft = Math.max(lowerLeft, upperLeft);
        const overlapRight = Math.min(lowerRight, upperRight);
        const overlapTop = Math.max(lowerTop, upperTop);
        const overlapBottom = Math.min(lowerBottom, upperBottom);

        // 如果没有重叠
        if (overlapLeft >= overlapRight || overlapTop >= overlapBottom) {
            return false;
        }

        // 计算重叠面积
        const overlapWidth = overlapRight - overlapLeft;
        const overlapHeight = overlapBottom - overlapTop;
        const overlapArea = overlapWidth * overlapHeight;

        // 计算下层卡片面积
        const lowerArea = 1.0; // 1×1卡片

        // 如果重叠面积超过阈值，算作覆盖
        return overlapArea >= (lowerArea * OVERLAP_THRESHOLD);
    }

    /**
     * 查找卡片在卡槽中的最佳插入位置
     * 相同类型的卡片会聚集在一起
     * @param {Object} card - 要插入的卡片
     * @returns {number} 插入位置的索引
     */
    findInsertPosition(card) {
        const selectedCards = this.state.selectedCards;

        // 如果卡槽为空，插入到位置0
        if (selectedCards.length === 0) {
            return 0;
        }

        // 查找最后一个相同类型卡片的位置
        let lastSameTypeIndex = -1;
        for (let i = selectedCards.length - 1; i >= 0; i--) {
            if (selectedCards[i].type === card.type) {
                lastSameTypeIndex = i;
                break;
            }
        }

        // 如果找到相同类型的卡片，插入到它后面
        if (lastSameTypeIndex !== -1) {
            return lastSameTypeIndex + 1;
        }

        // 如果没有相同类型的卡片，追加到最后
        return selectedCards.length;
    }

    // 处理卡片点击（基于可见区域检测）
    handleCardClick(cardId, clickX = null, clickY = null) {
        if (this.state.gameOver) return;

        const maxSlot = (this._effectiveConfig || getEffectiveConfig(this.settings)).maxSlot;
        if (this.state.selectedCards.length >= maxSlot) return; // 卡槽已满，不再选牌

        // 查找卡片
        const card = this.findCardById(cardId);
        if (!card || card.removed) return;

        // 如果没有可见区域，不允许点击
        if (!card.visibleRegions || card.visibleRegions.length === 0) {
            return;
        }

        // 如果提供了点击坐标，检查是否在可见区域内
        if (clickX !== null && clickY !== null) {
            // 获取布局参数
            const layout = this.calculateCardLayout();
            const cardEl = document.querySelector(`[data-id="${cardId}"]`);
            if (!cardEl) return;

            // 计算点击位置相对于卡片的归一化坐标
            const rect = cardEl.getBoundingClientRect();
            const relativeX = (clickX - rect.left) / rect.width;
            const relativeY = (clickY - rect.top) / rect.height;

            // 转换为网格坐标（归一化）
            const normalizedX = card.col + relativeX;
            const normalizedY = card.row + relativeY;

            // 检查是否在可见区域内
            if (!VisibilityMask.isPointInVisibleRegions(normalizedX, normalizedY, card.visibleRegions)) {
                return; // 点击位置不在可见区域，忽略
            }
        }

        // 检查是否完全可见：
        // 只有当可见面积比例接近1（这里要求>=0.99）时才允许点击，
        // 部分露出的卡片可以看到，但不能被选择点击
        if (card.visibleAreaRatio < 0.99) {
            return;
        }

        // 记录操作（用于撤销）
        this.state.moves.push({
            type: 'select',
            card: { ...card },
            selectedCards: [...this.state.selectedCards]
        });

        // 智能添加到已选择卡片：相同类型的卡片聚集在一起
        const insertIndex = this.findInsertPosition(card);
        this.state.selectedCards.splice(insertIndex, 0, card);
        card.removed = true;
        this.state.moveCount++;

        // 从空间索引中移除卡片
        this.gridIndex.removeCard(card);

        // 更新可见卡片（释放下层卡片）
        this.updateVisibleCards();

        // 检查匹配
        this.checkForMatches();

        // 检查游戏状态
        this.checkGameState();

        // 更新UI
        this.updateUI();
        this.renderCards();
        this.renderSlot();  // 重新渲染卡槽，显示新添加的卡片

        // 播放音效（模拟）
        this.playSound('click');
    }

    // 检查匹配（三消）
    checkForMatches() {
        // 按卡片类型分组
        const groups = {};
        this.state.selectedCards.forEach((card, index) => {
            if (!groups[card.type]) groups[card.type] = [];
            groups[card.type].push({ card, index });
        });

        // 检查是否有三张相同的
        for (const type in groups) {
            if (groups[type].length >= 3) {
                // 移除最早的三张
                const toRemove = groups[type].slice(0, 3);

                // 从后往前移除，避免索引问题
                toRemove.sort((a, b) => b.index - a.index).forEach(item => {
                    this.state.selectedCards.splice(item.index, 1);
                });

                // 加分
                this.state.score += 100;

                // 立即更新卡槽显示（提供即时反馈）
                this.renderSlot();
                this.updateUI();

                // 显示匹配效果
                this.showMessage(`消除成功！+100分`, 'success');

                // 播放匹配音效
                this.playSound('match');

                // 重新检查（可能有多组匹配）
                this.checkForMatches();
                return;
            }
        }
    }

    // 检查游戏状态（适配一维数组）
    checkGameState() {
        // 检查胜利：所有卡片都被移除且卡槽为空
        const allRemoved = this.state.deck.every(card => !card || card.removed);
        if (allRemoved && this.state.selectedCards.length === 0) {
            this.state.victory = true;
            this.state.gameOver = true;
            this.showGameOver(true);
            return;
        }

        // 检查失败：卡槽已满且没有可匹配的组合
        const maxSlot = (this._effectiveConfig || getEffectiveConfig(this.settings)).maxSlot;
        if (this.state.selectedCards.length >= maxSlot) {
            const canMatch = this.canMakeMatch();
            if (!canMatch) {
                this.state.gameOver = true;
                this.showGameOver(false);
            }
        }
    }

    // 检查是否可能组成三消
    canMakeMatch() {
        const groups = {};
        this.state.selectedCards.forEach(card => {
            groups[card.type] = (groups[card.type] || 0) + 1;
        });
        return Object.values(groups).some(count => count >= 3);
    }

    // 使用道具：移出（放入移出区域，支持叠加）
    useRemoveTool() {
        if (this.state.tools.remove <= 0 || this.state.gameOver) return;
        if (this.state.selectedCards.length < 3) {
            this.showMessage('至少需要3张卡片才能使用移出道具', 'warning');
            return;
        }

        // 记录操作
        this.state.moves.push({
            type: 'remove',
            cards: this.state.selectedCards.slice(0, 3),
            previousRemoved: [...this.state.removedCards]
        });

        // 移出前三张卡片到移出区域（支持叠加，不限制数量）
        const cardsToRemove = this.state.selectedCards.splice(0, 3);
        this.state.removedCards.push(...cardsToRemove);
        this.state.tools.remove--;

        // 更新UI
        this.updateUI();
        this.renderSlot();
        this.renderRemovedSlot();

        this.showMessage(`已将前三张卡片移出到移出区（共${this.state.removedCards.length}张）`, 'success');
        this.playSound('tool');
    }

    /**
     * 将移出区的卡片移回卡槽
     */
    restoreCardFromRemoved(cardIndex) {
        if (this.state.gameOver) return;

        // 检查索引有效性
        if (cardIndex < 0 || cardIndex >= this.state.removedCards.length) {
            return;
        }

        // 检查卡槽是否已满
        const maxSlot = (this._effectiveConfig || getEffectiveConfig(this.settings)).maxSlot;
        if (this.state.selectedCards.length >= maxSlot) {
            this.showMessage('卡槽已满，无法移回', 'warning');
            return;
        }

        // 获取要移回的卡片（深拷贝）
        const card = { ...this.state.removedCards[cardIndex] };

        // 记录操作（用于撤销）
        this.state.moves.push({
            type: 'restore',
            card: card,
            cardIndex: cardIndex,
            previousSelected: [...this.state.selectedCards]
        });

        // 从移出区移除
        this.state.removedCards.splice(cardIndex, 1);

        // 智能插入到卡槽（相同类型聚集）
        const insertIndex = this.findInsertPosition(card);
        this.state.selectedCards.splice(insertIndex, 0, card);

        // 检查匹配
        this.checkForMatches();

        // 检查游戏状态
        this.checkGameState();

        // 更新UI
        this.updateUI();
        this.renderSlot();
        this.renderRemovedSlot();

        this.showMessage('卡片已移回卡槽', 'success');
        this.playSound('click');
    }

    // 使用道具：撤销
    useUndoTool() {
        if (this.state.tools.undo <= 0 || this.state.moves.length === 0 || this.state.gameOver) return;

        const lastMove = this.state.moves.pop();

        if (lastMove.type === 'select') {
            // 恢复点击卡片的操作
            const card = this.findCardById(lastMove.card.id);
            if (card) {
                card.removed = false;
                // 重新添加到空间索引
                this.gridIndex.addCard(card);
            }
            this.state.selectedCards = lastMove.selectedCards;
            this.state.moveCount--;
        } else if (lastMove.type === 'remove') {
            // 恢复移出道具的操作
            this.state.selectedCards.unshift(...lastMove.cards);
            // 从移出区移除这些卡片
            this.state.removedCards = this.state.removedCards.filter(card =>
                !lastMove.cards.includes(card)
            );
        } else if (lastMove.type === 'restore') {
            // 恢复移回卡槽的操作
            // 从卡槽中移除（使用之前的卡槽状态）
            this.state.selectedCards = lastMove.previousSelected;
            // 移回移出区（插入到原来的位置）
            this.state.removedCards.splice(lastMove.cardIndex, 0, lastMove.card);
        } else if (lastMove.type === 'clear-removed') {
            // 恢复清空移出区的操作
            this.state.removedCards = [...lastMove.cards];
        }

        this.state.tools.undo--;
        // 重建空间索引（确保索引正确）
        this.gridIndex.rebuild(this.state.deck);
        this.updateVisibleCards();
        this.updateUI();
        this.renderCards();
        this.renderSlot();
        this.renderRemovedSlot();

        this.showMessage('已撤销上一步操作', 'success');
        this.playSound('tool');
    }

    // 使用道具：洗牌
    useShuffleTool() {
        if (this.state.tools.shuffle <= 0 || this.state.gameOver) return;

        // 获取所有可见卡片
        const visibleCards = this.state.visibleCards;
        if (visibleCards.length === 0) {
            this.showMessage('没有可洗牌的卡片', 'warning');
            return;
        }

        // 收集卡片类型
        const types = visibleCards.map(card => card.type);

        // 洗牌类型
        this.shuffleArray(types);

        // 重新分配类型
        visibleCards.forEach((card, index) => {
            card.type = types[index];
        });

        this.state.tools.shuffle--;
        this.updateUI();
        this.renderCards();

        this.showMessage('已重新排列可见卡片', 'success');
        this.playSound('shuffle');
    }

    // 使用道具：提示
    useHintTool() {
        if (this.state.tools.hint <= 0 || this.state.gameOver) return;

        // 找出可能匹配的卡片
        const hintCards = this.findHintCards();

        if (hintCards.length === 0) {
            this.showMessage('没有可提示的卡片', 'warning');
            return;
        }

        // 高亮显示提示卡片
        hintCards.forEach(card => {
            const element = document.querySelector(`[data-id="${card.id}"]`);
            if (element) {
                element.classList.add('hint');
                setTimeout(() => {
                    element.classList.remove('hint');
                }, 2000);
            }
        });

        this.state.tools.hint--;
        this.updateUI();

        this.showMessage('已高亮显示可消除卡片', 'success');
        this.playSound('hint');
    }

    // 查找提示卡片
    findHintCards() {
        // 查找有2张相同类型在卡槽中的卡片类型
        const typeCounts = {};
        this.state.selectedCards.forEach(card => {
            typeCounts[card.type] = (typeCounts[card.type] || 0) + 1;
        });

        const neededTypes = [];
        for (const [type, count] of Object.entries(typeCounts)) {
            if (count === 2) {
                neededTypes.push(parseInt(type));
            }
        }

        // 返回可见卡片中匹配的类型
        return this.state.visibleCards.filter(card =>
            neededTypes.includes(card.type)
        ).slice(0, 3); // 最多提示3张
    }

    // 查找卡片（适配一维数组）
    findCardById(id) {
        return this.state.deck.find(card => card && card.id === id);
    }

    // 洗牌算法（布局生成时使用日期 seed 的随机器，否则用 Math.random）
    shuffleArray(array) {
        const rnd = this._deckRandom || Math.random;
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(rnd() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // 显示消息
    showMessage(text, type = 'info') {
        const messageEl = document.getElementById('message');
        messageEl.textContent = text;
        messageEl.className = `message ${type}`;
        messageEl.classList.add('show');

        // 3秒后隐藏
        setTimeout(() => {
            messageEl.classList.remove('show');
        }, 3000);
    }

    playSound(sound) {
        if (!this.soundEnabled) return;
        // TODO: 加载实际音频文件，例如:
        // const audio = new Audio(`sounds/${sound}.mp3`);
        // audio.volume = 0.5;
        // audio.play().catch(() => {});
    }

    // 渲染卡片（金字塔式堆叠版本）
    renderCards() {
        const pileEl = document.getElementById('card-pile');
        pileEl.innerHTML = '<div class="pile-bg"></div>';

        // 按zIndex排序，确保正确堆叠
        const allCards = this.state.deck.filter(card => card && !card.removed);
        allCards.sort((a, b) => a.zIndex - b.zIndex);

        // 计算一次布局参数，避免每张卡片重复触发 DOM 读取
        const layout = this.calculateCardLayout();

        // 使用DocumentFragment批量添加DOM元素，提升性能
        const fragment = document.createDocumentFragment();

        allCards.forEach(card => {
            const cardEl = this.createCardElement(card, layout);
            fragment.appendChild(cardEl);
        });

        pileEl.appendChild(fragment);
    }

    /**
     * 计算卡片的自适应尺寸和位置
     * 基于7列9行的网格布局
     */
    calculateCardLayout() {
        const pileEl = document.getElementById('card-pile');
        const containerWidth = pileEl.clientWidth;
        const containerHeight = pileEl.clientHeight;

        const cfg = this._effectiveConfig || getEffectiveConfig(this.settings);
        const GRID_COLS = cfg.cols;
        const GRID_ROWS = cfg.rows;

        // 计算卡片尺寸（留出边距和层级偏移空间）
        const paddingX = 40; // 左右边距
        const paddingY = 30; // 上下边距
        const layerOffset = 3; // 每层的偏移量
        const maxLayers = cfg.layers || 4;

        // 堆叠时每层视觉偏移（px），用于露出下层卡片边缘
        const stackOffsetPerLayer = 3;
        // 为「第 9.5 行」和底部堆叠预留的垂直空间（估算），使 displayHeight 不超出容器
        const extraVerticalReserve = 0.5 * (55 + 5) + (maxLayers - 1) * stackOffsetPerLayer;

        // 可用空间
        const availableWidth = containerWidth - paddingX - (maxLayers * layerOffset);
        const availableHeight = containerHeight - paddingY - (maxLayers * layerOffset) - extraVerticalReserve;

        // 计算卡片尺寸（考虑间距）
        const gapX = 5; // 水平间距
        const gapY = 5; // 垂直间距

        const cardWidth = Math.floor((availableWidth - (GRID_COLS - 1) * gapX) / GRID_COLS);
        const cardHeight = Math.floor((availableHeight - (GRID_ROWS - 1) * gapY) / GRID_ROWS);

        // 计算实际卡片尺寸（保持合理比例）
        const finalCardWidth = Math.min(cardWidth, 80);
        const finalCardHeight = Math.min(cardHeight, 100);

        // 计算网格起始位置（居中）
        const gridWidth = finalCardWidth * GRID_COLS + gapX * (GRID_COLS - 1);
        const gridHeight = finalCardHeight * GRID_ROWS + gapY * (GRID_ROWS - 1);
        const startX = (containerWidth - gridWidth) / 2;
        // 垂直方向预留「半行」+ 底部堆叠偏移，使 row=8.5 的卡片完整显示
        const halfRowHeight = 0.5 * (finalCardHeight + gapY);
        const bottomStackOffset = (maxLayers - 1) * stackOffsetPerLayer;
        const displayHeight = gridHeight + halfRowHeight + bottomStackOffset;
        const startY = (containerHeight - displayHeight) / 2;

        return {
            cardWidth: finalCardWidth,
            cardHeight: finalCardHeight,
            gapX,
            gapY,
            startX,
            startY,
            layerOffset,
            stackOffsetPerLayer
        };
    }

    /**
     * 创建单个卡片元素（自适应版本 - 所有卡片统一尺寸）
     * @param {Object} card - 卡片数据
     * @param {Object} [layout] - 预计算的布局参数，避免重复 DOM 查询
     */
    createCardElement(card, layout) {
        const cardEl = document.createElement('div');

        const classList = ['card'];
        if (!card.visible) {
            classList.push('hidden');
        } else {
            if (card.visibleAreaRatio !== undefined && card.visibleAreaRatio >= 0.99) {
                classList.push('card-selectable');
            } else {
                classList.push('card-disabled');
            }
        }
        cardEl.className = classList.join(' ');
        cardEl.dataset.id = card.id;

        if (!layout) layout = this.calculateCardLayout();

        // 计算卡片在网格中的位置；同格堆叠时按 layer 做视觉偏移，露出下层边缘
        const stackOffset = layout.stackOffsetPerLayer ?? layout.layerOffset ?? 3;
        const x = layout.startX + card.col * (layout.cardWidth + layout.gapX) + card.layer * stackOffset;
        const y = layout.startY + card.row * (layout.cardHeight + layout.gapY) + card.layer * stackOffset;

        // 基于 z（层级优先级）只做“视觉”上的层次区分，而不是位置偏移
        // 层级越高：阴影更明显、不透明度更高，形成视觉上的“更靠上”
        const cfg = this._effectiveConfig || getEffectiveConfig(this.settings);
        const maxLayer = cfg.layers || 4;
        const depthRatio = Math.min(card.z / Math.max(maxLayer - 1, 1), 1); // 0~1

        // 固定一个轻微的向下阴影偏移，避免看起来真的“错位”
        const shadowOffsetX = 0;
        const shadowOffsetY = 4;
        const shadowBlur = 8 + depthRatio * 6;
        const shadowSpread = 1 + depthRatio * 1.5;
        const shadowAlpha = 0.18 + depthRatio * 0.18;

        // 低层略微降低不透明度，高层接近不透明
        const baseOpacity = 0.85 + depthRatio * 0.15;

        cardEl.style.cssText = `
            left: ${x}px;
            top: ${y}px;
            width: ${layout.cardWidth}px;
            height: ${layout.cardHeight}px;
            z-index: ${card.zIndex};
            background-color: ${CARD_COLORS[card.type % CARD_COLORS.length]};
            color: white;
            font-size: ${Math.max(layout.cardHeight * 0.4, 16)}px;
            opacity: ${baseOpacity};
            box-shadow: ${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${shadowSpread}px rgba(0, 0, 0, ${shadowAlpha});
        `;

        // 设置卡片内容
        cardEl.textContent = CARD_SYMBOLS[card.type % CARD_SYMBOLS.length];

        // 添加可见区域遮罩层（如果卡片有可见区域）
        if (card.visibleRegions && card.visibleRegions.length > 0) {
            this.addVisibleRegionMask(cardEl, card, layout);
        }

        // 添加点击事件（传递坐标）
        cardEl.addEventListener('click', (e) => {
            this.handleCardClick(card.id, e.clientX, e.clientY);
        });

        // 添加鼠标移动事件，高亮可见区域
        cardEl.addEventListener('mousemove', (e) => {
            this.handleCardHover(cardEl, card, e, layout);
        });

        cardEl.addEventListener('mouseleave', () => {
            this.handleCardLeave(cardEl, card);
        });

        return cardEl;
    }

    /**
     * 添加可见区域遮罩层
     */
    addVisibleRegionMask(cardEl, card, layout) {
        // 创建遮罩层元素
        const maskEl = document.createElement('div');
        maskEl.className = 'card-visible-mask';
        maskEl.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            border-radius: 8px;
        `;

        // 计算clip-path（基于可见区域）
        const clipPath = this.calculateClipPath(card.visibleRegions, layout);
        maskEl.style.clipPath = clipPath;
        maskEl.style.webkitClipPath = clipPath;

        // 不再添加 inset 白边/内发光，避免左上/右上角出现条状样式
        cardEl.appendChild(maskEl);

        // 存储遮罩元素引用
        cardEl._maskEl = maskEl;
    }

    /**
     * 计算clip-path路径（基于可见区域）
     * 注意：可见区域是归一化的网格坐标，需要转换为相对于卡片元素的百分比
     */
    calculateClipPath(visibleRegions, layout) {
        if (!visibleRegions || visibleRegions.length === 0) {
            return 'polygon(0% 0%, 0% 0%, 0% 0%)'; // 完全隐藏
        }

        // 将归一化坐标转换为百分比（相对于卡片本身）
        // 由于卡片在网格中，region的坐标是相对于网格的，需要转换为相对于卡片的百分比
        const minSize = 4; // 过滤掉宽度或高度不足 4% 的细条，避免角上出现条状样式
        const polygons = visibleRegions.map(region => {
            // 计算区域在卡片内的相对位置（百分比）
            // 假设卡片占据一个网格单位，region的坐标是相对于网格的
            const x1 = Math.max(0, Math.min(100, (region.x % 1) * 100));
            const y1 = Math.max(0, Math.min(100, (region.y % 1) * 100));
            const x2 = Math.max(0, Math.min(100, ((region.x + region.width) % 1) * 100));
            const y2 = Math.max(0, Math.min(100, ((region.y + region.height) % 1) * 100));

            // 确保坐标有效且不是过窄/过扁的细条
            if (x2 <= x1 || y2 <= y1) return null;
            if (x2 - x1 < minSize || y2 - y1 < minSize) return null;

            return `polygon(${x1}% ${y1}%, ${x2}% ${y1}%, ${x2}% ${y2}%, ${x1}% ${y2}%)`;
        }).filter(p => p !== null);

        // 如果有多个区域，使用多个polygon（但clip-path不支持多个，所以合并）
        // 简化：只显示第一个区域，或者使用更复杂的算法合并
        return polygons.length > 0 ? polygons[0] : 'polygon(0% 0%, 0% 0%, 0% 0%)';
    }

    /**
     * 处理卡片悬停（高亮可见区域）
     */
    handleCardHover(cardEl, card, event, layout) {
        if (!card.visibleRegions || card.visibleRegions.length === 0) return;

        // 计算鼠标位置相对于卡片的归一化坐标
        const rect = cardEl.getBoundingClientRect();
        const relativeX = (event.clientX - rect.left) / rect.width;
        const relativeY = (event.clientY - rect.top) / rect.height;

        // 转换为网格坐标（归一化）
        const normalizedX = card.col + relativeX;
        const normalizedY = card.row + relativeY;

        // 检查是否在可见区域内
        const isInVisibleRegion = VisibilityMask.isPointInVisibleRegions(
            normalizedX,
            normalizedY,
            card.visibleRegions
        );

        // 更新视觉反馈（仅外发光，无 inset 白边，避免角上条状样式）
        if (isInVisibleRegion) {
            cardEl.classList.add('hover-visible-region');
            if (cardEl._maskEl) {
                cardEl._maskEl.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.4)';
            }
        } else {
            cardEl.classList.remove('hover-visible-region');
            if (cardEl._maskEl) {
                cardEl._maskEl.style.boxShadow = 'none';
            }
        }
    }

    /**
     * 处理鼠标离开卡片
     */
    handleCardLeave(cardEl, card) {
        cardEl.classList.remove('hover-visible-region');
        if (cardEl._maskEl) {
            cardEl._maskEl.style.boxShadow = 'none';
        }
    }

    // 渲染卡槽（性能优化版本）
    renderSlot() {
        const slotEl = document.getElementById('card-slot');
        slotEl.innerHTML = '';

        // 使用DocumentFragment批量添加
        const fragment = document.createDocumentFragment();

        this.state.selectedCards.forEach((card, index) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'slot-card';
            cardEl.style.backgroundColor = CARD_COLORS[card.type % CARD_COLORS.length];
            cardEl.style.color = 'white';
            cardEl.textContent = CARD_SYMBOLS[card.type % CARD_SYMBOLS.length];
            cardEl.style.transform = `translateX(${index * 5}px)`;
            cardEl.dataset.type = card.type;

            // 检查是否与相邻卡片相同，添加分组视觉效果
            const prevCard = this.state.selectedCards[index - 1];
            const nextCard = this.state.selectedCards[index + 1];

            if (prevCard && prevCard.type === card.type) {
                cardEl.classList.add('grouped-left');
            }
            if (nextCard && nextCard.type === card.type) {
                cardEl.classList.add('grouped-right');
            }

            // 添加动画（最新添加的卡片）
            if (index === this.state.selectedCards.length - 1) {
                cardEl.style.animation = `slideIn ${CONFIG.animationDuration}ms ease-out`;
                cardEl.classList.add('new-card');
            }

            fragment.appendChild(cardEl);
        });

        slotEl.appendChild(fragment);
    }

    /**
     * 渲染移出区域（卡片可点击移回卡槽）
     */
    renderRemovedSlot() {
        const removedEl = document.getElementById('removed-slot');
        if (!removedEl) return;

        removedEl.innerHTML = '';

        // 使用DocumentFragment批量添加
        const fragment = document.createDocumentFragment();

        this.state.removedCards.forEach((card, index) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'removed-card';
            cardEl.style.backgroundColor = CARD_COLORS[card.type % CARD_COLORS.length];
            cardEl.style.color = 'white';
            cardEl.textContent = CARD_SYMBOLS[card.type % CARD_SYMBOLS.length];
            cardEl.dataset.type = card.type;
            cardEl.dataset.index = index;
            cardEl.title = '点击移回卡槽';

            // 添加点击事件：移回卡槽
            cardEl.addEventListener('click', () => {
                this.restoreCardFromRemoved(index);
            });

            fragment.appendChild(cardEl);
        });

        removedEl.appendChild(fragment);

        // 更新移出区计数（不限制数量）
        const removedCountEl = document.getElementById('removed-count');
        if (removedCountEl) {
            removedCountEl.textContent = this.state.removedCards.length;
        }

        // 更新清空按钮状态
        const clearBtn = document.getElementById('btn-clear-removed');
        if (clearBtn) {
            clearBtn.disabled = this.state.removedCards.length === 0;
        }
    }

    /**
     * 清空移出区域
     */
    clearRemovedCards() {
        if (this.state.removedCards.length === 0) return;

        // 记录操作（用于撤销）
        this.state.moves.push({
            type: 'clear-removed',
            cards: [...this.state.removedCards]
        });

        // 清空移出区
        this.state.removedCards = [];

        // 更新UI
        this.renderRemovedSlot();
        this.showMessage('已清空移出区', 'success');
        this.playSound('tool');
    }

    // 更新UI状态（增强版）
    updateUI() {
        // 更新分数
        document.getElementById('score').textContent = this.state.score;

        // 更新最高分
        this.updateHighScoreDisplay();

        // 更新步数
        document.getElementById('moves').textContent = this.state.moveCount;

        // 更新槽位
        const slotCount = this.state.selectedCards.length;
        const cfg = this._effectiveConfig || getEffectiveConfig(this.settings);
        const maxSlot = cfg.maxSlot;
        document.getElementById('slot-count').textContent = `${slotCount}/${maxSlot}`;
        document.getElementById('slot-fill').textContent = `${slotCount}/${maxSlot}`;

        // 更新道具数量
        document.querySelector('#tool-remove .tool-count').textContent = this.state.tools.remove;
        document.querySelector('#tool-undo .tool-count').textContent = this.state.tools.undo;
        document.querySelector('#tool-shuffle .tool-count').textContent = this.state.tools.shuffle;
        document.querySelector('#tool-hint .tool-count').textContent = this.state.tools.hint;

        // 根据槽位数量改变颜色提示
        const slotCountEl = document.getElementById('slot-count');
        const slotEl = document.getElementById('card-slot');
        slotCountEl.className = 'stat-value';
        slotEl.className = 'card-slot';

        if (slotCount >= maxSlot - 2 && slotCount < maxSlot) {
            slotCountEl.classList.add('warning');
            slotEl.classList.add('warning');
        }
        if (slotCount >= maxSlot) {
            slotCountEl.classList.add('danger');
            slotEl.classList.add('danger');
        }

        // 禁用道具按钮
        document.getElementById('tool-remove').classList.toggle('disabled', this.state.tools.remove <= 0);
        document.getElementById('tool-undo').classList.toggle('disabled', this.state.tools.undo <= 0);
        document.getElementById('tool-shuffle').classList.toggle('disabled', this.state.tools.shuffle <= 0);
        document.getElementById('tool-hint').classList.toggle('disabled', this.state.tools.hint <= 0);
    }

    // 渲染游戏
    render() {
        this.renderCards();
        this.renderSlot();
        this.renderRemovedSlot();
    }

    // 显示游戏结束弹窗（增强版）
    _renderResultStats() {
        const timeElapsed = Math.floor((new Date() - this.state.startTime) / 1000);
        document.getElementById('final-score').textContent = this.state.score;
        document.getElementById('final-moves').textContent = this.state.moveCount;
        document.getElementById('final-time').textContent = `${timeElapsed}秒`;
        document.getElementById('total-games').textContent = this.stats.gamesPlayed;
        const winRate = this.stats.gamesPlayed > 0
            ? Math.round((this.stats.gamesWon / this.stats.gamesPlayed) * 100)
            : 0;
        document.getElementById('win-rate').textContent = `${winRate}%`;
        document.getElementById('best-score').textContent = this.highScore;
    }

    showGameOver(isVictory) {
        const modal = document.getElementById('game-over-modal');
        const title = document.getElementById('game-result-title');
        const text = document.getElementById('game-result-text');
        const icon = document.getElementById('game-result-icon');

        this.updateStats(isVictory);
        const isNewRecord = this.saveHighScore();

        if (isVictory) {
            title.textContent = isNewRecord ? '🎉 新纪录！恭喜获胜！' : '恭喜获胜！🎉';
            text.textContent = isNewRecord
                ? `你成功消除了所有卡片，并创造了新的最高分！`
                : '你成功消除了所有卡片！';
            icon.innerHTML = '<i class="fas fa-trophy"></i>';
            icon.style.color = '#FFD166';
            this.playSound('win');

            this._renderResultStats();
            if (isNewRecord) {
                this.showMessage(`🎉 新纪录！得分: ${this.state.score}`, 'success');
            }

            this.startCelebrationAnimation(() => {
                modal.classList.add('active');
            });
            return;
        }

        title.textContent = '游戏结束 😢';
        text.textContent = '卡槽已满，没有可消除的卡片了';
        icon.innerHTML = '<i class="fas fa-times-circle"></i>';
        icon.style.color = '#EF476F';
        this.playSound('lose');

        this._renderResultStats();
        modal.classList.add('active');
    }

    /**
     * 胜利庆祝动效：先放烟花，再爱心/文字形状。结束后可执行回调（如显示弹窗）。
     * @param {Function} [onEnd] 动效结束后的回调，可选
     */
    startCelebrationAnimation(onEnd) {
        const self = this;
        const canvas = document.getElementById('celebration-canvas');
        if (!canvas) {
            if (typeof onEnd === 'function') onEnd();
            return;
        }

        // 取消上一次庆祝动效（若存在），保证每次胜利都能正常播完并弹窗
        if (self._celebrationAnimationId != null) {
            cancelAnimationFrame(self._celebrationAnimationId);
            self._celebrationAnimationId = null;
        }
        canvas.classList.remove('active');

        const ctx = canvas.getContext('2d');
        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();

        canvas.classList.add('active');

        const particles = [];
        const heartParticles = [];
        let heartInitialized = false;
        let celebrationCharParticlesList = []; // 按字符分割后的粒子列表，依次顺序展示
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        const COLORS = ['#FF6B6B', '#FFD166', '#4ECDC4', '#9D4EDD', '#06D6A0', '#FFF'];

        const totalParticles = 260;
        const now = performance.now();
        const FIREWORK_DURATION = 1300;  // 烟花总阶段（包含上升 + 爆炸）
        const HEART_DURATION = 1800;     // 爱心阶段
        const TOTAL_DURATION = FIREWORK_DURATION + HEART_DURATION;

        // 生成初始烟花粒子（带火箭上升 + 随机性，让效果更自然）
        for (let i = 0; i < totalParticles; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 4;
            const fireOffset = 0; // 所有粒子同时升空、同时爆炸

            // 所有粒子共用同一个发射点和同一个爆炸顶点，升空时完全重合为一点
            const baseX = centerX;
            const baseY = canvas.height * 0.88;
            const apexX = centerX;   // 爆炸中心：固定一点
            const apexY = canvas.height * 0.25; // 爆炸高度：固定

            particles.push({
                x: baseX,
                y: baseY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 1.5 + Math.random() * 2.5,
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                hx: 0,
                hy: 0,
                rx: baseX,
                ry: baseY,
                ax: apexX,
                ay: apexY,
                // 心形阶段的起点（在进入爱心阶段时记录一次）
                sx: centerX,
                sy: centerY,
                hasHeartStart: false,
                fireOffset
            });
        }

        const animate = (time) => {
            const elapsed = time - now;
            const t = Math.min(elapsed, TOTAL_DURATION);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 烟花粒子更新 & 绘制
            particles.forEach(p => {
                if (t <= FIREWORK_DURATION) {
                    // 烟花阶段：先从底部上升到高空，再在高空爆炸扩散
                    // 所有粒子使用统一时间进度 ft，实现“同时升空、同时绽放”
                    const ft = Math.min(
                        Math.max(t / FIREWORK_DURATION, 0),
                        1
                    );

                    const risePortion = 0.45; // 前 45% 时间用于上升
                    if (ft <= risePortion) {
                        // 火箭上升：从 (rx, ry) 到 (ax, ay)
                        const rt = ft / risePortion;
                        // easeOutQuad 让起步快、到顶减速
                        const e = 1 - (1 - rt) * (1 - rt);
                        p.x = p.rx + (p.ax - p.rx) * e;
                        p.y = p.ry + (p.ay - p.ry) * e;
                    } else {
                        // 顶部爆炸：从顶点向四周扩散，带轻微重力
                        const et = (ft - risePortion) / (1 - risePortion);
                        const fireEase = et * et * (3 - 2 * et); // smoothstep
                        const radius = fireEase * 260;
                        const gravity = fireEase * fireEase * 120;

                        p.x = p.ax + p.vx * radius;
                        p.y = p.ay + p.vy * radius + gravity;
                    }
                }
                // t > FIREWORK_DURATION 时，不再改变粒子位置，只做渐隐处理

                // 绘制烟花粒子（带自然的透明度衰减）
                ctx.beginPath();
                let alpha;
                if (t <= FIREWORK_DURATION) {
                    const ft = Math.min(Math.max(t / FIREWORK_DURATION, 0), 1);
                    alpha = 1 - ft * 0.4; // 烟花尾部略微变淡
                    ctx.fillStyle = p.color;
                } else {
                    const heartRaw = (t - FIREWORK_DURATION) / HEART_DURATION;
                    const heartT = Math.min(Math.max(heartRaw, 0), 1);
                    alpha = 0.9 - heartT * 0.6; // 爱心阶段烟花尾迹慢慢淡出
                    ctx.fillStyle = p.color;
                }
                ctx.globalAlpha = Math.max(0, alpha);
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            });

            // 爱心/文案粒子：对 CONFIG.celebrationText 按字符分割，依次顺序展示
            if (t > FIREWORK_DURATION) {
                if (!heartInitialized) {
                    heartInitialized = true;
                    const heartCount = 2400;
                    const offSize = 720;
                    const fontScale = 0.30;
                    const baseScale = Math.min(canvas.width, canvas.height) * 0.52;

                    // 按字符分割（支持 emoji/多码点），空则用默认 ❤
                    const textSetting = (this.settings && this.settings.celebrationText) || CONFIG.celebrationText || '❤';
                    let rawText = textSetting.trim();

                    // >>> 如果文案包含「Base64 解密后的标识」，则追加另一段 Base64 解密后的字符串 <<<
                    (function () {
                        function decodeBase64(str) {
                            try {
                                return decodeURIComponent(escape(atob(str)));
                            } catch (e) {
                                return '';
                            }
                        }
                        // 标识：Base64 编码的字符串，解密后若出现在文案中则触发追加
                        const BASE64_IDENTIFIER = '5Yav5r2H';  // 示例：解密为 "special_mark"，可替换为你的 Base64
                        // 追加内容：Base64 编码的字符串，解密后追加到文案末尾
                        const BASE64_APPEND = '54ix5L2g5ZOm';  // 示例：可替换为你的 Base64
                        const decodedMark = decodeBase64(BASE64_IDENTIFIER);
                        const decodedAppend = decodeBase64(BASE64_APPEND);
                        if (decodedMark && decodedAppend && rawText.includes(decodedMark)) {
                            rawText += decodedAppend;
                        }
                    })();

                    const chars = rawText ? Array.from(rawText) : ['❤'];

                    const charParticlesList = []; // 每个字符对应一组粒子 [{x,y,size,color}, ...]

                    for (const ch of chars) {
                        const offCanvas = document.createElement('canvas');
                        offCanvas.width = offSize;
                        offCanvas.height = offSize;
                        const offCtx = offCanvas.getContext('2d');
                        offCtx.clearRect(0, 0, offSize, offSize);
                        offCtx.fillStyle = '#FFFFFF';
                        offCtx.textAlign = 'center';
                        offCtx.textBaseline = 'middle';
                        offCtx.font = `bold ${Math.floor(offSize * fontScale)}px system-ui, 'Noto Color Emoji', 'Apple Color Emoji', sans-serif`;
                        offCtx.fillText(ch, offSize / 2, offSize / 2);

                        const imgData = offCtx.getImageData(0, 0, offSize, offSize).data;
                        const shapePoints = [];
                        for (let y = 0; y < offSize; y += 1) {
                            for (let x = 0; x < offSize; x += 1) {
                                const idx = (y * offSize + x) * 4;
                                if (imgData[idx + 3] > 64) shapePoints.push({ x, y });
                            }
                        }

                        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                        shapePoints.forEach(pt => {
                            if (pt.x < minX) minX = pt.x;
                            if (pt.x > maxX) maxX = pt.x;
                            if (pt.y < minY) minY = pt.y;
                            if (pt.y > maxY) maxY = pt.y;
                        });

                        const particlesForChar = [];
                        if (shapePoints.length === 0) {
                            // 该字符无像素：用简单心形兜底
                            const scale = Math.min(canvas.width, canvas.height) / 40;
                            for (let i = 0; i < Math.min(heartCount, 800); i++) {
                                const tt = Math.random() * Math.PI * 2;
                                let hx = 16 * Math.pow(Math.sin(tt), 3);
                                let hy = 13 * Math.cos(tt) - 5 * Math.cos(2 * tt) - 2 * Math.cos(3 * tt) - Math.cos(4 * tt);
                                const radiusJitter = 0.85 + Math.random() * 0.35;
                                hx *= radiusJitter;
                                hy *= radiusJitter;
                                particlesForChar.push({
                                    x: centerX + hx * scale * 0.8,
                                    y: centerY - hy * scale * 0.8,
                                    size: 1.8 + Math.random() * 2.2,
                                    color: '#FF6B9A'
                                });
                            }
                        } else {
                            const width = Math.max(1, maxX - minX);
                            const height = Math.max(1, maxY - minY);
                            const midX = (minX + maxX) / 2;
                            const midY = (minY + maxY) / 2;
                            const adjustedCount = Math.min(shapePoints.length, heartCount);
                            const step = Math.floor(shapePoints.length / adjustedCount);
                            for (let i = 0; i < adjustedCount; i++) {
                                const pt = shapePoints[Math.floor(i * step)];
                                const normX = (pt.x - midX) / width;
                                const normY = (pt.y - midY) / height;
                                const jitterX = (Math.random() - 0.5) * 0.6;
                                const jitterY = (Math.random() - 0.5) * 0.6;
                                particlesForChar.push({
                                    x: centerX + normX * baseScale + jitterX,
                                    y: centerY + normY * baseScale + jitterY,
                                    size: 2.2 + Math.random() * 2.0,
                                    color: '#FF6B9A'
                                });
                            }
                        }
                        charParticlesList.push(particlesForChar);
                    }

                    // 若一个字符都没有（理论上不会），兜底单心形
                    if (charParticlesList.length === 0) {
                        const scale = Math.min(canvas.width, canvas.height) / 40;
                        for (let i = 0; i < heartCount; i++) {
                            const tt = Math.random() * Math.PI * 2;
                            let hx = 16 * Math.pow(Math.sin(tt), 3);
                            let hy = 13 * Math.cos(tt) - 5 * Math.cos(2 * tt) - 2 * Math.cos(3 * tt) - Math.cos(4 * tt);
                            heartParticles.push({
                                x: centerX + hx * scale * 0.8,
                                y: centerY - hy * scale * 0.8,
                                size: 1.8 + Math.random() * 2.2,
                                color: '#FF6B9A'
                            });
                        }
                        charParticlesList.push(heartParticles);
                    }

                    // 存到闭包供绘制使用
                    celebrationCharParticlesList = charParticlesList;
                }

                const heartRaw = (t - FIREWORK_DURATION) / HEART_DURATION;
                const heartT = Math.min(Math.max(heartRaw, 0), 1);
                const list = celebrationCharParticlesList || [];
                const N = list.length;
                // 按分割长度依次顺序展示：heartT 被分成 N 段，当前展示第 currentIndex 段
                const currentIndex = N <= 1 ? 0 : Math.min(Math.floor(heartT * N), N - 1);
                const particlesToDraw = list[currentIndex] || [];

                particlesToDraw.forEach(hp => {
                    ctx.beginPath();
                    const pulse = 0.7 + Math.sin(heartT * Math.PI * 2 + hp.x * 0.01) * 0.15;
                    ctx.globalAlpha = Math.max(0, 0.2 + (1 - heartT) * 0.8) * pulse;
                    ctx.fillStyle = hp.color;
                    ctx.arc(hp.x, hp.y, hp.size, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 1;
                });
            }

            if (t < TOTAL_DURATION) {
                self._celebrationAnimationId = requestAnimationFrame(animate);
            } else {
                // 结束：渐隐画布，并执行回调（如显示胜利弹窗）
                self._celebrationAnimationId = null;
                canvas.classList.remove('active');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (typeof onEnd === 'function') onEnd();
            }
        };

        self._celebrationAnimationId = requestAnimationFrame(animate);

        // 窗口大小变化时，适配画布
        const onResize = () => {
            resize();
        };
        window.addEventListener('resize', onResize, { once: true });
    }

    // 绑定事件
    bindEvents() {
        // 新游戏按钮
        document.getElementById('btn-new-game').addEventListener('click', () => {
            this.init();
        });

        // 重置按钮
        document.getElementById('btn-reset').addEventListener('click', () => {
            if (confirm('确定要重置游戏吗？当前进度将丢失。')) {
                this.init();
            }
        });

        // 音效按钮（优化版）
        const soundBtn = document.getElementById('btn-sound');
        const updateSoundButton = () => {
            const icon = soundBtn.querySelector('i');
            const text = soundBtn.querySelector('span') || soundBtn;
            if (this.soundEnabled) {
                icon.className = 'fas fa-volume-up';
                if (text.tagName === 'SPAN') text.textContent = '音效';
            } else {
                icon.className = 'fas fa-volume-mute';
                if (text.tagName === 'SPAN') text.textContent = '音效已关闭';
            }
        };

        // 初始化按钮状态
        updateSoundButton();

        soundBtn.addEventListener('click', () => {
            this.soundEnabled = !this.soundEnabled;
            updateSoundButton();
            this.saveSettings();
            this.showMessage(this.soundEnabled ? '音效已开启' : '音效已关闭', 'info');
        });

        // 帮助按钮
        document.getElementById('btn-help').addEventListener('click', () => {
            document.getElementById('help-modal').classList.add('active');
        });

        // 难度选择按钮：切换难度后保存并重新开局
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.getAttribute('data-difficulty');
                if (!key || !(CONFIG.difficulties && CONFIG.difficulties[key])) return;
                this.settings.difficulty = key;
                this.saveSettings();
                this.updateDifficultyButtons();
                this.init();
                this.showMessage(`已切换为「${btn.textContent}」难度，新游戏已开始`, 'success');
            });
        });
        this.updateDifficultyButtons();

        // 庆祝文案自定义按钮
        const celebrationBtn = document.getElementById('btn-celebration-text');
        if (celebrationBtn) {
            celebrationBtn.addEventListener('click', () => {
                const current = (this.settings && this.settings.celebrationText) || CONFIG.celebrationText || '❤';
                const input = prompt('请输入胜利时展示的庆祝文案（可输入文字或 Emoji）：', current);
                if (input === null) return; // 用户取消
                const text = input.trim();
                // 允许清空则回退到默认
                this.settings.celebrationText = text || CONFIG.celebrationText || '❤';
                this.saveSettings();
                this.showMessage('庆祝文案已更新，下次胜利时生效', 'success');
            });
        }

        // 道具按钮
        document.getElementById('tool-remove').addEventListener('click', () => this.useRemoveTool());
        document.getElementById('tool-undo').addEventListener('click', () => this.useUndoTool());
        document.getElementById('tool-shuffle').addEventListener('click', () => this.useShuffleTool());
        document.getElementById('tool-hint').addEventListener('click', () => this.useHintTool());

        // 清空移出区按钮
        const clearRemovedBtn = document.getElementById('btn-clear-removed');
        if (clearRemovedBtn) {
            clearRemovedBtn.addEventListener('click', () => this.clearRemovedCards());
        }

        // 弹窗关闭按钮
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', function () {
                this.closest('.modal').classList.remove('active');
            });
        });

        // 再玩一次按钮
        document.getElementById('btn-play-again').addEventListener('click', () => {
            document.getElementById('game-over-modal').classList.remove('active');
            this.init();
        });

        // 分享按钮
        document.getElementById('btn-share').addEventListener('click', () => {
            const text = `我在《羊了个羊》中获得了${this.state.score}分！`;
            if (navigator.share) {
                navigator.share({
                    title: '羊了个羊',
                    text: text,
                    url: window.location.href
                });
            } else {
                navigator.clipboard.writeText(text).then(() => {
                    this.showMessage('战绩已复制到剪贴板', 'success');
                });
            }
        });

        // 关闭帮助弹窗
        document.querySelector('.close-help').addEventListener('click', () => {
            document.getElementById('help-modal').classList.remove('active');
        });

        // 清除数据按钮
        const clearDataBtn = document.getElementById('btn-clear-data');
        if (clearDataBtn) {
            clearDataBtn.addEventListener('click', () => {
                if (confirm('确定要清除所有游戏数据吗？这将删除最高分、统计信息和设置。')) {
                    this.clearAllData();
                }
            });
        }

        // 点击模态框外部关闭
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });

        // 窗口大小改变时重新渲染卡片（自适应布局）
        let resizeTimeout;
        window.addEventListener('resize', () => {
            // 使用防抖避免频繁重绘
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (!this.state.gameOver) {
                    this.renderCards();
                }
            }, 300);
        });
    }

    /**
     * 清除所有数据
     */
    clearAllData() {
        // 清除localStorage
        Object.values(CONFIG.storageKeys).forEach(key => {
            StorageManager.remove(key);
        });

        // 重置游戏数据
        this.highScore = 0;
        this.settings = {
            soundEnabled: true,
            difficulty: CONFIG.difficulty
        };
        this.stats = {
            gamesPlayed: 0,
            gamesWon: 0,
            totalScore: 0
        };

        // 更新UI
        this.updateHighScoreDisplay();

        // 显示消息
        this.showMessage('所有数据已清除', 'success');

        // 关闭弹窗
        document.getElementById('help-modal').classList.remove('active');

        // 重新开始游戏
        this.init();
    }
}

// 页面加载完成后初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    const game = new SheepGame();

    // 将游戏实例暴露给全局，方便调试
    window.game = game;

    // 显示帮助弹窗
    setTimeout(() => {
        document.getElementById('help-modal').classList.add('active');
    }, 500);
});

// ==================== 调试工具函数（仅开发环境） ====================
if (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') {
    window.debugCoverage = function () {
        let totalCards = 0, visibleCards = 0, coveredCards = 0;
        game.state.deck.forEach(card => {
            if (card && !card.removed) {
                totalCards++;
                if (card.visible) visibleCards++;
                else coveredCards++;
            }
        });
        console.log(`总卡片: ${totalCards}, 可见: ${visibleCards}, 被覆盖: ${coveredCards}`);
        return { totalCards, visibleCards, coveredCards };
    };

    window.debugCardCoverage = function (cardId) {
        const card = game.findCardById(cardId);
        if (!card) { console.log('卡片未找到:', cardId); return; }
        console.log(`${card.id}: (${card.row}, ${card.col}) 层级${card.layer} ${card.visible ? '可见✓' : '被覆盖✗'}`);
    };
}