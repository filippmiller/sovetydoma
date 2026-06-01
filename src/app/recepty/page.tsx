import { getAllArticles } from '@/lib/articles'
import RecipeFilter from '@/components/RecipeFilter'
import Breadcrumb from '@/components/Breadcrumb'
import type { Metadata } from 'next'
import { canonicalPath } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Рецепты — пошаговые рецепты на СоветыДома',
  description: 'Домашние рецепты с фильтрами по времени приготовления и теме. Быстрые блюда, супы, выпечка и многое другое.',
  alternates: { canonical: canonicalPath('/recepty/') },
}

export default function ReceptyPage() {
  const all = getAllArticles()

  // Include all kulinaria articles that have schemaType === 'Recipe'
  const recipes = all
    .filter((a) => a.category === 'kulinaria' && a.schemaType === 'Recipe')
    .map((a) => ({
      title: a.title,
      description: a.description,
      slug: a.slug,
      category: a.category,
      categoryName: a.categoryName,
      date: a.date,
      tags: a.tags,
      prepTime: a.prepTime,
      cookTime: a.cookTime,
      recipeYield: a.recipeYield,
    }))

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      <Breadcrumb items={[{ name: 'Кулинария', href: '/kulinaria' }, { name: 'Рецепты' }]} />

      <header style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '2rem' }}>🍳</span>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
            Рецепты
          </h1>
        </div>
        <p style={{ color: '#777', fontSize: '0.95rem', margin: 0 }}>
          {recipes.length} {recipes.length === 1 ? 'рецепт' : recipes.length < 5 ? 'рецепта' : 'рецептов'} — фильтруйте по времени и теме
        </p>
      </header>

      <RecipeFilter recipes={recipes} />
    </div>
  )
}
