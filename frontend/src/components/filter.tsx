import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { getDateRangeFromPreset, type DateRange } from '@/utils/formatDate';

export type DateRangePreset = 
  | 'last7days'
  | 'thisMonth'
  | 'prevMonth'
  | 'thisQuarter'
  | 'prevQuarter'
  | 'custom';

export interface SelectedFilter {
  preset: DateRangePreset;
  range: DateRange;
}

interface FilterAndExportProps {
  onDateRangeChange: (filter: SelectedFilter) => void;
}

const PRESET_LABELS: Record<DateRangePreset, string> = {
  last7days: 'Last 7 Days',
  thisMonth: 'This Month',
  prevMonth: 'Previous Month',
  thisQuarter: 'This Quarter',
  prevQuarter: 'Previous Quarter',
  custom: 'Custom Range',
};

export const FilterAndExport: React.FC<FilterAndExportProps> = ({
  onDateRangeChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset>('last7days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showCustomInputs, setShowCustomInputs] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectPreset = (preset: DateRangePreset) => {
    setSelectedPreset(preset);
    if (preset === 'custom') {
      setShowCustomInputs(true);
    } else {
      setShowCustomInputs(false);
      setIsOpen(false);
      
      const range = getDateRangeFromPreset(preset);
      onDateRangeChange({ preset, range });
    }
  };

  const handleApplyCustom = () => {
    if (customStartDate && customEndDate) {
      setIsOpen(false);
      
      const range = getDateRangeFromPreset('custom', customStartDate, customEndDate);
      onDateRangeChange({ preset: 'custom', range });
    }
  };

  return (
    <div>
        <div className="flex items-center gap-3">
        {/* Date Dropdown */}
        <div className="relative" ref={dropdownRef}>
            <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 shadow-sm"
            >
            <span>{PRESET_LABELS[selectedPreset]}</span>
            <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>

            {isOpen && (
            <div className="absolute right-0 z-10 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg py-1 text-sm text-gray-700">
                {(Object.keys(PRESET_LABELS) as DateRangePreset[]).map((key) => (
                <button
                    key={key}
                    onClick={() => handleSelectPreset(key)}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center justify-between ${
                    selectedPreset === key ? 'font-semibold text-indigo-600 bg-indigo-50/50' : ''
                    }`}
                >
                    {PRESET_LABELS[key]}
                </button>
                ))}

                {showCustomInputs && (
                <div className="p-3 border-t border-gray-100 bg-gray-50 space-y-3">
                    <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                    <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                    />
                    </div>
                    <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                    <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                    />
                    </div>
                    <button
                    onClick={handleApplyCustom}
                    disabled={!customStartDate || !customEndDate}
                    className="w-full py-1.5 px-3 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                    Apply Custom Range
                    </button>
                </div>
                )}
            </div>
            )}
        </div>
        {selectedPreset === 'custom' && (
        <div className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 shadow-sm">
            {customStartDate} - {customEndDate}
        </div>
        )}
        </div>
    </div>
  );
};