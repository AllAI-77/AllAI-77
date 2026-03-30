import type { Metadata } from "next";
import { ExamEngine } from "@/components/employee/ExamEngine";

export const metadata: Metadata = { title: "Taking Exam" };

interface Props {
  params: Promise<{ examId: string }>;
}

export default async function TakeExamPage({ params }: Props) {
  const { examId } = await params;
  return <ExamEngine examId={examId} />;
}
