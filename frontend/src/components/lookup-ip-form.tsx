import { useState } from 'react'
import { Play, Loader2 } from 'lucide-react'
import type { ApiError, IpResolve } from '../types/api';
import { resolveIp } from '../api/resolve';

export function LookupIpForm() {
    const [ip, setIp] = useState<string>('');
    const [resolving, setResolving] = useState(false)
    const [result, setResult] = useState<IpResolve | null>(null)
    const [error, setError] = useState<string | null>(null);
  

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()

        if(!ip) {
        setError("Please enter the IP Address");
        setTimeout(() => {
            setError("");
        }, 3000);
        return;
        }

        if (!ip.trim()) return;

        setResolving(true)
        setResult(null)
        setError(null)

        try {
        const data = await resolveIp(
            ip.trim(),
        );

        setResult(data);
        } catch (err: any) {
        console.error("Failed to process:", err);
        const apiError: ApiError = err.response?.data;
        setError(apiError?.detail || "Server error")
        } finally {
        setResolving(false)
        }
    }


  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-border bg-card p-6 lg:p-8"
      >
        <h1 className="text-3xl font-bold text-foreground">
          IP Address Lookup
        </h1>
        <p className="mt-2 text-muted-foreground">
          Discover which firewall, security zone, and network segment an IP address belongs to.
        </p>
        {error && (
          <div className='text-center font-bold bg-danger p-4'>
            Error: {error}
          </div>
        )}

        <div className='mt-5'>
            <label
              htmlFor="source-ip"
              className="text-sm font-bold text-foreground"
            >
              Input IP Address / Subnet*
            </label>
            <input
              id="source-ip"
              type="text"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              className="mt-2 h-14 w-full rounded-md border border-input bg-secondary px-4 font-mono text-base outline-none focus:border-ring"
              placeholder="192.168.0.102"
            />
            <p className="mt-5 text-sm text-muted-foreground">
              * Required
            </p>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="submit"
            disabled={resolving}
            className="flex items-center cursor-pointer gap-2.5 rounded-md bg-primary px-8 py-4 font-mono text-sm text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {resolving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="size-4" aria-hidden="true" />
            )}
            {resolving ? 'Resolving...' : 'Resolve IP'}
          </button>
        </div>
      </form>


        {result && (
        <div className='border rounded'>
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-border bg-secondary text-xs font-semibold tracking-wider text-muted-foreground">
                        <th className="px-3 py-3">IP Address</th>
                        <th className="px-3 py-3">Firewall Name</th>
                        <th className="px-3 py-3">VSys</th>
                        <th className="px-3 py-3">Zone</th>
                        <th className="px-3 py-3">Segment</th>
                        <th className="px-3 py-3">Notes</th>
                        <th className="px-3 py-3">Location</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className='px-3 py-3'>{result.ip}</td>
                        <td className='px-3 py-3'>{result.firewall}</td>
                        <td className='px-3 py-3'>{result.vsys}</td>
                        <td className='px-3 py-3'>{result.zone}</td>
                        <td className='px-3 py-3'>{result.segment}</td>
                        <td className='px-3 py-3'>{result.notes}</td>
                        <td className='px-3 py-3'>{result.location}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        )}
    </div>
  )
}