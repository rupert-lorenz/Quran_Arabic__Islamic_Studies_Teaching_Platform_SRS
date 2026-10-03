"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/i18n-provider";

export function DocumentDesk({
  documents,
  students,
  chooseStudent = false,
  canStore = false,
}: {
  documents: { id: string; title: string; meta: string }[];
  students: { id: string; name: string }[];
  chooseStudent?: boolean;
  canStore?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [studentUserId, setStudentUserId] = useState(students[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function upload(file: File | undefined) {
    if (!file) return;
    setPending(true);
    setMessage(null);
    try {
      const contentBase64 = await fileToBase64(file);
      const response = await fetch("/api/v1/documents", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentUserId: studentUserId || undefined,
          filename: file.name,
          mimeType: file.type,
          contentBase64,
        }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        error?: { message?: string };
      };
      setMessage(body.ok ? t("in.docs.saved") : body.error?.message || t("in.docs.failed"));
      if (body.ok) router.refresh();
    } catch {
      setMessage(t("in.docs.failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
        {t("in.docs.title")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t("in.docs.help")}</p>
      {canStore && students.length ? (
        <label className="mt-4 block text-sm font-bold text-brand">
          {t("in.docs.studentLabel")}
          <select
            value={studentUserId}
            onChange={(event) => setStudentUserId(event.target.value)}
            className="mt-2 block rounded-2xl border border-line px-4 py-2 font-normal"
          >
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </label>
      ) : canStore && chooseStudent ? (
        <label className="mt-4 block text-sm font-bold text-brand">
          {t("in.docs.studentLabel")}
          <input
            value={studentUserId}
            onChange={(event) => setStudentUserId(event.target.value)}
            className="mt-2 block w-full max-w-md rounded-2xl border border-line px-4 py-2 font-normal"
          />
        </label>
      ) : null}
      {canStore ? (
        <input
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          disabled={pending}
          className="mt-4 block text-sm"
          onChange={(event) => upload(event.target.files?.[0])}
        />
      ) : null}
      {message ? <p className="mt-3 text-sm text-brand">{message}</p> : null}
      <ul className="mt-4 space-y-2">
        {documents.map((item) => (
          <li key={item.id} className="rounded-2xl border border-line px-4 py-3 text-sm">
            <a className="font-bold text-brand underline" href={`/api/v1/documents/${item.id}`}>
              {item.title}
            </a>
            <p className="mt-1 text-muted">{item.meta}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      const comma = value.indexOf(",");
      resolve(comma >= 0 ? value.slice(comma + 1) : value);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
