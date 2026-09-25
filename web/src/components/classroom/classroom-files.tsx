"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n, useT } from "@/components/i18n/i18n-provider";
import {
  CLASSROOM_MAX_FILE_BYTES,
  CLASSROOM_MAX_FILES,
  classroomFileAccept,
  classroomFileKind,
  formatClassroomFileSize,
  type ClassroomSharedFile,
} from "@/lib/classroom-files";
import { isClassroomPresentableType } from "@/lib/classroom-pptx";
import { isClassroomBoardImageType } from "@/lib/classroom-whiteboard";
import { detectBrowserTimeZone, formatClockInTimeZone } from "@/lib/timezone";

export function ClassroomFiles({
  files,
  selfId,
  canShare,
  canRemoveAny,
  canAnnotate,
  canPresent,
  presentingFileId,
  uploading,
  onUpload,
  onRemove,
  onAnnotate,
  onPresent,
}: {
  files: ClassroomSharedFile[];
  selfId: string;
  canShare: boolean;
  canRemoveAny: boolean;
  canAnnotate?: boolean;
  canPresent?: boolean;
  presentingFileId?: string;
  uploading: boolean;
  onUpload: (file: File) => void;
  onRemove: (fileId: string) => void;
  onAnnotate?: (fileId: string) => void;
  onPresent?: (fileId: string) => void;
}) {
  const t = useT();
  const { locale } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState("");
  const zone = detectBrowserTimeZone() ?? "UTC";

  return (
    <div className="mt-4 border-t border-line pt-4">
      <h3 className="text-xs font-extrabold uppercase text-brand-soft">
        {t("classroom.files")}
      </h3>
      <p className="mt-1 text-xs font-semibold text-muted">{t("classroom.files_help")}</p>
      {files.length ? (
        <ul className="mt-3 space-y-2">
          {files.map((file) => {
            const kindKey = `classroom.file_${classroomFileKind(file.mimeType)}` as const;
            const roleKey =
              file.role === "teacher" ||
              file.role === "student" ||
              file.role === "parent" ||
              file.role === "staff"
                ? (`classroom.role_${file.role}` as const)
                : null;
            const canRemove = canRemoveAny || file.userId === selfId;
            return (
              <li key={file.id} className="rounded-2xl bg-background px-3 py-2">
                <p className="break-words text-sm font-extrabold text-brand">{file.name}</p>
                <p className="mt-1 text-xs font-semibold text-muted">
                  {t(kindKey)}
                  {" · "}
                  {formatClassroomFileSize(file.byteSize)}
                  {" · "}
                  {file.displayName}
                  {roleKey ? ` · ${t(roleKey)}` : ""}
                  {" · "}
                  {formatClockInTimeZone(file.createdAt, zone, locale)}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    href={file.href}
                    className="inline-flex min-h-9 items-center rounded-full bg-gold px-3 text-xs font-extrabold text-brand"
                  >
                    {t("classroom.files_download")}
                  </a>
                  {canAnnotate && onAnnotate && isClassroomBoardImageType(file.mimeType) ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => onAnnotate(file.id)}
                    >
                      {t("classroom.files_annotate")}
                    </Button>
                  ) : null}
                  {canPresent && onPresent && isClassroomPresentableType(file.mimeType) ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={presentingFileId === file.id}
                      onClick={() => onPresent(file.id)}
                    >
                      {presentingFileId === file.id
                        ? t("classroom.slides_presenting")
                        : t("classroom.slides_present")}
                    </Button>
                  ) : null}
                  {canRemove ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onRemove(file.id)}
                    >
                      {t("classroom.files_remove")}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 rounded-2xl bg-background px-3 py-3 text-sm font-semibold text-muted">
          {t("classroom.files_empty")}
        </p>
      )}
      {canShare ? (
        <form
          className="mt-3 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            const next = input.current?.files?.[0];
            if (!next || uploading) return;
            onUpload(next);
            if (input.current) input.current.value = "";
            setPicked("");
          }}
        >
          <label className="block">
            <span className="sr-only">{t("classroom.files_choose")}</span>
            <input
              ref={input}
              type="file"
              accept={classroomFileAccept()}
              className="block w-full text-sm font-semibold text-brand file:mr-3 file:min-h-11 file:rounded-full file:border-0 file:bg-gold file:px-4 file:text-xs file:font-extrabold file:text-brand"
              onChange={(event) => setPicked(event.target.files?.[0]?.name ?? "")}
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted">
              {picked ||
                t("classroom.files_limit", {
                  count: CLASSROOM_MAX_FILES,
                  size: formatClassroomFileSize(CLASSROOM_MAX_FILE_BYTES),
                })}
            </p>
            <Button type="submit" size="sm" disabled={uploading || !picked}>
              {uploading ? t("classroom.files_uploading") : t("classroom.files_share")}
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-3 text-xs font-semibold text-muted">
          {t("classroom.files_observer")}
        </p>
      )}
    </div>
  );
}
