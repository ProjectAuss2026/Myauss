const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:']);

function isBlank(value: unknown): value is null | undefined | '' {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function parseIPv4(hostname: string): number[] | null {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => {
    if (!/^\d+$/.test(part)) return NaN;
    const value = Number(part);
    return Number.isInteger(value) && value >= 0 && value <= 255 ? value : NaN;
  });
  return octets.some(Number.isNaN) ? null : octets;
}

function isPrivateIPv4(hostname: string): boolean {
  const octets = parseIPv4(hostname);
  if (!octets) return false;
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isPrivateIPv6(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  if (host === '::' || host === '::1' || host === '0:0:0:0:0:0:0:1') return true;

  const firstPart = host.split(':').find(Boolean);
  if (!firstPart) return true;

  const firstHextet = Number.parseInt(firstPart, 16);
  if (!Number.isFinite(firstHextet)) return false;

  return (firstHextet & 0xfe00) === 0xfc00 || (firstHextet & 0xffc0) === 0xfe80;
}

function isLocalOrPrivateHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost')) return true;
  if (isPrivateIPv4(host)) return true;
  if (host.includes(':') && isPrivateIPv6(host)) return true;
  return false;
}

function hasPathTraversal(path: string): boolean {
  const pathOnly = path.split(/[?#]/, 1)[0];
  try {
    return decodeURIComponent(pathOnly).split('/').includes('..');
  } catch {
    return true;
  }
}

export function getSafeLinkHref(value: unknown): string | null {
  if (isBlank(value) || typeof value !== 'string') return null;

  const trimmed = value.trim();
  try {
    const parsed = new URL(trimmed);
    if (!SAFE_LINK_PROTOCOLS.has(parsed.protocol)) return null;
    if (isLocalOrPrivateHost(parsed.hostname)) return null;
    return trimmed;
  } catch {
    return null;
  }
}

export function getSafeImageSrc(value: unknown): string | null {
  if (isBlank(value) || typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (trimmed.startsWith('/uploads/')) {
    return trimmed.includes('\\') || hasPathTraversal(trimmed) ? null : trimmed;
  }

  return getSafeLinkHref(trimmed);
}

export function isSafeLinkHref(value: unknown): boolean {
  return getSafeLinkHref(value) !== null;
}

export function isSafeImageSrc(value: unknown): boolean {
  return getSafeImageSrc(value) !== null;
}
