import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 使用自定义 server.js 时需要禁用内置 server 行为
  // 参考：https://nextjs.org/docs/pages/building-your-application/configuring/custom-server
  output: "standalone",

  // 关闭 React 严格模式以避免 DOM 操作类游戏逻辑被双重执行
  reactStrictMode: false,

  // 关闭 X-Powered-By 响应头
  poweredByHeader: false,
};

export default nextConfig;
