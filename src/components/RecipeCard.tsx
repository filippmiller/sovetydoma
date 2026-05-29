import RecipePrintButton from './RecipePrintButton'

interface RecipeCardProps {
  prepTime?: string
  cookTime?: string
  recipeYield?: string
  recipeIngredient?: string[]
  recipeSteps?: string[]
  difficulty?: string
}

function parseDuration(iso?: string): string {
  if (!iso) return ''
  // e.g. PT30M, PT1H30M, PT2H
  const hoursMatch = iso.match(/(\d+)H/)
  const minutesMatch = iso.match(/(\d+)M/)
  const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0
  const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0
  if (hours > 0 && minutes > 0) return `${hours} ч ${minutes} мин`
  if (hours > 0) return `${hours} ч`
  if (minutes > 0) return `${minutes} мин`
  return iso
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    'Легко': { bg: '#e8f5e9', text: '#2e7d32' },
    'Средне': { bg: '#fff3e0', text: '#e65100' },
    'Сложно': { bg: '#fce4ec', text: '#b71c1c' },
  }
  const style = colors[difficulty] || { bg: '#f0ede8', text: '#555' }
  return (
    <span style={{
      display: 'inline-block',
      backgroundColor: style.bg,
      color: style.text,
      borderRadius: '4px',
      padding: '2px 10px',
      fontSize: '0.8rem',
      fontWeight: 700,
    }}>
      {difficulty}
    </span>
  )
}

export default function RecipeCard({
  prepTime,
  cookTime,
  recipeYield,
  recipeIngredient,
  recipeSteps,
  difficulty,
}: RecipeCardProps) {
  const prep = parseDuration(prepTime)
  const cook = parseDuration(cookTime)

  const hasStats = prep || cook || recipeYield || difficulty
  const hasIngredients = recipeIngredient && recipeIngredient.length > 0
  const hasSteps = recipeSteps && recipeSteps.length > 0

  if (!hasStats && !hasIngredients && !hasSteps) return null

  return (
    <div style={{
      backgroundColor: '#faf8f4',
      border: '1px solid #e8e4df',
      borderRadius: '10px',
      padding: '1.5rem',
      marginBottom: '2rem',
      fontFamily: 'inherit',
    }}>
      {/* Header stats row */}
      {hasStats && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          marginBottom: (hasIngredients || hasSteps) ? '1.5rem' : 0,
          paddingBottom: (hasIngredients || hasSteps) ? '1.25rem' : 0,
          borderBottom: (hasIngredients || hasSteps) ? '1px solid #e8e4df' : 'none',
        }}>
          {prep && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <span style={{ fontSize: '1.25rem' }}>⏱</span>
              <span style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Подготовка</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1a1a1a' }}>{prep}</span>
            </div>
          )}
          {cook && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <span style={{ fontSize: '1.25rem' }}>🍳</span>
              <span style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Готовка</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1a1a1a' }}>{cook}</span>
            </div>
          )}
          {recipeYield && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <span style={{ fontSize: '1.25rem' }}>🍽</span>
              <span style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Порций</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1a1a1a' }}>{recipeYield}</span>
            </div>
          )}
          {difficulty && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '1.25rem' }}>📊</span>
              <span style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Сложность</span>
              <DifficultyBadge difficulty={difficulty} />
            </div>
          )}
        </div>
      )}

      {/* Two-column layout for ingredients + steps */}
      {(hasIngredients || hasSteps) && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: hasIngredients && hasSteps ? '1fr 1fr' : '1fr',
          gap: '1.5rem',
        }}
          className="recipe-columns"
        >
          {/* Ingredients */}
          {hasIngredients && (
            <div>
              <h3 style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: '#1a1a1a',
                marginBottom: '0.75rem',
                borderBottom: '2px solid #c0392b',
                paddingBottom: '0.4rem',
              }}>
                Ингредиенты
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {recipeIngredient!.map((item, i) => (
                  <li key={i} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    padding: '0.35rem 0',
                    borderBottom: '1px solid #f0ede8',
                    fontSize: '0.92rem',
                    color: '#333',
                    lineHeight: 1.4,
                  }}>
                    <span style={{
                      display: 'inline-block',
                      width: '16px',
                      height: '16px',
                      minWidth: '16px',
                      border: '1.5px solid #c0392b',
                      borderRadius: '3px',
                      marginTop: '1px',
                    }} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Steps */}
          {hasSteps && (
            <div>
              <h3 style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: '#1a1a1a',
                marginBottom: '0.75rem',
                borderBottom: '2px solid #c0392b',
                paddingBottom: '0.4rem',
              }}>
                Приготовление
              </h3>
              <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {recipeSteps!.map((step, i) => (
                  <li key={i} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    marginBottom: '0.75rem',
                  }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '26px',
                      height: '26px',
                      minWidth: '26px',
                      backgroundColor: '#c0392b',
                      color: '#fff',
                      borderRadius: '50%',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                    }}>
                      {i + 1}
                    </span>
                    <div style={{
                      backgroundColor: '#fff',
                      border: '1px solid #e8e4df',
                      borderRadius: '6px',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.9rem',
                      color: '#333',
                      lineHeight: 1.5,
                      flex: 1,
                    }}>
                      {step}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Print button */}
      <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
        <RecipePrintButton />
      </div>

      <style>{`
        @media (max-width: 640px) {
          .recipe-columns {
            grid-template-columns: 1fr !important;
          }
        }
        @media print {
          .recipe-columns button { display: none; }
        }
      `}</style>
    </div>
  )
}
