import JoinClient from "./join-client";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const sp = await searchParams;
  return <JoinClient initialCode={sp.code ?? ""} />;
}

