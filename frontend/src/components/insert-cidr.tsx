import { useState } from "react";

import { addCidr, addFw } from "@/api/references";

interface FormState {
  location: string;
  firewall1: string;
  firewall2: string;
  vsys: string;
  zone: string;
  segment: string;
  exist_in_gates: boolean;
}

const emptyForm: FormState = {
  location: "",
  firewall1: "",
  firewall2: "",
  vsys: "",
  zone: "",
  segment: "",
  exist_in_gates: false,
};

function looksLikeCidr(value: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(value.trim());
}

export function InsertCidr({ onCreated }: { onCreated?: () => void }) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): string | null {
    if (!form.location.trim()) return "Location is required";
    if (!form.firewall1.trim()) return "Firewall1 is required";
    if (!form.vsys.trim()) return "VSys is required";
    if (!form.zone.trim()) return "Zone is required";
    if (!form.segment.trim()) return "Segment is required";
    if (!looksLikeCidr(form.segment)) {
      return "Segment format must be CIDR, e.g. 10.0.107.0/25";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationError = validate();

    if (validationError) {
      setError(validationError);
      setNotification({
        type: "error",
        message: validationError,
      });
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotification(null);

    try {
      await addCidr({
        location: form.location.trim(),
        firewall1: form.firewall1.trim(),
        firewall2: form.firewall2.trim() || null,
        vsys: form.vsys.trim(),
        zone: form.zone.trim(),
        segment: form.segment.trim(),
        exist_in_gates: "FALSE",
      });

      await addFw({ 
        name: form.firewall1.trim(),
        vsys: [
            {
                name: form.vsys.trim(),
                gates: [],
                zones: [form.zone.trim()],
            },
        ]
      })

      const savedSegment = form.segment.trim();

      setForm(emptyForm);
      onCreated?.();

      setNotification({
        type: "success",
        message: `CIDR '${savedSegment}' has been added successfully.`,
      });
    } catch (err: any) {
      const message =
        err.response?.data?.detail ??
        err.message ??
        "Failed to save";

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
      <form
        onSubmit={handleSubmit}
        className="p-4 border border-slate-200 rounded-lg bg-white"
      >
        <h3 className="font-semibold text-slate-800 mb-3 text-sm">
          Add CIDR Entry
        </h3>
        <p className="font-semibold text-slate-500 mb-3 text-sm">
          Add new segment or new firewall
        </p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Location">
            <input
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
            />
          </Field>

          <Field label="Firewall1">
            <input
              value={form.firewall1}
              onChange={(e) => set("firewall1", e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
            />
          </Field>

          <Field label="Firewall2">
            <input
              value={form.firewall2}
              onChange={(e) => set("firewall2", e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
            />
          </Field>

          <Field label="VSys">
            <input
              value={form.vsys}
              onChange={(e) => set("vsys", e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
            />
          </Field>

          <Field label="Zone">
            <input
              value={form.zone}
              onChange={(e) => set("zone", e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
            />
          </Field>

          <Field label="Segment (CIDR)">
            <input
              value={form.segment}
              onChange={(e) => set("segment", e.target.value)}
              placeholder="10.0.107.0/25"
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm font-mono"
            />
          </Field>
        </div>

        {/* <label className="flex items-center gap-2 mb-3 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={form.exist_in_gates}
            onChange={(e) => set("exist_in_gates", e.target.checked)}
          />
          Exist in Gates?
        </label> */}

        {error && (
          <p className="text-xs text-red-500 mb-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="cursor-pointer w-full bg-blue-600 text-white text-sm py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save Entry"}
        </button>
      </form>

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
                    {notification.type === "success" ? "Success" : "Failed"}
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 block mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}