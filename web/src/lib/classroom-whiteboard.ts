import type {
  ClassroomWhiteboardAction,
  ClassroomWhiteboardDocument,
  ClassroomWhiteboardPage,
  ClassroomWhiteboardStroke,
} from "@/db/schema/classrooms";
import { CLASSROOM_MAX_WHITEBOARD_STROKES } from "@/lib/classroom";
import { classroomTajweedRule } from "@/lib/classroom-tajweed";

export const CLASSROOM_BOARD_WIDTH = 960;
export const CLASSROOM_BOARD_HEIGHT = 540;
export const CLASSROOM_BOARD_POINT_LIMIT = 400;
export const CLASSROOM_MAX_BOARD_IMAGES = 8;
export const CLASSROOM_MAX_WHITEBOARD_PAGES = 12;
export const CLASSROOM_MAX_WHITEBOARD_HISTORY = 40;

export const CLASSROOM_BOARD_COLORS = [
  "#294634",
  "#111827",
  "#eab308",
  "#CB9F64",
  "#9a3412",
  "#1d4ed8",
  "#15803d",
  "#be123c",
] as const;

export const CLASSROOM_BOARD_WIDTHS = [3, 6, 12] as const;

export const CLASSROOM_WHITEBOARD_KINDS = [
  "pen",
  "highlight",
  "line",
  "arrow",
  "rect",
  "ellipse",
  "triangle",
  "text",
  "image",
  "erase",
  "tajweed",
] as const;

export const CLASSROOM_BOARD_SHAPES = [
  "line",
  "arrow",
  "rect",
  "ellipse",
  "triangle",
] as const;

export const CLASSROOM_BOARD_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type ClassroomWhiteboardKind =
  (typeof CLASSROOM_WHITEBOARD_KINDS)[number];

export type ClassroomWhiteboardShape = (typeof CLASSROOM_BOARD_SHAPES)[number];

export type ClassroomWhiteboardTool =
  | "pen"
  | "highlight"
  | "eraser"
  | "shapes"
  | "text"
  | "image"
  | "pointer"
  | "tajweed";

export type ClassroomWhiteboardPoint = { x: number; y: number };

export type ClassroomWhiteboardPointer = {
  userId: string;
  x: number;
  y: number;
  color: string;
  pageId?: string;
  at?: number;
};

export type ClassroomWhiteboardInput = {
  stroke?: ClassroomWhiteboardStroke;
  pageId?: string;
  slideId?: string;
  clear?: boolean;
  undo?: boolean;
  redo?: boolean;
  addPage?: boolean;
  removePage?: boolean;
  removeIds?: string[];
  studentsCanAnnotate?: boolean;
  followPage?: boolean;
  annotateFileId?: string;
  pointer?: { x: number; y: number; color?: string; pageId?: string };
};

export type ClassroomAnnotatorRole = "teacher" | "student" | "staff";

export type ClassroomAnnotator = {
  userId: string;
  displayName: string;
  role?: string;
};

const KIND_SET = new Set<string>(CLASSROOM_WHITEBOARD_KINDS);
const FILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseClassroomWhiteboardPoints(value: string): ClassroomWhiteboardPoint[] {
  return value
    .split(/\s+/)
    .map((pair) => pair.split(",").map(Number))
    .filter((pair) => pair.length === 2 && pair.every(Number.isFinite))
    .map(([x, y]) => ({
      x: clampBoard(x, CLASSROOM_BOARD_WIDTH),
      y: clampBoard(y, CLASSROOM_BOARD_HEIGHT),
    }))
    .slice(0, CLASSROOM_BOARD_POINT_LIMIT);
}

export function encodeClassroomWhiteboardPoints(points: ClassroomWhiteboardPoint[]) {
  return points
    .slice(0, CLASSROOM_BOARD_POINT_LIMIT)
    .map((point) => `${Math.round(point.x)},${Math.round(point.y)}`)
    .join(" ");
}

export function downsampleClassroomWhiteboardPoints(
  points: ClassroomWhiteboardPoint[],
  gap = 3,
) {
  if (points.length < 3) return points;
  const next: ClassroomWhiteboardPoint[] = [points[0]];
  for (const point of points.slice(1, -1)) {
    const last = next[next.length - 1];
    if (distance(last, point) >= gap) next.push(point);
  }
  next.push(points[points.length - 1]);
  return next.slice(0, CLASSROOM_BOARD_POINT_LIMIT);
}

export function classroomWhiteboardKind(
  value: string | undefined,
): ClassroomWhiteboardKind {
  return value && KIND_SET.has(value) ? (value as ClassroomWhiteboardKind) : "pen";
}

export function sanitizeClassroomWhiteboardText(value: string | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
}

export const CLASSROOM_TEXT_DIR_MODES = ["auto", "rtl", "ltr"] as const;

