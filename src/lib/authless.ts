import { NextRequest } from "next/server";

export function getMemberIdOrThrow(req: NextRequest): string {
  const memberId = req.headers.get("x-member-id")?.trim();
  if (!memberId) {
    throw new Error("MISSING_MEMBER_ID");
  }
  return memberId;
}

