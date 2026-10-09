import { useRef, useState } from 'react';
import { Download, FileUp, Info } from 'lucide-react';
import { cn } from '@/utils/utils';
import { downloadTemplateCsv } from '@/api/batch';
import { Play, Loader2 } from 'lucide-react'
import { resolveCsv } from '@/api/batch';
import type { CsvResolveResponse, HopRow, HopRowDetail } from '@/types/api';
import { PathHopsSection } from './path-hops';
import { convertHopRowToDetail } from '@/utils/converter';

export function BatchLookup() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CsvResolveResponse>();
  const [ticketNumber, setTicketNumber] = useState<string>();

  function handleFile(file: File | undefined) {
    if (file && file.name.endsWith('.csv') ||  file?.name.endsWith('.xlsx')) {
      setFileName(file.name)
    }
  }

  const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setResolving(true);

    if (!ticketNumber) {
      setError("Please input Ticket Number");
      setTimeout(() => {
        setError("");
      }, 3000);
      return;
    }

    const files = inputRef.current?.files
    if (!files || files.length === 0) {
      setError("Please choose csv file");
      setTimeout(() => {
        setError("");
      }, 3000);
      return;
    }
    const file = files[0];

    setError(null);

    try {
      const data = await resolveCsv(file, ticketNumber);
      setResult(data);
    } catch (err: any) {
      console.error("Upload error:", err);
      const message =
        err.response?.data?.detail || "Failed to upload file. Please try again";
      setError(message);
    } finally {
      setResolving(false);
    }
  }

  const rawHopRows: HopRow[] = result?.rows ?? []; 

  const hopDetails: HopRowDetail[] = rawHopRows.map(convertHopRowToDetail);


  return (
    // <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
    <div className="mt-8 grid gap-6">
      <div className="rounded-lg border border-border bg-card p-6">
        {error && (
          <div className='text-center font-bold bg-danger p-4'>
            Error: {error}
          </div>
        )}
        <div className='mb-5'>
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
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">File Upload*</h2>
          <button
            type="button"
            onClick={downloadTemplateCsv}
            className="flex cursor-pointer items-center gap-2 font-mono text-sm text-foreground hover:underline"
          >
            <Download className="size-4" aria-hidden="true" />
            Download Template
          </button>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFile(e.dataTransfer.files[0])
          }}
          className={cn(
            'mt-6 flex min-h-[360px] cursor-pointer flex-col items-center justify-center gap-4 rounded-md border-2 border-dashed p-8 transition-colors',
            dragging
              ? 'border-ring bg-accent/40'
              : 'border-border bg-secondary/60 hover:bg-secondary',
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx"
            className="sr-only"
            aria-label="Upload CSV file"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <FileUp className="size-10 text-foreground" aria-hidden="true" />
          <div className="text-center">
            <p className="text-xl font-bold text-foreground">
              {fileName ?? 'Drag & Drop file here'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              or click to browse files
            </p>
          </div>
          <p className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 font-mono text-xs text-muted-foreground">
            <Info className="size-3.5" aria-hidden="true" />
            {/* Max size 5MB. .csv only. */}
            XLSX or CSV only
          </p>
        </div>
        <p className="mt-5 text-sm text-muted-foreground">
          * Required
        </p>
        <div className="mt-8 flex justify-end">
          <button
            type="submit"
            disabled={resolving}
            onClick={handleSubmit}
            className="flex items-center gap-2.5 rounded-md bg-primary px-8 py-4 font-mono text-sm text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer"
          >
            {resolving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="size-4" aria-hidden="true" />
            )}
            {resolving ? 'Resolving...' : 'Resolve Path'}
          </button>
        </div>
      </div>

      {result && (
        <div>
          <h3 className="text-base font-semibold text-slate-900 mb-3">Total Rule</h3>
          <PathHopsSection hops={hopDetails} />
        </div>
      )}
    </div>
  )
}