import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users, counselingSessions, riskAssessments, notifications } from "@db/schema";
import { eq, desc, and } from "drizzle-orm";

export const counselorRouter = createRouter({
  // Get counselor profile
  profile: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const user = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
    return user[0] || null;
  }),

  // Get assigned students
  students: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    // Get students who have sessions with this counselor
    const studentIds = await db
      .selectDistinct({ studentId: counselingSessions.studentId })
      .from(counselingSessions)
      .where(eq(counselingSessions.counselorId, ctx.user.id));

    if (studentIds.length === 0) return [];

    const students = [];
    for (const { studentId } of studentIds) {
      const studentData = await db.select().from(users).where(eq(users.id, studentId)).limit(1);
      if (studentData[0]) {
        // Get latest risk
        const risk = await db
          .select()
          .from(riskAssessments)
          .where(eq(riskAssessments.studentId, studentId))
          .orderBy(desc(riskAssessments.createdAt))
          .limit(1);
        students.push({ ...studentData[0], latestRisk: risk[0] || null });
      }
    }
    return students;
  }),

  // Get all students at risk (for counselors to monitor)
  atRiskStudents: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    // Get students with high/critical risk who have sessions with this counselor
    const highRiskStudents = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        college: users.college,
        major: users.major,
        riskLevel: riskAssessments.riskLevel,
        riskPercentage: riskAssessments.riskPercentage,
        updatedAt: riskAssessments.updatedAt,
      })
      .from(riskAssessments)
      .innerJoin(users, eq(riskAssessments.studentId, users.id))
      .innerJoin(counselingSessions, eq(users.id, counselingSessions.studentId))
      .where(
        and(
          eq(counselingSessions.counselorId, ctx.user.id),
          eq(riskAssessments.riskLevel, "critical")
        )
      )
      .orderBy(desc(riskAssessments.riskPercentage));
    return highRiskStudents;
  }),

  // Get counselor's sessions
  sessions: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select({
        id: counselingSessions.id,
        studentId: counselingSessions.studentId,
        scheduledAt: counselingSessions.scheduledAt,
        status: counselingSessions.status,
        notes: counselingSessions.notes,
        type: counselingSessions.type,
        studentName: users.name,
      })
      .from(counselingSessions)
      .innerJoin(users, eq(counselingSessions.studentId, users.id))
      .where(eq(counselingSessions.counselorId, ctx.user.id))
      .orderBy(desc(counselingSessions.scheduledAt));
  }),

  // Update session notes
  updateSession: authedQuery
    .input(z.object({
      id: z.number(),
      notes: z.string().optional(),
      status: z.enum(["scheduled", "completed", "cancelled", "no_show"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.update(counselingSessions)
        .set({
          ...(input.notes && { notes: input.notes }),
          ...(input.status && { status: input.status }),
        })
        .where(and(eq(counselingSessions.id, input.id), eq(counselingSessions.counselorId, ctx.user.id)));
      return { success: true };
    }),

  // Create new session
  createSession: authedQuery
    .input(z.object({
      studentId: z.number(),
      scheduledAt: z.string(),
      type: z.enum(["academic", "personal", "career", "wellness"]).default("academic"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.insert(counselingSessions).values({
        studentId: input.studentId,
        counselorId: ctx.user.id,
        scheduledAt: new Date(input.scheduledAt),
        type: input.type,
        notes: input.notes || null,
      });
      return { success: true };
    }),

  // Send notification to student
  notifyStudent: authedQuery
    .input(z.object({
      studentId: z.number(),
      title: z.string(),
      message: z.string(),
      type: z.enum(["info", "warning", "danger", "success"]).default("info"),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.insert(notifications).values({
        userId: input.studentId,
        title: input.title,
        message: input.message,
        type: input.type,
      });
      return { success: true };
    }),
});
