import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { generateInviteCode } from "@/lib/invite";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CreateProjectSchema = z.object({
  projectName: z.string().trim().min(1).max(80),
  displayName: z.string().trim().min(1).max(40),
});

export async function POST(req: Request) {
  const prisma = getPrisma();
  const json = await req.json().catch(() => null);
  const parsed = CreateProjectSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_BODY", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { projectName, displayName } = parsed.data;

  const member = await prisma.member.create({
    data: { displayName },
    select: { id: true, displayName: true },
  });

  // generate unique invite code (retry on collision)
  let project:
    | { id: string; name: string; inviteCode: string }
    | undefined = undefined;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      project = await prisma.project.create({
        data: {
          name: projectName,
          inviteCode: generateInviteCode(),
          members: {
            create: {
              memberId: member.id,
              role: "OWNER",
            },
          },
        },
        select: { id: true, name: true, inviteCode: true },
      });
      break;
    } catch {
      // inviteCode unique collision → retry
      continue;
    }
  }

  if (!project) {
    return NextResponse.json({ error: "INVITE_CODE_GENERATION_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ project, member });
}

