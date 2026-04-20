import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { AuthProvider } from './context'
import { Toaster } from 'sonner'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Hệ Thống Quản Lý Karaoke',
  description: 'Hệ thống quản lý karaoke chuyên nghiệp giúp bạn dễ dàng quản lý phòng, đặt lịch, và thanh toán. Tối ưu hóa trải nghiệm khách hàng và tăng doanh thu cho quán karaoke của bạn',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/iconkara.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/iconkara.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/iconkara.png',
        type: 'image/svg+xml',
      },
    ],
    apple: '/iconkara.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#1a1a2e',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster
          position="top-right"
          richColors
          duration={1000}
          closeButton
        />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
