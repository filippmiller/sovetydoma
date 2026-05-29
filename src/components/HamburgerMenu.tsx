'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CATEGORIES } from '@/lib/categories'

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const overlayRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const firstLinkRef = useRef<HTMLAnchorElement>(null)

  // Close on route change
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // Escape key closes overlay
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
      }
      // Focus trap
      if (e.key === 'Tab') {
        const overlay = overlayRef.current
        if (!overlay) return
        const focusable = overlay.querySelectorAll<HTMLElement>(
          'a, button, [tabindex]:not([tabindex="-1"])'
        )
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // Move focus into overlay when it opens
  useEffect(() => {
    if (open && closeButtonRef.current) {
      closeButtonRef.current.focus()
    }
  }, [open])

  const navLinks = [
    ...Object.values(CATEGORIES).map((cat) => ({ href: `/${cat.slug}`, label: cat.name })),
    { href: '/recepty', label: '🍳 Рецепты' },
    { href: '/search', label: '🔍 Поиск' },
  ]

  return (
    <>
      <button
        className="hamburger-btn"
        aria-label="Открыть меню"
        aria-expanded={open}
        aria-controls="mobile-nav-overlay"
        onClick={() => setOpen(true)}
        style={{
          width: '44px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1.4rem',
          color: '#444',
          borderRadius: '6px',
          flexShrink: 0,
        }}
      >
        ☰
      </button>

      {open && (
        <div
          id="mobile-nav-overlay"
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-label="Меню навигации"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: '#1a1a1a',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          {/* Header row inside overlay */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #333',
          }}>
            <span style={{ color: '#c0392b', fontWeight: 800, fontSize: '1.2rem' }}>
              СоветыДома
            </span>
            <button
              ref={closeButtonRef}
              aria-label="Закрыть меню"
              onClick={() => setOpen(false)}
              style={{
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.6rem',
                color: '#ccc',
                borderRadius: '6px',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* Nav links */}
          <nav aria-label="Мобильная навигация">
            {navLinks.map((link, index) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  ref={index === 0 ? firstLinkRef : undefined}
                  aria-current={isActive ? 'page' : undefined}
                  style={{
                    display: 'block',
                    padding: '1rem 2rem',
                    fontSize: '1.4rem',
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? '#c0392b' : '#f0ede8',
                    textDecoration: 'none',
                    borderBottom: '1px solid #2a2a2a',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#2a2a2a'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent'
                  }}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>
      )}
    </>
  )
}
