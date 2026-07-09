import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles, Check, ArrowRight } from 'lucide-react';

interface MembershipPromptModalProps {
  open: boolean;
  onClose: () => void;
}

const PERKS = [
  'RSVP and join member-only events',
  'Unlock exclusive training & nutrition content',
  'Claim sponsor discount codes & rewards',
  'Access private member links and community',
];

/**
 * Nudge shown to INACTIVE members on the dashboard. Dismissible — closing it
 * still lets them browse the (locked) portal. "Get your membership" takes them
 * to the payment-method chooser at /membership.
 */
export function MembershipPromptModal({ open, onClose }: MembershipPromptModalProps) {
  const navigate = useNavigate();

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#111] border border-[#eb7524]/25 rounded-2xl max-w-md w-full overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner */}
        <div className="relative h-24 bg-gradient-to-r from-[#eb7524]/25 via-[#eb7524]/10 to-transparent">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 text-white/50 hover:text-white/90 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="absolute -bottom-6 left-6 w-14 h-14 rounded-2xl bg-[#1a1a1a] border-2 border-[#eb7524]/40 flex items-center justify-center shadow-lg">
            <Sparkles className="w-6 h-6 text-[#eb7524]" />
          </div>
        </div>

        <div className="pt-10 px-6 pb-6">
          <h3
            className="text-white mb-2"
            style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}
          >
            Activate your membership
          </h3>
          <p
            className="text-white/50 mb-5"
            style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}
          >
            Your account is currently inactive. Get your AUSS membership to unlock
            everything the member portal has to offer.
          </p>

          <ul className="space-y-2.5 mb-6">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-start gap-2.5">
                <span className="w-5 h-5 mt-0.5 rounded-full bg-[#eb7524]/15 border border-[#eb7524]/25 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-[#eb7524]" />
                </span>
                <span
                  className="text-white/70"
                  style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}
                >
                  {perk}
                </span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => navigate('/membership/pay')}
            className="w-full py-3.5 rounded-xl bg-[#eb7524] text-white hover:bg-[#d4691f] hover:shadow-[0_4px_12px_rgba(235,117,36,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2"
            style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
          >
            Get your membership
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-2 py-2.5 text-white/40 hover:text-white/70 transition-colors cursor-pointer"
            style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
