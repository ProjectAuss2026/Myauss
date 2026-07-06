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
  AlertCircle,
  FileImage,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";

type AuthView = "login" | "register";
type RegistrationPaymentMethod = "STANDARD" | "CASH_BANK_TRANSFER";
type PaymentProofUploadStatus = "uploading" | "uploaded" | "error";

type PaymentProofUploadItem = {
  localId: string;
  file: File;
  id: string | null;
  originalFilename: string;
  mimeType: string | null;
  sizeBytes: number;
  expiresAt: string | null;
  status: PaymentProofUploadStatus;
  error: string | null;
};

type PaymentProofUploadResponse = {
  data?: {
    id: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    expiresAt: string;
  };
  error?: string;
  message?: string;
};

const CASH_BANK_TRANSFER_PAYMENT_METHOD = "CASH_BANK_TRANSFER";

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  return response.json() as Promise<T>;
}

async function uploadPendingPaymentProof(file: File) {
  const formData = new FormData();
  formData.append("proof", file);

  const response = await fetch("/api/auth/payment-proofs/pending", {
    method: "POST",
    body: formData,
  });
  const payload = await readJsonResponse<PaymentProofUploadResponse>(response);

  if (!response.ok || !payload?.data) {
    throw new Error(
      payload?.error || payload?.message || "Payment proof upload failed.",
    );
  }

  return payload.data;
}

async function removePendingPaymentProof(proofUploadId: string) {
  const response = await fetch(
    `/api/auth/payment-proofs/pending/${encodeURIComponent(proofUploadId)}`,
    { method: "DELETE" },
  );
  const payload = await readJsonResponse<{ error?: string; message?: string }>(
    response,
  );

  if (!response.ok) {
    throw new Error(
      payload?.error ||
        payload?.message ||
        "Failed to remove payment proof upload.",
    );
  }
}

function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
}

