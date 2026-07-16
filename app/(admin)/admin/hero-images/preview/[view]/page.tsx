import { notFound } from 'next/navigation'
import HeroBannerFullPreview from '@/components/admin/HeroBannerFullPreview'
import { getAllHeroSlides } from '@/lib/hero-images'

export const dynamic = 'force-dynamic'

type Props = {
  params: { view: string }
}

export default async function HeroPreviewPage({ params }: Props) {
  if (params.view !== 'mobile' && params.view !== 'web') notFound()

  const slides = await getAllHeroSlides()

  return <HeroBannerFullPreview variant={params.view} slides={slides} />
}
