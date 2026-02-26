import Link from "next/link";
import "@/styles/selection.css";

export default function HomePage() {
  return (
    <>
      <div className="selection-container">
        <h1>
          <i className="fas fa-gamepad"></i> 游戏大厅
        </h1>
        <p className="subtitle">选择一款游戏开始</p>
        <div className="game-cards">
          <Link href="/sheep" className="game-card sheep">
            <span className="game-card-icon">
              <i className="fas fa-sheep"></i>
            </span>
            <h2>羊了个羊</h2>
            <p>三消消除，金字塔堆叠，挑战你的策略与运气</p>
          </Link>
          <Link href="/gomoku" className="game-card gomoku">
            <span className="game-card-icon">
              <i className="fas fa-chess-board"></i>
            </span>
            <h2>五子棋</h2>
            <p>人机对战或联机对战，支持悔棋与认输</p>
          </Link>
        </div>
      </div>
      <footer className="selection-footer">
        <p>基于 HTML5、CSS3 和 JavaScript 实现</p>
      </footer>
    </>
  );
}
