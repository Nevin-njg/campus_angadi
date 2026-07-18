import { createContext, useContext } from 'react'

export type ConfirmationOptions = {
  title: string
  description: string
  confirmLabel?: string
  tone?: 'default' | 'danger'
}

export const ConfirmationContext = createContext<
  ((options: ConfirmationOptions) => Promise<boolean>) | null
>(null)

export function useConfirmation() {
  const value = useContext(ConfirmationContext)
  if (!value) throw new Error('useConfirmation must be used inside ConfirmationProvider')
  return value
}
