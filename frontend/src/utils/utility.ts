import type { StatsBucket } from "@/types/api";


export function getLast7DaysData(apiBuckets: StatsBucket[]): StatsBucket[] {
  const bucketMap = new Map<string, StatsBucket>(
    apiBuckets.map((item) => [item.period_label, item])
  );

  const result: StatsBucket[] = [];
  const today = new Date();

  const jakartaDateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", 
  });

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);

    const dateStr = jakartaDateFormatter.format(d);

    if (bucketMap.has(dateStr)) {
      result.push(bucketMap.get(dateStr)!);
    } else {
      result.push({
        period_label: dateStr,
        request_count: 0,
        hop_count: 0,
        unique_firewalls: 0,
        impacted_firewalls: 0,
      });
    }
  }

  return result.reverse();
}

export function getCurrentMonthStats(buckets: StatsBucket[]) {
  // 1. Pick this month's string format (YYYY-MM) according to the Timezone Asia/Jakarta
  const now = new Date();
  const currentMonthStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).format(now); 

  // 2. Find this month's data
  const currentMonthData = buckets.find(
    (item) => item.period_label === currentMonthStr
  );

  // 3. Return this month's data (if null will return 0)
  return {
    period_label: currentMonthStr,
    totalRequests: currentMonthData?.request_count ?? 0,
    totalHops: currentMonthData?.hop_count ?? 0,
    uniqueFirewalls: currentMonthData?.unique_firewalls ?? 0,
    impactedFirewalls: currentMonthData?.impacted_firewalls ?? 0,
  };
}


export function countReqStats(buckets: StatsBucket[]) {
  return buckets.reduce((acc, curr) => {
    acc.total_request_count += curr.request_count || 0;
    acc.total_hop_count += curr.hop_count || 0;
    acc.total_unique_firewalls += curr.unique_firewalls || 0;
    acc.total_impacted_firewalls += curr.impacted_firewalls || 0;
    return acc;
  }, {
    total_request_count: 0,
    total_hop_count: 0,
    total_unique_firewalls: 0,
    total_impacted_firewalls: 0
  });
}


export function getInitials(email?: string | null): string {
  if (!email) return "??";

  const username = email.split("@")[0];
  const parts = username.split(/[._-]/).filter(Boolean);

  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  return username.slice(0, 2).toUpperCase();
}


// export const getDateRangeFromPreset = (
//   preset: string,
//   customStart?: string,
//   customEnd?: string
// ): DateRange => {
//   const now = new Date();
//   const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

//   switch (preset) {
//     case 'last7days': {
//       const start = new Date(today);
//       start.setDate(start.getDate() - 6);
//       start.setHours(0, 0, 0, 0);
//       return { startDate: start, endDate: today };
//     }
//     case 'thisMonth': {
//       const start = new Date(now.getFullYear(), now.getMonth(), 1);
//       return { startDate: start, endDate: today };
//     }
//     case 'prevMonth': {
//       const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
//       const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
//       return { startDate: start, endDate: end };
//     }
//     case 'thisQuarter': {
//       const currentQuarter = Math.floor(now.getMonth() / 3);
//       const start = new Date(now.getFullYear(), currentQuarter * 3, 1);
//       return { startDate: start, endDate: today };
//     }
//     case 'prevQuarter': {
//       const currentQuarter = Math.floor(now.getMonth() / 3);
//       const prevQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
//       const year = currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
//       const start = new Date(year, prevQuarter * 3, 1);
//       const end = new Date(year, (prevQuarter + 1) * 3, 0, 23, 59, 59);
//       return { startDate: start, endDate: end };
//     }
//     case 'custom': {
//       return {
//         startDate: customStart ? new Date(customStart) : today,
//         endDate: customEnd ? new Date(customEnd) : today,
//       };
//     }
//     default:
//       return { startDate: today, endDate: today };
//   }
// };