import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users, studentCourses, riskAssessments, courses, counselingSessions, notifications } from "@db/schema";
import { eq, and, desc } from "drizzle-orm";

export const studentRouter = createRouter({
  // Get student profile
  profile: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const user = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
    return user[0] || null;
  }),

  // Get student's courses with details
  courses: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const enrollments = await db
      .select({
        id: studentCourses.id,
        grade: studentCourses.grade,
        attendance: studentCourses.attendance,
        status: studentCourses.status,
        semester: studentCourses.semester,
        courseCode: courses.code,
        courseName: courses.name,
        creditHours: courses.creditHours,
      })
      .from(studentCourses)
      .innerJoin(courses, eq(studentCourses.courseId, courses.id))
      .where(eq(studentCourses.studentId, ctx.user.id));
    return enrollments;
  }),

  // Get student's risk assessments
  riskAssessments: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select()
      .from(riskAssessments)
      .where(eq(riskAssessments.studentId, ctx.user.id))
      .orderBy(desc(riskAssessments.createdAt))
      .limit(10);
  }),

  // Get latest risk assessment
  latestRisk: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const results = await db
      .select()
      .from(riskAssessments)
      .where(eq(riskAssessments.studentId, ctx.user.id))
      .orderBy(desc(riskAssessments.createdAt))
      .limit(1);
    return results[0] || null;
  }),

  // Get student's counseling sessions
  sessions: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select()
      .from(counselingSessions)
      .where(eq(counselingSessions.studentId, ctx.user.id))
      .orderBy(desc(counselingSessions.scheduledAt));
  }),

  // Get unread notifications
  notifications: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, ctx.user.id), eq(notifications.isRead, false)))
      .orderBy(desc(notifications.createdAt))
      .limit(20);
  }),

  // Mark notification as read
  markNotificationRead: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.id, input.id), eq(notifications.userId, ctx.user.id)));
      return { success: true };
    }),
});
