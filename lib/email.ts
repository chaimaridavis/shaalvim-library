import "server-only";
import nodemailer from "nodemailer";

// The library's emails go out through its own Gmail account. The app password
// lives only in the site's settings (Vercel, and .env.local on Ariel's computer).
const sender = "shaalvim.library@gmail.com";

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

function mailer() {
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  if (!pass) return null;
  transport ??= nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: sender, pass },
  });
  return transport;
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Sends one plain, friendly email. Never throws: a failed email must not undo
// what the member just did on the site, and the bell still shows it.
export async function sendEmail({
  to,
  subject,
  lines,
  button,
}: {
  to: string;
  subject: string;
  lines: string[];
  button: { text: string; url: string };
}) {
  const t = mailer();
  if (!t) {
    console.warn("Email not sent: GMAIL_APP_PASSWORD is not set.");
    return;
  }
  const text = [...lines, "", `${button.text}: ${button.url}`, "", "Shaalvim Library"].join("\n");
  const html = `<div style="font-family:Georgia,serif;font-size:17px;line-height:1.5;color:#2b2118;max-width:520px">
${lines.map((l) => `<p>${escape(l)}</p>`).join("\n")}
<p><a href="${escape(button.url)}" style="display:inline-block;background:#2f5d50;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none">${escape(button.text)}</a></p>
<p style="color:#6b5e52;font-size:14px">Shaalvim Library</p>
</div>`;
  try {
    await t.sendMail({ from: { name: "Shaalvim Library", address: sender }, to, subject, text, html });
    console.info(`Email sent: ${subject}`);
  } catch (error) {
    console.error("Email failed", error);
  }
}
