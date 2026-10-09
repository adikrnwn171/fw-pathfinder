import { useEffect, useState } from "react";
import { deleteRequest, getRequestDetail, updateRequest } from "../api/requests.ts";
import type { RequestStatus, RequestDetail } from "@/types/api";
import { formateDateTime } from "@/utils/formatDate.ts";
import { PathHopsSection } from "./path-hops.tsx";
import { exportRowsAsCsv } from "@/utils/exportToCsv.ts";
import { normalizeHopRow } from "@/utils/converter.ts";
import { useAuth } from "./protected-route.tsx";

interface RequestDetailPanelProps {
  requestId: string | null;
  onClose: () => void;
  onUpdated?: (updated: RequestDetail) => void;
  onDeleted?: (deleteId: string) => void;
}

export default function RequestDetailPanel({
  requestId,
  onClose,
  onUpdated,
  onDeleted
}: RequestDetailPanelProps) {
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>();
  const [status, setStatus] = useState<RequestStatus>("PENDING");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [configuredFirewalls, setConfiguredFirewalls] = useState<string[]>([]);

  const { user } = useAuth() || {};

  useEffect(() => {
    if (!requestId) {
      setDetail(null);
      document.body.style.overflow = 'unset';
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    document.body.style.overflow = 'hidden';

    getRequestDetail(requestId)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setConfiguredFirewalls(data.configured_firewall ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Something went wrong");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  if (!requestId) return null;

  const confirmAndDelete = async () => {
    if (!detail) return;
    setIsConfirmOpen(false);
    setDeleting(true);
    setError(null);
    try {
      await deleteRequest(detail.id);
      if (onDeleted) onDeleted(detail.id);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!detail) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateRequest(detail.id, { engineer_notes: notes, status: status, configured_firewall: configuredFirewalls });
      setDetail(updated);
      onUpdated?.(updated);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!detail) return;
    const hopToExport = detail?.hops.map(normalizeHopRow)
    const defaultFilename = `export_${new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19)}.csv`;
    setError(null);
    try {
      exportRowsAsCsv(hopToExport, detail.source_filename ?? defaultFilename)
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExporting(false)
    }
  };

  const handleToggleFirewall = (node: string) => {
    setConfiguredFirewalls((prev) =>
      prev.includes(node)
        ? prev.filter((n) => n !== node) // Hapus dari daftar jika sudah ada (Uncheck)
        : [...prev, node] // Tambah ke daftar jika belum ada (Check)
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-7xl bg-white border-l border-slate-200 shadow-2xl flex flex-col">        
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="text-base font-semibold uppercase  text-slate-900">
            Request ID
            </h3>
            <div className="flex items-center gap-1 font-mono text-base font-bold text-slate-700">
            <span className="text-slate-700">#</span>
            <span>{detail?.ticket_number}</span>
            </div>
          </div>

          <button
              type="button"
              aria-label="Close panel"
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
              ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {loading && <p className="text-sm text-slate-500">Loading detail...</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {detail && !loading && (
            <>
              <section>
                <h3 className="text-base font-semibold text-slate-900 mb-3">Core Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded border border-slate-200 flex flex-col gap-1">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Source Type
                    </span>
                    <span className="text-base font-semibold text-slate-900">
                      {detail.source_type}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-4 rounded border border-slate-200 flex flex-col gap-1">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Source Filename
                    </span>
                    {detail.source_filename?
                    <span className="font-mono text-sm bg-slate-200 px-2 py-1 rounded w-fit">
                      {detail.source_filename}
                    </span>
                    : '-'}
                  </div>

                  <div className="bg-slate-50 p-4 rounded border border-slate-200 flex flex-col gap-1 md:col-span-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Engineer Notes
                    </span>
                    <textarea
                      value={notes ?? ''}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-sm text-slate-900 min-h-[80px] resize-none focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>

                  <div className="bg-slate-50 p-4 rounded border border-slate-200 flex flex-col gap-1">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Submitted By
                    </span>
                    <span className="text-sm text-slate-900">{detail.submitted_by}</span>
                  </div>

                  <div className="bg-slate-50 p-4 rounded border border-slate-200 flex flex-col gap-1">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Latest Updated By
                    </span>
                    <span className="text-sm text-slate-900">{detail.updated_by}</span>
                  </div>


                  <div className="bg-slate-50 p-4 rounded border border-slate-200 flex flex-col gap-1">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Updated At
                    </span>
                    <span className="text-sm text-slate-900">{formateDateTime(detail.updated_at)}</span>
                  </div>

                  <div className="bg-slate-50 p-4 rounded border border-slate-200 flex flex-col gap-1">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Status
                    </span>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as RequestStatus)}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm text-slate-900 cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-900"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="IN_REVIEW">In Review</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="PARTIAL">Partial</option>
                    </select>
                  </div>

                  <div className="bg-slate-50 p-4 rounded border border-slate-200 flex flex-col gap-2 md:col-span-2">
                    <span className="text-s font-bold uppercase tracking-wide text-slate-500">
                      Configured Firewall
                    </span>
                    <p className="text-xs tracking-wide text-slate-500">
                      Checklist for the firewall that has been configured, don't forget to change the status
                    </p>
                    <ul className="flex flex-col gap-1 overflow-y-auto pr-2">
                      {detail.summary?.nodes?.map((node) => {
                        const isConfigured = configuredFirewalls.includes(node);
                        
                        return (
                          <li key={node}>
                            <button
                              type="button"
                              onClick={() => handleToggleFirewall(node)}
                              className="flex items-center gap-2 w-full text-left p-1.5 rounded hover:bg-slate-200/60 transition-colors cursor-pointer"
                            >
                              {isConfigured ? (
                                <span className="text-green-600 font-bold w-4 text-center" title="Configured">✓</span>
                              ) : (
                                <span className="text-slate-300 w-4 text-center" title="Pending">○</span>
                              )}
                              <span className={`text-sm ${isConfigured ? "font-medium text-slate-900" : "text-slate-700"}`}>
                                {node}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                      
                      {(!detail.summary?.nodes || detail.summary.nodes.length === 0) && (
                        <li className="text-sm text-slate-500 italic p-1">No firewalls found</li>
                      )}
                    </ul>
                  </div>

                </div>
              </section>

              <section>
                <h3 className="text-base font-semibold text-slate-900 mb-3">Total Rule</h3>

                  {loading? (
                    <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
                      Loading Data
                    </div>
                  ) : (
                    <PathHopsSection  hops={detail.hops} configuredFirewalls={detail.configured_firewall}/>
                  )}
                    
              </section>
            </>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
          {user?.role == 'admin' && 
            <button
              onClick={() => setIsConfirmOpen(true)}
              disabled={deleting || !detail}
              className="px-4 py-2 bg-danger text-white rounded text-sm font-bold hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {deleting ? "Deleting..." : "Delete Request"}
            </button>
          }
          <button
            onClick={handleExport}
            disabled={exporting || !detail}
            className="px-4 py-2 bg-slate-900 text-white rounded text-sm font-bold hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {exporting ? "Exporting..." : "Export"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !detail}
            className="px-4 py-2 bg-slate-900 text-white rounded text-sm font-bold hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </footer>
      </div>

      {isConfirmOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4 text-left">
          <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Delete</h3>
          <p className="text-sm text-gray-600 mb-6">
            Are you sure you want to delete this request?
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setIsConfirmOpen(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={confirmAndDelete}
              className="px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 cursor-pointer"
            >
              Yes, Delete
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}