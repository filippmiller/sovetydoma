'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Profile } from '@/lib/supabase'
import AuthModal from './AuthModal'
import { migrateLocalFavoritesToServer, clearLocalFavorites, processPendingFavoriteIntent } from '@/lib/favorites'
import { OPEN_AUTH_EVENT } from '@/lib/auth-gate'
import { readAuthHash, getAuthHashParams, clearAuthHash } from '@/lib/auth/recovery-hash'
import { getConsentStatus, submitAuthenticatedConsent } from '@/lib/privacy/privacy-worker-client'

export default function AuthButton() {
  const authConfigured = isSupabaseConfigured()
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  // True when the user arrived via a password-reset link — opens the modal
  // straight on the "set new password" form, even if a (recovery) session exists.
  const [recovery, setRecovery] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  // 152-FZ (canon §1.1, audit 2026-08-18, P1 fix): VK ID / Yandex sign-in both
  // land here (their Supabase magic link's redirect_to always resolves to a
  // page rendering this header, not the dedicated /auth/callback/ page — VK's
  // static callback page and Yandex's exchange both hand off to Supabase's
  // action-link redirect, which this hash handler below is the single actual
  // choke point for). Neither flow ever shows RegisterForm's terms/privacy
  // checkboxes, so a social account could otherwise reach a live session with
  // zero consent_events evidence. Gated here, once, only when something is
  // actually missing for THIS user — an email/password signup already has
  // both rows (RegisterForm writes them before the confirmation link is even
  // followed), so this never re-prompts that path.
  const [consentGate, setConsentGate] = useState(false)
  const [consentChecked, setConsentChecked] = useState(false)
  const [consentBusy, setConsentBusy] = useState(false)
  const [consentError, setConsentError] = useState('')

  const closeModal = () => {
    setModalOpen(false)
    if (recovery) {
      setRecovery(false)
      // The recovery hash was already stripped from the URL by the early
      // sanitizer (app/layout.tsx, bead 0h3.11). Drop the stashed copy so a
      // refresh doesn't re-open the reset form.
      clearAuthHash()
    }
  }

  // Supabase action links (recovery, magiclink, signup, invite) return session
  // tokens in the URL hash. The root-layout sanitizer removes that hash before
  // analytics can see it and stashes it in sessionStorage, so establish the
  // session explicitly for every auth type — not only password recovery.
  useEffect(() => {
    if (!authConfigured || typeof window === 'undefined') return
    const hash = readAuthHash()
    if (!hash) return
    const params = getAuthHashParams()
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    const isRecovery = params.get('type') === 'recovery'
    let cancelled = false
    ;(async () => {
      if (access_token && refresh_token) {
        try {
          const { data, error } = await getSupabase().auth.setSession({ access_token, refresh_token })
          if (error || !data.session) throw error || new Error('auth_session_missing')
        } catch (error) {
          // Never log the tokens; retain the stashed hash so the user can retry
          // after a transient failure or see the recovery form's own error.
          console.error('auth_hash_session_failed', error instanceof Error ? error.name : 'unknown_error')
          if (!cancelled && isRecovery) {
            setRecovery(true)
            setModalOpen(true)
          }
          return
        }
      } else if (!isRecovery) {
        return
      }
      if (cancelled) return
      if (isRecovery) {
        setRecovery(true)
        setModalOpen(true)
        return
      }

      // Magic-link/signup/invite is complete: discard the one-time token copy
      // and the pre-auth redirect hint, then land in the authenticated cabinet
      // — unless this account is missing consent evidence (152-FZ P1 fix
      // above), in which case show the gate first and redirect only after it
      // resolves. Fails OPEN on our own status-check failure (network blip,
      // worker down): never let this block a legitimate sign-in.
      clearAuthHash()
      try { window.sessionStorage.removeItem('auth_redirect_to') } catch { /* ignore */ }
      const consent = await getConsentStatus()
      if (!cancelled && consent.ok && !(consent.terms && consent.privacyPolicy)) {
        setConsentGate(true)
        return
      }
      if (window.location.pathname !== '/moy-kabinet/') {
        window.location.replace('/moy-kabinet/')
      }
    })()
    return () => { cancelled = true }
  }, [authConfigured])

  const handleConsentGateAccept = async () => {
    if (!consentChecked) return
    setConsentBusy(true)
    setConsentError('')
    const [termsOk, privacyOk] = await Promise.all([
      submitAuthenticatedConsent('terms'),
      submitAuthenticatedConsent('privacy_policy'),
    ])
    setConsentBusy(false)
    if (!termsOk || !privacyOk) {
      setConsentError('Не удалось сохранить согласие. Попробуйте ещё раз.')
      return
    }
    setConsentGate(false)
    if (window.location.pathname !== '/moy-kabinet/') {
      window.location.replace('/moy-kabinet/')
    }
  }

  useEffect(() => {
    if (!authConfigured) return
    let alive = true
    const sb = getSupabase()

    const loadProfile = async (userId: string, user?: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any

      setProfile(null)
      const { data: p } = await sb
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      if (p) {
        setProfile(p as Profile)
        return
      }
      // P1 profile reliability fallback: create missing profile row after auth
      if (user) {
        const display_name = user.user_metadata?.display_name || user.email?.split('@')[0] || 'Пользователь'
        const { error: upErr } = await sb
          .from('profiles')
          .upsert({
            id: userId,
            display_name,
            bio: '',
            avatar_url: '',
            role: 'user' as any, // eslint-disable-line @typescript-eslint/no-explicit-any

            articles_count: 0,
          }, { onConflict: 'id' })
        if (!upErr) {
          const { data: newP } = await sb
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle()
          if (newP && alive) setProfile(newP as Profile)
        }
      }
    }

    sb.auth.getUser().then(({ data }) => {
      if (!alive) return
      const u = data.user
      setUser(u ?? null)
      if (u) {
        loadProfile(u.id, u).catch(() => {})
        // Catch any local favorites from before this page load / previous anon session.
        // migrate() no longer takes/ trusts caller id — it reads the real session.
        migrateLocalFavoritesToServer().catch(() => {})
        processPendingFavoriteIntent().catch(() => {})
      }
    }).catch(() => {})

    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      if (!alive) return
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        loadProfile(u.id, u).catch(() => {})
        // Migrate pending local favorites (covers post-login, recovery, cross-tab, etc.)
        // Also process explicit auth intent (favorite while logged-out) if present.
        migrateLocalFavoritesToServer().catch(() => {})
        processPendingFavoriteIntent().catch(() => {})
      } else {
        setProfile(null)
      }

      // P0: When user follows password reset link, open the auth modal in reset mode
      if (event === 'PASSWORD_RECOVERY') {
        setRecovery(true)
        setModalOpen(true)
      }
    })

    return () => {
      alive = false
      subscription.unsubscribe()
    }
  }, [authConfigured])

  // Let any widget (reactions, ratings, feedback) request the login modal.
  useEffect(() => {
    const open = () => setModalOpen(true)
    window.addEventListener(OPEN_AUTH_EVENT, open)
    return () => window.removeEventListener(OPEN_AUTH_EVENT, open)
  }, [])

  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  if (!authConfigured) return null

  if (consentGate) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Подтверждение согласия"
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem',
        }}
      >
        <div style={{
          background: '#fff', borderRadius: '14px', padding: '1.5rem',
          maxWidth: '420px', width: '100%', textAlign: 'left',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.75rem', color: '#1a1a1a' }}>
            Ещё один шаг
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#666', margin: '0 0 1rem', lineHeight: 1.5 }}>
            Прежде чем продолжить, подтвердите согласие с условиями использования сайта и обработкой персональных данных.
          </p>
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.85rem', color: '#444', marginBottom: '1rem', lineHeight: 1.4 }}>
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              style={{ marginTop: '0.2rem' }}
            />
            <span>
              Я согласен(а) с <a href="/terms" target="_blank">Условиями использования</a> и даю согласие
              на обработку персональных данных в соответствии с <a href="/privacy" target="_blank">Политикой конфиденциальности</a>.
            </span>
          </label>
          {consentError && <p style={{ color: '#c0392b', fontSize: '0.85rem', marginBottom: '0.75rem' }} role="alert">{consentError}</p>}
          <button
            type="button"
            onClick={handleConsentGateAccept}
            disabled={!consentChecked || consentBusy}
            style={{
              width: '100%', padding: '0.75rem 1rem',
              background: consentChecked ? '#2e7d32' : '#9db99f',
              color: '#fff', border: 'none', borderRadius: '8px',
              fontSize: '0.9rem', fontWeight: 600,
              cursor: consentChecked ? 'pointer' : 'not-allowed',
            }}
          >
            {consentBusy ? 'Сохраняем…' : 'Продолжить'}
          </button>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          aria-label="Войти или зарегистрироваться"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#c0392b',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 14px',
            minHeight: '38px',
            fontSize: '0.9rem',
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 0.2s',
          }}
        >
          <span aria-hidden="true">👤</span>
          Войти
        </button>
        <AuthModal isOpen={modalOpen} forceReset={recovery} onClose={closeModal} />
      </>
    )
  }

  const displayName = profile?.display_name || user.email?.split('@')[0] || 'Пользователь'
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Recovery link can arrive while a (recovery) session already exists —
          keep the modal available in the logged-in state too. */}
      <AuthModal isOpen={modalOpen} forceReset={recovery} onClose={closeModal} />
      <button
        onClick={() => setDropdownOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={dropdownOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: '1.5px solid #e0dbd5',
          borderRadius: '20px',
          padding: '3px 10px 3px 3px',
          cursor: 'pointer',
          fontSize: '0.82rem',
          fontWeight: 600,
          color: '#333',
        }}
      >
        <span style={{
          width: '26px',
          height: '26px',
          borderRadius: '50%',
          backgroundColor: '#c0392b',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.7rem',
          fontWeight: 800,
          flexShrink: 0,
        }}>
          {initials}
        </span>
        <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName}
        </span>
        <span style={{ fontSize: '0.65rem', color: '#aaa' }}>▾</span>
      </button>

      {dropdownOpen && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 'calc(100% + 6px)',
          background: '#fff',
          border: '1px solid #e8e4df',
          borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          minWidth: '170px',
          zIndex: 200,
          overflow: 'hidden',
        }}>
          <Link href="/moy-kabinet/" onClick={() => setDropdownOpen(false)} style={dropItemStyle}>
            👤 Мой кабинет
          </Link>
          <Link href="/napisat/" onClick={() => setDropdownOpen(false)} style={dropItemStyle}>
            ✏️ Написать статью
          </Link>
          <hr style={{ margin: '0', border: 'none', borderTop: '1px solid #f0ede8' }} />
          <button
            onClick={async () => {
              setDropdownOpen(false)
              await getSupabase().auth.signOut().catch(() => {})
              // Privacy fix (browser QA): clear local favorites cache so hearts don't stay "saved"
              // after logout on a shared device. Server side is authoritative for the account.
              clearLocalFavorites()
              window.location.reload()
            }}
            style={{ ...dropItemStyle, width: '100%', textAlign: 'left', background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer' }}
          >
            Выйти
          </button>
        </div>
      )}
    </div>
  )
}

const dropItemStyle: React.CSSProperties = {
  display: 'block',
  padding: '0.6rem 1rem',
  fontSize: '0.88rem',
  color: '#333',
  textDecoration: 'none',
  transition: 'background 0.15s',
}
