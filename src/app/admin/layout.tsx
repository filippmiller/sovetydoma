import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'Панель управления — СоветыДома' },
  robots: { index: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f4', fontFamily: "'PT Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {children}
    </div>
  )
}
