import { z } from "zod";

const hm = z
  .string()
  .trim()
  .regex(/^(([01]?\d|2[0-3]):([0-5]\d)|24:00)$/, "Use 24-hour time such as 09:30");

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date");

const optionalIsoDate = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  isoDate.optional(),
);

const nullableIsoDate = z.preprocess(
  (value) => (value === "" || value == null ? null : value),
  isoDate.nullable().optional(),
);

function repeatingAvailabilityObject<K extends "recurring" | "break">(kind: K) {
  return z
    .object({
      kind: z.literal(kind),
      weekday: z.coerce.number().int().min(0).max(6).optional(),
      weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1).max(7).optional(),
      startTime: hm,
      endTime: hm,
      startsOn: optionalIsoDate,
      endsOn: optionalIsoDate,
      weekInterval: z.coerce.number().int().min(1).max(4).optional(),
      note: z.string().trim().max(160).optional(),
    })
    .superRefine((value, ctx) => {
      if (value.weekday == null && !value.weekdays?.length) {
        ctx.addIssue({
          code: "custom",
          message: "Choose at least one weekday",
          path: ["weekdays"],
        });
      }
      if (value.startsOn && value.endsOn && value.startsOn > value.endsOn) {
        ctx.addIssue({
          code: "custom",
          message: "End date must be on or after the start date",
          path: ["endsOn"],
        });
      }
      if ((value.weekInterval ?? 1) > 1 && !value.startsOn) {
        ctx.addIssue({
          code: "custom",
          message: "Choose a start date for fortnightly schedules",
          path: ["startsOn"],
        });
      }
    });
}

export const upsertAvailabilitySchema = z.discriminatedUnion("kind", [
  repeatingAvailabilityObject("recurring"),
  repeatingAvailabilityObject("break"),
  z
    .object({
      kind: z.literal("extra"),
      localDate: isoDate,
      untilDate: optionalIsoDate,
      startTime: hm,
      endTime: hm,
      replacesRecurring: z.boolean().optional(),
      note: z.string().trim().max(160).optional(),
    })
    .superRefine((value, ctx) => {
      if (value.untilDate && value.untilDate < value.localDate) {
        ctx.addIssue({
          code: "custom",
          message: "End date must be on or after the start date",
          path: ["untilDate"],
        });
      }
    }),
  z
    .object({
      kind: z.literal("block"),
      localDate: isoDate,
      untilDate: optionalIsoDate,
      startTime: hm.optional(),
      endTime: hm.optional(),
      allDay: z.boolean().optional(),
      note: z.string().trim().max(160).optional(),
    })
    .superRefine((value, ctx) => {
      if (value.untilDate && value.untilDate < value.localDate) {
        ctx.addIssue({
          code: "custom",
          message: "End date must be on or after the start date",
          path: ["untilDate"],
        });
      }
      if (!value.allDay && (!value.startTime || !value.endTime)) {
        ctx.addIssue({
          code: "custom",
          message: "Choose a start and end time, or mark the day as all day",
          path: ["startTime"],
        });
      }
    }),
]);

export const updateAvailabilitySchema = z
  .object({
    weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1).max(7).optional(),
    startTime: hm.optional(),
    endTime: hm.optional(),
    startsOn: nullableIsoDate,
    endsOn: nullableIsoDate,
    weekInterval: z.coerce.number().int().min(1).max(4).optional(),
    localDate: nullableIsoDate,
    untilDate: nullableIsoDate,
    replacesRecurring: z.boolean().optional(),
    allDay: z.boolean().optional(),
    note: z.string().trim().max(160).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.startsOn && value.endsOn && value.startsOn > value.endsOn) {
      ctx.addIssue({
        code: "custom",
        message: "End date must be on or after the start date",
        path: ["endsOn"],
      });
    }
    if ((value.weekInterval ?? 1) > 1 && value.startsOn === null) {
      ctx.addIssue({
        code: "custom",
        message: "Choose a start date for fortnightly schedules",
        path: ["startsOn"],
      });
    }
  });

export const availabilitySettingsSchema = z
  .object({
    timezone: z.string().trim().min(3).max(64).optional(),
    minNoticeMinutes: z.preprocess(
      (value) => {
        if (value === "" || value === undefined) {
          return undefined;
        }
        if (value === null || value === "platform") {
          return null;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : value;
      },
      z.number().int().min(0).max(10080).nullable().optional(),
    ),
    minCommitmentLessons: z.preprocess(
      (value) => {
        if (value === "" || value === undefined) return undefined;
        if (value === null || value === "platform") return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : value;
      },
      z.number().int().min(1).max(12).nullable().optional(),
    ),
  })
  .superRefine((value, ctx) => {
    if (
      value.timezone == null &&
      value.minNoticeMinutes === undefined &&
      value.minCommitmentLessons === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Choose a timezone or a booking notice",
      });
    }
  });

