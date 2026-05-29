import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  int,
  bigint,
  float,
  boolean,
} from "drizzle-orm/mysql-core";

// ─── Core Users Table ───
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["student", "counselor", "admin"]).default("student").notNull(),
  college: varchar("college", { length: 100 }),
  department: varchar("department", { length: 100 }),
  major: varchar("major", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Courses ───
export const courses = mysqlTable("courses", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  department: varchar("department", { length: 100 }),
  creditHours: int("creditHours").default(3),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Course = typeof courses.$inferSelect;

// ─── Student Courses (enrollments) ───
export const studentCourses = mysqlTable("student_courses", {
  id: serial("id").primaryKey(),
  studentId: bigint("studentId", { mode: "number", unsigned: true }).notNull(),
  courseId: bigint("courseId", { mode: "number", unsigned: true }).notNull(),
  grade: float("grade"),
  attendance: float("attendance"),
  status: mysqlEnum("status", ["active", "completed", "dropped", "failed"]).default("active").notNull(),
  semester: varchar("semester", { length: 20 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StudentCourse = typeof studentCourses.$inferSelect;

// ─── Risk Assessments ───
export const riskAssessments = mysqlTable("risk_assessments", {
  id: serial("id").primaryKey(),
  studentId: bigint("studentId", { mode: "number", unsigned: true }).notNull(),
  gpaScore: float("gpaScore"),
  attendanceScore: float("attendanceScore"),
  assignmentScore: float("assignmentScore"),
  failedCoursesScore: float("failedCoursesScore"),
  lateSubmissionScore: float("lateSubmissionScore"),
  wellnessScore: float("wellnessScore"),
  riskLevel: mysqlEnum("riskLevel", ["safe", "medium", "high", "critical"]).default("safe").notNull(),
  riskPercentage: int("riskPercentage").default(0),
  aiRecommendation: text("aiRecommendation"),
  treatmentPlan: text("treatmentPlan"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type RiskAssessment = typeof riskAssessments.$inferSelect;

// ─── Counseling Sessions ───
export const counselingSessions = mysqlTable("counseling_sessions", {
  id: serial("id").primaryKey(),
  studentId: bigint("studentId", { mode: "number", unsigned: true }).notNull(),
  counselorId: bigint("counselorId", { mode: "number", unsigned: true }).notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  status: mysqlEnum("status", ["scheduled", "completed", "cancelled", "no_show"]).default("scheduled").notNull(),
  notes: text("notes"),
  type: mysqlEnum("type", ["academic", "personal", "career", "wellness"]).default("academic").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CounselingSession = typeof counselingSessions.$inferSelect;

// ─── Notifications ───
export const notifications = mysqlTable("notifications", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: mysqlEnum("type", ["info", "warning", "danger", "success"]).default("info").notNull(),
  isRead: boolean("isRead").default(false),
  link: varchar("link", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;

// ─── System Logs ───
export const systemLogs = mysqlTable("system_logs", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }),
  action: varchar("action", { length: 100 }).notNull(),
  details: text("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SystemLog = typeof systemLogs.$inferSelect;

// ─── Alert Rules (Smart Alert Rules based on the document) ───
export const alertRules = mysqlTable("alert_rules", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  indicator: varchar("indicator", { length: 100 }).notNull(),
  threshold: float("threshold").notNull(),
  comparison: mysqlEnum("comparison", ["gt", "lt", "eq", "gte", "lte"]).default("gt").notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("info").notNull(),
  action: text("action"),
  responsible: varchar("responsible", { length: 100 }),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AlertRule = typeof alertRules.$inferSelect;

// ─── Alerts (Generated Alerts for Students) ───
export const alerts = mysqlTable("alerts", {
  id: serial("id").primaryKey(),
  studentId: bigint("studentId", { mode: "number", unsigned: true }).notNull(),
  ruleId: bigint("ruleId", { mode: "number", unsigned: true }),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("info").notNull(),
  category: mysqlEnum("category", ["academic", "attendance", "wellness", "financial", "behavioral", "system"]).default("system").notNull(),
  status: mysqlEnum("status", ["new", "acknowledged", "resolved", "ignored"]).default("new").notNull(),
  assignedTo: bigint("assignedTo", { mode: "number", unsigned: true }),
  resolvedAt: timestamp("resolvedAt"),
  resolutionNote: text("resolutionNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Alert = typeof alerts.$inferSelect;

// ─── Interventions ───
export const interventions = mysqlTable("interventions", {
  id: serial("id").primaryKey(),
  studentId: bigint("studentId", { mode: "number", unsigned: true }).notNull(),
  counselorId: bigint("counselorId", { mode: "number", unsigned: true }),
  alertId: bigint("alertId", { mode: "number", unsigned: true }),
  type: mysqlEnum("type", [
    "counseling_session",
    "academic_support",
    "financial_aid",
    "wellness_referral",
    "parent_notification",
    "peer_mentoring",
    "study_plan",
    "warning_letter",
    "probation",
  ]).default("counseling_session").notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["planned", "in_progress", "completed", "cancelled"]).default("planned").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  dueDate: timestamp("dueDate"),
  completedAt: timestamp("completedAt"),
  outcome: text("outcome"),
  followUpDate: timestamp("followUpDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Intervention = typeof interventions.$inferSelect;

// ─── Counselor Student Notes ───
export const counselorNotes = mysqlTable("counselor_notes", {
  id: serial("id").primaryKey(),
  studentId: bigint("studentId", { mode: "number", unsigned: true }).notNull(),
  counselorId: bigint("counselorId", { mode: "number", unsigned: true }).notNull(),
  note: text("note").notNull(),
  category: mysqlEnum("category", ["academic", "behavioral", "wellness", "general"]).default("general").notNull(),
  visibility: mysqlEnum("visibility", ["private", "shared", "admin_only"]).default("private").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
