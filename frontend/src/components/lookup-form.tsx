import { useState } from 'react'
import { Play, Loader2 } from 'lucide-react'
import type { SingleResolveResponse, ApiError, HopRowDetail } from '../types/api';
import { resolvePath } from '../api/resolve';
import { convertHopRowToDetail } from '@/utils/converter';
import { PathHopsSection } from './path-hops';

export function LookupForm() {
  const [sourceIp, setSourceIp] = useState('')
  const [destinationIp, setDestinationIp] = useState('')
  const [port, setPort] = useState('')
  const [resolving, setResolving] = useState(false)
  const [result, setResult] = useState<SingleResolveResponse | null>(null)
  const [error, setError] = useState<string | null>(null);
  const [ticketNumber, setTicketNumber] = useState<string>("");
  

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if(!sourceIp || !destinationIp) {
      setError("Please fill in Source and Destination");
      setTimeout(() => {
        setError("");
      }, 3000);
      return;
    }

    if (!sourceIp.trim() || !destinationIp.trim()) return;

    setResolving(true)
    setResult(null)
    setError(null)

    try {
      const data = await resolvePath(
        sourceIp.trim(),
        destinationIp.trim(),
        port.trim(),
        ticketNumber.trim(),
      );

      setResult(data);
    } catch (err: any) {
      console.error("Failed to process path:", err);
      const apiError: ApiError = err.response?.data;
      setError(apiError?.detail || "Server error");
    } finally {
      setResolving(false)
    }
  }

  const hopDetails: HopRowDetail[] = result?.rows.map(convertHopRowToDetail) ?? [];

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-border bg-card p-6 lg:p-8"
      >
        <h1 className="text-3xl font-bold text-foreground">
          New Path Resolution
        </h1>
        <p className="mt-2 text-muted-foreground">
          Define the source and destination endpoints in order to determine the appropiate path resolution.
        </p>
        {error && (
          <div className='text-center font-bold bg-danger p-4'>
            Error: {error}
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div>
            <label
              htmlFor="source-ip"
              className="text-sm font-bold text-foreground"
            >
              Source IP / Subnet*
            </label>
            <input
              id="source-ip"
              type="text"
              value={sourceIp}
              onChange={(e) => setSourceIp(e.target.value)}
              className="mt-2 h-14 w-full rounded-md border border-input bg-secondary px-4 font-mono text-base outline-none focus:border-ring"
              placeholder="192.168.1.0/24"
            />
            <p className="mt-2 text-sm text-muted-foreground">
              e.g., 192.168.1.0/24 or specific IP
            </p>
          </div>
          <div>
            <label
              htmlFor="destination-ip"
              className="text-sm font-bold text-foreground"
            >
              Destination IP / Subnet*
            </label>
            <input
              id="destination-ip"
              type="text"
              value={destinationIp}
              onChange={(e) => setDestinationIp(e.target.value)}
              className="mt-2 h-14 w-full rounded-md border border-input bg-secondary px-4 font-mono text-base outline-none focus:border-ring"
              placeholder="172.16.80.100/32"
            />
            <p className="mt-2 text-sm text-muted-foreground">
              Target application or server range
            </p>
          </div>
          <div>
            <label
              htmlFor="port"
              className="text-sm font-bold text-foreground"
            >
              Service / Port**
            </label>
            <input
              id="port"
              type="text"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="mt-2 h-14 w-full rounded-md border border-input bg-secondary px-4 font-mono text-base outline-none focus:border-ring"
              placeholder="443"
            />
            <p className="mt-2 text-sm text-muted-foreground">
              Target Port. e.g., 443
            </p>
          </div>
        </div>

        <div className='mt-5'>
            <label
              htmlFor="source-ip"
              className="text-sm font-bold text-foreground"
            >
              Input Ticket Number / Memo*
            </label>
            <input
              id="source-ip"
              type="text"
              value={ticketNumber}
              onChange={(e) => setTicketNumber(e.target.value)}
              className="mt-2 h-14 w-full rounded-md border border-input bg-secondary px-4 font-mono text-base outline-none focus:border-ring"
              placeholder="FW 1234 ABC"
            />
            <p className="mt-5 text-sm text-muted-foreground">
              * Required
            </p>
            <p className="text-sm text-muted-foreground">
              ** Optional
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
            {resolving ? 'Resolving...' : 'Resolve Path'}
          </button>
        </div>
      </form>

      {hopDetails && hopDetails.length > 0 && (
        <div className='border rounded'>
          <PathHopsSection hops={hopDetails} />
        </div>
      )}
    </div>
  )
}