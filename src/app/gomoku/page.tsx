"use client";

import Link from "next/link";
import Script from "next/script";
import "@/styles/gomoku.css";

export default function GomokuPage() {
  return (
    <div className="gomoku-page">
      <div className="gomoku-container">
        <header className="gomoku-header">
          <Link href="/" className="back-link">
            <i className="fas fa-arrow-left"></i> 返回游戏选择
          </Link>
          <h1>
            <i className="fas fa-chess-board"></i> 五子棋
          </h1>
        </header>

        <div id="setup-panel" className="setup-panel">
          <div className="mode-group">
            <span className="mode-label">模式</span>
            <div className="mode-btns">
              <button
                type="button"
                className="mode-btn active"
                data-mode="ai"
              >
                人机对战
              </button>
              <button type="button" className="mode-btn" data-mode="online">
                联机对战
              </button>
            </div>
          </div>
          <div id="ai-difficulty-group" className="difficulty-group">
            <span className="difficulty-label">难度</span>
            <div className="difficulty-btns">
              <button
                type="button"
                className="difficulty-btn active"
                data-difficulty="easy"
              >
                简单
              </button>
              <button
                type="button"
                className="difficulty-btn"
                data-difficulty="medium"
              >
                中等
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
          <div id="online-setup" className="online-setup" style={{ display: "none" }}>
            <div className="room-actions">
              <button
                type="button"
                id="btn-create-room"
                className="btn btn-primary"
              >
                <i className="fas fa-plus"></i> 创建房间
              </button>
              <button
                type="button"
                id="btn-refresh-rooms"
                className="btn btn-secondary"
              >
                <i className="fas fa-sync-alt"></i> 刷新
              </button>
            </div>
            <div id="room-list-wrap" className="room-list-wrap">
              <span className="room-list-label">
                房间列表{" "}
                <span id="connection-status" className="connection-status"></span>
              </span>
              <div className="room-list-section">
                <span className="room-section-title">我创建的房间</span>
                <ul id="room-list-my" className="room-list"></ul>
                <p id="room-list-my-empty" className="room-list-empty">
                  暂无，创建后显示
                </p>
              </div>
              <div className="room-list-section">
                <span className="room-section-title">可加入 / 观战的房间</span>
                <ul id="room-list-other" className="room-list"></ul>
                <p id="room-list-other-empty" className="room-list-empty">
                  暂无其他房间
                </p>
              </div>
            </div>
            <div id="room-info" className="room-info" style={{ display: "none" }}>
              <p>
                房间号：<strong id="display-room-id"></strong>
              </p>
              <p id="room-status">等待对手加入...</p>
            </div>
          </div>
          <div id="ai-color-group" className="color-group">
            <span className="color-label">先后手</span>
            <div className="color-btns">
              <button
                type="button"
                className="color-btn active"
                data-color="black"
              >
                黑子（先手）
              </button>
              <button type="button" className="color-btn" data-color="white">
                白子（后手）
              </button>
            </div>
          </div>
          <button
            type="button"
            id="btn-start-ai"
            className="btn btn-primary btn-start"
          >
            <i className="fas fa-play"></i> 开始游戏
          </button>
        </div>

        <div id="game-panel" className="game-panel" style={{ display: "none" }}>
          <div
            id="game-room-info"
            className="game-room-info"
            style={{ display: "none" }}
          >
            房间：<strong id="game-room-id"></strong>
          </div>
          <div className="status-bar">
            <span id="game-status" className="game-status">
              黑方落子
            </span>
            <span id="turn-indicator" className="turn-indicator"></span>
          </div>
          <div className="board-wrap">
            <canvas id="gomoku-board" width={450} height={450}></canvas>
          </div>
          <div id="action-btns" className="action-btns">
            <button type="button" id="btn-undo" className="btn btn-secondary">
              <i className="fas fa-rotate-left"></i> 悔棋
            </button>
            <button type="button" id="btn-resign" className="btn btn-danger">
              <i className="fas fa-flag"></i> 认输
            </button>
            <button type="button" id="btn-back-lobby" className="btn btn-secondary">
              <i className="fas fa-arrow-left"></i> 返回大厅
            </button>
          </div>
          <div
            id="spectator-notice"
            className="spectator-notice"
            style={{ display: "none" }}
          >
            <span>观战中 · 仅可观看，不可操作</span>
            <button
              type="button"
              id="btn-leave-spectate"
              className="btn btn-secondary btn-sm"
            >
              退出观战
            </button>
          </div>
        </div>

        <div
          id="undo-request-modal"
          className="modal"
          style={{ display: "none" }}
        >
          <div className="modal-content modal-sm">
            <div className="modal-header">
              <h2>悔棋请求</h2>
            </div>
            <div className="modal-body">
              <p>对方请求悔棋，是否同意？</p>
            </div>
            <div className="modal-footer">
              <button type="button" id="undo-accept" className="btn btn-primary">
                同意
              </button>
              <button type="button" id="undo-reject" className="btn btn-secondary">
                拒绝
              </button>
            </div>
          </div>
        </div>

        <div
          id="game-over-modal"
          className="modal"
          style={{ display: "none" }}
        >
          <div className="modal-content modal-sm">
            <div className="modal-header">
              <h2 id="game-over-title">游戏结束</h2>
            </div>
            <div className="modal-body">
              <p id="game-over-text"></p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                id="btn-game-over-ok"
                className="btn btn-primary"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      </div>

      <Script
        src="https://cdn.socket.io/4.8.1/socket.io.min.js"
        strategy="beforeInteractive"
      />
      <Script src="/gomoku.js" strategy="afterInteractive" />
    </div>
  );
}
