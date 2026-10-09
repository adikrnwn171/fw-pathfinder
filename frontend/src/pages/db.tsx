import { CidrDb } from "@/components/cidr-db"
import { FwDb } from "@/components/fw-db"

export default function DbReference() {
  return (
    <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold text-foreground">Database References</h1>
        <p className="mt-1 text-muted-foreground">
            Displays references used to determine the resolve path.
        </p>
        <div className="mt-6 grid gap-6">
            <div className="rounded-lg border border bg-card p-6">
                <CidrDb/>
                <FwDb/>
            </div>
        </div>
    </div>
  )
}