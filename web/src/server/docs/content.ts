import { readdirSync } from "node:fs";
import path from "node:path";
import {
  dataStores,
  designRules,
  platformModules,
} from "@/server/architecture";
import { getConfig } from "@/server/config";
import { getIntegrationStatus } from "@/server/integrations/registry";

export const docIds = [
  "overview",
  "architecture",
  "database",
  "api",
  "integration",
  "deployment",
  "admin",
  "teacher",
  "student",
  "parent",
  "source",
] as const;

export type DocId = (typeof docIds)[number];

export type DocBlock = {
  heading: string;
  paragraphs: string[];
  items?: string[];
};

const copy = {
  en: {
    overview: [
      {
        heading: "Written documents",
        paragraphs: [
          "These documents are the written reference: system architecture, database, API, integration, deployment, the admin manual, the teacher guide, the student guide, the parent guide, and source-code documentation. Training for Super Admin, Administration, Accounts, Academic, Marketing, and Safeguarding staff is a separate course for each role.",
        ],
      },
      {
        heading: "Who reads them",
        paragraphs: [
          "Staff read every document from Documentation. Teachers, students, and parents each have their own guide in their signed-in home. The guides describe the pages that exist today.",
        ],
      },
    ],
    architecture: [
      {
        heading: "Shape of the platform",
        paragraphs: [
          "The web application is the system of record. Postgres keeps durable data, Redis keeps short-lived session cache, booking locks, rate limits, and queues, and object storage is the place for file bytes. Postgres stores a storage key, not the file itself.",
          "Teachers, students, lessons, countries, currencies, recordings, materials, and courses grow as new rows. A larger volume does not require a new application.",
        ],
      },
    ],
    database: [
      {
        heading: "How records are stored",
        paragraphs: [
          "Public identifiers are UUIDs. Times are stored in UTC and shown in the account timezone. Money is an integer in minor units plus an ISO currency code. Users are soft-deleted. Financial and audit history is not hard-deleted.",
          "The modules below are the live groups in the schema source. Reserved billing names such as payment intents and teacher wallets are not tables in that schema.",
        ],
      },
    ],
    api: [
      {
        heading: "Version and entry",
        paragraphs: [
          "HTTP APIs live under /api/v1 and pass through one route helper. JSON responses use the shared envelope unless a route returns a file. Authenticated changes require a same-origin check. Staff tools also require the signed-in role's permission.",
          "The iOS and Android applications may send a bearer token with the mobile client header. Browser sessions use the session cookie. Webhooks must verify their signature before any write.",
        ],
      },
    ],
    integration: [
      {
        heading: "Adapters",
        paragraphs: [
          "Payments, payouts, classroom video, cloud storage, email, and the external model are server adapters. A provider is configured only when every secret named for it is set. The browser never receives those secrets, and card numbers are not stored.",
          "Email is composed here and is not delivered, even when an email secret is present. SMS is not connected. WhatsApp is not connected and is not permitted. Push is not connected and nothing is sent. Reports, the finance register, and the CRM run in this platform. No external analytics provider, external ledger, or CDN address is connected.",
        ],
      },
    ],
    deployment: [
      {
        heading: "Environments",
        paragraphs: [
          "The application recognises development, staging, and production. Production refuses a database push, seed, and setup unless a destructive override is set on purpose. The session cookie is marked Secure only when the public address is HTTPS.",
          "A replacement build is started only after the previous process has released the port. Health routes report the process, the database, and Redis. They do not print secrets.",
        ],
      },
    ],
    admin: [
      {
        heading: "Staff sign-in",
        paragraphs: [
          "Super Admin, Admin, Accounts, Marketing, Academic, and Safeguarding sign in and then turn on two-factor authentication before staff tools open. Super Admin assigns staff roles. Only Super Admin can assign Super Admin.",
        ],
      },
      {
        heading: "Day to day",
        paragraphs: [
          "Use Users for accounts, Bookings for lessons, the finance desk for charges and payouts, Safeguarding for reports and incidents, and Testing for the separate UAT accounts. Marketing does not target students or anyone under 18. Messages stay on the platform.",
          "Set a UAT password from Testing. The password is not shown again. Card numbers are not stored. The tokenised payment gateway is connected only when its secrets are set.",
        ],
      },
    ],
    teacher: [
      {
        heading: "Your workspace",
        paragraphs: [
          "Apply, complete the agreement, and wait for approval. After approval, the teacher home opens availability, bookings, group lessons, live courses, the library, homework, games, quizzes, exams, marking, and earnings.",
        ],
      },
      {
        heading: "Lessons and contact",
        paragraphs: [
          "Join a classroom from the booking. Recordings stay in platform storage. Your earnings page shows your own amounts. It does not show another teacher's revenue.",
          "Write to students and parents from Messages. Do not put phone numbers, email addresses, or other contact details in classroom files or file names.",
        ],
      },
    ],
    student: [
      {
        heading: "Your learning home",
        paragraphs: [
          "The student home keeps your profile, goals, bookings, homework, library, quizzes, exams, and progress for Qur'an, Arabic, and Islamic Studies. Lesson times follow your timezone.",
        ],
      },
      {
        heading: "Teachers and family",
        paragraphs: [
          "Find an approved teacher and book from their page. A parent may be linked to your account and can see the family view of your lessons. Messages with teachers stay on the platform.",
        ],
      },
    ],
    parent: [
      {
        heading: "Your family home",
        paragraphs: [
          "The family home lists linked children, bookings, homework, progress, and the wallet. You can add a child up to the household limit. The wallet shows family charges. It does not show teacher payouts.",
        ],
      },
      {
        heading: "Contact and concerns",
        paragraphs: [
          "Messages with teachers stay on the platform. To raise a safeguarding concern, use the safeguarding page. Display currency can change in the footer. Settlement stays in the currency of the charge.",
        ],
      },
    ],
    source: [
      {
        heading: "Repositories in this project",
        paragraphs: [
          "The web application lives in web/. Pages are under src/app, server logic under src/server, the database schema under src/db, and the interface under src/components. The iOS and Android applications live in mobile/. The Android project is generated there. An iOS prebuild is not run on this Windows host, and the apps are not submitted to the stores.",
          "The web README is still the framework template. This page is the source-code documentation for the platform.",
        ],
      },
    ],
    storesHeading: "Data stores",
    rulesHeading: "Design rules",
    areasHeading: "API areas",
    statusHeading: "Provider status",
    liveHeading: "This process",
    httpsOn: "The public address uses HTTPS.",
    httpsOff: "The public address is HTTP, so the session cookie is not marked Secure.",
    dbOn: "Database push is allowed in this environment.",
    dbOff: "Database push is turned off in this environment.",
    connected: "Secrets set",
    notConnected: "Not connected",
    emailMeta: "Composed here and not delivered",
    whatsAppMeta: "Not connected and not permitted",
  },
  ar: {
    overview: [
      {
        heading: "الوثائق المكتوبة",
        paragraphs: [
          "هذه الوثائق هي المرجع المكتوب: بنية النظام، وقاعدة البيانات، وواجهة البرمجة، والتكامل، والنشر، ودليل الإدارة، ودليل المعلم، ودليل الطالب، ودليل ولي الأمر، وتوثيق الشفرة المصدرية. تدريب المشرف الأعلى والإدارة والحسابات والشؤون الأكاديمية والتسويق وموظفي الحماية دورة منفصلة لكل دور.",
        ],
      },
      {
        heading: "من يقرأها",
        paragraphs: [
          "يقرأ الموظفون كل وثيقة من صفحة التوثيق. وللمعلم والطالب وولي الأمر دليل في صفحته بعد تسجيل الدخول. تصف الأدلة الصفحات الموجودة اليوم.",
        ],
      },
    ],
    architecture: [
      {
        heading: "شكل المنصة",
        paragraphs: [
          "تطبيق الويب هو سجل النظام. يحتفظ Postgres بالبيانات الدائمة، ويحتفظ Redis بذاكرة الجلسة قصيرة الأجل وأقفال الحجز وحدود المعدل والطوابير، والتخزين الكائني مكان بايتات الملفات. يخزّن Postgres مفتاح التخزين لا الملف نفسه.",
          "ينمو المعلمون والطلاب والدروس والدول والعملات والتسجيلات والمواد والدورات كصفوف جديدة. لا يتطلب الحجم الأكبر تطبيقاً جديداً.",
        ],
      },
    ],
    database: [
      {
        heading: "كيف تُخزَّن السجلات",
        paragraphs: [
          "المعرّفات العامة UUID. تُخزَّن الأوقات بالتوقيت العالمي وتُعرض بمنطقة الحساب. المال عدد صحيح بوحدات صغيرة مع رمز عملة ISO. يُحذف المستخدم حذفاً ناعماً. لا يُحذف سجل المال أو التدقيق حذفاً نهائياً.",
          "المجموعات أدناه هي مجموعات المخطط الحي. أسماء الفوترة المحجوزة، مثل نوايا الدفع ومحافظ المعلمين، ليست جداول في ذلك المخطط.",
        ],
      },
    ],
    api: [
      {
        heading: "الإصدار والمدخل",
        paragraphs: [
          "واجهات HTTP تحت /api/v1 وتمر بمساعد مسار واحد. تستخدم استجابات JSON الغلاف المشترك إلا عندما يعيد المسار ملفاً. تتطلب التغييرات المصدّقة فحص نفس الأصل. وتتطلب أدوات الموظفين صلاحية الدور.",
          "قد يرسل تطبيقا iOS وAndroid رمزاً مع ترويسة عميل الجوال. تستخدم جلسات المتصفح ملف تعريف الارتباط. يجب أن تتحقق خطافات الويب من توقيعها قبل أي كتابة.",
        ],
      },
    ],
    integration: [
      {
        heading: "المحوّلات",
        paragraphs: [
          "المدفوعات والمدفوعات للمعلمين وفيديو الصف والتخزين السحابي والبريد والنموذج الخارجي محوّلات على الخادم. يتصل المزوّد فقط عندما تُضبط كل أسراره. لا يصل المتصفح إلى تلك الأسرار، ولا تُخزَّن أرقام البطاقات.",
          "يُكتب البريد هنا ولا يُسلَّم، حتى إذا وُجد سر البريد. الرسائل القصيرة غير متصلة. واتساب غير متصل وغير مسموح. الإشعارات غير متصلة ولا يُرسل شيء. تعمل التقارير وسجل المال وإدارة العلاقات داخل المنصة. لا يوجد مزوّد تحليلات خارجي ولا دفتر خارجي ولا عنوان CDN.",
        ],
      },
    ],
    deployment: [
      {
        heading: "البيئات",
        paragraphs: [
          "يتعرّف التطبيق على التطوير والتجريب والإنتاج. يرفض الإنتاج دفع قاعدة البيانات والبذر والإعداد إلا إذا ضُبط تجاوز مقصود. تُعلَّم جلسة المتصفح آمنة فقط عندما يكون العنوان العام HTTPS.",
          "يبدأ البناء البديل فقط بعد أن يحرر العملية السابقة المنفذ. تبلغ مسارات الصحة عن العملية وقاعدة البيانات وRedis. ولا تطبع الأسرار.",
        ],
      },
    ],
    admin: [
      {
        heading: "دخول الموظفين",
        paragraphs: [
          "يدخل المشرف الأعلى والإدارة والحسابات والتسويق والشؤون الأكاديمية والحماية ثم يفعّلون التحقق بخطوتين قبل فتح أدوات الموظفين. يعيّن المشرف الأعلى أدوار الموظفين. ولا يعيّن دور المشرف الأعلى إلا مشرف أعلى.",
        ],
      },
      {
        heading: "العمل اليومي",
        paragraphs: [
          "استخدم المستخدمين للحسابات، والحجوزات للدروس، ومكتب المال للرسوم والمدفوعات، والحماية للبلاغات، والاختبار لحسابات القبول المنفصلة. لا يستهدف التسويق الطلاب ولا من هم دون 18. تبقى الرسائل داخل المنصة.",
          "اضبط كلمة مرور القبول من الاختبار. لا تُعرض مرة أخرى. لا تُخزَّن أرقام البطاقات. تتصل بوابة الدفع بالرمز فقط عندما تُضبط أسرارها.",
        ],
      },
    ],
    teacher: [
      {
        heading: "مساحة عملك",
        paragraphs: [
          "قدّم الطلب وأكمل الاتفاقية وانتظر الاعتماد. بعد الاعتماد تفتح صفحة المعلم التوفر والحجوزات ودروس المجموعة والدورات المباشرة والمكتبة والواجبات والألعاب والاختبارات القصيرة والامتحانات والتصحيح والأرباح.",
        ],
      },
      {
        heading: "الدروس والتواصل",
        paragraphs: [
          "ادخل الصف من الحجز. تبقى التسجيلات في تخزين المنصة. تعرض صفحة أرباحك مبالغك وحدها. ولا تعرض إيراد معلم آخر.",
          "اكتب للطلاب وأولياء الأمور من الرسائل. لا تضع أرقام هواتف أو عناوين بريد أو وسائل اتصال أخرى في ملفات الصف أو أسماء الملفات.",
        ],
      },
    ],
    student: [
      {
        heading: "بيت تعلّمك",
        paragraphs: [
          "تبقي صفحة الطالب ملفك وأهدافك وحجوزاتك وواجباتك ومكتبتك واختباراتك وامتاناتك وتقدم القرآن والعربية والدراسات الإسلامية. تتبع أوقات الدروس منطقتك الزمنية.",
        ],
      },
      {
        heading: "المعلمون والعائلة",
        paragraphs: [
          "ابحث عن معلم معتمد واحجز من صفحته. قد يُربط ولي أمر بحسابك ويرى دروسك من صفحة العائلة. تبقى الرسائل مع المعلمين داخل المنصة.",
        ],
      },
    ],
    parent: [
      {
        heading: "بيت العائلة",
        paragraphs: [
          "تعرض صفحة العائلة الأبناء المرتبطين والحجوزات والواجبات والتقدم والمحفظة. يمكنك إضافة ابن ضمن حد الأسرة. تعرض المحفظة رسوم العائلة. ولا تعرض مدفوعات المعلمين.",
        ],
      },
      {
        heading: "التواصل والاهتمام",
        paragraphs: [
          "تبقى الرسائل مع المعلمين داخل المنصة. لرفع قلق حماية استخدم صفحة الحماية. يمكن تغيير عملة العرض من التذييل. تبقى التسوية بعملة الرسم.",
        ],
      },
    ],
    source: [
      {
        heading: "المستودعات في هذا المشروع",
        paragraphs: [
          "يعيش تطبيق الويب في web/. الصفحات تحت src/app، ومنطق الخادم تحت src/server، ومخطط قاعدة البيانات تحت src/db، والواجهة تحت src/components. يعيش تطبيقا iOS وAndroid في mobile/. مشروع أندرويد مولَّد هناك. لا يُشغَّل بناء iOS المسبق على مضيف ويندوز هذا، ولم يُرسلا إلى المتاجر.",
          "ما زال ملف README للويب قالب إطار العمل. هذه الصفحة هي توثيق الشفرة المصدرية للمنصة.",
        ],
      },
    ],
    storesHeading: "مخازن البيانات",
    rulesHeading: "قواعد التصميم",
    areasHeading: "مجالات الواجهة",
    statusHeading: "حالة المزوّدين",
    liveHeading: "هذه العملية",
    httpsOn: "العنوان العام يستخدم HTTPS.",
    httpsOff: "العنوان العام HTTP، لذلك لا تُعلَّم جلسة المتصفح آمنة.",
    dbOn: "دفع قاعدة البيانات مسموح في هذه البيئة.",
    dbOff: "دفع قاعدة البيانات متوقف في هذه البيئة.",
    connected: "الأسرار مضبوطة",
    notConnected: "غير متصل",
    emailMeta: "يُكتب هنا ولا يُسلَّم",
    whatsAppMeta: "غير متصل وغير مسموح",
  },
} as const;

