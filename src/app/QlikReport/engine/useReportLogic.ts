'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AnyAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { AppDispatch, RootState } from '@/redux/store';
import { ReportConfig, ReportState, PaginatedResponse } from './types';
import { createReportSlice } from './genericSlice';

type SliceThunks = ReturnType<typeof createReportSlice>['thunks'];

interface UseReportLogicOptions<T> {
    config: ReportConfig<T>;
    thunks: SliceThunks;
    selector: (state: RootState) => ReportState<T>;
    actions: ReturnType<typeof createReportSlice>['slice']['actions'];
}

export function useReportLogic<T = Record<string, unknown>>({
    config,
    thunks,
    selector,
    actions,
}: UseReportLogicOptions<T>) {
    const dispatch = useDispatch<AppDispatch>();
    const state = useSelector(selector);
    const [hasMore, setHasMore] = useState(true);

    const initialFetchDone = useRef(false);
    const skipNextAutoFetch = useRef(false);
    const searchInProgress = useRef(false);
    const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    // We pull loading directly from the Redux state managed by the generic slice
    const { filters, paginationLoading, pagination, loading } = state;

    // ---- Init Filters ----
    useEffect(() => {
        const hasDateFilters = config.filters.some((f) => ['year', 'month', 'day'].includes(f.type));
        if (hasDateFilters) {
            dispatch(thunks.fetchDateFilters() as unknown as AnyAction);
        }

        config.filters
            .filter((f) => f.paginated)
            .forEach((f) => {
                dispatch(thunks.fetchDropdownOptions({ filterType: f.type }) as unknown as AnyAction);
            });
    }, [dispatch, config.filters, thunks]);

    // ---- Helper to get filter values ----
    const getFilterValue = useCallback((type: string) => {
        const filterConfig = config.filters.find(f => f.type === type);
        if (!filterConfig) return [];
        return filters[filterConfig.apiParam] || [];
    }, [config.filters, filters]);

    // ---- Central fetch ----
    const fetchReportPage = useCallback(
        (page: number) => {
            if (page === 1) setHasMore(true);

            // The thunk itself should trigger 'pending' which sets state.loading = true
            return dispatch(thunks.fetchReport({ page, limit: config.defaultPageSize ?? 30 }) as unknown as AnyAction)
                .unwrap()
                .then((res: PaginatedResponse<T>) => {
                    setHasMore((res as PaginatedResponse<T>).page < (res as PaginatedResponse<T>).totalPages);
                })
                .catch((err: unknown) => {
                    let msg = 'Failed to fetch data';
                    if (axios.isAxiosError(err)) msg = err.response?.data?.detail ?? err.message ?? msg;
                    else if (err instanceof Error) msg = err.message;
                    dispatch(actions.setSnackbar({ message: msg, severity: 'error' }));
                });
        },
        [dispatch, thunks, config.defaultPageSize, actions]
    );

    // ---- 1. Initial fetch (Requires Year + Month + Day if present) ----
    useEffect(() => {
        if (initialFetchDone.current) return;

        const year = getFilterValue('year');
        const month = getFilterValue('month');
        const day = getFilterValue('day');

        const hasYearFilter = config.filters.some(f => f.type === 'year');
        const hasMonthFilter = config.filters.some(f => f.type === 'month');
        const hasDayFilter = config.filters.some(f => f.type === 'day');

        const yearValid = !hasYearFilter || year.length > 0;
        const monthValid = !hasMonthFilter || month.length > 0;
        const dayValid = !hasDayFilter || day.length > 0;

        if (yearValid && monthValid && dayValid) {
            initialFetchDone.current = true;
            skipNextAutoFetch.current = true; 
            fetchReportPage(1);
        }
    }, [getFilterValue, config.filters, fetchReportPage]);

    // ---- 2. Auto fetch AFTER initial (Only Year REQUIRED) ----
    useEffect(() => {
        if (!initialFetchDone.current) return;

        const year = getFilterValue('year');
        const hasYearFilter = config.filters.some(f => f.type === 'year');

        if (hasYearFilter && year.length === 0) return;

        if (skipNextAutoFetch.current) {
            skipNextAutoFetch.current = false;
            return;
        }

        fetchReportPage(1);
    }, [getFilterValue, config.filters, fetchReportPage]);

    // ---- Handlers ----
    const handleFilterChange = useCallback(
        (apiParam: string, values: string[]) => {
            dispatch(actions.setFilter({ apiParam, values }));
            setHasMore(true);

            const changedFilterType = config.filters.find(f => f.apiParam === apiParam)?.type;
            if (changedFilterType && ['year', 'month', 'day'].includes(changedFilterType)) {
                config.filters
                    .filter(f => f.paginated && !['year', 'month', 'day'].includes(f.type))
                    .forEach(f => {
                        dispatch(thunks.fetchDropdownOptions({ filterType: f.type }) as unknown as AnyAction);
                    });
            }
        },
        [dispatch, actions, config.filters, thunks]
    );

    const handleClear = useCallback(
        (apiParam: string) => {
            dispatch(actions.clearFilter(apiParam));
            setHasMore(true);
        },
        [dispatch, actions]
    );

    const handleClearAll = useCallback(() => {
        dispatch(actions.clearAllFilters());
        initialFetchDone.current = false;
        setHasMore(true);
    }, [dispatch, actions]);

    const handleSearch = useCallback(async () => {
        if (searchInProgress.current) return;
        searchInProgress.current = true;
        try { await fetchReportPage(1); }
        finally { searchInProgress.current = false; }
    }, [fetchReportPage]);

    const handleDropdownSearch = useCallback(
        (filterType: string, query: string) => {
            dispatch(actions.setDropdownSearch({ filterType, query }));
            if (debounceTimers.current[filterType]) clearTimeout(debounceTimers.current[filterType]);
            debounceTimers.current[filterType] = setTimeout(() => {
                if (!query.trim()) {
                    dispatch(actions.resetDropdown(filterType));
                    dispatch(thunks.fetchDropdownOptions({ filterType }) as unknown as AnyAction);
                } else if (query.length >= 2) {
                    dispatch(thunks.fetchDropdownOptions({ filterType, search: query }) as unknown as AnyAction);
                }
            }, 400);
        },
        [dispatch, actions, thunks]
    );

    const handleLoadMoreDropdown = useCallback(
        (filterType: string) => {
            const pg = state.dropdownPagination[filterType];
            if (pg?.hasMore && !pg.loading) {
                dispatch(thunks.fetchMoreDropdownOptions({ filterType }) as unknown as AnyAction);
            }
        },
        [dispatch, thunks, state.dropdownPagination]
    );

    // ---- Infinite scroll ----
    const fetchNext = useCallback(() => {
        if (paginationLoading || !hasMore) return;
        const nextPage = pagination.currentPage + 1;
        if (nextPage > pagination.totalPages) { setHasMore(false); return; }

        dispatch(thunks.fetchReport({ page: nextPage, limit: config.defaultPageSize ?? 30 }) as unknown as AnyAction)
            .unwrap()
            .then((res: PaginatedResponse<T>) => setHasMore((res as PaginatedResponse<T>).page < (res as PaginatedResponse<T>).totalPages))
            .catch(() => setHasMore(false));
    }, [dispatch, thunks, paginationLoading, hasMore, pagination, config.defaultPageSize]);

    const handleExportExcel = useCallback(async () => {
        if (!state.items.length) {
            dispatch(actions.setSnackbar({ message: 'No data to export', severity: 'warning' }));
            return;
        }
        try {
            const blob = await dispatch(thunks.exportExcel() as unknown as AnyAction).unwrap();
            const url = URL.createObjectURL(blob as Blob);
            const a = document.createElement('a');
            a.href = url;
            const now = new Date();
            const pad = (n: number) => n.toString().padStart(2, '0');
            const ts = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
            const prefix = config.exportFilename ?? config.title.replace(/\s+/g, '');
            a.download = `${prefix}_YenERP_${ts}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            dispatch(actions.setSnackbar({ message: 'Export failed', severity: 'error' }));
        }
    }, [dispatch, thunks, actions, state.items.length, config]);

    const filtersDirty = state.filtersDirty;
    const isAnyFilterSelected = useMemo(
        () => Object.values(filters).some((arr) => arr.length > 0),
        [filters]
    );

    return {
        state,
        hasMore,
        filters,
        filtersDirty,
        isAnyFilterSelected,
        // We export the loading state here so ReportPage can use it
        isLoading: loading || paginationLoading, 
        handleFilterChange,
        handleClear,
        handleClearAll,
        handleSearch,
        handleDropdownSearch,
        handleLoadMoreDropdown,
        handleExportExcel,
        fetchNext,
        dispatch,
        actions,
    };
}