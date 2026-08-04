import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '../..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('cabinet defaults to a real latest-content feed and has no editable profile header', () => {
  const cabinet = read('src/app/moy-kabinet/page.tsx')

  assert.match(cabinet, /useState<CabinetTab>\('feed'\)/)
  assert.match(cabinet, /<LatestPublished[\s\S]*limit=\{12\}/)
  assert.match(cabinet, /category="kulinaria"/)
  assert.match(cabinet, /category="layfkhaki"/)
  assert.match(cabinet, /from\('saved_articles'\)/)
  assert.doesNotMatch(cabinet, /Редактировать/)
  assert.doesNotMatch(cabinet, /from\('profiles'\)/)
})

test('recipe form stores an authenticated R2 photo key and comments accept photos too', () => {
  const recipeForm = read('src/app/napisat/page.tsx')
  const migration = read('supabase/migrations/202608041630_add_user_article_photo.sql')
  const comments = read('src/components/Comments.tsx')
  const commentItem = read('src/components/comments/CommentItem.tsx')

  assert.match(recipeForm, /Опубликовать ваш рецепт/)
  assert.match(recipeForm, /uploadToR2\(\{ file: photo/)
  assert.match(recipeForm, /photo_path: photoPath/)
  assert.match(recipeForm, /accept="image\/jpeg,image\/png,image\/webp"/)
  assert.match(migration, /add column if not exists photo_path text/)
  assert.match(comments, /uploadToR2\(\{ file: attach, articleSlug: slug \}\)/)
  assert.match(comments, /Прикрепить фото/)
  assert.match(commentItem, /comment\.photo_path/)
})
