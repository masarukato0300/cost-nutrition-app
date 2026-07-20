export const permanentUnlockEmails = ["info@3dcakeub.com"];

export function normalizeEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase();
}

export function isPermanentUnlockEmail(email?: string | null) {
  return permanentUnlockEmails.includes(normalizeEmail(email));
}
