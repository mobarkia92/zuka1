import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { riskAssessments } from "@db/schema";
import { eq, desc } from "drizzle-orm";

// ═══════════════════════════════════════════
// SMART PREDICTION ENGINE — 10 Golden Indicators
// Based on: مؤشرات الخطر على الطلاب في الجامعة.docx
// ═══════════════════════════════════════════

/** Weights for each golden indicator (0-100 scale impact on risk) */
const GOLDEN_WEIGHTS = {
  // Academic (35% total)
  gpaDrop: 0.15,           // #1: انخفاض المعدل التراكمي المفاجئ
  courseFailure: 0.10,     // #3: رسوب مقرر أو أكثر
  assignmentDelay: 0.06,   // #7: عدم تسليم الواجبات
  lowQuizScores: 0.04,     // درجات ضعيفة في الاختبارات القصيرة

  // Attendance & Digital (25% total)
  attendanceDrop: 0.15,    // #2: غياب متكرر (>15%)
  lmsInactivity: 0.10,     // #4: عدم الدخول لمنصة التعلم

  // Psychological & Social (20% total)
  socialIsolation: 0.06,   // #8: انعزال اجتماعي
  wellnessDrop: 0.08,      // مؤشرات الصحة النفسية
  behaviorChange: 0.06,    // #10: تغير نمط السلوك الرقمي

  // Contextual (15% total)
  financialDelay: 0.08,    // #6: تأخر في دفع الرسوم
  familyCrisis: 0.07,      // #5: وفاة أو مرض في العائلة

  // Support (5% total)
  counselorIgnore: 0.03,   // #9: صفر تفاعل مع المرشد
  alertIgnore: 0.02,       // تجاهل التنبيهات
};

// Composite Index Weights
const COMPOSITE_WEIGHTS = {
  ADI: {          // Academic Decline Index
    gpaDrop: 0.40,
    attendanceDrop: 0.30,
    assignmentDelay: 0.20,
    courseFailure: 0.10,
  },
  UDI: {          // University Disengagement Index
    lmsInactivity: 0.35,
    attendanceDrop: 0.35,
    counselorIgnore: 0.20,
    noActivities: 0.10,
  },
  HSI: {          // Holistic Stress Index
    academicStress: 0.30,  // (GPA + courses + assignments)
    financialStress: 0.25, // (fees + work)
    psychologicalStress: 0.25, // (wellness + isolation)
    socialStress: 0.20,    // (friends + clubs + conflicts)
  },
};

interface GoldenIndicators {
  gpaDrop?: number;          // نقطة انخفاض المعدل (0-4)
  courseFailure?: number;    // عدد المواد الراسبة
  assignmentDelay?: number;  // نسبة التأخير في الواجبات (0-100)
  lowQuizScores?: number;    // متوسط الاختبارات القصيرة (0-100)
  attendanceDrop?: number;   // نسبة الغياب (0-100)
  lmsInactivity?: number;    // أيام الغياب عن LMS
  socialIsolation?: number;  // مؤشر العزلة (0-100)
  wellnessDrop?: number;     // مؤشر الصحة النفسية (0-100, منخفض=خطر)
  behaviorChange?: number;   // مؤشر تغير السلوك (0-100)
  financialDelay?: number;   // أيام التأخر في الرسوم
  familyCrisis?: number;     // شدة الأزمة العائلية (0-100)
  counselorIgnore?: number;  // صفر تفاعل = 100
  alertIgnore?: number;      // عدد التنبيهات المتجاهلة
}

