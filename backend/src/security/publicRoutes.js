function route(method, path) {
  return Object.freeze({ method, path });
}

export function routeKey({ method, path }) {
  return `${method.toUpperCase()} ${path}`;
}

export const PUBLIC_ROUTES = Object.freeze([
  route("GET", "/healthz"),
  route("GET", "/readyz"),
  route("GET", "/api/health"),
  route("GET", "/api/test"),
  route("GET", "/uploads/*"),
  // SPA fallback (backend/src/app.js): serves the built frontend index.html for
  // any non-API GET so client-side routes resolve on refresh/deep-link. Public
  // by design — loading the web app requires no auth.
  route("GET", "/api/upload/:id"),
  route("GET", "/*"),
  route("POST", "/api/auth/register"),
  route("POST", "/api/auth/resend-code"),
  route("POST", "/api/auth/verify"),
  route("POST", "/api/auth/login"),
  route("POST", "/api/auth/forgot-password"),
  route("POST", "/api/auth/reset-password"),
  route("POST", "/api/auth/refresh"),
  route("POST", "/api/auth/logout"),
  route("GET", "/api/config"),
  route("GET", "/api/public-config"),
  route("GET", "/api/activities"),
  route("GET", "/api/activities/:id/rsvp/count"),
  route("GET", "/api/sponsorship"),
  route("GET", "/api/faq"),
  route("GET", "/api/executives"),
  route("GET", "/api/media-entries"),
  // Stripe posts here directly; authenticity is enforced by webhook signature
  // verification, not a JWT.
  route("POST", "/api/payments/webhook"),
]);

export const AUTHENTICATED_ROUTES = Object.freeze([
  // Members-only with an active-membership gate (KAN-178). Moved out of
  // PUBLIC_ROUTES — events are no longer open to non-members or walk-ins.
  route("POST", "/api/activities/:id/rsvp"),
  route("GET", "/api/auth/me"),
  route("DELETE", "/api/auth/me/info"),
  route("POST", "/api/auth/payment-proofs/pending"),
  route("DELETE", "/api/auth/payment-proofs/pending/:proofUploadId"),
  route("POST", "/api/auth/membership/submit-payment"),
  route("GET", "/api/auth/admin/users/lookup"),
  route("GET", "/api/auth/admin/users/search"),
  route("POST", "/api/auth/admin/invitations"),
  route("POST", "/api/auth/admin/invitations/accept"),
  route("GET", "/api/auth/admin/users"),
  route("POST", "/api/auth/admin/users/:userId/promote"),
  route("POST", "/api/auth/admin/users/:userId/demote"),
  route("GET", "/api/auth/admin/members"),
  route("GET", "/api/auth/admin/members/:userId/payment-proofs"),
  route("GET", "/api/auth/admin/members/:userId/payments"),
  route("GET", "/api/auth/admin/payment-proofs/:proofId/file"),
  route("POST", "/api/auth/admin/members/:userId/status"),
  route("POST", "/api/upload"),
  route("POST", "/api/payments/intent"),
  route("POST", "/api/payments/confirm"),
]);

export const ADMIN_ROUTES = Object.freeze([
  route("PATCH", "/api/config"),
  route("POST", "/api/config"),
  route("DELETE", "/api/config"),
  route("GET", "/api/activities/all"),
  route("POST", "/api/activities"),
  route("PATCH", "/api/activities/:id"),
  route("DELETE", "/api/activities/:id"),
  route("GET", "/api/activities/:id/rsvps"),
  route("GET", "/api/activities/:id/rsvps/export"),
  route("DELETE", "/api/activities/:id/rsvps/:rsvpId"),
  route("PATCH", "/api/sponsorship"),
  route("POST", "/api/sponsors"),
  route("PATCH", "/api/sponsors/:id"),
  route("DELETE", "/api/sponsors/:id"),
  route("GET", "/api/admin/faq"),
  route("POST", "/api/admin/faq"),
  route("PUT", "/api/admin/faq/:id"),
  route("DELETE", "/api/admin/faq/:id"),
  route("GET", "/api/admin/executives"),
  route("POST", "/api/admin/executives"),
  route("PUT", "/api/admin/executives/:id"),
  route("DELETE", "/api/admin/executives/:id"),
  route("GET", "/api/admin/exec-roles"),
  route("POST", "/api/admin/exec-roles"),
  route("PATCH", "/api/admin/exec-roles/reorder"),
  route("PATCH", "/api/admin/exec-roles/:id"),
  route("DELETE", "/api/admin/exec-roles/:id"),
  route("GET", "/api/admin/exec-teams"),
  route("POST", "/api/admin/exec-teams"),
  route("PATCH", "/api/admin/exec-teams/reorder"),
  route("PATCH", "/api/admin/exec-teams/:id"),
  route("DELETE", "/api/admin/exec-teams/:id"),
  route("POST", "/api/media-entries"),
  route("PATCH", "/api/media-entries/:id"),
  route("DELETE", "/api/media-entries/:id"),
  route("POST", "/api/resolve-cover"),
]);

export const PROTECTED_ROUTES = Object.freeze([
  ...AUTHENTICATED_ROUTES,
  ...ADMIN_ROUTES,
]);

export const ROUTE_SECURITY = Object.freeze([
  ...PUBLIC_ROUTES.map((item) => Object.freeze({ ...item, access: "public" })),
  ...AUTHENTICATED_ROUTES.map((item) =>
    Object.freeze({ ...item, access: "authenticated" }),
  ),
  ...ADMIN_ROUTES.map((item) => Object.freeze({ ...item, access: "admin" })),
]);

export const PUBLIC_ROUTE_KEYS = new Set(PUBLIC_ROUTES.map(routeKey));
export const AUTHENTICATED_ROUTE_KEYS = new Set(
  AUTHENTICATED_ROUTES.map(routeKey),
);
export const ADMIN_ROUTE_KEYS = new Set(ADMIN_ROUTES.map(routeKey));
export const CLASSIFIED_ROUTE_KEYS = new Set(ROUTE_SECURITY.map(routeKey));
