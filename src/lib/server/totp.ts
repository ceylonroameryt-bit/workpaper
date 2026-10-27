import crypto from 'crypto';

/**
 * RFC 6238 time-based one-time passwords (30 s step, 6 digits, SHA-1), compatible with
 * Google Authenticator, Microsoft Authenticator and 1Password.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const generateTotpSecret = () => base32Encode(crypto.randomBytes(20));

export function totpCode(secret: string, atMs = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(atMs / 1000 / 30)));
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = h[h.length - 1] & 15;
  const bin = h.readUInt32BE(offset) & 0x7fffffff;
  return String(bin % 1_000_000).padStart(6, '0');
}

/** The 30-second time step a valid code belongs to (current step or one either side for clock drift), or null. */
export function totpStep(secret: string, code: string, atMs = Date.now()): number | null {
  const given = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(given)) return null;
  for (const w of [-1, 0, 1]) {
    const at = atMs + w * 30_000;
    if (crypto.timingSafeEqual(Buffer.from(totpCode(secret, at)), Buffer.from(given))) return Math.floor(at / 30_000);
  }
  return null;
}

export const verifyTotp = (secret: string, code: string, atMs = Date.now()) => totpStep(secret, code, atMs) !== null;

export const otpauthUri = (secret: string, email: string) =>
  `otpauth://totp/${encodeURIComponent(`Blynt Workpapers:${email}`)}?secret=${secret}&issuer=${encodeURIComponent('Blynt Workpapers')}`;
