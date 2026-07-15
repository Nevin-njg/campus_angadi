import type { Logger } from 'pino'
import type { EmailSender } from '../../modules/auth/domain/otp.js'

export class ConsoleEmailSender implements EmailSender {
  constructor(private readonly logger: Logger) {}

  sendLoginOtp(input: {
    recipient: string
    code: string
    expiresInMinutes: number
    appName: string
  }): Promise<void> {
    this.logger.info(
      {
        recipient: input.recipient,
        developmentOtp: input.code,
        expiresInMinutes: input.expiresInMinutes,
      },
      `${input.appName} development OTP`,
    )
    return Promise.resolve()
  }
}
