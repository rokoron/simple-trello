import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { getMemberIdOrThrow } from "@/lib/authless";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function assertMemberInProject(projectId: string, memberId: string) {
  const prisma = getPrisma();
  const pm = await prisma.projectMember.findUnique({
    where: { projectId_memberId: { projectId, memberId } },
    select: { projectId: true },
  });
  if (!pm) throw new Error("FORBIDDEN");
}

const PatchTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    status: z.enum(["TODO", "DOING", "DONE"]).optional(),
    order: z.number().int().min(0).max(1000000).optional(),
    dueDate: z.string().datetime().nullable().optional(),
    assigneeId: z.string().min(1).nullable().optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, { message: "EMPTY_BODY" });

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await ctx.params;
  const prisma = getPrisma();

  let memberId = "";
  try {
    memberId = getMemberIdOrThrow(req);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PatchTaskSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_BODY", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true },
  });
  if (!existing) return NextResponse.json({ error: "TASK_NOT_FOUND" }, { status: 404 });

  try {
    await assertMemberInProject(existing.projectId, memberId);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.order !== undefined) data.order = parsed.data.order;
  if (parsed.data.dueDate !== undefined)
    data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;

  if (parsed.data.assigneeId !== undefined) {
    const assigneeId = parsed.data.assigneeId;
    if (assigneeId) {
      const pm = await prisma.projectMember.findUnique({
        where: { projectId_memberId: { projectId: existing.projectId, memberId: assigneeId } },
        select: { memberId: true },
      });
      if (!pm) return NextResponse.json({ error: "ASSIGNEE_NOT_IN_PROJECT" }, { status: 400 });
    }
    data.assigneeId = assigneeId;
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data,
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      order: true,
      dueDate: true,
      assigneeId: true,
      creatorId: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ task });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await ctx.params;
  const prisma = getPrisma();

  let memberId = "";
  try {
    memberId = getMemberIdOrThrow(req);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 });
  }

  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true },
  });
  if (!existing) return NextResponse.json({ ok: true });

  try {
    await assertMemberInProject(existing.projectId, memberId);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  await prisma.task.delete({ where: { id: taskId }, select: { id: true } });
  return NextResponse.json({ ok: true });
}

