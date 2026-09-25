export const ISLAMIC_PROGRESS_TRACKS = [
  "quran",
  "arabic",
  "islamic_studies",
] as const;
export type IslamicProgressTrack = (typeof ISLAMIC_PROGRESS_TRACKS)[number];

export const QURAN_MODES = [
  "memorisation",
  "revision",
  "tajweed",
  "reading",
] as const;
export type QuranMode = (typeof QURAN_MODES)[number];

export const PROGRESS_HOMEWORK_STATUSES = [
  "none",
  "assigned",
  "submitted",
  "marked",
] as const;
export type ProgressHomeworkStatus = (typeof PROGRESS_HOMEWORK_STATUSES)[number];

export const PROGRESS_ASSESSMENT_STATUSES = [
  "none",
  "in_progress",
  "passed",
  "needs_review",
] as const;
export type ProgressAssessmentStatus =
  (typeof PROGRESS_ASSESSMENT_STATUSES)[number];

export const QURAN_SURAHS = [
  { n: 1, en: "Al-Fatihah", ar: "الفاتحة" },
  { n: 2, en: "Al-Baqarah", ar: "البقرة" },
  { n: 3, en: "Aal-Imran", ar: "آل عمران" },
  { n: 4, en: "An-Nisa", ar: "النساء" },
  { n: 5, en: "Al-Ma'idah", ar: "المائدة" },
  { n: 6, en: "Al-An'am", ar: "الأنعام" },
  { n: 7, en: "Al-A'raf", ar: "الأعراف" },
  { n: 8, en: "Al-Anfal", ar: "الأنفال" },
  { n: 9, en: "At-Tawbah", ar: "التوبة" },
  { n: 10, en: "Yunus", ar: "يونس" },
  { n: 11, en: "Hud", ar: "هود" },
  { n: 12, en: "Yusuf", ar: "يوسف" },
  { n: 13, en: "Ar-Ra'd", ar: "الرعد" },
  { n: 14, en: "Ibrahim", ar: "إبراهيم" },
  { n: 15, en: "Al-Hijr", ar: "الحجر" },
  { n: 16, en: "An-Nahl", ar: "النحل" },
  { n: 17, en: "Al-Isra", ar: "الإسراء" },
  { n: 18, en: "Al-Kahf", ar: "الكهف" },
  { n: 19, en: "Maryam", ar: "مريم" },
  { n: 20, en: "Ta-Ha", ar: "طه" },
  { n: 21, en: "Al-Anbiya", ar: "الأنبياء" },
  { n: 22, en: "Al-Hajj", ar: "الحج" },
  { n: 23, en: "Al-Mu'minun", ar: "المؤمنون" },
  { n: 24, en: "An-Nur", ar: "النور" },
  { n: 25, en: "Al-Furqan", ar: "الفرقان" },
  { n: 26, en: "Ash-Shu'ara", ar: "الشعراء" },
  { n: 27, en: "An-Naml", ar: "النمل" },
  { n: 28, en: "Al-Qasas", ar: "القصص" },
  { n: 29, en: "Al-Ankabut", ar: "العنكبوت" },
  { n: 30, en: "Ar-Rum", ar: "الروم" },
  { n: 31, en: "Luqman", ar: "لقمان" },
  { n: 32, en: "As-Sajdah", ar: "السجدة" },
  { n: 33, en: "Al-Ahzab", ar: "الأحزاب" },
  { n: 34, en: "Saba", ar: "سبأ" },
  { n: 35, en: "Fatir", ar: "فاطر" },
  { n: 36, en: "Ya-Sin", ar: "يس" },
  { n: 37, en: "As-Saffat", ar: "الصافات" },
  { n: 38, en: "Sad", ar: "ص" },
  { n: 39, en: "Az-Zumar", ar: "الزمر" },
  { n: 40, en: "Ghafir", ar: "غافر" },
  { n: 41, en: "Fussilat", ar: "فصلت" },
  { n: 42, en: "Ash-Shura", ar: "الشورى" },
  { n: 43, en: "Az-Zukhruf", ar: "الزخرف" },
  { n: 44, en: "Ad-Dukhan", ar: "الدخان" },
  { n: 45, en: "Al-Jathiyah", ar: "الجاثية" },
  { n: 46, en: "Al-Ahqaf", ar: "الأحقاف" },
  { n: 47, en: "Muhammad", ar: "محمد" },
  { n: 48, en: "Al-Fath", ar: "الفتح" },
  { n: 49, en: "Al-Hujurat", ar: "الحجرات" },
  { n: 50, en: "Qaf", ar: "ق" },
  { n: 51, en: "Adh-Dhariyat", ar: "الذاريات" },
  { n: 52, en: "At-Tur", ar: "الطور" },
  { n: 53, en: "An-Najm", ar: "النجم" },
  { n: 54, en: "Al-Qamar", ar: "القمر" },
  { n: 55, en: "Ar-Rahman", ar: "الرحمن" },
  { n: 56, en: "Al-Waqi'ah", ar: "الواقعة" },
  { n: 57, en: "Al-Hadid", ar: "الحديد" },
  { n: 58, en: "Al-Mujadila", ar: "المجادلة" },
  { n: 59, en: "Al-Hashr", ar: "الحشر" },
  { n: 60, en: "Al-Mumtahanah", ar: "الممتحنة" },
  { n: 61, en: "As-Saff", ar: "الصف" },
  { n: 62, en: "Al-Jumu'ah", ar: "الجمعة" },
  { n: 63, en: "Al-Munafiqun", ar: "المنافقون" },
  { n: 64, en: "At-Taghabun", ar: "التغابن" },
  { n: 65, en: "At-Talaq", ar: "الطلاق" },
  { n: 66, en: "At-Tahrim", ar: "التحريم" },
  { n: 67, en: "Al-Mulk", ar: "الملك" },
  { n: 68, en: "Al-Qalam", ar: "القلم" },
  { n: 69, en: "Al-Haqqah", ar: "الحاقة" },
  { n: 70, en: "Al-Ma'arij", ar: "المعارج" },
  { n: 71, en: "Nuh", ar: "نوح" },
  { n: 72, en: "Al-Jinn", ar: "الجن" },
  { n: 73, en: "Al-Muzzammil", ar: "المزمل" },
  { n: 74, en: "Al-Muddaththir", ar: "المدثر" },
  { n: 75, en: "Al-Qiyamah", ar: "القيامة" },
  { n: 76, en: "Al-Insan", ar: "الإنسان" },
  { n: 77, en: "Al-Mursalat", ar: "المرسلات" },
  { n: 78, en: "An-Naba", ar: "النبأ" },
  { n: 79, en: "An-Nazi'at", ar: "النازعات" },
  { n: 80, en: "Abasa", ar: "عبس" },
  { n: 81, en: "At-Takwir", ar: "التكوير" },
  { n: 82, en: "Al-Infitar", ar: "الانفطار" },
  { n: 83, en: "Al-Mutaffifin", ar: "المطففين" },
  { n: 84, en: "Al-Inshiqaq", ar: "الانشقاق" },
  { n: 85, en: "Al-Buruj", ar: "البروج" },
  { n: 86, en: "At-Tariq", ar: "الطارق" },
  { n: 87, en: "Al-A'la", ar: "الأعلى" },
  { n: 88, en: "Al-Ghashiyah", ar: "الغاشية" },
  { n: 89, en: "Al-Fajr", ar: "الفجر" },
  { n: 90, en: "Al-Balad", ar: "البلد" },
  { n: 91, en: "Ash-Shams", ar: "الشمس" },
  { n: 92, en: "Al-Layl", ar: "الليل" },
  { n: 93, en: "Ad-Duha", ar: "الضحى" },
  { n: 94, en: "Ash-Sharh", ar: "الشرح" },
  { n: 95, en: "At-Tin", ar: "التين" },
  { n: 96, en: "Al-Alaq", ar: "العلق" },
  { n: 97, en: "Al-Qadr", ar: "القدر" },
  { n: 98, en: "Al-Bayyinah", ar: "البينة" },
  { n: 99, en: "Az-Zalzalah", ar: "الزلزلة" },
  { n: 100, en: "Al-Adiyat", ar: "العاديات" },
  { n: 101, en: "Al-Qari'ah", ar: "القارعة" },
  { n: 102, en: "At-Takathur", ar: "التكاثر" },
  { n: 103, en: "Al-Asr", ar: "العصر" },
  { n: 104, en: "Al-Humazah", ar: "الهمزة" },
  { n: 105, en: "Al-Fil", ar: "الفيل" },
  { n: 106, en: "Quraysh", ar: "قريش" },
  { n: 107, en: "Al-Ma'un", ar: "الماعون" },
  { n: 108, en: "Al-Kawthar", ar: "الكوثر" },
  { n: 109, en: "Al-Kafirun", ar: "الكافرون" },
  { n: 110, en: "An-Nasr", ar: "النصر" },
  { n: 111, en: "Al-Masad", ar: "المسد" },
  { n: 112, en: "Al-Ikhlas", ar: "الإخلاص" },
  { n: 113, en: "Al-Falaq", ar: "الفلق" },
  { n: 114, en: "An-Nas", ar: "الناس" },
] as const;

