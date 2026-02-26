"use client";

import Link from "next/link";
import Script from "next/script";
import "@/styles/sheep.css";

export default function SheepPage() {
  return (
    <>
      <div className="container">
        <header className="header">
          <h1>
            <i className="fas fa-sheep"></i> 羊了个羊
          </h1>
          <div className="stats">
            <div className="stat">
              <span className="stat-label">分数</span>
              <span id="score" className="stat-value">
                0
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">最高分</span>
              <span id="high-score" className="stat-value">
                0
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">步数</span>
              <span id="moves" className="stat-value">
                0
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">槽位</span>
              <span id="slot-count" className="stat-value">
                0/7
              </span>
            </div>
          </div>
        </header>

        <main className="game-area">
          <div id="card-pile" className="card-pile">
            <div className="pile-bg"></div>
          </div>
          <div className="slot-area">
            <div className="slot-title">
              卡槽 <span id="slot-fill">0/7</span>
            </div>
            <div id="card-slot" className="card-slot"></div>
          </div>
          <div className="removed-area">
            <div className="removed-title">
              移出区 <span id="removed-count">0</span>
              <button
                id="btn-clear-removed"
                className="btn-clear-removed"
                title="清空移出区"
              >
                <i className="fas fa-trash"></i>
              </button>
            </div>
            <div className="removed-hint">点击卡片可移回卡槽</div>
            <div id="removed-slot" className="removed-slot"></div>
          </div>
        </main>

        <div className="tools-panel">
          <div className="tool" id="tool-remove">
            <div className="tool-icon">
              <i className="fas fa-trash-arrow-up"></i>
            </div>
            <div className="tool-info">
              <div className="tool-name">移出</div>
              <div className="tool-desc">
                移出前3张到移出区（可叠加，点击移回）
              </div>
            </div>
            <div className="tool-count">3</div>
          </div>
          <div className="tool" id="tool-undo">
            <div className="tool-icon">
              <i className="fas fa-rotate-left"></i>
            </div>
            <div className="tool-info">
              <div className="tool-name">撤销</div>
              <div className="tool-desc">回退上一步</div>
            </div>
            <div className="tool-count">3</div>
          </div>
          <div className="tool" id="tool-shuffle">
            <div className="tool-icon">
              <i className="fas fa-shuffle"></i>
            </div>
            <div className="tool-info">
              <div className="tool-name">洗牌</div>
              <div className="tool-desc">重排可见牌</div>
            </div>
            <div className="tool-count">1</div>
          </div>
          <div className="tool" id="tool-hint">
            <div className="tool-icon">
              <i className="fas fa-lightbulb"></i>
            </div>
            <div className="tool-info">
              <div className="tool-name">提示</div>
              <div className="tool-desc">高亮可消牌</div>
            </div>
            <div className="tool-count">3</div>
          </div>
        </div>

        <div className="difficulty-group">
          <span className="difficulty-label">难度</span>
          <div className="difficulty-btns">
            <button
              type="button"
              className="difficulty-btn"
              data-difficulty="easy"
            >
              简单
            </button>
            <button
              type="button"
              className="difficulty-btn"
              data-difficulty="normal"
            >
              普通
            </button>
            <button
              type="button"
              className="difficulty-btn"
              data-difficulty="hard"
            >
              困难
            </button>
          </div>
        </div>

        <div className="controls">
          <Link
            href="/"
            className="btn btn-secondary"
            style={{ display: "inline-block", textDecoration: "none" }}
          >
            <i className="fas fa-arrow-left"></i> 返回游戏选择
          </Link>
          <button id="btn-new-game" className="btn btn-primary">
            <i className="fas fa-play"></i> 新游戏
          </button>
          <button id="btn-reset" className="btn btn-secondary">
            <i className="fas fa-redo"></i> 重置
          </button>
          <button id="btn-sound" className="btn btn-secondary">
            <i className="fas fa-volume-up"></i> <span>音效</span>
          </button>
          <button id="btn-help" className="btn btn-secondary">
            <i className="fas fa-question-circle"></i> 帮助
          </button>
          <button id="btn-celebration-text" className="btn btn-secondary">
            <i className="fas fa-heart"></i> 庆祝文案
          </button>
        </div>

        <div id="message" className="message"></div>

        <div id="game-over-modal" className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2 id="game-result-title">游戏结束</h2>
              <button className="modal-close">&times;</button>
            </div>
            <div className="modal-body">
              <div id="game-result-icon" className="result-icon">
                <i className="fas fa-trophy"></i>
              </div>
              <p id="game-result-text">你成功消除了所有卡片！</p>
              <div className="result-stats">
                <div className="result-stat">
                  <span className="result-label">分数</span>
                  <span id="final-score" className="result-value">
                    0
                  </span>
                </div>
                <div className="result-stat">
                  <span className="result-label">步数</span>
                  <span id="final-moves" className="result-value">
                    0
                  </span>
                </div>
                <div className="result-stat">
                  <span className="result-label">用时</span>
                  <span id="final-time" className="result-value">
                    0s
                  </span>
                </div>
              </div>
              <div className="game-stats">
                <h4>📊 游戏统计</h4>
                <div className="stats-grid">
                  <div className="stats-item">
                    <span className="stats-number" id="total-games">
                      0
                    </span>
                    <span className="stats-text">总场次</span>
                  </div>
                  <div className="stats-item">
                    <span className="stats-number" id="win-rate">
                      0%
                    </span>
                    <span className="stats-text">胜率</span>
                  </div>
                  <div className="stats-item">
                    <span className="stats-number" id="best-score">
                      0
                    </span>
                    <span className="stats-text">最高分</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button id="btn-play-again" className="btn btn-primary">
                再玩一次
              </button>
              <button id="btn-share" className="btn btn-secondary">
                <i className="fas fa-share"></i> 分享战绩
              </button>
            </div>
          </div>
        </div>

        <div id="help-modal" className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>游戏规则</h2>
              <button className="modal-close">&times;</button>
            </div>
            <div className="modal-body">
              <h3>
                <i className="fas fa-gamepad"></i> 如何玩
              </h3>
              <ul>
                <li>点击上方的卡片，它们会移动到下方卡槽</li>
                <li>当卡槽中出现3张相同的卡片时，它们会自动消除</li>
                <li>如果卡槽被填满（7张不同的牌），游戏结束</li>
                <li>消除所有卡片即可获胜</li>
              </ul>
              <h3>
                <i className="fas fa-layer-group"></i> 金字塔堆叠
              </h3>
              <ul>
                <li>上层卡片可以压在多张下层卡片的交界处</li>
                <li>只有最上面的可见卡片才能点击（灰色卡片不可点击）</li>
                <li>移除上层卡片后，下方被压住的卡片会显示出来</li>
                <li>相同类型的卡片会自动聚集在卡槽中</li>
              </ul>
              <h3>
                <i className="fas fa-toolbox"></i> 道具说明
              </h3>
              <div className="tool-help">
                <div className="tool-help-item">
                  <div className="tool-help-icon">
                    <i className="fas fa-trash-arrow-up"></i>
                  </div>
                  <div className="tool-help-text">
                    <strong>移出</strong>
                    ：将卡槽前三张牌移到移出区暂存，支持叠加，点击移出区卡片可移回卡槽
                  </div>
                </div>
                <div className="tool-help-item">
                  <div className="tool-help-icon">
                    <i className="fas fa-rotate-left"></i>
                  </div>
                  <div className="tool-help-text">
                    <strong>撤销</strong>：撤销最后一步操作
                  </div>
                </div>
                <div className="tool-help-item">
                  <div className="tool-help-icon">
                    <i className="fas fa-shuffle"></i>
                  </div>
                  <div className="tool-help-text">
                    <strong>洗牌</strong>：重新排列当前可见的卡片
                  </div>
                </div>
                <div className="tool-help-item">
                  <div className="tool-help-icon">
                    <i className="fas fa-lightbulb"></i>
                  </div>
                  <div className="tool-help-text">
                    <strong>提示</strong>：高亮显示可以消除的卡片
                  </div>
                </div>
              </div>
              <h3>
                <i className="fas fa-tips"></i> 游戏技巧
              </h3>
              <ul>
                <li>优先消除上层卡片，让下层卡片露出来</li>
                <li>注意观察卡片堆叠情况，规划消除顺序</li>
                <li>不要急于填满卡槽，留出空间应对意外</li>
                <li>合理使用道具，它们能帮你度过难关</li>
              </ul>
              <h3>
                <i className="fas fa-cog"></i> 数据管理
              </h3>
              <div className="data-management">
                <p className="data-info">游戏数据已自动保存在本地</p>
                <button id="btn-clear-data" className="btn btn-secondary">
                  <i className="fas fa-trash"></i> 清除所有数据
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary close-help">开始游戏</button>
            </div>
          </div>
        </div>

        <canvas id="celebration-canvas"></canvas>
      </div>

      <footer className="footer">
        <p>《羊了个羊》实现版 - 仅供学习使用</p>
        <p>基于HTML5、CSS3和JavaScript实现</p>
      </footer>

      <Script
        src="/script.js"
        strategy="afterInteractive"
      />
    </>
  );
}
