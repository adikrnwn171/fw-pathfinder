import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts'
import { useEffect, useState, useMemo } from 'react';
import { getStats } from '@/api/statistic';
import { getLast7DaysData } from '@/utils/utility';
import { type RequestListResponse, type StatsBucket, type StatsResponse, type RequestSummary } from '@/types/api';
import { FilterAndExport, type SelectedFilter } from './filter';
import { getDateRangeFromPreset } from '@/utils/formatDate';
import { fetchHistoryEntries } from '@/api/requests';
import { RequestsHistoryTable } from './requests-history-table';


export function StatCharts() {
  const [isLoading ,setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [daily, setDaily] = useState<StatsBucket[]>([]);
  const [maxRequests, setMaxRequests] = useState(0);
  const [filter, setFilter] = useState<SelectedFilter>({
    preset: 'last7days',
    range: getDateRangeFromPreset('last7days'),
  });
  const [dataFiltered, setDataFiltered] = useState<StatsResponse>();
  const [selectedFw, setSelectedFw] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<RequestListResponse>();


  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const responseStats = await getStats();
        const last7days = getLast7DaysData(responseStats.buckets);
        setDaily(last7days)
        if (last7days && last7days.length > 0) {
        const max = Math.max(...last7days.map((d) => d.request_count));
        setMaxRequests(max);
      }
      } catch (error) {
        setError('Failed to load statistic');
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats()
  }, [])

  useEffect(() => {
    const fetchStatsFiltering = async (startDate: string, endDate: string) => {
      const response = await getStats('daily' , startDate, endDate)
      setDataFiltered(response)

      const formattedTo = `${filter.range.endDate}T23:59:59`;
      const getRequests = await fetchHistoryEntries(1, 200, '' , startDate, formattedTo);
      setHistoryEntries(getRequests);
    };

    fetchStatsFiltering(filter.range.startDate, filter.range.endDate);
  }, [filter]);

  const filteredHistoryEntries = useMemo(() => {
    if (!selectedFw || !historyEntries?.items) return historyEntries;

    const filteredData = historyEntries.items.filter((item) => {
      const nodes = item.summary?.nodes;

      if (Array.isArray(nodes)) {
        return nodes.some((node: string) => 
          node.toLowerCase().includes(selectedFw.toLocaleLowerCase())
        );
      }

      return false;
    });

    return {
      ...historyEntries,
      items: filteredData
    };
  }, [historyEntries, selectedFw]);

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

  const handleClose = () => {
    setSelectedFw(null);
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>{error}</p>
      </div>
    )
  }


  return (
    <div className="mt-6 grid gap-6">
      <div className="rounded-lg border border-border bg-card p-6">

        <FilterAndExport onDateRangeChange={(newFilter) => setFilter(newFilter)}/>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div
              className="rounded-lg border border-border bg-card p-6"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium tracking-wide text-muted-foreground">
                  Total Request
                </p>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <p className="text-4xl font-bold tracking-tight text-foreground">
                  {dataFiltered?.total_requests}
                </p>
              </div>  
            </div>
            <div
              className="rounded-lg border border-border bg-card p-6"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium tracking-wide text-muted-foreground">
                  Total Rule
                </p>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <p className="text-4xl font-bold tracking-tight text-foreground">
                  {dataFiltered?.total_hops}
                </p>
              </div>  
            </div>
            <div
              className="rounded-lg border border-border bg-card p-6"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium tracking-wide text-muted-foreground">
                  Total Impacted Firewalls
                </p>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <p className="text-4xl font-bold tracking-tight text-foreground">
                  {dataFiltered?.total_impacted_firewalls}
                </p>
              </div>  
            </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 mt-5 w-full h-[400px]">
          <ResponsiveContainer width="100%" height="100%" className="justify-items-center">
          <BarChart
            style={{ width: '100%', maxHeight: '70vh', aspectRatio: 1.618 }}
            data={dataFiltered?.buckets}
            margin={{
              top: 5,
              right: 0,
              left: 0,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period_label" />
            <YAxis  />
            <Tooltip />
            <Legend />
            <Bar dataKey="request_count" name="Total Requests" fill="#000000" radius={[10, 10, 0, 0]} />
            <Bar dataKey="hop_count" name="Total Rule" fill="#2563eb"  radius={[10, 10, 0, 0]} />
          </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 mt-5 w-full">
          <div className="flex items-center justify-between">
            <p className="text-md font-medium tracking-wide text-muted-foreground">
              Impacted Firewalls
            </p>
          </div>
          <div className='mt-5 ms-10'>
            {dataFiltered?.impacted_firewall_names.map((item) =>(
              <li
              key={item}
              className='mb-3'
              >
                <button
                  type='button'
                  onClick={() => setSelectedFw(item)}
                  className='text-primary hover:underline font-medium text-left cursor-pointer'
                >
                  {item}
                </button>
              </li>
            ))}
          </div>
        </div>

      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-xl font-bold text-foreground">Daily requests over the last 7 days</h2>
        <div className="mt-6 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily} barCategoryGap="18%">
              <XAxis
                dataKey="period_label"
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: 'var(--muted-foreground)',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={36}
                tickFormatter={(v: number) => Math.round(v).toString()}
                tick={{
                  fill: 'var(--muted-foreground)',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                }}
              />
              <Tooltip
                cursor={{ fill: 'var(--secondary)' }}
                contentStyle={{
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                }}
              />
              <Bar dataKey="request_count" radius={[2, 2, 0, 0]}>
                {daily.map((d) => (
                  <Cell
                    key={d.period_label}
                    fill={
                      d.request_count === maxRequests ? 'var(--primary)' : 'var(--border)'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Modal showed when selectedFw not null */}
      {Boolean(selectedFw) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col p-6 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b pb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">
                Impacted Requests by : {selectedFw}
              </h3>
              <button
                type="button"
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1.5 hover:bg-gray-100 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Table Wrapper (Auto Scroll) */}
            <div className="flex-1 overflow-auto mt-4 pr-1">
              <RequestsHistoryTable 
                items={filteredHistoryEntries?.items ?? []}
                total={filteredHistoryEntries?.total ?? 0}
                page={filteredHistoryEntries?.page ?? 1}
                page_size={filteredHistoryEntries?.page_size ?? 20}
                onRequestUpdated={handleUpdate}
                onDeletedRequest={handleDelete}
              />
            </div>

          </div>
        </div>
      )}

    </div>

    
  )
}