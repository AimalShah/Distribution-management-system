import { Resend } from "resend";

// `new Resend(undefined)` throws at construction time, which crashes any module
// graph that imports auth. Fall back to a placeholder so the app boots without
// a key; sends are guarded by the callers (see lib/auth.ts).
const resendApiKey = process.env.RESEND_API_KEY || "re_unconfigured";

export const resend = new Resend(resendApiKey);