export type ClassroomTextDirMode = (typeof CLASSROOM_TEXT_DIR_MODES)[number];

export type ClassroomTextDirection = "ltr" | "rtl";

const RTL_SCRIPT = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFC]/;
const LTR_SCRIPT = /[A-Za-z\u00C0-\u024F]/;

export function detectClassroomTextDirection(
  text: string,
  fallback: ClassroomTextDirection = "ltr",
): ClassroomTextDirection {
  for (const char of text) {
    if (RTL_SCRIPT.test(char)) return "rtl";
    if (LTR_SCRIPT.test(char)) return "ltr";
  }
  return fallback;
}

export function resolveClassroomTextDirection(
  text: string,
  mode: ClassroomTextDirMode | undefined,
  fallback: ClassroomTextDirection = "ltr",
): ClassroomTextDirection {
  if (mode === "ltr" || mode === "rtl") return mode;
  return detectClassroomTextDirection(text, fallback);
}

export function classroomTextDirection(
  stroke: Pick<ClassroomWhiteboardStroke, "dir" | "text">,
  fallback: ClassroomTextDirection = "ltr",
): ClassroomTextDirection {
  if (stroke.dir === "ltr" || stroke.dir === "rtl") return stroke.dir;
  return detectClassroomTextDirection(stroke.text ?? "", fallback);
}

export function classroomBoardTextFont(size: number, rtl: boolean) {
  return rtl
    ? `700 ${size}px var(--font-noto-arabic), "Noto Naskh Arabic", "Segoe UI", Tahoma, sans-serif`
    : `700 ${size}px var(--font-nunito), "Segoe UI", var(--font-noto-arabic), Tahoma, sans-serif`;
}

export function classroomBoardTextBox(
  stroke: ClassroomWhiteboardStroke,
): { x: number; y: number; w: number; h: number } | null {
  const points = parseClassroomWhiteboardPoints(stroke.points);
  if (!points.length || !stroke.text) return null;
  const size = Math.max(16, stroke.width * 4);
  const width = Math.max(24, Math.min(520, stroke.text.length * size * 0.62));
  const rtl = classroomTextDirection(stroke) === "rtl";
  return {
    x: rtl ? Math.max(0, points[0].x - width) : points[0].x,
    y: points[0].y,
    w: Math.min(width, rtl ? points[0].x : CLASSROOM_BOARD_WIDTH - points[0].x),
    h: size + 8,
  };
}

export function classroomBoardImageAccept() {
  return CLASSROOM_BOARD_IMAGE_TYPES.join(",");
}

export function isClassroomBoardImageType(mime: string) {
  return (CLASSROOM_BOARD_IMAGE_TYPES as readonly string[]).includes(mime);
}

export function parseClassroomWhiteboardStroke(
  value: unknown,
): ClassroomWhiteboardStroke | null {
  if (!value || typeof value !== "object") return null;
  const item = value as {
    id?: unknown;
    color?: unknown;
    width?: unknown;
    points?: unknown;
    kind?: unknown;
    text?: unknown;
    dir?: unknown;
    rule?: unknown;
    fileId?: unknown;
    userId?: unknown;
    role?: unknown;
    displayName?: unknown;
  };
  if (
    typeof item.id !== "string" ||
    !item.id.trim() ||
    typeof item.color !== "string" ||
    !/^#[0-9a-fA-F]{6}$/.test(item.color) ||
    typeof item.width !== "number" ||
    !Number.isFinite(item.width) ||
    typeof item.points !== "string"
  ) {
    return null;
  }
  const points = encodeClassroomWhiteboardPoints(
    parseClassroomWhiteboardPoints(item.points),
  );
  if (!points) return null;
  const kind = classroomWhiteboardKind(
    typeof item.kind === "string" ? item.kind : undefined,
  );
  const text =
    kind === "text"
      ? sanitizeClassroomWhiteboardText(
          typeof item.text === "string" ? item.text : undefined,
        )
      : undefined;
  if (kind === "text" && !text) return null;
  const rule = kind === "tajweed" ? classroomTajweedRule(
    typeof item.rule === "string" ? item.rule : undefined,
  ) : undefined;
  if (kind === "tajweed" && !rule) return null;
  const fileId =
    typeof item.fileId === "string" && FILE_ID.test(item.fileId)
      ? item.fileId
      : undefined;
  if (kind === "image" && !fileId) return null;
  return {
    id: item.id.slice(0, 80),
    color: rule?.color ?? item.color,
    width: Math.min(24, Math.max(2, Math.round(item.width))),
    points,
    kind,
    text,
    dir:
      kind === "text" && (item.dir === "ltr" || item.dir === "rtl")
        ? item.dir
        : kind === "text" && text
          ? detectClassroomTextDirection(text)
          : undefined,
    rule: rule?.id,
    fileId,
    userId: typeof item.userId === "string" ? item.userId : undefined,
    role: parseClassroomAnnotatorRole(item.role),
    displayName: sanitizeClassroomAnnotatorName(
      typeof item.displayName === "string" ? item.displayName : undefined,
    ),
  };
}

