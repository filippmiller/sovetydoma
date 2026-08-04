'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = { href: string; icon: string; label: string; home?: boolean; accent?: boolean }

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Открыть',
    items: [
      { href: '/', icon: '⌂', label: 'Лента', home: true },
      { href: '/articles/', icon: '▦', label: 'Все статьи' },
      { href: '/search/', icon: '⌕', label: 'Поиск' },
      { href: '/tag/', icon: '◈', label: 'Темы' },
    ],
  },
  {
    label: 'Популярное',
    items: [
      { href: '/kulinaria/', icon: '✦', label: 'Кулинария' },
      { href: '/dom-i-uborka/', icon: '◫', label: 'Дом и уборка' },
      { href: '/layfkhaki/', icon: '✧', label: 'Лайфхаки' },
      { href: '/ekonomiya/', icon: '◉', label: 'Экономия' },
    ],
  },
  {
    label: 'Моё',
    items: [
      { href: '/izbrannoe/', icon: '♡', label: 'Избранное' },
      { href: '/moy-kabinet/', icon: '◉', label: 'Мой кабинет' },
      { href: '/napisat/', icon: '✎', label: 'Написать статью' },
    ],
  },
]

// Seasonal quick links for discovery block
const seasonalLinks = [
  { href: '/dacha-i-ogorod/', label: 'Дача и огород' },
  { href: '/layfkhaki/', label: 'Лайфхаки' },
  { href: '/dom-i-uborka/', label: 'Уборка' },
]

export default function FeedLeftNav() {
  const pathname = usePathname() || '/'
  const currentPath = pathname.replace(/\/$/, '') || '/'

  return (
    <nav className="feed-left-nav" aria-label="Разделы СоветыДома">
      <div className="feed-left-nav-brand">
        <span aria-hidden="true">✦</span>
        <div>
          <strong>СоветыДома</strong>
          <small>советы для дома</small>
        </div>
      </div>

      <div className="feed-left-nav-discovery">
        <h2 className="feed-left-nav-title">Сегодня полезно</h2>
        <div className="feed-left-nav-discovery-links">
          {seasonalLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      {groups.map((group) => (
        <div className="feed-left-nav-group" key={group.label}>
          <h2 className="feed-left-nav-title">{group.label}</h2>
          {group.items.map((item) => {
            const itemPath = item.href.split('#', 1)[0].replace(/\/$/, '') || '/'
            const active = item.home
              ? currentPath === '/'
              : !item.href.includes('#') &&
                (currentPath === itemPath || currentPath.startsWith(`${itemPath}/`))
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`feed-left-nav-item${active ? ' active' : ''}${item.accent ? ' accent' : ''}`}
              >
                <span aria-hidden="true" className="feed-left-nav-icon">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      ))}

      <Link href="/podpiski/" className="feed-left-nav-plan">
        <span className="feed-left-nav-plan-icon" aria-hidden="true">
          ✉
        </span>
        <span>
          <strong>Подпишитесь</strong>
          <small>новые советы каждую неделю</small>
        </span>
        <b aria-hidden="true">→</b>
      </Link>
    </nav>
  )
}