export const listSlotsQuerySchema = z.object({
  from: z.string().trim().max(40).optional(),
  to: z.string().trim().max(40).optional(),
  durationMinutes: z.coerce.number().int().min(15).max(180).optional(),
  timeZone: z.string().trim().min(3).max(64).optional(),
});

export const teacherCalendarQuerySchema = z.object({
  from: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date")
    .optional(),
});

export const lessonCalendarQuerySchema = z.object({
  from: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date")
    .optional(),
  timeZone: z.string().trim().min(3).max(64).optional(),
});

export const createBookingSchema = z.object({
  teacherUserId: z.string().uuid(),
  studentUserId: z.string().uuid(),
  subjectSlug: z.string().trim().min(2).max(40),
  startsAt: z.string().trim().min(10).max(40),
  kind: z.enum(["trial", "lesson"]).default("lesson"),
  bookingMode: z.enum(["single", "recurring", "package"]).optional(),
  packageSize: z.coerce.number().int().min(2).max(24).optional(),
  durationMinutes: z.coerce.number().int().min(15).max(180).optional(),
  weeks: z.coerce.number().int().min(1).max(12).optional(),
  timeZone: z.string().trim().min(3).max(64).optional(),
});

export const createGroupLessonSchema = z.object({
  subjectSlug: z.string().trim().min(2).max(40),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(1000).optional(),
  level: z
    .enum(["all_levels", "beginner", "intermediate", "advanced"])
    .default("all_levels"),
  minAge: z.coerce.number().int().min(3).max(99).optional(),
  maxAge: z.coerce.number().int().min(3).max(99).optional(),
  startsAt: z.string().trim().min(10).max(40),
  startsOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar start date")
    .optional(),
  endsOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar end date")
    .optional(),
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1).max(7).optional(),
  weekInterval: z.coerce.number().int().min(1).max(4).optional(),
  durationMinutes: z.coerce.number().int().min(15).max(180),
  capacity: z.coerce.number().int().min(2).max(50),
  minStudents: z.coerce.number().int().min(2).max(50).optional(),
  priceMajor: z.coerce.number().min(0).max(100000).optional(),
  studentPriceMajor: z.coerce.number().min(0).max(100000).optional(),
  teacherPaymentMajor: z.coerce.number().min(0).max(100000).optional(),
  visibleFrom: z.string().trim().min(10).max(40).optional(),
  applicationDeadline: z.string().trim().min(10).max(40).optional(),
  weeks: z.coerce.number().int().min(1).max(12).optional(),
  timeZone: z.string().trim().min(3).max(64).optional(),
}).superRefine((value, ctx) => {
  if (
    value.minAge != null &&
    value.maxAge != null &&
    value.minAge > value.maxAge
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["maxAge"],
      message: "Maximum age must be greater than or equal to minimum age",
    });
  }
  if (value.startsOn && value.endsOn && value.endsOn < value.startsOn) {
    ctx.addIssue({
      code: "custom",
      path: ["endsOn"],
      message: "End date must be on or after the start date",
    });
  }
  if (value.minStudents != null && value.minStudents > value.capacity) {
    ctx.addIssue({
      code: "custom",
      path: ["minStudents"],
      message: "Minimum students cannot be greater than class capacity",
    });
  }
  if (value.studentPriceMajor == null && value.priceMajor == null) {
    ctx.addIssue({
      code: "custom",
      path: ["studentPriceMajor"],
      message: "Enter the student price per session",
    });
  }
  if (
    value.visibleFrom &&
    value.applicationDeadline &&
    value.applicationDeadline < value.visibleFrom
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["applicationDeadline"],
      message: "The application deadline must be on or after the visibility date",
    });
  }
});

export const groupTeachingSettingsSchema = z.object({
  offersGroupTeaching: z.boolean(),
  defaultGroupCapacity: z.coerce.number().int().min(2).max(50),
  defaultGroupMinStudents: z.coerce.number().int().min(2).max(50),
}).superRefine((value, ctx) => {
  if (value.defaultGroupMinStudents > value.defaultGroupCapacity) {
    ctx.addIssue({
      code: "custom",
      path: ["defaultGroupMinStudents"],
      message: "Minimum students cannot be greater than class capacity",
    });
  }
});

export const adminCreateGroupLessonSchema = createGroupLessonSchema.safeExtend({
  teacherUserId: z.string().uuid(),
  teacherPaymentMajor: z.coerce.number().min(0).max(100000),
});

