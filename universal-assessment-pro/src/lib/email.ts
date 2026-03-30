/**
 * Transactional email utility using nodemailer.
 * Sends HTML emails for exam completion, certificate issuance, and admin notifications.
 */

import nodemailer from "nodemailer";

// ─── Transport ────────────────────────────────────────────────────────────────

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.EMAIL_SERVER_HOST  ?? "smtp.universalbank.uz",
    port:   Number(process.env.EMAIL_SERVER_PORT ?? 587),
    secure: process.env.EMAIL_SERVER_PORT === "465",
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  });
}

const FROM = process.env.EMAIL_FROM ?? "UAP <noreply@universalbank.uz>";

// ─── Base HTML wrapper ────────────────────────────────────────────────────────

function emailWrapper(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="560" cellpadding="0" cellspacing="0" role="presentation"
               style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
          <!-- Header -->
          <tr>
            <td style="background:#003DA5;padding:24px 32px;text-align:center;">
              <span style="display:inline-block;background:#C8A951;color:#fff;font-size:11px;font-weight:700;
                           letter-spacing:1px;padding:4px 10px;border-radius:4px;margin-bottom:8px;">
                ATB UNIVERSALBANK
              </span>
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.3px;">
                Universal Assessment Pro
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #f0f0f0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">
                This is an automated message from Universal Assessment Pro.<br/>
                ATB Universalbank, Tashkent, Uzbekistan
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Email: Exam result ───────────────────────────────────────────────────────

export async function sendExamResultEmail(params: {
  to:        string;
  name:      string;
  examTitle: string;
  score:     number;
  passed:    boolean;
  passingScore: number;
  attemptId: string;
}): Promise<void> {
  const { to, name, examTitle, score, passed, passingScore, attemptId } = params;
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const statusColor = passed ? "#16a34a" : "#dc2626";
  const statusText  = passed ? "Passed ✓" : "Not Passed ✗";
  const statusBg    = passed ? "#f0fdf4" : "#fef2f2";

  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#374151;">
      Hello, <strong>${name}</strong>!
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">
      You have completed the following assessment:
    </p>

    <div style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#111827;">${examTitle}</p>

      <table cellpadding="0" cellspacing="0" width="100%" style="margin-top:12px;">
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6b7280;">Your Score</td>
          <td style="padding:6px 0;font-size:13px;font-weight:700;color:#111827;text-align:right;">${score}%</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6b7280;">Passing Score</td>
          <td style="padding:6px 0;font-size:13px;color:#6b7280;text-align:right;">${passingScore}%</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6b7280;">Result</td>
          <td style="padding:6px 0;text-align:right;">
            <span style="background:${statusBg};color:${statusColor};font-size:12px;font-weight:700;
                         padding:2px 8px;border-radius:100px;">${statusText}</span>
          </td>
        </tr>
      </table>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${baseUrl}/results/${attemptId}"
         style="display:inline-block;background:#003DA5;color:#ffffff;font-size:14px;font-weight:600;
                text-decoration:none;padding:12px 28px;border-radius:8px;">
        View Detailed Results
      </a>
    </div>

    ${passed ? `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;text-align:center;">
      <p style="margin:0;font-size:13px;color:#166534;font-weight:600;">
        🏆 Congratulations! Your certificate has been issued.
      </p>
      <p style="margin:4px 0 0;font-size:12px;color:#15803d;">
        Download it from the <a href="${baseUrl}/certificates" style="color:#15803d;">Certificates</a> page.
      </p>
    </div>` : `
    <p style="font-size:13px;color:#6b7280;text-align:center;">
      Don't worry — you can <a href="${baseUrl}/exams" style="color:#003DA5;">retake the exam</a> at any time.
    </p>`}
  `;

  const transport = createTransport();
  await transport.sendMail({
    from:    FROM,
    to,
    subject: `${passed ? "✓ Passed" : "✗ Not Passed"}: ${examTitle} — ${score}%`,
    html:    emailWrapper("Exam Result", body),
  });
}

// ─── Email: Certificate issued ────────────────────────────────────────────────

export async function sendCertificateEmail(params: {
  to:               string;
  name:             string;
  examTitle:        string;
  score:            number;
  verificationCode: string;
  attemptId:        string;
}): Promise<void> {
  const { to, name, examTitle, score, verificationCode, attemptId } = params;
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#374151;">
      Dear <strong>${name}</strong>,
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">
      We are pleased to inform you that you have successfully completed:
    </p>

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:20px;margin-bottom:24px;text-align:center;">
      <div style="font-size:28px;margin-bottom:8px;">🏆</div>
      <p style="margin:0 0 4px;font-size:17px;font-weight:700;color:#92400e;">${examTitle}</p>
      <p style="margin:0;font-size:14px;color:#b45309;">Score: <strong>${score}%</strong></p>
    </div>

    <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;">
        Certificate Verification Code
      </p>
      <p style="margin:0;font-size:18px;font-weight:700;font-family:monospace;color:#111827;letter-spacing:2px;">
        ${verificationCode}
      </p>
    </div>

    <div style="text-align:center;">
      <a href="${baseUrl}/api/certificates/${attemptId}/pdf"
         style="display:inline-block;background:#C8A951;color:#ffffff;font-size:14px;font-weight:600;
                text-decoration:none;padding:12px 28px;border-radius:8px;">
        Download PDF Certificate
      </a>
    </div>
  `;

  const transport = createTransport();
  await transport.sendMail({
    from:    FROM,
    to,
    subject: `Certificate: ${examTitle} — Universal Assessment Pro`,
    html:    emailWrapper("Certificate Issued", body),
  });
}

// ─── Email: Welcome (new employee account) ────────────────────────────────────

export async function sendWelcomeEmail(params: {
  to:              string;
  name:            string;
  temporaryPassword: string;
}): Promise<void> {
  const { to, name, temporaryPassword } = params;
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#374151;">
      Welcome, <strong>${name}</strong>!
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">
      Your Universal Assessment Pro account has been created. Here are your login credentials:
    </p>

    <div style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:24px;">
      <table cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6b7280;width:120px;">Email</td>
          <td style="padding:6px 0;font-size:13px;font-weight:700;color:#111827;">${to}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6b7280;">Temporary Password</td>
          <td style="padding:6px 0;font-size:13px;font-weight:700;color:#111827;font-family:monospace;">${temporaryPassword}</td>
        </tr>
      </table>
    </div>

    <p style="margin:0 0 20px;font-size:13px;color:#dc2626;font-weight:600;">
      Please change your password after first login.
    </p>

    <div style="text-align:center;">
      <a href="${baseUrl}/login"
         style="display:inline-block;background:#003DA5;color:#ffffff;font-size:14px;font-weight:600;
                text-decoration:none;padding:12px 28px;border-radius:8px;">
        Login to UAP
      </a>
    </div>
  `;

  const transport = createTransport();
  await transport.sendMail({
    from:    FROM,
    to,
    subject: "Welcome to Universal Assessment Pro — ATB Universalbank",
    html:    emailWrapper("Welcome!", body),
  });
}
