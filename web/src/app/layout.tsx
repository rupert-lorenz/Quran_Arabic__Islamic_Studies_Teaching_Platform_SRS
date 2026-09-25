import type { Metadata, Viewport } from "next";
import { Nunito, Noto_Sans_Arabic, Poppins } from "next/font/google";
import { BrandJsonLd } from "@/components/brand/json-ld";
import { getI18n } from "@/server/i18n/locale";
import { getConfig } from "@/server/config";
import { getSiteSeo } from "@/server/seo/site";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const notoArabic = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
});

export async function generateMetadata(): Promise<Metadata> {
  const [{ brand, locale }, seo] = await Promise.all([getI18n(), getSiteSeo()]);
  const config = getConfig();
  const title = seo.defaultTitle || brand.name;
  const description = seo.defaultDescription || brand.description;

  return {
    metadataBase: new URL(config.APP_URL),
    applicationName: brand.name,
    title: {
      default: title,
      template: `%s · ${brand.name}`,
    },
    description,
    keywords: [
      "Qur'an",
      "Tajweed",
      "Hifdh",
      "Arabic",
      "Islamic Studies",
      brand.name,
    ],
    authors: [{ name: brand.legalName }],
    openGraph: {
      type: "website",
      siteName: brand.name,
      title,
      description,
      locale: locale.code === "ar" ? "ar" : "en_GB",
      alternateLocale: locale.code === "ar" ? ["en_GB"] : ["ar"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: seo.robotsIndex
      ? { index: true, follow: true }
      : { index: false, follow: false },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const { brand } = await getI18n();

  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: brand.colors.primary,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { brand, locale } = await getI18n();
  const config = getConfig();

  return (
    <html
      lang={locale.code}
      dir={locale.direction}
      className={`${nunito.variable} ${poppins.variable} ${notoArabic.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <BrandJsonLd brand={brand} url={config.APP_URL} />
        {children}
      </body>
    </html>
  );
}
