import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { CurrencySwitcher } from "@/components/money/currency-switcher";
import { Container } from "@/components/ui/container";
import type { BrandProfile } from "@/lib/brand";
import type { PublicCurrency } from "@/lib/currency";
import type { PublicLocale } from "@/lib/i18n";

export function SiteFooter({
  brand,
  groups,
  locales,
  locale,
  languageLabel,
  currencies,
  currency,
  currencyLabel,
  secondaryName,
}: {
  brand: BrandProfile;
  groups: { title: string; links: { href: string; label: string }[] }[];
  locales: PublicLocale[];
  locale: string;
  languageLabel: string;
  currencies: PublicCurrency[];
  currency: string;
  currencyLabel: string;
  secondaryName?: string | null;
}) {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer mt-auto border-t border-line bg-brand text-white">
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo brand={brand} tone="inverse" />
          {secondaryName ? (
            <p className="mt-3 text-sm font-semibold text-brand-accent" dir="rtl">
              {secondaryName}
            </p>
          ) : null}
          <p className="mt-4 max-w-xs text-sm leading-7 text-white/75">
            {brand.description}
          </p>
        </div>
        {groups.map((group) => (
          <div key={group.title}>
            <p className="text-sm font-extrabold text-brand-accent">
              {group.title}
            </p>
            <ul className="mt-4 space-y-2">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-11 items-center text-sm font-semibold text-white/85 hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>
      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-3 py-5 text-sm text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {brand.legalName}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <LanguageSwitcher
              locales={locales}
              current={locale}
              label={languageLabel}
              tone="inverse"
            />
            <CurrencySwitcher
              currencies={currencies}
              current={currency}
              label={currencyLabel}
              tone="inverse"
            />
          </div>
          <p>
            <a href={`mailto:${brand.supportEmail}`} className="hover:text-white">
              {brand.supportEmail}
            </a>
          </p>
        </Container>
      </div>
    </footer>
  );
}
