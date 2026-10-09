import { StatCharts } from '@/components/stat-charts'

export default function StatisticsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-bold text-foreground">Analysis Statistic</h1>
      <p className="mt-1 text-muted-foreground">
        Displays summarized total request counts and rules over time.
      </p>
      <StatCharts />
    </div>
  )
}