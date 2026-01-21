const MEMBER_ID_KEY = "simple-trello.memberId";

export function getMemberId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(MEMBER_ID_KEY);
}

export function setMemberId(memberId: string) {
  window.localStorage.setItem(MEMBER_ID_KEY, memberId);
}

export function clearMemberId() {
  window.localStorage.removeItem(MEMBER_ID_KEY);
}

