import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  Users,
  ChevronLeft,
} from "lucide-react";

type AuthView = "login" | "register";

function useInViewCustom(options?: { once?: boolean; margin?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (options?.once) observer.disconnect();
        } else if (!options?.once) {
          setInView(false);
        }
      },
      { rootMargin: options?.margin || "0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, inView };
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

const carouselSlides = [
  {
    src: "/photos/club_photo1.jpg",
    alt: "AUSS members gathered together for a club group photo",
  },
  {
    src: "/photos/club_photo2.jpg",
    alt: "AUSS members training together during a session",
  },
  {
    src: "/photos/club_photo3.jpg",
    alt: "AUSS members enjoying a club event",
  },
];

const brandHighlights = [
  { icon: Users, text: "Connect with 300+ active members" },
  { icon: ShieldCheck, text: "Access exclusive training resources" },
  { icon: ArrowRight, text: "Stay updated on events & socials" },
];

function BrandPanel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // The carousel is desktop-only: on mobile we render a single static image so
  // phones don't pull all three full-size photos (~2MB) over congested campus
  // wifi — this is the screen students hit after scanning the stall QR.
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  // Only the desktop carousel auto-advances, and it stops when the user prefers
  // reduced motion (WCAG 2.2.2). Touch devices — our primary audience — have no
  // hover to pause, so this preference is their stop mechanism; without it set
  // they still get the full rotation.
  useEffect(() => {
    if (!isDesktop || reduceMotion || paused) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % carouselSlides.length),
      4000,
    );
    return () => clearInterval(id);
  }, [isDesktop, reduceMotion, paused]);

  // On mobile only the first slide is rendered (and fetched); the full carousel
  // lives on desktop.
  const slides = isDesktop ? carouselSlides : carouselSlides.slice(0, 1);

  return (
    <div
      className="relative overflow-hidden min-h-[240px] lg:min-h-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      {...(isDesktop
        ? {
            role: "group",
            "aria-roledescription": "carousel",
            "aria-label": "Photos of the AUSS community",
          }
        : {})}
    >
      {/* Carousel background */}
      {slides.map((slide, i) => (
        <img
          key={slide.src}
          src={slide.src}
          alt={slide.alt}
          loading={i === 0 ? "eager" : "lazy"}
          decoding="async"
          aria-hidden={isDesktop ? i !== index : undefined}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out"
          style={{ opacity: isDesktop ? (i === index ? 1 : 0) : 1 }}
        />
      ))}

      {/* Dark overlays keep the branding text legible over the photos:
          one bottom-heavy for the dots/highlights, one top-heavy behind the heading. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/15" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/10 to-transparent" />

      {/* Content */}
      <div className="relative h-full flex flex-col justify-between p-8 md:p-10 gap-8">
        <div>
          <p
            className="text-[#eb7524] uppercase tracking-[0.25em] mb-4"
            style={{
              fontSize: "13px",
              fontFamily: "Inter, sans-serif",
              fontWeight: 500,
              textShadow: "0 1px 8px rgba(0,0,0,0.7)",
            }}
          >
            Join the Community
          </p>
          <h1
            className="text-white mb-4"
            style={{
              fontSize: "clamp(28px, 4vw, 40px)",
              fontWeight: 700,
              lineHeight: 1.15,
              fontFamily: "Outfit, sans-serif",
              letterSpacing: "-0.02em",
              textShadow: "0 2px 12px rgba(0,0,0,0.5)",
            }}
          >
            Welcome to <span className="text-[#eb7524]">AUSS</span>
          </h1>
          <p
            className="text-white/80 max-w-sm"
            style={{
              fontSize: "15px",
              lineHeight: 1.7,
              fontFamily: "Inter, sans-serif",
              textShadow: "0 1px 6px rgba(0,0,0,0.6)",
            }}
          >
            Access training schedules, events, and connect with Auckland's
            strongest community.
          </p>
        </div>

        <div>
          {/* Feature highlights */}
          <div className="space-y-3 mb-6 hidden md:block">
            {brandHighlights.map((item) => (
              <div key={item.text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-4 h-4 text-[#eb7524]" />
                </div>
                <span
                  className="text-white/80"
                  style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
                >
                  {item.text}
                </span>
              </div>
            ))}
          </div>

          {/* Slide indicators — desktop-only, matching the carousel */}
          {isDesktop && (
            <div className="flex gap-2">
              {carouselSlides.map((slide, i) => (
                <button
                  key={slide.src}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Show photo ${i + 1} of ${carouselSlides.length}`}
                  aria-current={i === index}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    i === index
                      ? "w-6 bg-[#eb7524]"
                      : "w-2 bg-white/50 hover:bg-white/80"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PasswordRule({ met, label, sublabel }: { met: boolean; label: string; sublabel?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-0.5 text-xs ${met ? 'text-green-400' : 'text-white/25'}`}>
        {met ? '✓' : '○'}
      </span>
      <div>
        <span className={`${met ? 'text-green-400' : 'text-white/40'}`} style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
          <span className="sr-only">{met ? 'Met: ' : 'Not met: '}</span>
          {label}
        </span>
        {sublabel && (
          <span className="block text-white/25" style={{ fontSize: '11px', fontFamily: 'Inter, sans-serif' }}>
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}

export function Login() {
  const [view, setView] = useState<AuthView>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { ref: containerRef, inView } = useInViewCustom({ once: true });
  const loginRef = useRef<HTMLDivElement>(null);
  const registerRef = useRef<HTMLDivElement>(null);

  // Form states
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regStudentId, setRegStudentId] = useState("");
  const [regPrivacyConsent, setRegPrivacyConsent] = useState(false);
  const [regMembershipConsent, setRegMembershipConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Take the inactive view out of the tab order / a11y tree (it stays in the
  // DOM so the card is always sized to the taller view).
  useEffect(() => {
    const setInert = (el: HTMLElement | null, inert: boolean) => {
      if (!el) return;
      if (inert) el.setAttribute("inert", "");
      else el.removeAttribute("inert");
    };
    setInert(loginRef.current, view !== "login");
    setInert(registerRef.current, view !== "register");
  }, [view]);

  function validateField(
    name: string,
    value: string,
    confirmValue?: string,
  ): string {
    const trimmed = value.trim();
    if (name === "regStudentId" && !trimmed) return "";
    if (!trimmed) return "This field is required";
    if (name === "loginEmail" || name === "regEmail") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
        return "Please enter a valid email address";
      }
    }
    if (name === "regPassword") {
      if (value.length < 12) return "Password must be at least 12 characters";
    }
    if (name === "regConfirm") {
      const target = confirmValue ?? regPassword;
      if (value !== target) return "Passwords do not match";
    }
    return "";
  }

  function handleBlur(field: string, value: string, confirmValue?: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, value, confirmValue);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (error) {
        next[field] = error;
      } else {
        delete next[field];
      }
      return next;
    });
  }

  function clearFieldErrors() {
    setFieldErrors({});
    setTouched({});
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    clearFieldErrors();

    // Validate fields before submit
    const errors: Record<string, string> = {};
    const newTouched: Record<string, boolean> = {};
    for (const [name, value] of [['loginEmail', loginEmail], ['loginPassword', loginPassword]] as [string, string][]) {
      newTouched[name] = true;
      const err = validateField(name, value);
      if (err) { errors[name] = err; }
    }
    if (Object.keys(errors).length > 0) {
      setTouched(newTouched);
      setFieldErrors(errors);
      return;
    }

    setSubmitted(true);
    try {
      const u = await login({ email: loginEmail, password: loginPassword });
      showToast(`Welcome back, ${u?.firstName || "there"}!`, "success");
      // Allow React to commit the auth state update before navigating
      await new Promise((r) => setTimeout(r, 0));
      navigate("/");
    } catch (err: any) {
      const msg = err?.message || "Login failed. Please try again.";
      setLoginError(msg);
      showToast(msg, "error");
    } finally {
      setSubmitted(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);
    clearFieldErrors();

    const fields: [string, string, string?][] = [
      ["regFirstName", regFirstName],
      ["regLastName", regLastName],
      ["regEmail", regEmail],
      ["regStudentId", regStudentId],
      ["regPassword", regPassword],
      ["regConfirm", regConfirm, regPassword],
    ];
    const errors: Record<string, string> = {};
    const newTouched: Record<string, boolean> = {};
    for (const [name, value, confirmValue] of fields) {
      newTouched[name] = true;
      const err = validateField(name, value, confirmValue);
      if (err) {
        errors[name] = err;
      }
    }
    if (Object.keys(errors).length > 0) {
      setTouched(newTouched);
      setFieldErrors(errors);
      return;
    }

    setSubmitted(true);
    try {
      const body: Record<string, unknown> = {
        email: regEmail,
        password: regPassword,
        firstName: regFirstName,
        lastName: regLastName,
        studentId: regStudentId.trim() || null,
        privacyPolicyConsent: regPrivacyConsent,
        membershipAgreementConsent: regMembershipConsent,
      };

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.error || "Registration failed.";
        setRegisterError(msg);
        showToast(msg, "error");
        return;
      }

      showToast(
        "Check your email for the verification code. If you don't receive it, you may already be registered — try signing in instead.",
        "info",
      );
      navigate("/verify", {
        state: {
          email: regEmail,
        },
      });
    } catch {
      setRegisterError("Network error. Please try again.");
      showToast("Network error. Please try again.", "error");
    } finally {
      setSubmitted(false);
    }
  };

  const switchView = (newView: AuthView) => {
    setView(newView);
    setSubmitted(false);
  };

  return (
    <div className="bg-black min-h-screen relative overflow-hidden">
      {/* Mobile: fade + slide the active auth view in when it becomes visible.
          Desktop keeps its own opacity crossfade, so scope this to small screens. */}
      <style>{`
        @media (max-width: 1023px) {
          .auth-view { animation: authViewIn 300ms ease both; }
        }
        @keyframes authViewIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        className="max-w-[1200px] mx-auto px-6 py-12 md:py-20 relative"
        ref={containerRef}
      >
        {/* Back link */}
        <div
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0)" : "translateY(-10px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-8 group"
            style={{ fontFamily: "Outfit, sans-serif", fontSize: "14px" }}
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </Link>
        </div>

        {/* Unified auth card */}
        <div
          className="grid lg:grid-cols-2 rounded-3xl overflow-hidden border border-white/[0.08] bg-[#111] shadow-[0_30px_90px_rgba(0,0,0,0.6)]"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.7s ease 0.1s, transform 0.7s ease 0.1s",
          }}
        >
          {/* Left — Branding / photo panel */}
          <BrandPanel />

          {/* Right — Form panel. Both views are stacked in one grid cell, so the
              card is always as tall as the taller (register) view: no resize, no scroll. */}
          <div className="p-8 md:p-10 lg:grid">
            {/* LOGIN VIEW */}
            <div
              ref={loginRef}
              aria-hidden={view !== "login"}
              className={`${view === "login" ? "flex" : "hidden"} lg:flex flex-col justify-center lg:col-start-1 lg:row-start-1 transition-opacity duration-300 auth-view`}
              style={{
                opacity: view === "login" ? 1 : 0,
                pointerEvents: view === "login" ? "auto" : "none",
              }}
            >
                  <h2
                    className="text-white mb-1"
                    style={{
                      fontSize: "24px",
                      fontWeight: 600,
                      fontFamily: "Outfit, sans-serif",
                    }}
                  >
                    Sign In
                  </h2>
                  <p
                    className="text-white/40 mb-6"
                    style={{
                      fontSize: "14px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    Welcome back to AUSS
                  </p>

                  {loginError && (
                    <div
                      className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400"
                      style={{
                        fontSize: "13px",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      {loginError}
                    </div>
                  )}

                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label
                        htmlFor="loginEmail"
                        className="block text-white/60 mb-1.5"
                        style={{
                          fontSize: "13px",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        Email Address
                        <span className="text-red-400 ml-0.5" aria-hidden="true">
                          *
                        </span>
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                          id="loginEmail"
                          type="email"
                          value={loginEmail}
                          onChange={(e) => { setLoginEmail(e.target.value); if (fieldErrors.loginEmail) handleBlur('loginEmail', e.target.value); }}
                          onBlur={(e) => handleBlur('loginEmail', e.target.value)}
                          placeholder="you@auckland.ac.nz"
                          aria-required="true"
                          aria-describedby={fieldErrors.loginEmail && touched.loginEmail ? 'loginEmail-error' : undefined}
                          aria-invalid={!!fieldErrors.loginEmail && !!touched.loginEmail}
                          className={`w-full bg-white/[0.04] border rounded-xl px-4 py-3 pl-10 text-white placeholder:text-white/20 focus:outline-none focus:bg-white/[0.06] transition-all ${fieldErrors.loginEmail && touched.loginEmail ? 'border-red-400/50 focus:border-red-400' : 'border-white/10 focus:border-[#eb7524]/50'}`}
                          style={{
                            fontSize: "14px",
                            fontFamily: "Inter, sans-serif",
                          }}
                        />
                      </div>
                      {fieldErrors.loginEmail && touched.loginEmail && (
                        <p id="loginEmail-error" className="text-red-400 mt-1" style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }} role="alert">{fieldErrors.loginEmail}</p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="loginPassword"
                        className="block text-white/60 mb-1.5"
                        style={{
                          fontSize: "13px",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        Password
                        <span className="text-red-400 ml-0.5" aria-hidden="true">
                          *
                        </span>
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                          id="loginPassword"
                          type={showPassword ? "text" : "password"}
                          value={loginPassword}
                          onChange={(e) => { setLoginPassword(e.target.value); if (fieldErrors.loginPassword) handleBlur('loginPassword', e.target.value); }}
                          onBlur={(e) => handleBlur('loginPassword', e.target.value)}
                          placeholder="••••••••"
                          aria-required="true"
                          aria-describedby={fieldErrors.loginPassword && touched.loginPassword ? 'loginPassword-error' : undefined}
                          aria-invalid={!!fieldErrors.loginPassword && !!touched.loginPassword}
                          className={`w-full bg-white/[0.04] border rounded-xl px-4 py-3 pl-10 pr-10 text-white placeholder:text-white/20 focus:outline-none focus:bg-white/[0.06] transition-all ${fieldErrors.loginPassword && touched.loginPassword ? 'border-red-400/50 focus:border-red-400' : 'border-white/10 focus:border-[#eb7524]/50'}`}
                          style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {fieldErrors.loginPassword && touched.loginPassword && (
                        <p id="loginPassword-error" className="text-red-400 mt-1" style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }} role="alert">{fieldErrors.loginPassword}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded bg-white/5 border-white/10 accent-[#eb7524]"
                        />
                        <span
                          className="text-white/40"
                          style={{
                            fontSize: "13px",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          Remember me
                        </span>
                      </label>
                      <Link
                        to="/forgot-password"
                        className="text-[#eb7524]/70 hover:text-[#eb7524] transition-colors cursor-pointer"
                        style={{
                          fontSize: "13px",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        Forgot password?
                      </Link>
                    </div>

                    <button
                      type="submit"
                      disabled={submitted}
                      className="w-full bg-[#eb7524] text-white py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-[#d4691f] transition-all hover:shadow-[0_4px_20px_rgba(235,117,36,0.4)] active:scale-[0.98] disabled:opacity-60 cursor-pointer mt-2"
                      style={{
                        fontSize: "15px",
                        fontWeight: 600,
                        fontFamily: "Outfit, sans-serif",
                      }}
                    >
                      {submitted ? "Signing In..." : "Sign In"}
                      {!submitted && <ArrowRight className="w-4 h-4" />}
                    </button>
                  </form>

                  <div className="mt-6 pt-6 border-t border-white/[0.06] text-center">
                    <p
                      className="text-white/40"
                      style={{
                        fontSize: "14px",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      Don't have an account?{" "}
                      <button
                        onClick={() => switchView("register")}
                        className="text-[#eb7524] hover:text-[#eb7524]/80 transition-colors cursor-pointer"
                        style={{ fontWeight: 500 }}
                      >
                        Register
                      </button>
                    </p>
                  </div>
            </div>

            {/* REGISTER VIEW */}
            <div
              ref={registerRef}
              aria-hidden={view !== "register"}
              className={`${view === "register" ? "flex" : "hidden"} lg:flex flex-col justify-center lg:col-start-1 lg:row-start-1 transition-opacity duration-300 auth-view`}
              style={{
                opacity: view === "register" ? 1 : 0,
                pointerEvents: view === "register" ? "auto" : "none",
              }}
            >
                  <button
                    onClick={() => switchView("login")}
                    className="flex items-center gap-1 text-white/40 hover:text-white/70 transition-colors mb-4 cursor-pointer"
                    style={{
                      fontSize: "13px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Back
                  </button>

                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-[#eb7524]/10 rounded-xl flex items-center justify-center">
                      <Users className="w-5 h-5 text-[#eb7524]" />
                    </div>
                    <div>
                      <h2
                        className="text-white"
                        style={{
                          fontSize: "22px",
                          fontWeight: 600,
                          fontFamily: "Outfit, sans-serif",
                          lineHeight: 1.2,
                        }}
                      >
                        Member Registration
                      </h2>
                      <p
                        className="text-white/40"
                        style={{
                          fontSize: "13px",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        Create your club membership account
                      </p>
                    </div>
                  </div>

                  {registerError && (
                    <div
                      className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400"
                      style={{
                        fontSize: "13px",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      {registerError}
                    </div>
                  )}

                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="regFirstName"
                          className="block text-white/60 mb-1.5"
                          style={{
                            fontSize: "13px",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          First Name
                          <span className="text-red-400 ml-0.5" aria-hidden="true">
                            *
                          </span>
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                          <input
                            id="regFirstName"
                            type="text"
                            value={regFirstName}
                            onChange={(e) => { setRegFirstName(e.target.value); if (fieldErrors.regFirstName) handleBlur('regFirstName', e.target.value); }}
                            onBlur={(e) => handleBlur('regFirstName', e.target.value)}
                            placeholder="First name"
                            aria-required="true"
                            aria-describedby={fieldErrors.regFirstName && touched.regFirstName ? 'regFirstName-error' : undefined}
                            aria-invalid={!!fieldErrors.regFirstName && !!touched.regFirstName}
                            className={`w-full bg-white/[0.04] border rounded-xl px-4 py-3 pl-10 text-white placeholder:text-white/20 focus:outline-none focus:bg-white/[0.06] transition-all ${fieldErrors.regFirstName && touched.regFirstName ? 'border-red-400/50 focus:border-red-400' : 'border-white/10 focus:border-[#eb7524]/50'}`}
                            style={{
                              fontSize: "14px",
                              fontFamily: "Inter, sans-serif",
                            }}
                          />
                        </div>
                        {fieldErrors.regFirstName && touched.regFirstName && (
                          <p id="regFirstName-error" className="text-red-400 mt-1" style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }} role="alert">{fieldErrors.regFirstName}</p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="regLastName"
                          className="block text-white/60 mb-1.5"
                          style={{
                            fontSize: "13px",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          Last Name
                          <span className="text-red-400 ml-0.5" aria-hidden="true">
                            *
                          </span>
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                          <input
                            id="regLastName"
                            type="text"
                            value={regLastName}
                            onChange={(e) => { setRegLastName(e.target.value); if (fieldErrors.regLastName) handleBlur('regLastName', e.target.value); }}
                            onBlur={(e) => handleBlur('regLastName', e.target.value)}
                            placeholder="Last name"
                            aria-required="true"
                            aria-describedby={fieldErrors.regLastName && touched.regLastName ? 'regLastName-error' : undefined}
                            aria-invalid={!!fieldErrors.regLastName && !!touched.regLastName}
                            className={`w-full bg-white/[0.04] border rounded-xl px-4 py-3 pl-10 text-white placeholder:text-white/20 focus:outline-none focus:bg-white/[0.06] transition-all ${fieldErrors.regLastName && touched.regLastName ? 'border-red-400/50 focus:border-red-400' : 'border-white/10 focus:border-[#eb7524]/50'}`}
                            style={{
                              fontSize: "14px",
                              fontFamily: "Inter, sans-serif",
                            }}
                          />
                        </div>
                        {fieldErrors.regLastName && touched.regLastName && (
                          <p id="regLastName-error" className="text-red-400 mt-1" style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }} role="alert">{fieldErrors.regLastName}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="regEmail"
                        className="block text-white/60 mb-1.5"
                        style={{
                          fontSize: "13px",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        Email
                        <span className="text-red-400 ml-0.5" aria-hidden="true">
                          *
                        </span>
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                          id="regEmail"
                          type="email"
                          value={regEmail}
                          onChange={(e) => { setRegEmail(e.target.value); if (fieldErrors.regEmail) handleBlur('regEmail', e.target.value); }}
                          onBlur={(e) => handleBlur('regEmail', e.target.value)}
                          placeholder="you@example.com"
                          aria-required="true"
                          aria-describedby={`regEmail-help${fieldErrors.regEmail && touched.regEmail ? ' regEmail-error' : ''}`}
                          aria-invalid={!!fieldErrors.regEmail && !!touched.regEmail}
                          className={`w-full bg-white/[0.04] border rounded-xl px-4 py-3 pl-10 text-white placeholder:text-white/20 focus:outline-none focus:bg-white/[0.06] transition-all ${fieldErrors.regEmail && touched.regEmail ? 'border-red-400/50 focus:border-red-400' : 'border-white/10 focus:border-[#eb7524]/50'}`}
                          style={{
                            fontSize: "14px",
                            fontFamily: "Inter, sans-serif",
                          }}
                        />
                      </div>
                      {fieldErrors.regEmail && touched.regEmail && (
                        <p id="regEmail-error" className="text-red-400 mt-1" style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }} role="alert">{fieldErrors.regEmail}</p>
                      )}
                      <p id="regEmail-help" className="mt-2 text-white/35" style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
                        University email preferred.
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="regStudentId"
                        className="block text-white/60 mb-1.5"
                        style={{
                          fontSize: "13px",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        Student ID (optional)
                      </label>
                      <input
                        id="regStudentId"
                        type="text"
                        value={regStudentId}
                        onChange={(e) => { setRegStudentId(e.target.value); if (fieldErrors.regStudentId) handleBlur('regStudentId', e.target.value); }}
                        onBlur={(e) => handleBlur('regStudentId', e.target.value)}
                        placeholder="e.g. 123456789"
                        aria-describedby={`regStudentId-help${fieldErrors.regStudentId && touched.regStudentId ? ' regStudentId-error' : ''}`}
                        aria-invalid={!!fieldErrors.regStudentId && !!touched.regStudentId}
                        className={`w-full bg-white/[0.04] border rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:bg-white/[0.06] transition-all ${fieldErrors.regStudentId && touched.regStudentId ? 'border-red-400/50 focus:border-red-400' : 'border-white/10 focus:border-[#eb7524]/50'}`}
                        style={{
                          fontSize: "14px",
                          fontFamily: "Inter, sans-serif",
                        }}
                      />
                      {fieldErrors.regStudentId && touched.regStudentId && (
                        <p id="regStudentId-error" className="text-red-400 mt-1" style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }} role="alert">{fieldErrors.regStudentId}</p>
                      )}
                      <p
                        id="regStudentId-help"
                        className="mt-2 text-white/35"
                        style={{
                          fontSize: "12px",
                          fontFamily: "Inter, sans-serif",
                          lineHeight: 1.5,
                        }}
                      >
                        If you have a University of Auckland Student ID, you can
                        provide it here. Non-UoA members can leave this blank.
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="regPassword"
                        className="block text-white/60 mb-1.5"
                        style={{
                          fontSize: "13px",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        Password
                        <span className="text-red-400 ml-0.5" aria-hidden="true">
                          *
                        </span>
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                          id="regPassword"
                          type={showPassword ? "text" : "password"}
                          value={regPassword}
                          onChange={(e) => { setRegPassword(e.target.value); handleBlur('regPassword', e.target.value); if (regConfirm) handleBlur('regConfirm', regConfirm, e.target.value); }}
                          onBlur={(e) => handleBlur('regPassword', e.target.value)}
                          placeholder="Create a password"
                          aria-required="true"
                          aria-describedby={fieldErrors.regPassword && touched.regPassword ? 'regPassword-error' : 'regPassword-rules'}
                          aria-invalid={!!fieldErrors.regPassword && !!touched.regPassword}
                          className={`w-full bg-white/[0.04] border rounded-xl px-4 py-3 pl-10 pr-10 text-white placeholder:text-white/20 focus:outline-none focus:bg-white/[0.06] transition-all ${fieldErrors.regPassword && touched.regPassword ? 'border-red-400/50 focus:border-red-400' : 'border-white/10 focus:border-[#eb7524]/50'}`}
                          style={{
                            fontSize: "14px",
                            fontFamily: "Inter, sans-serif",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {fieldErrors.regPassword && touched.regPassword && (
                        <p id="regPassword-error" className="text-red-400 mt-1" style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }} role="alert">{fieldErrors.regPassword}</p>
                      )}
                        <div id="regPassword-rules" className="mt-2 space-y-1" aria-live="polite">
                          <PasswordRule met={regPassword.length >= 12} label="At least 12 characters" />
                          <PasswordRule met={false} label="Not a commonly used or breached password" sublabel="Verified on submission" />
                        </div>
                    </div>

                    <div>
                      <label
                        htmlFor="regConfirm"
                        className="block text-white/60 mb-1.5"
                        style={{
                          fontSize: "13px",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        Confirm Password
                        <span className="text-red-400 ml-0.5" aria-hidden="true">
                          *
                        </span>
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                          id="regConfirm"
                          type={showConfirmPassword ? "text" : "password"}
                          value={regConfirm}
                          onChange={(e) => { setRegConfirm(e.target.value); handleBlur('regConfirm', e.target.value, regPassword); }}
                          onBlur={(e) => handleBlur('regConfirm', e.target.value, regPassword)}
                          placeholder="Confirm your password"
                          aria-required="true"
                          aria-describedby={fieldErrors.regConfirm && touched.regConfirm ? 'regConfirm-error' : undefined}
                          aria-invalid={!!fieldErrors.regConfirm && !!touched.regConfirm}
                          className={`w-full bg-white/[0.04] border rounded-xl px-4 py-3 pl-10 pr-10 text-white placeholder:text-white/20 focus:outline-none focus:bg-white/[0.06] transition-all ${fieldErrors.regConfirm && touched.regConfirm ? 'border-red-400/50 focus:border-red-400' : 'border-white/10 focus:border-[#eb7524]/50'}`}
                          style={{
                            fontSize: "14px",
                            fontFamily: "Inter, sans-serif",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {fieldErrors.regConfirm && touched.regConfirm && (
                        <p id="regConfirm-error" className="text-red-400 mt-1" style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }} role="alert">{fieldErrors.regConfirm}</p>
                      )}
                      {!fieldErrors.regConfirm && regConfirm && regPassword && regConfirm === regPassword && (
                        <p className="text-green-400 mt-1" style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>Passwords match ✓</p>
                      )}
                    </div>

                    <div className="flex items-start gap-2 pt-1">
                      <input
                        id="regPrivacyConsent"
                        type="checkbox"
                        checked={regPrivacyConsent}
                        onChange={(event) =>
                          setRegPrivacyConsent(event.target.checked)
                        }
                        className="w-4 h-4 rounded bg-white/5 border-white/10 accent-[#eb7524] mt-0.5"
                        aria-label="I agree to the AUSS Privacy Policy"
                        aria-required="true"
                        required
                      />
                      <p
                        className="text-white/40"
                        style={{
                          fontSize: "13px",
                          fontFamily: "Inter, sans-serif",
                          lineHeight: 1.5,
                        }}
                      >
                        <span className="text-red-400 mr-0.5" aria-hidden="true">
                          *
                        </span>
                        <label htmlFor="regPrivacyConsent">
                          I agree to the AUSS{" "}
                        </label>
                        <a
                          href="/privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#eb7524]/70 hover:text-[#eb7524] underline underline-offset-2 transition-colors"
                        >
                          Privacy Policy
                        </a>
                        .
                      </p>
                    </div>

                    <div className="flex items-start gap-2">
                      <input
                        id="regMembershipConsent"
                        type="checkbox"
                        checked={regMembershipConsent}
                        onChange={(event) =>
                          setRegMembershipConsent(event.target.checked)
                        }
                        className="w-4 h-4 rounded bg-white/5 border-white/10 accent-[#eb7524] mt-0.5"
                        aria-required="true"
                        required
                      />
                      <label
                        htmlFor="regMembershipConsent"
                        className="text-white/40"
                        style={{
                          fontSize: "13px",
                          fontFamily: "Inter, sans-serif",
                          lineHeight: 1.5,
                        }}
                      >
                        <span className="text-red-400 mr-0.5" aria-hidden="true">
                          *
                        </span>
                        I agree, by entering my name, to be a member of Auckland
                        University Strength Society Incorporated and to be
                        subject to the Society's constitution and by-laws.
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={submitted}
                      className="w-full bg-[#eb7524] text-white py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-[#d4691f] transition-all hover:shadow-[0_4px_20px_rgba(235,117,36,0.4)] active:scale-[0.98] disabled:opacity-60 cursor-pointer mt-2"
                      style={{
                        fontSize: "15px",
                        fontWeight: 600,
                        fontFamily: "Outfit, sans-serif",
                      }}
                    >
                      {submitted ? "Creating Account..." : "Create Account"}
                      {!submitted && <ArrowRight className="w-4 h-4" />}
                    </button>
                  </form>

                  <div className="mt-6 pt-6 border-t border-white/[0.06] text-center">
                    <p
                      className="text-white/40"
                      style={{
                        fontSize: "14px",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      Already have an account?{" "}
                      <button
                        onClick={() => switchView("login")}
                        className="text-[#eb7524] hover:text-[#eb7524]/80 transition-colors cursor-pointer"
                        style={{ fontWeight: 500 }}
                      >
                        Sign In
                      </button>
                    </p>
                  </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