function createLocalProofUploadId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `proof-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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
  const [mounted, setMounted] = useState(false);
  const { ref: containerRef, inView } = useInViewCustom({ once: true });

  // Form states
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regStudentId, setRegStudentId] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<RegistrationPaymentMethod>("STANDARD");
  const [paymentProofUploads, setPaymentProofUploads] = useState<
    PaymentProofUploadItem[]
  >([]);
  const [submitted, setSubmitted] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const paymentProofInputRef = useRef<HTMLInputElement>(null);

  const uploadedPaymentProofIds = paymentProofUploads
    .filter((upload) => upload.status === "uploaded" && upload.id)
    .map((upload) => upload.id as string);
  const hasUploadingPaymentProofs = paymentProofUploads.some(
    (upload) => upload.status === "uploading",
  );
  const showPaymentProofSection =
    paymentMethod === CASH_BANK_TRANSFER_PAYMENT_METHOD ||
    paymentProofUploads.length > 0;

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  function validateField(
    name: string,
    value: string,
    confirmValue?: string,
  ): string {
    const trimmed = value.trim();
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

  const updatePaymentProofUpload = (
    localId: string,
    updater: (upload: PaymentProofUploadItem) => PaymentProofUploadItem,
  ) => {
    setPaymentProofUploads((current) =>
      current.map((upload) =>
        upload.localId === localId ? updater(upload) : upload,
      ),
    );
  };

  const uploadProofFile = async (localId: string, file: File) => {
    updatePaymentProofUpload(localId, (upload) => ({
      ...upload,
      status: "uploading",
      error: null,
      id: null,
      mimeType: null,
      sizeBytes: file.size,
      expiresAt: null,
      originalFilename: file.name,
    }));

    try {
      const uploaded = await uploadPendingPaymentProof(file);
      updatePaymentProofUpload(localId, (upload) => ({
        ...upload,
        id: uploaded.id,
        originalFilename: uploaded.originalFilename,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        expiresAt: uploaded.expiresAt,
        status: "uploaded",
        error: null,
      }));
    } catch (err: any) {
      updatePaymentProofUpload(localId, (upload) => ({
        ...upload,
        status: "error",
        error: err?.message || "Payment proof upload failed.",
      }));
    }
  };

  const handlePaymentProofFiles = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";

    if (files.length === 0) {
      return;
    }

    setRegisterError(null);

    for (const file of files) {
      const localId = createLocalProofUploadId();
      setPaymentProofUploads((current) => [
        ...current,
        {
          localId,
          file,
          id: null,
          originalFilename: file.name,
          mimeType: file.type || null,
          sizeBytes: file.size,
          expiresAt: null,
          status: "uploading",
          error: null,
        },
      ]);

      await uploadProofFile(localId, file);
    }
  };

  const handleRetryPaymentProof = async (localId: string) => {
    const upload = paymentProofUploads.find((item) => item.localId === localId);
    if (!upload) {
      return;
    }

    setRegisterError(null);
    await uploadProofFile(localId, upload.file);
  };

  const handleRemovePaymentProof = async (localId: string) => {
    const upload = paymentProofUploads.find((item) => item.localId === localId);
    if (!upload || upload.status === "uploading") {
      return;
    }

    setRegisterError(null);

    if (!upload.id) {
      setPaymentProofUploads((current) =>
        current.filter((item) => item.localId !== localId),
      );
      return;
    }

    updatePaymentProofUpload(localId, (item) => ({
      ...item,
      status: "uploading",
      error: null,
    }));

    try {
      await removePendingPaymentProof(upload.id);
      setPaymentProofUploads((current) =>
        current.filter((item) => item.localId !== localId),
      );
    } catch (err: any) {
      updatePaymentProofUpload(localId, (item) => ({
        ...item,
        status: "uploaded",
        error: err?.message || "Failed to remove payment proof upload.",
      }));
    }
  };

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

    if (
      paymentMethod === CASH_BANK_TRANSFER_PAYMENT_METHOD &&
      hasUploadingPaymentProofs
    ) {
      setRegisterError("Please wait for your payment proof uploads to finish.");
      return;
    }

    if (
      paymentMethod === CASH_BANK_TRANSFER_PAYMENT_METHOD &&
      uploadedPaymentProofIds.length === 0
    ) {
      setRegisterError(
        "Upload at least one payment proof before submitting Cash / Bank Transfer registration.",
      );
      return;
    }

    setSubmitted(true);
    try {
      const body: Record<string, unknown> = {
        email: regEmail,
        password: regPassword,
        firstName: regFirstName,
        lastName: regLastName,
        studentId: regStudentId,
      };

      if (paymentMethod === CASH_BANK_TRANSFER_PAYMENT_METHOD) {
        body.paymentMethod = CASH_BANK_TRANSFER_PAYMENT_METHOD;
        body.proofUploadIds = uploadedPaymentProofIds;
      }

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readJsonResponse<{
        error?: string;
        message?: string;
        pendingMembershipReview?: boolean;
      }>(res);

      if (!res.ok) {
        const msg = data?.error || "Registration failed.";
        setRegisterError(msg);
        showToast(msg, "error");
        return;
      }

      const pendingMembershipReview = Boolean(data?.pendingMembershipReview);
      const pendingMembershipReviewMessage = pendingMembershipReview
        ? "We received your membership submission. Verify your email with the code we sent. Your payment proof is pending admin review, and your membership will be verified after approval."
        : null;

      showToast(
        pendingMembershipReviewMessage ||
          data?.message ||
          "If your email is eligible, a verification code has been sent.",
        "info",
      );
      navigate("/verify", {
        state: {
          email: regEmail,
          pendingMembershipReview,
          pendingMembershipReviewMessage,
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
    setMounted(false);
    setTimeout(() => {
      setView(newView);
      setSubmitted(false);
      requestAnimationFrame(() => setMounted(true));
    }, 200);
  };

  return (
    <div className="bg-black min-h-screen relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#eb7524]/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#eb7524]/5 rounded-full blur-[120px]" />
      </div>

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

        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-12 lg:gap-20">
          {/* Left side — Branding */}
          <div
            className="flex-1 max-w-md text-center lg:text-left lg:pt-8"
            style={{
              opacity: inView ? 1 : 0,
              transform: inView ? "translateX(0)" : "translateX(-30px)",
              transition: "opacity 0.7s ease 0.1s, transform 0.7s ease 0.1s",
            }}
          >
            <p
              className="text-[#eb7524] uppercase tracking-[0.25em] mb-4"
              style={{
                fontSize: "13px",
                fontFamily: "Inter, sans-serif",
                fontWeight: 500,
              }}
            >
              Join the Community
            </p>
            <h1
              className="text-white mb-4"
              style={{
                fontSize: "clamp(28px, 4vw, 42px)",
                fontWeight: 700,
                lineHeight: 1.15,
                fontFamily: "Outfit, sans-serif",
                letterSpacing: "-0.02em",
              }}
            >
              Welcome to <span className="text-[#eb7524]">AUSS</span>
            </h1>
            <p
              className="text-white/50 mb-8"
              style={{
                fontSize: "16px",
                lineHeight: 1.7,
                fontFamily: "Inter, sans-serif",
              }}
            >
              Sign in to access training schedules, events, and connect with
              Auckland's strongest community. New here? Create your account.
            </p>

            {/* Feature highlights */}
            <div className="space-y-4 hidden lg:block">
              {[
                { icon: Users, text: "Connect with 200+ active members" },
                {
                  icon: ShieldCheck,
                  text: "Access exclusive training resources",
                },
                {
                  icon: ArrowRight,
                  text: "Stay updated on events & competitions",
                },
              ].map((item, i) => (
                <div
                  key={item.text}
                  className="flex items-center gap-3"
                  style={{
                    opacity: inView ? 1 : 0,
                    transform: inView ? "translateX(0)" : "translateX(-20px)",
                    transition: `opacity 0.5s ease ${0.4 + i * 0.1}s, transform 0.5s ease ${0.4 + i * 0.1}s`,
                  }}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#eb7524]/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4 h-4 text-[#eb7524]" />
                  </div>
                  <span
                    className="text-white/60"
                    style={{
                      fontSize: "14px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right side — Form Card */}
          <div
            className="w-full max-w-[440px]"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.5s ease, transform 0.5s ease",
            }}
          >
            <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
              {/* LOGIN VIEW */}
              {view === "login" && (
                <>
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
                </>
              )}

              {/* REGISTER VIEW */}
              {view === "register" && (
                <>
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
                        University Email
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
                          placeholder="you@auckland.ac.nz"
                          aria-required="true"
                          aria-describedby={fieldErrors.regEmail && touched.regEmail ? 'regEmail-error' : undefined}
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
                        Student ID
                        <span className="text-red-400 ml-0.5" aria-hidden="true">
                          *
                        </span>
                      </label>
                      <input
                        id="regStudentId"
                        type="text"
                        value={regStudentId}
                        onChange={(e) => { setRegStudentId(e.target.value); if (fieldErrors.regStudentId) handleBlur('regStudentId', e.target.value); }}
                        onBlur={(e) => handleBlur('regStudentId', e.target.value)}
                        placeholder="e.g. 123456789"
                        aria-required="true"
                        aria-describedby={fieldErrors.regStudentId && touched.regStudentId ? 'regStudentId-error' : undefined}
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
                        className="mt-2 text-white/35"
                        style={{
                          fontSize: "12px",
                          fontFamily: "Inter, sans-serif",
                          lineHeight: 1.5,
                        }}
                      >
                        Used to confirm Auckland Uni membership eligibility. It
                        is protected, not displayed publicly, and removal or
                        correction requests can be sent to auss@auckland.ac.nz.
                        Final privacy wording should be confirmed by AUSS.
                      </p>
                    </div>

                    <div>
                      <span
                        className="block text-white/60 mb-1.5"
                        style={{
                          fontSize: "13px",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        Payment Method
                      </span>
                      <div className="space-y-3">
                        <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 cursor-pointer transition-colors hover:border-white/20">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="STANDARD"
                            checked={paymentMethod === "STANDARD"}
                            onChange={() => setPaymentMethod("STANDARD")}
                            className="mt-1 h-4 w-4 accent-[#eb7524]"
                          />
                          <span>
                            <span
                              className="block text-white"
                              style={{
                                fontSize: "14px",
                                fontFamily: "Outfit, sans-serif",
                                fontWeight: 500,
                              }}
                            >
                              Standard Registration
                            </span>
                            <span
                              className="block text-white/40 mt-1"
                              style={{
                                fontSize: "12px",
                                fontFamily: "Inter, sans-serif",
                                lineHeight: 1.5,
                              }}
                            >
                              No payment-proof upload is required during
                              registration.
                            </span>
                          </span>
                        </label>

                        <label className="flex items-start gap-3 rounded-xl border border-[#eb7524]/20 bg-[#eb7524]/[0.04] px-4 py-3 cursor-pointer transition-colors hover:border-[#eb7524]/35">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={CASH_BANK_TRANSFER_PAYMENT_METHOD}
                            checked={
                              paymentMethod ===
                              CASH_BANK_TRANSFER_PAYMENT_METHOD
                            }
                            onChange={() =>
                              setPaymentMethod("CASH_BANK_TRANSFER")
                            }
                            className="mt-1 h-4 w-4 accent-[#eb7524]"
                          />
                          <span>
                            <span
                              className="block text-white"
                              style={{
                                fontSize: "14px",
                                fontFamily: "Outfit, sans-serif",
                                fontWeight: 500,
                              }}
                            >
                              Cash / Bank Transfer
                            </span>
                            <span
                              className="block text-white/40 mt-1"
                              style={{
                                fontSize: "12px",
                                fontFamily: "Inter, sans-serif",
                                lineHeight: 1.5,
                              }}
                            >
                              Upload at least one receipt or bank-transfer image
                              before you submit your registration.
                            </span>
                          </span>
                        </label>
                      </div>
                    </div>

                    {showPaymentProofSection && (
                      <div className="rounded-2xl border border-[#eb7524]/20 bg-[#eb7524]/[0.04] p-4 space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#eb7524]/10 flex items-center justify-center shrink-0">
                            <FileImage className="w-5 h-5 text-[#eb7524]" />
                          </div>
                          <div>
                            <h3
                              className="text-white"
                              style={{
                                fontSize: "15px",
                                fontFamily: "Outfit, sans-serif",
                                fontWeight: 600,
                              }}
                            >
                              Payment Proof Uploads
                            </h3>
                            <p
                              className="text-white/45 mt-1"
                              style={{
                                fontSize: "12px",
                                fontFamily: "Inter, sans-serif",
                                lineHeight: 1.5,
                              }}
                            >
                              Upload JPG, PNG, or WEBP photos of your receipt or
                              bank-transfer statement. Maximum 10 MB per file.
                              Files stay private, SVG files are rejected, only
                              authorised admins can retrieve them, and unused
                              staged uploads expire automatically.
                            </p>
                            {paymentMethod !==
                              CASH_BANK_TRANSFER_PAYMENT_METHOD &&
                              paymentProofUploads.length > 0 && (
                                <p
                                  className="text-white/35 mt-2"
                                  style={{
                                    fontSize: "12px",
                                    fontFamily: "Inter, sans-serif",
                                    lineHeight: 1.5,
                                  }}
                                >
                                  These uploads will only be submitted if you
                                  switch back to Cash / Bank Transfer.
                                </p>
                              )}
                          </div>
                        </div>

                        <input
                          ref={paymentProofInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          onChange={handlePaymentProofFiles}
                          className="hidden"
                          aria-label="Upload payment proof files"
                        />

                        <button
                          type="button"
                          onClick={() => paymentProofInputRef.current?.click()}
                          disabled={submitted || hasUploadingPaymentProofs}
                          className="inline-flex items-center gap-2 rounded-xl border border-[#eb7524]/25 bg-[#eb7524]/10 px-4 py-2.5 text-white hover:bg-[#eb7524]/15 transition-colors disabled:opacity-60 cursor-pointer"
                          style={{
                            fontSize: "14px",
                            fontFamily: "Outfit, sans-serif",
                            fontWeight: 500,
                          }}
                        >
                          {hasUploadingPaymentProofs ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                          {hasUploadingPaymentProofs
                            ? "Uploading proofs..."
                            : "Upload Payment Proofs"}
                        </button>

                        {paymentProofUploads.length === 0 ? (
                          <div
                            className="rounded-xl border border-dashed border-white/10 px-4 py-4 text-white/35"
                            style={{
                              fontSize: "13px",
                              fontFamily: "Inter, sans-serif",
                            }}
                          >
                            No payment proof files uploaded yet.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {paymentProofUploads.map((upload) => (
                              <div
                                key={upload.localId}
                                className="rounded-xl border border-white/10 bg-black/30 px-4 py-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p
                                      className="text-white truncate"
                                      style={{
                                        fontSize: "14px",
                                        fontFamily: "Outfit, sans-serif",
                                        fontWeight: 500,
                                      }}
                                    >
                                      {upload.originalFilename}
                                    </p>
                                    <p
                                      className="text-white/35 mt-1"
                                      style={{
                                        fontSize: "12px",
                                        fontFamily: "Inter, sans-serif",
                                        lineHeight: 1.5,
                                      }}
                                    >
                                      {upload.status === "uploaded"
                                        ? `${formatBytes(upload.sizeBytes)}${upload.expiresAt ? ` • Expires ${new Date(upload.expiresAt).toLocaleString()}` : ""}`
                                        : upload.status === "uploading"
                                          ? "Uploading..."
                                          : "Upload failed. Retry or remove this file."}
                                    </p>
                                    {upload.error && (
                                      <p
                                        className="text-red-400 mt-2 flex items-start gap-2"
                                        style={{
                                          fontSize: "12px",
                                          fontFamily: "Inter, sans-serif",
                                          lineHeight: 1.5,
                                        }}
                                      >
                                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                        <span>{upload.error}</span>
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {upload.status === "error" && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRetryPaymentProof(
                                            upload.localId,
                                          )
                                        }
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-white/70 hover:text-white hover:border-white/20 transition-colors cursor-pointer"
                                        style={{
                                          fontSize: "12px",
                                          fontFamily: "Inter, sans-serif",
                                          fontWeight: 500,
                                        }}
                                        aria-label={`Retry upload for ${upload.originalFilename}`}
                                      >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        Retry
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRemovePaymentProof(upload.localId)
                                      }
                                      disabled={upload.status === "uploading"}
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-white/60 hover:text-red-300 hover:border-red-500/30 transition-colors disabled:opacity-50 cursor-pointer"
                                      style={{
                                        fontSize: "12px",
                                        fontFamily: "Inter, sans-serif",
                                        fontWeight: 500,
                                      }}
                                      aria-label={`Remove upload ${upload.originalFilename}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

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
                        id="regTos"
                        type="checkbox"
                        className="w-4 h-4 rounded bg-white/5 border-white/10 accent-[#eb7524] mt-0.5"
                        aria-required="true"
                        required
                      />
                      <label
                        htmlFor="regTos"
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
                        I agree to the AUSS{" "}
                        <span className="text-[#eb7524]/70 hover:text-[#eb7524] cursor-pointer transition-colors">
                          Terms of Service
                        </span>{" "}
                        and{" "}
                        <span className="text-[#eb7524]/70 hover:text-[#eb7524] cursor-pointer transition-colors">
                          Privacy Policy
                        </span>
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
