import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { db, sql } from "@/db";
import { roles, users } from "@/db/schema";
import { docIds, integrationRows } from "@/server/docs/content";
import { trainingCourses } from "@/server/docs/training";
import { getConfig } from "@/server/config";
import { uatAccountPlan } from "@/server/testing/uat-accounts";

const accountRoles = [
  "super_admin",
  "admin",
  "accounts",
  "marketing",
  "academic",
  "safeguarding",
  "teacher",
  "student",
  "parent",
] as const;

function repoRoot() {
  return path.resolve(process.cwd(), "..");
}

function gitFacts() {
  let remote = false;
  try {
    const config = readFileSync(path.join(repoRoot(), ".git", "config"), "utf8");
    remote = config.includes('[remote "origin"]');
  } catch {
    remote = false;
  }

  let dirty = true;
  try {
    const output = execFileSync("git", ["status", "--porcelain"], {
      cwd: repoRoot(),
      encoding: "utf8",
      timeout: 20000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    dirty = output.trim().length > 0;
  } catch {
    dirty = true;
  }

  return { remote, dirty };
}

export async function getHandoverFaculties() {
  const config = getConfig();
  const checks = [
    { id: "profile", met: config.isProduction },
    { id: "https", met: config.APP_URL.startsWith("https://") },
    { id: "cookie", met: config.cookieSecure },
    { id: "push", met: !config.allowDbPush },
    { id: "seed", met: !config.allowDbSeed },
    { id: "setup", met: !config.allowDbSetup },
    { id: "secret", met: (config.SESSION_SECRET?.length ?? 0) >= 32 },
    { id: "database", met: config.DATABASE_URL.length > 0 },
    { id: "redis", met: config.REDIS_URL.length > 0 },
  ];

  let databaseOk = false;
  let roleCounts = new Map<string, number>();
  let uatReady = 0;
  try {
    await sql`select 1`;
    databaseOk = true;
    const rows = await db
      .select({ key: roles.key, n: count() })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(and(eq(users.status, "active"), isNull(users.deletedAt)))
      .groupBy(roles.key);
    roleCounts = new Map(rows.map((row) => [row.key, Number(row.n)]));
    const dedicated = await db
      .select({ email: users.email, role: roles.key, status: users.status })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(
        and(
          inArray(
            users.email,
            uatAccountPlan.map((plan) => plan.email),
          ),
          isNull(users.deletedAt),
        ),
      );
    uatReady = uatAccountPlan.filter((plan) =>
      dedicated.some(
        (row) => row.email === plan.email && row.role === plan.id && row.status === "active",
      ),
    ).length;
  } catch {
    databaseOk = false;
  }

  const channels = integrationRows();
  const storage =
    Boolean(process.env.STORAGE_ACCESS_KEY) && Boolean(process.env.STORAGE_SECRET_KEY);
  const cdn = Boolean(process.env.CDN_URL);
  const git = gitFacts();
  const logo = existsSync(path.join(process.cwd(), "public", "brand", "logo.png"));
  const webApp = existsSync(path.join(process.cwd(), "package.json"));
  const mobileApp = existsSync(path.join(repoRoot(), "mobile", "app.json"));
  const android = existsSync(path.join(repoRoot(), "mobile", "android"));
  const databaseOn = checks.find((item) => item.id === "database")?.met ?? false;
  const redisOn = checks.find((item) => item.id === "redis")?.met ?? false;
  const credentialRows = [
    { id: "accounts", where: "process" as const, held: false },
    { id: "database", where: databaseOn ? ("process" as const) : ("absent" as const), held: false },
    { id: "redis", where: redisOn ? ("process" as const) : ("absent" as const), held: false },
    {
      id: "repository",
      where: git.remote ? ("process" as const) : ("absent" as const),
      held: false,
    },
    {
      id: "integrations",
      where: channels.some((row) => row.on) ? ("process" as const) : ("absent" as const),
      held: false,
    },
    { id: "providers", where: "unrecorded" as const, held: false },
  ];
  const assetRows = [
    { id: "web", present: webApp },
    { id: "mobile", present: mobileApp },
    { id: "android", present: android },
    { id: "logo", present: logo },
    { id: "documents", present: docIds.length > 1 },
  ];
  const ownershipRecorded = false;
  const infrastructureRows = [
    { id: "database", used: databaseOn, ownerRecorded: false },
    { id: "redis", used: redisOn, ownerRecorded: false },
    { id: "storage", used: storage, ownerRecorded: false },
    { id: "cdn", used: cdn, ownerRecorded: false },
    { id: "repository", used: git.remote, ownerRecorded: false },
    { id: "application", used: true, ownerRecorded: false },
  ];
  const browsers = [
    { id: "chrome", opened: true },
    { id: "safari", opened: false },
    { id: "firefox", opened: false },
    { id: "edge", opened: false },
    { id: "mobile", opened: false },
  ];
  const testingSignedOff = false;
  const fixesSignedOff = false;
  const approvalRecorded = false;
  const usedInfrastructure = infrastructureRows.filter((row) => row.used);
  const commercialGates = [
    { id: "production", met: checks.every((item) => item.met) },
    { id: "repository", met: git.remote && !git.dirty },
    { id: "credentials", met: credentialRows.every((row) => row.held) },
    { id: "ownership", met: ownershipRecorded },
    { id: "infrastructure", met: usedInfrastructure.every((row) => row.ownerRecorded) },
    { id: "testing", met: testingSignedOff && browsers.every((row) => row.opened) },
    { id: "fixes", met: fixesSignedOff },
    { id: "approval", met: approvalRecorded },
  ];

  return {
    deployment: {
      env: config.APP_ENV,
      https: checks.find((item) => item.id === "https")?.met ?? false,
      dbPush: config.allowDbPush,
    },
    production: {
      met: checks.filter((item) => item.met).length,
      required: checks.length,
      checks,
    },
    source: {
      web: webApp,
      mobile: mobileApp,
      android,
    },
    repository: git,
    database: {
      connected: databaseOk,
      configured: checks.find((item) => item.id === "database")?.met ?? false,
    },
    cloud: [
      { id: "postgres", on: checks.find((item) => item.id === "database")?.met ?? false },
      { id: "redis", on: checks.find((item) => item.id === "redis")?.met ?? false },
      { id: "storage", on: storage },
      { id: "cdn", on: cdn },
    ],
    integrations: {
      connected: channels.filter((row) => row.on).length,
      listed: channels.length,
      rows: channels,
    },
    accounts: {
      roles: accountRoles.map((id) => ({ id, count: roleCounts.get(id) ?? 0 })),
      uatReady,
      uatRequired: uatAccountPlan.length,
    },
    design: {
      logo,
      mobile: mobileApp,
      android,
    },
    documentation: {
      documents: docIds.length - 1,
      training: trainingCourses.length,
    },
    configuration: {
      env: config.APP_ENV,
      settings: [
        { id: "database", on: config.DATABASE_URL.length > 0 },
        { id: "redis", on: config.REDIS_URL.length > 0 },
        { id: "secret", on: (config.SESSION_SECRET?.length ?? 0) >= 32 },
        { id: "https", on: config.APP_URL.startsWith("https://") },
        { id: "cookie", on: config.cookieSecure },
        { id: "push", on: config.allowDbPush },
      ],
    },
    credentials: {
      held: credentialRows.filter((row) => row.held).length,
      listed: credentialRows.length,
      rows: credentialRows,
    },
    ownership: {
      present: assetRows.filter((row) => row.present).length,
      listed: assetRows.length,
      recorded: ownershipRecorded,
      rows: assetRows,
    },
    infrastructure: {
      clear: usedInfrastructure.length > 0 && usedInfrastructure.every((row) => row.ownerRecorded),
      used: usedInfrastructure.length,
      rows: infrastructureRows,
    },
    finalTesting: {
      signedOff: testingSignedOff,
      workflowsSigned: 0,
      roles: uatAccountPlan.length,
      browsers,
    },
    fixes: {
      signedOff: fixesSignedOff,
      register: false,
    },
    approval: {
      recorded: approvalRecorded,
    },
    commercial: {
      met: commercialGates.filter((gate) => gate.met).length,
      required: commercialGates.length,
      ready: commercialGates.every((gate) => gate.met),
      gates: commercialGates,
    },
  };
}

export type HandoverFaculties = Awaited<ReturnType<typeof getHandoverFaculties>>;
