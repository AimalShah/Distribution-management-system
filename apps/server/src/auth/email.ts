/**
 * Resend's HTTP API, called directly rather than through the `resend` SDK: the
 * one call the server makes is a single POST, and the SDK would be a dependency
 * that exists to wrap it.
 *
 * Unset `RESEND_API_KEY` means "do not send", matching the legacy behaviour, so
 * local development and the test suites never reach the network. That is only
 * safe because `REQUIRE_EMAIL_VERIFICATION=false` is what lets a user in without
 * the email -- see `auth/index.ts`.
 */
export interface Email {
  to: string;
  subject: string;
  html: string;
}

export const EMAIL_FROM = process.env.EMAIL_FROM ?? "Inventioo <onboarding@resend.dev>";

export async function sendEmail(email: Email): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: EMAIL_FROM, ...email }),
  });

  if (!res.ok) {
    throw new Error(`Resend rejected the email (${res.status}): ${await res.text()}`);
  }
}
