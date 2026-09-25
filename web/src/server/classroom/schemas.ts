import { z } from "zod";

export const joinClassroomSchema = z
  .object({
    bookingId: z.string().uuid().optional(),
    groupLessonId: z.string().uuid().optional(),
  })
  .refine((value) => Boolean(value.bookingId) !== Boolean(value.groupLessonId), {
    message: "Join with either a booking or a group lesson",
  });

export const classroomSyncSchema = z.object({
  after: z.string().trim().min(10).max(40).optional(),
});

export const classroomMessageSchema = z.object({
  body: z.string().trim().min(1).max(500),
});

export const classroomWhiteboardSchema = z.object({
  stroke: z
    .object({
      id: z.string().min(1).max(80),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      width: z.number().int().min(2).max(24),
      points: z.string().min(3).max(4000),
      kind: z
        .enum([
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
        ])
        .optional(),
      text: z.string().trim().min(1).max(80).optional(),
      dir: z.enum(["ltr", "rtl"]).optional(),
      rule: z
        .enum([
          "madd",
          "ghunnah",
          "ikhfa",
          "idgham",
          "iqlab",
          "qalqalah",
          "tafkheem",
          "silent",
        ])
        .optional(),
      fileId: z.string().uuid().optional(),
    })
    .optional(),
  pageId: z.string().min(1).max(80).optional(),
  slideId: z.string().min(1).max(80).optional(),
  clear: z.boolean().optional(),
  undo: z.boolean().optional(),
  redo: z.boolean().optional(),
  addPage: z.boolean().optional(),
  removePage: z.boolean().optional(),
  removeIds: z.array(z.string().min(1).max(80)).max(80).optional(),
  studentsCanAnnotate: z.boolean().optional(),
  followPage: z.boolean().optional(),
  annotateFileId: z.string().uuid().optional(),
  pointer: z
    .object({
      x: z.number().min(0).max(960),
      y: z.number().min(0).max(540),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      pageId: z.string().min(1).max(80).optional(),
    })
    .optional(),
});

export const classroomSignalSchema = z.object({
  type: z.enum(["offer", "answer", "ice", "hangup"]),
  toUserId: z.string().uuid(),
  payload: z.unknown(),
});

export const classroomRecordingSchema = z.object({
  action: z.enum(["start", "stop"]),
});

export const classroomRecordingRetainSchema = z.object({
  retained: z.boolean(),
});

export const classroomHeartbeatSchema = z.object({
  cameraOn: z.boolean().optional(),
  micOn: z.boolean().optional(),
  screenSharing: z.boolean().optional(),
});

export const classroomPresentationSchema = z.object({
  action: z.enum(["open", "close", "goto", "bookmark", "lock"]),
  fileId: z.string().uuid().optional(),
  slideIndex: z.number().int().min(0).max(40).optional(),
  followLocked: z.boolean().optional(),
});

export const classroomMediaControlSchema = z.object({
  targetUserId: z.string().uuid(),
  action: z.enum(["mute", "camera_off", "screen_off"]),
});
