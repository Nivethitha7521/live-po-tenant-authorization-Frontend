import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '@/redux/store';

// Redux Slice
import {
  fetchServiceIds,
  selectServiceIdState,
  clearServiceIds,
  setLoading,
  ServiceIdItem,
  LIMIT
} from '../Features/ServiceIdSlice';

interface ServiceIdSearchProps {
  value: string;
  onChange: (serviceId: string) => void;
  label?: string;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  required?: boolean;
  debounceTime?: number;
}

const ServiceIdSearch: React.FC<ServiceIdSearchProps> = ({
  value,
  onChange,
  label = "Service ID",
  error = false,
  helperText = "",
  fullWidth = true,
  required = false,
  debounceTime = 300
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { serviceIds, loading, hasMore, searchQuery } = useSelector(selectServiceIdState);
  
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [page, setPage] = useState(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastQueryRef = useRef<string>('');
  const isLoadingMoreRef = useRef(false);

  // Clean input
  const cleanInput = useCallback((value: string): string => {
    return value.trim().toUpperCase();
  }, []);

  // Check if input is valid
  const isValidServiceId = useCallback((value: string): boolean => {
    const cleaned = cleanInput(value);
    // Accept empty, "SR", or "SR" followed by numbers
    return cleaned === '' || cleaned.startsWith('SR') || /^[0-9]*$/.test(cleaned.replace('SR', ''));
  }, [cleanInput]);

  // Format search query
  const formatSearchQuery = useCallback((input: string): string => {
    const cleaned = cleanInput(input);
    // If user types numbers without SR, add SR prefix
    if (cleaned && !cleaned.startsWith('SR') && /^[0-9]+$/.test(cleaned)) {
      return `SR${cleaned}`;
    }
    return cleaned;
  }, [cleanInput]);

  // Debounced search function
  const debouncedSearch = useCallback((searchTerm: string, currentPage: number = 0) => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Format the search term
    const formattedQuery = formatSearchQuery(searchTerm);
    
    // Don't search if same query and same page
    if (formattedQuery === lastQueryRef.current && currentPage === page) {
      return;
    }

    // Set a new timer
    debounceTimerRef.current = setTimeout(() => {
      if (!isValidServiceId(formattedQuery)) {
        dispatch(clearServiceIds());
        return;
      }

      // Only search if query has changed or it's a new page
      if (formattedQuery !== searchQuery || currentPage !== page) {
        const isInitialLoad = currentPage === 0;
        
        dispatch(fetchServiceIds({
          query: formattedQuery,
          skip: currentPage * LIMIT,
          isInitialLoad
        }));
        
        lastQueryRef.current = formattedQuery;
      }
    }, debounceTime);
  }, [dispatch, formatSearchQuery, isValidServiceId, debounceTime, page, searchQuery]);

  // Handle input change
  const handleInputChange = useCallback((_: unknown, newValue: string) => {
    const cleanedValue = cleanInput(newValue);
    setInputValue(cleanedValue);
    
    // Reset to page 0 for new search
    if (page !== 0) {
      setPage(0);
    }
    
    // Trigger search
    debouncedSearch(cleanedValue, 0);
  }, [cleanInput, debouncedSearch, page]);

  // Handle scroll for infinite loading
  const handleScroll = useCallback((event: React.UIEvent<HTMLUListElement>) => {
    const listboxNode = event.currentTarget;
    const scrollThreshold = 0.8;
    
    const isAtBottom = 
      listboxNode.scrollTop + listboxNode.clientHeight >= 
      listboxNode.scrollHeight * scrollThreshold;

    if (isAtBottom && !loading && hasMore && !isLoadingMoreRef.current) {
      isLoadingMoreRef.current = true;
      const nextPage = page + 1;
      setPage(nextPage);
      
      debouncedSearch(inputValue, nextPage);
    }
  }, [loading, hasMore, page, inputValue, debouncedSearch]);

  // Handle dropdown open
  const handleOpen = useCallback(() => {
    setOpen(true);
    
    // Load initial data if empty and input is valid
    if (serviceIds.length === 0 && !loading && isValidServiceId(inputValue)) {
      debouncedSearch(inputValue, 0);
    }
  }, [serviceIds.length, loading, inputValue, isValidServiceId, debouncedSearch]);

  // Handle dropdown close
  const handleClose = useCallback(() => {
    setOpen(false);
    isLoadingMoreRef.current = false;
  }, []);

  // Handle value selection
  const handleChange = useCallback((_: unknown, newValue: ServiceIdItem | string | null) => {
    if (typeof newValue === 'string') {
      const cleaned = formatSearchQuery(newValue);
      if (isValidServiceId(cleaned)) {
        onChange(cleaned);
      }
    } else if (newValue && 'serviceId' in newValue) {
      onChange(newValue.serviceId);
    } else {
      onChange('');
    }
    setOpen(false);
  }, [onChange, formatSearchQuery, isValidServiceId]);

  // Reset loading ref when loading stops
  useEffect(() => {
    if (!loading) {
      isLoadingMoreRef.current = false;
    }
  }, [loading]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Format option label
  const getOptionLabel = useCallback((option: ServiceIdItem | string): string => {
    if (typeof option === 'string') return option;
    return option.serviceId;
  }, []);

  // Compare options
  const isOptionEqualToValue = useCallback((option: ServiceIdItem, value: ServiceIdItem | string | null) => {
    if (!value) return false;
    if (typeof value === 'string') {
      return option.serviceId === value;
    }
    return option.serviceId === value.serviceId;
  }, []);

  // Find current value in options
  const currentValue = useMemo(() => {
    return serviceIds.find((item: ServiceIdItem) => item.serviceId === value) || value || null;
  }, [serviceIds, value]);

  return (
    <Autocomplete
      freeSolo
      open={open}
      onOpen={handleOpen}
      onClose={handleClose}
      options={serviceIds}
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={isOptionEqualToValue}
      value={currentValue}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      onChange={handleChange}
      filterOptions={(options) => options}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading && <CircularProgress color="inherit" size={20} />}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
          error={error}
          helperText={helperText}
          required={required}
          placeholder="Start typing SR..."
          inputProps={{
            ...params.inputProps,
            maxLength: 20,
            style: { textTransform: 'uppercase' }
          }}
        />
      )}
      ListboxProps={{
        onScroll: handleScroll,
        style: { 
          maxHeight: '200px',
          overflow: 'auto'
        }
      }}
      loading={loading}
      loadingText="Loading service IDs..."
      noOptionsText={
        !inputValue ? "Start typing to search" :
        loading ? "Searching..." : 
        !isValidServiceId(inputValue) ? "Service ID must start with SR" :
        "No service IDs found"
      }
      disableCloseOnSelect={false}
      blurOnSelect={true}
      fullWidth={fullWidth}
      clearOnBlur={false}
    />
  );
};

export default ServiceIdSearch;