'use client'

import { ChangeEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { uploadToR2 } from '@/lib/photos'

const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const SUPPORTED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export default function NapisatPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const [content, setContent] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user
      if (!user) {
        router.replace('/')
        return
      }
      setUserId(user.id)
      setLoading(false)
    })
  }, [router])

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
  }, [photoPreview])

  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const candidate = event.target.files?.[0] || null
    event.target.value = ''
    if (!candidate) return
    if (!SUPPORTED_PHOTO_TYPES.has(candidate.type)) {
      setError('Поддерживаются фотографии JPG, PNG и WebP.')
      return
    }
    if (candidate.size > MAX_PHOTO_BYTES) {
      setError('Фотография должна быть не больше 5 МБ.')
      return
    }
    setError('')
    setPhoto(candidate)
    setPhotoPreview(URL.createObjectURL(candidate))
  }

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhoto(null)
    setPhotoPreview(null)
  }

  const resetForm = () => {
    clearPhoto()
    setSuccess(null)
    setTitle('')
    setContent('')
    setTags('')
  }

  const submit = async (status: 'draft' | 'pending') => {
    if (!userId) return
    if (!title.trim()) {
      setError('Введите название рецепта.')
      return
    }
    if (!content.trim()) {
      setError('Опишите ингредиенты и шаги приготовления.')
      return
    }
    setError('')
    setSubmitting(true)

    let photoPath: string | null = null
    if (photo) {
      const upload = await uploadToR2({ file: photo, articleSlug: `recipe-${crypto.randomUUID()}` })
      if (!upload.ok) {
        setSubmitting(false)
        setError('Не удалось загрузить фотографию. Рецепт не отправлен.')
        return
      }
      photoPath = upload.key
    }

    const tagList = tags.split(',').map((tag) => tag.trim()).filter(Boolean)
    const { error: insertError } = await supabase.from('user_articles').insert({
      author_id: userId,
      title: title.trim(),
      category: 'kulinaria',
      tags: tagList,
      content: content.trim(),
      photo_path: photoPath,
      status,
    })

    setSubmitting(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setSuccess(status === 'draft' ? 'Черновик рецепта сохранён!' : 'Ваш рецепт отправлен на проверку!')
  }

  if (loading) {
    return <div style={pageMessageStyle}>Загрузка…</div>
  }

  if (success) {
    return (
      <div style={{ ...pageMessageStyle, maxWidth: '600px' }}>
        <div style={successCardStyle}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
          <h2 style={{ color: '#247447', margin: '0 0 0.5rem', fontSize: '1.2rem' }}>{success}</h2>
          <p style={{ color: '#555', fontSize: '0.93rem', margin: 0 }}>Статус можно посмотреть в разделе «Мои статьи» кабинета.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/moy-kabinet/" style={redLinkStyle}>Моя лента</Link>
          <button type="button" onClick={resetForm} style={outlineButtonStyle}>Опубликовать ещё рецепт</button>
        </div>
      </div>
    )
  }

  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
      <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 850, color: '#1a1a1a', margin: '0 0 0.25rem' }}>Опубликовать ваш рецепт</h1>
          <p style={{ color: '#777', fontSize: '0.92rem', margin: 0 }}>Поделитесь блюдом, ингредиентами, шагами и фотографией.</p>
        </div>
        <button type="button" onClick={() => setPreview((current) => !current)} style={outlineButtonStyle}>
          {preview ? '✏️ Редактор' : '👁 Предпросмотр'}
        </button>
      </header>

      {preview ? (
        <section style={previewCardStyle}>
          {photoPreview && (
            // eslint-disable-next-line @next/next/no-img-element -- selected local Blob URL cannot use Next image optimization.
            <img src={photoPreview} alt="Предпросмотр фотографии рецепта" style={previewImageStyle} />
          )}
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.5rem' }}>{title || '(без названия)'}</h2>
          {tags && <div style={{ fontSize: '0.82rem', color: '#888', marginBottom: '1.25rem' }}>{tags.split(',').map((tag) => `#${tag.trim()}`).join(' ')}</div>}
          <div style={{ lineHeight: 1.75, fontSize: '0.97rem', color: '#333', whiteSpace: 'pre-wrap' }}>{content || <span style={{ color: '#bbb' }}>(нет текста)</span>}</div>
        </section>
      ) : (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={labelStyle}>Название рецепта *</label>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например: Борщ с печёными овощами" style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Фотография блюда</label>
            {photoPreview ? (
              <div style={photoCardStyle}>
                {/* eslint-disable-next-line @next/next/no-img-element -- selected local Blob URL cannot use Next image optimization. */}
                <img src={photoPreview} alt="Выбранная фотография блюда" style={photoPreviewStyle} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 650, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{photo?.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.2rem' }}>{photo ? `${Math.ceil(photo.size / 1024)} КБ` : ''}</div>
                </div>
                <button type="button" onClick={clearPhoto} style={removePhotoStyle}>Убрать</button>
              </div>
            ) : (
              <label style={photoPickerStyle}>
                <span aria-hidden="true" style={{ fontSize: '1.4rem' }}>📷</span>
                <span><strong>Прикрепить фото</strong><small>JPG, PNG или WebP до 5 МБ</small></span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} style={{ display: 'none' }} />
              </label>
            )}
          </div>

          <div>
            <label style={labelStyle}>Ингредиенты и теги</label>
            <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="картофель, курица, ужин" style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Рецепт * <span style={{ color: '#888', fontWeight: 400 }}>(ингредиенты и шаги приготовления)</span></label>
            <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={16} placeholder={'## Ингредиенты\n\n- 500 г овощей\n\n## Как готовить\n\n1. Подготовьте продукты…'} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', fontSize: '0.95rem', lineHeight: 1.6 }} />
          </div>
        </section>
      )}

      {error && <p role="alert" style={{ color: '#c0392b', fontSize: '0.88rem', margin: '0.9rem 0 0' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => submit('draft')} disabled={submitting} style={outlineButtonStyle}>{submitting ? '…' : '💾 Сохранить черновик'}</button>
        <button type="button" onClick={() => submit('pending')} disabled={submitting} style={redButtonStyle}>{submitting ? 'Отправляем…' : '🚀 Отправить рецепт на проверку'}</button>
      </div>
      <p style={{ fontSize: '0.78rem', color: '#888', marginTop: '0.75rem' }}>После проверки рецепт и фотография появятся на сайте только после модерации.</p>
    </main>
  )
}

