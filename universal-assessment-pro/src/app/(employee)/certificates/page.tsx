import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { format } from "date-fns";
import { Award, ExternalLink, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "My Certificates" };

export default async function CertificatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const certificates = await db.certificate.findMany({
    where:   { userId: session.user.id },
    include: {
      attempt: {
        select: { score: true, exam: { select: { title: true, passingScore: true } } },
      },
    },
    orderBy: { issuedAt: "desc" },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">My Certificates</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {certificates.length} certificate{certificates.length !== 1 ? "s" : ""} earned
        </p>
      </div>

      {certificates.length === 0 ? (
        <div className="py-16 text-center">
          <Award className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">No certificates yet.</p>
          <p className="text-xs text-gray-400 mt-1">Pass an exam to earn your first certificate!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-5 space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-amber-400/20 p-2.5">
                  <Award className="h-6 w-6 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {cert.attempt.exam.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    Score: {cert.attempt.score}%
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-white/70 px-3 py-2 border border-amber-100">
                <p className="text-[10px] text-gray-400">Verification Code</p>
                <p className="text-xs font-mono font-semibold text-gray-700 tracking-wide">
                  {cert.verificationCode}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400">
                  Issued {format(cert.issuedAt, "MMM d, yyyy")}
                </span>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/results/${cert.attemptId}`}
                    className="flex items-center gap-1 text-[10px] text-blue-600 hover:underline"
                  >
                    View <ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                  <a
                    href={`/api/certificates/${cert.attemptId}/pdf`}
                    className="flex items-center gap-1 text-[10px] text-amber-700 hover:underline"
                    download
                  >
                    PDF <Download className="h-2.5 w-2.5" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
