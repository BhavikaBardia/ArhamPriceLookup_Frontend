import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show button if user has scrolled down more than 220px
      if (window.scrollY > 220) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <button
      type="button"
      id="btn-scroll-to-top"
      onClick={scrollToTop}
      aria-label="Scroll to top of page"
      title="Scroll to top"
      className={`fixed bottom-6 right-6 z-40 flex items-center gap-1.5 px-3 py-2.5 sm:px-3.5 sm:py-2.5 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:shadow-xl hover:shadow-indigo-600/40 border border-white/20 backdrop-blur-xs font-semibold text-xs transition-all duration-300 cursor-pointer active:scale-90 hover:-translate-y-1 ${
        isVisible
          ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
          : 'opacity-0 translate-y-4 scale-90 pointer-events-none'
      }`}
    >
      <ArrowUp className="w-4 h-4 stroke-[2.5]" />
      <span className="hidden sm:inline-block">Top</span>
    </button>
  );
}