export function isIslamicProgressTrack(
  value: string,
): value is IslamicProgressTrack {
  return (ISLAMIC_PROGRESS_TRACKS as readonly string[]).includes(value);
}

export function isQuranMode(value: string): value is QuranMode {
  return (QURAN_MODES as readonly string[]).includes(value);
}

export function isProgressHomeworkStatus(
  value: string,
): value is ProgressHomeworkStatus {
  return (PROGRESS_HOMEWORK_STATUSES as readonly string[]).includes(value);
}

export function isProgressAssessmentStatus(
  value: string,
): value is ProgressAssessmentStatus {
  return (PROGRESS_ASSESSMENT_STATUSES as readonly string[]).includes(value);
}

export function quranSurahLabel(n?: number | null) {
  if (!n) return "";
  const surah = QURAN_SURAHS.find((item) => item.n === n);
  return surah ? `${surah.n} · ${surah.en} · ${surah.ar}` : String(n);
}

export function clampPercent(value?: number | null) {
  if (value == null || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function quranCompletion(juz?: number | null, explicit?: number | null) {
  if (explicit != null) return clampPercent(explicit);
  if (!juz) return null;
  return clampPercent((juz / 30) * 100);
}

export function arabicCompletion(skills: Array<number | null | undefined>) {
  const present = skills.filter(
    (value): value is number => value != null && !Number.isNaN(value),
  );
  if (!present.length) return null;
  return clampPercent(
    present.reduce((sum, value) => sum + value, 0) / present.length,
  );
}

export function islamicProgressHref(
  roleKey: string,
  isStaff: boolean,
  studentUserId?: string,
) {
  const base =
    roleKey === "student"
      ? "/learn/progress"
      : roleKey === "parent"
        ? "/family/progress"
        : roleKey === "teacher"
          ? "/teach/progress"
          : isStaff
            ? "/staff/academic/progress"
            : "/learn/progress";
  if (!studentUserId || roleKey === "student") return base;
  return `${base}?student=${studentUserId}`;
}

export function familyChildProgressHref(studentUserId: string) {
  return `/family/children/${studentUserId}/progress`;
}

export function quranProgressHref(
  roleKey: string,
  isStaff: boolean,
  studentUserId?: string,
) {
  const base =
    roleKey === "student"
      ? "/learn/quran"
      : roleKey === "parent"
        ? "/family/quran"
        : roleKey === "teacher"
          ? "/teach/quran"
          : isStaff
            ? "/staff/academic/quran"
            : "/learn/quran";
  if (!studentUserId || roleKey === "student") return base;
  return `${base}?student=${studentUserId}`;
}

export function familyChildQuranHref(studentUserId: string) {
  return `/family/children/${studentUserId}/quran`;
}

export const ARABIC_SKILLS = [
  "reading",
  "writing",
  "speaking",
  "listening",
  "vocabulary",
  "grammar",
] as const;
export type ArabicSkill = (typeof ARABIC_SKILLS)[number];

export function arabicProgressHref(
  roleKey: string,
  isStaff: boolean,
  studentUserId?: string,
) {
  const base =
    roleKey === "student"
      ? "/learn/arabic"
      : roleKey === "parent"
        ? "/family/arabic"
        : roleKey === "teacher"
          ? "/teach/arabic"
          : isStaff
            ? "/staff/academic/arabic"
            : "/learn/arabic";
  if (!studentUserId || roleKey === "student") return base;
  return `${base}?student=${studentUserId}`;
}

export function familyChildArabicHref(studentUserId: string) {
  return `/family/children/${studentUserId}/arabic`;
}

export function islamicStudiesProgressHref(
  roleKey: string,
  isStaff: boolean,
  studentUserId?: string,
) {
  const base =
    roleKey === "student"
      ? "/learn/islamic-studies"
      : roleKey === "parent"
        ? "/family/islamic-studies"
        : roleKey === "teacher"
          ? "/teach/islamic-studies"
          : isStaff
            ? "/staff/academic/islamic-studies"
            : "/learn/islamic-studies";
  if (!studentUserId || roleKey === "student") return base;
  return `${base}?student=${studentUserId}`;
}

export function familyChildIslamicStudiesHref(studentUserId: string) {
  return `/family/children/${studentUserId}/islamic-studies`;
}

export function quranPagePercent(page?: number | null) {
  return page ? clampPercent((page / 604) * 100) : null;
}

export function quranSurahPercent(surah?: number | null) {
  return surah ? clampPercent((surah / 114) * 100) : null;
}

export function emptyQuranStream(mode: QuranMode) {
  return {
    mode,
    surah: null as number | null,
    surahLabel: "",
    juz: null as number | null,
    page: null as number | null,
    ayah: null as number | null,
    percent: null as number | null,
  };
}
