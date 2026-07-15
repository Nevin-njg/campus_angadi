import type { OtpRecord, OtpStore, OtpVerificationResult } from '../../modules/auth/domain/otp.js'

export class InMemoryOtpStore implements OtpStore {
  private readonly records = new Map<string, OtpRecord>()

  get(email: string): Promise<OtpRecord | null> {
    const record = this.records.get(email)
    if (!record) return Promise.resolve(null)
    if (record.expiresAt.getTime() <= Date.now()) {
      this.records.delete(email)
      return Promise.resolve(null)
    }
    return Promise.resolve(structuredClone(record))
  }

  set(record: OtpRecord): Promise<void> {
    this.records.set(record.email, structuredClone(record))
    return Promise.resolve()
  }

  delete(email: string): Promise<void> {
    this.records.delete(email)
    return Promise.resolve()
  }

  async verifyAndConsume(email: string, candidateHash: string): Promise<OtpVerificationResult> {
    const record = await this.get(email)
    if (!record) return { status: 'MISSING' }
    if (record.hash === candidateHash) {
      this.records.delete(email)
      return { status: 'MATCH' }
    }
    record.attemptsRemaining -= 1
    if (record.attemptsRemaining <= 0) {
      this.records.delete(email)
      return { status: 'LOCKED' }
    }
    this.records.set(email, record)
    return { status: 'INVALID', attemptsRemaining: record.attemptsRemaining }
  }
}
