import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  countries,
  currencies,
  files,
  roles,
  teacherProfiles,
  teacherSubjects,
  users,
} from "@/db/schema";
import { parseIntroVideo } from "@/lib/intro-video";
import {
  parseAudienceList,
  teacherMatchesSearch,
} from "@/lib/teacher-search";
import {
  normalizeTeacherSort,
  recommendTeacher,
  sortTeachers,
  type RankableTeacher,
} from "@/lib/teacher-ranking";
import { ApiError } from "@/server/api/errors";
import { listTranslatedSubjectNames } from "@/server/i18n/locale";
import {
  attachTeacherStats,
  getTeacherReviewAggregates,
} from "@/server/reviews/service";
import { externalUrlFromStorageKey } from "./files";
import { omitInternalTeacherPayment } from "@/lib/teacher-rate-display";
import { getRequestMoney } from "@/server/money/currency";
import { formatMajorAmount } from "@/server/staff/money";
import { getTeacherRateLimits, publicTeacherRate } from "./profile";
import type { PublicTeacherQuery } from "./schemas";
import { ensureDocumentReviews, listDocumentReviews } from "./verification";

export async function listPublicTeachers(query: PublicTeacherQuery = {}) {
  const [rows, catalog, countryRows, currencyRows, limits, money] = await Promise.all([
    db
      .select({
        userId: users.id,
        displayName: users.displayName,
        country: users.country,
        headline: teacherProfiles.headline,
        bio: teacherProfiles.bio,
        languages: teacherProfiles.languages,
        gender: teacherProfiles.gender,
        audiences: teacherProfiles.audiences,
        lessonsTaught: teacherProfiles.lessonsTaught,
        responseRate: teacherProfiles.responseRate,
        offersGroupTeaching: teacherProfiles.offersGroupTeaching,
        introVideoFileId: teacherProfiles.introVideoFileId,
        hourlyRateMinor: teacherProfiles.hourlyRateMinor,
        currencyCode: teacherProfiles.currencyCode,
      })
      .from(teacherProfiles)
      .innerJoin(users, eq(teacherProfiles.userId, users.id))
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(
        and(
          eq(roles.key, "teacher"),
          eq(users.status, "active"),
          eq(teacherProfiles.verificationStatus, "approved"),
        ),
      )
      .orderBy(desc(teacherProfiles.lessonsTaught), desc(teacherProfiles.createdAt)),
    listTranslatedSubjectNames(),
    db
      .select({ iso2: countries.iso2, name: countries.name })
      .from(countries)
      .where(eq(countries.isEnabled, true))
      .orderBy(countries.sortOrder),
    db
      .select({
        code: currencies.code,
        symbol: currencies.symbol,
        decimalPlaces: currencies.decimalPlaces,
      })
      .from(currencies)
      .where(eq(currencies.isEnabled, true)),
    getTeacherRateLimits(),
    getRequestMoney(),
  ]);

  const teachers = await attachPublicTeacherMedia(rows, {
    catalog,
    countries: countryRows,
    currencies: currencyRows,
    commissionPercent: limits.commissionPercent,
    presentRate: money.presentRate,
  });

  const aggregates = await getTeacherReviewAggregates(
    teachers.map((teacher) => teacher.userId),
  );
  const ranked = attachTeacherStats(teachers, aggregates).filter((teacher) =>
    teacherMatchesSearch(
      {
        displayName: teacher.displayName,
        headline: teacher.headline,
        bio: teacher.bio,
        languages: teacher.languages,
        country: teacher.country,
        countryName: teacher.countryName,
        subjects: teacher.subjects,
        gender: teacher.gender,
        audiences: parseAudienceList(teacher.audiences),
        rateAmount: teacher.rate ? Number(teacher.rate.amount) : null,
        hasVideo: Boolean(teacher.video),
        rating: teacher.stats.averageRating,
      },
      query,
    ),
  );

  const sort = normalizeTeacherSort(query.sort);
  const ordered = sortTeachers(ranked, publicTeacherToRankable, sort, query);

  return ordered.map((teacher, index) => ({
    ...teacher,
    recommendation: {
      ...recommendTeacher(publicTeacherToRankable(teacher), query),
      featured: sort === "recommended" && index === 0 && ordered.length > 1,
    },
  }));
}

function publicTeacherToRankable(teacher: {
  displayName: string;
  headline?: string | null;
  languages?: string | null;
  subjects: { slug: string; name: string }[];
  lessonsTaught: number;
  rate?: { amount?: string; amountMinor?: number } | null;
  video?: unknown;
  stats: {
    averageRating: number | null;
    reviewCount: number;
    recommendPercent: number | null;
    responseRate: number | null;
  };
}): RankableTeacher {
  return {
    displayName: teacher.displayName,
    headline: teacher.headline,
    languages: teacher.languages,
    subjects: teacher.subjects,
    rating: teacher.stats.averageRating,
    reviewCount: teacher.stats.reviewCount,
    lessonsTaught: teacher.lessonsTaught,
    responseRate: teacher.stats.responseRate,
    recommendPercent: teacher.stats.recommendPercent,
    hasVideo: Boolean(teacher.video),
    rateAmount: teacher.rate?.amount ? Number(teacher.rate.amount) : null,
  };
}

export async function getPublicTeacher(userId: string) {
  const teachers = await listPublicTeachers();
  const found = teachers.find((item) => item.userId === userId);
  if (!found) {
    throw new ApiError(404, "NOT_FOUND", "Teacher not found");
  }
  return found;
}

