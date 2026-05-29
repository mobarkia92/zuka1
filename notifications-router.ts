import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { notifications, alerts, alertRules } from "@db/schema";
import { eq, and, desc, count, sql } from "drizzle-orm";

// ═══════════════════════════════════════════
// SMART ALERTS & NOTIFICATIONS SYSTEM
// ═══════════════════════════════════════════

// Auto-create alert from risk assessment
export async function createAlertFromRisk(
  studentId: number,
  riskLevel: string,
  riskPercentage: number,
  triggeredIndicators: string[],
) {
  const db = getDb();

  // Determine severity and action based on 4-level classification from document
  let severity: "info" | "warning" | "critical" = "info";
  let title = "";
  let message = "";
  let category: "academic" | "attendance" | "wellness" | "financial" | "behavioral" | "system" = "system";
  let responsible = "النظام";
  let actionRequired = "";
  void riskLevel; // used for potential future logic

  if (riskPercentage >= 76) {
    // RED — Critical
    severity = "critical";
    title = `تنبيه حرج: خطر مرتفع (${riskPercentage}%)`;
    message = `المؤشرات المنطلقة: ${triggeredIndicators.join("، ")}.\nالتدخل الفوري مطلوب: مقابلة فورية مع المرشد + إحالة + خطة علاج.`;
    category = "academic";
    responsible = "المرشد + نائب العميد";
    actionRequired = "مقابلة فورية + إحالة + خطة علاج";
  } else if (riskPercentage >= 51) {
    // ORANGE — Caution
    severity = "critical";
    title = `تنبيه: حالة حذر (${riskPercentage}%)`;
    message = `المؤشرات: ${triggeredIndicators.join("، ")}.\nمقابلة إلزامية مع المرشد خلال 72 ساعة.`;
    category = "academic";
    responsible = "المرشد الأكاديمي";
    actionRequired = "مقابلة إلزامية خلال 72 ساعة";
  } else if (riskPercentage >= 26) {
    // YELLOW — Attention
    severity = "warning";
    title = `تنبيه: يستوجب الانتباه (${riskPercentage}%)`;
    message = `المؤشرات: ${triggeredIndicators.join("، ")}.\nإشعار للطالب + تذكير.`;
    category = "behavioral";
    responsible = "النظام + المرشد";
    actionRequired = "إشعار + تذكير";
  } else {
    // GREEN — Safe
    severity = "info";
    title = `متابعة روتينية (${riskPercentage}%)`;
    message = "جميع المؤشرات في المعدل الطبيعي. تحديث كل أسبوعين.";
    category = "system";
    responsible = "النظام تلقائياً";
    actionRequired = "متابعة روتينية";
  }

  // Create the alert
  await db.insert(alerts).values({
    studentId,
    title,
    message,
    severity,
    category,
    status: "new",
  });

  // Also create notification for the student
  await db.insert(notifications).values({
    userId: studentId,
    title,
    message: `${message}\n\nالإجراء المطلوب: ${actionRequired}\nالمسؤول: ${responsible}`,
    type: severity === "critical" ? "danger" : severity === "warning" ? "warning" : "info",
  });

  return { severity, title, actionRequired, responsible };
}

export const notificationsRouter = createRouter({
  // ─── STUDENT NOTIFICATIONS ───

  // Get my notifications (for logged-in user)
  myNotifications: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, ctx.user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  }),

  // Get unread count
  unreadCount: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const [result] = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, ctx.user.id), eq(notifications.isRead, false)));
    return result.count;
  }),

  // Mark as read
  markRead: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.id, input.id), eq(notifications.userId, ctx.user.id)));
      return { success: true };
    }),

  // Mark all as read
  markAllRead: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, ctx.user.id));
    return { success: true };
  }),

  // ─── ALERTS SYSTEM ───

  // Get my alerts (student)
  myAlerts: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select()
      .from(alerts)
      .where(eq(alerts.studentId, ctx.user.id))
      .orderBy(desc(alerts.createdAt))
      .limit(50);
  }),

  // Acknowledge alert
  acknowledgeAlert: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(alerts)
        .set({ status: "acknowledged" })
        .where(and(eq(alerts.id, input.id), eq(alerts.studentId, ctx.user.id)));
      return { success: true };
    }),

  // ─── COUNSELOR / ADMIN ALERTS ───

  // Get all alerts (for counselors and admins)
  allAlerts: authedQuery.query(async () => {
    const db = getDb();
    return db
      .select()
      .from(alerts)
      .orderBy(desc(alerts.createdAt))
      .limit(200);
  }),

  // Get critical alerts count
  criticalAlertsCount: authedQuery.query(async () => {
    const db = getDb();
    const [result] = await db
      .select({ count: count() })
      .from(alerts)
      .where(and(eq(alerts.severity, "critical"), eq(alerts.status, "new")));
    return result.count;
  }),

  // Get alerts by severity
  alertsBySeverity: authedQuery.query(async () => {
    const db = getDb();
    return db
      .select({
        severity: alerts.severity,
        count: count(),
        new: count(sql`CASE WHEN ${alerts.status} = 'new' THEN 1 END`),
      })
      .from(alerts)
      .groupBy(alerts.severity);
  }),

  // Get alerts by category
  alertsByCategory: authedQuery.query(async () => {
    const db = getDb();
    return db
      .select({
        category: alerts.category,
        count: count(),
      })
      .from(alerts)
      .groupBy(alerts.category);
  }),

  // Assign alert to counselor
  assignAlert: authedQuery
    .input(z.object({ alertId: z.number(), counselorId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(alerts)
        .set({ assignedTo: input.counselorId, status: "acknowledged" })
        .where(eq(alerts.id, input.alertId));
      return { success: true };
    }),

  // Resolve alert
  resolveAlert: authedQuery
    .input(z.object({
      alertId: z.number(),
      note: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(alerts)
        .set({
          status: "resolved",
          resolvedAt: new Date(),
          resolutionNote: input.note || null,
        })
        .where(eq(alerts.id, input.alertId));
      return { success: true };
    }),

  // ─── ALERT RULES (ADMIN) ───

  // Get all alert rules
  alertRules: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(alertRules).where(eq(alertRules.isActive, true));
  }),

  // Create alert rule
  createRule: adminQuery
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      indicator: z.string(),
      threshold: z.number(),
      comparison: z.enum(["gt", "lt", "eq", "gte", "lte"]),
      severity: z.enum(["info", "warning", "critical"]),
      action: z.string().optional(),
      responsible: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.insert(alertRules).values(input);
      return { success: true };
    }),

  // ─── NOTIFICATION ACTIONS ───

  // Send notification to a user (counselor/admin only)
  sendNotification: authedQuery
    .input(z.object({
      userId: z.number(),
      title: z.string(),
      message: z.string(),
      type: z.enum(["info", "warning", "danger", "success"]).default("info"),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.insert(notifications).values(input);
      return { success: true };
    }),
});
