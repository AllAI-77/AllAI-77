import type { Metadata } from "next";
import { db } from "@/lib/db";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Award, Calendar, User, BookOpen, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export const metadata: Metadata = { title: "Certificate Verification — Universal Assessment Pro" };

interface Props {
  params: Promise<{ code: string }>;
}

export default async function CertificateVerifyPage({ params }: Props) {
  const { code } = await params;
  const clean = code.trim().toUpperCase();

  const certificate = await db.certificate.findFirst({
    where: { verificationCode: clean },
    include: {
      attempt: {
        include: {
          exam: { select: { title: true, passingScore: true } },
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  const isExpired =
    certificate?.expiresAt && new Date(certificate.expiresAt) < new Date();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#002B7A] to-[#003DA5] px-4 py-12">
      {/* ATB Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
          <GraduationCap className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-lg leading-tight">ATB Universalbank</p>
          <p className="text-white/60 text-xs">Certificate Verification</p>
        </div>
      </div>

      <div className="w-full max-w-md">
        {!certificate ? (
          // ── Not found ──
          <div className="rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="px-8 py-10 text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                <XCircle className="h-9 w-9 text-red-500" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Invalid Certificate</h1>
              <p className="text-sm text-gray-500">
                No certificate was found with code{" "}
                <span className="font-mono font-semibold text-gray-800">{clean}</span>.
                <br />
                Please check the code and try again.
              </p>
              <div className="pt-2">
                <Badge variant="destructive" className="text-xs">Not Verified</Badge>
              </div>
            </div>
            <div className="border-t border-gray-100 px-8 py-4 bg-gray-50 text-center">
              <p className="text-xs text-gray-400">
                Need help?{" "}
                <a href="mailto:hr@universalbank.uz" className="text-[#003DA5] hover:underline">
                  Contact HR
                </a>
              </p>
            </div>
          </div>
        ) : isExpired ? (
          // ── Expired ──
          <div className="rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="px-8 py-10 text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
                <Award className="h-9 w-9 text-amber-500" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Certificate Expired</h1>
              <p className="text-sm text-gray-500">
                This certificate was valid but has now expired.
              </p>
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                Expired {format(new Date(certificate.expiresAt!), "d MMMM yyyy")}
              </Badge>
            </div>
          </div>
        ) : (
          // ── Valid ──
          <div className="rounded-2xl bg-white shadow-2xl overflow-hidden">
            {/* Gold top band */}
            <div className="h-2 bg-gradient-to-r from-[#B8860B] to-[#DAA520]" />

            <div className="px-8 py-8 space-y-6">
              {/* Status badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 rounded-full bg-green-50 border border-green-200 px-3 py-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-semibold text-green-700">Verified ✓</span>
                </div>
                <span className="font-mono text-xs text-gray-400">{clean}</span>
              </div>

              {/* Award icon */}
              <div className="flex justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg">
                  <Award className="h-10 w-10 text-white" />
                </div>
              </div>

              {/* Details */}
              <div className="space-y-3">
                <Row icon={User} label="Recipient">
                  {certificate.attempt.user.name ?? certificate.attempt.user.email}
                </Row>
                <Row icon={BookOpen} label="Exam">
                  {certificate.attempt.exam.title}
                </Row>
                <Row icon={Award} label="Score">
                  <span className="font-semibold text-green-700">
                    {certificate.attempt.score}%
                  </span>
                  <span className="text-gray-400 text-xs ml-1">
                    (pass mark: {certificate.attempt.exam.passingScore}%)
                  </span>
                </Row>
                <Row icon={Calendar} label="Issued">
                  {format(new Date(certificate.issuedAt), "d MMMM yyyy")}
                </Row>
                {certificate.expiresAt && (
                  <Row icon={Calendar} label="Valid until">
                    {format(new Date(certificate.expiresAt), "d MMMM yyyy")}
                  </Row>
                )}
              </div>
            </div>

            <div className="border-t border-gray-100 px-8 py-4 bg-gray-50 text-center">
              <p className="text-xs text-gray-400">
                Issued by ATB Universalbank · Universal Assessment Pro
              </p>
            </div>
          </div>
        )}

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link href="/" className="text-white/60 hover:text-white text-sm transition">
            ← Back to portal
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50">
        <Icon className="h-3.5 w-3.5 text-[#003DA5]" />
      </div>
      <div>
        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-sm text-gray-800">{children}</p>
      </div>
    </div>
  );
}
