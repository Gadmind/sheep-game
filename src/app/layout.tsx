import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "游戏大厅",
  description: "羊了个羊、五子棋等多款小游戏",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Noto+Sans+SC:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col items-center justify-center p-5">
        {children}
      </body>
    </html>
  );
}
