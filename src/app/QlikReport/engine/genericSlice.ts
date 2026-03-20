// engine/genericSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { buildDateRange } from '@/glopals/builddterange';
import {
  ReportConfig,
  ReportState,
  PaginatedResponse,
  OptionType,
  makeInitialState,
} from './types';

const blobText = async (v: unknown): Promise<string | null> => {
  if (v instanceof Blob) return v.text();
  return null;
};

export function createReportSlice<T extends Record<string, unknown> = Record<string, unknown>>(config: ReportConfig) {
  const { key, apiBase } = config;
  const initialState = makeInitialState(config);

  // ------ THUNKS ------

  // FIX: Uses config.dateEndpoint dynamically
  // ... existing imports

  const fetchDateFilters = createAsyncThunk<
    { years: string[]; months: string[]; days: number[] },
    void,
    { rejectValue: string }
  >(`${key}/fetchDateFilters`, async (_, { rejectWithValue }) => {
    try {
      const endpoint = config.dateEndpoint || `${apiBase}/dates`;
      const { data } = await axios.get(endpoint);

      // FIX: Map the API response keys to the expected keys
      return {
        years: data.years ?? data.yearIn ?? [],    // Handles 'yearIn'
        months: data.months ?? data.monthIn ?? [], // Handles 'monthIn'
        days: data.days ?? data.daysIn ?? [],      // Handles 'daysIn'
      };
    } catch (err: unknown) {
      let msg = 'Failed to fetch date filters';
      if (axios.isAxiosError(err)) msg = err.response?.data?.detail ?? err.message ?? msg;
      else if (err instanceof Error) msg = err.message;
      return rejectWithValue(msg);
    }
  });

  // ... rest of the slice
  const fetchDropdownOptions = createAsyncThunk<
    { filterType: string; items: OptionType[]; hasMore: boolean },
    { filterType: string; search?: string; page?: number },
    { rejectValue: string }
  >(`${key}/fetchDropdownOptions`, async ({ filterType, search, page = 1 }, { rejectWithValue }) => {
    try {
      const filterConf = config.filters.find((f) => f.type === filterType);
      if (!filterConf) return rejectWithValue(`Unknown filter type: ${filterType}`);

      const limit = 50;

      // CHANGE: Use globalDropdownEndpoint if provided, else fallback to apiBase
      const endpoint = config.globalDropdownEndpoint || `${apiBase}/global-dropdowns`;

      const { data } = await axios.get(endpoint, {
        params: { page, limit, search: search || undefined, type: filterType },
      });
      const items: OptionType[] = (data[filterType] ?? data.items ?? []).map(
        (v: string | OptionType) =>
          typeof v === 'string' ? { label: v, value: v } : v
      );
      return { filterType, items, hasMore: items.length === limit };
    } catch (err: unknown) {
      return rejectWithValue(`Failed to fetch ${filterType} options`);
    }
  });

  const fetchMoreDropdownOptions = createAsyncThunk<
    { filterType: string; items: OptionType[]; hasMore: boolean },
    { filterType: string },
    { state: { [k: string]: ReportState }; rejectValue: string }
  >(`${key}/fetchMoreDropdownOptions`, async ({ filterType }, { getState, rejectWithValue }) => {
    const sliceState = (getState() as any)[key] as ReportState;
    const pagination = sliceState.dropdownPagination[filterType];
    const search = sliceState.dropdownSearchQuery[filterType];

    if (!pagination?.hasMore) return { filterType, items: [], hasMore: false };
    const nextPage = pagination.page + 1;
    const limit = pagination.limit;
    try {
      // CHANGE: Use globalDropdownEndpoint if provided, else fallback to apiBase
      const endpoint = config.globalDropdownEndpoint || `${apiBase}/global-dropdowns`;

      const { data } = await axios.get(endpoint, {
        params: { page: nextPage, limit, search: search || undefined, type: filterType },
      });
      const items: OptionType[] = (data[filterType] ?? data.items ?? []).map(
        (v: string | OptionType) =>
          typeof v === 'string' ? { label: v, value: v } : v
      );
      return { filterType, items, hasMore: items.length === limit };
    } catch (err: unknown) {
      return rejectWithValue(`Failed to load more ${filterType} options`);
    }
  });

  const fetchReport = createAsyncThunk<
    PaginatedResponse,
    { page: number; limit?: number },
    { rejectValue: string }
  >(`${key}/fetchReport`, async ({ page, limit: lim }, { getState, rejectWithValue }) => {
    const sliceState = (getState() as any)[key] as ReportState;
    const { filters } = sliceState;
    const limit = lim ?? config.defaultPageSize ?? 30;

    try {
      const qp = new URLSearchParams({ page: String(page), limit: String(limit) });

      // 1. Date Filters
      const yearParam = config.filters.find((f) => f.type === 'year')?.apiParam;
      const monthParam = config.filters.find((f) => f.type === 'month')?.apiParam;
      const dayParam = config.filters.find((f) => f.type === 'day')?.apiParam;

      const years = yearParam ? filters[yearParam] ?? [] : [];
      const months = monthParam ? filters[monthParam] ?? [] : [];
      const days = dayParam ? (filters[dayParam] ?? []).map(Number) : [];

      const dateRange = buildDateRange(years, months, days);
      if (dateRange.start_date) qp.append('startDate', dateRange.start_date);
      if (dateRange.end_date) qp.append('endDate', dateRange.end_date);

      // 2. Global Filters (Variance, Branch, Driver, etc.)
      config.filters.forEach((f) => {
        if (['year', 'month', 'day'].includes(f.type)) return;

        const values = filters[f.apiParam] ?? [];
        values.forEach((v) => {
          if (v?.trim()) qp.append(f.apiParam, v.trim());
        });
      });

      const { data } = await axios.get<PaginatedResponse>(`${apiBase}/report`, { params: qp });
      return { ...data, items: data.items ?? [] };
    } catch (err: unknown) {
      let msg = 'Failed to fetch report';
      if (axios.isAxiosError(err)) msg = err.response?.data?.detail ?? err.message ?? msg;
      else if (err instanceof Error) msg = err.message;
      return rejectWithValue(msg);
    }
  });

  const exportExcel = createAsyncThunk<
    Blob,
    void,
    { rejectValue: string }
  >(`${key}/exportExcel`, async (_, { getState, rejectWithValue }) => {
    const sliceState = (getState() as any)[key] as ReportState;
    const { filters } = sliceState;

    try {
      const qp = new URLSearchParams();

      // 1. Dates
      const yearParam = config.filters.find((f) => f.type === 'year')?.apiParam;
      const monthParam = config.filters.find((f) => f.type === 'month')?.apiParam;
      const dayParam = config.filters.find((f) => f.type === 'day')?.apiParam;

      const years = yearParam ? filters[yearParam] ?? [] : [];
      const months = monthParam ? filters[monthParam] ?? [] : [];
      const days = dayParam ? (filters[dayParam] ?? []).map(Number) : [];

      const dateRange = buildDateRange(years, months, days);
      if (dateRange.start_date) qp.append('startDate', dateRange.start_date);
      if (dateRange.end_date) qp.append('endDate', dateRange.end_date);

      // 2. Global Filters
      config.filters.forEach((f) => {
        if (['year', 'month', 'day'].includes(f.type)) return;
        const values = filters[f.apiParam] ?? [];
        values.forEach((v) => {
          if (v?.trim()) qp.append(f.apiParam, v.trim());
        });
      });

      const { data } = await axios.get(`${apiBase}/export`, {
        params: qp,
        responseType: 'blob',
      });
      return data as Blob;
    } catch (err: unknown) {
      let msg = 'Export failed';
      if (axios.isAxiosError(err)) {
        const txt = await blobText(err.response?.data);
        if (txt) msg = txt;
        else if (err.message) msg = err.message;
      } else if (err instanceof Error) msg = err.message;
      return rejectWithValue(msg);
    }
  });

  // ------ SLICE ------
  const slice = createSlice({
    name: key,
    initialState: initialState as ReportState,
    reducers: {
      setFilter(state, action: PayloadAction<{ apiParam: string; values: string[] }>) {
        state.filters[action.payload.apiParam] = action.payload.values;
        state.items = [];
        state.filtersDirty = true;
        state.pagination.currentPage = 1;
      },
      clearFilter(state, action: PayloadAction<string>) {
        state.filters[action.payload] = [];
        state.items = [];
        state.filtersDirty = true;
        state.pagination.currentPage = 1;
      },
      clearAllFilters(state) {
        config.filters.forEach((f) => { state.filters[f.apiParam] = []; });
        state.items = [];
        state.pagination.currentPage = 1;
        state.filtersDirty = false;
        Object.keys(state.dropdownPagination).forEach((ft) => {
          state.dropdownPagination[ft] = { loading: false, page: 1, limit: 50, hasMore: true };
          state.dropdownSearchQuery[ft] = '';
        });
      },
      setDropdownSearch(state, action: PayloadAction<{ filterType: string; query: string }>) {
        const { filterType, query } = action.payload;
        // Safe check because we initialized all filters in makeInitialState
        if (state.dropdownSearchQuery[filterType] !== undefined) {
          state.dropdownSearchQuery[filterType] = query;
          state.dropdownPagination[filterType].page = 1;
          state.dropdownPagination[filterType].hasMore = true;
        }
      },
      resetDropdown(state, action: PayloadAction<string>) {
        const ft = action.payload;
        state.availableOptions[ft] = [];
        state.dropdownSearchQuery[ft] = '';
        if (state.dropdownPagination[ft]) {
          state.dropdownPagination[ft] = { loading: false, page: 1, limit: 50, hasMore: true };
        }
      },
      setSnackbar(state, action: PayloadAction<{ message: string; severity: 'success' | 'error' | 'warning' | 'info' }>) {
        state.snackbar = { open: true, ...action.payload };
      },
      clearSnackbar(state) {
        state.snackbar = { open: false, message: '', severity: 'info' };
      },
    },
    extraReducers: (builder) => {
      builder.addCase(fetchDateFilters.fulfilled, (state, action) => {
        const yearFilter = config.filters.find((f) => f.type === 'year');
        const monthFilter = config.filters.find((f) => f.type === 'month');
        const dayFilter = config.filters.find((f) => f.type === 'day');
        if (yearFilter) state.availableOptions['year'] = action.payload.years.map((v) => ({ label: v, value: v }));
        if (monthFilter) state.availableOptions['month'] = action.payload.months.map((v) => ({ label: v, value: v }));
        if (dayFilter) state.availableOptions['day'] = action.payload.days.map((v) => ({ label: String(v), value: String(v) }));
      });

      builder
        .addCase(fetchDropdownOptions.pending, (state, action) => {
          const ft = action.meta.arg.filterType;
          if (state.dropdownPagination[ft]) state.dropdownPagination[ft].loading = true;
        })
        .addCase(fetchDropdownOptions.fulfilled, (state, action) => {
          const { filterType, items, hasMore } = action.payload;
          state.availableOptions[filterType] = items;
          if (state.dropdownPagination[filterType]) {
            state.dropdownPagination[filterType].loading = false;
            state.dropdownPagination[filterType].page = 1;
            state.dropdownPagination[filterType].hasMore = hasMore;
          }
        })
        .addCase(fetchDropdownOptions.rejected, (state, action) => {
          const ft = action.meta.arg.filterType;
          if (state.dropdownPagination[ft]) state.dropdownPagination[ft].loading = false;
        });

      builder
        .addCase(fetchMoreDropdownOptions.pending, (state, action) => {
          const ft = action.meta.arg.filterType;
          if (state.dropdownPagination[ft]) state.dropdownPagination[ft].loading = true;
        })
        .addCase(fetchMoreDropdownOptions.fulfilled, (state, action) => {
          const { filterType, items, hasMore } = action.payload;
          if (!state.availableOptions[filterType]) state.availableOptions[filterType] = [];
          state.availableOptions[filterType].push(...items);
          if (state.dropdownPagination[filterType]) {
            state.dropdownPagination[filterType].loading = false;
            state.dropdownPagination[filterType].page += 1;
            state.dropdownPagination[filterType].hasMore = hasMore;
          }
        })
        .addCase(fetchMoreDropdownOptions.rejected, (state, action) => {
          const ft = action.meta.arg.filterType;
          if (state.dropdownPagination[ft]) {
            state.dropdownPagination[ft].loading = false;
            state.dropdownPagination[ft].hasMore = false;
          }
        });

      builder
        .addCase(fetchReport.pending, (state) => {
          state.paginationLoading = true;
          state.error = null;
        })
        .addCase(fetchReport.fulfilled, (state, action) => {
          state.paginationLoading = false;
          const page = action.meta.arg.page;
          state.items = (page === 1
            ? action.payload.items
            : [...state.items, ...action.payload.items]) as T[];
          state.pagination = {
            currentPage: action.payload.page ?? page,
            totalPages: action.payload.totalPages ?? 1,
            limit: action.payload.limit ?? (config.defaultPageSize ?? 30),
            totalItems: action.payload.totalrecords ?? 0,
          };
          state.filtersDirty = false;
        })
        .addCase(fetchReport.rejected, (state, action) => {
          state.paginationLoading = false;
          state.error = action.payload ?? 'Failed to load report';
        });

      builder
        .addCase(exportExcel.pending, (state) => {
          state.exporting = true;
          state.snackbar = { open: true, message: 'Export in progress…', severity: 'info' };
        })
        .addCase(exportExcel.fulfilled, (state) => {
          state.exporting = false;
          state.snackbar = { open: true, message: 'Export successful!', severity: 'success' };
        })
        .addCase(exportExcel.rejected, (state, action) => {
          state.exporting = false;
          state.snackbar = { open: true, message: action.payload ?? 'Export failed', severity: 'error' };
        });
    },
  });

  return {
    slice,
    thunks: {
      fetchDateFilters,
      fetchDropdownOptions,
      fetchMoreDropdownOptions,
      fetchReport,
      exportExcel,
    },
  };
}