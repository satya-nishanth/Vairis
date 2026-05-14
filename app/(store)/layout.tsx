import Navbar from '@/components/store/Navbar'
import GoldRateBanner from '@/components/store/GoldRateBanner'

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GoldRateBanner />
      <Navbar />
      {children}
      <footer className="bg-brand-dark text-white/40 pt-12 pb-8 mt-24">
        <div className="max-w-7xl mx-auto px-6">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img
              src="/images/vairius_logo.png"
              alt="VAIRIS"
              style={{ height: '48px', width: 'auto', opacity: 0.8 }}
            />
          </div>

          {/* Divider */}
          <div className="w-full max-w-md mx-auto h-px bg-gradient-to-r from-transparent via-brand-gold/20 to-transparent mb-8" />

          {/* Contact info */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-sm mb-6">
            <a href="mailto:contact@thevairis.com" className="text-white/50 hover:text-brand-gold transition-colors tracking-wide">
              contact@thevairis.com
            </a>
            <span className="hidden md:block text-white/20">·</span>
            <a href="tel:+917075486464" className="text-white/50 hover:text-brand-gold transition-colors tracking-wide">
              +91 7075 486 464
            </a>
            <span className="hidden md:block text-white/20">·</span>
            <a
              href="https://www.instagram.com/vairis.jewellery"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-white/50 hover:text-brand-gold transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
              </svg>
              @vairis.jewellery
            </a>
          </div>

          <p className="text-center text-xs text-white/20 tracking-widest">
            © {new Date().getFullYear()} Vairis Fine Jewellery. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  )
}
