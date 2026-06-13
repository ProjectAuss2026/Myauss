import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

export class UrlValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UrlValidationError';
    this.statusCode = 400;
  }
}

export function isUrlValidationError(error) {
  return error instanceof UrlValidationError;
}

function invalidUrlMessage(fieldName) {
  return `${fieldName} must be a valid http or https URL.`;
}

function privateHostMessage(fieldName) {
  return `${fieldName} cannot point to a local or private host.`;
}

function blankValue(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function normalizeHostname(hostname) {
  return String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .replace(/\.$/, '');
}

function parseIPv4(address) {
  const parts = String(address).split('.');
  if (parts.length !== 4) return null;

  const octets = parts.map((part) => {
    if (!/^\d+$/.test(part)) return NaN;
    const value = Number(part);
    return Number.isInteger(value) && value >= 0 && value <= 255 ? value : NaN;
  });

  return octets.some(Number.isNaN) ? null : octets;
}

function isBlockedIPv4(address) {
  const octets = parseIPv4(address);
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

function extractMappedIPv4(address) {
  const lower = address.toLowerCase();
  if (!lower.includes('.')) return null;

  const maybeIPv4 = lower.slice(lower.lastIndexOf(':') + 1);
  if (!parseIPv4(maybeIPv4)) return null;

  return lower.startsWith('::ffff:') || lower.startsWith('0:0:0:0:0:ffff:')
    ? maybeIPv4
    : null;
}

function isBlockedIPv6(address) {
  const lower = address.toLowerCase();
  const mappedIPv4 = extractMappedIPv4(lower);
  if (mappedIPv4) return isBlockedIPv4(mappedIPv4);

  if (lower === '::' || lower === '::1' || lower === '0:0:0:0:0:0:0:1') {
    return true;
  }

  const firstPart = lower.split(':').find(Boolean);
  if (!firstPart) return true;

  const firstHextet = Number.parseInt(firstPart, 16);
  if (!Number.isFinite(firstHextet)) return false;

  return (
    (firstHextet & 0xfe00) === 0xfc00 ||
    (firstHextet & 0xffc0) === 0xfe80
  );
}

function isBlockedHostname(hostname) {
  const host = normalizeHostname(hostname);
  return host === 'localhost' || host.endsWith('.localhost');
}

export function isLocalOrPrivateHost(hostname) {
  const host = normalizeHostname(hostname);
  if (!host || isBlockedHostname(host)) return true;

  const version = isIP(host);
  if (version === 4) return isBlockedIPv4(host);
  if (version === 6) return isBlockedIPv6(host);

  return false;
}

async function resolveHostname(hostname) {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

async function assertResolvedAddressesArePublic(hostname, fieldName, options = {}) {
  const host = normalizeHostname(hostname);
  if (isIP(host)) return [host];

  const resolver = options.resolveHostname || resolveHostname;
  let addresses;
  try {
    addresses = await resolver(host);
  } catch {
    throw new UrlValidationError(`${fieldName} host could not be verified.`);
  }

  const normalizedAddresses = Array.isArray(addresses)
    ? addresses.map((record) => (typeof record === 'string' ? record : record?.address)).filter(Boolean)
    : [];

  if (normalizedAddresses.some((address) => isLocalOrPrivateHost(address))) {
    throw new UrlValidationError(privateHostMessage(fieldName));
  }

  return normalizedAddresses;
}

export async function validatePublicHttpUrl(value, options = {}) {
  const fieldName = options.fieldName || 'URL';

  if (blankValue(value)) {
    if (options.optional) return null;
    throw new UrlValidationError(invalidUrlMessage(fieldName));
  }

  if (typeof value !== 'string') {
    throw new UrlValidationError(invalidUrlMessage(fieldName));
  }

  const trimmed = value.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new UrlValidationError(invalidUrlMessage(fieldName));
  }

  if (!HTTP_PROTOCOLS.has(parsed.protocol)) {
    throw new UrlValidationError(invalidUrlMessage(fieldName));
  }

  if (isLocalOrPrivateHost(parsed.hostname)) {
    throw new UrlValidationError(privateHostMessage(fieldName));
  }

  if (options.checkDns !== false) {
    await assertResolvedAddressesArePublic(parsed.hostname, fieldName, options);
  }

  return trimmed;
}

export async function validateOptionalPublicHttpUrl(value, options = {}) {
  return validatePublicHttpUrl(value, { ...options, optional: true });
}

export async function resolvePublicHttpUrl(value, options = {}) {
  const fieldName = options.fieldName || 'URL';
  const url = await validatePublicHttpUrl(value, {
    ...options,
    fieldName,
    requireDnsResolution: true,
  });
  const parsed = new URL(url);
  const resolvedAddresses = await assertResolvedAddressesArePublic(parsed.hostname, fieldName, {
    ...options,
    requireDnsResolution: true,
  });
  if (!resolvedAddresses.length) {
    throw new UrlValidationError(`${fieldName} host could not be verified.`);
  }

  return { url, parsed, resolvedAddresses };
}

function hasPathTraversal(path) {
  const pathOnly = path.split(/[?#]/, 1)[0];
  let decoded = pathOnly;
  try {
    decoded = decodeURIComponent(pathOnly);
  } catch {
    return true;
  }
  return decoded.split('/').includes('..');
}

export async function validatePublicImageUrl(value, options = {}) {
  const fieldName = options.fieldName || 'Image URL';

  if (blankValue(value)) {
    if (options.optional) return null;
    throw new UrlValidationError(`${fieldName} must be a valid image URL.`);
  }

  if (typeof value !== 'string') {
    throw new UrlValidationError(`${fieldName} must be a valid image URL.`);
  }

  const trimmed = value.trim();
  if (trimmed.startsWith('/uploads/')) {
    if (trimmed.includes('\\') || hasPathTraversal(trimmed)) {
      throw new UrlValidationError(`${fieldName} must be a valid uploaded image path.`);
    }
    return trimmed;
  }

  return validatePublicHttpUrl(trimmed, { ...options, fieldName });
}

export async function validateOptionalPublicImageUrl(value, options = {}) {
  return validatePublicImageUrl(value, { ...options, optional: true });
}

export async function validateCommunicationImageUrl(value, options = {}) {
  if (value === '__builtin__') return value;
  return validatePublicImageUrl(value, {
    ...options,
    fieldName: 'Communication link image URL',
  });
}

export async function validateConfigUrlFields(type, data, options = {}) {
  if (type === 'communicationLink' && Object.hasOwn(data, 'url')) {
    data.url = await validatePublicHttpUrl(data.url, {
      ...options,
      fieldName: 'Communication link URL',
    });
  }

  if (type === 'communicationLink' && Object.hasOwn(data, 'imgUrl')) {
    data.imgUrl = await validateCommunicationImageUrl(data.imgUrl, options);
  }

  if (type === 'mediaConfig' && Object.hasOwn(data, 'mediaDriveUrl')) {
    data.mediaDriveUrl = await validatePublicHttpUrl(data.mediaDriveUrl, {
      ...options,
      fieldName: 'Photo Drive URL',
    });
  }

  if (type === 'sponsor') {
    await validateSponsorUrlFields(data, options);
  }

  return data;
}

export async function validateSponsorUrlFields(data, options = {}) {
  if (Object.hasOwn(data, 'websiteUrl')) {
    data.websiteUrl = await validateOptionalPublicHttpUrl(data.websiteUrl, {
      ...options,
      fieldName: 'Sponsor website URL',
    });
  }
  return data;
}

export async function validateActivityUrlFields(data, options = {}) {
  if (Object.hasOwn(data, 'externalLink')) {
    data.externalLink = await validateOptionalPublicHttpUrl(data.externalLink, {
      ...options,
      fieldName: 'External link',
    });
  }

  if (Object.hasOwn(data, 'imageUrl')) {
    data.imageUrl = await validateOptionalPublicImageUrl(data.imageUrl, {
      ...options,
      fieldName: 'Activity image URL',
    });
  }

  return data;
}

export async function validateMediaEntryUrlFields(data, options = {}) {
  if (Object.hasOwn(data, 'mediaDriveUrl')) {
    data.mediaDriveUrl = await validatePublicHttpUrl(data.mediaDriveUrl, {
      ...options,
      fieldName: 'Media drive URL',
    });
  }

  if (Object.hasOwn(data, 'overrideCover')) {
    data.overrideCover = await validateOptionalPublicImageUrl(data.overrideCover, {
      ...options,
      fieldName: 'Cover image URL',
    });
  }

  return data;
}
