import { useState } from "react";
import { addFw } from "@/api/references";

interface VSysDraft {
  name: string;
  gates: string[];
  zones: string[];
}

function emptyVsys(): VSysDraft {
  return { name: "", gates: [], zones: [] };
}

export function InsertFw({ onCreated }: { onCreated?: () => void }) {
  const [name, setName] = useState("");
  const [vsysList, setVsysList] = useState<VSysDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function addVsys() {
    setVsysList((list) => [...list, emptyVsys()]);
  }

  function removeVsys(index: number) {
    setVsysList((list) => list.filter((_, i) => i !== index));
  }

  function updateVsysName(index: number, value: string) {
    setVsysList((list) => list.map((v, i) => (i === index ? { ...v, name: value } : v)));
  }

  function addGate(vIndex: number) {
    setVsysList((list) =>
      list.map((v, i) => (i === vIndex ? { ...v, gates: [...v.gates, ""] } : v))
    );
  }

  function updateGate(vIndex: number, gIndex: number, value: string) {
    setVsysList((list) =>
      list.map((v, i) =>
        i === vIndex ? { ...v, gates: v.gates.map((g, j) => (j === gIndex ? value : g)) } : v
      )
    );
  }

  function removeGate(vIndex: number, gIndex: number) {
    setVsysList((list) =>
      list.map((v, i) => (i === vIndex ? { ...v, gates: v.gates.filter((_, j) => j !== gIndex) } : v))
    );
  }

  function addZone(vIndex: number) {
    setVsysList((list) => list.map((v, i) => (i === vIndex ? { ...v, zones: [...v.zones, ""] } : v)));
  }

  function updateZone(vIndex: number, zIndex: number, value: string) {
    setVsysList((list) =>
      list.map((v, i) =>
        i === vIndex ? { ...v, zones: v.zones.map((z, j) => (j === zIndex ? value : z)) } : v
      )
    );
  }

  function removeZone(vIndex: number, zIndex: number) {
    setVsysList((list) =>
      list.map((v, i) => (i === vIndex ? { ...v, zones: v.zones.filter((_, j) => j !== zIndex) } : v))
    );
  }

  function validate(): string | null {
    if (!name.trim()) return "Firewall name is required";
    for (const v of vsysList) {
      if (!v.name.trim()) return "All VSys must have a name";
      if (v.gates.some((g) => !g.trim())) return `VSys '${v.name}': gate cannot be empty`;
      if (v.zones.some((z) => !z.trim())) return `VSys '${v.name}': zone cannot be empty`;
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
        setError(validationError);
        return;
    }


    setSubmitting(true);
    setError(null);
    try {
        await addFw({
            name: name.trim(),
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

        setName("");
        setVsysList([
            {
                name: "",
                gates: [""],
                zones: [""],
            },
        ]);

        onCreated?.();
    } catch (err: any) {
        setError(err.response?.data?.detail ?? err.message ?? "Failed to save");
    } finally {
        setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 border border-slate-200 rounded-lg bg-white mt-10">
      <h3 className="font-semibold text-slate-800 mb-3 text-sm">Add Firewall</h3>

      <div className="mb-3">
        <label className="text-xs font-medium text-slate-600 block mb-1">Firewall Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., DC-FW-TIER31-L3"
          className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-600">VSys</span>
        <button type="button" onClick={addVsys} className="text-xs text-blue-600">+ Add VSys</button>
      </div>

      {vsysList.map((v, vIndex) => (
        <div key={vIndex} className="border border-slate-200 rounded-md p-3 mb-3 bg-slate-50">
          <div className="flex items-center justify-between mb-2">
            <input value={v.name} onChange={(e) => updateVsysName(vIndex, e.target.value)}
              placeholder="VSys Name (e.g. vr_ecommerce)"
              className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm font-medium" />
            <button type="button" onClick={() => removeVsys(vIndex)} className="text-xs text-red-500 ml-2">
              Remove VSys
            </button>
          </div>

          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-600">Gates</label>
              <button type="button" onClick={() => addGate(vIndex)}
                className="text-xs text-blue-600">+ Add</button>
            </div>
            {v.gates.map((g, gIndex) => (
              <div key={gIndex} className="flex gap-2 mb-1">
                <input value={g} onChange={(e) => updateGate(vIndex, gIndex, e.target.value)}
                  placeholder="Inside / Outside"
                  className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm" />
                <button type="button" onClick={() => removeGate(vIndex, gIndex)} className="text-xs text-red-500 px-2">
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-600">Zones</label>
              <button type="button" onClick={() => addZone(vIndex)} className="text-xs text-blue-600">+ Add</button>
            </div>
            {v.zones.map((z, zIndex) => (
              <div key={zIndex} className="flex gap-2 mb-1">
                <input value={z} onChange={(e) => updateZone(vIndex, zIndex, e.target.value)}
                  placeholder="Zone name"
                  className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm" />
                <button type="button" onClick={() => removeZone(vIndex, zIndex)} className="text-xs text-red-500 px-2">
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      <button type="submit" disabled={submitting}
        className="w-full bg-blue-600 text-white text-sm py-2 rounded-md hover:bg-blue-700 disabled:opacity-50">
        {submitting ? "Saving..." : "Save Firewall"}
      </button>
    </form>
  );
}