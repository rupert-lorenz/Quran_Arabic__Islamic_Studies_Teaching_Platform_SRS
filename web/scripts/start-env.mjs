import { spawn } from "node:child_process";

const appEnv = process.argv[2];

if (appEnv !== "staging" && appEnv !== "production") {
  console.error("Usage: node scripts/start-env.mjs <staging|production>");
  process.exit(1);
}

const child = spawn("pnpm", ["exec", "next", "start"], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    APP_ENV: appEnv,
    NODE_ENV: "production",
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
