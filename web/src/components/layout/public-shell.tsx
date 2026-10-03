import { I18nProvider } from "@/components/i18n/i18n-provider";
import { TimezoneSync } from "@/components/i18n/timezone-sync";
import { getI18n } from "@/server/i18n/locale";
import { getRequestMoney } from "@/server/money/currency";
import { resolveDisplayTimeZone, readTimeZoneCookie } from "@/server/booking/policy";
import { countUnreadNotifications } from "@/server/notifications/service";
import { getAccessContext } from "@/server/rbac/guard";
import { publicNav } from "@/lib/site";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export async function PublicShell({ children }: { children: React.ReactNode }) {
  const [i18n, money, access] = await Promise.all([
    getI18n(),
    getRequestMoney(),
    getAccessContext(),
  ]);
  const unreadNotifications =
    access?.user.roleKey === "parent" || access?.user.roleKey === "student"
      ? await countUnreadNotifications(access.user.id).catch(() => 0)
      : 0;
  const [timeZone, timezoneCookie] = await Promise.all([
    resolveDisplayTimeZone(access?.user.id),
    readTimeZoneCookie(),
  ]);
  const { brand, locale, locales, messages, t } = i18n;

  return (
    <I18nProvider locale={locale.code} direction={locale.direction} messages={messages}>
    <div className="flex min-h-full flex-1 flex-col">
      <TimezoneSync current={timeZone} enabled={!timezoneCookie} />
      <a href="#main" className="skip-link">
        {t("nav.skip")}
      </a>
      <SiteHeader
        brand={brand}
        nav={publicNav.map((item) => {
          const teacherHome =
            access?.user.roleKey === "teacher" && item.href === "/teach";
          return {
            href: teacherHome ? "/teach/home" : item.href,
            label: teacherHome ? t("nav.teach_home") : t(item.messageKey),
          };
        })}
        labels={{
          login: t("nav.login"),
          learn: t("nav.learn"),
          family: t("nav.family"),
          staff: t("nav.staff"),
          teachHome: t("nav.teach_home"),
          setup2fa: t("nav.setup_2fa"),
          menuOpen: t("nav.menu_open"),
          menuClose: t("nav.menu_close"),
          language: t("language.label"),
          currency: t("currency.label"),
        }}
        locales={locales}
        locale={locale.code}
        currencies={money.currencies}
        currency={money.currency.code}
        user={
          access
            ? {
                displayName: access.user.displayName,
                roleKey: access.user.roleKey,
                staff: access.isStaff,
                twoFactorPending: access.twoFactorPending,
                unreadNotifications,
              }
            : null
        }
      />
      <main id="main" className="min-w-0 flex-1 overflow-x-clip">
        {children}
      </main>
      <SiteFooter
        brand={brand}
        locales={locales}
        locale={locale.code}
        languageLabel={t("language.label")}
        currencies={money.currencies}
        currency={money.currency.code}
        currencyLabel={t("currency.label")}
        secondaryName={locale.code === "en" ? brand.nameAr : null}
        groups={[
          {
            title: t("footer.learn"),
            links: [
              { href: "/teachers", label: t("footer.find_teacher") },
              { href: "/preview", label: t("preview.browse") },
              { href: "/subjects", label: t("nav.subjects") },
              { href: "/courses", label: t("footer.courses") },
              { href: "/live-courses", label: t("nav.live_courses") },
              { href: "/group-lessons", label: t("nav.group_lessons") },
              { href: "/parents", label: t("nav.for_parents") },
              { href: "/blog", label: t("footer.blog") },
              { href: "/pages", label: t("footer.pages") },
              { href: "/faq", label: t("footer.faq") },
              { href: "/help", label: t("footer.help") },
            ],
          },
          {
            title: t("footer.teach"),
            links: [
              { href: access?.user.roleKey === "teacher" ? "/teach/home" : "/teach", label: t("footer.become_teacher") },
              { href: "/register", label: t("footer.create_account") },
            ],
          },
          {
            title: t("footer.trust"),
            links: [
              { href: "/safeguarding", label: t("footer.safeguarding") },
              { href: "/support", label: t("footer.support") },
              { href: "/mobile", label: t("footer.apps") },
              { href: "/about", label: t("footer.about") },
              { href: "/policies", label: t("footer.policies") },
              { href: "/news", label: t("footer.news") },
              { href: "/login", label: t("nav.login") },
            ],
          },
        ]}
      />
    </div>
    </I18nProvider>
  );
}
