import nodemailer, { type Transporter } from 'nodemailer'
import type { EmailSender } from '../../modules/auth/domain/otp.js'

export class SmtpEmailSender implements EmailSender {
  private readonly transporter: Transporter

  constructor(
    host: string,
    port: number,
    secure: boolean,
    user: string,
    password: string,
    private readonly fromName: string,
    private readonly fromEmail: string,
  ) {
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass: password },
      disableFileAccess: true,
      disableUrlAccess: true,
    })
  }

  async sendLoginOtp(input: {
    recipient: string
    code: string
    expiresInMinutes: number
    appName: string
  }): Promise<void> {
    await this.transporter.sendMail({
      from: { name: this.fromName, address: this.fromEmail },
      to: input.recipient,
      subject: `${input.code} is your ${input.appName} login code`,
      text: `Your ${input.appName} login code is ${input.code}. It expires in ${input.expiresInMinutes} minutes. If you did not request this code, ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px"><h2>${input.appName}</h2><p>Use this one-time code to sign in:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px">${input.code}</p><p>This code expires in ${input.expiresInMinutes} minutes and can be used only once.</p><p style="color:#666">If you did not request this code, ignore this email.</p></div>`,
    })
  }
}
