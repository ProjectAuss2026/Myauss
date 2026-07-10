import { fetchWithAuth } from "./authFetch";

export const MEMBERSHIP_STATUS_VALUES = [
  "INACTIVE",
  "IN_REVIEW",
  "VERIFIED",
] as const;

export type MembershipStatus = (typeof MEMBERSHIP_STATUS_VALUES)[number];
export type MemberStatusFilter = "ALL" | MembershipStatus;

export interface AdminMemberApiRecord {
  id: string;
  email?: string | null;
  role?: string | null;
  membershipStatus?: string | null;
  membershipStatusUpdatedAt?: string | null;
  isVerified?: boolean | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  fullName?: string | null;
  studentId?: string | null;
  studentID?: string | null;
  createdAt?: string | null;
  joinedAt?: string | null;
  lastPayment?: unknown;
}

// One row of the card-payment ledger (KAN-138 AC7).
export interface MemberPayment {
  id: string;
  stripePaymentIntentId: string | null;
  amountCents: number;
  currency: string;
  method: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  paidAt: string | null;
}

export interface AdminMember {
  id: string;
  name: string | null;
  email: string | null;
  studentId: string | null;
  joinedAt: string | null;
  membershipStatus: MembershipStatus | string;
  membershipStatusUpdatedAt: string | null;
  role: string | null;
  isVerified: boolean;
  lastPayment: MemberPayment | null;
}

export interface AdminMembersPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface AdminMembersResult {
  members: AdminMember[];
  pagination: AdminMembersPagination;
}

export interface MemberPaymentProofMetadata {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  expiresAt?: string | null;
  linkedAt?: string | null;
}

export interface MemberPaymentProofFileResult {
  blob: Blob;
  contentType: string | null;
  filename: string | null;
}

interface UpdateAdminMemberStatusOptions {
  status: MembershipStatus;
  reason?: string | null;
}

interface GetAdminMembersOptions {
  status?: MemberStatusFilter | MembershipStatus | null;
  search?: string;
  page?: number;
  pageSize?: number;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toMembershipStatus(value: unknown): MembershipStatus | string {
  const normalized =
    typeof value === "string" ? value.trim().toUpperCase() : "";
  if ((MEMBERSHIP_STATUS_VALUES as readonly string[]).includes(normalized)) {
    return normalized as MembershipStatus;
  }
  return normalized || "INACTIVE";
}

function buildMemberName(record: AdminMemberApiRecord): string | null {
  const explicitName = readString(record.fullName) || readString(record.name);
  if (explicitName) {
    return explicitName;
  }

  const firstName = readString(record.firstName);
  const lastName = readString(record.lastName);
  const combined = [firstName, lastName].filter(Boolean).join(" ").trim();
  return combined || null;
}

async function getApiErrorMessage(response: Response): Promise<string> {
  const fallback = `Request failed: ${response.status}`;
  try {
    const payload = await response.json();
    return (
      (typeof payload?.error === "string"
        ? payload.error
        : payload?.error?.message) ||
      payload?.message ||
      fallback
    );
  } catch {
    return fallback;
  }
}

function parseContentDispositionFilename(value: string | null): string | null {
  const headerValue = readString(value);
  if (!headerValue) {
    return null;
  }

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const quotedMatch = headerValue.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }

  const bareMatch = headerValue.match(/filename=([^;]+)/i);
  return bareMatch?.[1]?.trim() || null;
}

function readPositiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function readNonNegativeInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : fallback;
}

function createFallbackPagination(
  recordsLength: number,
  page = 1,
  pageSize = recordsLength,
): AdminMembersPagination {
  const fallbackPage = readPositiveInteger(page, 1);
  const fallbackPageSize = Math.max(readPositiveInteger(pageSize, 1), 1);

  return {
    page: fallbackPage,
    pageSize: fallbackPageSize,
    total: recordsLength,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  };
}

