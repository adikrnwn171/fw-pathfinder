import { Link } from 'react-router-dom'
import {
  Waypoints,
  ArrowRight,
  List,
} from 'lucide-react'
import { RequestsHistoryTable } from '@/components/requests-history-table'
import { useState, useEffect } from 'react'
import { type StatsBucket, type RequestListResponse, type RequestSummary } from '@/types/api'
import { fetchHistoryEntries } from "@/api/requests";
import axios from 'axios'
import { getStats } from '@/api/statistic'
import { getLast7DaysData, getCurrentMonthStats } from '@/utils/utility'


export default function DashboardPage() {
  const [historyEntries, setHistoryEntries] = useState<RequestListResponse | null>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const PAGE_SIZE = 5;
  const [page, _setPage] = useState<number>(1);
  const [daily, setDaily] = useState<StatsBucket[]>([])
  const [monthly, setMonthly] = useState<StatsBucket[]>([])

  useEffect(() => {
      const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
          const data = await fetchHistoryEntries(page, PAGE_SIZE)
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
  }, [page]);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const responseStats = await getStats();
        const last7days = getLast7DaysData(responseStats.buckets);
        setDaily(last7days)
        const respMonthly = await getStats('monthly');
        const thisMonth = getCurrentMonthStats(respMonthly.buckets);
        setMonthly([{
          period_label: thisMonth.period_label,
          request_count: thisMonth.totalRequests,
          hop_count: thisMonth.totalHops,
          unique_firewalls: thisMonth.uniqueFirewalls,
          impacted_firewalls: thisMonth.impactedFirewalls
        }]);
      } catch (error) {
        setError('Failed to load statistic');
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats()
  }, [historyEntries]);

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

  const totals = daily.reduce(
    (acc, item) => {
      acc.totalRequests += item.request_count;
      acc.totalHops += item.hop_count;
      return acc;
    },
    { totalRequests: 0, totalHops: 0 } 
  );


  return (
    <div className="mx-auto max-w-6xl">
      {isLoading && (
        <div className="p-4 bg-warning-foreground border border-accent-200 text-accent-700 rounded-xl text-sm font-medium text-center">
          Loading Data
        </div>
      )}
      <h1 className="text-3xl font-bold text-foreground">Overview</h1>
      <p className="mt-1 text-muted-foreground">
        Recent path resolution activity and statistic
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div
            className="rounded-lg border border-border bg-card p-6"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium tracking-wide text-muted-foreground">
                Total Request in Last 7 Day
              </p>
              <List
                className="size-5 text-muted-foreground/60"
                aria-hidden="true"
              />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <p className="text-4xl font-bold tracking-tight text-foreground">
                {totals.totalRequests}
              </p>
            </div>  
          </div>
          <div
            className="rounded-lg border border-border bg-card p-6"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium tracking-wide text-muted-foreground">
                Total Rule in Last 7 Days
              </p>
              <Waypoints
                className="size-5 text-muted-foreground/60"
                aria-hidden="true"
              />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <p className="text-4xl font-bold tracking-tight text-foreground">
                {totals.totalHops}
              </p>
            </div>  
          </div>


      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div
            className="rounded-lg border border-border bg-card p-6"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium tracking-wide text-muted-foreground">
                Total Request This Month
              </p>
              <List
                className="size-5 text-muted-foreground/60"
                aria-hidden="true"
              />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <p className="text-4xl font-bold tracking-tight text-foreground">
                {monthly[0]?.request_count}
              </p>
            </div>  
          </div>
          <div
            className="rounded-lg border border-border bg-card p-6"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium tracking-wide text-muted-foreground">
                Total Rule in This Month
              </p>
              <Waypoints
                className="size-5 text-muted-foreground/60"
                aria-hidden="true"
              />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <p className="text-4xl font-bold tracking-tight text-foreground">
                {monthly[0]?.hop_count}
              </p>
            </div>  
          </div>


      </div>
      <div className="mt-8 rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-bold text-foreground">
            Recent Resolutions
          </h2>
          <Link
            to="/history"
            className="flex items-center gap-1.5 font-mono text-sm text-foreground hover:underline"
          >
            View All
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-medium">
                ⚠️ {error}
            </div>
            )}
        {historyEntries && <RequestsHistoryTable {...historyEntries} onRequestUpdated={handleUpdate} onDeletedRequest={handleDelete}/>}

      </div>
      
    </div>
  )
}