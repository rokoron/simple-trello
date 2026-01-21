"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { apiFetch } from "@/lib/apiClient";
import { getMemberId } from "@/lib/clientStore";

type TaskStatus = "TODO" | "DOING" | "DONE";
type Role = "OWNER" | "MEMBER";

type Project = { id: string; name: string; inviteCode: string; updatedAt: string };
type Member = { id: string; displayName: string; role: Role };
type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  order: number;
  dueDate: string | null;
  assigneeId: string | null;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
};

type BoardResponse = {
  project: Project;
  me: { memberId: string };
  members: Member[];
  tasks: Task[];
};

const STATUSES: TaskStatus[] = ["TODO", "DOING", "DONE"];
const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "ToDo",
  DOING: "Doing",
  DONE: "Done",
};

function fmtDate(dueDate: string | null) {
  if (!dueDate) return "";
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ja-JP");
}

function toDateInputValue(dueDate: string | null) {
  if (!dueDate) return "";
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const out: Record<TaskStatus, Task[]> = { TODO: [], DOING: [], DONE: [] };
  for (const t of tasks) out[t.status].push(t);
  for (const s of STATUSES) out[s].sort((a, b) => a.order - b.order);
  return out;
}

function normalizeOrders(columns: Record<TaskStatus, Task[]>) {
  const next: Record<TaskStatus, Task[]> = { TODO: [], DOING: [], DONE: [] };
  for (const status of STATUSES) {
    next[status] = columns[status].map((t, idx) => ({ ...t, status, order: idx }));
  }
  return next;
}

function flattenUpdates(columns: Record<TaskStatus, Task[]>) {
  const out: Array<{ id: string; status: TaskStatus; order: number }> = [];
  for (const status of STATUSES) {
    for (let i = 0; i < columns[status].length; i++) {
      out.push({ id: columns[status][i].id, status, order: i });
    }
  }
  return out;
}

function TaskCard({
  task,
  assigneeName,
  onClick,
}: {
  task: Task;
  assigneeName: string | null;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={[
        "group w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-left shadow-sm",
        "hover:border-zinc-300 hover:bg-zinc-50",
        isDragging ? "opacity-60" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-zinc-900">{task.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
            {assigneeName && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5">担当: {assigneeName}</span>
            )}
            {task.dueDate && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5">期限: {fmtDate(task.dueDate)}</span>
            )}
          </div>
        </div>
        <span className="mt-0.5 text-xs text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100">
          編集
        </span>
      </div>
    </button>
  );
}

function Column({
  status,
  tasks,
  membersById,
  onAddTask,
  onOpenTask,
}: {
  status: TaskStatus;
  tasks: Task[];
  membersById: Map<string, Member>;
  onAddTask: (title: string, status: TaskStatus) => void;
  onOpenTask: (task: Task) => void;
}) {
  const [title, setTitle] = useState("");
  const { setNodeRef, isOver } = useDroppable({ id: status });

  const ids = useMemo(() => tasks.map((t) => t.id), [tasks]);

  return (
    <div
      ref={setNodeRef}
      className={[
        "flex h-full flex-col gap-3 rounded-2xl border p-3",
        isOver ? "border-zinc-400 bg-zinc-100" : "border-zinc-200 bg-zinc-50",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-800">{STATUS_LABEL[status]}</div>
        <div className="text-xs text-zinc-500">{tasks.length}</div>
      </div>

      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2 overflow-auto pb-1">
          {tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              assigneeName={t.assigneeId ? membersById.get(t.assigneeId)?.displayName ?? null : null}
              onClick={() => onOpenTask(t)}
            />
          ))}
          {tasks.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-3 py-6 text-center text-xs text-zinc-500">
              ドラッグ&ドロップでここに移動できます
            </div>
          )}
        </div>
      </SortableContext>

      <div className="grid gap-2">
        <input
          className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="タスクを追加"
          onKeyDown={(e) => {
            if (e.key === "Enter" && title.trim()) {
              onAddTask(title.trim(), status);
              setTitle("");
            }
          }}
        />
        <button
          className="h-9 rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-50"
          disabled={!title.trim()}
          onClick={() => {
            if (!title.trim()) return;
            onAddTask(title.trim(), status);
            setTitle("");
          }}
        >
          追加
        </button>
      </div>
    </div>
  );
}

