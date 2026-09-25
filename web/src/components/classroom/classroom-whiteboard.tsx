"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useI18n, useT } from "@/components/i18n/i18n-provider";
import type {
  ClassroomWhiteboardDocument,
  ClassroomWhiteboardStroke,
} from "@/db/schema/classrooms";
import type { ClassroomSharedFile } from "@/lib/classroom-files";
import { classroomFileHref } from "@/lib/classroom-files";
import type { UiMessageKey } from "@/lib/i18n";
import {
  CLASSROOM_BOARD_COLORS,
  CLASSROOM_BOARD_HEIGHT,
  CLASSROOM_BOARD_SHAPES,
  CLASSROOM_BOARD_WIDTH,
  CLASSROOM_BOARD_WIDTHS,
  CLASSROOM_MAX_BOARD_IMAGES,
  CLASSROOM_MAX_WHITEBOARD_PAGES,
  CLASSROOM_TEXT_DIR_MODES,
  canRedoWhiteboard,
  canUndoWhiteboard,
  classroomBoardImageAccept,
  classroomBoardPoint,
  classroomPageAnnotators,
  classroomStudentsCanAnnotate,
  downsampleClassroomWhiteboardPoints,
  drawClassroomWhiteboard,
  encodeClassroomWhiteboardPoints,
  isClassroomBoardImageType,
  resolveClassroomTextDirection,
  sanitizeClassroomWhiteboardText,
  strokesHitByEraser,
  whiteboardPageById,
  type ClassroomAnnotator,
  type ClassroomTextDirMode,
  type ClassroomWhiteboardInput,
  type ClassroomWhiteboardPoint,
  type ClassroomWhiteboardPointer,
  type ClassroomWhiteboardShape,
  type ClassroomWhiteboardTool,
} from "@/lib/classroom-whiteboard";
import {
  CLASSROOM_TAJWEED_RULES,
  classroomPageTajweedRules,
  classroomTajweedRule,
  type ClassroomTajweedRuleId,
} from "@/lib/classroom-tajweed";

const TOOLS: { id: ClassroomWhiteboardTool; label: UiMessageKey }[] = [
  { id: "pen", label: "classroom.board_pen" },
  { id: "highlight", label: "classroom.board_highlight" },
  { id: "eraser", label: "classroom.board_eraser" },
  { id: "shapes", label: "classroom.board_shapes" },
  { id: "text", label: "classroom.board_text" },
  { id: "image", label: "classroom.board_image" },
  { id: "pointer", label: "classroom.board_pointer" },
  { id: "tajweed", label: "classroom.tajweed" },
];

const SHAPE_LABELS: Record<ClassroomWhiteboardShape, UiMessageKey> = {
  line: "classroom.board_line",
  arrow: "classroom.board_arrow",
  rect: "classroom.board_rect",
  ellipse: "classroom.board_ellipse",
  triangle: "classroom.board_triangle",
};

const EMPTY_STROKES: ClassroomWhiteboardStroke[] = [];

const WIDTH_LABELS: Record<number, UiMessageKey> = {
  3: "classroom.board_width_thin",
  6: "classroom.board_width_medium",
  12: "classroom.board_width_thick",
};

const DIR_LABELS: Record<ClassroomTextDirMode, UiMessageKey> = {
  auto: "classroom.board_dir_auto",
  rtl: "classroom.board_dir_rtl",
  ltr: "classroom.board_dir_ltr",
};

