/**
 * PDF Certificate template using @react-pdf/renderer.
 * This must ONLY be imported server-side (API routes / server actions).
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { format } from "date-fns";

// ─── Styles ───────────────────────────────────────────────────────────────────

const BRAND_BLUE = "#003DA5";
const BRAND_GOLD = "#C8A951";

const s = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    padding: 0,
  },

  // Top gold band
  topBand: {
    height: 8,
    backgroundColor: BRAND_GOLD,
  },

  // Blue header
  header: {
    backgroundColor: BRAND_BLUE,
    paddingVertical: 28,
    paddingHorizontal: 48,
    alignItems: "center",
  },
  bankName: {
    fontSize: 11,
    color: BRAND_GOLD,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    color: "#ffffff",
    fontWeight: "bold",
    letterSpacing: 0.5,
  },

  // Body
  body: {
    flex: 1,
    paddingHorizontal: 60,
    paddingVertical: 40,
    alignItems: "center",
  },

  certLabel: {
    fontSize: 11,
    color: "#9ca3af",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  bigTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: BRAND_BLUE,
    marginBottom: 24,
    textAlign: "center",
  },

  presentsTo: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 6,
    textAlign: "center",
  },
  recipientName: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 6,
    textAlign: "center",
  },
  divider: {
    width: 200,
    height: 2,
    backgroundColor: BRAND_GOLD,
    marginVertical: 12,
  },

  completedText: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 6,
  },
  examTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#1f2937",
    textAlign: "center",
    marginBottom: 20,
  },

  scoreRow: {
    flexDirection: "row",
    gap: 32,
    marginBottom: 28,
  },
  scorePill: {
    backgroundColor: "#eff6ff",
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "center",
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: "bold",
    color: BRAND_BLUE,
  },
  scoreLabel: {
    fontSize: 9,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // Footer band
  footerBand: {
    backgroundColor: "#f9fafb",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingHorizontal: 60,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  codeLabel: {
    fontSize: 9,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  codeValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#374151",
    letterSpacing: 1.5,
  },
  issuedLabel: {
    fontSize: 9,
    color: "#9ca3af",
    textAlign: "right",
    marginBottom: 2,
  },
  issuedDate: {
    fontSize: 12,
    color: "#374151",
    textAlign: "right",
  },

  // Bottom gold band
  bottomBand: {
    height: 8,
    backgroundColor: BRAND_GOLD,
  },
});

// ─── Component ────────────────────────────────────────────────────────────────

interface CertificatePDFProps {
  recipientName:    string;
  examTitle:        string;
  score:            number;
  issuedAt:         Date;
  verificationCode: string;
  qrData:           string;
}

export function CertificatePDF({
  recipientName,
  examTitle,
  score,
  issuedAt,
  verificationCode,
}: CertificatePDFProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* Top accent */}
        <View style={s.topBand} />

        {/* Header */}
        <View style={s.header}>
          <Text style={s.bankName}>ATB Universalbank</Text>
          <Text style={s.headerTitle}>Universal Assessment Pro</Text>
        </View>

        {/* Body */}
        <View style={s.body}>
          <Text style={s.certLabel}>Certificate of Achievement</Text>
          <Text style={s.bigTitle}>CERTIFICATE</Text>

          <Text style={s.presentsTo}>This certifies that</Text>
          <Text style={s.recipientName}>{recipientName}</Text>

          <View style={s.divider} />

          <Text style={s.completedText}>has successfully completed</Text>
          <Text style={s.examTitle}>{examTitle}</Text>

          <View style={s.scoreRow}>
            <View style={s.scorePill}>
              <Text style={s.scoreValue}>{score}%</Text>
              <Text style={s.scoreLabel}>Score</Text>
            </View>
            <View style={s.scorePill}>
              <Text style={s.scoreValue}>PASS</Text>
              <Text style={s.scoreLabel}>Result</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footerBand}>
          <View>
            <Text style={s.codeLabel}>Verification Code</Text>
            <Text style={s.codeValue}>{verificationCode}</Text>
          </View>
          <View>
            <Text style={s.issuedLabel}>Date Issued</Text>
            <Text style={s.issuedDate}>
              {format(issuedAt, "MMMM d, yyyy")}
            </Text>
          </View>
        </View>

        {/* Bottom accent */}
        <View style={s.bottomBand} />
      </Page>
    </Document>
  );
}
