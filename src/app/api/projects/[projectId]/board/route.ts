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

export async function GET(req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  const prisma = getPrisma();

  let memberId = "";
  try {
    memberId = getMemberIdOrThrow(req);
    await assertMemberInProject(projectId, memberId);
  } catch (e) {
    const code = (e as Error).message;
    const status = code === "MISSING_MEMBER_ID" ? 401 : 403;
    return NextResponse.json({ error: code }, { status });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, inviteCode: true, updatedAt: true },
  });

  if (!project) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    orderBy: { joinedAt: "asc" },
    select: {
      role: true,
      member: { select: { id: true, displayName: true } },
    },
  });

  const tasks = await prisma.task.findMany({
    where: { projectId },
    orderBy: [{ status: "asc" }, { order: "asc" }, { createdAt: "asc" }],
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

  return NextResponse.json({
    project,
    me: { memberId },
    members: members.map((m) => ({ ...m.member, role: m.role })),
    tasks,
  });
}

const BoardUpdateSchema = z.object({
  tasks: z
    .array(
      z.object({
        id: z.string().min(1),
        status: z.enum(["TODO", "DOING", "DONE"]),
        order: z.number().int().min(0).max(1000000),
      }),
    )
    .max(2000),
});

export async function PUT(req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  const prisma = getPrisma();

  let memberId = "";
  try {
    memberId = getMemberIdOrThrow(req);
    await assertMemberInProject(projectId, memberId);
  } catch (e) {
    const code = (e as Error).message;
    const status = code === "MISSING_MEMBER_ID" ? 401 : 403;
    return NextResponse.json({ error: code }, { status });
  }

  const json = await req.json().catch(() => null);
  const parsed = BoardUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_BODY", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const ids = parsed.data.tasks.map((t) => t.id);
  const existing = await prisma.task.findMany({
    where: { id: { in: ids } },
    select: { id: true, projectId: true },
  });
  if (existing.length !== ids.length || existing.some((t) => t.projectId !== projectId)) {
    return NextResponse.json({ error: "TASKS_NOT_IN_PROJECT" }, { status: 400 });
  }

  await prisma.$transaction(
    parsed.data.tasks.map((t) =>
      prisma.task.update({
        where: { id: t.id },
        data: { status: t.status, order: t.order },
        select: { id: true },
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}

