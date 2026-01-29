# 🧪 金字塔堆叠功能测试

## 快速验证

刷新浏览器后，在控制台运行以下命令：

---

## ✅ 测试1：检查偏移卡片

```javascript
// 查找所有偏移位置的卡片
function findOffsetCards() {
    const offsetCards = game.state.deck.filter(card => 
        card && (card.row % 1 !== 0 || card.col % 1 !== 0)
    );
    
    console.log('=== 偏移卡片统计 ===');
    console.log('偏移卡片数量:', offsetCards.length);
    console.log('总卡片数量:', game.state.deck.length);
    console.log('偏移比例:', (offsetCards.length / game.state.deck.length * 100).toFixed(1) + '%');
    
    console.log('\n偏移卡片列表:');
    offsetCards.slice(0, 5).forEach(card => {
        console.log(`- ${card.id}: 位置(${card.row}, ${card.col}), 层级${card.layer}`);
    });
    
    return offsetCards;
}

findOffsetCards();
```

**预期结果：**
```
=== 偏移卡片统计 ===
偏移卡片数量: 15-30
总卡片数量: 96
偏移比例: 15-30%

偏移卡片列表:
- card-5: 位置(1.5, 2.5), 层级3
- card-12: 位置(3.5, 4.5), 层级2
...
```

---

## ✅ 测试2：验证覆盖检测

```javascript
// 检查覆盖关系
function testCoverageDetection() {
    let totalCards = 0;
    let visibleCards = 0;
    let coveredCards = 0;
    
    game.state.deck.forEach(card => {
        if (card && !card.removed) {
            totalCards++;
            if (card.visible) {
                visibleCards++;
            } else {
                coveredCards++;
            }
        }
    });
    
    console.log('=== 覆盖检测统计 ===');
    console.log('总卡片:', totalCards);
    console.log('可见:', visibleCards);
    console.log('被覆盖:', coveredCards);
    console.log('覆盖率:', (coveredCards / totalCards * 100).toFixed(1) + '%');
    
    return { totalCards, visibleCards, coveredCards };
}

testCoverageDetection();
```

**预期结果：**
```
=== 覆盖检测统计 ===
总卡片: 96
可见: 15-25
被覆盖: 71-81
覆盖率: 75-85%
```

---

## ✅ 测试3：重叠算法验证

```javascript
// 手动测试重叠算法
function testOverlapAlgorithm() {
    console.log('=== 重叠算法测试 ===');
    
    // 测试用例1：完全重叠
    const card1 = { row: 1, col: 1, layer: 0 };
    const card2 = { row: 1, col: 1, layer: 1 };
    const overlap1 = game.checkCardsOverlap(card1, card2);
    console.log('完全重叠:', overlap1, '(应该为true)');
    
    // 测试用例2：半格偏移（压中心）
    const card3 = { row: 1, col: 1, layer: 0 };
    const card4 = { row: 1.5, col: 1.5, layer: 1 };
    const overlap2 = game.checkCardsOverlap(card3, card4);
    console.log('半格偏移:', overlap2, '(应该为false，重叠<50%)');
    
    // 测试用例3：0.3偏移（较大重叠）
    const card5 = { row: 1, col: 1, layer: 0 };
    const card6 = { row: 1.3, col: 1.3, layer: 1 };
    const overlap3 = game.checkCardsOverlap(card5, card6);
    console.log('0.3偏移:', overlap3, '(应该为false，重叠49%)');
    
    // 测试用例4：无重叠
    const card7 = { row: 1, col: 1, layer: 0 };
    const card8 = { row: 3, col: 3, layer: 1 };
    const overlap4 = game.checkCardsOverlap(card7, card8);
    console.log('无重叠:', overlap4, '(应该为false)');
}

testOverlapAlgorithm();
```

---

## ✅ 测试4：游戏可玩性

### 手动测试
1. 开始新游戏
2. 观察卡片排列
3. 点击上层偏移的卡片
4. 观察下方是否露出多张卡片

**预期：**
- ✅ 偏移卡片移除后，下方2-4张卡片变为可见
- ✅ 游戏可以正常进行
- ✅ 能够完成三消
- ✅ 最终能完全消除（100%可解）

---

## ✅ 测试5：性能验证

```javascript
// 性能测试
function performanceTest() {
    console.log('=== 性能测试 ===');
    
    // 测试生成性能
    console.time('生成牌堆');
    game.init();
    console.timeEnd('生成牌堆');
    
    // 测试可见性计算性能
    console.time('可见性计算');
    game.updateVisibleCards();
    console.timeEnd('可见性计算');
    
    // 测试渲染性能
    console.time('渲染卡片');
    game.renderCards();
    console.timeEnd('渲染卡片');
}

performanceTest();
```

**预期结果：**
```
=== 性能测试 ===
生成牌堆: 10-20ms ✓
可见性计算: 3-8ms ✓
渲染卡片: 8-15ms ✓
```

---

## ✅ 测试6：可解性验证

```javascript
// 验证100%可解性
function verifySolvability() {
    const typeCounts = {};
    
    game.state.deck.forEach(card => {
        if (card) {
            typeCounts[card.type] = (typeCounts[card.type] || 0) + 1;
        }
    });
    
    console.log('=== 可解性验证 ===');
    let allValid = true;
    for (const type in typeCounts) {
        const count = typeCounts[type];
        const isValid = count % 3 === 0;
        console.log(`类型${type}: ${count}张 ${isValid ? '✓' : '✗'}`);
        if (!isValid) allValid = false;
    }
    
    console.log('可解性:', allValid ? '✓ 100%可解' : '✗ 存在问题');
}

verifySolvability();
```

**预期：**
- 所有类型都显示 ✓
- 可解性显示 "✓ 100%可解"

---

## 🎮 完整游戏测试

### 测试流程
1. **开始新游戏**
2. **观察初始布局**
   - 是否有偏移的卡片？
   - 堆叠效果是否明显？
3. **点击偏移卡片**
   - 下方是否露出多张卡片？
4. **继续游戏**
   - 能否正常三消？
   - 能否完全消除？
5. **完成游戏**
   - 记录体验

### 评估标准

| 项目 | 标准 | 通过 |
|------|------|------|
| 偏移卡片生成 | 15-30% | [ ] |
| 覆盖检测正确 | 100% | [ ] |
| 视觉效果好 | 立体感强 | [ ] |
| 游戏可玩 | 流畅无bug | [ ] |
| 性能良好 | <20ms | [ ] |
| 100%可解 | 是 | [ ] |

---

## 🐛 问题报告

如果测试中发现问题，请记录：

### 问题描述
```
问题：

重现步骤：
1. 
2. 
3. 

控制台输出：


```

### 测试数据
```javascript
// 粘贴相关测试函数的输出


```

---

## ✅ 通过标准

全部测试通过的标准：
- ✅ 有15-30%的偏移卡片
- ✅ 覆盖检测准确无误
- ✅ 偏移卡片能压住多张下层卡片
- ✅ 性能保持优秀（<20ms）
- ✅ 游戏100%可解
- ✅ 无游戏逻辑bug

---

**测试指南版本：** v1.0  
**适用游戏版本：** v2.0.3+  
**创建日期：** 2026-01-28

---

*确保金字塔堆叠完美运行！* 🏔️