export function parseClassroomAnnotatorRole(value: unknown): ClassroomAnnotatorRole | undefined {
  return value === "teacher" || value === "student" || value === "staff" ? value : undefined;
}

export function sanitizeClassroomAnnotatorName(value: string | undefined) {
  const name = (value ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  return name || undefined;
}

export function createWhiteboardPageId() {
  return `page-${Date.now().toString(36)}-${Math.floor(Math.random() * 1_000_000).toString(36)}`;
}

export function emptyWhiteboardPage(
  id = createWhiteboardPageId(),
  backgroundFileId?: string,
): ClassroomWhiteboardPage {
  return {
    id,
    strokes: [],
    undo: [],
    redo: [],
    ...(backgroundFileId ? { backgroundFileId } : {}),
  };
}

export function emptyWhiteboardDocument(): ClassroomWhiteboardDocument {
  return { pages: [emptyWhiteboardPage("page-1")], studentsCanAnnotate: true };
}

export function normalizeClassroomWhiteboard(value: unknown): ClassroomWhiteboardDocument {
  if (Array.isArray(value)) {
    if (!value.length || parseClassroomWhiteboardStroke(value[0])) {
      const strokes = value
        .map(parseClassroomWhiteboardStroke)
        .filter((item): item is ClassroomWhiteboardStroke => Boolean(item))
        .slice(-CLASSROOM_MAX_WHITEBOARD_STROKES);
      return { pages: [{ id: "page-1", strokes, undo: [], redo: [] }], studentsCanAnnotate: true };
    }
    const pages = value
      .map(parseWhiteboardPage)
      .filter((item): item is ClassroomWhiteboardPage => Boolean(item))
      .slice(0, CLASSROOM_MAX_WHITEBOARD_PAGES);
    return {
      pages: pages.length ? pages : [emptyWhiteboardPage("page-1")],
      studentsCanAnnotate: true,
    };
  }
  if (value && typeof value === "object" && "pages" in value) {
    const pages = Array.isArray((value as { pages?: unknown }).pages)
      ? (value as { pages: unknown[] }).pages
          .map(parseWhiteboardPage)
          .filter((item): item is ClassroomWhiteboardPage => Boolean(item))
          .slice(0, CLASSROOM_MAX_WHITEBOARD_PAGES)
      : [];
    return {
      pages: pages.length ? pages : [emptyWhiteboardPage("page-1")],
      ...whiteboardDocumentMeta(value),
    };
  }
  return emptyWhiteboardDocument();
}

function whiteboardDocumentMeta(value: object) {
  const item = value as { studentsCanAnnotate?: unknown; followPageId?: unknown };
  return {
    studentsCanAnnotate: item.studentsCanAnnotate !== false,
    followPageId:
      typeof item.followPageId === "string" && item.followPageId.trim()
        ? item.followPageId.slice(0, 80)
        : undefined,
  };
}

export function parseClassroomWhiteboard(value: unknown): ClassroomWhiteboardDocument | null {
  const raw =
    value && typeof value === "object" && "whiteboard" in value
      ? (value as { whiteboard?: unknown }).whiteboard
      : value;
  if (raw == null) return null;
  if (!Array.isArray(raw) && !(raw && typeof raw === "object" && "pages" in raw)) {
    return null;
  }
  return normalizeClassroomWhiteboard(raw);
}

export function parseWhiteboardPage(value: unknown): ClassroomWhiteboardPage | null {
  if (!value || typeof value !== "object") return null;
  const item = value as {
    id?: unknown;
    strokes?: unknown;
    undo?: unknown;
    redo?: unknown;
    backgroundFileId?: unknown;
  };
  const strokes = Array.isArray(item.strokes)
    ? item.strokes
        .map(parseClassroomWhiteboardStroke)
        .filter((stroke): stroke is ClassroomWhiteboardStroke => Boolean(stroke))
        .slice(-CLASSROOM_MAX_WHITEBOARD_STROKES)
    : [];
  const backgroundFileId =
    typeof item.backgroundFileId === "string" && FILE_ID.test(item.backgroundFileId)
      ? item.backgroundFileId
      : undefined;
  return {
    id: typeof item.id === "string" && item.id.trim() ? item.id.slice(0, 80) : createWhiteboardPageId(),
    strokes,
    undo: parseWhiteboardActions(item.undo),
    redo: parseWhiteboardActions(item.redo),
    ...(backgroundFileId ? { backgroundFileId } : {}),
  };
}

function parseWhiteboardActions(value: unknown): ClassroomWhiteboardAction[] {
  if (!Array.isArray(value)) return [];
  const actions: ClassroomWhiteboardAction[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const action = item as {
      type?: unknown;
      userId?: unknown;
      strokes?: unknown;
    };
    if (action.type !== "add" && action.type !== "remove" && action.type !== "clear") {
      continue;
    }
    actions.push({
      type: action.type,
      userId: typeof action.userId === "string" ? action.userId : undefined,
      strokes: Array.isArray(action.strokes)
        ? action.strokes
            .map(parseClassroomWhiteboardStroke)
            .filter((stroke): stroke is ClassroomWhiteboardStroke => Boolean(stroke))
        : [],
    });
  }
  return actions.slice(-CLASSROOM_MAX_WHITEBOARD_HISTORY);
}

export function whiteboardPageById(
  board: ClassroomWhiteboardDocument,
  pageId?: string,
) {
  return board.pages.find((page) => page.id === pageId) ?? board.pages[0];
}

export function canUndoWhiteboard(
  board: ClassroomWhiteboardDocument,
  pageId: string | undefined,
  userId: string,
  teacher: boolean,
) {
  const page = whiteboardPageById(board, pageId);
  return Boolean(page && findOwnedActionIndex(page.undo ?? [], userId, teacher) >= 0);
}

export function canRedoWhiteboard(
  board: ClassroomWhiteboardDocument,
  pageId: string | undefined,
  userId: string,
  teacher: boolean,
) {
  const page = whiteboardPageById(board, pageId);
  return Boolean(page && findOwnedActionIndex(page.redo ?? [], userId, teacher) >= 0);
}

export function addWhiteboardStroke(
  board: ClassroomWhiteboardDocument,
  pageId: string | undefined,
  stroke: ClassroomWhiteboardStroke,
  userId: string,
): ClassroomWhiteboardDocument {
  return mutatePage(board, pageId, (page) => {
    const strokes = [...page.strokes.filter((item) => item.id !== stroke.id), stroke].slice(
      -CLASSROOM_MAX_WHITEBOARD_STROKES,
    );
    return withHistory(page, { type: "add", userId, strokes: [stroke] }, strokes);
  });
}

export function removeWhiteboardStrokes(
  board: ClassroomWhiteboardDocument,
  pageId: string | undefined,
  removeIds: string[],
  userId: string,
): ClassroomWhiteboardDocument {
  return mutatePage(board, pageId, (page) => {
    const remove = new Set(removeIds);
    const removed = page.strokes.filter((item) => remove.has(item.id));
    if (!removed.length) return page;
    return withHistory(
      page,
      { type: "remove", userId, strokes: removed },
      page.strokes.filter((item) => !remove.has(item.id)),
    );
  });
}

export function clearWhiteboardPage(
  board: ClassroomWhiteboardDocument,
  pageId: string | undefined,
  userId: string,
): ClassroomWhiteboardDocument {
  return mutatePage(board, pageId, (page) =>
    withHistory(page, { type: "clear", userId, strokes: page.strokes }, []),
  );
}

export function undoWhiteboard(
  board: ClassroomWhiteboardDocument,
  pageId: string | undefined,
  userId: string,
  teacher: boolean,
): ClassroomWhiteboardDocument {
  return mutatePage(board, pageId, (page) => {
    const undo = [...(page.undo ?? [])];
    const index = findOwnedActionIndex(undo, userId, teacher);
    if (index < 0) return page;
    const [action] = undo.splice(index, 1);
    return {
      ...page,
      strokes: invertAction(page.strokes, action, true),
      undo,
      redo: [...(page.redo ?? []), action].slice(-CLASSROOM_MAX_WHITEBOARD_HISTORY),
    };
  });
}

export function redoWhiteboard(
  board: ClassroomWhiteboardDocument,
  pageId: string | undefined,
  userId: string,
  teacher: boolean,
): ClassroomWhiteboardDocument {
  return mutatePage(board, pageId, (page) => {
    const redo = [...(page.redo ?? [])];
    const index = findOwnedActionIndex(redo, userId, teacher);
    if (index < 0) return page;
    const [action] = redo.splice(index, 1);
    return {
      ...page,
      strokes: invertAction(page.strokes, action, false),
      undo: [...(page.undo ?? []), action].slice(-CLASSROOM_MAX_WHITEBOARD_HISTORY),
      redo,
    };
  });
}

export function addWhiteboardPage(
  board: ClassroomWhiteboardDocument,
  options?: { backgroundFileId?: string; share?: boolean },
): ClassroomWhiteboardDocument {
  if (board.pages.length >= CLASSROOM_MAX_WHITEBOARD_PAGES) return board;
  const page = emptyWhiteboardPage(undefined, options?.backgroundFileId);
  return {
    ...board,
    pages: [...board.pages, page],
    followPageId: options?.share ? page.id : board.followPageId,
  };
}

export function removeWhiteboardPage(
  board: ClassroomWhiteboardDocument,
  pageId: string | undefined,
): ClassroomWhiteboardDocument {
  if (board.pages.length <= 1) return board;
  const pages = board.pages.filter((page) => page.id !== (pageId ?? board.pages[0]?.id));
  const next = pages.length ? pages : [emptyWhiteboardPage("page-1")];
  return {
    ...board,
    pages: next,
    followPageId:
      board.followPageId && next.some((page) => page.id === board.followPageId)
        ? board.followPageId
        : next[0]?.id,
  };
}

export function classroomStudentsCanAnnotate(board: ClassroomWhiteboardDocument) {
  return board.studentsCanAnnotate !== false;
}

export function classroomRoleCanAnnotate(
  role: string | undefined,
  board: ClassroomWhiteboardDocument,
) {
  if (role === "parent") return false;
  if (role === "student" && !classroomStudentsCanAnnotate(board)) return false;
  return role === "teacher" || role === "student" || role === "staff";
}

export function setWhiteboardStudentsCanAnnotate(
  board: ClassroomWhiteboardDocument,
  allowed: boolean,
): ClassroomWhiteboardDocument {
  return { ...board, studentsCanAnnotate: allowed };
}

export function setWhiteboardFollowPage(
  board: ClassroomWhiteboardDocument,
  pageId: string | undefined,
): ClassroomWhiteboardDocument {
  const page = whiteboardPageById(board, pageId);
  return page ? { ...board, followPageId: page.id } : board;
}

export function annotateWhiteboardFile(
  board: ClassroomWhiteboardDocument,
  fileId: string,
  share: boolean,
): ClassroomWhiteboardDocument {
  const existing = board.pages.find((page) => page.backgroundFileId === fileId);
  if (existing) {
    return share ? { ...board, followPageId: existing.id } : board;
  }
  return addWhiteboardPage(board, { backgroundFileId: fileId, share });
}

export function classroomPageAnnotators(
  page: ClassroomWhiteboardPage | undefined,
  people: ClassroomAnnotator[],
): ClassroomAnnotator[] {
  if (!page) return [];
  const known = new Map(people.map((person) => [person.userId, person]));
  const seen = new Set<string>();
  const annotators: ClassroomAnnotator[] = [];
  for (const stroke of page.strokes) {
    if (!stroke.userId || seen.has(stroke.userId)) continue;
    seen.add(stroke.userId);
    const person = known.get(stroke.userId);
    annotators.push({
      userId: stroke.userId,
      displayName: stroke.displayName || person?.displayName || "Participant",
      role: stroke.role || person?.role,
    });
  }
  return annotators;
}

function mutatePage(
  board: ClassroomWhiteboardDocument,
  pageId: string | undefined,
  update: (page: ClassroomWhiteboardPage) => ClassroomWhiteboardPage,
): ClassroomWhiteboardDocument {
  const target = whiteboardPageById(board, pageId);
  if (!target) return board;
  return {
    ...board,
    pages: board.pages.map((page) => (page.id === target.id ? update(page) : page)),
  };
}

function withHistory(
  page: ClassroomWhiteboardPage,
  action: ClassroomWhiteboardAction,
  strokes: ClassroomWhiteboardStroke[],
): ClassroomWhiteboardPage {
  return {
    ...page,
    strokes,
    undo: [...(page.undo ?? []), action].slice(-CLASSROOM_MAX_WHITEBOARD_HISTORY),
    redo: [],
  };
}

function invertAction(
  strokes: ClassroomWhiteboardStroke[],
  action: ClassroomWhiteboardAction,
  undo: boolean,
) {
  if (action.type === "clear") {
    return undo ? [...(action.strokes ?? [])] : [];
  }
  const ids = new Set((action.strokes ?? []).map((item) => item.id));
  if ((action.type === "add" && undo) || (action.type === "remove" && !undo)) {
    return strokes.filter((item) => !ids.has(item.id));
  }
  const restored = action.strokes ?? [];
  return [...strokes.filter((item) => !ids.has(item.id)), ...restored].slice(
    -CLASSROOM_MAX_WHITEBOARD_STROKES,
  );
}

function findOwnedActionIndex(
  actions: ClassroomWhiteboardAction[],
  userId: string,
  teacher: boolean,
) {
  for (let index = actions.length - 1; index >= 0; index -= 1) {
    if (teacher || actions[index]?.userId === userId) return index;
  }
  return -1;
}

export function parseClassroomWhiteboardPointer(
  value: unknown,
): Omit<ClassroomWhiteboardPointer, "userId"> | null {
  if (!value || typeof value !== "object") return null;
  const item = value as { x?: unknown; y?: unknown; color?: unknown; pageId?: unknown };
  if (typeof item.x !== "number" || typeof item.y !== "number") return null;
  if (!Number.isFinite(item.x) || !Number.isFinite(item.y)) return null;
  return {
    x: clampBoard(item.x, CLASSROOM_BOARD_WIDTH),
    y: clampBoard(item.y, CLASSROOM_BOARD_HEIGHT),
    color:
      typeof item.color === "string" && /^#[0-9a-fA-F]{6}$/.test(item.color)
        ? item.color
        : "#be123c",
    pageId: typeof item.pageId === "string" ? item.pageId : undefined,
  };
}

export function mergeClassroomWhiteboard(
  current: ClassroomWhiteboardStroke[],
  incoming: ClassroomWhiteboardStroke[],
) {
  if (!incoming.length) return current;
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  return [...byId.values()].slice(-CLASSROOM_MAX_WHITEBOARD_STROKES);
}

export function classroomBoardPoint(
  event: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
): ClassroomWhiteboardPoint {
  const rect = canvas.getBoundingClientRect();
  const x =
    rect.width > 0
      ? ((event.clientX - rect.left) / rect.width) * CLASSROOM_BOARD_WIDTH
      : 0;
  const y =
    rect.height > 0
      ? ((event.clientY - rect.top) / rect.height) * CLASSROOM_BOARD_HEIGHT
      : 0;
  return {
    x: clampBoard(x, CLASSROOM_BOARD_WIDTH),
    y: clampBoard(y, CLASSROOM_BOARD_HEIGHT),
  };
}

export function strokesHitByEraser(
  strokes: ClassroomWhiteboardStroke[],
  eraser: ClassroomWhiteboardPoint[],
  eraserWidth: number,
) {
  const path = downsampleClassroomWhiteboardPoints(eraser, 4);
  return strokes
    .filter((stroke) => strokeHitsEraser(stroke, path, eraserWidth))
    .map((stroke) => stroke.id);
}

export function drawClassroomWhiteboard(
  ctx: CanvasRenderingContext2D,
  strokes: ClassroomWhiteboardStroke[],
  extras?: {
    images?: Map<string, CanvasImageSource>;
    pointers?: Pick<ClassroomWhiteboardPointer, "x" | "y" | "color">[];
    background?: CanvasImageSource;
    transparent?: boolean;
  },
) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const scaleX = ctx.canvas.width / CLASSROOM_BOARD_WIDTH;
  const scaleY = ctx.canvas.height / CLASSROOM_BOARD_HEIGHT;
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  if (!extras?.transparent) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CLASSROOM_BOARD_WIDTH, CLASSROOM_BOARD_HEIGHT);
  }
  if (extras?.background) {
    paintBackground(ctx, extras.background);
  }
  const highlights = strokes.filter((stroke) => {
    const kind = classroomWhiteboardKind(stroke.kind);
    return kind === "highlight" || kind === "tajweed";
  });
  const rest = strokes.filter((stroke) => {
    const kind = classroomWhiteboardKind(stroke.kind);
    return kind !== "highlight" && kind !== "tajweed";
  });
  for (const stroke of highlights) {
    paintStroke(ctx, stroke, extras?.images);
  }
  for (const stroke of rest) {
    paintStroke(ctx, stroke, extras?.images);
  }
  for (const stroke of highlights) {
    if (classroomWhiteboardKind(stroke.kind) === "tajweed") {
      paintTajweedLabel(ctx, stroke);
    }
  }
  for (const pointer of extras?.pointers ?? []) {
    paintPointer(ctx, pointer);
  }
  ctx.restore();
}

