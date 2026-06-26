const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:']);

function isBlank(value: unknown): value is null | undefined | '' {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function parseIPv4(hostname: string): number[] | null {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => {
    if (!/^\d+$/.test(part)) return Number.NaN;
    const value = Number(part);
    return Number.isInteger(value) && value >= 0 && value <= 255 ? value : Number.NaN;
  });
  return octets.some(Number.isNaN) ? null : octets;
}

function isPrivateIPv4Octets(octets: number[]): boolean {
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

function isPrivateIPv4(hostname: string): boolean {
  const octets = parseIPv4(hostname);
  return octets ? isPrivateIPv4Octets(octets) : false;
}

function parseIPv6Hextet(part: string): number | null {
  if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
  return Number.parseInt(part, 16);
}

function parseIPv6Section(section: string): number[] | null {
  if (section === '') return [];

  const parts = section.split(':');
  const hextets: number[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (part === '') return null;

    if (part.includes('.')) {
      if (index !== parts.length - 1) return null;
      const octets = parseIPv4(part);
      if (!octets) return null;
      hextets.push((octets[0] << 8) + octets[1], (octets[2] << 8) + octets[3]);
      continue;
    }

    const hextet = parseIPv6Hextet(part);
    if (hextet === null) return null;
    hextets.push(hextet);
  }

  return hextets;
}

function parseIPv6(hostname: string): number[] | null {
  const host = hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  if (!host.includes(':') || host.includes('%')) return null;

  const compressionMatches = host.match(/::/g);
  if ((compressionMatches?.length ?? 0) > 1) return null;

  if (host.includes('::')) {
    const [leftPart, rightPart = ''] = host.split('::');
    const left = parseIPv6Section(leftPart);
    const right = parseIPv6Section(rightPart);
    if (!left || !right) return null;

    const missingHextets = 8 - left.length - right.length;
    if (missingHextets < 1) return null;

    return [...left, ...new Array<number>(missingHextets).fill(0), ...right];
  }

  const hextets = parseIPv6Section(host);
  return hextets?.length === 8 ? hextets : null;
}

function getIPv4MappedIPv6Octets(hextets: number[]): number[] | null {
  const hasIPv4MappedPrefix =
    hextets.length === 8 &&
    hextets[0] === 0 &&
    hextets[1] === 0 &&
    hextets[2] === 0 &&
    hextets[3] === 0 &&
    hextets[4] === 0 &&
    hextets[5] === 0xffff;

  if (!hasIPv4MappedPrefix) return null;

  return [hextets[6] >> 8, hextets[6] & 0xff, hextets[7] >> 8, hextets[7] & 0xff];
}

function isPrivateIPv6(hostname: string): boolean {
  const hextets = parseIPv6(hostname);
  if (!hextets) return false;

  const mappedIPv4Octets = getIPv4MappedIPv6Octets(hextets);
  if (mappedIPv4Octets) return isPrivateIPv4Octets(mappedIPv4Octets);

  const firstHextet = hextets[0];
  const isUnspecified = hextets.every((hextet) => hextet === 0);
  const isLoopback = hextets.slice(0, 7).every((hextet) => hextet === 0) && hextets[7] === 1;

  return (
    isUnspecified ||
    isLoopback ||
    (firstHextet & 0xfe00) === 0xfc00 ||
    (firstHextet & 0xffc0) === 0xfe80
  );
}

function isLocalOrPrivateHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '').replace(/^\[/, '').replace(/\]$/, '');
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
