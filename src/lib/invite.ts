import { randomBytes } from "crypto";

export function generateInviteCode(length = 8): string {
  // 32 chars alphabet (no I/O to reduce confusion)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

