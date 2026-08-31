import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type { Appearance } from "@stripe/stripe-js";
import { stripePromise, isStripeConfigured } from "../lib/stripe";
import { fetchWithAuth } from "../lib/authFetch";
import {
  ChevronLeft,
  ShieldCheck,
  Upload,
  Loader2,
  RefreshCw,
  Trash2,
  FileImage,
  AlertCircle,
  CreditCard,
  Banknote,
  CheckCircle,
  Clock,
  ArrowRight,
  Lock,
} from "lucide-react";

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

function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
}

function createLocalProofUploadId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `proof-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function getAuthToken() {
  return localStorage.getItem("token") || "";
}

async function uploadPendingPaymentProof(file: File) {
  const token = await getAuthToken();
  const formData = new FormData();
  formData.append("proof", file);

  const response = await fetch("/api/auth/payment-proofs/pending", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const payload = await response.json().catch(() => ({})) as PaymentProofUploadResponse;

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.error || payload?.message || "Payment proof upload failed.");
  }
  return payload.data;
}

async function removePendingPaymentProof(proofUploadId: string) {
  const token = await getAuthToken();
  const response = await fetch(
    `/api/auth/payment-proofs/pending/${encodeURIComponent(proofUploadId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || "Failed to remove payment proof upload.");
  }
}

