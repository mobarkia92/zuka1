import { getDb } from "../api/queries/connection";
import { courses } from "./schema";

async function seed() {
  const db = getDb();
  console.log("Seeding database...");

  const courseData = [
    { code: "CS101", name: "مقدمة في علوم الحاسب", department: "علوم حاسب", creditHours: 3 },
    { code: "CS201", name: "برمجة كائنية التوجه", department: "علوم حاسب", creditHours: 3 },
    { code: "CS301", name: "قواعد البيانات المتقدمة", department: "علوم حاسب", creditHours: 4 },
    { code: "MATH101", name: "الرياضيات 1", department: "الرياضيات", creditHours: 3 },
    { code: "MATH201", name: "الرياضيات 2", department: "الرياضيات", creditHours: 3 },
    { code: "ENG101", name: "اللغة الإنجليزية 1", department: "اللغات", creditHours: 2 },
    { code: "PHY101", name: "الفيزياء العامة", department: "الفيزياء", creditHours: 3 },
    { code: "IS201", name: "أنظمة المعلومات", department: "نظم معلومات", creditHours: 3 },
  ];

  for (const course of courseData) {
    await db.insert(courses).values(course).onDuplicateKeyUpdate({
      set: { name: course.name, department: course.department },
    });
  }
  console.log("✓ Courses seeded");
}

seed().catch(console.error);
