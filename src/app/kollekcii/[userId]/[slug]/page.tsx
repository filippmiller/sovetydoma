import PublicCollectionView from './PublicCollectionView'

export async function generateStaticParams() {
  return [{ userId: '__none__', slug: '__none__' }]
}

export default function PublicCollectionPage() {
  return <PublicCollectionView />
}
