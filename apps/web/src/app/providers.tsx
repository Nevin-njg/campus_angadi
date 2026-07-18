import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AuthBootstrap } from '../features/auth/components/AuthBootstrap'
import { ConfirmationProvider } from '../components/feedback/ConfirmationProvider'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
})

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfirmationProvider>
        <AuthBootstrap>{children}</AuthBootstrap>
      </ConfirmationProvider>
    </QueryClientProvider>
  )
}
