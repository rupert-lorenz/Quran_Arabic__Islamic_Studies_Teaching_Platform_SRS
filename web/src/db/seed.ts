import { loadEnv } from "../server/load-env";

loadEnv();

async function seed() {
  const { db, sql } = await import("./index");
  const {
    cmsDocumentLocales,
    cmsDocuments,
    countries,
    currencies,
    fxRates,
    locales,
    permissions,
    platformRoles,
    platformSettings,
    rolePermissions,
    roles,
    subjects,
    translations,
  } = await import("./schema");
  const {
    rolePermissionKeys,
    seedCountries,
    seedCurrencies,
    seedLocales,
    seedPermissions,
    seedSettings,
    seedSubjects,
    seedTranslations,
  } = await import("./seed-data");
  const { seedCmsDocuments } = await import("./seed-cms");
  const { FX_RATE_SCALE, parseFxMajorRate, seedFxRatesAgainstGbp } =
    await import("../lib/currency");

  await db.insert(currencies).values([...seedCurrencies]).onConflictDoNothing();
  const fxRows = seedFxRatesAgainstGbp.flatMap((row) => {
    const rateInteger = parseFxMajorRate(row.rate);
    return rateInteger == null
      ? []
      : [
          {
            baseCode: "GBP",
            quoteCode: row.quoteCode,
            rateInteger,
            rateScale: FX_RATE_SCALE,
          },
        ];
  });
  if (fxRows.length > 0) {
    await db.insert(fxRates).values(fxRows).onConflictDoNothing();
  }
  await db.insert(locales).values([...seedLocales]).onConflictDoNothing();
  await db.insert(countries).values([...seedCountries]).onConflictDoNothing();
  await db.insert(subjects).values([...seedSubjects]).onConflictDoNothing();
  await db.insert(translations).values([...seedTranslations]).onConflictDoNothing();
  await db
    .insert(cmsDocuments)
    .values(
      seedCmsDocuments.map((item) => ({
        type: item.type,
        slug: item.slug,
        status: "published" as const,
        pinned: item.pinned ?? false,
        sortOrder: item.sortOrder,
        publishedAt: new Date(),
      })),
    )
    .onConflictDoNothing();
  const { eq } = await import("drizzle-orm");
  for (const item of seedCmsDocuments) {
    await db
      .update(cmsDocuments)
      .set({
        type: item.type,
        pinned: item.pinned ?? false,
        sortOrder: item.sortOrder,
      })
      .where(eq(cmsDocuments.slug, item.slug));
  }
  const cmsRows = await db.select().from(cmsDocuments);
  const cmsLocaleRows = seedCmsDocuments.flatMap((item) => {
    const document = cmsRows.find((row) => row.slug === item.slug);
    if (!document) {
      return [];
    }
    return item.locales.map((copy) => ({
      documentId: document.id,
      locale: copy.locale,
      title: copy.title,
      excerpt: copy.excerpt ?? null,
      body: copy.body ?? null,
      seoTitle: copy.seoTitle ?? null,
      seoDescription: copy.seoDescription ?? null,
      ctaLabel: copy.ctaLabel ?? null,
      ctaHref: copy.ctaHref ?? null,
    }));
  });
  if (cmsLocaleRows.length > 0) {
    await db.insert(cmsDocumentLocales).values(cmsLocaleRows).onConflictDoNothing();
  }
  await db.insert(roles).values([...platformRoles]).onConflictDoNothing({
    target: roles.key,
  });
  await db.insert(permissions).values([...seedPermissions]).onConflictDoNothing({
    target: permissions.key,
  });
  await db
    .insert(platformSettings)
    .values(
      seedSettings.map((setting) => ({
        key: setting.key,
        value: setting.value,
      })),
    )
    .onConflictDoNothing();

  const roleRows = await db.select().from(roles);
  const permissionRows = await db.select().from(permissions);
  const assignments = [];

  for (const role of roleRows) {
    const keys = rolePermissionKeys[role.key];
    const allowed =
      keys === "all" ? permissionRows : permissionRows.filter((permission) => keys?.includes(permission.key));

    for (const permission of allowed) {
      assignments.push({
        roleId: role.id,
        permissionId: permission.id,
      });
    }
  }

  if (assignments.length > 0) {
    await db.insert(rolePermissions).values(assignments).onConflictDoNothing();
  }

  try {
    const { redis } = await import("../redis/client");
    if (roleRows.length > 0) {
      await redis.del(...roleRows.map((role) => `rbac:role:${role.key}`));
    }
    await redis.quit();
  } catch {
    // Cache invalidation is best-effort during seed.
  }

  const { ensureCurrentAgreementVersion } = await import(
    "../server/teacher/agreement"
  );
  const currentAgreement = await ensureCurrentAgreementVersion();

  console.log(
    `Seeded architecture: ${seedCurrencies.length} currencies, ${fxRows.length} FX rates, ${seedCountries.length} countries, ${seedLocales.length} locales, ${seedSubjects.length} subjects, ${permissionRows.length} permissions, ${seedTranslations.length} translations, ${seedCmsDocuments.length} CMS documents, agreement ${currentAgreement.version}`,
  );

  await sql.end({ timeout: 5 });
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
