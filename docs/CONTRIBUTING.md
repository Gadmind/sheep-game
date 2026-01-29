# 🤝 贡献指南

感谢您对《羊了个羊》项目的关注！我们欢迎任何形式的贡献。

---

## 📋 目录

- [行为准则](#行为准则)
- [如何贡献](#如何贡献)
- [开发流程](#开发流程)
- [代码规范](#代码规范)
- [提交规范](#提交规范)
- [问题报告](#问题报告)
- [功能建议](#功能建议)

---

## 🌟 行为准则

### 我们的承诺
- 尊重所有贡献者
- 欢迎建设性的批评和建议
- 专注于对社区最有利的事情
- 保持友好和包容的态度

### 我们的标准
✅ **应该做的：**
- 使用友好和包容的语言
- 尊重不同的观点和经验
- 优雅地接受建设性批评
- 关注对社区最有利的事情
- 对其他社区成员表示同理心

❌ **不应该做的：**
- 使用性化的语言或图像
- 人身攻击或政治攻击
- 公开或私下的骚扰
- 未经许可发布他人的私人信息
- 其他可能被认为不专业或不受欢迎的行为

---

## 🚀 如何贡献

### 贡献类型

1. **报告Bug** 🐛
   - 详细描述问题
   - 提供复现步骤
   - 附上截图或错误信息

2. **建议功能** 💡
   - 说明功能的用途
   - 描述预期行为
   - 解释为什么需要这个功能

3. **改进文档** 📝
   - 修正错别字
   - 补充说明
   - 添加示例

4. **提交代码** 💻
   - 修复Bug
   - 实现新功能
   - 优化性能
   - 重构代码

5. **设计贡献** 🎨
   - UI/UX改进
   - 视觉设计
   - 动画效果

---

## 🔧 开发流程

### 1. 准备工作

#### Fork 项目
```bash
# 点击GitHub页面右上角的 Fork 按钮
```

#### 克隆仓库
```bash
git clone https://github.com/your-username/sheep-game.git
cd sheep-game
```

#### 创建分支
```bash
# 功能分支
git checkout -b feature/your-feature-name

# Bug修复分支
git checkout -b fix/bug-description

# 文档分支
git checkout -b docs/what-you-update
```

### 2. 开发

#### 安装依赖
本项目是纯HTML/CSS/JavaScript，无需安装依赖。

#### 本地运行
```bash
# 方式1：使用Python
python -m http.server 8000

# 方式2：使用Node.js
npx http-server

# 方式3：直接打开
# 双击 index.html 文件
```

#### 开发规范
- 遵循现有代码风格
- 添加必要的注释
- 确保代码可读性
- 测试你的更改

### 3. 测试

#### 手动测试清单
- [ ] 在Chrome浏览器中测试
- [ ] 在Firefox浏览器中测试
- [ ] 在移动设备上测试（或使用开发者工具）
- [ ] 测试所有功能按钮
- [ ] 测试游戏流程（开始、进行、结束）
- [ ] 测试道具功能
- [ ] 测试数据保存和加载

#### 性能测试
- [ ] 检查控制台是否有错误
- [ ] 验证动画流畅性
- [ ] 测试长时间运行的稳定性

### 4. 提交

#### 提交代码
```bash
# 添加文件
git add .

# 提交更改
git commit -m "feat: 添加新功能描述"

# 推送到远程
git push origin feature/your-feature-name
```

#### 创建 Pull Request
1. 访问你的Fork仓库
2. 点击 "New Pull Request"
3. 填写PR描述
4. 等待审核

---

## 📝 代码规范

### JavaScript 规范

#### 命名规范
```javascript
// 类名：大驼峰
class SheepGame { }

// 函数/方法：小驼峰
function handleCardClick() { }

// 常量：全大写下划线
const MAX_SLOT = 7;

// 变量：小驼峰
let selectedCards = [];
```

#### 注释规范
```javascript
/**
 * 函数说明
 * @param {Type} paramName - 参数说明
 * @returns {Type} 返回值说明
 */
function exampleFunction(paramName) {
    // 单行注释
    return value;
}
```

#### 代码风格
```javascript
// ✅ 好的写法
if (condition) {
    doSomething();
}

// ❌ 避免的写法
if(condition)
{
    doSomething();
}

// ✅ 使用 const/let
const config = {};
let count = 0;

// ❌ 避免使用 var
var oldStyle = true;  // 不推荐

// ✅ 使用箭头函数
const callback = () => { };

// ✅ 使用模板字符串
const message = `Hello ${name}`;

// ❌ 避免字符串拼接
const message = 'Hello ' + name;  // 不推荐
```

### CSS 规范

#### 命名规范
```css
/* 使用连字符 */
.card-pile { }
.game-area { }

/* BEM命名（可选）*/
.block__element--modifier { }
```

#### 代码风格
```css
/* ✅ 每个属性独占一行 */
.selector {
    display: flex;
    justify-content: center;
    align-items: center;
}

/* ✅ 使用CSS变量 */
:root {
    --primary-color: #FF6B8B;
}

.element {
    color: var(--primary-color);
}
```

### HTML 规范

```html
<!-- ✅ 使用语义化标签 -->
<header>头部</header>
<main>主要内容</main>
<footer>页脚</footer>

<!-- ✅ 正确的缩进 -->
<div class="container">
    <div class="item">
        <span>内容</span>
    </div>
</div>

<!-- ✅ 添加必要的属性 -->
<button id="btn-action" class="btn btn-primary">
    <i class="fas fa-icon"></i> 按钮文本
</button>
```

---

## 📋 提交规范

### Commit Message 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型

- `feat`: 新功能
- `fix`: Bug修复
- `docs`: 文档更新
- `style`: 代码格式（不影响代码运行）
- `refactor`: 重构（既不是新功能也不是Bug修复）
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

### 示例

```bash
# 新功能
git commit -m "feat: 添加难度选择界面"

# Bug修复
git commit -m "fix: 修复卡片重叠显示问题"

# 文档更新
git commit -m "docs: 更新README中的安装说明"

# 性能优化
git commit -m "perf: 优化卡片渲染性能"

# 代码重构
git commit -m "refactor: 重构卡片生成算法"
```

---

## 🐛 问题报告

### 报告 Bug

提交Issue时请包含：

1. **Bug描述**
   - 简洁明了的描述问题

2. **复现步骤**
   ```
   1. 打开游戏
   2. 点击某个按钮
   3. 观察到错误
   ```

3. **预期行为**
   - 描述你期望发生什么

4. **实际行为**
   - 描述实际发生了什么

5. **截图或视频**
   - 如果可能，提供截图

6. **环境信息**
   - 浏览器：Chrome 120
   - 操作系统：Windows 11
   - 屏幕分辨率：1920x1080

7. **控制台错误**
   ```
   粘贴控制台中的错误信息
   ```

### Issue 模板

```markdown
**Bug描述**
简洁明了的描述这个bug

**复现步骤**
1. 打开...
2. 点击...
3. 看到错误...

**预期行为**
描述你期望发生什么

**截图**
如果可以，添加截图

**环境信息：**
 - 浏览器：[如 Chrome, Safari]
 - 版本：[如 120]
 - 操作系统：[如 Windows, macOS, iOS]

**附加信息**
添加其他相关信息
```

---

## 💡 功能建议

### 提出新功能

提交Issue时请包含：

1. **功能描述**
   - 清楚地描述你想要的功能

2. **使用场景**
   - 说明在什么情况下需要这个功能

3. **预期效果**
   - 描述功能应该如何工作

4. **替代方案**
   - 是否考虑过其他实现方式

5. **附加说明**
   - 其他相关信息

### Feature Request 模板

```markdown
**功能描述**
简洁明了的描述建议的功能

**问题背景**
描述这个功能要解决什么问题

**建议的解决方案**
清楚而简洁地描述你想要的功能

**替代方案**
描述你考虑过的其他替代方案

**附加信息**
添加其他相关信息、截图或示例
```

---

## 🎯 开发任务

### 当前需要帮助的地方

#### 🔴 高优先级
- [ ] 添加音效文件
- [ ] 实现难度选择UI
- [ ] 优化移动端触摸体验

#### 🟡 中优先级
- [ ] 添加键盘快捷键
- [ ] 实现关卡系统
- [ ] 添加成就系统

#### 🟢 低优先级
- [ ] 多语言支持
- [ ] 自定义主题
- [ ] 社交分享功能

### 适合新手的任务
- 🟢 改进文档和注释
- 🟢 修正拼写错误
- 🟢 添加代码示例
- 🟢 优化CSS样式
- 🟢 改进UI/UX

---

## 📚 资源链接

### 学习资源
- [HTML教程](https://developer.mozilla.org/zh-CN/docs/Web/HTML)
- [CSS教程](https://developer.mozilla.org/zh-CN/docs/Web/CSS)
- [JavaScript教程](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript)

### 工具推荐
- [VS Code](https://code.visualstudio.com/) - 代码编辑器
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/) - 调试工具
- [Git](https://git-scm.com/) - 版本控制

---

## ❓ 常见问题

### Q: 我是新手，可以贡献吗？
A: 当然可以！我们欢迎各个级别的贡献者。可以从简单的任务开始，比如改进文档或修复拼写错误。

### Q: 我的PR多久会被审核？
A: 我们会尽快审核，通常在1-3天内。请耐心等待。

### Q: 如果PR被拒绝怎么办？
A: 不要气馁！我们会解释原因，你可以根据反馈进行修改后重新提交。

### Q: 可以直接联系维护者吗？
A: 对于技术问题，请通过Issue讨论。这样其他人也能看到和学习。

---

## 🙏 致谢

感谢所有为项目做出贡献的人！

- 贡献者列表将在README中展示
- 重大贡献会在CHANGELOG中提及

---

## 📞 联系方式

- **Issues**: 用于Bug报告和功能建议
- **Discussions**: 用于一般讨论和问题
- **Email**: （如果有）项目维护者邮箱

---

**再次感谢您的贡献！让我们一起把这个项目做得更好！** 🎉
