import { relations } from "drizzle-orm";
import {
  users,
  courses,
  studentCourses,
  riskAssessments,
  counselingSessions,
  notifications,
  systemLogs,
  alerts,
  interventions,
  counselorNotes,
} from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  courses: many(studentCourses),
  riskAssessments: many(riskAssessments),
  sessions: many(counselingSessions, { relationName: "studentSessions" }),
  counselorSessions: many(counselingSessions, { relationName: "counselorSessions" }),
  notifications: many(notifications),
  logs: many(systemLogs),
  receivedAlerts: many(alerts),
  interventions: many(interventions),
  notes: many(counselorNotes),
}));

export const coursesRelations = relations(courses, ({ many }) => ({
  enrollments: many(studentCourses),
}));

export const studentCoursesRelations = relations(studentCourses, ({ one }) => ({
  student: one(users, { fields: [studentCourses.studentId], references: [users.id] }),
  course: one(courses, { fields: [studentCourses.courseId], references: [courses.id] }),
}));

export const riskAssessmentsRelations = relations(riskAssessments, ({ one }) => ({
  student: one(users, { fields: [riskAssessments.studentId], references: [users.id] }),
}));

export const counselingSessionsRelations = relations(counselingSessions, ({ one }) => ({
  student: one(users, { fields: [counselingSessions.studentId], references: [users.id], relationName: "studentSessions" }),
  counselor: one(users, { fields: [counselingSessions.counselorId], references: [users.id], relationName: "counselorSessions" }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const systemLogsRelations = relations(systemLogs, ({ one }) => ({
  user: one(users, { fields: [systemLogs.userId], references: [users.id] }),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  student: one(users, { fields: [alerts.studentId], references: [users.id] }),
}));

export const interventionsRelations = relations(interventions, ({ one }) => ({
  student: one(users, { fields: [interventions.studentId], references: [users.id] }),
}));

export const counselorNotesRelations = relations(counselorNotes, ({ one }) => ({
  student: one(users, { fields: [counselorNotes.studentId], references: [users.id] }),
  counselor: one(users, { fields: [counselorNotes.counselorId], references: [users.id] }),
}));
