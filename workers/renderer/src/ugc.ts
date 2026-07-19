export interface DynamicQuestion {
  slug: string
  title: string
  answers_count: number | null
}

export interface DynamicComment {
  id: string
  content: string
  parent_id: string | null
  created_at: string
  profiles?: { display_name?: string | null } | Array<{ display_name?: string | null }> | null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function pluralAnswers(value: number): string {
  const m10 = value % 10
  const m100 = value % 100
  if (m10 === 1 && m100 !== 11) return 'ответ'
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'ответа'
  return 'ответов'
}

function emptyState(icon: string, text: string): string {
  return `<div style="text-align:center;color:#777;background:#faf9f7;border:1.5px dashed #e8e4df;border-radius:12px;padding:1.75rem 1rem"><div style="font-size:1.6rem;margin-bottom:0.4rem">${icon}</div><p style="margin:0;font-size:0.92rem">${escapeHtml(text)}</p></div>`
}

// Anonymous question/comment submission goes to the photo-upload worker, which
// persists into the matching table (pending → moderation). connect-src on the
// site CSP allows *.workers.dev, so this fetch is permitted from the dynamic page.
const UGC_WORKER = 'https://sovetydoma-photo-upload.filippmiller.workers.dev'

/**
 * Progressive-enhancement "ask a question" form for dynamic (renderer-served)
 * pages. Next hydration is stripped on these pages, so the React block is dead;
 * this self-contained vanilla form + inline script restores the write path. The
 * script carries a `type` attribute so the renderer's Flight-chunk strip
 * (which only removes typeless inline scripts) never touches it.
 */
function askQuestionForm(articleSlug: string): string {
  const sid = 'aq_' + articleSlug.replace(/[^a-z0-9]+/gi, '').slice(0, 32)
  const sidJson = JSON.stringify(sid)
  const slugJson = JSON.stringify(articleSlug)
  const workerJson = JSON.stringify(UGC_WORKER)
  return `<div id="${escapeHtml(sid)}" style="margin-top:1.25rem;background:#faf9f7;border:1px solid #ede9e4;border-radius:12px;padding:1rem 1.1rem">`
    + '<div style="font-weight:700;color:#1a1a1a;font-size:0.95rem;margin-bottom:0.5rem">Есть вопрос по теме?</div>'
    + '<textarea data-aq-input maxlength="500" rows="3" placeholder="Ваш вопрос…" style="width:100%;box-sizing:border-box;border:1.5px solid #e5e1db;border-radius:8px;padding:0.6rem 0.75rem;font-size:0.92rem;font-family:inherit;resize:vertical"></textarea>'
    + '<div data-aq-msg role="status" style="font-size:0.82rem;margin:0.4rem 0 0;min-height:1.1em"></div>'
    + '<button type="button" data-aq-send style="margin-top:0.5rem;background:#c0392b;color:#fff;border:none;border-radius:8px;padding:0.55rem 1.1rem;font-weight:700;font-size:0.9rem;cursor:pointer">Отправить вопрос</button>'
    + '</div>'
    + `<script type="text/javascript">(function(){`
    + `var root=document.getElementById(${sidJson});if(!root||root.dataset.aqBound)return;root.dataset.aqBound='1';`
    + `var ta=root.querySelector('[data-aq-input]'),btn=root.querySelector('[data-aq-send]'),msg=root.querySelector('[data-aq-msg]');`
    + `btn.addEventListener('click',function(){var q=(ta.value||'').trim();`
    + `if(q.length<5){msg.style.color='#c0392b';msg.textContent='Вопрос слишком короткий';return;}`
    + `if(q.length>500){msg.style.color='#c0392b';msg.textContent='Максимум 500 символов';return;}`
    + `btn.disabled=true;msg.style.color='#777';msg.textContent='Отправляем…';`
    + `fetch(${workerJson}+'/article-question',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({article_slug:${slugJson},question:q})})`
    + `.then(function(r){return r.json().catch(function(){return {};});})`
    + `.then(function(d){if(d&&d.success){ta.value='';msg.style.color='#166534';msg.textContent='Спасибо! Вопрос отправлен на модерацию и появится после проверки.';}else{msg.style.color='#c0392b';msg.textContent='Не удалось отправить. Попробуйте позже.';btn.disabled=false;}})`
    + `.catch(function(){msg.style.color='#c0392b';msg.textContent='Сеть недоступна. Попробуйте позже.';btn.disabled=false;});});`
    + `})();</script>`
}

/**
 * Progressive-enhancement comment form for dynamic (renderer-served) pages.
 * Same rationale as askQuestionForm: React Comments.tsx is dead after hydration
 * strip, so this vanilla form + typed inline script POSTs to the worker.
 */
function commentForm(articleSlug: string): string {
  const sid = 'ac_' + articleSlug.replace(/[^a-z0-9]+/gi, '').slice(0, 32)
  const sidJson = JSON.stringify(sid)
  const slugJson = JSON.stringify(articleSlug)
  const workerJson = JSON.stringify(UGC_WORKER)
  return `<div id="${escapeHtml(sid)}" style="margin-top:1.25rem;background:#faf9f7;border:1px solid #ede9e4;border-radius:12px;padding:1rem 1.1rem">`
    + '<div style="font-weight:700;color:#1a1a1a;font-size:0.95rem;margin-bottom:0.5rem">Оставить комментарий</div>'
    + '<textarea data-ac-input maxlength="2000" rows="3" placeholder="Ваш комментарий…" style="width:100%;box-sizing:border-box;border:1.5px solid #e5e1db;border-radius:8px;padding:0.6rem 0.75rem;font-size:0.92rem;font-family:inherit;resize:vertical"></textarea>'
    + '<div data-ac-msg role="status" style="font-size:0.82rem;margin:0.4rem 0 0;min-height:1.1em"></div>'
    + '<button type="button" data-ac-send style="margin-top:0.5rem;background:#c0392b;color:#fff;border:none;border-radius:8px;padding:0.55rem 1.1rem;font-weight:700;font-size:0.9rem;cursor:pointer">Отправить</button>'
    + '</div>'
    + `<script type="text/javascript">(function(){`
    + `var root=document.getElementById(${sidJson});if(!root||root.dataset.acBound)return;root.dataset.acBound='1';`
    + `var ta=root.querySelector('[data-ac-input]'),btn=root.querySelector('[data-ac-send]'),msg=root.querySelector('[data-ac-msg]');`
    + `btn.addEventListener('click',function(){var c=(ta.value||'').trim();`
    + `if(c.length<1){msg.style.color='#c0392b';msg.textContent='Напишите комментарий';return;}`
    + `if(c.length>2000){msg.style.color='#c0392b';msg.textContent='Максимум 2000 символов';return;}`
    + `btn.disabled=true;msg.style.color='#777';msg.textContent='Отправляем…';`
    + `fetch(${workerJson}+'/article-comment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({article_slug:${slugJson},content:c})})`
    + `.then(function(r){return r.json().catch(function(){return {};});})`
    + `.then(function(d){if(d&&d.success){ta.value='';msg.style.color='#166534';msg.textContent='Спасибо! Комментарий отправлен на модерацию.';}else{msg.style.color='#c0392b';msg.textContent='Не удалось отправить. Попробуйте позже.';btn.disabled=false;}})`
    + `.catch(function(){msg.style.color='#c0392b';msg.textContent='Сеть недоступна. Попробуйте позже.';btn.disabled=false;});});`
    + `})();</script>`
}

export function buildQuestionsHtml(rows: DynamicQuestion[] | null, articleSlug: string): string {
  const heading = '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;margin-bottom:1rem"><h2 style="margin:0;font-size:1.2rem;font-weight:800;color:#1a1a1a">❓ Вопросы по статье</h2></div>'
  const form = askQuestionForm(articleSlug)
  if (rows === null) {
    return heading + emptyState('🕓', 'Вопросы временно недоступны. Попробуйте обновить страницу позже.') + form
  }
  if (rows.length === 0) {
    return heading + emptyState('💬', 'Пока вопросов нет. Задайте первый!') + form
  }
  const items = rows.map((row) => {
    const count = Math.max(0, row.answers_count ?? 0)
    const meta = count > 0 ? `💬 ${count} ${pluralAnswers(count)}` : 'Пока без ответа'
    return `<a href="/q/${encodeURIComponent(row.slug)}/" style="text-decoration:none"><div style="background:#faf9f7;border:1px solid #ede9e4;border-radius:10px;padding:0.9rem 1.1rem"><div style="font-weight:700;color:#1a1a1a;font-size:0.95rem">${escapeHtml(row.title)}</div><div style="font-size:0.78rem;color:#888;margin-top:0.3rem">${meta}</div></div></a>`
  }).join('')
  return `${heading}<div style="display:flex;flex-direction:column;gap:0.75rem">${items}</div>${form}`
}

function commentAuthor(row: DynamicComment): string {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
  const name = profile?.display_name?.trim()
  return name || 'Читатель'
}

export function buildCommentsHtml(rows: DynamicComment[] | null, articleSlug: string): string {
  const count = rows?.length ?? 0
  const countBadge = rows === null ? '' : `<span style="background:#f0ede8;color:#666;border-radius:999px;font-size:0.78rem;font-weight:700;padding:0.15rem 0.6rem;line-height:1.5">${count}</span>`
  const heading = `<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:1.25rem"><h2 style="margin:0;font-size:1.2rem;font-weight:800;color:#1a1a1a">💬 Комментарии</h2>${countBadge}</div>`
  const form = commentForm(articleSlug)
  if (rows === null) {
    return heading + emptyState('🕓', 'Комментарии временно недоступны. Попробуйте обновить страницу позже.') + form
  }
  if (rows.length === 0) {
    return heading + emptyState('💭', 'Комментариев пока нет.') + form
  }
  const items = rows.map((row) => {
    const isReply = Boolean(row.parent_id)
    const date = new Date(row.created_at)
    const formatted = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    return `<article style="${isReply ? 'margin-left:2rem;border-left:3px solid #eee;padding-left:1rem;' : ''}border-bottom:1px solid #f0ede8;padding-bottom:0.9rem"><div style="font-size:0.82rem;font-weight:700;color:#1a1a1a">${escapeHtml(commentAuthor(row))}</div>${formatted ? `<div style="font-size:0.72rem;color:#888;margin-top:0.15rem">${escapeHtml(formatted)}</div>` : ''}<p style="margin:0.45rem 0 0;color:#333;font-size:0.93rem;line-height:1.65;white-space:pre-wrap">${escapeHtml(row.content)}</p></article>`
  }).join('')
  return `${heading}<div style="display:flex;flex-direction:column;gap:1rem">${items}</div>${form}`
}
