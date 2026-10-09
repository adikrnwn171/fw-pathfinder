import { useEffect, useState } from "react";
import type { TopologyGraphResponse } from "@/types/api";
import { deleteFw, fetchFwDb, updateFw } from "@/api/references";

interface VSysDraft {
  name: string;
  gates: string[];
  zones: string[];
}

export function EditFw({ onChanged }: { onChanged?: () => void }) {
  const [graph, setGraph] = useState<TopologyGraphResponse>();
  const [loadingGraph, setLoadingGraph] = useState(true);
  const [selected, setSelected] = useState("");
  const [vsysList, setVsysList] = useState<VSysDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Added for delete confirmation and operation notification
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    const loadGraph = async () => {
      setLoadingGraph(true);
      const result = await fetchFwDb();
      setGraph(result);
    };

    loadGraph();
    setLoadingGraph(false);
  }, []);

  function handleSelect(firewallName: string) {
    setSelected(firewallName);
    setError(null);
    setInfo(null);
    setNotification(null);

    const fw = graph?.firewalls.find((f) => f.name === firewallName);
    setVsysList(
      fw
        ? fw.vsys.map((v) => ({
            name: v.name,
            gates: [...v.gates],
            zones: [...v.zones],
          }))
        : []
    );
  }

  function addVsys() {
    setVsysList((list) => [
      ...list,
      { name: "", gates: [], zones: [] },
    ]);
  }

  function removeVsys(i: number) {
    setVsysList((list) => list.filter((_, idx) => idx !== i));
  }

  function updateVsysName(i: number, value: string) {
    setVsysList((list) =>
      list.map((v, idx) =>
        idx === i ? { ...v, name: value } : v
      )
    );
  }

  function addGate(i: number) {
    setVsysList((list) =>
      list.map((v, idx) =>
        idx === i
          ? { ...v, gates: [...v.gates, ""] }
          : v
      )
    );
  }

  function updateGate(i: number, gi: number, value: string) {
    setVsysList((list) =>
      list.map((v, idx) =>
        idx === i
          ? {
              ...v,
              gates: v.gates.map((g, j) =>
                j === gi ? value : g
              ),
            }
          : v
      )
    );
  }

  function removeGate(i: number, gi: number) {
    setVsysList((list) =>
      list.map((v, idx) =>
        idx === i
          ? {
              ...v,
              gates: v.gates.filter((_, j) => j !== gi),
            }
          : v
      )
    );
  }

  function addZone(i: number) {
    setVsysList((list) =>
      list.map((v, idx) =>
        idx === i
          ? { ...v, zones: [...v.zones, ""] }
          : v
      )
    );
  }

  function updateZone(i: number, zi: number, value: string) {
    setVsysList((list) =>
      list.map((v, idx) =>
        idx === i
          ? {
              ...v,
              zones: v.zones.map((z, j) =>
                j === zi ? value : z
              ),
            }
          : v
      )
    );
  }

  function removeZone(i: number, zi: number) {
    setVsysList((list) =>
      list.map((v, idx) =>
        idx === i
          ? {
              ...v,
              zones: v.zones.filter((_, j) => j !== zi),
            }
          : v
      )
    );
  }

  function validate(): string | null {
    for (const v of vsysList) {
      if (!v.name.trim()) return "All VSys must have a name";
      if (v.gates.some((g) => !g.trim())) {
        return `VSys '${v.name}': gate cannot be empty`;
      }
      if (v.zones.some((z) => !z.trim())) {
        return `VSys '${v.name}': zone cannot be empty`;
      }
    }

    return null;
  }

  async function handleSave() {
    if (!selected) return;

    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    setInfo(null);
    setNotification(null);

    try {
      await updateFw(selected.trim(), {
        vsys: vsysList.map((v) => ({
          name: v.name.trim(),
          gates: v.gates
            .map((g) => g.trim())
            .filter(Boolean),
          zones: v.zones
            .map((z) => z.trim())
            .filter(Boolean),
        })),
      });

      onChanged?.();

      setNotification({
        type: "success",
        message: `Firewall '${selected}' has been updated successfully.`,
      });
    } catch (err: any) {
      setNotification({
        type: "error",
        message:
          err.response?.data?.detail ??
          err.message ??
          "Failed to save changes.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleDeleteFirewall() {
    if (!selected) return;

    setShowDeleteModal(true);
  }

  async function confirmDeleteFirewall() {
    if (!selected) return;

    const deletedFirewall = selected;

    setShowDeleteModal(false);
    setSubmitting(true);
    setError(null);
    setInfo(null);
    setNotification(null);

    try {
      await deleteFw(deletedFirewall);

      setSelected("");
      setVsysList([]);
      onChanged?.();

      setNotification({
        type: "success",
        message: `Firewall '${deletedFirewall}' and all related data were deleted successfully.`,
      });
    } catch (err: any) {
      setNotification({
        type: "error",
        message:
          err.response?.data?.detail ??
          err.message ??
          "Failed to delete firewall.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 border border-slate-200 rounded-lg bg-white mt-10">
      <h3 className="font-semibold text-slate-800 mb-3 text-sm">
        Edit / Delete Firewall
      </h3>
      <p className="font-semibold text-slate-500 mb-3 text-sm">
        Edit firewall, vsys, zone, gates, or delete firewall
      </p>

      {loadingGraph ? (
        <p className="text-sm text-slate-500">
          Loading firewall list...
        </p>
      ) : (
        <select
          value={selected}
          onChange={(e) => handleSelect(e.target.value)}
          className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm mb-3"
        >
          <option value="">-- Select firewall --</option>

          {graph?.firewalls.map((f) => (
            <option key={f.name} value={f.name}>
              {f.name}
            </option>
          ))}
        </select>
      )}

      {selected && (
        <>
          <p className="text-xs text-slate-500 mb-2">
            Note: Firewall name cannot be changed here. If you need to rename it, delete and recreate it.
          </p>

          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600">
              VSys
            </span>

            <button
              type="button"
              onClick={addVsys}
              className="text-xs text-blue-600"
            >
              + Add VSys
            </button>
          </div>

          {vsysList.map((v, vIndex) => (
            <div
              key={vIndex}
              className="border border-slate-200 rounded-md p-3 mb-3 bg-slate-50"
            >
              <div className="flex items-center justify-between mb-2">
                <input
                  value={v.name}
                  onChange={(e) =>
                    updateVsysName(vIndex, e.target.value)
                  }
                  className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm font-medium"
                />

                <button
                  type="button"
                  onClick={() => removeVsys(vIndex)}
                  className="text-xs text-red-500 ml-2"
                >
                  Remove VSys
                </button>
              </div>

              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-600">
                    Gates
                  </label>

                  <button
                    type="button"
                    onClick={() => addGate(vIndex)}
                    className="text-xs text-blue-600"
                  >
                    + Add
                  </button>
                </div>

                {v.gates.map((g, gIndex) => (
                  <div
                    key={gIndex}
                    className="flex gap-2 mb-1"
                  >
                    <input
                      value={g}
                      onChange={(e) =>
                        updateGate(
                          vIndex,
                          gIndex,
                          e.target.value
                        )
                      }
                      className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        removeGate(vIndex, gIndex)
                      }
                      className="text-xs text-red-500 px-2"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-600">
                    Zones
                  </label>

                  <button
                    type="button"
                    onClick={() => addZone(vIndex)}
                    className="text-xs text-blue-600"
                  >
                    + Add
                  </button>
                </div>

                {v.zones.map((z, zIndex) => (
                  <div
                    key={zIndex}
                    className="flex gap-2 mb-1"
                  >
                    <input
                      value={z}
                      onChange={(e) =>
                        updateZone(
                          vIndex,
                          zIndex,
                          e.target.value
                        )
                      }
                      className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        removeZone(vIndex, zIndex)
                      }
                      className="text-xs text-red-500 px-2"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {error && (
            <p className="text-xs text-red-500 mb-2">
              {error}
            </p>
          )}

          {info && (
            <p className="text-xs text-blue-600 mb-2">
              {info}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={submitting}
              className="flex-1 bg-blue-600 text-white text-sm py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Changes"}
            </button>

            <button
              onClick={handleDeleteFirewall}
              disabled={submitting}
              className="px-4 border border-red-300 text-red-600 text-sm py-2 rounded-md hover:bg-red-50 disabled:opacity-50"
            >
              Delete Firewall
            </button>
          </div>
        </>
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.721-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.981-1.742 2.981H4.42c-1.53 0-2.493-1.647-1.743-2.981l5.58-9.92zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-2a1 1 0 01-1-1V7a1 1 0 112 0v3a1 1 0 01-1 1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>

                <div>
                  <h2 className="text-base font-semibold text-slate-800">
                    Delete Firewall
                  </h2>

                  <p className="mt-1 text-sm text-slate-600">
                    Are you sure you want to delete{" "}
                    <span className="font-semibold text-slate-800">
                      '{selected}'
                    </span>
                    ?
                  </p>

                  <p className="mt-2 text-sm text-red-600">
                    This will permanently remove the firewall,
                    all related VSys, and connections. This action
                    cannot be undone.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 rounded-b-lg">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDeleteFirewall}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete Firewall
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success / Error notification modal */}
      {notification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white shadow-xl">
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    notification.type === "success"
                      ? "bg-green-100 text-green-600"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  {notification.type === "success" ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 5.29a1 1 0 010 1.42l-7.2 7.2a1 1 0 01-1.416 0l-3.792-3.792a1 1 0 011.416-1.416l3.084 3.084 6.492-6.496a1 1 0 011.416 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.5a.75.75 0 10-1.5 0v4a.75.75 0 001.5 0v-4zM10 14a1 1 0 100-2 1 1 0 000 2z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>

                <div>
                  <h2 className="text-base font-semibold text-slate-800">
                    {notification.type === "success"
                      ? "Success"
                      : "Operation Failed"}
                  </h2>

                  <p className="mt-1 text-sm text-slate-600">
                    {notification.message}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-3 rounded-b-lg">
              <button
                type="button"
                onClick={() => setNotification(null)}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
                  notification.type === "success"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}