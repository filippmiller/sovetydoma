import type { Metadata } from 'next'
import Link from 'next/link'
import { canonicalPath } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Cookies и локальное хранилище',
  description: 'Какие cookies и локальные данные использует 1001sovet.ru: сессия, избранное, тема оформления, аналитика. Как отключить.',
  alternates: { canonical: canonicalPath('/cookies/') },
}

export default function CookiesPage() {
  const year = new Date().getFullYear()
  return (
    <div style={{ maxWidth: '780px', margin: '2rem auto', padding: '0 1rem 4rem', lineHeight: 1.65 }}>
      <nav aria-label="Хлебные крошки" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
        <Link href="/" style={{ color: '#8b5a4a', textDecoration: 'none' }}>Главная</Link>
        <span style={{ color: '#aaa' }}> / </span>
        <span style={{ color: '#777' }}>Cookies</span>
      </nav>

      <h1 style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.5rem' }}>Cookies и локальное хранилище</h1>
      <p style={{ color: '#666', marginBottom: '1.25rem' }}>Последнее обновление: {year}. Минимально необходимый набор.</p>

      <p style={{ color: '#444' }}>
        Мы используем cookies и localStorage только для работы основных функций сайта. Мы не ставим рекламные трекеры третьих сторон и не продаём данные о вашем поведении.
        Это информационная страница, а не юридический документ.
      </p>

      <h2 style={{ fontSize: '1.15rem', margin: '1.5rem 0 0.5rem' }}>Что мы используем и зачем</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
        <thead>
          <tr style={{ background: '#f8f5f2' }}>
            <th style={{ textAlign: 'left', padding: '0.5rem', border: '1px solid #e8e4df' }}>Тип</th>
            <th style={{ textAlign: 'left', padding: '0.5rem', border: '1px solid #e8e4df' }}>Назначение</th>
            <th style={{ textAlign: 'left', padding: '0.5rem', border: '1px solid #e8e4df' }}>Срок</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: '0.5rem', border: '1px solid #e8e4df', verticalAlign: 'top' }}>Supabase session / auth cookies</td>
            <td style={{ padding: '0.5rem', border: '1px solid #e8e4df' }}>Вход, восстановление пароля/ссылки, синхронизация избранного между устройствами.</td>
            <td style={{ padding: '0.5rem', border: '1px solid #e8e4df' }}>Сессия (до выхода) + refresh.</td>
          </tr>
          <tr>
            <td style={{ padding: '0.5rem', border: '1px solid #e8e4df', verticalAlign: 'top' }}>localStorage: favorites</td>
            <td style={{ padding: '0.5rem', border: '1px solid #e8e4df' }}>Сохранённые статьи без входа (работает оффлайн и до регистрации).</td>
            <td style={{ padding: '0.5rem', border: '1px solid #e8e4df' }}>Постоянно (пока не очистите).</td>
          </tr>
          <tr>
            <td style={{ padding: '0.5rem', border: '1px solid #e8e4df', verticalAlign: 'top' }}>localStorage: has_visited / theme</td>
            <td style={{ padding: '0.5rem', border: '1px solid #e8e4df' }}>Скрытие «с чего начать», запомненная тёмная/светлая тема.</td>
            <td style={{ padding: '0.5rem', border: '1px solid #e8e4df' }}>Постоянно.</td>
          </tr>
          <tr>
            <td style={{ padding: '0.5rem', border: '1px solid #e8e4df', verticalAlign: 'top' }}>Analytics / view counters (свои воркеры)</td>
            <td style={{ padding: '0.5rem', border: '1px solid #e8e4df' }}>Агрегированный подсчёт просмотров, популярности, защита от спама. Минимальные технические логи.</td>
            <td style={{ padding: '0.5rem', border: '1px solid #e8e4df' }}>Агрегированные данные — долго; сырые логи — ограниченно.</td>
          </tr>
        </tbody>
      </table>

      <h2 style={{ fontSize: '1.15rem', margin: '1.5rem 0 0.5rem' }}>Как отключить / удалить</h2>
      <ul style={{ paddingLeft: '1.15rem' }}>
        <li>В настройках браузера: блокировка cookies для этого сайта (часть функций авторизации и избранного перестанет работать).</li>
        <li>Очистка localStorage: в devtools → Application → Storage → Clear site data.</li>
        <li>Выход из аккаунта удаляет сессионные cookies Supabase.</li>
        <li>Отписка от email/уведомлений — по ссылке в письме или в личном кабинете.</li>
      </ul>

      <h2 style={{ fontSize: '1.15rem', margin: '1.5rem 0 0.5rem' }}>Сторонние</h2>
      <p style={{ color: '#444' }}>
        Мы не подключаем Google Analytics, Яндекс.Метрику, Facebook Pixel, рекламные сети и прочие внешние трекеры по умолчанию. Если в будущем появятся (например, для видео или шрифтов), обновим эту страницу и добавим disclosure.
      </p>

      <p style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: '#888' }}>
        Вопросы по cookies и данным — через <Link href="/contact/" style={{ color: '#c0392b' }}>контакты</Link>. Подробности обработки персональных данных — в <Link href="/privacy/" style={{ color: '#c0392b' }}>Политике конфиденциальности</Link>.
      </p>

      <p style={{ marginTop: '1rem' }}>
        <Link href="/" style={{ color: '#c0392b' }}>← На главную</Link>
      </p>
    </div>
  )
}
