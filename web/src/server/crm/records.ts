import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  crmAccounts,
  crmNotes,
  roles,
  supportTicketAttachments,
  supportTickets,
  users,
} from "@/db/schema";
import { classroomContainsContactDetails } from "@/lib/classroom";
import {
  CRM_STATUSES,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from "@/lib/crm";
import { isStaffRole, staffRoles } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { crmFlags } from "./scope";

const ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/csv",
]);
const MAX_ATTACHMENT_BYTES = 1_500_000;

export const createAccountSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().max(255).optional(),
  status: z.enum(CRM_STATUSES).default("lead"),
});

export const updateAccountSchema = z.object({
  status: z.enum(CRM_STATUSES),
});

export const createNoteSchema = z.object({
  body: z.string().trim().min(3).max(800),
  followUpOn: z.string().trim().max(40).optional(),
});

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3).max(160),
  body: z.string().trim().min(10).max(4000),
  category: z.enum(TICKET_CATEGORIES).default("other"),
  priority: z.enum(TICKET_PRIORITIES).default("normal"),
  attachmentName: z.string().trim().max(255).optional(),
  attachmentMime: z.string().trim().max(120).optional(),
  attachmentBase64: z.string().max(2_100_000).optional(),
});

export const updateTicketSchema = z.object({
  category: z.enum(TICKET_CATEGORIES),
  priority: z.enum(TICKET_PRIORITIES),
  status: z.enum(TICKET_STATUSES),
  ownerUserId: z.string().uuid().or(z.literal("")).optional(),
});

function assertNoContact(value: string) {
  if (classroomContainsContactDetails(value)) {
    throw new ApiError(
      422,
      "CONTACT_BLOCKED",
      "Remove telephone numbers and email addresses. Keep this inside the platform.",
    );
  }
}

function optionalEmail(value: string | undefined) {
  const email = value?.trim() ?? "";
  if (!email) return null;
  if (!z.string().email().safeParse(email).success) {
    throw new ApiError(422, "VALIDATION", "Enter a valid email or leave it blank");
  }
  return email;
}

function followUpDate(value: string | undefined) {
  const raw = value?.trim() ?? "";
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(422, "VALIDATION", "Enter a valid follow-up date");
  }
  return date;
}

function attachmentBytes(input: z.infer<typeof createTicketSchema>) {
  if (!input.attachmentBase64?.trim()) return null;
  if (!input.attachmentName || !input.attachmentMime) {
    throw new ApiError(422, "VALIDATION", "An attachment needs a name and a file type");
  }
  if (!ATTACHMENT_TYPES.has(input.attachmentMime)) {
    throw new ApiError(422, "VALIDATION", "Attach a PDF, image, or text file");
  }
  const content = Buffer.from(input.attachmentBase64, "base64");
  if (!content.length || content.length > MAX_ATTACHMENT_BYTES) {
    throw new ApiError(422, "VALIDATION", "Attachments must be under 1.5 MB");
  }
  return {
    originalName: input.attachmentName,
    mimeType: input.attachmentMime,
    content,
  };
}

export async function createCrmAccount(
  actor: ApiActor,
  input: z.infer<typeof createAccountSchema>,
  ip: string,
) {
  if (!crmFlags(actor).canCrm) {
    throw new ApiError(403, "FORBIDDEN", "You cannot manage CRM leads");
  }
  const [created] = await db
    .insert(crmAccounts)
    .values({
      name: input.name,
      email: optionalEmail(input.email),
      status: input.status,
      createdByUserId: actor.userId,
    })
    .returning({ id: crmAccounts.id, status: crmAccounts.status });
  if (!created) throw new ApiError(500, "INTERNAL", "Could not save the lead");
  await writeAuditLog({
    actor,
    action: "crm.account_created",
    entityType: "crm_account",
    entityId: created.id,
    ipAddress: ip,
    metadata: { status: created.status },
  });
  return created;
}

export async function updateCrmAccount(
  actor: ApiActor,
  id: string,
  input: z.infer<typeof updateAccountSchema>,
  ip: string,
) {
  if (!crmFlags(actor).canCrm) {
    throw new ApiError(403, "FORBIDDEN", "You cannot manage CRM leads");
  }
  const [updated] = await db
    .update(crmAccounts)
    .set({ status: input.status })
    .where(eq(crmAccounts.id, id))
    .returning({ id: crmAccounts.id, status: crmAccounts.status });
  if (!updated) throw new ApiError(404, "NOT_FOUND", "Lead not found");
  await writeAuditLog({
    actor,
    action: "crm.account_updated",
    entityType: "crm_account",
    entityId: id,
    ipAddress: ip,
    metadata: { status: input.status },
  });
  return updated;
}

