import { useState } from "react";
import RequestDetailPanel from './detail-request';
import { formateDateTime } from "@/utils/formatDate";
import type { RequestListResponse, RequestSummary } from "@/types/api";
import { StatusBadge } from '@/components/status-badge'

export interface RequestsHistoryTableProps extends RequestListResponse {
  onRequestUpdated: (updatedRequest: RequestSummary) => void;
  onDeletedRequest: (deletedId: string) => void;
}


export function RequestsHistoryTable({
    // total,
    // page,
    // page_size,
    items,
    onRequestUpdated,
    onDeletedRequest
}: RequestsHistoryTableProps) {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    return (
        <>  
            <table className="w-full text-left text-sm">
            <thead>
                <tr className="border-b border-border bg-secondary text-xs font-semibold tracking-wider text-muted-foreground">
                <th className="px-6 py-3.5">TICKET NUMBER</th>
                <th className="px-6 py-3.5">SUBMITTED BY</th>
                <th className="px-6 py-3.5">SUBMITTED AT</th>
                <th className="px-6 py-3.5">SOURCE TYPE</th>
                <th className="px-6 py-3.5">TOTAL RULE</th>
                <th className="px-6 py-3.5">STATUS</th>
                <th className="px-6 py-3.5 text-right">ACTION</th>
                </tr>
            </thead>
            <tbody>
                {items.map((e, i) => (
                <tr
                    key={e.id}
                    className={`border-b border-border last:border-0 ${
                    i % 2 === 1 ? 'bg-secondary/50' : ''
                    }`}
                >
                    <td className="px-6 py-4 font-mono">{e.ticket_number}</td>
                    <td className="px-6 py-4 font-mono">{e.submitted_by}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                    {formateDateTime(e.submitted_at)}
                    </td>
                    <td className="px-6 py-4 font-mono">{e.source_type}</td>
                    <td className="px-6 py-4 font-mono">{e.hop_count}</td>
                    <td className="px-6 py-4">
                    <StatusBadge status={e.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                    <button
                        key={e.id}
                        onClick={() => setSelectedId(e.id)}
                        type="button"
                        className="rounded-md border border-border px-3 py-1.5 font-mono text-xs text-foreground hover:bg-secondary"
                    >
                        Details
                    </button>
                    </td>
                </tr>
                ))}
                {items.length === 0 && (
                <tr>
                    <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-muted-foreground"
                    >
                    No requests match your search.
                    </td>
                </tr>
                )}
            </tbody>
            </table>
            <RequestDetailPanel
                requestId={selectedId}
                onClose={() => setSelectedId(null)}
                onUpdated={onRequestUpdated}
                onDeleted={onDeletedRequest}
            />
        </>
    )
}