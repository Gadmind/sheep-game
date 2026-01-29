# ⚙️ 配置指南

本指南详细说明如何自定义《羊了个羊》游戏的各种参数和设置。

---

## 📋 配置文件位置

所有配置都在 `script.js` 文件的开头部分：

```javascript
const CONFIG = {
    // 配置项在这里
};
```

---

## 🎮 基础游戏配置

### 牌堆结构

```javascript
layers: 4,           // 层数（建议：3-5）
rows: 7,             // 每层行数（建议：5-8）
cols: 8,             // 每层列数（建议：6-10）
```

**说明：**
- `layers`：卡片堆叠的层数，越多越难
- `rows`：每层的行数
- `cols`：每层的列数
- 总卡片数大约 = layers × rows × cols × 0.7

**示例配置：**
```javascript
// 简单模式
layers: 3, rows: 5, cols: 6

// 普通模式（默认）
layers: 4, rows: 7, cols: 8

// 困难模式
layers: 5, rows: 8, cols: 10
```

### 卡片配置

```javascript
cardTypes: 8,        // 卡片类型数量（建议：6-12）
cardsPerType: 12,    // 每种类型的卡片数量（必须是3的倍数）
```

**说明：**
- `cardTypes`：不同卡片图案的种类数
- `cardsPerType`：每种图案的卡片数量
- 必须满足：`cardsPerType % 3 === 0`（因为是三消游戏）

**计算公式：**
```
总卡片数 = cardTypes × cardsPerType
建议范围：60 - 150 张
```

### 卡槽配置

```javascript
maxSlot: 7,          // 卡槽最大容量（建议：5-9）
```

**说明：**
- `maxSlot`：卡槽可以容纳的最大卡片数
- 越小越难，因为容错空间更小
- 建议不要低于5，否则几乎无法完成

---

## 🎯 难度预设

### 内置难度配置

```javascript
difficulties: {
    easy: { 
        layers: 3, 
        cardsPerType: 9, 
        maxSlot: 9 
    },
    normal: { 
        layers: 4, 
        cardsPerType: 12, 
        maxSlot: 7 
    },
    hard: { 
        layers: 5, 
        cardsPerType: 15, 
        maxSlot: 7 
    }
}
```

### 切换难度

修改 `difficulty` 字段：
```javascript
difficulty: 'normal', // 'easy', 'normal', 或 'hard'
```

### 自定义难度

添加新的难度等级：
```javascript
difficulties: {
    easy: { ... },
    normal: { ... },
    hard: { ... },
    expert: {           // 新增专家难度
        layers: 6,
        cardsPerType: 18,
        maxSlot: 6
    },
    nightmare: {        // 新增噩梦难度
        layers: 7,
        cardsPerType: 21,
        maxSlot: 5
    }
}
```

---

## 🛠️ 道具配置

### 初始道具数量

```javascript
initialTools: {
    remove: 3,      // 移出道具次数
    undo: 3,        // 撤销道具次数
    shuffle: 1,     // 洗牌道具次数
    hint: 3         // 提示道具次数
}
```

**调整建议：**
- 简单模式：增加道具次数
- 困难模式：减少道具次数
- 可以设置为 0 来禁用某个道具

**示例：**
```javascript
// 简单模式 - 更多道具
initialTools: {
    remove: 5,
    undo: 5,
    shuffle: 3,
    hint: 5
}

// 困难模式 - 更少道具
initialTools: {
    remove: 1,
    undo: 1,
    shuffle: 0,
    hint: 1
}
```

---

## 🎨 视觉配置

### 动画时长

```javascript
animationDuration: 300,          // 普通动画时长（毫秒）
matchAnimationDuration: 600,     // 匹配消除动画时长（毫秒）
```

**说明：**
- 数值越小，动画越快
- 建议范围：200-500毫秒
- 过快可能影响视觉体验

### 卡片颜色

