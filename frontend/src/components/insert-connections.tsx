import { useEffect, useMemo, useState } from "react";
import { addConnection, fetchFwDb } from "@/api/references";
import type { TopologyGraphResponse, ConnectionEndpoint } from "@/types/api";

const emptyEndpoint: ConnectionEndpoint = {
  firewall: "",
  vsys: "",
  gate: "",
};

function EndpointPicker({
  label,
  graph,
  value,
  onChange,
}: {
  label: string;
  graph: TopologyGraphResponse | undefined;
  value: ConnectionEndpoint;
  onChange: (v: ConnectionEndpoint) => void;
}) {
  const firewalls = graph?.firewalls ?? [];
  const selectedFw = firewalls.find((f) => f.name === value.firewall);
  const selectedVsys = selectedFw?.vsys.find((v) => v.name === value.vsys);

  return (
    <div className="border border-slate-200 rounded-md p-3">
      <p className="text-xs font-semibold text-slate-600 mb-2">{label}</p>

      <select
        value={value.firewall}
        onChange={(e) =>
          onChange({
            firewall: e.target.value,
            vsys: "",
            gate: "",
          })
        }
        className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm mb-2"
      >
        <option value="">Select Firewall</option>
        {firewalls.map((f) => (
          <option key={f.name} value={f.name}>
            {f.name}
          </option>
        ))}
      </select>

      <select
        value={value.vsys}
        onChange={(e) =>
          onChange({
            ...value,
            vsys: e.target.value,
            gate: "",
          })
        }
        disabled={!selectedFw}
        className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm mb-2 disabled:bg-slate-100"
      >
        <option value="">Select VSys</option>
        {selectedFw?.vsys.map((v) => (
          <option key={v.name} value={v.name}>
            {v.name}
          </option>
        ))}
      </select>

      <select
        value={value.gate}
        onChange={(e) =>
          onChange({
            ...value,
            gate: e.target.value,
          })
        }
        disabled={!selectedVsys}
        className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm disabled:bg-slate-100"
      >
        <option value="">Select Gate</option>
        {selectedVsys?.gates.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
    </div>
  );
}

export function InsertConnection({
  onCreated,
}: {
  onCreated?: () => void;
}) {
  const [graph, setGraph] = useState<TopologyGraphResponse>();
  const [from, setFrom] =
    useState<ConnectionEndpoint>(emptyEndpoint);
  const [to, setTo] =
    useState<ConnectionEndpoint>(emptyEndpoint);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const isComplete = (ep: ConnectionEndpoint) =>
    Boolean(ep.firewall && ep.vsys && ep.gate);

  const canSubmit = useMemo(
    () => isComplete(from) && isComplete(to),
    [from, to]
  );

  useEffect(() => {
    fetchFwDb().then((result) => {
      setGraph(result);
    });
  }, []);

  async function handleSubmit() {
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    setNotification(null);

    try {
      await addConnection({ from, to });

      setFrom(emptyEndpoint);
      setTo(emptyEndpoint);

      fetchFwDb().then((result) => {
        setGraph(result);
      });

      onCreated?.();

      setNotification({
        type: "success",
        message: `Connection from '${from.firewall} / ${from.vsys} / ${from.gate}' to '${to.firewall} / ${to.vsys} / ${to.gate}' has been added successfully.`,
      });
    } catch (err: any) {
      const message =
        err.response?.data?.detail ??
        err.message ??
        "Failed to save connection";

      setError(message);

      setNotification({
        type: "error",
        message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="p-4 border border-slate-200 rounded-lg bg-white mt-10">
        <h3 className="font-semibold text-slate-800 mb-3 text-sm">
          Add Connection
        </h3>
        <p className="font-semibold text-slate-500 mb-3 text-sm">
          Add new connection between firewall
        </p>

        <div className="grid grid-cols-1 gap-3 mb-3">
          <EndpointPicker
            label="From (Endpoint A)"
            graph={graph}
            value={from}
            onChange={setFrom}
          />

          <EndpointPicker
            label="To (Endpoint B)"
            graph={graph}
            value={to}
            onChange={setTo}
          />
        </div>

        {error && (
          <p className="text-xs text-red-500 mb-2">
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-full bg-blue-600 text-white text-sm py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save Connection"}
        </button>
      </div>

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
                      : "Failed"}
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
    </>
  );
}