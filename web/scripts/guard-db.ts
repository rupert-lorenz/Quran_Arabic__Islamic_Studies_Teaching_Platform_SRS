import { spawn } from "node:child_process";
import { getConfig, resetConfigCache } from "../src/server/config";
import { loadEnv } from "../src/server/load-env";

const action = process.argv[2];

if (!action || !["push", "seed", "setup"].includes(action)) {
  console.error("Usage: tsx scripts/guard-db.ts <push|seed|setup>");
  process.exit(1);
}

loadEnv();
resetConfigCache();
const config = getConfig();

const allowed =
  action === "push"
    ? config.allowDbPush
    : action === "seed"
      ? config.allowDbSeed
      : config.allowDbSetup;

if (!allowed) {
  console.error(
    `db:${action} is disabled in ${config.APP_ENV}. Set ALLOW_DESTRUCTIVE_DB=true only if you intend to change this environment.`,
  );
  process.exit(1);
}

const commands: Record<string, [string, string[]]> = {
  push: ["pnpm", ["exec", "drizzle-kit", "push"]],
  seed: ["pnpm", ["exec", "tsx", "src/db/seed.ts"]],
  setup: ["node", ["scripts/setup-postgres.mjs"]],
};

const [command, args] = commands[action];
const child = spawn(command, args, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
