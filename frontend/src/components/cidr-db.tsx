import { useEffect, useState, useMemo } from "react";
import { fetchCidr, deleteCidr } from "@/api/references";
import { useAuth } from "./protected-route";

interface CidrEntry {
  location: string;
  firewall1: string;
  firewall2: string | null;
  vsys: string;
  zone: string;
  segment: string;
  exist_in_gates: boolean;
}

export function CidrDb() {
  const [entries, setEntries] = useState<CidrEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  // --- STATE BARU UNTUK MODAL ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ zone: string; segment: string } | null>(null);

  const [filters, setFilters] = useState({ location: "", firewall: "", zone: "", q: "" });

  const { user } = useAuth() || {};

  async function loadCidr() {
    try {
      setLoading(true);
      const result = await fetchCidr();
      setEntries(result);
    } catch (error: any) {
      console.error(error);
      setError(error.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCidr();
  }, []);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const locationMatch =
        !filters.location ||
        entry.location.toLowerCase().includes(filters.location.toLowerCase());

      const firewallMatch =
        !filters.firewall ||
        entry.firewall1.toLowerCase().includes(filters.firewall.toLowerCase()) ||
        entry.firewall2?.toLowerCase().includes(filters.firewall.toLowerCase());

      const zoneMatch =
        !filters.zone ||
        entry.zone.toLowerCase().includes(filters.zone.toLowerCase());

      const segmentMatch =
        !filters.q ||
        entry.segment.toLowerCase().includes(filters.q.toLowerCase());

      return locationMatch && firewallMatch && zoneMatch && segmentMatch;
    });
  }, [entries, filters]);

  function confirmDelete(zone: string, segment: string) {
    setItemToDelete({ zone, segment });
    setIsModalOpen(true);
  }

  function cancelDelete() {
    setIsModalOpen(false);
    setItemToDelete(null);
  }

  async function executeDelete() {
    if (!itemToDelete) return;

    const { zone, segment } = itemToDelete;
    const key = `${zone}|${segment}`;
    
    setIsModalOpen(false); 
    setDeletingKey(key);
    setDeleteError(null);
    
    try {
      await deleteCidr(zone, segment);
      await loadCidr();
    } catch (e: any) {
      setDeleteError(e.response?.data?.detail ?? e.message ?? "Failed to delete");
    } finally {
      setDeletingKey(null);
      setItemToDelete(null); // Bersihkan state item
    }
  }

  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden relative">
      <h3 className="font-bold text-slate-800 text-sm text-center mt-3 mb-2">CIDR DB</h3>
      <div className="p-3 border-b border-slate-200 flex flex-wrap items-center gap-2">
        <input
          value={filters.location}
          onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
          placeholder="Find location"
          className="border border-slate-300 rounded px-2 py-1 text-xs w-32"
        />
        <input
          value={filters.firewall}
          onChange={(e) => setFilters((f) => ({ ...f, firewall: e.target.value }))}
          placeholder="Find firewall"
          className="border border-slate-300 rounded px-2 py-1 text-xs w-40"
        />
        <input
          value={filters.zone}
          onChange={(e) => setFilters((f) => ({ ...f, zone: e.target.value }))}
          placeholder="Find zone"
          className="border border-slate-300 rounded px-2 py-1 text-xs w-40"
        />
        <input
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          placeholder="Find segment (CIDR)"
          className="border border-slate-300 rounded px-2 py-1 text-xs w-48"
        />
      </div>

      {loading && <p className="p-4 text-sm text-slate-500">Load data...</p>}
      {error && <p className="p-4 text-sm text-red-500">Failed to load data: {error}</p>}
      {deleteError && <p className="p-2 text-xs text-red-500 bg-red-50">{deleteError}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Location</th>
                <th className="text-left px-3 py-2">Firewall1</th>
                <th className="text-left px-3 py-2">Firewall2</th>
                <th className="text-left px-3 py-2">VSys</th>
                <th className="text-left px-3 py-2">Zone</th>
                <th className="text-left px-3 py-2">Segment</th>
                {user?.role == "admin" && <th className="text-center">Action</th>}
              </tr>
            </thead>
          </table>
          <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
            <table className="w-full text-sm table-fixed">
              <tbody>
                {filteredEntries.map((e) => {
                  const key = `${e.zone}|${e.segment}`;
                  return (
                    <tr key={key} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-600">{e.location}</td>
                      <td className="px-3 py-2 font-medium text-slate-700">{e.firewall1}</td>
                      <td className="px-3 py-2 text-slate-600">{e.firewall2 ?? "-"}</td>
                      <td className="px-3 py-2 text-slate-600">{e.vsys}</td>
                      <td className="px-3 py-2 text-slate-600">{e.zone}</td>
                      <td className="px-3 py-2 font-mono text-slate-700">{e.segment}</td>
                      {user?.role == "admin" && (
                        <td className="text-center">
                          <button
                            /* UBAH ONCLICK MENJADI MEMANGGIL FUNGSI CONFIRM */
                            onClick={() => confirmDelete(e.zone, e.segment)}
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
                {filteredEntries.length === 0 && (
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
      )}

      {/* --- UI MODAL VALIDASI --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-6">
            <h4 className="text-lg font-bold text-slate-800 mb-2">Confirm Deletion</h4>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete segment{" "}
              <span className="font-mono font-bold text-slate-800">
                {itemToDelete?.segment}
              </span>{" "}
              from zone <span className="font-bold">{itemToDelete?.zone}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors shadow-sm"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
