import { useEffect, useState, useMemo } from "react";
import { fetchFwDb, deleteFw, deleteConnection } from "@/api/references";
import type { RowFirewall, TopologyGraphResponse } from "@/types/api";
import { useAuth } from "./protected-route";

function flattenPhysicals(graph: TopologyGraphResponse): RowFirewall[] {
  const rows: RowFirewall[] = [];
  for (const fw of graph.firewalls) {
    for (const v of fw.vsys) {
      const gatesLabel = v.gates.join(" / ") || "-";
      if (v.zones.length === 0) {
        rows.push({ firewall: fw.name, vsys: v.name, gatesLabel, zone: "-" });
      } else {
        for (const zone of v.zones) {
          rows.push({ firewall: fw.name, vsys: v.name, gatesLabel, zone });
        }
      }
    }
  }
  return rows;
}


type DeleteTarget =
  | { type: "firewall"; name: string }
  | { type: "connection"; id: string; description: string }
  | null;

export function FwDb() {
  const [entries, setEntries] = useState<TopologyGraphResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [searchFw, setSearchFw] = useState("");
  const [searchConnection, setSearchConnection] = useState("");

  // State modal konfirmasi
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const { user } = useAuth() || {};

  async function loadFw() {
    try{
        const result = await fetchFwDb();
        setEntries(result);
    } catch (error: any) {
        console.error(error);
        setError(error.message ?? "Failed to load")
    } finally {
        setLoading(false);
    }
  }

  useEffect(() => {
    loadFw();
  }, []);

  const rows = useMemo(() => {
    if (!entries) return [];
    const all = flattenPhysicals(entries);
    if (!searchFw.trim()) return all;
    const q = searchFw.toLowerCase();
    return all.filter(
      (r) =>
        r.firewall.toLowerCase().includes(q) ||
        r.vsys.toLowerCase().includes(q) ||
        r.zone.toLowerCase().includes(q) ||
        r.gatesLabel.toLowerCase().includes(q)
    );
  }, [entries, searchFw]);

  const connections = useMemo(() => {
    const all = entries?.connections ?? [];
    if (!searchConnection.trim()) return all;
    const q = searchConnection.toLowerCase();
    return all.filter((c) =>
      [c.from.firewall, c.from.vsys, c.from.gate, c.to.firewall, c.to.vsys, c.to.gate]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [entries, searchConnection]);

  async function handleDelete(firewallName: string) {
    const key = firewallName;
    setDeletingKey(key);
    setDeleteError(null);
    try {
      await deleteFw(firewallName)
      await loadFw();
    } catch (e: any) {
      setDeleteError(e.response?.data?.detail ?? e.message ?? "Failed to delete");
    } finally {
      setDeletingKey(null);
    }
  }

  async function handleDeleteConnections(id: string) {
    setDeletingKey(id);
    setDeleteError(null);

    try {
        await deleteConnection(id);
        await loadFw();
    } catch (e: any) {
      setDeleteError(
        e.response?.data?.detail ?? e.message ?? "Failed to delete"
      );
    } finally {
      setDeletingKey(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;

    const target = deleteTarget;
    setDeleteTarget(null); 

    if (target.type === "firewall") {
      await handleDelete(target.name);
    } else if (target.type === "connection") {
      await handleDeleteConnections(target.id);
    }
  }

  return (
    <>
      {/* ERROR MESSAGE DISPLAY */}
      {deleteError && (
        <div className="mt-4 p-3 text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg">
          {deleteError}
        </div>
      )}

      {/* FIREWALL DB SECTION */}
      <div className="border border-slate-200 rounded-lg bg-white overflow-hidden mt-10">
        <h3 className="font-bold text-slate-800 text-sm text-center mt-3 mb-2">
          Firewall DB
        </h3>
        <div>
          <div className="flex items-center justify-between p-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <input
                value={searchFw}
                onChange={(e) => setSearchFw(e.target.value)}
                placeholder="Search firewall, vsys, or zone..."
                className="border border-slate-300 rounded px-2 py-1 text-xs w-64"
              />
            </div>
          </div>

          {loading && <p className="p-4 text-sm text-slate-500">Load data...</p>}
          {error && <p className="p-4 text-sm text-red-500">Failed to load: {error}</p>}

          {!loading && !error && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                  <tr>
                    <th className="text-left px-3 py-2">Firewall</th>
                    <th className="text-left px-3 py-2">VSys</th>
                    <th className="text-left px-3 py-2">Gates</th>
                    <th className="text-left px-3 py-2">Zone</th>
                    {/* {user?.role == "admin" && (
                      <th className="text-center">Action</th>
                    )} */}
                  </tr>
                </thead>
              </table>
              <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
                <table className="w-full text-sm table-fixed">
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-700">{r.firewall}</td>
                        <td className="px-3 py-2 text-slate-600">{r.vsys}</td>
                        <td className="px-3 py-2 text-slate-600">{r.gatesLabel}</td>
                        <td className="px-3 py-2 text-slate-600">{r.zone}</td>
                        {/* {user?.role == "admin" && (
                          <td className="text-center">
                            <button
                              onClick={() =>
                                setDeleteTarget({ type: "firewall", name: r.firewall })
                              }
                              disabled={deletingKey === r.firewall}
                              className="text-xs text-red-500 disabled:text-slate-300 cursor-pointer hover:underline"
                            >
                              {deletingKey === r.firewall ? "Deleting..." : "Delete"}
                            </button>
                          </td>
                        )} */}
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td
                          colSpan={user?.role == "admin" ? 5 : 4}
                          className="px-3 py-6 text-center text-slate-400"
                        >
                          No data
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CONNECTIONS DB SECTION */}
      <div className="border border-slate-200 rounded-lg bg-white overflow-hidden mt-10">
        <h3 className="font-bold text-slate-800 text-sm text-center mt-3 mb-2">
          Connections DB
        </h3>
        <div>
          <div className="flex items-center justify-between p-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <input
                value={searchConnection}
                onChange={(e) => setSearchConnection(e.target.value)}
                placeholder="Search firewall, vsys, or gate..."
                className="border border-slate-300 rounded px-2 py-1 text-xs w-64"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Firewall A</th>
                  <th className="text-left px-3 py-2">VSys A</th>
                  <th className="text-left px-3 py-2">Gate A</th>
                  <th className="text-left px-3 py-2">Firewall B</th>
                  <th className="text-left px-3 py-2">VSys B</th>
                  <th className="text-left px-3 py-2">Gate B</th>
                  {user?.role == "admin" && (
                    <th className="text-center px-3 py-2">Action</th>
                  )}
                </tr>
              </thead>
            </table>
            <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
              <table className="w-full text-sm table-fixed">
                <tbody>
                  {connections.map((c) => {
                    const key = `connection-${c.id}`;
                    const connectionLabel = `${c.from.firewall}:${c.from.gate} ➔ ${c.to.firewall}:${c.to.gate}`;
                    return (
                      <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-700">{c.from.firewall}</td>
                        <td className="px-3 py-2 text-slate-600">{c.from.vsys}</td>
                        <td className="px-3 py-2 text-slate-600">{c.from.gate}</td>
                        <td className="px-3 py-2 font-medium text-slate-700">{c.to.firewall}</td>
                        <td className="px-3 py-2 text-slate-600">{c.to.vsys}</td>
                        <td className="px-3 py-2 text-slate-600">{c.to.gate}</td>
                        {user?.role == "admin" && (
                          <td className="text-center">
                            <button
                              onClick={() =>
                                setDeleteTarget({
                                  type: "connection",
                                  id: c.id,
                                  description: connectionLabel,
                                })
                              }
                              disabled={deletingKey === key}
                              className="text-xs text-red-500 disabled:text-slate-300 cursor-pointer hover:underline"
                            >
                              {deletingKey === key ? "Deleting..." : "Delete"}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {connections.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                        No data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-6">
            <h4 className="text-lg font-bold text-slate-800 mb-2">Confirm Deletion</h4>
            <p className="text-sm text-slate-600 mb-6">
              {deleteTarget.type === "firewall" ? (
                <>
                  Are you sure you want to delete firewall{" "}
                  <span className="font-bold text-slate-800">{deleteTarget.name}</span>?
                </>
              ) : (
                <>
                  Are you sure you want to delete connection{" "}
                  <span className="font-mono font-bold text-slate-800">
                    {deleteTarget.description}
                  </span>
                  ?
                </>
              )}
              {" "}This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors shadow-sm"
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