function EditModal({
  open,
  task,
  members,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  task: Task | null;
  members: Member[];
  onClose: () => void;
  onSave: (patch: {
    title: string;
    description: string | null;
    assigneeId: string | null;
    dueDate: string | null;
  }) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(() => task?.title ?? "");
  const [description, setDescription] = useState(() => task?.description ?? "");
  const [assigneeId, setAssigneeId] = useState<string>(() => task?.assigneeId ?? "");
  const [dueDate, setDueDate] = useState<string>(() => toDateInputValue(task?.dueDate ?? null));

  if (!open || !task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div className="text-sm font-semibold">タスク編集</div>
          <button className="text-sm text-zinc-600 hover:underline" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="grid gap-3 px-5 py-4">
          <label className="grid gap-1 text-sm">
            <span className="text-zinc-700">タイトル</span>
            <input
              className="h-10 rounded-xl border border-zinc-200 px-3 outline-none focus:ring-2 focus:ring-zinc-300"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-zinc-700">説明</span>
            <textarea
              className="min-h-24 rounded-xl border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-300"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="任意"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-zinc-700">担当者</span>
              <select
                className="h-10 rounded-xl border border-zinc-200 bg-white px-3 outline-none focus:ring-2 focus:ring-zinc-300"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">未設定</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-zinc-700">期限</span>
              <input
                type="date"
                className="h-10 rounded-xl border border-zinc-200 bg-white px-3 outline-none focus:ring-2 focus:ring-zinc-300"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-zinc-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <button
            className="h-10 rounded-xl bg-rose-600 px-4 text-sm font-medium text-white"
            onClick={onDelete}
          >
            削除
          </button>
          <div className="flex gap-2">
            <button
              className="h-10 rounded-xl bg-white px-4 text-sm font-medium text-zinc-900 ring-1 ring-zinc-200 hover:bg-zinc-50"
              onClick={onClose}
            >
              キャンセル
            </button>
            <button
              className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
              disabled={!title.trim()}
              onClick={() =>
                onSave({
                  title: title.trim(),
                  description: description.trim() ? description.trim() : null,
                  assigneeId: assigneeId || null,
                  dueDate: dueDate ? new Date(dueDate).toISOString() : null,
                })
              }
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BoardClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [columns, setColumns] = useState<Record<TaskStatus, Task[]>>({
    TODO: [],
    DOING: [],
    DONE: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [savingBoard, setSavingBoard] = useState(false);

  const lastLoadedAt = useRef<number>(0);
  const savingRef = useRef<boolean>(false);

  const membersById = useMemo(() => {
    const m = new Map<string, Member>();
    for (const mem of board?.members ?? []) m.set(mem.id, mem);
    return m;
  }, [board?.members]);

  function findContainer(id: string, col: Record<TaskStatus, Task[]>) {
    if (STATUSES.includes(id as TaskStatus)) return id as TaskStatus;
    for (const s of STATUSES) if (col[s].some((t) => t.id === id)) return s;
    return null;
  }

  async function refresh() {
    const memberId = getMemberId();
    if (!memberId) {
      router.push("/");
      return;
    }
    try {
      const res = await apiFetch<BoardResponse>(`/api/projects/${projectId}/board`, { method: "GET" });
      setBoard(res);
      setColumns(groupByStatus(res.tasks));
      setError(null);
      lastLoadedAt.current = Date.now();
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      if (msg === "MISSING_MEMBER_ID" || msg === "FORBIDDEN") router.push("/");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const t = window.setInterval(() => {
      // avoid hammering while the user is actively dragging/saving
      if (savingRef.current) return;
      if (document.visibilityState !== "visible") return;
      // refresh at most every 5s
      if (Date.now() - lastLoadedAt.current < 5000) return;
      refresh();
    }, 2000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function addTask(title: string, status: TaskStatus) {
    try {
      const res = await apiFetch<{ task: Task }>(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        json: { title, status },
      });
      setColumns((prev) => {
        const next = { ...prev, [status]: [...prev[status], res.task] };
        return normalizeOrders(next);
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function persistBoardLayout(nextColumns: Record<TaskStatus, Task[]>) {
    savingRef.current = true;
    setSavingBoard(true);
    try {
      await apiFetch<{ ok: true }>(`/api/projects/${projectId}/board`, {
        method: "PUT",
        json: { tasks: flattenUpdates(nextColumns) },
      });
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      // re-sync from server if saving failed
      refresh();
    } finally {
      setSavingBoard(false);
      savingRef.current = false;
    }
  }

  function onDragStart(ev: DragStartEvent) {
    // no-op (kept for future enhancements)
    void ev;
  }

  function onDragOver(ev: DragOverEvent) {
    const { active, over } = ev;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    setColumns((prev) => {
      const activeContainer = findContainer(activeId, prev);
      const overContainer = findContainer(overId, prev);
      if (!activeContainer || !overContainer) return prev;

      if (activeContainer === overContainer) {
        const activeIndex = prev[activeContainer].findIndex((t) => t.id === activeId);
        const overIndex = prev[overContainer].findIndex((t) => t.id === overId);
        if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) return prev;
        const moved = arrayMove(prev[activeContainer], activeIndex, overIndex);
        return { ...prev, [activeContainer]: moved };
      }

      const activeIndex = prev[activeContainer].findIndex((t) => t.id === activeId);
      const overIndex = prev[overContainer].findIndex((t) => t.id === overId);
      if (activeIndex < 0) return prev;

      const moving = prev[activeContainer][activeIndex];
      const nextActive = prev[activeContainer].filter((t) => t.id !== activeId);

      const insertAt = overIndex >= 0 ? overIndex : prev[overContainer].length;
      const nextOver = [
        ...prev[overContainer].slice(0, insertAt),
        { ...moving, status: overContainer },
        ...prev[overContainer].slice(insertAt),
      ];

      return {
        ...prev,
        [activeContainer]: nextActive,
        [overContainer]: nextOver,
      };
    });
  }

  function onDragEnd(ev: DragEndEvent) {
    const { active, over } = ev;
    if (!over) {
      setColumns((prev) => normalizeOrders(prev));
      return;
    }
    void active; // kept for future enhancements
    setColumns((prev) => {
      const next = normalizeOrders(prev);
      void persistBoardLayout(next);
      return next;
    });
  }

  async function saveTaskEdits(patch: {
    title: string;
    description: string | null;
    assigneeId: string | null;
    dueDate: string | null;
  }) {
    if (!editing) return;
    try {
      const res = await apiFetch<{ task: Task }>(`/api/tasks/${editing.id}`, {
        method: "PATCH",
        json: patch,
      });
      setColumns((prev) => {
        const next: Record<TaskStatus, Task[]> = { TODO: [], DOING: [], DONE: [] };
        for (const s of STATUSES) {
          next[s] = prev[s].map((t) => (t.id === res.task.id ? { ...t, ...res.task } : t));
        }
        return next;
      });
      setEditing(null);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deleteTask() {
    if (!editing) return;
    const id = editing.id;
    try {
      await apiFetch<{ ok: true }>(`/api/tasks/${id}`, { method: "DELETE" });
      setColumns((prev) => {
        const next: Record<TaskStatus, Task[]> = { TODO: [], DOING: [], DONE: [] };
        for (const s of STATUSES) next[s] = prev[s].filter((t) => t.id !== id);
        return normalizeOrders(next);
      });
      setEditing(null);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function copyInviteLink() {
    if (!board) return;
    const url = `${window.location.origin}/join?code=${encodeURIComponent(board.project.inviteCode)}`;
    await navigator.clipboard.writeText(url);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-zinc-600">読み込み中...</div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm">
            ボードを読み込めませんでした。{error ? `(${error})` : ""}
          </div>
          <div className="mt-3">
            <Link className="text-sm underline" href="/">
              トップへ戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <div className="text-xs text-zinc-500">プロジェクト</div>
            <h1 className="text-xl font-semibold tracking-tight">{board.project.name}</h1>
          </div>

          <div className="flex flex-col gap-2 md:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-xs text-zinc-700 ring-1 ring-zinc-200">
                招待コード: <span className="font-mono font-semibold">{board.project.inviteCode}</span>
              </span>
              {savingBoard && (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700 ring-1 ring-amber-200">
                  保存中...
                </span>
              )}
              <button
                className="h-8 rounded-xl bg-white px-3 text-xs font-medium text-zinc-900 ring-1 ring-zinc-200 hover:bg-zinc-50"
                onClick={() => void copyInviteLink()}
              >
                招待リンクをコピー
              </button>
              <Link className="h-8 rounded-xl bg-white px-3 text-xs font-medium text-zinc-900 ring-1 ring-zinc-200 hover:bg-zinc-50" href="/">
                プロジェクト切替
              </Link>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-zinc-600">
              <span className="text-zinc-500">メンバー:</span>
              {board.members.map((m) => (
                <span key={m.id} className="rounded-full bg-zinc-100 px-2 py-0.5">
                  {m.displayName}
                  {m.role === "OWNER" ? " (Owner)" : ""}
                </span>
              ))}
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            エラー: {error}
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div className="grid h-[calc(100vh-220px)] gap-4 md:grid-cols-3">
            {STATUSES.map((status) => (
              <Column
                key={status}
                status={status}
                tasks={columns[status]}
                membersById={membersById}
                onAddTask={addTask}
                onOpenTask={(t) => setEditing(t)}
              />
            ))}
          </div>
        </DndContext>

        <EditModal
          key={editing?.id ?? "none"}
          open={editing !== null}
          task={editing}
          members={board.members}
          onClose={() => setEditing(null)}
          onSave={(patch) => void saveTaskEdits(patch)}
          onDelete={() => void deleteTask()}
        />
      </div>
    </div>
  );
}

