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

const CreateTaskSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(["TODO", "DOING", "DONE"]).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  assigneeId: z.string().min(1).optional().nullable(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
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
  const parsed = CreateTaskSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_BODY", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const status = parsed.data.status ?? "TODO";
  const dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  const assigneeId = parsed.data.assigneeId ?? null;

  if (assigneeId) {
    const pm = await prisma.projectMember.findUnique({
      where: { projectId_memberId: { projectId, memberId: assigneeId } },
      select: { memberId: true },
    });
    if (!pm) return NextResponse.json({ error: "ASSIGNEE_NOT_IN_PROJECT" }, { status: 400 });
  }

  const maxOrder = await prisma.task.aggregate({
    where: { projectId, status },
    _max: { order: true },
  });
  const order = (maxOrder._max.order ?? -1) + 1;

  const task = await prisma.task.create({
    data: {
      projectId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status,
      order,
      dueDate,
      assigneeId,
      creatorId: memberId,
    },
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

