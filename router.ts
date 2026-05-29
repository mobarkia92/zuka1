import { authRouter } from "./auth-router";
import { studentRouter } from "./student-router";
import { counselorRouter } from "./counselor-router";
import { adminRouter } from "./admin-router";
import { riskRouter } from "./risk-router";
import { notificationsRouter } from "./notifications-router";
import { interventionRouter } from "./intervention-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  student: studentRouter,
  counselor: counselorRouter,
  admin: adminRouter,
  risk: riskRouter,
  notification: notificationsRouter,
  intervention: interventionRouter,
});

export type AppRouter = typeof appRouter;
