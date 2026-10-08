/**
 * WhatsApp deep links.
 *
 * The product sends statements and invoices as a `wa.me` link rather than
 * talking to WhatsApp's API: no token, no template approval, and the sender
 * stays the human who already has the conversation open. They review the text,
 * attach the PDF if they want one, and press send.
 */

/**
 * A local number like `03001234567` becomes `923001234567`.
 *
 * WhatsApp only accepts a country code with no `+`, no spaces and no leading
 * zero. The app's customers are Pakistani mobile numbers; anything that does
 * not look like one is passed through untouched rather than guessed at.
 */
export function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");

  if (!digits) return null;

  if (digits.startsWith("0") && digits.length === 10) {
    return `92${digits.slice(1)}`;
  }

  return digits;
}

/**
 * The `wa.me` link itself. Returns null when there is no reachable number —
 * the caller falls back to copying the text to the clipboard.
 */
export function waLink(phone: string | null | undefined, text: string): string | null {
  if (!phone) return null;
  const to = normalizePhone(phone);

  if (!to) return null;

  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}
