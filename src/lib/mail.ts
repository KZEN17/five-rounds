import { appendFile } from "node:fs/promises";
import { Resend } from "resend";

export type SignInMail = { to: string; url: string };
export type MailSender = (mail: SignInMail) => Promise<void>;

const SUBJECT = "Your Five Rounds sign-in link";

function text(url: string): string {
  return `Tap the link to sign in to Five Rounds:\n\n${url}\n\nIt works once and expires in 15 minutes. If you didn't ask for it, ignore this email.`;
}

function html(url: string): string {
  const href = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `<p>Tap the button to sign in to Five Rounds.</p>
<p><a href="${href}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#6b3fb0;color:#ffffff;font-weight:600;text-decoration:none">Sign in</a></p>
<p style="color:#6a6578;font-size:13px">It works once and expires in 15 minutes. If you didn't ask for it, ignore this email.</p>`;
}

/**
 * Resend when AUTH_RESEND_KEY is set. Without it, development prints the link
 * to the terminal; production refuses, so a misconfigured deploy fails loudly.
 */
export function mailSenderFromEnv(env: NodeJS.ProcessEnv = process.env): MailSender {
  const key = env.AUTH_RESEND_KEY;
  if (key) {
    const from = env.EMAIL_FROM;
    // Fail the send, not the whole app: a missing sender shouldn't take every page down.
    if (!from) {
      return async () => {
        throw new Error("EMAIL_FROM isn't set. Add it in Vercel (e.g. Five Rounds <onboarding@resend.dev>) and redeploy.");
      };
    }
    const resend = new Resend(key);
    return async ({ to, url }) => {
      const { error } = await resend.emails.send({ from, to, subject: SUBJECT, text: text(url), html: html(url) });
      if (error) throw new Error(`Resend couldn't send the sign-in email: ${error.message}`);
    };
  }
  if (env.NODE_ENV === "production") {
    return async () => {
      throw new Error("Email sign-in isn't configured. Set AUTH_RESEND_KEY and EMAIL_FROM.");
    };
  }
  const sink = env.MAIL_SINK_FILE; // end-to-end tests read links from here
  return async ({ to, url }) => {
    if (sink) await appendFile(sink, `${JSON.stringify({ to, url })}\n`);
    console.info(`\n[dev mail] Sign-in link for ${to}:\n${url}\n`);
  };
}