在 `CARD_COLORS` 数组中修改：
```javascript
const CARD_COLORS = [
    '#FF6B8B',  // 粉红色
    '#4ECDC4',  // 青色
    '#FFD166',  // 黄色
    '#06D6A0',  // 绿色
    '#118AB2',  // 蓝色
    '#EF476F',  // 红色
    '#9D4EDD',  // 紫色
    '#FF9E6D',  // 橙色
    // 可以添加更多颜色
];
```

### 卡片符号

在 `CARD_SYMBOLS` 数组中修改：
```javascript
const CARD_SYMBOLS = [
    '🐑', '🐏', '🐐', '🌟',
    '⭐', '🌙', '☀️', '☁️',
    // 可以使用任何emoji或字符
];
```

---

## 💾 存储配置

### 存储键名

```javascript
storageKeys: {
    highScore: 'sheep_game_high_score',
    settings: 'sheep_game_settings',
    stats: 'sheep_game_stats'
}
```

**说明：**
- 这些键名用于localStorage
- 如果要重置所有数据，可以修改这些键名
- 不建议随意修改，除非必要

---

## 🎵 音效配置

### 音效状态

默认音效开启状态在 `settings` 对象中：
```javascript
this.settings = {
    soundEnabled: true,  // 改为 false 默认关闭音效
    difficulty: 'normal'
};
```

### 添加音效文件

修改 `playSound()` 方法：
```javascript
playSound(sound) {
    if (!this.soundEnabled) return;
    
    const audio = new Audio(`sounds/${sound}.mp3`);
    audio.volume = 0.5;
    audio.play().catch(err => console.log('音频播放失败:', err));
}
```

**需要的音效文件：**
- `sounds/click.mp3` - 点击音效
- `sounds/match.mp3` - 匹配音效
- `sounds/tool.mp3` - 道具音效
- `sounds/shuffle.mp3` - 洗牌音效
- `sounds/hint.mp3` - 提示音效
- `sounds/win.mp3` - 胜利音效
- `sounds/lose.mp3` - 失败音效

---

## 📐 布局配置

### 卡片尺寸

在 CSS (`style.css`) 中修改：
```css
.card {
    width: 70px;      /* 卡片宽度 */
    height: 90px;     /* 卡片高度 */
    font-size: 1.8rem; /* 符号大小 */
}
```

### 卡片间距

在 `createCardElement()` 方法中修改：
```javascript
const x = card.col * 75 + card.layer * 4;  // 75 = 水平间距
const y = card.row * 85 + card.layer * 4;  // 85 = 垂直间距
```

### 卡槽样式

在 CSS 中修改卡槽高度：
```css
.card-slot {
    min-height: 100px;  /* 卡槽最小高度 */
    gap: 10px;          /* 卡片间距 */
}
```

---

## 🔧 高级配置

### 卡片生成算法

修改卡片生成密度：
```javascript
generateSpotsForLayer(layer, rows, cols) {
    const spots = [];
    // 0.7 = 70%密度，可调整为 0.5-0.9
    for (let i = 0; i < rows * cols * 0.7; i++) {
        // ...
    }
    return spots;
}
```

**密度建议：**
- 0.5 - 稀疏，更简单
- 0.7 - 适中（默认）
- 0.9 - 密集，更困难

### 分数系统

修改得分规则：
```javascript
checkForMatches() {
    // ...
    this.state.score += 100;  // 每次匹配的分数
    // ...
}
```

**自定义计分：**
```javascript
// 根据连消次数递增
const baseScore = 100;
const comboBonus = this.comboCount * 50;
this.state.score += baseScore + comboBonus;
```

---

## 📱 响应式配置

### 移动端卡片尺寸

在 CSS 媒体查询中调整：
```css
@media (max-width: 768px) {
    .card {
        width: 55px;      /* 平板尺寸 */
        height: 75px;
        font-size: 1.5rem;
    }
}

@media (max-width: 480px) {
    .card {
        width: 45px;      /* 手机尺寸 */
        height: 60px;
        font-size: 1.2rem;
    }
}
```

---

## 🎨 主题配置

### CSS变量