const designRulesAr = [
  "UUID لكل معرّف عام",
  "timestamptz في كل مكان؛ والعرض بمنطقة المستخدم",
  "المال وحدات صحيحة صغيرة مع رمز عملة ISO",
  "حذف المستخدمين نعماً بـ deleted_at؛ ولا يُحذف سجل المال أو التدقيق نهائياً",
  "التحكم بالوصول مفاتيح صلاحيات، لا فحوص أدوار ثابتة داخل الميزات",
  "Postgres دائم؛ ويمكن تفريغ Redis دون فقدان الحسابات",
  "الواجهات العامة تحت /api/v1 وتمر بـ apiRoute",
  "التغييرات المصدّقة تتطلب فحص CSRF من نفس الأصل",
  "يجب أن تتحقق خطافات الويب الواردة من توقيع HMAC قبل أي كتابة",
  "لا تدخل بيانات البطاقة أو أسرار التخزين إلى Postgres أو المتصفح",
  "تُستدعى التكاملات عبر محوّلات الخادم فقط، لا من المتصفح",
  "تُحل اللغة من ملف الارتباط ثم الحساب ثم Accept-Language؛ وتبقى المسارات بلا بادئة",
  "تُحل عملة العرض من ملف الارتباط ثم الحساب ثم افتراض الدولة؛ وتبقى المبالغ وحدات صحيحة مع رمز ISO وسعر الصرف للعرض فقط",
  "يتسع المعلمون والطلاب والدروس والدول والعملات والتسجيلات والمواد والدورات كسجلات جديدة في الجداول الحالية. لا يتطلب نمو الحجم تطبيقاً جديداً",
] as const;

