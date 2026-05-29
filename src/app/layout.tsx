import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '智美天工 | AI智能运营中台',
  description: '服务医美机构的 AI 智能运营中台。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
