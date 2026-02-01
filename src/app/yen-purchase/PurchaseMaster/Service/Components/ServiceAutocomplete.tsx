import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/redux/store';
import { fetchServiceSummaries, selectServiceSummary } from '../Features/ServiceSlice';
import { PaginatedServiceSummary, ServiceSummary } from '../Models/Service';

interface ServiceAutocompleteProps {
  value: ServiceSummary | null;
  onChange: (item: ServiceSummary | null) => void;
  label?: string;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  required?: boolean;
  status?: 'active' | 'deactivated' | 'all';
}

const ServiceAutocomplete: React.FC<ServiceAutocompleteProps> = ({
  value,
  onChange,
  label = "Select Service",
  error = undefined,
  helperText = "",
  fullWidth = true,
  required = false,
  status = 'active'
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { summaryItems, summaryLoading } = useSelector(selectServiceSummary);
  
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  
  // Refs for infinite scroll control
  const currentPageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const isLoadingRef = useRef(false);
  const isFetchingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch services with proper pagination control
  const fetchServices = useCallback(async (
    page: number, 
    query: string, 
    reset: boolean = false,
    isScrollLoad: boolean = false
  ) => {
    // Prevent multiple simultaneous requests
    if (isFetchingRef.current) return;
    
    // For scroll loading, only fetch if we have more data
    if (isScrollLoad && !hasMoreRef.current) return;
    
    isFetchingRef.current = true;
    
    try {
      const result = await dispatch(fetchServiceSummaries({
        page,
        limit: 50,
        status,
        search: query,
        forInfiniteScroll: true
      })).unwrap();
      
      // Update hasMore based on whether we got any data
      if (result.data.length === 0) {
        hasMoreRef.current = false;
      } else if (result.data.length < 50) {
        // If we got less than the limit, we're at the end
        hasMoreRef.current = false;
      } else {
        hasMoreRef.current = true;
      }
      
      // Update current page reference
      if (reset) {
        currentPageRef.current = 1;
      } else {
        currentPageRef.current = page;
      }
      
    } catch (error) {
      console.error('Failed to fetch services:', error);
      hasMoreRef.current = false; // Stop trying on error
    } finally {
      isFetchingRef.current = false;
    }
  }, [dispatch, status]);

  // Handle search input with debounce
  const handleInputChange = useCallback((_: React.SyntheticEvent, newInputValue: string) => {
    setInputValue(newInputValue);
    
    // Clear previous debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      setSearchQuery(newInputValue);
      hasMoreRef.current = true; // Reset hasMore for new search
      currentPageRef.current = 1; // Reset to page 1
      fetchServices(1, newInputValue, true);
    }, 300);
  }, [fetchServices]);

  // Fetch initial data when dropdown opens
  useEffect(() => {
    if (open) {
      // Only fetch if we haven't loaded data yet OR if search query is different
      const shouldFetch = 
        summaryItems.length === 0 || 
        searchQuery !== '' || 
        currentPageRef.current === 1;
      
      if (shouldFetch && !isFetchingRef.current) {
        fetchServices(1, searchQuery, true);
      }
    }
  }, [open]); // Only depend on open state

  // Load more data when scrolling
  const handleScroll = useCallback((event: React.UIEvent<HTMLUListElement>) => {
    const target = event.currentTarget;
    const scrollPosition = target.scrollHeight - target.scrollTop - target.clientHeight;
    
    // Check if we're near the bottom (within 50px) and can load more
    if (
      scrollPosition < 50 &&
      hasMoreRef.current &&
      !isFetchingRef.current &&
      !summaryLoading
    ) {
      // Load next page
      fetchServices(currentPageRef.current + 1, searchQuery, false, true);
    }
  }, [searchQuery, summaryLoading, fetchServices]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Get display label - Show only SAC code
  const getOptionLabel = (option: ServiceSummary) => {
    if (!option) return '';
    return `${option.saccode || ''}`;
  };

  // Handle option selection
  const handleOptionSelect = useCallback((_: React.SyntheticEvent, selectedValue: ServiceSummary | null) => {
    onChange(selectedValue);
    if (selectedValue) {
      setInputValue(String(selectedValue.saccode));
    } else {
      setInputValue('');
    }
  }, [onChange]);

  return (
    <Autocomplete
      fullWidth={fullWidth}
      options={summaryItems}
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={(option, value) => option.mongoId === value?.mongoId}
      value={value}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      onChange={handleOptionSelect}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          variant="outlined"
          size="small"
          error={error}
          helperText={helperText}
          required={required}
          placeholder="Search by SAC code"
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {(summaryLoading || isFetchingRef.current) ? (
                  <CircularProgress color="inherit" size={20} />
                ) : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => (
        <li {...props} key={option.mongoId}>
          <div>
            <div style={{ fontWeight: 'bold' }}>SAC Code: {option.saccode}</div>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>
             S.Name: {option.serviceName}
            </div>
          </div>
        </li>
      )}
      ListboxProps={{
        onScroll: handleScroll,
        style: { maxHeight: 250, overflowY: 'auto' }
      }}
      loading={summaryLoading || isFetchingRef.current}
      loadingText="Loading services..."
      noOptionsText={
        summaryLoading || isFetchingRef.current
          ? "Loading..."
          : searchQuery
            ? "No SAC codes found"
            : "Start typing to search SAC codes"
      }
      filterOptions={(options) => {
        // Apply client-side filtering only when there's a search query
        if (!searchQuery) return options;
        
        return options.filter(option =>
          String(option.saccode).toLowerCase().includes(searchQuery.toLowerCase())
        );
      }}
    />
  );
};

export default ServiceAutocomplete;