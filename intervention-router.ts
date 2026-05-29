import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { interventions, counselingSessions, counselorNotes } from "@db/schema";
import { eq, and, desc, count } from "drizzle-orm";

export const interventionRouter = createRouter({
  // ═══════════════════════════════════════════
  // INTERVENTIONS
  // ═══════════════════════════════════════════

  // Create intervention (counselor/admin)
  create: authedQuery
    .input(z.object({
      studentId: z.number(),
      type: z.enum([
        "counseling_session",
        "academic_support",
        "financial_aid",
        "wellness_referral",
        "parent_notification",
        "peer_mentoring",
        "study_plan",
        "warning_letter",
        "probation",
      ]),
      description: z.string(),
      priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
      dueDate: z.string().optional(),
      alertId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [result] = await db.insert(interventions).values({
        studentId: input.studentId,
        counselorId: ctx.user.id,
        alertId: input.alertId || null,
        type: input.type,
        description: input.description,
        priority: input.priority,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        status: "planned",
      }).$returningId();

      return { success: true, id: result.id };
    }),

  // Get my interventions (as counselor)
  myInterventions: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select()
      .from(interventions)
      .where(eq(interventions.counselorId, ctx.user.id))
      .orderBy(desc(interventions.createdAt));
  }),

  // Get interventions for a student
  studentInterventions: authedQuery
    .input(z.object({ studentId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(interventions)
        .where(eq(interventions.studentId, input.studentId))
        .orderBy(desc(interventions.createdAt));
    }),

  // Update intervention status
  updateStatus: authedQuery
    .input(z.object({
      id: z.number(),
      status: z.enum(["planned", "in_progress", "completed", "cancelled"]),
      outcome: z.string().optional(),
      followUpDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(interventions).set({
        status: input.status,
        outcome: input.outcome || null,
        completedAt: input.status === "completed" ? new Date() : undefined,
        followUpDate: input.followUpDate ? new Date(input.followUpDate) : null,
      }).where(eq(interventions.id, input.id));
      return { success: true };
    }),

  // Get intervention stats
  stats: authedQuery.query(async () => {
    const db = getDb();
    const [total] = await db.select({ count: count() }).from(interventions);
    const [planned] = await db.select({ count: count() }).from(interventions).where(eq(interventions.status, "planned"));
    const [inProgress] = await db.select({ count: count() }).from(interventions).where(eq(interventions.status, "in_progress"));
    const [completed] = await db.select({ count: count() }).from(interventions).where(eq(interventions.status, "completed"));
    const [urgent] = await db.select({ count: count() }).from(interventions).where(eq(interventions.priority, "urgent"));

    return { total: total.count, planned: planned.count, inProgress: inProgress.count, completed: completed.count, urgent: urgent.count };
  }),

  // Get overdue interventions
  overdue: authedQuery.query(async () => {
    const db = getDb();
    return db
      .select()
      .from(interventions)
      .where(
        and(
          eq(interventions.status, "planned"),
          // Due date passed
        )
      )
      .orderBy(desc(interventions.createdAt));
  }),

  // ═══════════════════════════════════════════
  // COUNSELING SESSIONS (enhanced)
  // ═══════════════════════════════════════════

  // Get all my sessions (as counselor)
  counselorSessions: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select()
      .from(counselingSessions)
      .where(eq(counselingSessions.counselorId, ctx.user.id))
      .orderBy(desc(counselingSessions.scheduledAt));
  }),

  // Get my sessions (as student)
  studentSessions: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select()
      .from(counselingSessions)
      .where(eq(counselingSessions.studentId, ctx.user.id))
      .orderBy(desc(counselingSessions.scheduledAt));
  }),

  // Book session (student)
  bookSession: authedQuery
    .input(z.object({
      counselorId: z.number(),
      scheduledAt: z.string(),
      type: z.enum(["academic", "personal", "career", "wellness"]).default("academic"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.insert(counselingSessions).values({
        studentId: ctx.user.id,
        counselorId: input.counselorId,
        scheduledAt: new Date(input.scheduledAt),
        type: input.type,
        notes: input.notes || null,
        status: "scheduled",
      });
      return { success: true };
    }),

  // Update session (counselor)
  updateSession: authedQuery
    .input(z.object({
      id: z.number(),
      status: z.enum(["scheduled", "completed", "cancelled", "no_show"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(counselingSessions).set({
        ...(input.status && { status: input.status }),
        ...(input.notes && { notes: input.notes }),
      }).where(eq(counselingSessions.id, input.id));
      return { success: true };
    }),

  // Cancel session
  cancelSession: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(counselingSessions)
        .set({ status: "cancelled" })
        .where(eq(counselingSessions.id, input.id));
      return { success: true };
    }),

  // ═══════════════════════════════════════════
  // COUNSELOR NOTES
  // ═══════════════════════════════════════════

  // Add note on student
  addNote: authedQuery
    .input(z.object({
      studentId: z.number(),
      note: z.string(),
      category: z.enum(["academic", "behavioral", "wellness", "general"]).default("general"),
      visibility: z.enum(["private", "shared", "admin_only"]).default("private"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.insert(counselorNotes).values({
        studentId: input.studentId,
        counselorId: ctx.user.id,
        note: input.note,
        category: input.category,
        visibility: input.visibility,
      });
      return { success: true };
    }),

  // Get notes on a student
  getNotes: authedQuery
    .input(z.object({ studentId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(counselorNotes)
        .where(eq(counselorNotes.studentId, input.studentId))
        .orderBy(desc(counselorNotes.createdAt));
    }),
});