function paintStroke(
  ctx: CanvasRenderingContext2D,
  stroke: ClassroomWhiteboardStroke,
  images?: Map<string, CanvasImageSource>,
) {
  const kind = classroomWhiteboardKind(stroke.kind);
  const points = parseClassroomWhiteboardPoints(stroke.points);
  if (!points.length) return;
  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (kind === "erase") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "#000000";
    paintPen(ctx, points);
    ctx.restore();
    return;
  }
  if (kind === "highlight" || kind === "tajweed") {
    ctx.globalAlpha = kind === "tajweed" ? 0.44 : 0.38;
    ctx.globalCompositeOperation = "multiply";
    ctx.lineWidth = Math.max(10, stroke.width * 2);
    paintPen(ctx, points);
    ctx.restore();
    return;
  }
  if (kind === "text" && stroke.text) {
    const size = Math.max(16, stroke.width * 4);
    const rtl = classroomTextDirection(stroke) === "rtl";
    ctx.font = classroomBoardTextFont(size, rtl);
    ctx.direction = rtl ? "rtl" : "ltr";
    ctx.textAlign = rtl ? "right" : "left";
    ctx.textBaseline = "top";
    const maxWidth = Math.max(8, rtl ? points[0].x : CLASSROOM_BOARD_WIDTH - points[0].x);
    ctx.fillText(stroke.text, points[0].x, points[0].y, maxWidth);
    ctx.restore();
    return;
  }
  if (kind === "image") {
    paintImage(ctx, points, stroke, images);
    ctx.restore();
    return;
  }
  if (kind === "line" && points.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (kind === "arrow" && points.length >= 2) {
    paintArrow(ctx, points[0], points[points.length - 1]);
    ctx.restore();
    return;
  }
  if (kind === "rect" && points.length >= 2) {
    const box = bounds(points[0], points[points.length - 1]);
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.restore();
    return;
  }
  if (kind === "ellipse" && points.length >= 2) {
    const box = bounds(points[0], points[points.length - 1]);
    ctx.beginPath();
    ctx.ellipse(
      box.x + box.w / 2,
      box.y + box.h / 2,
      Math.max(0.5, box.w / 2),
      Math.max(0.5, box.h / 2),
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (kind === "triangle" && points.length >= 2) {
    const corners = triangleCorners(points[0], points[points.length - 1]);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    ctx.lineTo(corners[1].x, corners[1].y);
    ctx.lineTo(corners[2].x, corners[2].y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    return;
  }
  paintPen(ctx, points);
  ctx.restore();
}

function paintBackground(ctx: CanvasRenderingContext2D, image: CanvasImageSource) {
  const size = sourceSize(image);
  if (size.w < 1 || size.h < 1) return;
  const scale = Math.min(CLASSROOM_BOARD_WIDTH / size.w, CLASSROOM_BOARD_HEIGHT / size.h);
  const width = size.w * scale;
  const height = size.h * scale;
  ctx.drawImage(
    image,
    (CLASSROOM_BOARD_WIDTH - width) / 2,
    (CLASSROOM_BOARD_HEIGHT - height) / 2,
    width,
    height,
  );
}

function sourceSize(image: CanvasImageSource) {
  if ("naturalWidth" in image) {
    return { w: image.naturalWidth, h: image.naturalHeight };
  }
  if ("videoWidth" in image) {
    return { w: image.videoWidth, h: image.videoHeight };
  }
  if ("width" in image && "height" in image) {
    const width = image.width;
    const height = image.height;
    return {
      w: typeof width === "number" ? width : 0,
      h: typeof height === "number" ? height : 0,
    };
  }
  return { w: 0, h: 0 };
}

function paintImage(
  ctx: CanvasRenderingContext2D,
  points: ClassroomWhiteboardPoint[],
  stroke: ClassroomWhiteboardStroke,
  images?: Map<string, CanvasImageSource>,
) {
  const end = points[points.length - 1] ?? points[0];
  const box = bounds(points[0], end);
  const image = stroke.fileId ? images?.get(stroke.fileId) : undefined;
  if (image) {
    ctx.drawImage(image, box.x, box.y, Math.max(8, box.w), Math.max(8, box.h));
    return;
  }
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(box.x, box.y, Math.max(8, box.w), Math.max(8, box.h));
}

function paintArrow(
  ctx: CanvasRenderingContext2D,
  start: ClassroomWhiteboardPoint,
  end: ClassroomWhiteboardPoint,
) {
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const size = Math.max(10, ctx.lineWidth * 3);
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(
    end.x - Math.cos(angle - 0.45) * size,
    end.y - Math.sin(angle - 0.45) * size,
  );
  ctx.lineTo(
    end.x - Math.cos(angle + 0.45) * size,
    end.y - Math.sin(angle + 0.45) * size,
  );
  ctx.closePath();
  ctx.fill();
}

function paintTajweedLabel(ctx: CanvasRenderingContext2D, stroke: ClassroomWhiteboardStroke) {
  const rule = classroomTajweedRule(stroke.rule);
  const points = parseClassroomWhiteboardPoints(stroke.points);
  if (!rule || !points.length) return;
  const x = clampBoard(points[0].x, CLASSROOM_BOARD_WIDTH);
  const y = clampBoard(points[0].y - 18, CLASSROOM_BOARD_HEIGHT);
  ctx.save();
  ctx.font = classroomBoardTextFont(11, true);
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const width = Math.min(72, Math.max(28, ctx.measureText(rule.mark).width + 10));
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = rule.color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - 8, width, 16, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = rule.color;
  ctx.fillText(rule.mark, x, y);
  ctx.restore();
}

function paintPointer(
  ctx: CanvasRenderingContext2D,
  pointer: Pick<ClassroomWhiteboardPointer, "x" | "y" | "color">,
) {
  ctx.save();
  ctx.fillStyle = pointer.color;
  ctx.shadowColor = pointer.color;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(pointer.x, pointer.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(pointer.x, pointer.y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintPen(ctx: CanvasRenderingContext2D, points: ClassroomWhiteboardPoint[]) {
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, Math.max(0.75, ctx.lineWidth / 2), 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    ctx.quadraticCurveTo(
      current.x,
      current.y,
      (current.x + next.x) / 2,
      (current.y + next.y) / 2,
    );
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function strokeHitsEraser(
  stroke: ClassroomWhiteboardStroke,
  eraser: ClassroomWhiteboardPoint[],
  eraserWidth: number,
) {
  if (!eraser.length) return false;
  const kind = classroomWhiteboardKind(stroke.kind);
  const points = parseClassroomWhiteboardPoints(stroke.points);
  if (!points.length) return false;
  const radius = (stroke.width + eraserWidth) / 2 + 4;
  if (kind === "text" && stroke.text) {
    const box = classroomBoardTextBox(stroke);
    if (!box) return false;
    return eraser.some(
      (point) =>
        point.x >= box.x - 4 &&
        point.x <= box.x + box.w + 4 &&
        point.y >= box.y - 4 &&
        point.y <= box.y + box.h + 4,
    );
  }
  if (kind === "image") {
    const box = bounds(points[0], points[points.length - 1] ?? points[0]);
    return eraser.some(
      (point) =>
        point.x >= box.x - 4 &&
        point.x <= box.x + box.w + 4 &&
        point.y >= box.y - 4 &&
        point.y <= box.y + box.h + 4,
    );
  }
  const segments = strokeSegments(kind, points);
  const hitRadius = kind === "highlight" || kind === "tajweed" ? radius + 6 : radius;
  return eraser.some((point) =>
    segments.some((segment) => distanceToSegment(point, segment[0], segment[1]) <= hitRadius),
  );
}

function strokeSegments(
  kind: ClassroomWhiteboardKind,
  points: ClassroomWhiteboardPoint[],
): [ClassroomWhiteboardPoint, ClassroomWhiteboardPoint][] {
  if ((kind === "line" || kind === "arrow") && points.length >= 2) {
    return [[points[0], points[points.length - 1]]];
  }
  if (kind === "rect" && points.length >= 2) {
    const box = bounds(points[0], points[points.length - 1]);
    const a = { x: box.x, y: box.y };
    const b = { x: box.x + box.w, y: box.y };
    const c = { x: box.x + box.w, y: box.y + box.h };
    const d = { x: box.x, y: box.y + box.h };
    return [
      [a, b],
      [b, c],
      [c, d],
      [d, a],
    ];
  }
  if (kind === "ellipse" && points.length >= 2) {
    const box = bounds(points[0], points[points.length - 1]);
    const steps = 16;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const rx = Math.max(0.5, box.w / 2);
    const ry = Math.max(0.5, box.h / 2);
    const ring: ClassroomWhiteboardPoint[] = [];
    for (let index = 0; index <= steps; index += 1) {
      const angle = (index / steps) * Math.PI * 2;
      ring.push({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry });
    }
    return ring.slice(0, -1).map((point, index) => [point, ring[index + 1]]);
  }
  if (kind === "triangle" && points.length >= 2) {
    const corners = triangleCorners(points[0], points[points.length - 1]);
    return [
      [corners[0], corners[1]],
      [corners[1], corners[2]],
      [corners[2], corners[0]],
    ];
  }
  if (points.length === 1) {
    return [[points[0], points[0]]];
  }
  return points.slice(0, -1).map((point, index) => [point, points[index + 1]]);
}

function triangleCorners(
  start: ClassroomWhiteboardPoint,
  end: ClassroomWhiteboardPoint,
) {
  const box = bounds(start, end);
  return [
    { x: box.x + box.w / 2, y: box.y },
    { x: box.x + box.w, y: box.y + box.h },
    { x: box.x, y: box.y + box.h },
  ];
}

function bounds(start: ClassroomWhiteboardPoint, end: ClassroomWhiteboardPoint) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  return {
    x,
    y,
    w: Math.abs(end.x - start.x),
    h: Math.abs(end.y - start.y),
  };
}

function distance(left: ClassroomWhiteboardPoint, right: ClassroomWhiteboardPoint) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function distanceToSegment(
  point: ClassroomWhiteboardPoint,
  start: ClassroomWhiteboardPoint,
  end: ClassroomWhiteboardPoint,
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = dx * dx + dy * dy;
  if (length === 0) return distance(point, start);
  const amount = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length),
  );
  return distance(point, { x: start.x + dx * amount, y: start.y + dy * amount });
}

function clampBoard(value: number, max: number) {
  return Math.min(max, Math.max(0, value));
}
