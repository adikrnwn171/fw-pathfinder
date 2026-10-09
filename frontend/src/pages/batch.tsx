import { BatchLookup } from '@/components/batch-lookup'

export default function BatchLookupPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-bold text-foreground">Batch Lookup</h1>
      <p className="mt-1 text-muted-foreground">
        Upload a CSV file to resolve multiple firewall paths simultaneously.
      </p>
      <BatchLookup />
    </div>
  )
}