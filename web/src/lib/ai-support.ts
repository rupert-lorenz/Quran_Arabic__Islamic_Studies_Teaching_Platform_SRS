import type { AiLocale, AiSpeakerRole } from "@/lib/ai-systems";

export const AI_SUPPORT_SOURCE_KINDS = [
  "help",
  "faq",
  "page",
  "transcript",
  "summary",
  "homework",
  "quiz",
  "recommendation",
] as const;
export type AiSupportSourceKind = (typeof AI_SUPPORT_SOURCE_KINDS)[number];

export type AiSupportSource = {
  kind: AiSupportSourceKind;
  title: string;
  body: string;
  href: string | null;
};

export type AiSupportHit = {
  kind: AiSupportSourceKind;
  title: string;
  excerpt: string;
  href: string | null;
  score: number;
};

export type AiSupportDraft = {
  body: string;
  hits: AiSupportHit[];
  engine: "extractive";
};

const STOP_EN = new Set([
  "a",
  "an",
  "and",
  "are",
  "can",
  "do",
  "does",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "my",
  "of",
  "on",
  "or",
  "the",
  "to",
  "what",
  "when",
  "where",
  "who",
  "why",
]);

const STOP_AR = new Set([
  "أن",
  "إن",
  "إلى",
  "كيف",
  "ما",
  "ماذا",
  "متى",
  "من",
  "هل",
  "في",
  "على",
  "عن",
]);

export function isAiSupportSourceKind(value: unknown): value is AiSupportSourceKind {
  return (
    typeof value === "string" &&
    (AI_SUPPORT_SOURCE_KINDS as readonly string[]).includes(value)
  );
}

export function supportSearchTokens(text: string, locale: AiLocale) {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const stop = locale === "ar" ? STOP_AR : STOP_EN;
  const min = locale === "ar" ? 2 : 3;
  return words.filter((word) => word.length >= min && !stop.has(word));
}

function clipExcerpt(text: string, query: string, locale: AiLocale) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const tokens = supportSearchTokens(query, locale);
  const sentences =
    locale === "ar"
      ? cleaned.split(/(?<=[.!?؟])\s+/)
      : cleaned.split(/(?<=[.!?])\s+/);
  const ranked = sentences
    .map((sentence) => {
      const lower = sentence.toLowerCase();
      const hits = tokens.filter((token) => lower.includes(token)).length;
      return { sentence: sentence.trim(), hits };
    })
    .filter((item) => item.sentence.length > 8)
    .sort((left, right) => right.hits - left.hits);
  const chosen = (ranked[0]?.hits ? ranked[0].sentence : sentences[0] ?? cleaned)
    .replace(/\s+/g, " ")
    .trim();
  return chosen.length > 280 ? `${chosen.slice(0, 277)}…` : chosen;
}

function scoreSource(source: AiSupportSource, tokens: string[], phrase: string) {
  const title = source.title.toLowerCase();
  const body = `${source.title} ${source.body}`.toLowerCase();
  if (!tokens.length) return 0;
  let score = 0;
  for (const token of tokens) {
    if (title.includes(token)) score += 4;
    if (body.includes(token)) score += 1;
  }
  if (phrase.length >= 6 && body.includes(phrase)) score += 6;
  return score;
}

export function extractSupportAnswer(input: {
  query: string;
  locale: AiLocale;
  sources: AiSupportSource[];
}): AiSupportDraft {
  const query = input.query.replace(/\s+/g, " ").trim();
  const tokens = supportSearchTokens(query, input.locale);
  const phrase = query.toLowerCase();
  const hits = input.sources
    .map((source) => {
      const score = scoreSource(source, tokens, phrase);
      if (score <= 0) return null;
      const excerpt = clipExcerpt(source.body || source.title, query, input.locale);
      if (!excerpt) return null;
      const hit: AiSupportHit = {
        kind: source.kind,
        title: source.title.trim().slice(0, 160),
        excerpt,
        href: source.href,
        score,
      };
      return hit;
    })
    .filter((item): item is AiSupportHit => Boolean(item))
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
  const body = hits
    .slice(0, 3)
    .map((item) => item.excerpt)
    .join(" ")
    .slice(0, 1200);
  return { body, hits, engine: "extractive" };
}

export function payloadSupportQuery(
  payload: Record<string, unknown> | null | undefined,
) {
  return typeof payload?.query === "string" ? payload.query : "";
}

export function payloadSupportBody(
  payload: Record<string, unknown> | null | undefined,
) {
  return typeof payload?.body === "string" ? payload.body : "";
}

export function payloadSupportHits(
  payload: Record<string, unknown> | null | undefined,
): AiSupportHit[] {
  const raw = payload?.hits;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (!isAiSupportSourceKind(row.kind)) return [];
    if (typeof row.title !== "string" || typeof row.excerpt !== "string") return [];
    return [
      {
        kind: row.kind,
        title: row.title,
        excerpt: row.excerpt,
        href: typeof row.href === "string" ? row.href : null,
        score: typeof row.score === "number" ? row.score : 0,
      },
    ];
  });
}

