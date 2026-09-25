"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { NotificationMenu } from "@/components/notifications/notification-menu";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { CurrencySwitcher } from "@/components/money/currency-switcher";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import type { BrandProfile } from "@/lib/brand";
import type { PublicCurrency } from "@/lib/currency";
import type { PublicLocale } from "@/lib/i18n";

const LOGO_GUTTER =
  "ps-[11.75rem] sm:ps-[17.75rem]";

export function SiteHeader({
  brand,
  user,
  nav,
  labels,
  locales,
  locale,
  currencies,
  currency,
}: {
  brand: BrandProfile;
  user?: {
    displayName: string;
    roleKey?: string;
    staff?: boolean;
    twoFactorPending?: boolean;
    unreadNotifications?: number;
  } | null;
  nav: { href: string; label: string }[];
  labels: {
    login: string;
    learn: string;
    family: string;
    staff: string;
    teachHome: string;
    setup2fa: string;
    menuOpen: string;
    menuClose: string;
    language: string;
    currency: string;
  };
  locales: PublicLocale[];
  locale: string;
  currencies: PublicCurrency[];
  currency: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      if (window.matchMedia("(min-width: 1024px)").matches) {
        setOpen(false);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="site-header sticky top-0 z-40 overflow-visible border-b-[3px] border-brand-accent bg-brand">
      <Container className="relative overflow-visible">
        <div
          className={`header-main relative flex h-[4.0625rem] items-center justify-end gap-2 overflow-visible ${LOGO_GUTTER}`}
        >
          <div className="logo-wrap absolute start-0 top-2.5 z-50">
            <Logo brand={brand} hang tone="inverse" />
          </div>

          <div className="hidden min-w-0 items-center justify-end gap-1.5 lg:flex">
            <LanguageSwitcher
              locales={locales}
              current={locale}
              label={labels.language}
              compact
              tone="inverse"
            />
            <CurrencySwitcher
              currencies={currencies}
              current={currency}
              label={labels.currency}
              compact
              tone="inverse"
            />
            <HeaderActions user={user} labels={labels} tone="inverse" />
          </div>

          <button
            type="button"
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-brand-accent/50 bg-white/10 text-brand-accent lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="sr-only">
              {open ? labels.menuClose : labels.menuOpen}
            </span>
            <span aria-hidden className="text-lg font-extrabold">
              {open ? "×" : "☰"}
            </span>
          </button>
        </div>

        <nav
          className={`hidden flex-wrap items-center gap-1 border-t border-white/10 py-2 ${LOGO_GUTTER} lg:flex`}
          aria-label="Primary"
        >
          {nav.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              active={pathname === item.href}
            />
          ))}
        </nav>
      </Container>

      {open ? (
        <div
          id="mobile-nav"
          className="relative z-[60] border-t border-line bg-surface lg:hidden"
        >
          <Container className="flex max-h-[calc(100dvh-5rem)] flex-col gap-2 overflow-y-auto py-4">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="min-h-12 rounded-2xl px-4 py-3 text-base font-bold text-brand hover:bg-mint"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <LanguageSwitcher
              locales={locales}
              current={locale}
              label={labels.language}
            />
            <CurrencySwitcher
              currencies={currencies}
              current={currency}
              label={labels.currency}
            />
            {user ? (
              <>
                {user.roleKey === "parent" || user.roleKey === "student" ? (
                  <NotificationMenu
                    initialUnreadCount={user.unreadNotifications ?? 0}
                  />
                ) : null}
                {user.staff ? (
                  <ButtonLink
                    href={user.twoFactorPending ? "/account/security" : "/staff"}
                    variant="secondary"
                    className="w-full"
                  >
                    {user.twoFactorPending ? labels.setup2fa : labels.staff}
                  </ButtonLink>
                ) : null}
                {user.roleKey === "student" ? (
                  <ButtonLink href="/learn" variant="secondary" className="w-full">
                    {labels.learn}
                  </ButtonLink>
                ) : null}
                {user.roleKey === "parent" ? (
                  <ButtonLink href="/family" variant="secondary" className="w-full">
                    {labels.family}
                  </ButtonLink>
                ) : null}
                {user.roleKey === "teacher" ? (
                  <ButtonLink href="/teach/home" variant="secondary" className="w-full">
                    {labels.teachHome}
                  </ButtonLink>
                ) : null}
                <ButtonLink href="/account" variant="secondary" className="w-full">
                  {user.displayName}
                </ButtonLink>
                <LogoutButton className="w-full" />
              </>
            ) : (
              <ButtonLink href="/login" variant="secondary" className="w-full">
                {labels.login}
              </ButtonLink>
            )}
          </Container>
        </div>
      ) : null}
    </header>
  );
}

type HeaderUser = {
  displayName: string;
  roleKey?: string;
  staff?: boolean;
  twoFactorPending?: boolean;
  unreadNotifications?: number;
};

function HeaderActions({
  user,
  labels,
  tone = "default",
}: {
  user?: HeaderUser | null;
  labels: {
    login: string;
    learn: string;
    family: string;
    staff: string;
    teachHome: string;
    setup2fa: string;
  };
  tone?: "default" | "inverse";
}) {
  if (user) {
    return (
      <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
        {user.roleKey === "parent" || user.roleKey === "student" ? (
          <NotificationMenu
            initialUnreadCount={user.unreadNotifications ?? 0}
            tone={tone}
          />
        ) : null}
        {user.staff ? (
          <ButtonLink
            href={user.twoFactorPending ? "/account/security" : "/staff"}
            variant="ghost"
            size="sm"
            tone={tone}
          >
            {user.twoFactorPending ? labels.setup2fa : labels.staff}
          </ButtonLink>
        ) : null}
        {user.roleKey === "student" ? (
          <ButtonLink href="/learn" variant="ghost" size="sm" tone={tone}>
            {labels.learn}
          </ButtonLink>
        ) : null}
        {user.roleKey === "parent" ? (
          <ButtonLink href="/family" variant="ghost" size="sm" tone={tone}>
            {labels.family}
          </ButtonLink>
        ) : null}
        {user.roleKey === "teacher" ? (
          <ButtonLink href="/teach/home" variant="ghost" size="sm" tone={tone}>
            {labels.teachHome}
          </ButtonLink>
        ) : null}
        <ButtonLink
          href="/account"
          variant="ghost"
          size="sm"
          tone={tone}
          className="max-w-[9rem] truncate"
        >
          {user.displayName}
        </ButtonLink>
        <LogoutButton size="sm" tone={tone} />
      </div>
    );
  }

  return (
    <ButtonLink href="/login" size="sm" tone={tone}>
      {labels.login}
    </ButtonLink>
  );
}

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-3 py-2 text-sm font-bold whitespace-nowrap transition ${
        active
          ? "bg-brand-accent text-brand"
          : "text-brand-accent hover:bg-white/10 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}
