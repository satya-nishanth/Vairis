export default function HeroImagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {children}
    </div>
  )
}
