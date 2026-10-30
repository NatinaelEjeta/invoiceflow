/**
 * Email delivery. Uses Resend (via plain fetch — no SDK) when RESEND_API_KEY
 * is set; otherwise logs the full email to the server console so the app is
 * fully functional without any keys.
 */

export interface EmailResult {
  provider: 'resend' | 'console';
  delivered: boolean;
  detail?: string;
}

interface InvoiceEmailParams {
  workspaceName: string;
  clientName: string;
  invoiceNumber: string;
  dueDate: string;
  currency: string;
  totalCents: number;
  balanceCents: number;
  publicUrl: string;
}

export function formatAmount(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

export function buildInvoiceEmailHtml(params: InvoiceEmailParams): string {
  const total = formatAmount(params.totalCents, params.currency);
  const balance = formatAmount(params.balanceCents, params.currency);
  return `<!doctype html>
<html>
  <body style="font-family: Arial, Helvetica, sans-serif; color:#1a1a1a; background:#f6f6f7; padding:24px; margin:0;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
      <p style="margin:0 0 16px;font-size:15px;">Hi ${params.clientName},</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">
        <strong>${params.workspaceName}</strong> has sent you invoice
        <strong>${params.invoiceNumber}</strong> for <strong>${total}</strong>.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px;font-size:14px;">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#555;">Invoice</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${params.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#555;">Amount due</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;"><strong>${balance}</strong></td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#555;">Due date</td>
          <td style="padding:8px 0;text-align:right;">${new Date(params.dueDate).toISOString().slice(0, 10)}</td>
        </tr>
      </table>
      <p style="margin:0 0 24px;">
        <a href="${params.publicUrl}"
           style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;">
          View invoice
        </a>
      </p>
      <p style="margin:0;font-size:12px;color:#888;">
        You can view and download this invoice any time at ${params.publicUrl}
      </p>
    </div>
  </body>
</html>`;
}

export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // MOCK EMAIL MODE — everything works without keys.
    console.log(
      `\n===== [email:console] =====\nTo: ${params.to}\nSubject: ${params.subject}\n${params.html}\n===========================\n`
    );
    return { provider: 'console', delivered: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'InvoiceFlow <onboarding@resend.dev>',
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error('[email:resend] Delivery failed:', detail);
      return { provider: 'resend', delivered: false, detail };
    }
    return { provider: 'resend', delivered: true };
  } catch (err) {
    console.error('[email:resend] Request failed:', err);
    return { provider: 'resend', delivered: false, detail: String(err) };
  }
}
