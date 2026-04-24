import type { Metadata } from 'next'
import './globals.css'
import Layout from '@/components/Layout'

export const metadata: Metadata = {
  title: 'абхазхаб - Агрегатор поставщиков',
  description: 'Сервис агрегации оптовой продукции для магазинов и ресторанов',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body className="font-sans">
        <Layout>{children}</Layout>
      </body>
    </html>
  )
}