export async function addCrmNote(
  actor: ApiActor,
  accountId: string,
  input: z.infer<typeof createNoteSchema>,
  ip: string,
) {
  if (!crmFlags(actor).canCrm) {
    throw new ApiError(403, "FORBIDDEN", "You cannot manage CRM leads");
  }
  assertNoContact(input.body);
  const [account] = await db
    .select({ id: crmAccounts.id })
    .from(crmAccounts)
    .where(eq(crmAccounts.id, accountId))
    .limit(1);
  if (!account) throw new ApiError(404, "NOT_FOUND", "Lead not found");
  const [created] = await db
    .insert(crmNotes)
    .values({
      accountId,
      body: input.body,
      followUpOn: followUpDate(input.followUpOn),
      createdByUserId: actor.userId,
    })
    .returning({ id: crmNotes.id });
  if (!created) throw new ApiError(500, "INTERNAL", "Could not save the note");
  await writeAuditLog({
    actor,
    action: "crm.note_added",
    entityType: "crm_account",
    entityId: accountId,
    ipAddress: ip,
    metadata: { followUp: Boolean(input.followUpOn?.trim()) },
  });
  return created;
}

export async function createSupportTicket(
  actor: ApiActor,
  input: z.infer<typeof createTicketSchema>,
  ip: string,
) {
  assertNoContact(input.subject);
  assertNoContact(input.body);
  if (input.attachmentName) assertNoContact(input.attachmentName);
  const file = attachmentBytes(input);
  const [created] = await db
    .insert(supportTickets)
    .values({
      subject: input.subject,
      body: input.body,
      category: input.category,
      priority: input.priority,
      createdByUserId: actor.userId,
    })
    .returning({ id: supportTickets.id, status: supportTickets.status });
  if (!created) throw new ApiError(500, "INTERNAL", "Could not open the ticket");
  if (file) {
    await db.insert(supportTicketAttachments).values({
      ticketId: created.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      content: file.content,
    });
  }
  await writeAuditLog({
    actor,
    action: "support.ticket_opened",
    entityType: "support_ticket",
    entityId: created.id,
    ipAddress: ip,
    metadata: { category: input.category, priority: input.priority, attachment: Boolean(file) },
  });
  return { id: created.id, status: created.status };
}

export async function updateSupportTicket(
  actor: ApiActor,
  id: string,
  input: z.infer<typeof updateTicketSchema>,
  ip: string,
) {
  if (!crmFlags(actor).canTickets) {
    throw new ApiError(403, "FORBIDDEN", "You cannot update support tickets");
  }
  const ownerUserId = input.ownerUserId?.trim() || null;
  if (ownerUserId) {
    const [owner] = await db
      .select({ key: roles.key })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, ownerUserId))
      .limit(1);
    if (!owner || !isStaffRole(owner.key)) {
      throw new ApiError(422, "VALIDATION", "Choose a staff owner");
    }
  }
  const [updated] = await db
    .update(supportTickets)
    .set({
      category: input.category,
      priority: input.priority,
      status: input.status,
      ownerUserId,
    })
    .where(eq(supportTickets.id, id))
    .returning({ id: supportTickets.id, status: supportTickets.status });
  if (!updated) throw new ApiError(404, "NOT_FOUND", "Ticket not found");
  await writeAuditLog({
    actor,
    action: "support.ticket_updated",
    entityType: "support_ticket",
    entityId: id,
    ipAddress: ip,
    metadata: { status: input.status, priority: input.priority, category: input.category },
  });
  return updated;
}

