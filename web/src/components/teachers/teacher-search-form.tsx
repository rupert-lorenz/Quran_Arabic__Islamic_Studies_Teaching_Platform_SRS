import { fieldClass } from "@/lib/api";
import type { UiMessageKey } from "@/lib/i18n";
import { getI18n } from "@/server/i18n/locale";
import {
  describeTeacherSearchFilters,
  hasTeacherSearchFilters,
  teacherAudiences,
  teacherGenders,
  teacherSearchSorts,
  type TeacherSearchQuery,
} from "@/lib/teacher-search";

export async function TeacherSearchForm({
  filters,
  options,
}: {
  filters: TeacherSearchQuery;
  options: {
    subjects: { slug: string; name: string }[];
    languages: string[];
    countries: { iso2: string; name: string }[];
    minAmount?: string;
    maxAmount?: string;
  };
}) {
  const { t } = await getI18n();
  const chips = describeTeacherSearchFilters(filters, options);
  const advancedOpen = Boolean(
    filters.gender ||
      filters.audience ||
      filters.minPrice ||
      filters.maxPrice ||
      filters.minRating ||
      filters.video,
  );

  return (
    <form
      method="get"
      className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)]"
      aria-label={t("teachers.search_aria")}
    >
      <label className="block">
        <span className="mb-1 block text-sm font-bold text-brand">{t("teachers.search_label")}</span>
        <input
          name="q"
          defaultValue={filters.q ?? ""}
          className={fieldClass}
          placeholder={t("teachers.search_placeholder")}
        />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">{t("teachers.subject")}</span>
          <select
            name="subject"
            defaultValue={filters.subject ?? ""}
            className={fieldClass}
          >
            <option value="">{t("teachers.all_subjects")}</option>
            {options.subjects.map((subject) => (
              <option key={subject.slug} value={subject.slug}>
                {subject.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">{t("language.label")}</span>
          <select
            name="language"
            defaultValue={filters.language ?? ""}
            className={fieldClass}
          >
            <option value="">{t("teachers.all_languages")}</option>
            {options.languages.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">{t("common.country")}</span>
          <select
            name="country"
            defaultValue={filters.country ?? ""}
            className={fieldClass}
          >
            <option value="">{t("teachers.all_countries")}</option>
            {options.countries.map((country) => (
              <option key={country.iso2} value={country.iso2}>
                {country.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">{t("teachers.sort")}</span>
          <select
            name="sort"
            defaultValue={filters.sort ?? "recommended"}
            className={fieldClass}
          >
            {teacherSearchSorts.map((item) => (
              <option key={item.value} value={item.value}>
                {t(`teachers.sort_${item.value}` as UiMessageKey)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <details className="mt-4" open={advancedOpen}>
        <summary className="cursor-pointer text-sm font-extrabold text-brand">
          {t("teachers.advanced")}
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">{t("teachers.gender")}</span>
            <select
              name="gender"
              defaultValue={filters.gender ?? ""}
              className={fieldClass}
            >
              <option value="">{t("teachers.any")}</option>
              {teacherGenders.map((item) => (
                <option key={item.value} value={item.value}>
                  {t(`teachers.gender_${item.value}` as UiMessageKey)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              {t("teachers.who")}
            </span>
            <select
              name="audience"
              defaultValue={filters.audience ?? ""}
              className={fieldClass}
            >
              <option value="">{t("teachers.any_age")}</option>
              {teacherAudiences.map((item) => (
                <option key={item.value} value={item.value}>
                  {t(`teachers.audience_${item.value}` as UiMessageKey)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              {t("teachers.min_rating")}
            </span>
            <select
              name="minRating"
              defaultValue={filters.minRating ?? ""}
              className={fieldClass}
            >
              <option value="">{t("teachers.any_rating")}</option>
              <option value="4">4.0+</option>
              <option value="4.5">4.5+</option>
              <option value="4.8">4.8+</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              {t("teachers.min_price")}
            </span>
            <input
              name="minPrice"
              defaultValue={filters.minPrice ?? ""}
              className={fieldClass}
              inputMode="decimal"
              placeholder={options.minAmount ?? "5"}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              {t("teachers.max_price")}
            </span>
            <input
              name="maxPrice"
              defaultValue={filters.maxPrice ?? ""}
              className={fieldClass}
              inputMode="decimal"
              placeholder={options.maxAmount ?? "50"}
            />
          </label>
          <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-background px-4">
            <input
              type="checkbox"
              name="video"
              value="1"
              defaultChecked={
                filters.video === "1" ||
                filters.video === "true" ||
                filters.video === "yes"
              }
              className="h-5 w-5 accent-brand"
            />
            <span className="text-sm font-bold text-brand">
              {t("teachers.has_video")}
            </span>
          </label>
        </div>
      </details>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-5 text-base font-semibold text-white"
        >
          {t("teachers.search_button")}
        </button>
        {hasTeacherSearchFilters(filters) ? (
          <a href="/teachers" className="text-sm font-bold text-brand underline">
            {t("teachers.clear")}
          </a>
        ) : null}
      </div>
      {chips.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li
              key={chip.key}
              className="rounded-full bg-mint px-3 py-1 text-xs font-bold text-brand"
            >
              {chip.label}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
