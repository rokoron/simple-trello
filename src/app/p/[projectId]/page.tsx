import BoardClient from "./board-client";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <BoardClient projectId={projectId} />;
}

