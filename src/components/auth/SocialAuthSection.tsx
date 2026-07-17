'use client'

import styles from './auth.module.css'

/**
 * Social sign-in section shared by the login and register tabs.
 *
 * One clear visual hierarchy: full-width buttons, brand icons, uniform copy
 * («Продолжить с …») so the same component works for sign-in AND first-time
 * registration (a first successful OAuth creates the account, a repeat OAuth
 * logs into the same one).
 *
 * Only providers with a REAL, working flow are rendered — the parent decides
 * via the `*Enabled` flags. Never show a dead button.
 */

export type SocialProvider = 'vk' | 'yandex' | 'google'

interface SocialAuthSectionProps {
  vkEnabled: boolean
  yandexEnabled: boolean
  googleEnabled: boolean
  /** Provider currently in-flight (redirect pending), or null. */
  loadingProvider: SocialProvider | null
  onVkSignIn: () => void
  onYandexSignIn: () => void
  onGoogleSignIn: () => void
}

function VkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path
        fill="#fff"
        d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.862-.523-2.049-1.714-1.033-1.01-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4.03 8.75 4.03 8.297c0-.254.102-.491.593-.491h1.744c.441 0 .61.203.78.678.863 2.49 2.303 4.675 2.896 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.203.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.253-1.405 2.151-3.574 2.151-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.049.17.491-.085.744-.576.744z"
      />
    </svg>
  )
}

function YandexIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="11" fill="#fff" opacity="0.18" />
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill="#fff"
        fontFamily="Arial, Helvetica, sans-serif"
      >
        Я
      </text>
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  )
}

export default function SocialAuthSection({
  vkEnabled,
  yandexEnabled,
  googleEnabled,
  loadingProvider,
  onVkSignIn,
  onYandexSignIn,
  onGoogleSignIn,
}: SocialAuthSectionProps) {
  if (!vkEnabled && !yandexEnabled && !googleEnabled) return null
  const busy = loadingProvider !== null
  return (
    <div className={styles.socialSection}>
      {vkEnabled && (
        <button
          type="button"
          className={`${styles.socialButton} ${styles.socialVk}`}
          onClick={onVkSignIn}
          disabled={busy}
        >
          <span className={styles.socialIcon}><VkIcon /></span>
          {loadingProvider === 'vk' ? 'Переходим в VK ID…' : 'Продолжить с VK ID'}
        </button>
      )}
      {yandexEnabled && (
        <button
          type="button"
          className={`${styles.socialButton} ${styles.socialYandex}`}
          onClick={onYandexSignIn}
          disabled={busy}
        >
          <span className={styles.socialIcon}><YandexIcon /></span>
          {loadingProvider === 'yandex' ? 'Переходим в Яндекс ID…' : 'Продолжить с Яндекс ID'}
        </button>
      )}
      {googleEnabled && (
        <button
          type="button"
          className={`${styles.socialButton} ${styles.socialGoogle}`}
          onClick={onGoogleSignIn}
          disabled={busy}
        >
          <span className={styles.socialIcon}><GoogleIcon /></span>
          {loadingProvider === 'google' ? 'Переходим в Google…' : 'Продолжить с Google'}
        </button>
      )}
    </div>
  )
}
