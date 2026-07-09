import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
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
  const [searchParams] = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const { ref: containerRef, inView } = useInViewCustom({ once: true });

  // Payment proof upload state
  const [paymentProofUploads, setPaymentProofUploads] = useState<PaymentProofUploadItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paymentProofInputRef = useRef<HTMLInputElement>(null);

  const uploadedPaymentProofIds = paymentProofUploads
    .filter((u) => u.status === "uploaded" && u.id)
    .map((u) => u.id as string);
  const hasUploadingPaymentProofs = paymentProofUploads.some((u) => u.status === "uploading");

  // Payment query params (from Stripe redirect)
  const paymentResult = searchParams.get("payment");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (paymentResult === "success") {
      showToast("Payment successful! Your membership is now verified.", "success");
      // Clean the URL
      window.history.replaceState({}, "", "/verify-membership");
    } else if (paymentResult === "cancelled") {
      showToast("Payment was cancelled. You can try again anytime.", "info");
      window.history.replaceState({}, "", "/verify-membership");
    }
  }, [paymentResult]);

  if (isLoading || !user) {
    return (
      <div className="bg-black min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#eb7524]/30 border-t-[#eb7524] rounded-full animate-spin" />
      </div>
    );
  }

  const membershipStatus = user.membershipStatus || "INACTIVE";

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

  // ── Stripe checkout ──

  const handleStripeCheckout = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/auth/membership/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to start checkout.");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setError(err?.message || "Failed to start checkout.");
      showToast(err?.message || "Checkout failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

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
            to="/profile"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-8 group"
            style={{ fontFamily: "Outfit, sans-serif", fontSize: "14px" }}
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Profile
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

              {/* ── NEED_REVIEW ── */}
              {membershipStatus === "NEED_REVIEW" && (
                <div className="text-center py-4">
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
                          Upload your receipt — reviewed within 1–3 days
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

                    <p
                      className="text-white/35 mb-4"
                      style={{ fontSize: "13px", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}
                    >
                      Pay securely with Stripe. Your membership is verified immediately
                      after successful payment.
                    </p>

                    <button
                      type="button"
                      onClick={handleStripeCheckout}
                      disabled={submitting}
                      className="w-full bg-green-600 text-white py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-green-500 transition-all disabled:opacity-60 cursor-pointer"
                      style={{ fontSize: "14px", fontFamily: "Outfit, sans-serif", fontWeight: 600 }}
                    >
                      {submitting ? "Redirecting..." : "Pay with Card"}
                      {!submitting && <CreditCard className="w-4 h-4" />}
                    </button>
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
