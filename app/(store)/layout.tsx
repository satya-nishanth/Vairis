import Navbar from '@/components/store/Navbar'

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
      <footer className="bg-brand-dark text-white/40 py-8 md:py-10 mt-24">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-2">
          <p className="font-display text-brand-gold/60 text-lg tracking-widest">VAIRIS</p>
          <p className="text-sm">Fine Jewellery. Crafted with Precision.</p>
          <p className="text-xs mt-4">© {new Date().getFullYear()} Vairis. All rights reserved.</p>
        </div>
      </footer>
    </>
  )
}
