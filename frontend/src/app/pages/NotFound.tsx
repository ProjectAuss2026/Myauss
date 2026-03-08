import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function NotFound() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div
        className="text-center max-w-md"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(30px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        <h1
          className="text-[#eb7524] mb-4"
          style={{ fontSize: 'clamp(80px, 15vw, 140px)', fontWeight: 800, fontFamily: 'Outfit, sans-serif', lineHeight: '1' }}
        >
          404
        </h1>
        <h2
          className="text-white mb-4"
          style={{ fontSize: '24px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
        >
          Page Not Found
        </h2>
        <p
          className="text-white/50 mb-8"
          style={{ fontSize: '16px', lineHeight: '1.6', fontFamily: 'Inter, sans-serif' }}
        >
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-[#eb7524] text-white px-8 py-3.5 rounded-xl hover:bg-[#d4691f] transition-colors active:scale-[0.98]"
          style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Return Home
        </Link>
      </div>
    </div>
  );
}
