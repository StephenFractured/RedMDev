// Jenkins one-at-a-time hash as used by RAGE (GetHashKey / backtick literals).
export function joaat(input: string): number {
  const s = input.toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h + s.charCodeAt(i)) >>> 0;
    h = (h + (h << 10)) >>> 0;
    h = (h ^ (h >>> 6)) >>> 0;
  }
  h = (h + (h << 3)) >>> 0;
  h = (h ^ (h >>> 11)) >>> 0;
  h = (h + (h << 15)) >>> 0;
  return h >>> 0;
}

export const toSigned = (u: number) => (u | 0);
export const toUnsigned = (n: number) => n >>> 0;
export const toHex = (n: number) => '0x' + (n >>> 0).toString(16).toUpperCase().padStart(8, '0');

/** Parse '0x1A2B', '-12345' or '12345' into an unsigned 32-bit value. */
export function parseHash32(v: string): number | null {
  const t = v.trim();
  if (/^0x[0-9a-f]{1,8}$/i.test(t)) return parseInt(t, 16) >>> 0;
  if (/^-?\d{1,10}$/.test(t)) {
    const n = Number(t);
    if (n >= -2147483648 && n <= 4294967295) return n >>> 0;
  }
  return null;
}

/** Every 32-bit representation of a value, so a search for any of them can match. */
export function hashForms(u: number): string[] {
  return [toHex(u), String(toUnsigned(u)), String(toSigned(u))];
}

/** Native hashes are 64-bit hex: normalise to 0x + 16 upper-case digits. */
export function normNativeHash(h: string): string {
  return '0x' + h.replace(/^0x/i, '').toUpperCase().padStart(16, '0');
}