export async function listCrmWorkspace(actor: ApiActor) {
  const flags = crmFlags(actor);
  if (!flags.canCrm && !flags.canTickets) {
    throw new ApiError(403, "FORBIDDEN", "You cannot open the CRM desk");
  }
  const [accounts, notes, tickets, attachments, staff] = await Promise.all([
    flags.canCrm
      ? db
          .select({
            id: crmAccounts.id,
            name: crmAccounts.name,
            email: crmAccounts.email,
            status: crmAccounts.status,
            createdAt: crmAccounts.createdAt,
          })
          .from(crmAccounts)
          .orderBy(desc(crmAccounts.createdAt))
          .limit(80)
      : Promise.resolve([]),
    flags.canCrm
      ? db
          .select({
            id: crmNotes.id,
            accountId: crmNotes.accountId,
            body: crmNotes.body,
            followUpOn: crmNotes.followUpOn,
            createdAt: crmNotes.createdAt,
            authorName: users.displayName,
          })
          .from(crmNotes)
          .leftJoin(users, eq(crmNotes.createdByUserId, users.id))
          .orderBy(asc(crmNotes.createdAt))
          .limit(200)
      : Promise.resolve([]),
    flags.canTickets
      ? db
          .select({
            id: supportTickets.id,
            subject: supportTickets.subject,
            body: supportTickets.body,
            category: supportTickets.category,
            priority: supportTickets.priority,
            status: supportTickets.status,
            ownerUserId: supportTickets.ownerUserId,
            createdAt: supportTickets.createdAt,
            ownerName: users.displayName,
          })
          .from(supportTickets)
          .leftJoin(users, eq(supportTickets.ownerUserId, users.id))
          .orderBy(desc(supportTickets.createdAt))
          .limit(80)
      : Promise.resolve([]),
    flags.canTickets
      ? db
          .select({
            id: supportTicketAttachments.id,
            ticketId: supportTicketAttachments.ticketId,
            originalName: supportTicketAttachments.originalName,
          })
          .from(supportTicketAttachments)
          .orderBy(desc(supportTicketAttachments.createdAt))
          .limit(200)
      : Promise.resolve([]),
    flags.canTickets
      ? db
          .select({ id: users.id, name: users.displayName })
          .from(users)
          .innerJoin(roles, eq(users.roleId, roles.id))
          .where(and(eq(users.status, "active"), inArray(roles.key, [...staffRoles])))
          .orderBy(asc(users.displayName))
          .limit(80)
      : Promise.resolve([]),
  ]);

  return {
    accounts: accounts.map((account) => ({
      ...account,
      createdAt: account.createdAt.toISOString(),
      notes: notes
        .filter((note) => note.accountId === account.id)
        .map((note) => ({
          id: note.id,
          body: note.body,
          authorName: note.authorName,
          followUpOn: note.followUpOn?.toISOString() ?? null,
          createdAt: note.createdAt.toISOString(),
        })),
    })),
    tickets: tickets.map((ticket) => ({
      id: ticket.id,
      subject: ticket.subject,
      body: ticket.body,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      ownerUserId: ticket.ownerUserId,
      ownerName: ticket.ownerName,
      createdAt: ticket.createdAt.toISOString(),
      attachments: attachments
        .filter((file) => file.ticketId === ticket.id)
        .map((file) => ({ id: file.id, name: file.originalName })),
    })),
    staff,
  };
}

export async function listMyTickets(actor: ApiActor) {
  const flags = crmFlags(actor);
  const rows = await db
    .select({
      id: supportTickets.id,
      subject: supportTickets.subject,
      category: supportTickets.category,
      priority: supportTickets.priority,
      status: supportTickets.status,
      createdAt: supportTickets.createdAt,
      ownerName: users.displayName,
    })
    .from(supportTickets)
    .leftJoin(users, eq(supportTickets.ownerUserId, users.id))
    .where(flags.canTickets ? sql`true` : eq(supportTickets.createdByUserId, actor.userId))
    .orderBy(desc(supportTickets.createdAt))
    .limit(40);
  return {
    tickets: rows.map((ticket) => ({
      ...ticket,
      createdAt: ticket.createdAt.toISOString(),
    })),
  };
}

export async function readTicketAttachment(
  actor: ApiActor,
  ticketId: string,
  attachmentId: string,
) {
  const [ticket] = await db
    .select({
      createdByUserId: supportTickets.createdByUserId,
    })
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId))
    .limit(1);
  if (!ticket) throw new ApiError(404, "NOT_FOUND", "Ticket not found");
  const flags = crmFlags(actor);
  if (!flags.canTickets && ticket.createdByUserId !== actor.userId) {
    throw new ApiError(403, "FORBIDDEN", "You cannot open this attachment");
  }
  const [file] = await db
    .select({
      originalName: supportTicketAttachments.originalName,
      mimeType: supportTicketAttachments.mimeType,
      content: supportTicketAttachments.content,
    })
    .from(supportTicketAttachments)
    .where(
      and(
        eq(supportTicketAttachments.id, attachmentId),
        eq(supportTicketAttachments.ticketId, ticketId),
      ),
    )
    .limit(1);
  if (!file) throw new ApiError(404, "NOT_FOUND", "Attachment not found");
  return file;
}
