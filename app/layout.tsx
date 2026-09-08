import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'TK 手机壳运营工作台',description:'店铺数据、内容表现与每日巡检'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>;}