const pageMessageStyle: React.CSSProperties = { maxWidth: '800px', margin: '4rem auto', padding: '0 1rem', textAlign: 'center', color: '#888' }
const successCardStyle: React.CSSProperties = { background: '#e9f7ef', border: '1px solid #a9dfbf', borderRadius: '12px', padding: '2rem', marginBottom: '1.5rem' }
const previewCardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e8e4df', borderRadius: '12px', padding: '2rem', minHeight: '300px' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#444', marginBottom: '0.4rem' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5 }
const redButtonStyle: React.CSSProperties = { backgroundColor: '#c0392b', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.65rem 1.2rem', fontSize: '0.9rem', fontWeight: 750, cursor: 'pointer' }
const redLinkStyle: React.CSSProperties = { ...redButtonStyle, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }
const outlineButtonStyle: React.CSSProperties = { background: 'none', border: '1.5px solid #aaa', borderRadius: '8px', padding: '0.6rem 1rem', fontSize: '0.88rem', color: '#555', cursor: 'pointer', fontWeight: 650 }
const photoPickerStyle: React.CSSProperties = { minHeight: '100px', background: '#fffaf7', border: '1.5px dashed #d8b6ad', borderRadius: '10px', padding: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#7a5147' }
const photoCardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e8e4df', borderRadius: '10px', padding: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }
const photoPreviewStyle: React.CSSProperties = { width: '72px', height: '72px', borderRadius: '7px', objectFit: 'cover', flexShrink: 0 }
const previewImageStyle: React.CSSProperties = { width: '100%', maxHeight: '380px', objectFit: 'cover', borderRadius: '9px', display: 'block', marginBottom: '1.25rem' }
const removePhotoStyle: React.CSSProperties = { background: 'none', border: 'none', color: '#a94442', cursor: 'pointer', fontWeight: 650, padding: '0.4rem' }