export function ClassroomWhiteboard({
  board,
  files,
  classroomId,
  selfId,
  selfName,
  people = [],
  canDraw,
  canClear,
  locked = false,
  stayWithClass = false,
  onBrowse,
  onUpdate,
  onUploadImage,
  remotePointers = [],
  surface = "board",
  backdrop,
  stageOverlay,
  marksHidden = false,
  zoom = 1,
  onZoomWheel,
}: {
  board: ClassroomWhiteboardDocument;
  files: ClassroomSharedFile[];
  classroomId: string;
  selfId: string;
  selfName?: string;
  people?: ClassroomAnnotator[];
  canDraw: boolean;
  canClear: boolean;
  locked?: boolean;
  stayWithClass?: boolean;
  onBrowse?: () => void;
  onUpdate: (input: ClassroomWhiteboardInput) => Promise<void>;
  onUploadImage: (file: File) => Promise<ClassroomSharedFile>;
  remotePointers?: ClassroomWhiteboardPointer[];
  surface?: "board" | "slides";
  backdrop?: ReactNode;
  stageOverlay?: ReactNode;
  marksHidden?: boolean;
  zoom?: number;
  onZoomWheel?: (deltaY: number) => void;
}) {
  const t = useT();
  const { direction } = useI18n();
  const localeDir = direction === "rtl" ? "rtl" : "ltr";
  const canvas = useRef<HTMLCanvasElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const drawing = useRef<ClassroomWhiteboardPoint[] | null>(null);
  const pointerAt = useRef(0);
  const clockRef = useRef(0);
  const images = useRef(new Map<string, HTMLImageElement>());
  const [tool, setTool] = useState<ClassroomWhiteboardTool>("pen");
  const [shape, setShape] = useState<ClassroomWhiteboardShape>("line");
  const [color, setColor] = useState<string>(CLASSROOM_BOARD_COLORS[0]);
  const [width, setWidth] = useState<(typeof CLASSROOM_BOARD_WIDTHS)[number]>(6);
  const [draft, setDraft] = useState<ClassroomWhiteboardStroke | null>(null);
  const [extra, setExtra] = useState<ClassroomWhiteboardStroke[]>([]);
  const [extraPage, setExtraPage] = useState(board.pages[0]?.id ?? "page-1");
  const [hidden, setHidden] = useState<string[]>([]);
  const [textDir, setTextDir] = useState<ClassroomTextDirMode>("auto");
  const [tajweedRule, setTajweedRule] = useState<ClassroomTajweedRuleId>("madd");
  const [textDraft, setTextDraft] = useState<{
    x: number;
    y: number;
    value: string;
  } | null>(null);
  const [pendingImage, setPendingImage] = useState<ClassroomSharedFile | null>(null);
  const [pointers, setPointers] = useState<ClassroomWhiteboardPointer[]>([]);
  const [imageTick, setImageTick] = useState(0);
  const [clock, setClock] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pageId, setPageId] = useState(board.pages[0]?.id ?? "page-1");
  const [jumpLast, setJumpLast] = useState(false);
  const [followTeacher, setFollowTeacher] = useState(true);
  const [leadClass, setLeadClass] = useState(canClear);
  const studentsOpen = classroomStudentsCanAnnotate(board);

  const fallbackPageId =
    board.pages[Math.min(Math.max(pageId ? board.pages.findIndex((item) => item.id === pageId) : 0, 0), board.pages.length - 1)]
      ?.id ??
    board.pages[0]?.id ??
    "page-1";
  const followPageId =
    (surface === "slides" || followTeacher || stayWithClass) &&
    board.followPageId &&
    board.pages.some((item) => item.id === board.followPageId)
      ? board.followPageId
      : undefined;
  const activePageId = followPageId
    ? followPageId
    : jumpLast
      ? (board.pages.at(-1)?.id ?? fallbackPageId)
      : board.pages.some((item) => item.id === pageId)
        ? pageId
        : fallbackPageId;
  const page = whiteboardPageById(board, activePageId);
  const strokes = page?.strokes ?? EMPTY_STROKES;
  const annotators = classroomPageAnnotators(page, [
    { userId: selfId, displayName: selfName || "You" },
    ...people,
  ]);
  const backgroundName = page?.backgroundFileId
    ? files.find((file) => file.id === page.backgroundFileId)?.name
    : undefined;
  const pageIndex = Math.max(
    0,
    board.pages.findIndex((item) => item.id === page?.id),
  );

  const pageKey = page?.id ?? fallbackPageId;
  const localMarks = extraPage === pageKey;
  const hiddenIds = new Set(localMarks ? hidden : []);
  const knownIds = new Set(strokes.map((item) => item.id));
  const visible = [
    ...strokes.filter((item) => !hiddenIds.has(item.id)),
    ...(localMarks
      ? extra.filter((item) => !knownIds.has(item.id) && !hiddenIds.has(item.id))
      : EMPTY_STROKES),
    ...(localMarks && draft ? [draft] : EMPTY_STROKES),
  ];
  const tajweedLegend = classroomPageTajweedRules(visible);
  const livePointerMap = new Map<string, ClassroomWhiteboardPointer>();
  for (const item of [...remotePointers, ...pointers]) {
    if (item.pageId && item.pageId !== pageKey) continue;
    if (!item.at || !clock || clock - item.at < 1400) {
      livePointerMap.set(item.userId, item);
    }
  }
  const livePointers = [...livePointerMap.values()];

  useEffect(() => {
    const fileIds = [
      ...visible.map((stroke) => (stroke.kind === "image" ? stroke.fileId : undefined)),
      page?.backgroundFileId,
    ].filter((id): id is string => Boolean(id));
    for (const fileId of fileIds) {
      if (images.current.has(fileId)) continue;
      const href =
        files.find((file) => file.id === fileId)?.href ?? classroomFileHref(classroomId, fileId);
      const image = new Image();
      image.onload = () => setImageTick((value) => value + 1);
      image.src = href;
      images.current.set(fileId, image);
    }
  }, [classroomId, files, page?.backgroundFileId, visible]);

  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const ratio = window.devicePixelRatio || 1;
    node.width = Math.round(CLASSROOM_BOARD_WIDTH * ratio);
    node.height = Math.round(CLASSROOM_BOARD_HEIGHT * ratio);
    const ctx = node.getContext("2d");
    if (ctx) {
      drawClassroomWhiteboard(ctx, visible, {
        images: images.current,
        pointers: livePointers,
        background:
          surface === "slides"
            ? undefined
            : page?.backgroundFileId
              ? images.current.get(page.backgroundFileId)
              : undefined,
        transparent: surface === "slides",
      });
    }
  }, [imageTick, livePointers, page?.backgroundFileId, surface, visible]);

  useEffect(() => {
    const tick = () => {
      const value = Date.now();
      clockRef.current = value;
      setClock(value);
    };
    tick();
    const timer = window.setInterval(tick, 400);
    return () => window.clearInterval(timer);
  }, []);

  const canUndo = canDraw && canUndoWhiteboard(board, page?.id, selfId, canClear);
  const canRedo = canDraw && canRedoWhiteboard(board, page?.id, selfId, canClear);
  const imageCount = visible.filter((item) => item.kind === "image").length;

  function cursorClass() {
    if (!canDraw) return "cursor-default";
    if (tool === "text") return "cursor-text";
    if (tool === "eraser") return "cursor-cell";
    if (tool === "pointer") return "cursor-none";
    if (tool === "image") return "cursor-copy";
    return "cursor-crosshair";
  }

  function strokeKind(): ClassroomWhiteboardStroke["kind"] {
    if (tool === "eraser") return "erase";
    if (tool === "shapes") return shape;
    if (tool === "highlight") return "highlight";
    if (tool === "tajweed") return "tajweed";
    if (tool === "image") return "image";
    if (tool === "text") return "text";
    return "pen";
  }

  function strokeWidth() {
    if (tool === "eraser") return 16;
    if (tool === "highlight" || tool === "tajweed") {
      return width === 3 ? 10 : width === 12 ? 22 : 16;
    }
    return width;
  }

  function activeTajweed() {
    return classroomTajweedRule(tajweedRule) ?? CLASSROOM_TAJWEED_RULES[0];
  }

  function makeStroke(
    points: ClassroomWhiteboardPoint[],
    kind: ClassroomWhiteboardStroke["kind"] = strokeKind(),
    extraFields?: Pick<ClassroomWhiteboardStroke, "text" | "fileId" | "dir" | "rule">,
  ): ClassroomWhiteboardStroke {
    const tajweed = kind === "tajweed" ? activeTajweed() : undefined;
    return {
      id: `${selfId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      color: tajweed?.color ?? color,
      width: strokeWidth(),
      points: encodeClassroomWhiteboardPoints(
        downsampleClassroomWhiteboardPoints(points),
      ),
      kind,
      text: extraFields?.text,
      dir: extraFields?.dir,
      rule: extraFields?.rule ?? tajweed?.id,
      fileId: extraFields?.fileId,
      userId: selfId,
      displayName: selfName,
    };
  }

  function showPointer(point: ClassroomWhiteboardPoint, userId = selfId) {
    setPointers((current) => {
      const next = current.filter((item) => item.userId !== userId);
      next.push({ userId, x: point.x, y: point.y, color, at: clockRef.current || 1 });
      return next;
    });
  }

  async function commit(input: ClassroomWhiteboardInput) {
    setSaving(true);
    try {
      await onUpdate({
        ...input,
        pageId: input.pageId ?? activePageId,
        ...(surface === "slides" ? { slideId: input.pageId ?? activePageId } : {}),
      });
    } catch {
      setExtra([]);
      setHidden([]);
    } finally {
      setSaving(false);
    }
  }

  function markLocalPage() {
    setExtraPage(activePageId);
  }

  function openPage(nextId: string) {
    setFollowTeacher(false);
    onBrowse?.();
    setJumpLast(false);
    setPageId(nextId);
    setExtra([]);
    setExtraPage(nextId);
    setHidden([]);
    setDraft(null);
    drawing.current = null;
    if (canClear && leadClass) {
      void commit({ followPage: true, pageId: nextId });
    }
  }

  function startDraw(event: PointerEvent<HTMLCanvasElement>) {
    if (!canDraw || textDraft) return;
    const node = canvas.current;
    if (!node) return;
    const point = classroomBoardPoint(event, node);
    if (tool === "pointer") {
      showPointer(point);
      void sendPointer(point);
      return;
    }
    if (tool === "text") {
      setTextDraft({ x: point.x, y: point.y, value: "" });
      return;
    }
    if (tool === "image" && !pendingImage) {
      imageInput.current?.click();
      return;
    }
    node.setPointerCapture(event.pointerId);
    markLocalPage();
    drawing.current = [point];
    setDraft(
      makeStroke(
        [point, defaultImageEnd(point)],
        strokeKind(),
        pendingImage ? { fileId: pendingImage.id } : undefined,
      ),
    );
  }

  function moveDraw(event: PointerEvent<HTMLCanvasElement>) {
    if (!canvas.current) return;
    const point = classroomBoardPoint(event, canvas.current);
    if (tool === "pointer" && canDraw) {
      showPointer(point);
      if (!pointerAt.current) {
        pointerAt.current = 1;
        void sendPointer(point);
        window.setTimeout(() => {
          pointerAt.current = 0;
        }, 80);
      }
      return;
    }
    if (!drawing.current) return;
    drawing.current.push(point);
    setDraft(
      makeStroke(
        drawing.current,
        strokeKind(),
        pendingImage ? { fileId: pendingImage.id } : undefined,
      ),
    );
  }

  async function finishDraw() {
    const points = drawing.current;
    drawing.current = null;
    const current = draft;
    setDraft(null);
    if (!canDraw || !points || !current || tool === "pointer") return;
    if (tool === "eraser") {
      const removeIds = strokesHitByEraser(
        visible.filter((item) => item.id !== current.id),
        points,
        16,
      );
      if (!removeIds.length) return;
      setHidden((ids) => [...ids, ...removeIds]);
      await commit({ removeIds });
      return;
    }
    if (tool === "image") {
      if (!pendingImage) return;
      const placed = makeStroke(
        points.length < 2 ? [points[0], defaultImageEnd(points[0])] : points,
        "image",
        { fileId: pendingImage.id },
      );
      setPendingImage(null);
      setExtra((items) => [...items, placed]);
      await commit({ stroke: placed });
      return;
    }
    if (points.length < 2 && current.kind !== "text") return;
    setExtra((items) => [...items, current]);
    await commit({ stroke: current });
  }

  async function sendPointer(point: ClassroomWhiteboardPoint) {
    try {
      await onUpdate({ pointer: { x: point.x, y: point.y, color, pageId: activePageId } });
    } catch {
      // pointer is live-only
    }
  }

  async function submitText() {
    if (!textDraft) return;
    const value = sanitizeClassroomWhiteboardText(textDraft.value);
    markLocalPage();
    setTextDraft(null);
    if (!value) return;
    const stroke = makeStroke([{ x: textDraft.x, y: textDraft.y }], "text", {
      text: value,
      dir: resolveClassroomTextDirection(value, textDir, localeDir),
    });
    setExtra((items) => [...items, stroke]);
    await commit({ stroke });
  }

  async function chooseImage(file: File | undefined) {
    if (!file || !canDraw) return;
    if (!isClassroomBoardImageType(file.type)) return;
    if (imageCount >= CLASSROOM_MAX_BOARD_IMAGES) return;
    setUploading(true);
    try {
      const uploaded = await onUploadImage(file);
      setPendingImage(uploaded);
      setTool("image");
    } catch {
      setPendingImage(null);
    } finally {
      setUploading(false);
      if (imageInput.current) imageInput.current.value = "";
    }
  }

  async function undo() {
    if (!canUndo) return;
    setExtra([]);
    setHidden([]);
    await commit({ undo: true });
  }

  async function redo() {
    if (!canRedo) return;
    setExtra([]);
    setHidden([]);
    await commit({ redo: true });
  }

  async function clearBoard() {
    if (!canClear) return;
    setExtra([]);
    setHidden(strokes.map((item) => item.id));
    setPendingImage(null);
    await commit({ clear: true });
  }

  async function addPage() {
    if (!canDraw || board.pages.length >= CLASSROOM_MAX_WHITEBOARD_PAGES) return;
    setFollowTeacher(false);
    onBrowse?.();
    setJumpLast(true);
    setExtra([]);
    setHidden([]);
    await commit({ addPage: true });
  }

  async function removePage() {
    if (!canClear || board.pages.length <= 1) return;
    setExtra([]);
    setHidden([]);
    await commit({ removePage: true, pageId: activePageId });
  }

  return (
    <section
      className={
        surface === "slides"
          ? "mt-3"
          : "rounded-[1.5rem] border border-line bg-surface p-4"
      }
      tabIndex={0}
      onKeyDown={(event) => {
        if (!(event.ctrlKey || event.metaKey) || !canDraw) return;
        if (event.key === "z" && event.shiftKey) {
          event.preventDefault();
          void redo();
        } else if (event.key === "z") {
          event.preventDefault();
          void undo();
        } else if (event.key === "y") {
          event.preventDefault();
          void redo();
        }
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {surface === "slides" ? (
            <p className="text-xs font-semibold text-muted">
              {canDraw
                ? t("classroom.slides_mark_help")
                : locked
                  ? t("classroom.board_locked")
                  : t("classroom.board_observer")}
            </p>
          ) : (
            <>
              <h2 className="text-sm font-extrabold uppercase text-brand-soft">
                {t("classroom.board")}
              </h2>
              <p className="mt-1 text-xs font-semibold text-muted">
                {canDraw
                  ? t("classroom.board_help")
                  : locked
                    ? t("classroom.board_locked")
                    : t("classroom.board_observer")}
              </p>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {surface === "board" ? (
            <>
          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pageIndex <= 0}
              onClick={() => openPage(board.pages[pageIndex - 1]?.id ?? activePageId)}
            >
              {t("classroom.board_page_prev")}
            </Button>
            <p className="min-w-20 text-center text-xs font-extrabold text-brand">
              {t("classroom.board_page_of", {
                current: String(pageIndex + 1),
                total: String(board.pages.length),
              })}
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pageIndex >= board.pages.length - 1}
              onClick={() => openPage(board.pages[pageIndex + 1]?.id ?? activePageId)}
            >
              {t("classroom.board_page_next")}
            </Button>
          </div>
          {canDraw ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={saving || board.pages.length >= CLASSROOM_MAX_WHITEBOARD_PAGES}
              onClick={() => void addPage()}
            >
              {t("classroom.board_page_add")}
            </Button>
          ) : null}
          {canClear && board.pages.length > 1 ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={saving}
              onClick={() => void removePage()}
            >
              {t("classroom.board_page_remove")}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant={followTeacher || stayWithClass ? "secondary" : "ghost"}
            aria-pressed={followTeacher || stayWithClass}
            onClick={() => {
              const next = !(followTeacher || stayWithClass);
              setFollowTeacher(next);
              if (next) {
                onBrowse?.();
                setJumpLast(false);
                if (board.followPageId) setPageId(board.followPageId);
              }
            }}
          >
            {t("classroom.board_follow")}
          </Button>
          {canClear ? (
            <>
              <Button
                type="button"
                size="sm"
                variant={leadClass ? "secondary" : "ghost"}
                aria-pressed={leadClass}
                onClick={() => {
                  const next = !leadClass;
                  setLeadClass(next);
                  if (next) void commit({ followPage: true, pageId: activePageId });
                }}
              >
                {t("classroom.board_lead")}
              </Button>
            </>
          ) : null}
            </>
          ) : null}
          {canClear ? (
            <Button
              type="button"
              size="sm"
              variant={studentsOpen ? "secondary" : "ghost"}
              disabled={saving}
              onClick={() => void commit({ studentsCanAnnotate: !studentsOpen })}
            >
              {studentsOpen ? t("classroom.board_lock") : t("classroom.board_unlock")}
            </Button>
          ) : null}
          {canDraw ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!canUndo || saving}
                onClick={() => void undo()}
              >
                {t("classroom.board_undo")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!canRedo || saving}
                onClick={() => void redo()}
              >
                {t("classroom.board_redo")}
              </Button>
              {canClear ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={saving || visible.length === 0}
                  onClick={() => void clearBoard()}
                >
                  {surface === "slides" ? t("classroom.slides_clear") : t("classroom.clear_board")}
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
      {canDraw ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {TOOLS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={tool === item.id}
                className={`min-h-9 rounded-full px-3 text-xs font-extrabold ${
                  tool === item.id
                    ? "bg-brand text-white"
                    : "bg-background text-brand"
                }`}
                onClick={() => {
                  setTool(item.id);
                  if (item.id !== "pointer") {
                    setPointers((current) => current.filter((entry) => entry.userId !== selfId));
                  }
                  if (item.id === "tajweed") {
                    setColor(activeTajweed().color);
                  }
                  if (item.id === "image" && !pendingImage) {
                    imageInput.current?.click();
                  }
                }}
              >
                {t(item.label)}
              </button>
            ))}
          </div>
          {tool === "shapes" ? (
            <div className="flex flex-wrap items-center gap-2">
              {CLASSROOM_BOARD_SHAPES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={shape === value}
                  className={`min-h-9 rounded-full px-3 text-xs font-extrabold ${
                    shape === value ? "bg-gold text-brand" : "bg-background text-brand"
                  }`}
                  onClick={() => setShape(value)}
                >
                  {t(SHAPE_LABELS[value])}
                </button>
              ))}
            </div>
          ) : null}
          <input
            ref={imageInput}
            type="file"
            accept={classroomBoardImageAccept()}
            className="sr-only"
            onChange={(event) => void chooseImage(event.target.files?.[0])}
          />
          {tool === "text" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="sr-only">{t("classroom.board_dir")}</span>
              {CLASSROOM_TEXT_DIR_MODES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={textDir === value}
                  className={`min-h-9 rounded-full px-3 text-xs font-extrabold ${
                    textDir === value ? "bg-gold text-brand" : "bg-background text-brand"
                  }`}
                  onClick={() => setTextDir(value)}
                >
                  {t(DIR_LABELS[value])}
                </button>
              ))}
              <p className="text-xs font-semibold text-muted">
                {t(
                  resolveClassroomTextDirection(textDraft?.value ?? "", textDir, localeDir) ===
                    "rtl"
                    ? "classroom.board_text_rtl_help"
                    : "classroom.board_text_ltr_help",
                )}
              </p>
            </div>
          ) : null}
          {tool === "tajweed" ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted">{t("classroom.tajweed_help")}</p>
              <div className="flex flex-wrap items-center gap-2">
                {CLASSROOM_TAJWEED_RULES.map((rule) => (
                  <button
                    key={rule.id}
                    type="button"
                    aria-pressed={tajweedRule === rule.id}
                    className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-xs font-extrabold ${
                      tajweedRule === rule.id ? "bg-gold text-brand" : "bg-background text-brand"
                    }`}
                    onClick={() => {
                      setTajweedRule(rule.id);
                      setColor(rule.color);
                    }}
                  >
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: rule.color }}
                    />
                    <span dir="rtl">{rule.mark}</span>
                    <span>{t(rule.label)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {tool === "image" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={uploading || imageCount >= CLASSROOM_MAX_BOARD_IMAGES}
                onClick={() => imageInput.current?.click()}
              >
                {uploading ? t("classroom.files_uploading") : t("classroom.board_image_choose")}
              </Button>
              <p className="text-xs font-semibold text-muted">
                {pendingImage
                  ? t("classroom.board_image_place")
                  : t("classroom.board_image_help", { count: CLASSROOM_MAX_BOARD_IMAGES })}
              </p>
            </div>
          ) : null}
          {tool !== "pointer" && tool !== "image" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="sr-only">{t("classroom.board_width")}</span>
              {CLASSROOM_BOARD_WIDTHS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={t(WIDTH_LABELS[value])}
                  aria-pressed={width === value}
                  className={`min-h-9 rounded-full px-3 text-xs font-extrabold ${
                    width === value ? "bg-gold text-brand" : "bg-background text-brand"
                  }`}
                  onClick={() => setWidth(value)}
                >
                  {t(WIDTH_LABELS[value])}
                </button>
              ))}
              {tool === "tajweed"
                ? null
                : CLASSROOM_BOARD_COLORS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-label={t("classroom.ink")}
                      aria-pressed={color === value}
                      className={`h-8 w-8 rounded-full border-2 ${
                        color === value ? "border-brand" : "border-transparent"
                      }`}
                      style={{ background: value }}
                      onClick={() => setColor(value)}
                    />
                  ))}
            </div>
          ) : tool === "pointer" ? (
            <div className="flex flex-wrap items-center gap-2">
              {CLASSROOM_BOARD_COLORS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={t("classroom.ink")}
                  aria-pressed={color === value}
                  className={`h-8 w-8 rounded-full border-2 ${
                    color === value ? "border-brand" : "border-transparent"
                  }`}
                  style={{ background: value }}
                  onClick={() => setColor(value)}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <div
        className={`classroom-reader-zoom mt-3 rounded-2xl ${
          zoom > 1 ? "max-h-[min(72vh,44rem)] overflow-auto" : "overflow-hidden"
        }`}
        onWheel={(event) => {
          if (!onZoomWheel || (!event.ctrlKey && !event.metaKey)) return;
          event.preventDefault();
          onZoomWheel(event.deltaY);
        }}
      >
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            aspectRatio: `${CLASSROOM_BOARD_WIDTH} / ${CLASSROOM_BOARD_HEIGHT}`,
            width: `${Math.round(zoom * 100)}%`,
          }}
        >
        {backdrop ? (
          <div className="pointer-events-none absolute inset-0">{backdrop}</div>
        ) : null}
        <canvas
          ref={canvas}
          width={CLASSROOM_BOARD_WIDTH}
          height={CLASSROOM_BOARD_HEIGHT}
          className={`relative z-10 h-full w-full touch-none ${
            surface === "slides"
              ? "bg-transparent"
              : "rounded-2xl border border-line bg-white"
          } ${marksHidden ? "pointer-events-none opacity-0" : ""} ${cursorClass()}`}
          onPointerDown={startDraw}
          onPointerMove={moveDraw}
          onPointerUp={() => void finishDraw()}
          onPointerCancel={() => void finishDraw()}
          onPointerLeave={() => {
            if (tool === "pointer") setPointers((current) => current.filter((item) => item.userId !== selfId));
          }}
        />
        {stageOverlay ? (
          <div className="pointer-events-none absolute inset-0 z-20">{stageOverlay}</div>
        ) : null}
        {textDraft ? (
          <label className="absolute inset-0">
            <span className="sr-only">{t("classroom.board_text")}</span>
            <input
              autoFocus
              dir={resolveClassroomTextDirection(textDraft.value, textDir, localeDir)}
              lang={
                resolveClassroomTextDirection(textDraft.value, textDir, localeDir) === "rtl"
                  ? "ar"
                  : "en"
              }
              value={textDraft.value}
              placeholder={t("classroom.board_text_placeholder")}
              className="absolute min-h-10 rounded-xl border border-brand bg-white px-3 text-sm font-bold text-brand shadow-sm"
              style={textDraftStyle(textDraft, textDir, localeDir)}
              onChange={(event) =>
                setTextDraft((current) =>
                  current ? { ...current, value: event.target.value } : current,
                )
              }
              onBlur={() => void submitText()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submitText();
                }
                if (event.key === "Escape") setTextDraft(null);
              }}
            />
          </label>
        ) : null}
        </div>
      </div>
      {backgroundName && surface === "board" ? (
        <p className="mt-2 text-xs font-semibold text-muted">
          {t("classroom.board_background", { name: backgroundName })}
        </p>
      ) : null}
      <div className="mt-3">
        <p className="text-xs font-extrabold uppercase text-brand-soft">
          {t("classroom.board_annotators")}
        </p>
        {annotators.length ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {annotators.map((person) => {
              const roleKey =
                person.role === "teacher" ||
                person.role === "student" ||
                person.role === "staff"
                  ? (`classroom.role_${person.role}` as const)
                  : null;
              return (
                <li
                  key={person.userId}
                  className="rounded-full bg-background px-3 py-1 text-xs font-extrabold text-brand"
                >
                  {person.displayName}
                  {roleKey ? ` · ${t(roleKey)}` : ""}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-xs font-semibold text-muted">
            {t("classroom.board_annotators_empty")}
          </p>
        )}
      </div>
      {tajweedLegend.length ? (
        <div className="mt-3">
          <p className="text-xs font-extrabold uppercase text-brand-soft">
            {t("classroom.tajweed_legend")}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {tajweedLegend.map((rule) => (
              <li
                key={rule.id}
                className="inline-flex items-center gap-2 rounded-full bg-background px-3 py-1 text-xs font-extrabold text-brand"
              >
                <span className="h-3 w-3 rounded-full" style={{ background: rule.color }} />
                <span dir="rtl">{rule.mark}</span>
                <span>{t(rule.label)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function applyClassroomPointer(
  current: ClassroomWhiteboardPointer[],
  next: ClassroomWhiteboardPointer,
) {
  return [
    ...current.filter((item) => item.userId !== next.userId),
    { ...next, at: next.at ?? Date.now() },
  ];
}

function defaultImageEnd(point: ClassroomWhiteboardPoint): ClassroomWhiteboardPoint {
  return {
    x: Math.min(CLASSROOM_BOARD_WIDTH, point.x + 280),
    y: Math.min(CLASSROOM_BOARD_HEIGHT, point.y + 180),
  };
}

function textDraftStyle(
  draft: { x: number; y: number; value: string },
  mode: ClassroomTextDirMode,
  fallback: "ltr" | "rtl",
) {
  const rtl = resolveClassroomTextDirection(draft.value, mode, fallback) === "rtl";
  const leftPct = (draft.x / CLASSROOM_BOARD_WIDTH) * 100;
  const topPct = (draft.y / CLASSROOM_BOARD_HEIGHT) * 100;
  return {
    top: `${topPct}%`,
    left: rtl ? undefined : `${leftPct}%`,
    right: rtl ? `${100 - leftPct}%` : undefined,
    width: rtl
      ? `min(16rem, ${Math.max(20, leftPct)}%)`
      : `min(16rem, ${Math.max(20, 100 - leftPct)}%)`,
    textAlign: rtl ? ("right" as const) : ("left" as const),
    fontFamily:
      "var(--font-noto-arabic), var(--font-nunito), Tahoma, sans-serif",
  };
}
