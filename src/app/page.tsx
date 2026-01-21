"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { clearMemberId, setMemberId } from "@/lib/clientStore";

type Project = { id: string; name: string; inviteCode: string };
type Member = { id: string; displayName: string };

export default function HomePage() {
  const router = useRouter();
  const [displayName, setDisplayNameState] = useState("");
  const [projectName, setProjectName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canCreate = useMemo(
    () => displayName.trim().length > 0 && projectName.trim().length > 0,
    [displayName, projectName],
  );
  const canJoin = useMemo(
    () => displayName.trim().length > 0 && inviteCode.trim().length > 0,
    [displayName, inviteCode],
  );

  async function createProject() {
    if (!canCreate || busy) return;
    setBusy("create");
    setError(null);
    clearMemberId();
    try {
      const res = await apiFetch<{ project: Project; member: Member }>("/api/projects", {
        method: "POST",
        json: { projectName, displayName },
      });
      setMemberId(res.member.id);
      router.push(`/p/${res.project.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function joinProject() {
    if (!canJoin || busy) return;
    setBusy("join");
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
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Simple Trello</h1>
          <p className="text-sm text-zinc-600">
            複数人で共有できる、ToDo/Doing/Done のシンプルなタスクボード
          </p>
        </header>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            エラー: {error}
          </div>
        )}

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">新規プロジェクトを作成</h2>
            <p className="mt-1 text-sm text-zinc-600">
              作成後に表示される招待コードを共有すると、メンバーを招待できます。
            </p>

            <div className="mt-4 grid gap-3">
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
                <span className="text-zinc-700">プロジェクト名</span>
                <input
                  className="h-10 rounded-xl border border-zinc-200 px-3 outline-none focus:ring-2 focus:ring-zinc-300"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="例: Webリニューアル"
                />
              </label>
              <button
                className="mt-1 inline-flex h-10 items-center justify-center rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-50"
                onClick={createProject}
                disabled={!canCreate || busy !== null}
              >
                {busy === "create" ? "作成中..." : "作成する"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">招待コードで参加</h2>
            <p className="mt-1 text-sm text-zinc-600">
              招待コードを入力してプロジェクトに参加します。
            </p>

            <div className="mt-4 grid gap-3">
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
                className="mt-1 inline-flex h-10 items-center justify-center rounded-xl bg-white text-sm font-medium text-zinc-900 ring-1 ring-zinc-200 hover:bg-zinc-50 disabled:opacity-50"
                onClick={joinProject}
                disabled={!canJoin || busy !== null}
              >
                {busy === "join" ? "参加中..." : "参加する"}
              </button>
              <div className="text-xs text-zinc-600">
                もしくは{" "}
                <Link className="underline" href="/join">
                  招待リンク用の参加ページ
                </Link>{" "}
                を使えます。
              </div>
            </div>
          </div>
        </section>

        <footer className="text-xs text-zinc-500">
          ログイン無しの簡易版です（ブラウザごとにメンバーIDを保存します）。
        </footer>
      </main>
    </div>
  );
}
