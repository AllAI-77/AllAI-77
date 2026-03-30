/**
 * Universal Assessment Pro — Database Seed
 * Run: npx tsx prisma/seed.ts
 */

import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding Universal Assessment Pro database...\n");

  // ─── Departments ───────────────────────────────────────────────────────────
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { code: "RETAIL" },
      update: {},
      create: { name: "Retail Banking", code: "RETAIL" },
    }),
    prisma.department.upsert({
      where: { code: "CORP" },
      update: {},
      create: { name: "Corporate Banking", code: "CORP" },
    }),
    prisma.department.upsert({
      where: { code: "OPS" },
      update: {},
      create: { name: "Operations", code: "OPS" },
    }),
    prisma.department.upsert({
      where: { code: "COMPLIANCE" },
      update: {},
      create: { name: "Compliance & Legal", code: "COMPLIANCE" },
    }),
    prisma.department.upsert({
      where: { code: "IT" },
      update: {},
      create: { name: "Information Technology", code: "IT" },
    }),
  ]);
  console.log(`✅ Created ${departments.length} departments`);

  // ─── Branches ──────────────────────────────────────────────────────────────
  const branches = await Promise.all([
    prisma.branch.upsert({
      where: { code: "HQ-TSH" },
      update: {},
      create: {
        name: "Tashkent Head Office",
        code: "HQ-TSH",
        region: "Tashkent",
        ipWhitelist: [],
      },
    }),
    prisma.branch.upsert({
      where: { code: "BR-SAM" },
      update: {},
      create: {
        name: "Samarkand Branch",
        code: "BR-SAM",
        region: "Samarkand",
        ipWhitelist: [],
      },
    }),
    prisma.branch.upsert({
      where: { code: "BR-BUK" },
      update: {},
      create: {
        name: "Bukhara Branch",
        code: "BR-BUK",
        region: "Bukhara",
        ipWhitelist: [],
      },
    }),
  ]);
  console.log(`✅ Created ${branches.length} branches`);

  // ─── Categories ────────────────────────────────────────────────────────────
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: "credit" },
      update: {},
      create: {
        name: "Credit Operations",
        slug: "credit",
        description: "Loan products, credit analysis, risk assessment",
        color: "#003DA5",
        icon: "credit-card",
      },
    }),
    prisma.category.upsert({
      where: { slug: "operations" },
      update: {},
      create: {
        name: "Banking Operations",
        slug: "operations",
        description: "Day-to-day banking procedures, transactions, and processes",
        color: "#1976D2",
        icon: "building-2",
      },
    }),
    prisma.category.upsert({
      where: { slug: "accounting" },
      update: {},
      create: {
        name: "Accounting & Reporting",
        slug: "accounting",
        description:
          "Financial accounting, IFRS standards, reporting requirements",
        color: "#388E3C",
        icon: "calculator",
      },
    }),
    prisma.category.upsert({
      where: { slug: "compliance" },
      update: {},
      create: {
        name: "Compliance & AML",
        slug: "compliance",
        description:
          "CBU regulations, AML/KYC procedures, legal requirements",
        color: "#C8A951",
        icon: "shield-check",
      },
    }),
    prisma.category.upsert({
      where: { slug: "it-security" },
      update: {},
      create: {
        name: "IT Security",
        slug: "it-security",
        description: "Cybersecurity, data protection, incident response",
        color: "#D32F2F",
        icon: "lock",
      },
    }),
  ]);
  console.log(`✅ Created ${categories.length} categories`);

  // ─── Knowledge Sources ─────────────────────────────────────────────────────
  await Promise.all([
    prisma.knowledgeSource.upsert({
      where: { id: "ks-cbu-main" },
      update: {},
      create: {
        id: "ks-cbu-main",
        url: "https://cbu.uz/uz/legislation/",
        title: "Central Bank of Uzbekistan — Legislation",
        sourceType: "CBU_GUIDELINES",
        isActive: true,
      },
    }),
    prisma.knowledgeSource.upsert({
      where: { id: "ks-ubank-main" },
      update: {},
      create: {
        id: "ks-ubank-main",
        url: "https://universalbank.uz",
        title: "ATB Universalbank — Official Website",
        sourceType: "BANK_WEBSITE",
        isActive: true,
      },
    }),
  ]);
  console.log("✅ Created 2 knowledge sources");

  // ─── Users ─────────────────────────────────────────────────────────────────
  const adminPasswordHash = await bcrypt.hash("Admin123!", 12);
  const employeePasswordHash = await bcrypt.hash("Employee123!", 12);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@universalbank.uz" },
    update: {},
    create: {
      email: "admin@universalbank.uz",
      name: "System Administrator",
      role: Role.SUPER_ADMIN,
      passwordHash: adminPasswordHash,
      isActive: true,
      branchId: branches[0].id,
      departmentId: departments[4].id, // IT
    },
  });
  console.log(`✅ Created admin user: ${adminUser.email}`);

  const hrUser = await prisma.user.upsert({
    where: { email: "hr@universalbank.uz" },
    update: {},
    create: {
      email: "hr@universalbank.uz",
      name: "HR Manager",
      role: Role.HR_MANAGER,
      passwordHash: adminPasswordHash,
      isActive: true,
      branchId: branches[0].id,
      departmentId: departments[0].id, // Retail
    },
  });
  console.log(`✅ Created HR manager: ${hrUser.email}`);

  const employeeUser = await prisma.user.upsert({
    where: { email: "employee@universalbank.uz" },
    update: {},
    create: {
      email: "employee@universalbank.uz",
      name: "Sample Employee",
      role: Role.EMPLOYEE,
      passwordHash: employeePasswordHash,
      isActive: true,
      branchId: branches[0].id,
      departmentId: departments[0].id, // Retail
    },
  });
  console.log(`✅ Created sample employee: ${employeeUser.email}`);

  // ─── Sample Questions ──────────────────────────────────────────────────────
  const sampleQuestion = await prisma.question.upsert({
    where: { id: "q-sample-001" },
    update: {},
    create: {
      id: "q-sample-001",
      title: "Minimum Capital Requirement",
      body: "According to the Central Bank of Uzbekistan regulations, what is the minimum authorized capital requirement for commercial banks operating in Uzbekistan?",
      type: "MCQ",
      difficulty: 3,
      categoryId: categories[3].id, // Compliance
      explanation:
        "CBU sets the minimum authorized capital to ensure bank stability and depositor protection.",
      createdById: adminUser.id,
      options: {
        create: [
          { text: "500 billion UZS", isCorrect: false, orderIndex: 0 },
          { text: "1 trillion UZS", isCorrect: true, orderIndex: 1 },
          { text: "2 trillion UZS", isCorrect: false, orderIndex: 2 },
          { text: "100 million USD", isCorrect: false, orderIndex: 3 },
        ],
      },
    },
  });
  console.log(`✅ Created sample question: ${sampleQuestion.title}`);

  // ─── Additional questions ──────────────────────────────────────────────────

  const extraQuestions: Array<{
    id: string; title: string; body: string;
    type: "MCQ" | "TRUE_FALSE"; difficulty: number; catIndex: number;
    explanation: string;
    options: Array<{ text: string; isCorrect: boolean; orderIndex: number }>;
  }> = [
    { id: "q-sample-002", title: "KYC definition",
      body: "KYC (Know Your Customer) is a mandatory regulatory requirement for banks when onboarding new clients.",
      type: "TRUE_FALSE", difficulty: 1, catIndex: 3,
      explanation: "KYC is indeed mandatory under CBU and global AML regulations.",
      options: [{ text: "True", isCorrect: true, orderIndex: 0 }, { text: "False", isCorrect: false, orderIndex: 1 }] },
    { id: "q-sample-003", title: "Suspicious transaction reporting",
      body: "Which department is primarily responsible for filing Suspicious Activity Reports (SARs)?",
      type: "MCQ", difficulty: 3, catIndex: 3,
      explanation: "The Compliance/AML department monitors and reports suspicious activities.",
      options: [
        { text: "IT Department", isCorrect: false, orderIndex: 0 },
        { text: "Compliance/AML Team", isCorrect: true, orderIndex: 1 },
        { text: "Customer Service Team", isCorrect: false, orderIndex: 2 },
        { text: "Marketing Department", isCorrect: false, orderIndex: 3 },
      ] },
    { id: "q-sample-004", title: "IFRS 9 impairment model",
      body: "Under IFRS 9, loans are classified based on which model?",
      type: "MCQ", difficulty: 4, catIndex: 2,
      explanation: "IFRS 9 uses an Expected Credit Loss (ECL) model for impairment.",
      options: [
        { text: "Incurred Loss Model", isCorrect: false, orderIndex: 0 },
        { text: "Expected Credit Loss Model", isCorrect: true, orderIndex: 1 },
        { text: "Historical Cost Model", isCorrect: false, orderIndex: 2 },
        { text: "Fair Value Model", isCorrect: false, orderIndex: 3 },
      ] },
    { id: "q-sample-005", title: "Phishing attack prevention",
      body: "Employees should never click links in unsolicited emails claiming to be from the IT department.",
      type: "TRUE_FALSE", difficulty: 2, catIndex: 4,
      explanation: "Phishing emails are a common attack vector. Always verify through official channels.",
      options: [{ text: "True", isCorrect: true, orderIndex: 0 }, { text: "False", isCorrect: false, orderIndex: 1 }] },
    { id: "q-sample-006", title: "Overdraft facility",
      body: "An overdraft allows a customer to withdraw more than their available balance up to an agreed limit.",
      type: "TRUE_FALSE", difficulty: 1, catIndex: 0,
      explanation: "An overdraft is a credit facility allowing spending beyond the account balance.",
      options: [{ text: "True", isCorrect: true, orderIndex: 0 }, { text: "False", isCorrect: false, orderIndex: 1 }] },
    { id: "q-sample-007", title: "SWIFT code purpose",
      body: "What is the primary purpose of a SWIFT code (BIC)?",
      type: "MCQ", difficulty: 2, catIndex: 1,
      explanation: "SWIFT codes uniquely identify banks in international wire transfers.",
      options: [
        { text: "To identify individual customer accounts", isCorrect: false, orderIndex: 0 },
        { text: "To uniquely identify banks in international transfers", isCorrect: true, orderIndex: 1 },
        { text: "To encrypt transaction data", isCorrect: false, orderIndex: 2 },
        { text: "To determine transaction fees", isCorrect: false, orderIndex: 3 },
      ] },
    { id: "q-sample-008", title: "Nostro account definition",
      body: "A nostro account is our bank's account held at a foreign correspondent bank.",
      type: "TRUE_FALSE", difficulty: 3, catIndex: 1,
      explanation: "Nostro (Italian: 'ours') refers to our account at a foreign bank.",
      options: [{ text: "True", isCorrect: true, orderIndex: 0 }, { text: "False", isCorrect: false, orderIndex: 1 }] },
    { id: "q-sample-009", title: "Two-factor authentication",
      body: "Which combination represents valid two-factor authentication (2FA)?",
      type: "MCQ", difficulty: 2, catIndex: 4,
      explanation: "2FA requires two different factors: something you know + something you have.",
      options: [
        { text: "Password + security question", isCorrect: false, orderIndex: 0 },
        { text: "Password + OTP via mobile app", isCorrect: true, orderIndex: 1 },
        { text: "Username + email address", isCorrect: false, orderIndex: 2 },
        { text: "Two different passwords", isCorrect: false, orderIndex: 3 },
      ] },
    { id: "q-sample-010", title: "Collateral in lending",
      body: "Collateral in a loan agreement primarily serves to:",
      type: "MCQ", difficulty: 2, catIndex: 0,
      explanation: "Collateral reduces the lender's risk by providing an asset that can be seized on default.",
      options: [
        { text: "Increase the loan interest rate", isCorrect: false, orderIndex: 0 },
        { text: "Reduce the lender's risk by securing the loan", isCorrect: true, orderIndex: 1 },
        { text: "Guarantee faster loan approval", isCorrect: false, orderIndex: 2 },
        { text: "Eliminate the need for a credit check", isCorrect: false, orderIndex: 3 },
      ] },
    { id: "q-sample-011", title: "Amortisation schedule",
      body: "In an amortising loan, early repayments consist mainly of interest rather than principal.",
      type: "TRUE_FALSE", difficulty: 3, catIndex: 2,
      explanation: "Early amortising payments are weighted toward interest; principal grows over time.",
      options: [{ text: "True", isCorrect: true, orderIndex: 0 }, { text: "False", isCorrect: false, orderIndex: 1 }] },
  ];

  let extraCount = 0;
  for (const q of extraQuestions) {
    const exists = await prisma.question.findUnique({ where: { id: q.id }, select: { id: true } });
    if (exists) continue;
    await prisma.question.create({
      data: {
        id: q.id, title: q.title, body: q.body, type: q.type,
        difficulty: q.difficulty, categoryId: categories[q.catIndex].id,
        explanation: q.explanation, isActive: true, createdById: adminUser.id,
        options: { create: q.options },
      },
    });
    extraCount++;
  }
  if (extraCount > 0) console.log(`✅ Created ${extraCount} additional questions`);

  // ─── Sample Exam ───────────────────────────────────────────────────────────
  await prisma.exam.upsert({
    where: { id: "exam-sample-001" },
    update: {},
    create: {
      id: "exam-sample-001",
      title: "Compliance & CBU Regulations — Onboarding Test",
      description:
        "Mandatory onboarding assessment covering Central Bank regulations and bank compliance procedures for all new employees.",
      passingScore: 75,
      timeLimit: 60, // 60 minutes
      randomize: true,
      allowReview: true,
      showAnswers: false,
      isActive: true,
      isAdaptive: false,
      createdById: adminUser.id,
      examCategories: {
        create: [
          { categoryId: categories[3].id, questionCount: 10 }, // Compliance
          { categoryId: categories[0].id, questionCount: 5 },  // Credit
          { categoryId: categories[1].id, questionCount: 5 },  // Operations
        ],
      },
    },
  });
  console.log("✅ Created sample exam: Compliance & CBU Regulations");

  console.log("\n🎉 Seed completed successfully!");
  console.log("\n📋 Login credentials:");
  console.log("   Admin:    admin@universalbank.uz    / Admin123!");
  console.log("   HR:       hr@universalbank.uz       / Admin123!");
  console.log("   Employee: employee@universalbank.uz / Employee123!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
