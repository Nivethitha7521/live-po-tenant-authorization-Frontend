// ============================================================
// engine/types.ts
// Central type definitions for the Generic ERP Report Engine.
// Every report config must satisfy ReportConfig.
// ============================================================

import { FilterType } from "@/components/Filter/CollapsibleFilter";

// ----- Filter Types -----
// Add new filter types here as your ERP grows (e.g. 'location', 'category')


export interface ColumnConfig<T = Record<string, unknown>> {
  displayKey: string; // unique key used for visibility toggle
  dataKey: keyof T; // key into each row object
  label: string; // column header text shown in UI
  width?: number; // optional fixed width override (px)
  align?: 'left' | 'center' | 'right';
}

export interface FilterConfig {
  type: FilterType; // maps to known filter logic in the engine
  label: string; // dropdown title shown in UI
  apiParam: string; // query-param name sent to the backend
  searchable?: boolean; // show search input inside dropdown
  paginated?: boolean; // fetch more options on scroll

  // NEW: Allows dynamic control over initial fetch requirements.
  // If true, the engine will block the initial data fetch until this filter has a value.
  requiredForInitialFetch?: boolean;
}

// The full contract a config file must provide
export interface ReportConfig<T = Record<string, unknown>> {
  key: string; // unique Redux slice name, e.g. 'productionEntry'
  title: string; // page/header title, e.g. 'Production Entry Report'
  apiBase: string; // e.g. 'https://yenerp.com/reportsapi/productionEntry'
  columns: ColumnConfig[];
  filters: FilterConfig[];
  defaultPageSize?: number; // defaults to 30
  
  // NEW: Added to support individual date endpoints per module
  dateEndpoint?: string; 

  // NEW: Specific endpoint for global dropdowns (Branch, Driver, etc.)
  // If not provided, defaults to `${apiBase}/global-dropdowns`
  globalDropdownEndpoint?: string;

  exportFilename?: string; // prefix for downloaded files
}

// ----- Shared API shapes -----
export interface OptionType {
  label: string;
  value: string;
}

export interface PaginatedResponse<T = Record<string, unknown>> {
  page: number;
  limit: number;
  totalrecords?: number;
  totalPages: number;
  items: T[];
}

export interface DropdownPagination {
  loading: boolean;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ----- Generic slice state -----
export interface ReportState<T = Record<string, unknown>> {
  // selected filter values (keyed by FilterConfig.apiParam)
  filters: Record<string, string[]>;
  // available options for each filter dropdown (keyed by FilterType)
  availableOptions: Record<string, OptionType[]>;
  // pagination state per paginated dropdown (keyed by FilterType)
  dropdownPagination: Record<string, DropdownPagination>;
  // search query per searchable dropdown
  dropdownSearchQuery: Record<string, string>;

  items: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    limit: number;
    totalItems: number;
  };

  loading: boolean;
  paginationLoading: boolean;
  exporting: boolean;
  error: string | null;
  filtersDirty: boolean;

  snackbar: {
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  };
}

export const makeInitialState = <T>(config: ReportConfig): ReportState => {
  const dropdownPagination: Record<string, DropdownPagination> = {};
  const dropdownSearchQuery: Record<string, string> = {};
  const filters: Record<string, string[]> = {};
  const availableOptions: Record<string, OptionType[]> = {};

  config.filters.forEach((f) => {
    filters[f.apiParam] = [];
    availableOptions[f.type] = [];

    // FIX: Initialize state for ALL filters (even non-paginated ones)
    // This prevents 'undefined' errors in genericSlice when checking 'loading' or 'hasMore'
    dropdownPagination[f.type] = { loading: false, page: 1, limit: 50, hasMore: true };
    dropdownSearchQuery[f.type] = '';
  });

  return {
    filters,
    availableOptions,
    dropdownPagination,
    dropdownSearchQuery,
    items: [],
    pagination: {
      currentPage: 1,
      totalPages: 1,
      limit: config.defaultPageSize ?? 30,
      totalItems: 0,
    },
    loading: false,
    paginationLoading: false,
    exporting: false,
    error: null,
    filtersDirty: false,
    snackbar: { open: false, message: '', severity: 'info' },
  };
};