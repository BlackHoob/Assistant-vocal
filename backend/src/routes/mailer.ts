import nodemailer from 'nodemailer';

// Configure ces variables dans ton .env pour un vrai envoi d'email :
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
// Tant qu'elles ne sont pas définies, le lien est juste affiché dans les
// logs du serveur — pratique pour développer/tester sans configurer de SMTP.
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'Nestor Vocal <no-reply@nestor-vocal.local>';

const isConfigured = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
if (isConfigured) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const subject = 'Réinitialisation de votre mot de passe — Nestor Vocal';
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #f97316;">Nestor Vocal</h2>
      <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
      <p>
        <a href="${resetUrl}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;">
          Réinitialiser mon mot de passe
        </a>
      </p>
      <p style="color:#888;font-size:13px;">Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>
    </div>
  `;

  if (!transporter) {
    // Pas de SMTP configuré : on log le lien pour pouvoir tester quand même.
    console.log('\n[mailer] SMTP non configuré — lien de réinitialisation :');
    console.log(`[mailer] → ${resetUrl}\n`);
    return;
  }

  await transporter.sendMail({ from: SMTP_FROM, to, subject, html });
}