修改颜色主题：
```css
:root {
    --primary-color: #FF6B8B;    /* 主色调 */
    --secondary-color: #4ECDC4;  /* 辅助色 */
    --accent-color: #FFD166;     /* 强调色 */
    --dark-color: #2A2D43;       /* 深色 */
    --light-color: #F7F9FC;      /* 浅色 */
    --success-color: #06D6A0;    /* 成功色 */
    --danger-color: #EF476F;     /* 危险色 */
    --warning-color: #FFD166;    /* 警告色 */
}
```

### 背景渐变

修改页面背景：
```css
body {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    /* 或使用纯色 */
    /* background: #f5f5f5; */
}
```

---

## 🚀 性能配置

### 渲染优化

调整批量渲染大小：
```javascript
// 如果卡片数量很大，可以考虑分批渲染
const BATCH_SIZE = 50;
// 实现分批渲染逻辑
```

### 动画性能

禁用某些动画以提升性能：
```css
/* 在低性能设备上可以禁用动画 */
@media (prefers-reduced-motion: reduce) {
    * {
        animation: none !important;
        transition: none !important;
    }
}
```

---

## 💡 配置示例

### 示例 1：儿童友好模式
```javascript
const CONFIG = {
    layers: 2,
    rows: 5,
    cols: 6,
    cardTypes: 6,
    cardsPerType: 9,
    maxSlot: 10,
    initialTools: {
        remove: 10,
        undo: 10,
        shuffle: 5,
        hint: 10
    }
};
```

### 示例 2：竞技模式
```javascript
const CONFIG = {
    layers: 6,
    rows: 8,
    cols: 10,
    cardTypes: 10,
    cardsPerType: 15,
    maxSlot: 6,
    initialTools: {
        remove: 1,
        undo: 0,
        shuffle: 0,
        hint: 2
    }
};
```

### 示例 3：休闲模式
```javascript
const CONFIG = {
    layers: 4,
    rows: 6,
    cols: 7,
    cardTypes: 8,
    cardsPerType: 12,
    maxSlot: 8,
    initialTools: {
        remove: 5,
        undo: 5,
        shuffle: 3,
        hint: 5
    }
};
```

---

## ⚠️ 注意事项

### 必须遵守的规则
1. `cardsPerType` 必须是 3 的倍数
2. `layers` × `rows` × `cols` × 0.7 应该 ≥ `cardTypes` × `cardsPerType`
3. `maxSlot` 至少为 5，建议不超过 10
4. `cardTypes` 不要超过 `CARD_COLORS` 和 `CARD_SYMBOLS` 数组长度

### 常见问题

**Q: 修改配置后游戏无法完成？**
A: 检查总卡片数是否合理，确保卡槽容量不要太小。

**Q: 卡片生成失败？**
A: 可能是 `cardsPerType` 不是3的倍数，或者总卡片数超过了牌堆容量。

**Q: 难度设置不生效？**
A: 确保在代码中应用了难度设置，需要在初始化时读取 `difficulties` 对象。

---

## 🔄 重置配置

如果配置出错，可以复制以下默认配置：

```javascript
const CONFIG = {
    layers: 4,
    rows: 7,
    cols: 8,
    cardTypes: 8,
    cardsPerType: 12,
    maxSlot: 7,
    difficulty: 'normal',
    difficulties: {
        easy: { layers: 3, cardsPerType: 9, maxSlot: 9 },
        normal: { layers: 4, cardsPerType: 12, maxSlot: 7 },
        hard: { layers: 5, cardsPerType: 15, maxSlot: 7 }
    },
    initialTools: {
        remove: 3,
        undo: 3,
        shuffle: 1,
        hint: 3
    },
    animationDuration: 300,
    matchAnimationDuration: 600,
    storageKeys: {
        highScore: 'sheep_game_high_score',
        settings: 'sheep_game_settings',
        stats: 'sheep_game_stats'
    }
};
```

---

**祝您配置愉快！如有问题，请参考代码注释或提交Issue。**
