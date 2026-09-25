"use client";

import { useT } from "@/components/i18n/i18n-provider";
import type { CertificateAwardView } from "@/server/lms/certificates";

export function CertificateDocument({
  award,
  showPrint = true,
}: {
  award: CertificateAwardView;
  showPrint?: boolean;
}) {
  const t = useT();
  const issued = new Date(award.issuedAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      {showPrint ? (
        <div className="mb-6 print:hidden">
          <button
            type="button"
            className="rounded-full bg-[#CB9F64] px-5 py-2 font-semibold text-[#294634]"
            onClick={() => window.print()}
          >
            {t("cert.print")}
          </button>
        </div>
      ) : null}
      <article className="mx-auto max-w-3xl border-4 border-[#CB9F64] bg-[#F3F4F2] p-2 shadow-[var(--shadow-card)]">
        <header className="bg-[#294634] px-6 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo.png"
            alt="Al Haramain Schools"
            width={253}
            height={96}
            className="h-16 w-auto"
          />
        </header>
        <div className="bg-white px-8 py-12 text-center sm:px-12">
          <p className="font-heading text-sm font-bold uppercase tracking-[0.18em] text-[#CB9F64]">
            {award.heading}
          </p>
          <h1 className="font-heading mt-4 text-4xl font-bold tracking-tight text-[#294634]">
            {award.studentName}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-[#333333]">
            {award.body}
          </p>
          {award.sourceTitle ? (
            <p className="mt-6 text-sm font-semibold text-[#5E6B63]">
              {award.sourceTitle}
            </p>
          ) : null}
          <p className="font-heading mt-10 text-lg font-bold tracking-tight text-[#CB9F64]">
            {award.signOff}
          </p>
          <p className="mt-2 text-sm text-[#5E6B63]">
            {t("cert.issued_on", { date: issued })}
          </p>
        </div>
      </article>
    </div>
  );
}
