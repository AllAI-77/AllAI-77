/**
 * Universal Assessment Pro — Database Seed
 * Run: npx tsx prisma/seed.ts
 */

import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

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
