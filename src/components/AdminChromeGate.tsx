'use client'

import { usePathname } from 'next/navigation'

/**
 * Hides the public site chrome (header/footer) on the admin section. The admin
 * area has its own navigation (AdminShell) and a dedicated /admin/login form, so
 * the public reader header — including the "Войти" reader auth modal — must not
 * appear there. Children are passed in already server-rendered, so this only
 * adds a tiny client gate, not client JS for the header itself.
 */
export default function AdminChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname?.startsWith('/admin')) return null
  return <>{children}</>
}