function readPagination(
  value: unknown,
  recordsLength: number,
  requestedPage: number,
  requestedPageSize: number,
): AdminMembersPagination {
  if (!value || typeof value !== "object") {
    return createFallbackPagination(
      recordsLength,
      requestedPage,
      requestedPageSize,
    );
  }

  const pagination = value as Record<string, unknown>;
  const page = readPositiveInteger(pagination.page, requestedPage);
  const pageSize = Math.max(
    readPositiveInteger(pagination.pageSize, requestedPageSize),
    1,
  );
  const total = readNonNegativeInteger(pagination.total, recordsLength);
  const totalPages = Math.max(
    1,
    readPositiveInteger(
      pagination.totalPages,
      Math.ceil(total / pageSize) || 1,
    ),
  );

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasPreviousPage:
      typeof pagination.hasPreviousPage === "boolean"
        ? pagination.hasPreviousPage
        : page > 1,
    hasNextPage:
      typeof pagination.hasNextPage === "boolean"
        ? pagination.hasNextPage
        : page < totalPages,
  };
}

export function mapMemberPayment(value: unknown): MemberPayment | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = readString(record.id);
  if (!id) {
    return null;
  }

  return {
    id,
    stripePaymentIntentId: readString(record.stripePaymentIntentId),
    amountCents:
      typeof record.amountCents === "number" &&
      Number.isFinite(record.amountCents)
        ? record.amountCents
        : 0,
    currency: readString(record.currency)?.toLowerCase() || "nzd",
    method: readString(record.method),
    cardBrand: readString(record.cardBrand),
    cardLast4: readString(record.cardLast4),
    paidAt: readString(record.paidAt),
  };
}

export function mapAdminMember(record: AdminMemberApiRecord): AdminMember {
  return {
    id: record.id,
    name: buildMemberName(record),
    email: readString(record.email),
    studentId: readString(record.studentId) || readString(record.studentID),
    joinedAt: readString(record.joinedAt) || readString(record.createdAt),
    membershipStatus: toMembershipStatus(record.membershipStatus),
    membershipStatusUpdatedAt: readString(record.membershipStatusUpdatedAt),
    role: readString(record.role),
    isVerified: Boolean(record.isVerified),
    lastPayment: mapMemberPayment(record.lastPayment),
  };
}

export async function getAdminMembers({
  status,
  search,
  page,
  pageSize,
}: GetAdminMembersOptions = {}): Promise<AdminMembersResult> {
  const params = new URLSearchParams();
  const requestedPage = readPositiveInteger(page, 1);
  const requestedPageSize = readPositiveInteger(pageSize, 20);

  if (status && status !== "ALL") {
    params.set("status", status);
  }
  if (search?.trim()) {
    params.set("search", search.trim());
  }
  params.set("page", String(requestedPage));
  params.set("pageSize", String(requestedPageSize));

  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await fetchWithAuth(`/api/auth/admin/members${query}`);
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response));
  }

  const payload = await response.json().catch(() => null);
  const records = Array.isArray(payload?.data) ? payload.data : [];
  return {
    members: records.map((record: AdminMemberApiRecord) =>
      mapAdminMember(record),
    ),
    pagination: readPagination(
      payload?.pagination,
      records.length,
      requestedPage,
      requestedPageSize,
    ),
  };
}

export async function getMemberPaymentProofs(
  userId: string,
): Promise<MemberPaymentProofMetadata[]> {
  const response = await fetchWithAuth(
    `/api/auth/admin/members/${encodeURIComponent(userId)}/payment-proofs`,
  );

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response));
  }

  const payload = await response.json().catch(() => null);
  const records = Array.isArray(payload?.data) ? payload.data : [];

  return records.map((record: Record<string, unknown>) => ({
    id: String(record.id || ""),
    originalFilename: readString(record.originalFilename) || "payment-proof",
    mimeType: readString(record.mimeType) || "application/octet-stream",
    sizeBytes:
      typeof record.sizeBytes === "number" && Number.isFinite(record.sizeBytes)
        ? record.sizeBytes
        : 0,
    status: readString(record.status),
    createdAt: readString(record.createdAt),
    updatedAt: readString(record.updatedAt),
    expiresAt: readString(record.expiresAt),
    linkedAt: readString(record.linkedAt),
  }));
}

