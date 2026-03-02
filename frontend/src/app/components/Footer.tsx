import { Link } from 'react-router-dom';
import { ArrowUp, Instagram, Mail } from 'lucide-react';

const footerLinks = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/sponsorship', label: 'Sponsorship' },
  { to: '/social', label: 'Social' },
  { to: '/meet-the-execs', label: 'Meet the Execs' },
];

export function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-black border-t border-white/5">
      <div className="max-w-[1200px] mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-10">
          {/* Logo */}
          <div>
            <Link
              to="/"
              className="text-white flex items-center gap-2 hover:opacity-80 transition-opacity"
              style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '20px' }}
            >
              <div className="w-8 h-8 bg-[#eb7524] rounded-lg flex items-center justify-center text-white text-sm font-bold">
                A
              </div>
              AUSS
            </Link>
            <p
              className="text-white/30 mt-2 max-w-xs"
              style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
            >
              Auckland University Strength Society — building strength and community since 2015.
            </p>
          </div>

          {/* Nav Links */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {footerLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-white/40 hover:text-white transition-colors"
                style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Social Icons */}
          <div className="flex items-center gap-3">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-[#eb7524] hover:bg-[#eb7524]/10 transition-all"
            >
              <Instagram className="w-4 h-4" />
            </a>
            <a
              href="mailto:auss@auckland.ac.nz"
              className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-[#eb7524] hover:bg-[#eb7524]/10 transition-all"
            >
              <Mail className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Bottom */}
        <div className="flex items-center justify-between border-t border-white/5 pt-6">
          <p
            className="text-white/20"
            style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}
          >
            &copy; {new Date().getFullYear()} AUSS. All rights reserved.
          </p>
          <button
            onClick={scrollToTop}
            className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </div>
    </footer>
  );
}
