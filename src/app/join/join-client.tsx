"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { clearMemberId, setMemberId } from "@/lib/clientStore";

type Project = { id: string; name: string; inviteCode: string };
type Member = { id: string; displayName: string };

export default function JoinClient({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const [displayName, setDisplayNameState] = useState("");
  const [inviteCode, setInviteCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canJoin = useMemo(
    () => displayName.trim().length > 0 && inviteCode.trim().length > 0,
    [displayName, inviteCode],
  );

  async function joinProject() {
    if (!canJoin || busy) return;
    setBusy(true);
    setError(null);
    clearMemberId();
    try {
      const res = await apiFetch<{ project: Project; member: Member }>("/api/projects/join", {
        method: "POST",
        json: { inviteCode, displayName },
      });
      setMemberId(res.member.id);
      router.push(`/p/${res.project.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-10">
        <header className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight">プロジェクト参加</h1>
            <p className="text-sm text-zinc-600">招待コードで参加します。</p>
          </div>
          <Link className="text-sm underline" href="/">
            トップへ
          </Link>
        </header>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            エラー: {error}
          </div>
        )}

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-zinc-700">あなたの名前</span>
              <input
                className="h-10 rounded-xl border border-zinc-200 px-3 outline-none focus:ring-2 focus:ring-zinc-300"
                value={displayName}
                onChange={(e) => setDisplayNameState(e.target.value)}
                placeholder="例: Mori"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-zinc-700">招待コード</span>
              <input
                className="h-10 rounded-xl border border-zinc-200 px-3 uppercase tracking-wider outline-none focus:ring-2 focus:ring-zinc-300"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="例: 8J5K3P2Q"
              />
            </label>
            <button
              className="mt-1 inline-flex h-10 items-center justify-center rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-50"
              onClick={joinProject}
              disabled={!canJoin || busy}
            >
              {busy ? "参加中..." : "参加する"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

