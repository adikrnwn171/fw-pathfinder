import { EditFw } from "@/components/edit-fw"
import { InsertCidr } from "@/components/insert-cidr"
import { InsertConnection } from "@/components/insert-connections"
// import { InsertFw } from "@/components/insert-fw"

export default function InsertReferences() {
  return (
    <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold text-foreground">Insert DB References</h1>
        <p className="mt-1 text-muted-foreground">
            Insert new CIDR / Firewall / connections to the DB references.
        </p>
        <div className="mt-6 grid gap-6">
            <div className="rounded-lg border border bg-card p-6">
                <InsertCidr/>
                {/* <InsertFw /> */}
                <EditFw />
                <InsertConnection />
            </div>
        </div>
    </div>
  )
}