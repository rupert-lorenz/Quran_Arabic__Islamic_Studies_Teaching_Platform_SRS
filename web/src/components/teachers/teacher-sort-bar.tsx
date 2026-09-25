import type { UiMessageKey } from "@/lib/i18n";
import {
  normalizeTeacherSort,
  teacherSearchHref,
  teacherSearchSorts,
  teacherSortDescription,
} from "@/lib/teacher-ranking";
import type { TeacherSearchQuery } from "@/lib/teacher-search";
import { getI18n } from "@/server/i18n/locale";

export async function TeacherSortBar({
  filters,
  countLabel,
}: {
  filters: TeacherSearchQuery;
  countLabel: string;
}) {
  const { t } = await getI18n();
  const current = normalizeTeacherSort(filters.sort);

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm font-semibold text-brand">{countLabel}</p>
        <p className="text-xs font-bold uppercase text-brand-soft">
          {t(`teachers.sort_${current}` as UiMessageKey)}
        </p>
      </div>
      <nav
        className="mt-3 flex flex-wrap gap-2"
        aria-label={t("teachers.sort")}
      >
        {teacherSearchSorts.map((item) => {
          const active = item.value === current;
          return (
            <a
              key={item.value}
              href={teacherSearchHref(filters, { sort: item.value })}
              className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-bold ${
                active ? "bg-brand text-white" : "bg-mint text-brand"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {t(`teachers.sort_${item.value}` as UiMessageKey)}
            </a>
          );
        })}
      </nav>
      <p className="mt-3 text-sm text-muted">{teacherSortDescription(current)}</p>
    </div>
  );
}
