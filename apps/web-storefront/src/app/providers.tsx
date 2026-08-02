import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AppError } from '@shopnest/contracts'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (failureCount, error) => {
              // On ne retente jamais une erreur définitive (4xx métier).
              const code = (error as Partial<AppError>).code
              if (code && code !== 'INTERNAL') return false
              return failureCount < 2
            },
          },
        },
      }),
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
