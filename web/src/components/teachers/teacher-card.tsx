import { TeacherRateBreakdown } from "@/components/teachers/teacher-rate-breakdown";
import { TeacherPortrait } from "@/components/teachers/teacher-portrait";
import { ButtonLink } from "@/components/ui/button";
import type { UiMessageKey } from "@/lib/i18n";
import type { TeacherRateView } from "@/lib/teacher-rate-display";
import { publicVerifiedBadgeLabel } from "@/lib/teacher-status";
import { getI18n } from "@/server/i18n/locale";

export async function TeacherCard({
  name,
  subjects,
  languages,
  rating,
  lessons,
  level,
  href = "/register",
  hasVideo = false,
  verified = false,
  price,
  rate,
  reliability,
  responseRate,
  gender,
  audiences,
  featured = false,
  recommendationReasons,
  photoUrl,
  videoThumbnailUrl,
  actionKey,
}: {
  name: string;
  subjects: string;
  languages: string;
  rating: string;
  lessons: string;
  level: string;
  href?: string;
  hasVideo?: boolean;
  verified?: boolean;
  price?: string;
  rate?: TeacherRateView;
  reliability?: string;
  responseRate?: number | null;
  gender?: string | null;
  audiences?: string[];
  featured?: boolean;
  recommendationReasons?: string[];
  photoUrl?: string | null;
  videoThumbnailUrl?: string | null;
  actionKey?: UiMessageKey;
}) {
  const { t } = await getI18n();
  const genderLabel =
    gender === "female" || gender === "male"
      ? t(`teachers.gender_${gender}` as UiMessageKey)
      : null;
  const audienceLabel = (audiences ?? [])
    .map((item) => t(`teachers.audience_${item}` as UiMessageKey))
    .filter(Boolean)
    .join(" · ");
  const portrait = photoUrl || videoThumbnailUrl || null;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]">
      <a href={href} className="relative block aspect-[16/10] overflow-hidden bg-mint">
        <TeacherPortrait
          name={name}
          src={portrait}
          size="hero"
          className="h-full w-full rounded-none"
        />
        {hasVideo ? (
          <span className="absolute bottom-3 start-3 inline-flex items-center gap-2 rounded-full bg-brand px-3 py-1.5 text-xs font-extrabold text-white">
            ▶ {t("card.intro_video")}
          </span>
        ) : null}
        {featured ? (
          <span className="absolute top-3 start-3 rounded-full bg-gold px-3 py-1 text-xs font-extrabold text-brand">
            {t("card.recommended")}
          </span>
        ) : null}
      </a>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start gap-3">
          <TeacherPortrait name={name} src={portrait} size="sm" />
          <div>
            <h3 className="text-lg font-extrabold text-brand">{name}</h3>
            <p className="text-sm font-semibold text-brand-soft">{subjects}</p>
            {genderLabel || audienceLabel ? (
              <p className="mt-1 text-xs font-bold text-brand-soft">
                {[genderLabel, audienceLabel].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            {verified ? (
              <p className="mt-1 text-xs font-bold text-brand">
                {publicVerifiedBadgeLabel}
              </p>
            ) : null}
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-background px-3 py-3">
            <dt className="text-xs font-bold uppercase text-muted">{t("card.rating")}</dt>
            <dd className="font-extrabold text-brand">
              {rating}
              {rating !== "New" ? " ★" : ""}
            </dd>
          </div>
          <div className="rounded-2xl bg-background px-3 py-3">
            <dt className="text-xs font-bold uppercase text-muted">{t("card.lessons")}</dt>
            <dd className="font-extrabold text-brand">{lessons}</dd>
          </div>
          {responseRate != null ? (
            <div className="rounded-2xl bg-background px-3 py-3">
              <dt className="text-xs font-bold uppercase text-muted">{t("card.response")}</dt>
              <dd className="font-extrabold text-brand">{responseRate}%</dd>
            </div>
          ) : null}
          {reliability ? (
            <div className="rounded-2xl bg-background px-3 py-3">
              <dt className="text-xs font-bold uppercase text-muted">
                {t("card.reliability")}
              </dt>
              <dd className="font-extrabold text-brand">{reliability}</dd>
            </div>
          ) : null}
          <div className="col-span-2 rounded-2xl bg-background px-3 py-3">
            <dt className="text-xs font-bold uppercase text-muted">{t("card.best_for")}</dt>
            <dd className="font-semibold text-brand">{level}</dd>
          </div>
          {rate ? (
            <div className="col-span-2 rounded-2xl bg-mint px-3 py-3">
              <TeacherRateBreakdown
                rate={rate}
                compact
                title={t("card.rate")}
                listedAs={
                  rate.listedFormatted
                    ? t("card.listed_as", { price: rate.listedFormatted })
                    : undefined
                }
              />
            </div>
          ) : price ? (
            <div className="col-span-2 rounded-2xl bg-mint px-3 py-3">
              <dt className="text-xs font-bold uppercase text-muted">{t("card.rate")}</dt>
              <dd className="font-extrabold text-brand">{price}</dd>
            </div>
          ) : null}
        </dl>
        {recommendationReasons?.length ? (
          <p className="mt-4 text-sm font-semibold text-brand">
            {recommendationReasons.join(" · ")}
          </p>
        ) : null}
        <p className="mt-4 text-sm text-muted">{languages}</p>
        <div className="mt-6">
          <ButtonLink href={href} variant="secondary" className="w-full">
            {actionKey ? t(actionKey) : hasVideo ? t("card.watch") : t("card.view")}
          </ButtonLink>
        </div>
      </div>
    </article>
  );
}
