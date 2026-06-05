'use client'

import Link from 'next/link'

export default function TermsPage() {
  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '0 1rem 4rem', lineHeight: 1.6 }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '1rem' }}>Условия использования</h1>

      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        Это заглушка. Полный текст Условий использования будет подготовлен владельцем проекта.
        Используя сайт 1001sovet.ru, вы соглашаетесь с текущими условиями.
      </p>

      <h2 style={{ fontSize: '1.1rem', marginTop: '1.5rem' }}>Основные положения (кратко)</h2>
      <ul style={{ paddingLeft: '1.2rem' }}>
        <li>Контент сайта предназначен для личного некоммерческого использования.</li>
        <li>Пользователи могут оставлять комментарии, сохранять статьи и публиковать свои материалы (после модерации).</li>
        <li>Администрация не несёт ответственности за точность пользовательского контента.</li>
        <li>Запрещено размещение спама, оскорблений, незаконного контента.</li>
      </ul>

      <p style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#888' }}>
        Полная версия будет опубликована позже. По вопросам — свяжитесь через форму на странице Контакты.
      </p>

      <p style={{ marginTop: '1rem' }}>
        <Link href="/" style={{ color: '#c0392b' }}>← Вернуться на главную</Link>
      </p>
    </div>
  )
}
