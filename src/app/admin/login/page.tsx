
import AdminLoginForm from '@/components/admin/AdminLoginForm'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'Вход — Панель управления СоветыДома' },
  robots: { index: false },
}

export default function AdminLoginPage() {
  return <AdminLoginForm />
}
