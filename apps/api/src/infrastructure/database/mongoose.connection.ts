import mongoose from 'mongoose'
import type { Logger } from 'pino'

export interface MongoConnectionOptions {
  autoIndex: boolean
  maxPoolSize: number
  minPoolSize: number
  serverSelectionTimeoutMS: number
}

export async function connectMongo(
  uri: string,
  logger: Logger,
  options: MongoConnectionOptions,
): Promise<void> {
  await mongoose.connect(uri, options)
  logger.info('MongoDB connected')
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect()
}

export function isMongoReady(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected
}
