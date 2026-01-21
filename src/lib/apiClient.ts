import { getMemberId } from "@/lib/clientStore";

export async function apiFetch<T>(
  input: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");

  const memberId = getMemberId();
  if (memberId) headers.set("x-member-id", memberId);

  let body = init.body;
  if (init.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }

  const res = await fetch(input, { ...init, headers, body });
  if (!res.ok) {
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      // ignore
    }
    const msg =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof (payload as { error?: unknown }).error !== "undefined"
        ? String((payload as { error?: unknown }).error)
        : `HTTP_${res.status}`;
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

