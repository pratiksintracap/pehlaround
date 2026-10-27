import "server-only";

// Text messages, for mobile sign-in codes. Two providers, picked by which keys are set:
//   MSG91 (India; handles DLT): MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID, a DLT-approved OTP template with ##OTP##.
//   Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM (a number) or TWILIO_MESSAGING_SERVICE_SID.
// SMS_PROVIDER=log prints the message to the server log instead; it is refused in production.

type Provider = "msg91" | "twilio" | "log";

function provider(): Provider | null {
  const want = process.env.SMS_PROVIDER?.trim().toLowerCase();
  if (want === "log") return process.env.NODE_ENV === "production" && !process.env.PGLITE_DIR ? null : "log";
  const msg91 = !!(process.env.MSG91_AUTH_KEY && process.env.MSG91_OTP_TEMPLATE_ID);
  const twilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_FROM || process.env.TWILIO_MESSAGING_SERVICE_SID));
  if (want === "msg91") return msg91 ? "msg91" : null;
  if (want === "twilio") return twilio ? "twilio" : null;
  return msg91 ? "msg91" : twilio ? "twilio" : null;
}

export const smsReady = () => provider() !== null;

/** Sends a sign-in code to an E.164 number ("+919876543210"). Throws when the provider refuses. */
export async function sendCodeSms(to: string, code: string, minutes: number) {
  const p = provider();
  if (!p) throw new Error("SMS is not set up");
  const text = `${code} is your Before the Bell sign-in code. It works for ${minutes} minutes. Do not share it with anyone.`;
  if (p === "log") { console.log(`[sms] to ${to}: ${text}`); return; }
  if (p === "msg91") {
    const u = new URL("https://control.msg91.com/api/v5/otp");
    u.searchParams.set("template_id", process.env.MSG91_OTP_TEMPLATE_ID!);
    u.searchParams.set("mobile", to.replace(/^\+/, ""));
    u.searchParams.set("otp", code);
    u.searchParams.set("otp_expiry", String(minutes));
    const r = await fetch(u, { method: "POST", headers: { authkey: process.env.MSG91_AUTH_KEY!, "content-type": "application/json" }, body: "{}" });
    const j = (await r.json().catch(() => ({}))) as { type?: string; message?: string };
    if (!r.ok || j.type === "error") throw new Error(`MSG91: ${j.message || r.status}`);
    return;
  }
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const form = new URLSearchParams({ To: to, Body: text });
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) form.set("MessagingServiceSid", process.env.TWILIO_MESSAGING_SERVICE_SID);
  else form.set("From", process.env.TWILIO_FROM!);
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST", body: form,
    headers: { authorization: "Basic " + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"), "content-type": "application/x-www-form-urlencoded" },
  });
  if (!r.ok) throw new Error(`Twilio: ${r.status} ${(await r.text()).slice(0, 200)}`);
}