function calculateGoldenRisk(data: GoldenIndicators) {
  const scores: Record<string, number> = {};

  // #1: GPA Drop (15%) — normalized 0-100 where 4.0 drop = 100 risk
  scores.gpaDrop = data.gpaDrop ? Math.min(100, (data.gpaDrop / 2.0) * 100) : 0;

  // #2: Attendance Drop (15%) — >15% absence = escalating risk
  scores.attendanceDrop = data.attendanceDrop ? Math.min(100, (data.attendanceDrop / 30) * 100) : 0;

  // #3: Course Failure (10%) — each failed course adds risk
  scores.courseFailure = data.courseFailure ? Math.min(100, data.courseFailure * 30) : 0;

  // #4: LMS Inactivity (10%) — >3 days absence = risk
  scores.lmsInactivity = data.lmsInactivity ? Math.min(100, (data.lmsInactivity / 14) * 100) : 0;

  // #5: Family Crisis (7%) — binary high-impact event
  scores.familyCrisis = data.familyCrisis ? Math.min(100, data.familyCrisis) : 0;

  // #6: Financial Delay (8%) — delayed fees
  scores.financialDelay = data.financialDelay ? Math.min(100, (data.financialDelay / 30) * 100) : 0;

  // #7: Assignment Delay (6%) — <70% on-time = risk
  scores.assignmentDelay = data.assignmentDelay ? Math.min(100, data.assignmentDelay) : 0;

  // #8: Social Isolation (6%)
  scores.socialIsolation = data.socialIsolation ? Math.min(100, data.socialIsolation) : 0;

  // #9: Counselor Ignore (3%)
  scores.counselorIgnore = data.counselorIgnore ? Math.min(100, data.counselorIgnore) : 0;

  // #10: Behavior Change (6%)
  scores.behaviorChange = data.behaviorChange ? Math.min(100, data.behaviorChange) : 0;

  // Low quiz scores (4%)
  scores.lowQuizScores = data.lowQuizScores ? Math.min(100, data.lowQuizScores) : 0;

  // Alert ignore (2%)
  scores.alertIgnore = data.alertIgnore ? Math.min(100, data.alertIgnore * 20) : 0;

  // ─── Calculate Weighted Risk Score ───
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [key, weight] of Object.entries(GOLDEN_WEIGHTS)) {
    const scoreKey = key as keyof typeof scores;
    const score = scores[scoreKey] ?? 0;
    weightedSum += score * weight;
    totalWeight += weight;
  }

  const riskPercentage = Math.round((weightedSum / totalWeight) * 100);

  // ─── Calculate Composite Indices ───
  // ADI: Academic Decline Index
  const adiScore = Math.round(
    (scores.gpaDrop * COMPOSITE_WEIGHTS.ADI.gpaDrop) +
    (scores.attendanceDrop * COMPOSITE_WEIGHTS.ADI.attendanceDrop) +
    (scores.assignmentDelay * COMPOSITE_WEIGHTS.ADI.assignmentDelay) +
    (scores.courseFailure * COMPOSITE_WEIGHTS.ADI.courseFailure)
  );

  // UDI: University Disengagement Index
  const udiScore = Math.round(
    (scores.lmsInactivity * COMPOSITE_WEIGHTS.UDI.lmsInactivity) +
    (scores.attendanceDrop * COMPOSITE_WEIGHTS.UDI.attendanceDrop) +
    (scores.counselorIgnore * COMPOSITE_WEIGHTS.UDI.counselorIgnore) +
    (scores.socialIsolation * COMPOSITE_WEIGHTS.UDI.noActivities)
  );

  // HSI: Holistic Stress Index
  const academicStress = (scores.gpaDrop + scores.courseFailure + scores.assignmentDelay + scores.lowQuizScores) / 4;
  const financialStress = (scores.financialDelay + (data.financialDelay ? 50 : 0)) / 2;
  const psychologicalStress = (scores.wellnessDrop + scores.behaviorChange) / 2;
  const socialStress = (scores.socialIsolation + scores.familyCrisis) / 2;

  const hsiScore = Math.round(
    (academicStress * COMPOSITE_WEIGHTS.HSI.academicStress) +
    (financialStress * COMPOSITE_WEIGHTS.HSI.financialStress) +
    (psychologicalStress * COMPOSITE_WEIGHTS.HSI.psychologicalStress) +
    (socialStress * COMPOSITE_WEIGHTS.HSI.socialStress)
  );

  // ─── Risk Classification (4 Levels) ───
  let riskLevel: "safe" | "attention" | "caution" | "critical" = "safe";
  let riskLabel = "آمن";
  let riskColor = "green";

  if (riskPercentage >= 76) {
    riskLevel = "critical";
    riskLabel = "خطر مرتفع";
    riskColor = "red";
  } else if (riskPercentage >= 51) {
    riskLevel = "caution";
    riskLabel = "حذر";
    riskColor = "orange";
  } else if (riskPercentage >= 26) {
    riskLevel = "attention";
    riskLabel = "يستوجب الانتباه";
    riskColor = "yellow";
  }

  // ─── AI Recommendation (Arabic) ───
  const recommendations: string[] = [];
  const triggered: string[] = [];

  if (scores.gpaDrop > 30) { triggered.push("انخفاض المعدل التراكمي"); recommendations.push("انخفاض ملحوظ في المعدل — يُنصح بجلسة دعم أكاديمي فورية ومراجعة خطة التعلم"); }
  if (scores.attendanceDrop > 30) { triggered.push("غياب متكرر"); recommendations.push("نسبة غياب مرتفعة — يُنصح بمتابعة الحضور وتحديد العوائق التي تواجه الطالب"); }
  if (scores.courseFailure > 30) { triggered.push("رسوب مقرر"); recommendations.push("راسب في مقرر دراسي — يُنصح بالتسجيل في دورات صيفية للمعيدة والمراجعة المكثفة"); }
  if (scores.lmsInactivity > 30) { triggered.push("غياب عن LMS"); recommendations.push("غياب عن منصة التعلم — يُنصح بتفعيل التنبيهات التلقائية ومراقبة النشاط الرقمي"); }
  if (scores.familyCrisis > 50) { triggered.push("أزمة عائلية"); recommendations.push("أزمة شخصية/عائلية — يُنصح بإحالة للدعم النفسي والاجتماعي فوراً"); }
  if (scores.financialDelay > 30) { triggered.push("تأخر مالي"); recommendations.push("تأخر في الرسوم — يُنصح بالتواصل مع إدارة المالية لبحث الخيارات المتاحة"); }
  if (scores.assignmentDelay > 40) { triggered.push("تأخر في الواجبات"); recommendations.push("تأخر في تسليم الواجبات — يُنصح بتنظيم الوقت وجلسات الإرشاد الأكاديمي"); }
  if (scores.socialIsolation > 50) { triggered.push("انعزال اجتماعي"); recommendations.push("انعزال اجتماعي — يُنصح بتشجيع المشاركة في الأنشطة الطلابية ومجموعات الدراسة"); }
  if (scores.wellnessDrop > 50) { triggered.push("صحة نفسية متدنية"); recommendations.push("مؤشر الصحة النفسية منخفض — يُنصح بزيارة مركز الإرشاد النفسي"); }
  if (scores.counselorIgnore > 80) { triggered.push("تجاهل المرشد"); recommendations.push("عدم تفاعل مع المرشد الأكاديمي — يُنصح بمقابلة إلزامية خلال 48 ساعة"); }

  const aiRecommendation = recommendations.length > 0
    ? recommendations.join("\n\n")
    : "جميع المؤشرات في المعدل الطبيعي — استمر في الحفاظ على أدائك المتميز";

  // ─── Treatment Plan ───
  const treatmentPlan: string[] = [];
  if (riskLevel === "critical") {
    treatmentPlan.push("مقابلة فورية مع المرشد الأكاديمي خلال 24 ساعة");
    treatmentPlan.push("إشعار نائب العميد للشؤون الأكاديمية");
    treatmentPlan.push("إحالة لمركز الدعم النفسي والاجتماعي");
    treatmentPlan.push("وضع خطة علاجية مخصصة مع متابعة أسبوعية");
    treatmentPlan.push("إشعار ولي الأمر (إذا كان الطالب مسجلاً به)");
  } else if (riskLevel === "caution") {
    treatmentPlan.push("مقابلة إلزامية مع المرشد الأكاديمي خلال 72 ساعة");
    treatmentPlan.push("مراجعة خطة التعلم والمواد المسجلة");
    treatmentPlan.push("المشاركة في ورش الدعم الأكاديمي");
    treatmentPlan.push("متابعة أسبوعية لمؤشرات الخطر");
  } else if (riskLevel === "attention") {
    treatmentPlan.push("إشعار للطالب بالتذكير والمتابعة");
    treatmentPlan.push("متابعة دورية مع المرشد الأكاديمي");
    treatmentPlan.push("الاستفادة من الموارد التعليمية المتاحة");
    treatmentPlan.push("تحديث المؤشرات كل أسبوعين");
  } else {
    treatmentPlan.push("متابعة روتينية — تحديث كل أسبوعين");
    treatmentPlan.push("استمر في الأداء المتميز");
    treatmentPlan.push("مساعدة الطلاب الآخرين كمرشد أكاديمي (اختياري)");
  }

  // ─── Detection Timeline ───
  let detectionTime = "فوري";
  if (riskLevel === "attention") detectionTime = "1-2 أسابيع";

  return {
    riskLevel,
    riskLabel,
    riskColor,
    riskPercentage,
    adiScore,
    udiScore,
    hsiScore,
    triggeredIndicators: triggered,
    aiRecommendation,
    treatmentPlan: treatmentPlan.join("\n"),
    detectionTime,
    scores, // individual indicator scores for display
  };
}

