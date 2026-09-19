import { config } from "../config/env";

export type EmailPayload = {
  email: string;
  name: string;
  url: string;
  token: string;
};

export type ContractExpiryReminderPayload = {
  to: string;
  name: string;
  contractNumber: string;
  sequenceNumber: number;
  contractType: string;
  startDate: string;
  endDate: string;
  daysRemaining: number;
};

export type SentEmailRecord = {
  to: string;
  subject: string;
  type: "verification" | "reset-password" | "contract-expiry";
  url?: string;
  token?: string;
  metadata?: Record<string, unknown>;
  sentAt: Date;
};

// In-memory ring buffer untuk pencatatan dan testing
export const sentEmails: SentEmailRecord[] = [];

export class EmailService {
  async sendVerificationEmail({ email, name, url, token }: EmailPayload): Promise<boolean> {
    const verificationUrl = `${config.appOrigin}/verify-email?token=${token}`;
    const subject = "Verifikasi Alamat Email Akun MKN Site Anda";

    sentEmails.push({
      to: email,
      subject,
      type: "verification",
      url: verificationUrl,
      token,
      sentAt: new Date()
    });

    if (sentEmails.length > 100) sentEmails.shift();

    if (!config.isProduction) {
      console.log(`[EMAIL DEV] Verification email sent to: ${email}`);
      console.log(`[EMAIL DEV] Link: ${verificationUrl}`);
    }

    // Mengirim ke Mailpit bila tersedia
    await this.dispatchToMailpit({
      to: email,
      name,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px;">
          <h2>Halo, ${name}</h2>
          <p>Terima kasih telah mendaftar di MKN Site. Silakan verifikasi email Anda untuk mendapatkan hak pengajuan dokumen dan operasional penuh.</p>
          <p><a href="${verificationUrl}" style="background: #e8590c; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Verifikasi Email Sekarang</a></p>
          <p style="color: #666; font-size: 13px;">Tautan ini berlaku selama 24 jam.</p>
        </div>
      `
    });

    return true;
  }

  async sendPasswordResetEmail({ email, name, url, token }: EmailPayload): Promise<boolean> {
    const resetUrl = `${config.appOrigin}/reset-password?token=${token}`;
    const subject = "Permintaan Pemulihan Kata Sandi Akun MKN Site";

    sentEmails.push({
      to: email,
      subject,
      type: "reset-password",
      url: resetUrl,
      token,
      sentAt: new Date()
    });

    if (sentEmails.length > 100) sentEmails.shift();

    if (!config.isProduction) {
      console.log(`[EMAIL DEV] Password reset email sent to: ${email}`);
      console.log(`[EMAIL DEV] Link: ${resetUrl}`);
    }

    await this.dispatchToMailpit({
      to: email,
      name,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px;">
          <h2>Halo, ${name}</h2>
          <p>Kami menerima permintaan untuk mengatur ulang kata sandi akun MKN Site Anda.</p>
          <p><a href="${resetUrl}" style="background: #e8590c; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Atur Ulang Kata Sandi</a></p>
          <p style="color: #666; font-size: 13px;">Tautan ini hanya berlaku selama 30 menit dan dapat digunakan sekali saja.</p>
          <p style="color: #999; font-size: 12px;">Jika Anda tidak meminta pengaturan ulang ini, abaikan email ini dengan aman.</p>
        </div>
      `
    });

    return true;
  }

  async sendContractExpiryReminderEmail({
    to,
    name,
    contractNumber,
    sequenceNumber,
    contractType,
    startDate,
    endDate,
    daysRemaining
  }: ContractExpiryReminderPayload): Promise<boolean> {
    const portalUrl = `${config.appOrigin}/portal/personal`;
    const subject = `[Pemberitahuan] Masa Berlaku Kontrak Kerja Berakhir Dalam ${daysRemaining} Hari - MKN Site`;
    const sequenceLabel = sequenceNumber === 1 ? "Kontrak Awal" : `Perpanjangan Ke-${sequenceNumber - 1}`;

    sentEmails.push({
      to,
      subject,
      type: "contract-expiry",
      url: portalUrl,
      metadata: {
        contractNumber,
        sequenceNumber,
        contractType,
        startDate,
        endDate,
        daysRemaining
      },
      sentAt: new Date()
    });

    if (sentEmails.length > 100) sentEmails.shift();

    if (!config.isProduction) {
      console.log(`[EMAIL DEV] Contract expiry reminder sent to: ${to} (Days remaining: ${daysRemaining})`);
      console.log(`[EMAIL DEV] Contract: ${contractNumber} (${sequenceLabel})`);
    }

    await this.dispatchToMailpit({
      to,
      name,
      subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #334155;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid #334155; padding-bottom: 16px;">
            <h2 style="margin: 0; color: #38bdf8; font-size: 20px;">MKN Site Notification</h2>
          </div>
          <h3 style="color: #f1f5f9; margin-top: 0;">Halo, ${name}</h3>
          <p style="color: #cbd5e1; line-height: 1.6;">
            Sistem mendeteksi bahwa masa berlaku perjanjian kerja waktu tertentu (PKWT) Anda akan segera berakhir dalam 
            <strong style="color: #f59e0b; font-size: 16px;">${daysRemaining} hari</strong> ke depan.
          </p>
          <div style="background: #1e293b; border-radius: 8px; padding: 16px; margin: 20px 0; border: 1px solid #475569;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #e2e8f0;">
              <tr>
                <td style="padding: 6px 0; color: #94a3b8;">Nomor Kontrak:</td>
                <td style="padding: 6px 0; font-weight: bold; text-align: right;">${contractNumber}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94a3b8;">Status / Tahap:</td>
                <td style="padding: 6px 0; font-weight: bold; text-align: right; color: #38bdf8;">${sequenceLabel} (${contractType})</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94a3b8;">Mulai Bekerja:</td>
                <td style="padding: 6px 0; text-align: right;">${startDate}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94a3b8;">Berakhir Pada:</td>
                <td style="padding: 6px 0; font-weight: bold; text-align: right; color: #ef4444;">${endDate}</td>
              </tr>
            </table>
          </div>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">
            Mohon koordinasikan evaluasi kinerja dan kelanjutan administrasi kontrak Anda bersama Tim HRD / Operational Supervisor sebelum tanggal jatuh tempo.
          </p>
          <div style="margin: 24px 0; text-align: center;">
            <a href="${portalUrl}" style="background: #f59e0b; color: #0f172a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Lihat Detail di Portal Personal
            </a>
          </div>
          <p style="color: #64748b; font-size: 12px; border-top: 1px solid #334155; padding-top: 14px; margin-bottom: 0;">
            Email ini dikirimkan secara otomatis oleh Sistem Otomasi Kontrak MKN Site. Tidak perlu membalas email ini.
          </p>
        </div>
      `
    });

    return true;
  }

  private async dispatchToMailpit({ to, name, subject, html }: { to: string; name: string; subject: string; html: string }) {
    const mailpitHost = process.env.MAILPIT_HOST || "localhost";
    const mailpitPort = process.env.MAILPIT_PORT || "8025";
    try {
      await fetch(`http://${mailpitHost}:${mailpitPort}/api/v1/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          From: { Email: "no-reply@mknsite.online", Name: "MKN Site System" },
          To: [{ Email: to, Name: name }],
          Subject: subject,
          HTML: html
        }),
        signal: AbortSignal.timeout(1000)
      });
    } catch {
      // Mailpit offline / tidak tersedia di lingkungan pengujian, abaikan silent
    }
  }
}

export const emailService = new EmailService();
