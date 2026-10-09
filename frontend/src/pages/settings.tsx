import {
  SlidersHorizontal,
  Link2,
  Table,
  Activity,
  RefreshCw,
  BookOpen,
  ExternalLink,
} from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-bold text-foreground">Settings</h1>
      <p className="mt-1 text-muted-foreground">
        Configure system parameters and monitor backend connectivity.
      </p>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.9fr_1fr]">
        <div className="flex flex-col rounded-lg border border-border bg-card p-6 lg:p-8">
          <div className="flex items-center gap-3 border-b border-border pb-5">
            <SlidersHorizontal className="size-6" aria-hidden="true" />
            <h2 className="text-2xl font-bold text-foreground">
              System Configuration
            </h2>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <div>
              <label
                htmlFor="api-base-url"
                className="text-sm font-bold text-foreground"
              >
                API Base URL
              </label>
              <div className="relative mt-2">
                <Link2
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  id="api-base-url"
                  type="text"
                  readOnly
                  value="https://api.internal.netshield.corp/v2/"
                  className="h-12 w-full rounded-md border border-input bg-secondary pl-10 pr-3 font-mono text-sm text-foreground outline-none"
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Configured via environment variables.
              </p>
            </div>
            <div>
              <label
                htmlFor="max-batch-rows"
                className="text-sm font-bold text-foreground"
              >
                Max Batch Rows
              </label>
              <div className="relative mt-2">
                <Table
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  id="max-batch-rows"
                  type="text"
                  readOnly
                  value="2000"
                  className="h-12 w-full rounded-md border border-input bg-secondary pl-10 pr-3 font-mono text-sm text-foreground outline-none"
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Hard limit set by backend policy.
              </p>
            </div>
          </div>

          <div className="mt-auto flex justify-end pt-10">
            <button
              type="button"
              className="rounded-md border border-border px-6 py-3 font-mono text-sm text-foreground hover:bg-secondary"
            >
              Edit Configuration{' '}
              <span className="text-muted-foreground">(Requires Admin)</span>
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between border-b border-border pb-5">
            <div className="flex items-center gap-3">
              <Activity className="size-6" aria-hidden="true" />
              <h2 className="text-xl font-bold text-foreground">
                Backend Health
              </h2>
            </div>
            <span className="flex items-center gap-1.5 rounded-md bg-success-foreground px-2.5 py-1 font-mono text-xs font-semibold text-success">
              <span
                className="size-1.5 rounded-full bg-success"
                aria-hidden="true"
              />
              HEALTHY
            </span>
          </div>

          <dl className="mt-5 space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Endpoint</dt>
              <dd className="font-mono text-foreground">/health</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Latency</dt>
              <dd className="font-mono text-foreground">24ms</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Uptime</dt>
              <dd className="font-mono text-foreground">99.98%</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Last Checked</dt>
              <dd className="font-mono text-foreground">Just now</dd>
            </div>
          </dl>

          <button
            type="button"
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-3 font-mono text-sm text-foreground hover:bg-secondary"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Re-verify Connection
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card p-6 lg:p-8">
        <div className="flex items-center gap-3 border-b border-border pb-5">
          <BookOpen className="size-6" aria-hidden="true" />
          <h2 className="text-2xl font-bold text-foreground">
            Documentation & Resources
          </h2>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <a
            href="#"
            className="group rounded-md border border-border p-6 transition-colors hover:bg-secondary"
          >
            <div className="flex items-start justify-between">
              <h3 className="text-xl font-bold text-foreground">
                Network Policies
              </h3>
              <ExternalLink
                className="size-5 text-muted-foreground group-hover:text-foreground"
                aria-hidden="true"
              />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Internal documentation for firewall routing rules and corporate
              compliance.
            </p>
          </a>
          <a
            href="#"
            className="group rounded-md border border-border p-6 transition-colors hover:bg-secondary"
          >
            <div className="flex items-start justify-between">
              <h3 className="text-xl font-bold text-foreground">
                API Reference
              </h3>
              <ExternalLink
                className="size-5 text-muted-foreground group-hover:text-foreground"
                aria-hidden="true"
              />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Endpoints, schemas, and authentication methods for the Resolver
              backend
            </p>
          </a>
        </div>
      </div>
    </div>
  )
}