export interface DateRange {
  startDate: string; // Format YYYY-MM-DD
  endDate: string;   // Format YYYY-MM-DD
}


export const formateDateTime = (isoString?: string | null): string => {
  if (!isoString) return '-'

  const date = new Date(isoString)

  // Cek apakah date valid
  if (isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('en-UK', {
    day: '2-digit',
    month: 'numeric',   // 'short' = Jul, 'long' = Juli
    year: 'numeric',  // 2026
    hour: '2-digit',  // 11
    minute: '2-digit',// 24
    hour12: false,    // Format 24 jam (misal 11:24 bukan 11:24 AM)
  }).format(date)
}


const formatDate = (date: Date): string => {
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};


export const getDateRangeFromPreset = (
  preset: string,
  customStart?: string,
  customEnd?: string
): DateRange => {
  const now = new Date();

  if (preset === 'custom' && customStart && customEnd) {
    return { startDate: customStart, endDate: customEnd };
  }

  let start = new Date();
  let end = new Date();

  switch (preset) {
    case 'last7days':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      end = now;
      break;
    case 'thisMonth':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = now;
      break;
    case 'prevMonth':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'thisQuarter': {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), currentQuarter * 3, 1);
      end = now;
      break;
    }
    case 'prevQuarter': {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const prevQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
      const year = currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
      start = new Date(year, prevQuarter * 3, 1);
      end = new Date(year, (prevQuarter + 1) * 3, 0);
      break;
    }
  }

  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  };
};