export async function getMemberPayments(
  userId: string,
): Promise<MemberPayment[]> {
  const response = await fetchWithAuth(
    `/api/auth/admin/members/${encodeURIComponent(userId)}/payments`,
  );

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response));
  }

  const payload = await response.json().catch(() => null);
  const records = Array.isArray(payload?.data) ? payload.data : [];

  return records
    .map((record: unknown) => mapMemberPayment(record))
    .filter((payment: MemberPayment | null): payment is MemberPayment =>
      Boolean(payment),
    );
}

export async function getMemberPaymentProofFile(
  proofId: string,
): Promise<MemberPaymentProofFileResult> {
  const response = await fetchWithAuth(
    `/api/auth/admin/payment-proofs/${encodeURIComponent(proofId)}/file`,
  );

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response));
  }

  return {
    blob: await response.blob(),
    contentType: readString(response.headers.get("content-type")),
    filename: parseContentDispositionFilename(
      response.headers.get("content-disposition"),
    ),
  };
}

export async function updateAdminMemberStatus(
  userId: string,
  { status, reason }: UpdateAdminMemberStatusOptions,
): Promise<AdminMember | null> {
  const response = await fetchWithAuth(
    `/api/auth/admin/members/${encodeURIComponent(userId)}/status`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status, reason: reason || null }),
    },
  );

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response));
  }

  const payload = await response.json().catch(() => null);
  return payload?.data ? mapAdminMember(payload.data) : null;
}

function normalizeSearchValue(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function matchesAdminMemberSearch(
  member: AdminMember,
  search: string,
): boolean {
  const query = normalizeSearchValue(search);
  if (!query) {
    return true;
  }

  return [member.name, member.email, member.studentId].some((value) =>
    normalizeSearchValue(value).includes(query),
  );
}

export function filterAdminMembers(
  members: AdminMember[],
  search: string,
): AdminMember[] {
  if (!search.trim()) {
    return members;
  }
  return members.filter((member) => matchesAdminMemberSearch(member, search));
}

export function formatMembershipStatus(
  status: string | null | undefined,
): string {
  switch ((status || "").toUpperCase()) {
    case "INACTIVE":
      return "Inactive";
    case "IN_REVIEW":
      return "Need Review";
    case "VERIFIED":
      return "Verified";
    default:
      return readString(status)?.replace(/_/g, " ") || "Unknown";
  }
}

export function formatMemberRole(role: string | null | undefined): string {
  switch ((role || "").toUpperCase()) {
    case "OWNER":
      return "Owner";
    case "ADMIN":
      return "Admin";
    case "USER":
      return "User";
    default:
      return readString(role) || "—";
  }
}

export function formatPaymentAmount(
  amountCents: number,
  currency: string | null | undefined,
): string {
  const code = (readString(currency) || "nzd").toUpperCase();
  try {
    return new Intl.NumberFormat("en-NZ", {
      style: "currency",
      currency: code,
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${code}`;
  }
}

export function formatPaymentMethod(payment: MemberPayment): string {
  if (payment.cardBrand || payment.cardLast4) {
    const brand = payment.cardBrand
      ? payment.cardBrand.charAt(0).toUpperCase() + payment.cardBrand.slice(1)
      : "Card";
    return payment.cardLast4 ? `${brand} •••• ${payment.cardLast4}` : brand;
  }
  return readString(payment.method)?.replace(/_/g, " ") || "Card";
}

export function formatMemberDate(value: string | null | undefined): string {
  const dateValue = readString(value);
  if (!dateValue) {
    return "—";
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-NZ", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatMemberDateTime(value: string | null | undefined): string {
  const dateValue = readString(value);
  if (!dateValue) {
    return "—";
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-NZ", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
