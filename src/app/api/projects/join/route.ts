import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const JoinProjectSchema = z.object({
  inviteCode: z.string().trim().min(4).max(32).transform((s) => s.toUpperCase()),
  displayName: z.string().trim().min(1).max(40),
});

export async function POST(req: Request) {
  const prisma = getPrisma();
  const json = await req.json().catch(() => null);
  const parsed = JoinProjectSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_BODY", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { inviteCode, displayName } = parsed.data;

  const project = await prisma.project.findUnique({
    where: { inviteCode },
    select: { id: true, name: true, inviteCode: true },
  });

  if (!project) {
    return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
  }

  const member = await prisma.member.create({
    data: {
      displayName,
      projects: {
        create: {
          projectId: project.id,
          role: "MEMBER",
        },
      },
    },
    select: { id: true, displayName: true },
  });

  return NextResponse.json({ project, member });
}