const extraChannels = ["sms", "whatsapp", "push", "analytics", "accounting", "cdn"] as const;

function localeCopy(locale: string) {
  return locale === "ar" ? copy.ar : copy.en;
}

function walkRoutes(dir: string): number {
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) count += walkRoutes(path.join(dir, entry.name));
    else if (entry.name === "route.ts") count += 1;
  }
  return count;
}

let apiCache: { routes: number; areas: string[] } | undefined;

export function apiSurface() {
  if (apiCache) return apiCache;
  try {
    const dir = path.join(process.cwd(), "src", "app", "api", "v1");
    apiCache = {
      routes: walkRoutes(dir),
      areas: readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort(),
    };
  } catch {
    apiCache = { routes: 0, areas: [] };
  }
  return apiCache;
}

export function tableCount() {
  return platformModules.reduce((sum, module) => sum + module.tables.length, 0);
}

export function integrationRows() {
  const registry = getIntegrationStatus().map((item) => ({
    id: item.key,
    on: item.key === "email" ? false : item.configured,
  }));
  return [
    ...registry,
    ...extraChannels.map((id) => ({ id, on: false })),
  ];
}

export function deploymentState() {
  const config = getConfig();
  return {
    env: config.APP_ENV,
    https: config.APP_URL.startsWith("https://"),
    dbPush: config.allowDbPush,
  };
}

