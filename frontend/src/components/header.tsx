import { ShieldCheck } from 'lucide-react'

export function Header() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-start gap-4 border-b border-border bg-background px-6">
      <ShieldCheck/>
      <h2 className="text-lg font-bold text-foreground">
        Firewall Path Finder
      </h2>
    </header>
  )
}