'use client';
import React, { useMemo, forwardRef, useState, useEffect } from 'react';
import { ReportConfig } from '../engine/types';
import { HiDocumentSearch } from 'react-icons/hi';

interface GenericDataTableProps<T extends Record<string, unknown>> {
  config: ReportConfig<T>;
  data: T[];
  visibleColumns: string[];
  onSelectionChange?: (selectedRows: T[]) => void;
  isLoading?: boolean;
}

export const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === 0 || value === '') return '-';
  return String(value);
};

const formatNumeric = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '–';
  const num = Number(value);
  if (isNaN(num)) return String(value);
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const isNumericColumn = (colLabel?: string, dataKey?: string): boolean => {
  const numKeywords = ['total', 'amount', 'price', 'qty', 'quantity', 'cost', 'value', 'balance', 'tax', 'amt'];
  const check = (str: string) => numKeywords.some(kw => str.toLowerCase().includes(kw));
  return Boolean((colLabel && check(colLabel)) || (dataKey && check(dataKey)));
};

const GenericDataTable = forwardRef(
  <T extends Record<string, unknown>>(
    { config, data, visibleColumns, onSelectionChange, isLoading }: GenericDataTableProps<T>,
    ref: React.Ref<HTMLDivElement>
  ) => {
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

    const safeConfig = config ?? { columns: [] };
    const safeData = Array.isArray(data) ? data : [];
    const safeCols = Array.isArray(visibleColumns) ? visibleColumns : [];

    useEffect(() => {
      onSelectionChange?.(Array.from(selectedIndices).map(i => safeData[i]));
    }, [selectedIndices, safeData, onSelectionChange]);

    const toggleRow = (index: number) => {
      const newSelection = new Set(selectedIndices);
      if (newSelection.has(index)) newSelection.delete(index);
      else newSelection.add(index);
      setSelectedIndices(newSelection);
    };

    const toggleAll = () => {
      if (selectedIndices.size === safeData.length && safeData.length > 0) {
        setSelectedIndices(new Set());
      } else {
        setSelectedIndices(new Set(safeData.map((_, i) => i)));
      }
    };

    const gridTemplate = useMemo(() => {
      const columnCount = safeCols.length;
      const columns = Array(columnCount).fill('minmax(190px, 1fr)').join(' ');
      return `40px ${columns}`;
    }, [safeCols.length]);

    return (
      <div className="relative h-full w-full overflow-hidden border border-slate-300 rounded-md bg-white shadow-sm flex flex-col">

        {/* LOADING OVERLAY */}
        {isLoading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70 backdrop-blur-[2px] transition-all">
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-end gap-1.5 h-7">
                <div className="w-2 h-full bg-black rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-4 bg-black rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-6 bg-black rounded-full animate-bounce"></div>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-black">
                Indexing
              </span>
            </div>
          </div>
        )}

        <div
          ref={ref}
          className="table-scroll-container h-full w-full overflow-auto select-text"
        >
          <div
            className="flex flex-col"
            style={{
              display: 'grid',
              gridTemplateColumns: gridTemplate,
              minWidth: '100%'
            }}
          >
            {/* HEADER SECTION */}
            <div
              className="sticky top-0 z-20 bg-slate-100 border-b border-slate-300 shadow-sm grid-cols-subgrid"
              style={{ display: 'grid', gridTemplateColumns: 'subgrid', gridColumn: '1 / -1' }}
            >
              <div className="flex items-center justify-center border-r border-slate-200 bg-slate-100">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 rounded border-slate-400 text-black focus:ring-black cursor-pointer accent-black"
                  checked={safeData.length > 0 && selectedIndices.size === safeData.length}
                  onChange={toggleAll}
                  disabled={isLoading}
                />
              </div>

              {safeCols.map((key) => {
                const col = safeConfig.columns.find((c) => c?.displayKey === key);
                const isNum = isNumericColumn(col?.label, col?.dataKey);
                return (
                  <div
                    key={key}
                    className={`px-2.5 py-3 border-r border-slate-200 text-[10px] font-bold uppercase text-slate-500 tracking-wider whitespace-nowrap overflow-hidden text-ellipsis ${isNum ? 'text-right' : 'text-left'}`}
                  >
                    {col?.label ?? key}
                  </div>
                );
              })}
            </div>

         {/* CONTENT AREA */}
<div className="contents">
  {!isLoading && safeData.length === 0 ? (
    /* FIX: Use absolute positioning relative to the 'table-scroll-container' 
       so the message stays in the visual center regardless of horizontal scroll.
    */
    <div
      className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
      style={{ 
        marginTop: '44px', // This offsets the height of the sticky header
        height: 'calc(100% - 44px)' 
      }}
    >
      <div className="flex flex-col items-center text-center p-8 pointer-events-auto">
        <div className="bg-slate-50 p-4 rounded-full mb-3 border border-slate-100 shadow-sm">
          <HiDocumentSearch className="text-slate-300 text-4xl" />
        </div>
        <h3 className="text-black font-black uppercase tracking-[0.3em] text-[10px]">
          No Records Found
        </h3>
        <p className="text-slate-400 text-[9px] mt-1 font-medium uppercase tracking-tighter">
          Please adjust your search or filters
        </p>
      </div>
    </div>
  ) : (
                safeData.map((row, i) => {
                  const isSelected = selectedIndices.has(i);
                  return (
                    <div
                      key={i}
                      style={{ display: 'grid', gridTemplateColumns: 'subgrid', gridColumn: '1 / -1' }}
                      className={`group border-b border-slate-100 transition-colors duration-75 
                        ${isSelected ? 'bg-slate-100' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} 
                        hover:bg-slate-200/50`}
                    >
                      <div className={`flex items-center justify-center border-r border-slate-100 transition-colors
                        ${isSelected ? 'bg-slate-200' : 'bg-inherit'} group-hover:bg-slate-200`}>
                        <input
                          type="checkbox"
                          className="w-3.5 h-3.5 rounded border-slate-400 text-black focus:ring-black cursor-pointer accent-black"
                          checked={isSelected}
                          onChange={() => toggleRow(i)}
                        />
                      </div>

                      {safeCols.map((key) => {
                        const col = safeConfig.columns.find((c) => c?.displayKey === key);
                        const isNum = isNumericColumn(col?.label, col?.dataKey);
                        const rawVal = row?.[col?.dataKey as string];
                        const formatted = isNum ? formatNumeric(rawVal) : formatValue(rawVal);
                        const isZero = isNum && (rawVal === 0 || rawVal === '0');

                        return (
                          <div
                            key={key}
                            className={`px-2.5 py-2.5 border-r border-slate-100 text-[12px] truncate overflow-hidden
                              ${isNum ? 'font-mono text-right' : 'text-left text-slate-700'}
                              ${isZero ? 'text-slate-300' : 'text-slate-900 font-medium'}
                              ${isSelected ? 'text-black font-bold' : ''}
                            `}
                          >
                            {formatted}
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

GenericDataTable.displayName = 'GenericDataTable';
export default GenericDataTable;