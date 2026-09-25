import type { CmsDocumentType } from "@/lib/cms";

type SeedLocale = {
  locale: "en" | "ar";
  title: string;
  excerpt?: string;
  body?: string;
  seoTitle?: string;
  seoDescription?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export const seedCmsDocuments: {
  type: CmsDocumentType;
  slug: string;
  pinned?: boolean;
  sortOrder: number;
  locales: SeedLocale[];
}[] = [
  {
    type: "policy",
    slug: "about",
    sortOrder: 10,
    locales: [
      {
        locale: "en",
        title: "A teaching marketplace with an Islamic classroom at its heart",
        excerpt:
          "Not a generic LMS. Not a booking page. A complete home for Qur'an, Tajweed, Hifdh, Arabic, and Islamic Studies.",
        seoTitle: "About the teaching platform",
        seoDescription:
          "A child-friendly marketplace for Qur'an, Arabic, and Islamic Studies with parent oversight.",
        body: "Families should find a teacher, join a branded lesson, and see progress without leaving the platform. Teachers should apply, teach, and be paid without collecting student phone numbers.\n\nThe company mark, colours, and name stay on every public screen, every account page, and the classroom overlay Super Admin configures.",
      },
      {
        locale: "ar",
        title: "سوق تعليمي وقلبه فصل إسلامي",
        excerpt:
          "ليست منصة تعليم عامة. وليست صفحة حجز. بيت كامل للقرآن والتجويد والحفظ والعربية والدراسات الإسلامية.",
        seoTitle: "عن المنصة التعليمية",
        seoDescription:
          "سوق مناسب للأطفال لتعليم القرآن والعربية والدراسات الإسلامية مع متابعة ولي الأمر.",
        body: "ينبغي أن تجد العائلات معلماً، وتدخل درساً يحمل هوية المنصة، وترى التقدم دون مغادرة الموقع. وينبغي أن يقدّم المعلمون ويدرسوا ويُدفع لهم دون جمع أرقام الطلاب.\n\nتبقى علامة الشركة وألوانها واسمها على كل شاشة عامة وكل صفحة حساب، وعلى طبقة الفصل التي يضبطها مدير النظام.",
      },
    ],
  },
  {
    type: "policy",
    slug: "safeguarding",
    sortOrder: 20,
    locales: [
      {
        locale: "en",
        title: "Safeguarding is part of the product",
        excerpt:
          "Children have their own profiles, linked to a parent. Communication stays inside the platform.",
        seoTitle: "Safeguarding",
        seoDescription:
          "Parent-linked children, in-platform messaging, and a dedicated safeguarding staff role.",
        body: "- Parent-linked child accounts\n- No requirement to share personal phone or email\n- Encrypted lesson recordings with access controls and retention\n- Dedicated safeguarding staff role\n- Incident reporting and investigation\n- Account restriction when needed",
      },
      {
        locale: "ar",
        title: "الحماية جزء من المنتج",
        excerpt:
          "للأطفال ملفاتهم المرتبطة بولي الأمر. التواصل يبقى داخل المنصة.",
        seoTitle: "الحماية",
        seoDescription:
          "أطفال مرتبطون بولي الأمر وتواصل داخل المنصة ودور موظفين مخصص للحماية.",
        body: "- حسابات أطفال مرتبطة بولي الأمر\n- لا يلزم مشاركة هاتف أو بريد شخصي\n- تسجيلات دروس مشفّرة مع التحكم في الوصول والاحتفاظ\n- دور موظفين مخصص للحماية\n- الإبلاغ عن الحوادث والتحقيق فيها\n- تقييد الحساب عند الحاجة",
      },
    ],
  },
  {
    type: "landing",
    slug: "welcome",
    sortOrder: 30,
    locales: [
      {
        locale: "en",
        title: "Welcome, families",
        excerpt: "A short landing page you can edit from the CMS.",
        seoTitle: "Welcome",
        seoDescription: "Start with a parent account, then add each child.",
        ctaLabel: "Create a parent account",
        ctaHref: "/register?role=parent",
        body: "Create one parent login. Add each child with their own name, age, and subjects. They do not get a separate password.\n\nThen search teachers by subject, language, and the ages they teach.",
      },
      {
        locale: "ar",
        title: "أهلاً بالعائلات",
        excerpt: "صفحة هبوط قصيرة يمكن تعديلها من نظام المحتوى.",
        seoTitle: "ترحيب",
        seoDescription: "ابدأ بحساب ولي أمر ثم أضف كل طفل.",
        ctaLabel: "أنشئ حساب ولي أمر",
        ctaHref: "/register?role=parent",
        body: "أنشئ دخولاً واحداً لولي الأمر. أضف كل طفل باسمه وعمره ومواده. لن يحصلوا على كلمة مرور منفصلة.\n\nثم ابحث عن المعلمين حسب المادة واللغة والأعمار التي يدرّسونها.",
      },
    ],
  },
  {
    type: "policy",
    slug: "privacy",
    sortOrder: 22,
    locales: [
      {
        locale: "en",
        title: "Privacy notice",
        excerpt:
          "Starter copy for how the platform handles account and child data. Staff should replace this with counsel-reviewed text.",
        seoTitle: "Privacy notice",
        seoDescription:
          "How the teaching platform stores parent, child, and teacher account data.",
        body: "This page is starter copy, not legal advice. Replace it from the CMS before launch.\n\nWe collect the names, emails, and roles needed to run parent, child, and teacher accounts. Child profiles stay linked to a parent. Messaging and lesson history stay on the platform so families do not have to share a personal phone number.\n\n- Account details: name, email, role, language, and display currency\n- Child profiles created by a parent\n- Teacher application documents held for review\n- Lesson notes and recordings only when that feature is enabled\n\nYou can ask staff to correct or close an account. Super Admin can later add a formal data-retention policy here.",
      },
      {
        locale: "ar",
        title: "إشعار الخصوصية",
        excerpt:
          "نص تمهيدي عن بيانات الحسابات والأطفال. ينبغي أن يستبدله الموظفون بنص يراجعه مستشار قانوني.",
        seoTitle: "إشعار الخصوصية",
        seoDescription: "كيف تخزن المنصة بيانات ولي الأمر والطفل والمعلم.",
        body: "هذه الصفحة نص تمهيدي وليست استشارة قانونية. استبدلها من نظام المحتوى قبل الإطلاق.\n\nنجمع الأسماء والبريد والأدوار اللازمة لتشغيل حسابات ولي الأمر والطفل والمعلم. تبقى ملفات الأطفال مرتبطة بولي الأمر. تبقى الرسائل وتاريخ الدروس على المنصة حتى لا تحتاج العائلات إلى مشاركة رقم هاتف شخصي.\n\n- بيانات الحساب: الاسم والبريد والدور واللغة وعملة العرض\n- ملفات الأطفال التي ينشئها ولي الأمر\n- مستندات طلب المعلم المحفوظة للمراجعة\n- ملاحظات الدروس والتسجيلات عند تفعيل تلك الميزة\n\nيمكنك أن تطلب من الموظفين تصحيح حساب أو إغلاقه. يستطيع مدير النظام لاحقاً إضافة سياسة احتفاظ رسمية هنا.",
      },
    ],
  },
  {
    type: "policy",
    slug: "terms",
    sortOrder: 24,
    locales: [
      {
        locale: "en",
        title: "Terms of use",
        excerpt:
          "Starter terms for using the marketplace. Staff should replace this with counsel-reviewed text.",
        seoTitle: "Terms of use",
        seoDescription:
          "Starter terms for parents, students, and teachers on the platform.",
        body: "This page is starter copy, not a binding contract until counsel reviews it.\n\nThe site is a teaching marketplace. Parents create the family login. Children learn under that parent. Teachers apply, then teach inside the platform.\n\n- Keep communication and lesson files on the platform\n- Do not ask a child for a personal phone number or social account\n- Listed hourly rates are display figures until booking and payouts open\n- Staff may suspend an account that breaks safeguarding rules\n\nBooking, payments, and classroom rules will be added on later stages. Edit this page from the CMS when those products go live.",
      },
      {
        locale: "ar",
        title: "شروط الاستخدام",
        excerpt:
          "شروط تمهيدية لاستخدام السوق. ينبغي أن يستبدلها الموظفون بنص يراجعه مستشار قانوني.",
        seoTitle: "شروط الاستخدام",
        seoDescription: "شروط تمهيدية لأولياء الأمور والطلاب والمعلمين على المنصة.",
        body: "هذه الصفحة نص تمهيدي وليست عقداً ملزماً حتى يراجعها مستشار قانوني.\n\nالموقع سوق تعليمي. ينشئ ولي الأمر دخول العائلة. يتعلم الأطفال تحت ذلك الحساب. يقدّم المعلمون ثم يدرّسون داخل المنصة.\n\n- أبقِ التواصل وملفات الدرس على المنصة\n- لا تطلب من طفل رقم هاتف شخصياً أو حساباً على وسائل التواصل\n- الأجور المعروضة بالساعة أرقام عرض حتى يُفتح الحجز والدفع\n- يجوز للموظفين تعليق حساب يخالف قواعد الحماية\n\nسيُضاف الحجز والمدفوعات وقواعد الفصل في مراحل لاحقة. عدّل هذه الصفحة من نظام المحتوى عندما تُطلق تلك المنتجات.",
      },
    ],
  },
  {
    type: "article",
    slug: "how-families-start",
    sortOrder: 40,
    locales: [
      {
        locale: "en",
        title: "How families start on the platform",
        excerpt: "One parent account, then a child profile, then a teacher search.",
        seoTitle: "How families start",
        seoDescription: "Create a parent account, add children, and find a teacher.",
        ctaLabel: "Find a teacher",
        ctaHref: "/teachers",
        body: "Start with a parent account. Add each child from the family home. Teachers stay inside the platform, so you do not share a phone number to book a first lesson.\n\nWhen booking opens, the same login will hold payments, attendance, and recordings.",
      },
      {
        locale: "ar",
        title: "كيف تبدأ العائلات على المنصة",
        excerpt: "حساب ولي أمر واحد، ثم ملف للطفل، ثم البحث عن معلم.",
        seoTitle: "كيف تبدأ العائلات",
        seoDescription: "أنشئ حساب ولي أمر وأضف الأطفال وابحث عن معلم.",
        ctaLabel: "ابحث عن معلم",
        ctaHref: "/teachers",
        body: "ابدأ بحساب ولي الأمر. أضف كل طفل من الصفحة العائلية. يبقى المعلمون داخل المنصة، فلا تشارك رقم هاتف لحجز أول درس.\n\nعندما يُفتح الحجز، سيحفظ نفس الدخول المدفوعات والحضور والتسجيلات.",
      },
    ],
  },
  {
    type: "faq",
    slug: "how-do-parents-create-an-account",
    sortOrder: 50,
    locales: [
      {
        locale: "en",
        title: "How do parents create an account?",
        excerpt: "Register as a parent, verify email, then add children.",
        body: "Open Get started and choose the parent role. Verify the email, then add each child from the family dashboard. Children do not receive a separate login.",
      },
      {
        locale: "ar",
        title: "كيف ينشئ ولي الأمر حساباً؟",
        excerpt: "سجّل كولي أمر، ثم أكّد البريد، ثم أضف الأطفال.",
        body: "افتح ابدأ الآن واختر دور ولي الأمر. أكّد البريد ثم أضف كل طفل من لوحة العائلة. لا يحصل الأطفال على دخول منفصل.",
      },
    ],
  },
  {
    type: "faq",
    slug: "are-lessons-kept-on-the-platform",
    sortOrder: 60,
    locales: [
      {
        locale: "en",
        title: "Are lessons kept on the platform?",
        excerpt: "Yes. Messaging, booking, and recordings stay here.",
        body: "Children should not share personal contact details. Lesson history and recordings, when enabled, stay on the family and student dashboards.",
      },
      {
        locale: "ar",
        title: "هل تبقى الدروس على المنصة؟",
        excerpt: "نعم. الرسائل والحجز والتسجيلات تبقى هنا.",
        body: "ينبغي ألا يشارك الأطفال بيانات تواصل شخصية. يبقى تاريخ الدروس والتسجيلات — عند تفعيلها — في لوحات العائلة والطالب.",
      },
    ],
  },
  {
    type: "banner",
    slug: "welcome-banner",
    pinned: true,
    sortOrder: 5,
    locales: [
      {
        locale: "en",
        title: "Find a trusted Qur'an teacher",
        excerpt: "Search by subject, language, and the ages they teach.",
        ctaLabel: "Browse teachers",
        ctaHref: "/teachers",
      },
      {
        locale: "ar",
        title: "اعثر على معلم قرآن موثوق",
        excerpt: "ابحث حسب المادة واللغة والأعمار التي يدرّسونها.",
        ctaLabel: "تصفح المعلمين",
        ctaHref: "/teachers",
      },
    ],
  },
  {
    type: "banner",
    slug: "parent-accounts-banner",
    sortOrder: 6,
    locales: [
      {
        locale: "en",
        title: "Parents start the family account",
        excerpt: "Add each child, then search teachers from one login.",
        ctaLabel: "How families start",
        ctaHref: "/pages/welcome",
      },
      {
        locale: "ar",
        title: "ولي الأمر يبدأ حساب العائلة",
        excerpt: "أضف كل طفل ثم ابحث عن المعلمين من دخول واحد.",
        ctaLabel: "كيف تبدأ العائلات",
        ctaHref: "/pages/welcome",
      },
    ],
  },
  {
    type: "announcement",
    slug: "marketplace-search-is-live",
    sortOrder: 70,
    locales: [
      {
        locale: "en",
        title: "Teacher search is live",
        excerpt: "Filter approved teachers and see the listed hourly rate in your currency.",
        seoTitle: "Teacher search is live",
        seoDescription: "Search approved teachers and switch display currency.",
        ctaLabel: "Open the marketplace",
        ctaHref: "/teachers",
        body: "Families can now search approved teachers, switch language and display currency, and open each public profile.\n\nBooking stays on a later stage. The cards you see today are the same layout children and parents will use on phones.",
      },
      {
        locale: "ar",
        title: "بحث المعلمين متاح الآن",
        excerpt: "صفِّ المعلمين المعتمدين وشاهد الأجر بالساعة بعملتك.",
        seoTitle: "بحث المعلمين متاح",
        seoDescription: "ابحث عن المعلمين المعتمدين وبدّل عملة العرض.",
        ctaLabel: "افتح السوق",
        ctaHref: "/teachers",
        body: "يمكن للعائلات الآن البحث عن المعلمين المعتمدين، وتبديل اللغة وعملة العرض، وفتح كل ملف عام.\n\nالحجز يأتي في مرحلة لاحقة. البطاقات التي تراها اليوم هي نفس التخطيط الذي سيستخدمه الأطفال وأولياء الأمور على الهاتف.",
      },
    ],
  },
];