type TopicRole = AiSpeakerRole | "all";

type PlatformTopic = {
  id: string;
  roles: TopicRole[];
  href: Partial<Record<AiSpeakerRole, string>> & { default: string };
  en: { title: string; body: string };
  ar: { title: string; body: string };
};

const PLATFORM_TOPICS: PlatformTopic[] = [
  {
    id: "book-one-to-one",
    roles: ["parent", "student", "staff"],
    href: {
      parent: "/teachers",
      student: "/teachers",
      staff: "/teachers",
      default: "/teachers",
    },
    en: {
      title: "Book a one-to-one lesson",
      body: "Families book one-to-one lessons from a teacher’s public profile after the teacher publishes Hours. Hours are a shop window, not a joinable classroom. Book at least four hours ahead. After a parent books, Join appears when the classroom opens.",
    },
    ar: {
      title: "احجز درساً فردياً",
      body: "تحجز العائلات الدروس الفردية من الملف العام للمعلم بعد أن ينشر الساعات. الساعات واجهة للحجز وليست صفاً يمكن دخوله. احجز قبل أربع ساعات على الأقل. بعد حجز ولي الأمر يظهر انضم عندما يُفتح الصف.",
    },
  },
  {
    id: "classroom-open",
    roles: ["all"],
    href: {
      teacher: "/teach/bookings",
      parent: "/family/bookings",
      student: "/learn/bookings",
      staff: "/staff/bookings",
      default: "/login",
    },
    en: {
      title: "When the classroom opens",
      body: "Teachers and staff can join 60 minutes before the lesson. Students and parents can join 15 minutes before. The Join button shows how long until the classroom opens and until class begins. There is no classroom until a lesson is booked or a group session exists.",
    },
    ar: {
      title: "متى يُفتح الصف",
      body: "يمكن للمعلمين والموظفين الدخول قبل 60 دقيقة من الدرس. يمكن للطلاب وأولياء الأمور الدخول قبل 15 دقيقة. يظهر زر انضم الوقت المتبقي حتى يُفتح الصف وحتى يبدأ الدرس. لا يوجد صف حتى يُحجز درس أو توجد حصة جماعية.",
    },
  },
  {
    id: "hours-vs-lesson",
    roles: ["teacher", "staff", "parent"],
    href: {
      teacher: "/teach/availability",
      parent: "/teachers",
      staff: "/staff/teachers",
      default: "/teach/availability",
    },
    en: {
      title: "Hours are not a booked lesson",
      body: "Teacher Hours are bookable windows. A parent must book a one-to-one slot before anyone can join. The calendar shows mint Hours and dark green booked lessons. Publishing Hours does not create a classroom.",
    },
    ar: {
      title: "الساعات ليست درساً محجوزاً",
      body: "ساعات المعلم نوافذ قابلة للحجز. يجب أن يحجز ولي الأمر موعداً فردياً قبل أن يدخل أحد. يظهر التقويم الساعات بلون نعناعي والدروس المحجوزة بالأخضر الداكن. نشر الساعات لا يُنشئ صفاً.",
    },
  },
  {
    id: "cancel",
    roles: ["parent", "student", "teacher", "staff"],
    href: {
      parent: "/family/bookings",
      student: "/learn/bookings",
      teacher: "/teach/bookings",
      staff: "/staff/bookings",
      default: "/login",
    },
    en: {
      title: "Cancel a one-to-one booking",
      body: "A family cancel at least 24 hours ahead becomes lesson credit awaiting staff finance review. Inside 24 hours the lesson payment is retained. A teacher or staff cancel needs a reason and becomes a refund awaiting review. Students never see teacher payment.",
    },
    ar: {
      title: "إلغاء حجز فردي",
      body: "إلغاء العائلة قبل 24 ساعة على الأقل يصبح رصيد درس بانتظار مراجعة المالية. داخل 24 ساعة يُحتفظ بأجر الدرس. إلغاء المعلم أو الموظف يحتاج سبباً ويصبح استرداداً بانتظار المراجعة. لا يرى الطلاب أجر المعلم.",
    },
  },
  {
    id: "groups",
    roles: ["parent", "student", "teacher", "staff"],
    href: {
      parent: "/group-lessons",
      student: "/group-lessons",
      teacher: "/teach/group-lessons",
      staff: "/staff/group-classes",
      default: "/group-lessons",
    },
    en: {
      title: "Group classes",
      body: "Parents first see class name, duration, schedule, and rate. Opening a class shows the daily session list. Staff can post a group-class opportunity. Teachers apply if they can teach that schedule. Staff then select the teacher. Students never see listed teacher payment.",
    },
    ar: {
      title: "الحصص الجماعية",
      body: "يرى أولياء الأمور أولاً اسم الصف والمدة والجدول والسعر. فتح الصف يعرض قائمة الحصص اليومية. يمكن للموظفين نشر فرصة حصة جماعية. يتقدم المعلمون إن استطاعوا تدريس ذلك الجدول. ثم يختار الموظف المعلم. لا يرى الطلاب أجر المعلم المدرج.",
    },
  },
  {
    id: "parent-children",
    roles: ["parent", "staff"],
    href: {
      parent: "/family",
      staff: "/staff/users",
      default: "/family",
    },
    en: {
      title: "Parent-managed children",
      body: "Children on a family account do not receive a separate login. The parent joins the classroom as an observer and cannot publish on the child’s behalf. Add each child from the family dashboard before booking.",
    },
    ar: {
      title: "الأطفال بإدارة ولي الأمر",
      body: "لا يحصل أطفال حساب العائلة على دخول منفصل. يدخل ولي الأمر الصف مراقباً ولا يمكنه النشر نيابة عن الطفل. أضف كل طفل من لوحة العائلة قبل الحجز.",
    },
  },
  {
    id: "ai-review",
    roles: ["all"],
    href: {
      teacher: "/teach/ai",
      parent: "/family/ai",
      student: "/learn/ai",
      staff: "/staff/academic/ai",
      default: "/login",
    },
    en: {
      title: "AI help and teacher review",
      body: "AI can draft transcripts, summaries, homework, quizzes, and recommendations. A teacher or academic staff member must approve academically important AI work before learners see it. AI cannot award marks, issue certificates, or take a safeguarding decision. Private student notes stay with the learner.",
    },
    ar: {
      title: "مساعدة الذكاء الاصطناعي ومراجعة المعلم",
      body: "يجوز للذكاء الاصطناعي إعداد تفريغات وملخصات وواجبات واختبارات وتوصيات. يجب أن يوافق معلم أو موظف أكاديمي على العمل الأكاديمي المهم قبل أن يراه المتعلمون. لا يستطيع الذكاء الاصطناعي منح علامات أو إصدار شهادات أو اتخاذ قرار حماية. تبقى ملاحظات الطالب الخاصة معه.",
    },
  },
  {
    id: "login",
    roles: ["all"],
    href: { default: "/login" },
    en: {
      title: "Login and registration",
      body: "The header shows Login only. Create an account from the login screen. Privileged staff accounts can use two-factor authentication. Suspended accounts should contact support from the signed-out screens.",
    },
    ar: {
      title: "الدخول والتسجيل",
      body: "يظهر الشريط العلوي تسجيل الدخول فقط. أنشئ حساباً من شاشة الدخول. يمكن لحسابات الموظفين المميزين استخدام التحقق بخطوتين. ينبغي للحسابات الموقوفة التواصل مع الدعم من الشاشات خارج الجلسة.",
    },
  },
  {
    id: "safeguarding",
    roles: ["all"],
    href: { default: "/safeguarding" },
    en: {
      title: "Safeguarding and staying on the platform",
      body: "Keep messaging, booking, and recordings on the platform. Do not share personal phone numbers or messaging accounts. Report a safeguarding concern from the safeguarding page. AI cannot open or decide an incident.",
    },
    ar: {
      title: "الحماية والبقاء على المنصة",
      body: "أبقِ الرسائل والحجز والتسجيلات على المنصة. لا تشارك أرقام الهواتف أو حسابات المراسلة الشخصية. بلّغ عن قلق حماية من صفحة الحماية. لا يستطيع الذكاء الاصطناعي فتح حادث أو البتّ فيه.",
    },
  },
  {
    id: "faq",
    roles: ["all"],
    href: { default: "/faq" },
    en: {
      title: "Help and frequently asked questions",
      body: "Published FAQs answer how parents create an account, add children, and keep lessons on the platform. Open the FAQ page for the full list. AI-assisted search quotes those answers and approved lesson text you are allowed to see.",
    },
    ar: {
      title: "المساعدة والأسئلة الشائعة",
      body: "تجيب الأسئلة المنشورة عن إنشاء حساب ولي الأمر وإضافة الأطفال وإبقاء الدروس على المنصة. افتح صفحة الأسئلة للقائمة كاملة. بحث الذكاء الاصطناعي يقتبس تلك الإجابات ونص الدرس المعتمد المسموح لك برؤيته.",
    },
  },
];

export function platformSupportSources(input: {
  role: AiSpeakerRole;
  locale: AiLocale;
}): AiSupportSource[] {
  return PLATFORM_TOPICS.filter(
    (topic) => topic.roles.includes("all") || topic.roles.includes(input.role),
  ).map((topic) => {
    const copy = input.locale === "ar" ? topic.ar : topic.en;
    return {
      kind: "help" as const,
      title: copy.title,
      body: copy.body,
      href: topic.href[input.role] ?? topic.href.default,
    };
  });
}