export function ActivateMembership() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const { ref: containerRef, inView } = useInViewCustom({ once: true });

  // Payment proof upload state
  const [paymentProofUploads, setPaymentProofUploads] = useState<PaymentProofUploadItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paymentProofInputRef = useRef<HTMLInputElement>(null);

  // Stripe inline payment state
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripeLoadError, setStripeLoadError] = useState<string | null>(null);

  const uploadedPaymentProofIds = paymentProofUploads
    .filter((u) => u.status === "uploaded" && u.id)
    .map((u) => u.id as string);
  const hasUploadingPaymentProofs = paymentProofUploads.some((u) => u.status === "uploading");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const membershipStatus = user?.membershipStatus || "INACTIVE";

  // Request a Stripe PaymentIntent when user is INACTIVE
  useEffect(() => {
    if (!isStripeConfigured || membershipStatus !== "INACTIVE") return;

    let cancelled = false;
    fetchWithAuth("/api/payments/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to start payment");
        if (!cancelled) setStripeClientSecret(data.clientSecret);
      })
      .catch((err) => {
        if (!cancelled)
          setStripeLoadError(
            err instanceof Error ? err.message : "Failed to start payment",
          );
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membershipStatus]);

  if (isLoading || !user) {
    return (
      <div className="bg-black min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#eb7524]/30 border-t-[#eb7524] rounded-full animate-spin" />
      </div>
    );
  }

  // ── Payment proof upload handlers ──

  const updatePaymentProofUpload = (
    localId: string,
    updater: (upload: PaymentProofUploadItem) => PaymentProofUploadItem,
  ) => {
    setPaymentProofUploads((current) =>
      current.map((upload) => (upload.localId === localId ? updater(upload) : upload)),
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

  const handlePaymentProofFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    setError(null);

    for (const file of files) {
      const localId = createLocalProofUploadId();
      setPaymentProofUploads((current) => [
        ...current,
        { localId, file, id: null, originalFilename: file.name, mimeType: file.type || null, sizeBytes: file.size, expiresAt: null, status: "uploading", error: null },
      ]);
      await uploadProofFile(localId, file);
    }
  };

  const handleRetryPaymentProof = async (localId: string) => {
    const upload = paymentProofUploads.find((item) => item.localId === localId);
    if (!upload) return;
    setError(null);
    await uploadProofFile(localId, upload.file);
  };

  const handleRemovePaymentProof = async (localId: string) => {
    const upload = paymentProofUploads.find((item) => item.localId === localId);
    if (!upload || upload.status === "uploading") return;
    setError(null);

    if (!upload.id) {
      setPaymentProofUploads((current) => current.filter((item) => item.localId !== localId));
      return;
    }

    updatePaymentProofUpload(localId, (item) => ({ ...item, status: "uploading", error: null }));
    try {
      await removePendingPaymentProof(upload.id);
      setPaymentProofUploads((current) => current.filter((item) => item.localId !== localId));
    } catch (err: any) {
      updatePaymentProofUpload(localId, (item) => ({
        ...item,
        status: "uploaded",
        error: err?.message || "Failed to remove payment proof upload.",
      }));
    }
  };

  // ── Submit bank transfer ──

  const handleBankTransferSubmit = async () => {
    if (hasUploadingPaymentProofs) {
      setError("Please wait for your payment proof uploads to finish.");
      return;
    }
    if (uploadedPaymentProofIds.length === 0) {
      setError("Upload at least one receipt or bank-transfer image before submitting.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/auth/membership/submit-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ proofUploadIds: uploadedPaymentProofIds }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to submit payment proof.");
      }

      showToast("Payment proof submitted! Your membership is pending review.", "success");
      // Reload auth context to get updated membershipStatus
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Failed to submit payment proof.");
      showToast(err?.message || "Failed to submit", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Stripe inline payment ──

  const cardAppearance: Appearance = {
    theme: "night",
    variables: {
      colorPrimary: "#eb7524",
      colorBackground: "#1a1a1a",
      colorText: "#ffffff",
      colorDanger: "#f87171",
      fontFamily: "Inter, sans-serif",
      borderRadius: "12px",
    },
  };

  function StripePaymentForm() {
    const stripe = useStripe();
    const elements = useElements();
    const { refreshUser } = useAuth();
    const [paying, setPaying] = useState(false);
    const [payMsg, setPayMsg] = useState<string | null>(null);
    const [paid, setPaid] = useState(false);
    // The submit button must stay disabled until the PaymentElement has fully
    // mounted — calling confirmPayment before the 'ready' event throws
    // "could not retrieve data from the specified Element".
    const [elementReady, setElementReady] = useState(false);

    const handlePay = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!stripe || !elements || !elementReady) return;
      setPaying(true);
      setPayMsg(null);

      // Surface any client-side validation errors (e.g. incomplete card)
      // before we ask Stripe to confirm.
      const submitResult = await elements.submit();
      if (submitResult.error) {
        setPayMsg(submitResult.error.message ?? "Please check your payment details.");
        setPaying(false);
        return;
      }

      const { error: stripeErr } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/verify-membership`,
        },
      });

      if (stripeErr) {
        setPayMsg(stripeErr.message ?? "Payment failed.");
        setPaying(false);
      }
      // Redirect-based methods cause a page reload — the fallthrough below handles them.
    };

    // When Stripe redirects back here after a redirect-based payment method,
    // read the outcome from the URL and confirm server-side.
    useEffect(() => {
      if (!stripe) return;
      const piSecret = new URLSearchParams(window.location.search).get(
        "payment_intent_client_secret",
      );
      if (!piSecret) return;

      stripe.retrievePaymentIntent(piSecret).then(({ paymentIntent }) => {
        if (paymentIntent?.status === "succeeded") {
          setPaid(true);
          setPayMsg("Payment successful. Your membership is now active.");
          fetchWithAuth("/api/payments/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
          })
            .then(() => refreshUser())
            .catch(() => {
              /* webhook backstop */
            });
        } else if (paymentIntent?.status === "requires_payment_method") {
          setPayMsg("Payment was not completed. Please try again.");
        }
      });
    }, [stripe]);

    if (paid) {
      return (
        <div className="text-center py-4">
          <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-6 h-6 text-green-400" />
          </div>
          <p className="text-white/70" style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}>
            {payMsg}
          </p>
        </div>
      );
    }

    return (
      <form onSubmit={handlePay}>
        <PaymentElement
          options={{
            layout: "tabs",
          }}
          onReady={() => setElementReady(true)}
        />
        {payMsg && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-500/8 border border-red-500/20 px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <span className="text-red-300" style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}>
              {payMsg}
            </span>
          </div>
        )}
        <button
          type="submit"
          disabled={!stripe || !elementReady || paying}
          className="w-full mt-4 bg-green-600 text-white py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-green-500 transition-all disabled:opacity-60 cursor-pointer"
          style={{ fontSize: "14px", fontFamily: "Outfit, sans-serif", fontWeight: 600 }}
        >
          {paying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Processing…
            </>
          ) : (
            "Pay Now"
          )}
        </button>
        <div className="flex items-center justify-center gap-2 mt-3 text-white/20">
          <Lock className="w-3 h-3" />
          <span style={{ fontSize: "11px", fontFamily: "Inter, sans-serif" }}>
            Secure · Powered by Stripe
          </span>
        </div>
      </form>
    );
  }

  return (
    <div className="bg-black min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#eb7524]/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#eb7524]/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-12 md:py-20 relative" ref={containerRef}>
        <div
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0)" : "translateY(-10px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}
        >
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-8 group"
            style={{ fontFamily: "Outfit, sans-serif", fontSize: "14px" }}
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </Link>
        </div>

        <div className="flex flex-col items-center">
          <div
            className="w-full max-w-[440px]"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.5s ease, transform 0.5s ease",
            }}
          >
            <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
              {/* ── VERIFIED ── */}
              {membershipStatus === "VERIFIED" && (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                  <h2
                    className="text-white mb-2"
                    style={{ fontSize: "24px", fontWeight: 600, fontFamily: "Outfit, sans-serif" }}
                  >
                    Membership Active
                  </h2>
                  <p className="text-white/40" style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}>
                    Your membership is verified. You have full access to all AUSS member benefits.
                  </p>
                </div>
              )}

              {/* ── IN_REVIEW ── */}
              {membershipStatus === "IN_REVIEW" && (
                <div className="text-center py-4">
                  {user?.lastDeclineReason && (
                    <div className="mb-4 text-left rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-red-300" style={{ fontSize: "13px", fontFamily: "Inter, sans-serif", fontWeight: 600 }}>
                            Previous submission declined
                          </p>
                          {user.lastDeclineReason.reason ? (
                            <p className="text-red-400/80 mt-0.5" style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}>
                              Reason: {user.lastDeclineReason.reason}
                            </p>
                          ) : (
                            <p className="text-red-400/80 mt-0.5" style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}>
                              Your previous submission was declined. Please review your proof and try again.
                            </p>
                          )}
                          <p className="text-white/30 mt-0.5" style={{ fontSize: "11px", fontFamily: "Inter, sans-serif" }}>
                            {new Date(user.lastDeclineReason.declinedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="w-16 h-16 bg-[#eb7524]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-[#eb7524]" />
                  </div>
                  <h2
                    className="text-white mb-2"
                    style={{ fontSize: "24px", fontWeight: 600, fontFamily: "Outfit, sans-serif" }}
                  >
                    Pending Review
                  </h2>
                  <p
                    className="text-white/40 mb-4"
                    style={{ fontSize: "14px", fontFamily: "Inter, sans-serif", lineHeight: 1.6 }}
                  >
                    Your payment proof has been submitted and is awaiting admin review.
                    This usually takes 1–3 business days. You'll receive an email once your
                    membership is verified.
                  </p>
                  <div className="rounded-xl border border-[#eb7524]/20 bg-[#eb7524]/[0.05] px-4 py-3">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-[#eb7524] shrink-0 mt-0.5" />
                      <p
                        className="text-white/60 text-left"
                        style={{ fontSize: "13px", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}
                      >
                        Your proof is being reviewed by our exec team. You don't need to do
                        anything else right now.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── INACTIVE ── */}
              {membershipStatus === "INACTIVE" && (
                <>
                  <div className="text-center mb-6">
                    <div className="w-14 h-14 bg-[#eb7524]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <ShieldCheck className="w-7 h-7 text-[#eb7524]" />
                    </div>
                    <h2
                      className="text-white mb-1"
                      style={{ fontSize: "24px", fontWeight: 600, fontFamily: "Outfit, sans-serif" }}
                    >
                      Activate Membership
                    </h2>
                    <p
                      className="text-white/40"
                      style={{ fontSize: "14px", fontFamily: "Inter, sans-serif", lineHeight: 1.6 }}
                    >
                      Join AUSS as a verified member to access full benefits.
                      Choose your preferred payment method below.
                    </p>
                  </div>

                  {error && (
                    <div
                      className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400"
                      style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}
                    >
                      {error}
                    </div>
                  )}

                  {user?.lastDeclineReason && (
                    <div className="mb-4 text-left rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-red-300" style={{ fontSize: "13px", fontFamily: "Inter, sans-serif", fontWeight: 600 }}>
                            Previously declined
                          </p>
                          {user.lastDeclineReason.reason ? (
                            <p className="text-red-400/80 mt-0.5" style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}>
                              Reason: {user.lastDeclineReason.reason}
                            </p>
                          ) : (
                            <p className="text-red-400/80 mt-0.5" style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}>
                              Your previous submission was declined. Please address the issue before resubmitting.
                            </p>
                          )}
                          <p className="text-white/30 mt-0.5" style={{ fontSize: "11px", fontFamily: "Inter, sans-serif" }}>
                            {new Date(user.lastDeclineReason.declinedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Bank Transfer Option ── */}
                  <div className="mb-6 rounded-2xl border border-[#eb7524]/20 bg-[#eb7524]/[0.04] p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-[#eb7524]/10 flex items-center justify-center shrink-0">
                        <Banknote className="w-5 h-5 text-[#eb7524]" />
                      </div>
                      <div>
                        <h3
                          className="text-white"
                          style={{ fontSize: "15px", fontFamily: "Outfit, sans-serif", fontWeight: 600 }}
                        >
                          Bank Transfer
                        </h3>
                        <p
                          className="text-white/40"
                          style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
                        >
                          Upload your receipt, reviewed within 1–3 days
                        </p>
                      </div>
                    </div>

                    {/* Upload area */}
                    <div className="space-y-3 mb-4">
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
                        disabled={submitting || hasUploadingPaymentProofs}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#eb7524]/25 bg-[#eb7524]/10 px-4 py-2.5 text-white hover:bg-[#eb7524]/15 transition-colors disabled:opacity-60 cursor-pointer"
                        style={{ fontSize: "14px", fontFamily: "Outfit, sans-serif", fontWeight: 500 }}
                      >
                        {hasUploadingPaymentProofs ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        {hasUploadingPaymentProofs ? "Uploading..." : "Upload Receipt"}
                      </button>

                      {paymentProofUploads.length === 0 ? (
                        <div
                          className="rounded-xl border border-dashed border-white/10 px-4 py-3 text-white/35"
                          style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}
                        >
                          Upload JPG, PNG, or WEBP. Max 10 MB per file.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {paymentProofUploads.map((upload) => (
                            <div
                              key={upload.localId}
                              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p
                                    className="text-white truncate"
                                    style={{ fontSize: "13px", fontFamily: "Outfit, sans-serif", fontWeight: 500 }}
                                  >
                                    {upload.originalFilename}
                                  </p>
                                  <p
                                    className="text-white/35"
                                    style={{ fontSize: "11px", fontFamily: "Inter, sans-serif" }}
                                  >
                                    {upload.status === "uploaded"
                                      ? `${formatBytes(upload.sizeBytes)}`
                                      : upload.status === "uploading"
                                        ? "Uploading..."
                                        : "Upload failed"}
                                  </p>
                                  {upload.error && (
                                    <p className="text-red-400 mt-1 flex items-center gap-1" style={{ fontSize: "11px", fontFamily: "Inter, sans-serif" }}>
                                      <AlertCircle className="w-3 h-3 shrink-0" />{upload.error}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {upload.status === "error" && (
                                    <button
                                      type="button"
                                      onClick={() => handleRetryPaymentProof(upload.localId)}
                                      className="p-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                                      aria-label={`Retry upload for ${upload.originalFilename}`}
                                    >
                                      <RefreshCw className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePaymentProof(upload.localId)}
                                    disabled={upload.status === "uploading"}
                                    className="p-1.5 rounded-lg border border-white/10 text-white/50 hover:text-red-300 disabled:opacity-50 cursor-pointer"
                                    aria-label={`Remove ${upload.originalFilename}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleBankTransferSubmit}
                      disabled={submitting || hasUploadingPaymentProofs || uploadedPaymentProofIds.length === 0}
                      className="w-full bg-[#eb7524] text-white py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-[#d4691f] transition-all disabled:opacity-60 cursor-pointer"
                      style={{ fontSize: "14px", fontFamily: "Outfit, sans-serif", fontWeight: 600 }}
                    >
                      {submitting ? "Submitting..." : "Submit for Review"}
                      {!submitting && <ArrowRight className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* ── Stripe Option ── */}
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                        <CreditCard className="w-5 h-5 text-green-400" />
                      </div>
                      <div>
                        <h3
                          className="text-white"
                          style={{ fontSize: "15px", fontFamily: "Outfit, sans-serif", fontWeight: 600 }}
                        >
                          Pay with Card
                        </h3>
                        <p
                          className="text-white/40"
                          style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
                        >
                          Instant verification via Visa or Mastercard
                        </p>
                      </div>
                    </div>

                    {isStripeConfigured ? (
                      stripeLoadError ? (
                        <div className="text-center py-4">
                          <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                          <p className="text-red-300" style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}>
                            {stripeLoadError}
                          </p>
                        </div>
                      ) : stripeClientSecret ? (
                        <Elements
                          stripe={stripePromise}
                          options={{ clientSecret: stripeClientSecret, appearance: cardAppearance }}
                        >
                          <StripePaymentForm />
                        </Elements>
                      ) : (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-5 h-5 text-[#eb7524] animate-spin" />
                        </div>
                      )
                    ) : (
                      <p
                        className="text-white/35 text-center py-4"
                        style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}
                      >
                        Card payments are not configured yet.
                      </p>
                    )}
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
