import { notFound } from 'next/navigation'
import HeroBannerFullPreview from '@/components/admin/HeroBannerFullPreview'
import { getAllHeroSlides } from '@/lib/hero-images'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ view: string }>
}

export default async function HeroPreviewPage({ params }: Props) {
  const { view } = await params
  if (view !== 'mobile' && view !== 'web') notFound()

  const slides = await getAllHeroSlides()

  return <HeroBannerFullPreview variant={view} slides={slides} />
}
