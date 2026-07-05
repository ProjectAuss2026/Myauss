import { fetchWithAuth } from "./authFetch";

export const MEMBERSHIP_STATUS_VALUES = [
  "INACTIVE",
  "NEED_REVIEW",
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
}

interface GetAdminMembersOptions {
  status?: MemberStatusFilter | MembershipStatus | null;
  search?: string;
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
  };
}

export async function getAdminMembers({
  status,
  search,
}: GetAdminMembersOptions = {}): Promise<AdminMember[]> {
  const params = new URLSearchParams();
  if (status && status !== "ALL") {
    params.set("status", status);
  }
  if (search?.trim()) {
    params.set("search", search.trim());
  }

  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await fetchWithAuth(`/api/auth/admin/members${query}`);
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response));
  }

  const payload = await response.json().catch(() => null);
  const records = Array.isArray(payload?.data) ? payload.data : [];
  return records.map((record: AdminMemberApiRecord) => mapAdminMember(record));
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
    case "NEED_REVIEW":
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
