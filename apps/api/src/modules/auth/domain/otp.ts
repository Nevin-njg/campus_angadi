export interface OtpRecord {
  email: string
  hash: string
  expiresAt: Date
  resendAvailableAt: Date
  attemptsRemaining: number
  sendCount: number
  sendWindowStartedAt: Date
}

export type OtpVerificationResult =
  | { status: 'MATCH' }
  | { status: 'MISSING' }
  | { status: 'INVALID'; attemptsRemaining: number }
  | { status: 'LOCKED' }

export interface OtpStore {
  get(email: string): Promise<OtpRecord | null>
  set(record: OtpRecord): Promise<void>
  delete(email: string): Promise<void>
  verifyAndConsume(email: string, candidateHash: string): Promise<OtpVerificationResult>
  close?(): Promise<void>
}

export interface EmailSender {
  sendLoginOtp(input: {
    recipient: string
    code: string
    expiresInMinutes: number
    appName: string
  }): Promise<void>
}
