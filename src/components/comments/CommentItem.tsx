import type { Comment } from '@/lib/supabase'
import { photoPublicUrl } from '@/lib/photos'
import { timeAgo, getInitials, avatarColor } from './utils'

export interface CommentItemProps {
  comment: Comment
  depth: number
  onReply: (parentId: string) => void
}

export default function CommentItem({ comment, depth, onReply }: CommentItemProps) {
  const name = comment.profiles?.display_name || 'Пользователь'
  const initials = getInitials(name)
  const [bg, fg] = avatarColor(name)

  return (
    <div style={{
      display: 'flex',
      gap: '0.75rem',
      marginLeft: depth > 0 ? '1rem' : 0,
      paddingLeft: depth > 0 ? '1rem' : 0,
      borderLeft: depth > 0 ? '3px solid #f0ede8' : 'none',
    }}>
      {/* Avatar */}
      <div style={{
        width: 38,
        height: 38,
        borderRadius: '50%',
        backgroundColor: bg,
        color: fg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.8rem',
        fontWeight: 800,
        flexShrink: 0,
        userSelect: 'none',
      }}>
        {initials}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1a1a1a' }}>{name}</span>
          <span style={{ fontSize: '0.78rem', color: '#bbb' }}>{timeAgo(comment.created_at)}</span>
        </div>
        <p style={{
          margin: 0,
          fontSize: '0.93rem',
          lineHeight: 1.65,
          color: '#333',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {comment.content}
        </p>
        {comment.photo_path && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={photoPublicUrl(comment.photo_path)}
            alt="Фото к комментарию"
            loading="lazy"
            style={{ marginTop: '0.5rem', maxWidth: '240px', width: '100%', borderRadius: '8px', display: 'block' }}
          />
        )}
        <button
          onClick={() => onReply(comment.id)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.78rem',
            color: '#aaa',
            padding: '0.3rem 0',
            marginTop: '0.15rem',
            fontFamily: 'inherit',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#c0392b')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#aaa')}
        >
          Ответить
        </button>
      </div>
    </div>
  )
}
