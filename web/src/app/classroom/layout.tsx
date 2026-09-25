import { I18nProvider } from "@/components/i18n/i18n-provider";
import { getI18n } from "@/server/i18n/locale";

export default async function ClassroomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locale, messages } = await getI18n();
  return (
    <I18nProvider locale={locale.code} direction={locale.direction} messages={messages}>
      <div className="flex min-h-full flex-1 flex-col">{children}</div>
    </I18nProvider>
  );
}
