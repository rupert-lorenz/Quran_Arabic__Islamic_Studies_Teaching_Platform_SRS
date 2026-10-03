export const trainingCourses = [
  { id: "super_admin", slug: "super-admin" },
  { id: "admin", slug: "administration" },
  { id: "accounts", slug: "accounts" },
  { id: "academic", slug: "academic" },
  { id: "marketing", slug: "marketing" },
  { id: "safeguarding", slug: "safeguarding" },
] as const;

export type TrainingId = (typeof trainingCourses)[number]["id"];

export type TrainingBlock = {
  heading: string;
  paragraphs: string[];
};

const courses: Record<TrainingId, { en: TrainingBlock[]; ar: TrainingBlock[] }> = {
  super_admin: {
    en: [
      {
        heading: "Sign in",
        paragraphs: [
          "Sign in, then turn on two-factor authentication before staff tools open. Your own Super Admin account is separate from the UAT Super Admin account.",
        ],
      },
      {
        heading: "What you control",
        paragraphs: [
          "Super Admin is granted every catalogued permission. You create staff on Users, tailor each Admin on Admins, and change shared role defaults on Roles. Only a Super Admin can assign Super Admin. The last Super Admin cannot be suspended or demoted.",
        ],
      },
      {
        heading: "Where to work",
        paragraphs: [
          "Open Testing to set the password on each dedicated UAT account. The password is not shown again. Open Documentation for the written reference, and open this course again from Training. Messages stay on the platform.",
        ],
      },
    ],
    ar: [
      {
        heading: "تسجيل الدخول",
        paragraphs: [
          "سجّل الدخول ثم فعّل التحقق بخطوتين قبل فتح أدوات الموظفين. حساب المشرف الأعلى الخاص بك منفصل عن حساب قبول المشرف الأعلى.",
        ],
      },
      {
        heading: "ما تتحكم به",
        paragraphs: [
          "يملك المشرف الأعلى كل صلاحية مفهرسة. تنشئ الموظفين من المستخدمين، وتضبط كل إدارة من الإدارة، وتغيّر افتراضات الأدوار من الأدوار. لا يعيّن دور المشرف الأعلى إلا مشرف أعلى. لا يمكن تعليق آخر مشرف أعلى أو تخفيضه.",
        ],
      },
      {
        heading: "أين تعمل",
        paragraphs: [
          "افتح الاختبار لضبط كلمة المرور على كل حساب قبول مخصص. لا تُعرض مرة أخرى. افتح التوثيق للمرجع المكتوب، وافتح هذه الدورة مرة أخرى من التدريب. تبقى الرسائل داخل المنصة.",
        ],
      },
    ],
  },
  admin: {
    en: [
      {
        heading: "Sign in",
        paragraphs: [
          "Administration signs in and turns on two-factor authentication before staff tools open. The Administration UAT account is separate from every other Admin account.",
        ],
      },
      {
        heading: "Your desks",
        paragraphs: [
          "Open Users, Teachers, Reviews, Bookings, Group classes, and Lessons. Open Content, Countries, Languages, SEO, and Brand where your permissions include them. Open CRM for leads and support tickets, and Roles to read the permission catalogue.",
        ],
      },
      {
        heading: "The boundary",
        paragraphs: [
          "You do not assign Super Admin. Payouts and safeguarding suspensions stay with Accounts and Safeguarding unless a Super Admin adds that permission to your account. Messages stay on the platform.",
        ],
      },
    ],
    ar: [
      {
        heading: "تسجيل الدخول",
        paragraphs: [
          "تسجّل الإدارة الدخول وتفعّل التحقق بخطوتين قبل فتح أدوات الموظفين. حساب قبول الإدارة منفصل عن أي حساب إدارة آخر.",
        ],
      },
      {
        heading: "مكاتبك",
        paragraphs: [
          "افتح المستخدمين والمعلمين والمراجعات والحجوزات ودروس المجموعة والدروس. افتح المحتوى والدول واللغات وتحسين الظهور والعلامة حيث تشملها صلاحياتك. افتح إدارة العلاقات للعملاء المحتملين وتذاكر الدعم، والأدوار لقراءة فهرس الصلاحيات.",
        ],
      },
      {
        heading: "الحد",
        paragraphs: [
          "لا تعيّن المشرف الأعلى. تبقى مدفوعات المعلمين وتعليق الحماية مع الحسابات والحماية إلا إذا أضاف المشرف الأعلى تلك الصلاحية إلى حسابك. تبقى الرسائل داخل المنصة.",
        ],
      },
    ],
  },
  accounts: {
    en: [
      {
        heading: "Sign in",
        paragraphs: [
          "Accounts signs in and turns on two-factor authentication before the finance desk opens. The Accounts UAT account is separate from every other Accounts account.",
        ],
      },
      {
        heading: "Your desks",
        paragraphs: [
          "Open Payments for charges, refunds, payouts, and finance reports. Open support tickets when a family writes about a charge. Money is stored as integer minor units plus an ISO currency code.",
        ],
      },
      {
        heading: "What you do not store",
        paragraphs: [
          "Card numbers are not stored. The tokenised gateway is connected only when its secrets are set. Payment email is composed here and is not delivered. Families see their own wallet. They do not see teacher payouts.",
        ],
      },
    ],
    ar: [
      {
        heading: "تسجيل الدخول",
        paragraphs: [
          "تسجّل الحسابات الدخول وتفعّل التحقق بخطوتين قبل فتح مكتب المال. حساب قبول الحسابات منفصل عن أي حساب حسابات آخر.",
        ],
      },
      {
        heading: "مكاتبك",
        paragraphs: [
          "افتح المدفوعات للرسوم والاسترداد ومدفوعات المعلمين وتقارير المال. افتح تذاكر الدعم عندما تكتب عائلة عن رسم. يُخزَّن المال وحدات صحيحة صغيرة مع رمز عملة ISO.",
        ],
      },
      {
        heading: "ما لا تخزّنه",
        paragraphs: [
          "لا تُخزَّن أرقام البطاقات. تتصل بوابة الرمز فقط عندما تُضبط أسرارها. يُكتب بريد الدفع هنا ولا يُسلَّم. ترى العائلات محفظتها. ولا ترى مدفوعات المعلمين.",
        ],
      },
    ],
  },
  academic: {
    en: [
      {
        heading: "Sign in",
        paragraphs: [
          "Academic signs in and turns on two-factor authentication before the academic desk opens.",
        ],
      },
      {
        heading: "Your desks",
        paragraphs: [
          "Open Academic for curriculum, the teaching library, student reports, and certificates. Open Bookings and Lessons for class history. Open Qur'an, Arabic, and Islamic Studies progress when you are reviewing a learner. Open support tickets for academic questions.",
        ],
      },
      {
        heading: "The boundary",
        paragraphs: [
          "You do not run teacher payouts, and you do not suspend an account from the safeguarding investigation. Those stay with Accounts and Safeguarding.",
        ],
      },
    ],
    ar: [
      {
        heading: "تسجيل الدخول",
        paragraphs: [
          "تسجّل الشؤون الأكاديمية الدخول وتفعّل التحقق بخطوتين قبل فتح المكتب الأكاديمي.",
        ],
      },
      {
        heading: "مكاتبك",
        paragraphs: [
          "افتح الشؤون الأكاديمية للمنهج ومكتبة التدريس وتقارير الطلاب والشهادات. افتح الحجوزات والدروس لسجل الصف. افتح تقدم القرآن والعربية والدراسات الإسلامية عند مراجعة متعلم. افتح تذاكر الدعم للأسئلة الأكاديمية.",
        ],
      },
      {
        heading: "الحد",
        paragraphs: [
          "لا تدير مدفوعات المعلمين، ولا تعلّق حساباً من تحقيق الحماية. يبقى ذلك مع الحسابات والحماية.",
        ],
      },
    ],
  },
  marketing: {
    en: [
      {
        heading: "Sign in",
        paragraphs: [
          "Marketing signs in and turns on two-factor authentication before campaigns open. The Marketing UAT account is separate from every other Marketing account.",
        ],
      },
      {
        heading: "Your desks",
        paragraphs: [
          "Open Marketing for campaigns and promotions, Content for pages and announcements, CRM for leads, and marketing reports. Open support tickets when a lead writes in.",
        ],
      },
      {
        heading: "Who you may reach",
        paragraphs: [
          "Do not target students or anyone under 18. Reports run in this platform. No external analytics provider is connected. Email is composed here and is not delivered. WhatsApp is not connected and is not permitted.",
        ],
      },
    ],
    ar: [
      {
        heading: "تسجيل الدخول",
        paragraphs: [
          "يسجّل التسويق الدخول ويفعّل التحقق بخطوتين قبل فتح الحملات. حساب قبول التسويق منفصل عن أي حساب تسويق آخر.",
        ],
      },
      {
        heading: "مكاتبك",
        paragraphs: [
          "افتح التسويق للحملات والعروض، والمحتوى للصفحات والإعلانات، وإدارة العلاقات للعملاء المحتملين، وتقارير التسويق. افتح تذاكر الدعم عندما يكتب عميل محتمل.",
        ],
      },
      {
        heading: "من يمكنك مخاطبته",
        paragraphs: [
          "لا تستهدف الطلاب ولا من هم دون 18. تعمل التقارير داخل المنصة. لا يوجد مزوّد تحليلات خارجي. يُكتب البريد هنا ولا يُسلَّم. واتساب غير متصل وغير مسموح.",
        ],
      },
    ],
  },
  safeguarding: {
    en: [
      {
        heading: "Sign in",
        paragraphs: [
          "Safeguarding staff sign in and turn on two-factor authentication before the safeguarding desk opens. The Safeguarding UAT account is separate from every other Safeguarding account.",
        ],
      },
      {
        heading: "The investigation",
        paragraphs: [
          "Open Safeguarding for reports, incident notes, and recording review. You can suspend an involved account and read the audit log. A family raises a concern from the public safeguarding page. The investigation stays on the staff desk.",
        ],
      },
      {
        heading: "What stays private",
        paragraphs: [
          "Incident notes are not a family message. Do not copy phone numbers or email addresses into a note. Recording bytes are not listed with ordinary lesson files. This workflow is the investigation, and the audit log is the record of the action.",
        ],
      },
    ],
    ar: [
      {
        heading: "تسجيل الدخول",
        paragraphs: [
          "يسجّل موظفو الحماية الدخول ويفعّلون التحقق بخطوتين قبل فتح مكتب الحماية. حساب قبول الحماية منفصل عن أي حساب حماية آخر.",
        ],
      },
      {
        heading: "التحقيق",
        paragraphs: [
          "افتح الحماية للبلاغات وملاحظات الحوادث ومراجعة التسجيلات. يمكنك تعليق الحساب المعني وقراءة سجل التدقيق. ترفع العائلة قلقاً من صفحة الحماية العامة. يبقى التحقيق في مكتب الموظفين.",
        ],
      },
      {
        heading: "ما يبقى خاصاً",
        paragraphs: [
          "ملاحظات الحادث ليست رسالة للعائلة. لا تنسخ أرقام الهواتف أو عناوين البريد إلى ملاحظة. لا تُدرج بايتات التسجيل مع ملفات الدرس العادية. هذا المسار هو التحقيق، وسجل التدقيق هو قيد الإجراء.",
        ],
      },
    ],
  },
};

export function trainingBySlug(slug: string) {
  return trainingCourses.find((course) => course.slug === slug);
}

export function trainingPath(roleKey: string) {
  const course = trainingCourses.find((item) => item.id === roleKey);
  return course ? `/staff/training/${course.slug}` : "/staff/training";
}

export function trainingBlocks(id: TrainingId, locale: string): TrainingBlock[] {
  const course = courses[id];
  return locale === "ar" ? course.ar : course.en;
}

export function trainingSectionCount(id: TrainingId) {
  return courses[id].en.length;
}
