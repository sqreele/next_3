// app/providers.tsx
'use client'

export function AuthProvider({
  children
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}