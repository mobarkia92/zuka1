import { z } from "zod";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users, courses, riskAssessments, counselingSessions, systemLogs } from "@db/schema";
import { eq, desc, count } from "drizzle-orm";

export const adminRouter = createRouter({
  // Dashboard analytics
  analytics: adminQuery.query(async () => {
    const db = getDb();

    const [totalUsers] = await db.select({ count: count() }).from(users);
    const [students] = await db.select({ count: count() }).from(users).where(eq(users.role, "student"));
    const [counselors] = await db.select({ count: count() }).from(users).where(eq(users.role, "counselor"));
    const [totalCourses] = await db.select({ count: count() }).from(courses);
    const [totalSessions] = await db.select({ count: count() }).from(counselingSessions);

    const riskDistribution = await db
      .select({
        level: riskAssessments.riskLevel,
        count: count(),
      })
      .from(riskAssessments)
      .groupBy(riskAssessments.riskLevel);

    const recentSessions = await db
      .select()
      .from(counselingSessions)
      .orderBy(desc(counselingSessions.createdAt))
      .limit(10);

    const recentRiskAssessments = await db
      .select()
      .from(riskAssessments)
      .orderBy(desc(riskAssessments.createdAt))
      .limit(10);

    return {
      totalUsers: totalUsers.count,
      students: students.count,
      counselors: counselors.count,
      totalCourses: totalCourses.count,
      totalSessions: totalSessions.count,
      riskDistribution,
      recentSessions,
      recentRiskAssessments,
    };
  }),

  // Get all users with filters
  users: adminQuery
    .input(z.object({
      role: z.enum(["student", "counselor", "admin"]).optional(),
      college: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      let query = db.select().from(users);
      if (input?.role) {
        return query.where(eq(users.role, input.role));
      }
      return query;
    }),

  // Get all risk assessments
  allRiskAssessments: adminQuery.query(async () => {
    const db = getDb();
    return db
      .select({
        id: riskAssessments.id,
        studentName: users.name,
        gpaScore: riskAssessments.gpaScore,
        attendanceScore: riskAssessments.attendanceScore,
        riskLevel: riskAssessments.riskLevel,
        riskPercentage: riskAssessments.riskPercentage,
        createdAt: riskAssessments.createdAt,
      })
      .from(riskAssessments)
      .innerJoin(users, eq(riskAssessments.studentId, users.id))
      .orderBy(desc(riskAssessments.createdAt));
  }),

  // Get all counseling sessions
  allSessions: adminQuery.query(async () => {
    const db = getDb();
    return db
      .select()
      .from(counselingSessions)
      .orderBy(desc(counselingSessions.scheduledAt));
  }),

  // Update user role
  updateUserRole: adminQuery
    .input(z.object({
      userId: z.number(),
      role: z.enum(["student", "counselor", "admin"]),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
      return { success: true };
    }),

  // System logs
  logs: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(systemLogs).orderBy(desc(systemLogs.createdAt)).limit(100);
  }),
});
