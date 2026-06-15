/**
 * Pure string-in / string-out error mappers for auth flows.
 * Extracted from AuthModal.tsx – no imports, no side effects.
 */

export function mapAuthError(raw: string | undefined | null): string {
  const m = (raw || '').toLowerCase()
  if (m.includes('invalid login') || m.includes('invalid credentials')) {
    return 'Неверный email или пароль.'
  }
  if (m.includes('email not confirmed')) {
    return 'Email ещё не подтверждён. Проверьте письмо с подтверждением или запросите его повторно.'
  }
  if (m.includes('rate limit') || m.includes('too many') || m.includes('email rate')) {
    return 'Слишком много попыток. Подождите немного и попробуйте позже.'
  }
  if (m.includes('password') && (m.includes('at least') || m.includes('weak') || m.includes('short') || m.includes('8'))) {
    return 'Пароль должен быть не короче 8 символов.'
  }
  if (m.includes('already registered') || m.includes('user already registered')) {
    return 'Аккаунт с таким email уже существует. Войдите или восстановите пароль.'
  }
  if (m.includes('invalid email') || m.includes('email address')) {
    return 'Введите корректный email адрес.'
  }
  // Do not leak internal details or enumeration
  return 'Не удалось выполнить действие. Проверьте данные и попробуйте позже.'
}

export function mapVkAuthError(raw: string): string {
  if (raw === 'vk_api_not_configured') return 'VK ID пока не настроен на сервере.'
  if (raw === 'vk_email_missing') return 'VK ID не вернул email. Попробуйте другой способ входа.'
  if (raw === 'rate_limited') return 'Слишком много попыток входа через VK ID. Попробуйте позже.'
  return 'Не удалось войти через VK ID. Попробуйте позже или войдите по email.'
}

export function mapOAuthError(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('provider_not_enabled') || m.includes('provider is not enabled')) {
    return 'Этот способ входа пока не настроен. Попробуйте войти по email.'
  }
  if (m.includes('popup') || m.includes('blocked')) {
    return 'Всплывающее окно заблокировано. Разрешите всплывающие окна для этого сайта.'
  }
  if (m.includes('network') || m.includes('fetch')) {
    return 'Проблема с соединением. Проверьте интернет и попробуйте снова.'
  }
  return 'Не удалось войти через соцсеть. Попробуйте другой способ.'
}
