import { getPublicConfig, resetConfigCache } from "../src/server/config";
import { loadEnv } from "../src/server/load-env";

const envFlagIndex = process.argv.indexOf("--env");
const requestedEnv = envFlagIndex >= 0 ? process.argv[envFlagIndex + 1] : undefined;

if (requestedEnv) {
  process.env.APP_ENV = requestedEnv;
}

loadEnv();

resetConfigCache();

try {
  const publicConfig = getPublicConfig();
  console.log(JSON.stringify(publicConfig, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