export const riskRouter = createRouter({
  // Submit comprehensive risk assessment with 10 golden indicators
  assess: authedQuery
    .input(z.object({
      gpaDrop: z.number().min(0).max(4).optional(),
      courseFailure: z.number().min(0).optional(),
      assignmentDelay: z.number().min(0).max(100).optional(),
      lowQuizScores: z.number().min(0).max(100).optional(),
      attendanceDrop: z.number().min(0).max(100).optional(),
      lmsInactivity: z.number().min(0).optional(),
      socialIsolation: z.number().min(0).max(100).optional(),
      wellnessDrop: z.number().min(0).max(100).optional(),
      behaviorChange: z.number().min(0).max(100).optional(),
      financialDelay: z.number().min(0).optional(),
      familyCrisis: z.number().min(0).max(100).optional(),
      counselorIgnore: z.number().min(0).max(100).optional(),
      alertIgnore: z.number().min(0).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const result = calculateGoldenRisk(input);

      await db.insert(riskAssessments).values({
        studentId: ctx.user.id,
        gpaScore: input.gpaDrop || null,
        attendanceScore: input.attendanceDrop || null,
        assignmentScore: input.assignmentDelay || null,
        failedCoursesScore: input.courseFailure || null,
        lateSubmissionScore: input.assignmentDelay || null,
        wellnessScore: input.wellnessDrop || null,
        riskLevel: result.riskLevel === "attention" ? "medium" : result.riskLevel === "caution" ? "high" : result.riskLevel,
        riskPercentage: result.riskPercentage,
        aiRecommendation: result.aiRecommendation,
        treatmentPlan: result.treatmentPlan,
      });

      return result;
    }),

  // Quick assess — minimal indicators
  quickAssess: authedQuery
    .input(z.object({
      gpa: z.number().min(0).max(5).optional(),
      attendance: z.number().min(0).max(100).optional(),
      assignments: z.number().min(0).max(100).optional(),
      failedCourses: z.number().min(0).optional(),
      lateSubmissions: z.number().min(0).optional(),
      wellness: z.number().min(0).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Convert simple inputs to golden indicator format
      const goldenInput: GoldenIndicators = {
        gpaDrop: input.gpa ? Math.max(0, 4.0 - input.gpa) : undefined,
        attendanceDrop: input.attendance ? (100 - input.attendance) : undefined,
        assignmentDelay: input.assignments ? (100 - input.assignments) : undefined,
        courseFailure: input.failedCourses || undefined,
        wellnessDrop: input.wellness ? (100 - input.wellness) : undefined,
      };

      const result = calculateGoldenRisk(goldenInput);

      await db.insert(riskAssessments).values({
        studentId: ctx.user.id,
        gpaScore: input.gpa || null,
        attendanceScore: input.attendance || null,
        assignmentScore: input.assignments || null,
        failedCoursesScore: input.failedCourses || null,
        lateSubmissionScore: input.lateSubmissions || null,
        wellnessScore: input.wellness || null,
        riskLevel: result.riskLevel === "attention" ? "medium" : result.riskLevel === "caution" ? "high" : result.riskLevel,
        riskPercentage: result.riskPercentage,
        aiRecommendation: result.aiRecommendation,
        treatmentPlan: result.treatmentPlan,
      });

      return result;
    }),

  // Get student's risk history
  history: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select()
      .from(riskAssessments)
      .where(eq(riskAssessments.studentId, ctx.user.id))
      .orderBy(desc(riskAssessments.createdAt));
  }),

  // Get latest risk
  latest: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const results = await db
      .select()
      .from(riskAssessments)
      .where(eq(riskAssessments.studentId, ctx.user.id))
      .orderBy(desc(riskAssessments.createdAt))
      .limit(1);
    return results[0] || null;
  }),
});