export const createGroupClassOpportunitySchema = z.object({
  subjectSlug: z.string().trim().min(2).max(40),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(1000).optional(),
  level: z
    .enum(["all_levels", "beginner", "intermediate", "advanced"])
    .default("all_levels"),
  minAge: z.coerce.number().int().min(3).max(99).optional(),
  maxAge: z.coerce.number().int().min(3).max(99).optional(),
  startsOn: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar start date"),
  endsOn: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar end date"),
  startTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "Use a 24-hour class time"),
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1).max(7).optional(),
  weekInterval: z.coerce.number().int().min(1).max(4).optional(),
  durationMinutes: z.coerce.number().int().min(15).max(180),
  capacity: z.coerce.number().int().min(2).max(50),
  minStudents: z.coerce.number().int().min(2).max(50).optional(),
  studentPriceMajor: z.coerce.number().min(0).max(100000),
  teacherPaymentMajor: z.coerce.number().min(0).max(100000),
  currencyCode: z.string().trim().length(3),
  visibleFrom: z.string().trim().min(10).max(40).optional(),
  applicationDeadline: z.string().trim().min(10).max(40).optional(),
  timeZone: z.string().trim().min(3).max(64).optional(),
}).superRefine((value, ctx) => {
  if (
    value.minAge != null &&
    value.maxAge != null &&
    value.minAge > value.maxAge
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["maxAge"],
      message: "Maximum age must be greater than or equal to minimum age",
    });
  }
  if (value.endsOn < value.startsOn) {
    ctx.addIssue({
      code: "custom",
      path: ["endsOn"],
      message: "End date must be on or after the start date",
    });
  }
  if (value.minStudents != null && value.minStudents > value.capacity) {
    ctx.addIssue({
      code: "custom",
      path: ["minStudents"],
      message: "Minimum students cannot be greater than class capacity",
    });
  }
  if (
    value.visibleFrom &&
    value.applicationDeadline &&
    value.applicationDeadline < value.visibleFrom
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["applicationDeadline"],
      message: "The application deadline must be on or after the visibility date",
    });
  }
});

export const applyGroupClassOpportunitySchema = z.object({
  bidMajor: z.coerce.number().min(0).max(100000).optional(),
  message: z.string().trim().max(1000).optional(),
});

export const selectGroupClassTeacherSchema = z.object({
  applicationId: z.string().uuid(),
});

export const enrollGroupLessonSchema = z.object({
  studentUserId: z.string().uuid(),
});

export const cancelGroupLessonSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const completeGroupEnrollmentSchema = z.object({
  status: z.enum(["completed", "no_show"]),
  notes: z.string().trim().max(500).optional(),
});

export const createLiveCourseSchema = z.object({
  subjectSlug: z.string().trim().min(2).max(40),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(1500).optional(),
  firstStartsAt: z.string().trim().min(10).max(40),
  durationMinutes: z.coerce.number().int().min(15).max(180),
  sessionCount: z.coerce.number().int().min(2).max(24),
  capacity: z.coerce.number().int().min(2).max(50),
  priceMajor: z.coerce.number().min(0).max(100000),
  timeZone: z.string().trim().min(3).max(64).optional(),
});

export const enrollLiveCourseSchema = z.object({
  studentUserId: z.string().uuid(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const rescheduleBookingSchema = z.object({
  startsAt: z.string().trim().min(10).max(40),
  durationMinutes: z.coerce.number().int().min(15).max(180).optional(),
  reason: z.string().trim().max(500).optional(),
});

export const completeBookingSchema = z.object({
  status: z.enum(["completed", "no_show"]),
  notes: z.string().trim().max(500).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CreateGroupLessonInput = z.infer<typeof createGroupLessonSchema>;
export type GroupTeachingSettingsInput = z.infer<
  typeof groupTeachingSettingsSchema
>;
export type AdminCreateGroupLessonInput = z.infer<
  typeof adminCreateGroupLessonSchema
>;
export type CreateGroupClassOpportunityInput = z.infer<
  typeof createGroupClassOpportunitySchema
>;
export type ApplyGroupClassOpportunityInput = z.infer<
  typeof applyGroupClassOpportunitySchema
>;
export type SelectGroupClassTeacherInput = z.infer<
  typeof selectGroupClassTeacherSchema
>;
export type EnrollGroupLessonInput = z.infer<typeof enrollGroupLessonSchema>;
export type CreateLiveCourseInput = z.infer<typeof createLiveCourseSchema>;
export type EnrollLiveCourseInput = z.infer<typeof enrollLiveCourseSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type RescheduleBookingInput = z.infer<typeof rescheduleBookingSchema>;
export type UpsertAvailabilityInput = z.infer<typeof upsertAvailabilitySchema>;
export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;
