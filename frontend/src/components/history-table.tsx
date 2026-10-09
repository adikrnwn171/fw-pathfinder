import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { fetchHistoryEntries } from '@/api/requests'
import type {  RequestListResponse, RequestSummary } from '@/types/api'
import axios from 'axios';
import { RequestsHistoryTable } from './requests-history-table'

export function HistoryTable() {
  const [historyEntries, setHistoryEntries] = useState<RequestListResponse | null>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const PAGE_SIZE = 20;
  const [page, setPage] = useState<number>(1);
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchInput])

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchHistoryEntries(page, PAGE_SIZE, debouncedSearch)
        setHistoryEntries(data)
      } catch (err) {
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.message || err.message)
        } else {
          setError(err instanceof Error ? err.message : 'Terjadi kesalahan yang tidak diketahui')
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [page, debouncedSearch]);

  const totalPages = historyEntries ? Math.ceil(historyEntries.total / historyEntries.page_size) : 1;

  const handleUpdate = (updatedRequest: RequestSummary) => {
  setHistoryEntries((prevList) => {
    if (!prevList) return prevList;

    return {
      ...prevList,
      items: prevList.items.map((item) =>
      item.id === updatedRequest.id ? updatedRequest : item)
    }
    })
  }

  const handleDelete = (deletedId: string) => {
  setHistoryEntries((prevList) => {
    if (!prevList) return prevList;

    const updatedItems = prevList.items.filter((item) => item.id !== deletedId);
    const updatedTotal = Math.max(0, prevList.total - 1);

      return {
        ...prevList,
        items: updatedItems,
        total: updatedTotal,
      };
    });
  };


  return (
    <div>
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Request History
          </h1>
          <p className="mt-1 text-muted-foreground">
            Audit and review historical path resolution requests.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by Status"
              aria-label="Search"
              className="h-11 w-72 rounded-md border border-input bg-card pl-9 pr-3 font-mono text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
            />
          </div>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto rounded-lg border border-border bg-card">
        {/* Alert Error */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-medium">
            ⚠️ {error}
          </div>
        )}

        {historyEntries && <RequestsHistoryTable {...historyEntries} onRequestUpdated={handleUpdate} onDeletedRequest={handleDelete}/>}

        {historyEntries && historyEntries.total > 0 && (
          <div className="bg-slate-100 px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-500 font-medium">
              Showing{' '}
              <span className="text-slate-800 font-semibold">
                {(page - 1) * PAGE_SIZE + 1}
              </span>{' '}
              -{' '}
              <span className="text-slate-800 font-semibold">
                {Math.min(page * PAGE_SIZE, historyEntries.total)}
              </span>{' '}
              from{' '}
              <span className="text-slate-800 font-semibold">{historyEntries.total}</span>{' '}
              result
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={page === 1 || isLoading}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                ← Previous
              </button>

              <div className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-bold">
                {page} / {totalPages}
              </div>

              <button
                onClick={() =>
                  setPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={page >= totalPages || isLoading}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-indigo-200"
              >
                Next →
              </button>
            </div>
          </div>
        )}
        
      </div>
    </div>
    </div>
  )
}