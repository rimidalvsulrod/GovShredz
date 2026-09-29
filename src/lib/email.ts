import "server-only";
import { getSecret, getSettings } from "./settings";

type Email = { to: string; subject: string; html: string; text: string };

const DEFAULT_FROM = "GovShredz <govshredz@neqodigital.com>";

export async function emailConfigured() {
  return !!(await getSecret("RESEND_API_KEY"));
}

/** Sends through Resend. Without an API key in local dev, the email is printed to the console instead. */
export async function sendEmail({ to, subject, html, text }: Email): Promise<{ ok: boolean; error?: string }> {
  const key = await getSecret("RESEND_API_KEY");
  if (!key) {
    if (process.env.VERCEL) return { ok: false, error: "Email is not configured (RESEND_API_KEY)." };
    console.log(`\n[email:dev] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return { ok: true };
  }
  const from = process.env.EMAIL_FROM || (await getSettings()).emailFrom || DEFAULT_FROM;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  if (!res.ok) {
    const error = await res.text();
    console.error("email send failed", res.status, error);
    return { ok: false, error };
  }
  return { ok: true };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function shell(inner: string) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#060608;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#060608;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#0f0f13;border:1px solid #23232a;border-radius:24px;overflow:hidden;">
<tr><td style="padding:32px 32px 0;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td><div style="width:40px;height:40px;border-radius:12px;background:#c8ff2e;text-align:center;line-height:40px;color:#060608;font-weight:900;font-size:18px;font-style:italic;">GS</div></td>
<td style="padding-left:12px;color:#fff;font-size:20px;font-weight:800;letter-spacing:0.5px;font-style:italic;">GOVSHREDZ</td>
</tr></table>
</td></tr>
<tr><td style="padding:24px 32px 32px;">${inner}</td></tr>
</table>
<p style="margin:24px 0 0;font-size:12px;color:#5d5d68;">GovShredz · Lift. Rank up. Get shredded.</p>
</td></tr></table>
</body></html>`;
}

export function codeEmail({ name, code, purpose }: { name: string; code: string; purpose: "verify" | "reset" }) {
  const first = name.split(" ")[0];
  const heading = purpose === "verify" ? "Confirm your email" : "Reset your password";
  const intro =
    purpose === "verify"
      ? `Yo ${first}, welcome to GovShredz. Enter this code in the app to activate your account.`
      : `Hey ${first}, use this code in the app to choose a new password.`;
  const subject = purpose === "verify" ? `${code} is your GovShredz code` : `${code} is your GovShredz reset code`;
  const digits = code
    .split("")
    .map(
      (d) =>
        `<td style="width:44px;height:56px;background:#16161c;border:1px solid #2a2a33;border-radius:12px;text-align:center;font-size:28px;font-weight:800;color:#c8ff2e;font-family:ui-monospace,Menlo,monospace;">${d}</td><td style="width:8px"></td>`,
    )
    .join("");
  const html = shell(`<h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;color:#ffffff;">${esc(heading)}</h1>
<p style="margin:0 0 28px;font-size:16px;line-height:1.55;color:#9a9aa6;">${esc(intro)}</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr>${digits}</tr></table>
<p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#5d5d68;">This code expires in 15 minutes. If you didn't ask for it, ignore this email.</p>`);
  const text = `${heading}\n\n${intro}\n\nYour code: ${code}\n\nThis code expires in 15 minutes.`;
  return { subject, html, text };
}

export function noticeEmail({ subject, heading, body }: { subject: string; heading: string; body: string }) {
  return {
    subject,
    html: shell(`<h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;color:#ffffff;">${esc(heading)}</h1>
<p style="margin:0;font-size:16px;line-height:1.55;color:#9a9aa6;white-space:pre-wrap;">${esc(body)}</p>`),
    text: `${heading}\n\n${body}`,
  };
}
