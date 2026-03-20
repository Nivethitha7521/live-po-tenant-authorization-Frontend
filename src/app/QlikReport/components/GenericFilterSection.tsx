'use client';

import React, { useState } from 'react';
import { Box } from '@mui/material';
import { ReportConfig, ReportState } from '../engine/types';
import CollapsibleFilter from '@/components/Filter/CollapsibleFilter';

interface GenericFilterSectionProps<T extends Record<string, unknown>> {
  config: ReportConfig<T>;
  state: ReportState<T>;
  onFilterChange: (apiParam: string, values: string[]) => void;
  onClear: (apiParam: string) => void;
  onDropdownSearch?: (filterType: string, query: string) => void;
  onLoadMoreDropdown?: (filterType: string) => void;
}

function GenericFilterSection<T extends Record<string, unknown>>({
  config,
  state,
  onFilterChange,
  onClear,
  onDropdownSearch,
  onLoadMoreDropdown,
}: GenericFilterSectionProps<T>) {

  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const yearParam = config.filters.find((f) => f.type === 'year')?.apiParam;
  const monthParam = config.filters.find((f) => f.type === 'month')?.apiParam;
  const dayParam = config.filters.find((f) => f.type === 'day')?.apiParam;

  const colCount = Math.min(config.filters.length, 5);

  return (
    // FIX 1: Use inline style for dynamic grid columns (Tailwind can't parse `grid-cols-${var}`)
    // FIX 2: Added 'w-full' and 'min-w-0' to force items to shrink and stay in one row.
    <Box 
      className="grid gap-2 mb-2 ml-2 w-full" 
      style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
    >
      {config.filters.map((filterConf) => {

        const rawOptions = state.availableOptions[filterConf.type] ?? [];
        const selected = state.filters[filterConf.apiParam] ?? [];
        const pagination = state.dropdownPagination[filterConf.type];

        const options =
          filterConf.type === 'variance'
            ? rawOptions.filter((opt) => {
                const val = typeof opt === 'string' ? opt : opt.value;
                return !/^\d{1,2}$/.test(String(val));
              })
            : rawOptions;

        const otherYear =
          yearParam && filterConf.type !== 'year'
            ? state.filters[yearParam] ?? []
            : undefined;

        const otherMonth =
          monthParam && filterConf.type !== 'month'
            ? state.filters[monthParam] ?? []
            : undefined;

        const otherDay =
          dayParam && filterConf.type !== 'day'
            ? state.filters[dayParam] ?? []
            : undefined;

        return (
          <CollapsibleFilter
            key={filterConf.type}
            id={filterConf.label}
            title={filterConf.label}
            type={filterConf.type}
            options={options}
            selectedOptions={selected}
            onChange={(vals) => onFilterChange(filterConf.apiParam, vals)}
            onClear={() => onClear(filterConf.apiParam)}
            active={activeFilter === filterConf.label}
            onActivate={() => setActiveFilter(filterConf.label)}
            onDeactivate={() => setActiveFilter(null)}
            hasMore={pagination?.hasMore}
            loadingMore={pagination?.loading}
            onLoadMore={
              filterConf.paginated && onLoadMoreDropdown
                ? () => onLoadMoreDropdown(filterConf.type)
                : undefined
            }
            onSearch={
              filterConf.searchable && onDropdownSearch
                ? (q) => onDropdownSearch(filterConf.type, q)
                : undefined
            }
            otherYear={otherYear}
            otherMonth={otherMonth}
            otherDay={otherDay}
          />
        );
      })}
    </Box>
  );
}

export default GenericFilterSection;