import { spawnSync } from "node:child_process";

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: "inherit", shell: false });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

const url = process.env.DATABASE_URL ?? "";
const isPostgres = url.startsWith("postgres://") || url.startsWith("postgresql://");

if (isPostgres) {
  console.log("DATABASE_URL looks like Postgres. Running prisma migrate deploy...");
  run("npx", ["prisma", "migrate", "deploy"]);
} else {
  console.log(
    "DATABASE_URL is not Postgres (or not set). Skipping prisma migrate deploy for this build.",
  );
}

run("npx", ["next", "build"]);