export function isDocId(value: string): value is DocId {
  return (docIds as readonly string[]).includes(value);
}

export function documentBlocks(id: DocId, locale: string): DocBlock[] {
  const text = localeCopy(locale);
  const blocks: DocBlock[] = text[id].map((block) => ({
    heading: block.heading,
    paragraphs: [...block.paragraphs],
  }));

  if (id === "architecture") {
    blocks.push({
      heading: text.storesHeading,
      paragraphs: [],
      items:
        locale === "ar"
          ? [
              "postgres: سجل النظام. الهوية، والجغرافيا، والملفات الشخصية، والكتالوج، والمحتوى، وبيانات الملفات، والترجمة، وإعدادات المنصة، وسجلات التدقيق.",
              "redis: ذاكرة قصيرة وأقفال. ذاكرة الجلسة، وأقفال الحجز، وحدود المعدل، وطوابير العمل.",
              "object_storage: الملفات الثنائية. الصور، والوثائق، وفيديوهات التعريف، والتسجيلات. يخزّن Postgres مفتاح التخزين فقط ولا تُكتب الملفات على القرص المحلي.",
            ]
          : dataStores.map((store) => {
              const note = "note" in store ? ` ${store.note}` : "";
              return `${store.key}: ${store.role}. ${store.owns.join(", ")}.${note}`;
            }),
    });
    blocks.push({
      heading: text.rulesHeading,
      paragraphs: [],
      items: locale === "ar" ? [...designRulesAr] : [...designRules],
    });
  }

  if (id === "database") {
    for (const group of platformModules) {
      blocks.push({
        heading: group.key,
        paragraphs: [group.tables.join(", ")],
      });
    }
  }

  if (id === "api") {
    const surface = apiSurface();
    blocks.push({
      heading: text.areasHeading,
      paragraphs: [
        locale === "ar"
          ? `${surface.routes} ملف مسار تحت /api/v1.`
          : `${surface.routes} route files under /api/v1.`,
      ],
      items: surface.areas,
    });
  }

  if (id === "integration") {
    blocks.push({
      heading: text.statusHeading,
      paragraphs: [],
      items: integrationRows().map((row) => {
        if (row.id === "email") return `${row.id}: ${text.emailMeta}`;
        if (row.id === "whatsapp") return `${row.id}: ${text.whatsAppMeta}`;
        return `${row.id}: ${row.on ? text.connected : text.notConnected}`;
      }),
    });
  }

  if (id === "deployment") {
    const live = deploymentState();
    blocks.push({
      heading: text.liveHeading,
      paragraphs: [
        locale === "ar" ? `البيئة: ${live.env}.` : `Environment: ${live.env}.`,
        live.https ? text.httpsOn : text.httpsOff,
        live.dbPush ? text.dbOn : text.dbOff,
      ],
    });
  }

  return blocks;
}

if (designRulesAr.length !== designRules.length) {
  throw new Error("Architecture rule translations do not match the source rules");
}

export function sectionCount(id: DocId) {
  return documentBlocks(id, "en").length;
}