export async function getPublicTeacherFilterOptions() {
  const [catalog, countryRows, languageRows, limits, money] = await Promise.all([
    listTranslatedSubjectNames(),
    db
      .select({ iso2: countries.iso2, name: countries.name })
      .from(countries)
      .where(eq(countries.isEnabled, true))
      .orderBy(countries.sortOrder),
    db
      .select({ languages: teacherProfiles.languages })
      .from(teacherProfiles)
      .innerJoin(users, eq(teacherProfiles.userId, users.id))
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(
        and(
          eq(roles.key, "teacher"),
          eq(users.status, "active"),
          eq(teacherProfiles.verificationStatus, "approved"),
        ),
      ),
    getTeacherRateLimits(),
    getRequestMoney(),
  ]);

  const languages = new Set<string>(["English", "Arabic"]);
  for (const row of languageRows) {
    for (const item of (row.languages ?? "").split(",")) {
      const language = item.trim();
      if (language) {
        languages.add(language);
      }
    }
  }

  const listing = limits.currency;
  const minConverted = listing
    ? money.convert(limits.minMinor, listing, money.currency)
    : null;
  const maxConverted = listing
    ? money.convert(limits.maxMinor, listing, money.currency)
    : null;

  return {
    subjects: catalog,
    countries: countryRows,
    languages: [...languages].sort((left, right) => left.localeCompare(right)),
    minAmount:
      minConverted != null
        ? formatMajorAmount(minConverted, money.currency.decimalPlaces)
        : limits.minAmount,
    maxAmount:
      maxConverted != null
        ? formatMajorAmount(maxConverted, money.currency.decimalPlaces)
        : limits.maxAmount,
  };
}

async function attachPublicTeacherMedia<
  T extends {
    userId: string;
    introVideoFileId: string | null;
    country: string | null;
    languages: string | null;
    hourlyRateMinor: number | null;
    currencyCode: string | null;
  },
>(
  rows: T[],
  extras: {
    catalog: { slug: string; name: string }[];
    countries: { iso2: string; name: string }[];
    currencies: { code: string; symbol: string; decimalPlaces: number }[];
    commissionPercent: number;
    presentRate: Awaited<ReturnType<typeof getRequestMoney>>["presentRate"];
  },
) {
  const userIds = rows.map((row) => row.userId);
  if (userIds.length === 0) {
    return [];
  }

  await Promise.all(userIds.map((id) => ensureDocumentReviews(id)));

  const [subjectRows, fileRows, reviews] = await Promise.all([
    db
      .select({
        teacherUserId: teacherSubjects.teacherUserId,
        subjectSlug: teacherSubjects.subjectSlug,
      })
      .from(teacherSubjects)
      .where(inArray(teacherSubjects.teacherUserId, userIds)),
    db
      .select({
        id: files.id,
        ownerUserId: files.ownerUserId,
        purpose: files.purpose,
        storageKey: files.storageKey,
        createdAt: files.createdAt,
      })
      .from(files)
      .where(
        and(
          inArray(files.ownerUserId, userIds),
          inArray(files.purpose, ["intro_video", "avatar"]),
        ),
      )
      .orderBy(desc(files.createdAt)),
    listDocumentReviews(userIds),
  ]);

  const reviewByFile = new Map(reviews.map((item) => [item.fileId, item]));
  const subjectName = new Map(extras.catalog.map((item) => [item.slug, item.name]));
  const countryName = new Map(extras.countries.map((item) => [item.iso2, item.name]));
  const currencyByCode = new Map(extras.currencies.map((item) => [item.code, item]));

  return rows.map((row) => {
    const teacherFiles = fileRows.filter((item) => item.ownerUserId === row.userId);
    const videoFiles = teacherFiles.filter((item) => item.purpose === "intro_video");
    const current = videoFiles.find((item) => item.id === row.introVideoFileId);
    const publicFile =
      current && reviewByFile.get(current.id)?.status === "verified"
        ? current
        : videoFiles.find(
            (item) => reviewByFile.get(item.id)?.status === "verified",
          ) ??
          null;
    const watchUrl = publicFile
      ? externalUrlFromStorageKey(publicFile.storageKey)
      : null;
    const playback = watchUrl ? parseIntroVideo(watchUrl) : null;
    const photoUrl =
      teacherFiles
        .filter((item) => item.purpose === "avatar")
        .map((item) => externalUrlFromStorageKey(item.storageKey))
        .find(Boolean) ?? playback?.thumbnailUrl ?? null;
    const { introVideoFileId: _introVideoFileId, hourlyRateMinor, currencyCode, ...rest } =
      row;

    return {
      ...rest,
      verified: true,
      countryName: row.country ? countryName.get(row.country) ?? row.country : null,
      subjects: subjectRows
        .filter((item) => item.teacherUserId === row.userId)
        .map((item) => ({
          slug: item.subjectSlug,
          name: subjectName.get(item.subjectSlug) ?? item.subjectSlug,
        })),
      rate: omitInternalTeacherPayment(
        extras.presentRate(
          publicTeacherRate(
            hourlyRateMinor,
            currencyCode ? currencyByCode.get(currencyCode) : null,
            extras.commissionPercent,
          ),
          currencyCode ? currencyByCode.get(currencyCode) ?? null : null,
        ),
      ),
      video: watchUrl
        ? {
            watchUrl,
            playback,
          }
        : null,
      photoUrl,
    };
  });
}
