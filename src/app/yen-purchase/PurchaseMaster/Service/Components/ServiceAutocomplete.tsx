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
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  const listboxRef = useRef<HTMLUListElement | null>(null);
  const hasMoreRef = useRef(true);

  // Fetch services with infinite scroll
  const fetchServices = useCallback((page: number, query: string, reset: boolean = false) => {
    if (summaryLoading) return;
    
    dispatch(fetchServiceSummaries({
      page,
      limit: 50,
      status,
      search: query,
      forInfiniteScroll: true
    })).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        const payload = result.payload as PaginatedServiceSummary;
        // Check if we have more data
        hasMoreRef.current = payload.data.length === 50;
        if (reset) {
          setCurrentPage(1);
        } else {
          setCurrentPage(prev => prev + 1);
        }
      }
    });
  }, [dispatch, summaryLoading, status]);

  // Initial load when dropdown opens
  useEffect(() => {
    if (open && summaryItems.length === 0 && !summaryLoading) {
      fetchServices(1, searchQuery, true);
    }
  }, [open, summaryItems, summaryLoading, fetchServices, searchQuery]);

  // Clear search when dropdown closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setInputValue('');
    }
  }, [open]);

  // Handle search input - search by SAC code only
  const handleInputChange = (_: React.SyntheticEvent, newInputValue: string) => {
    setInputValue(newInputValue);
    setSearchQuery(newInputValue);
    fetchServices(1, newInputValue, true);
  };

  // Infinite scroll handler
  const handleScroll = (event: React.UIEvent<HTMLUListElement>) => {
    const target = event.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 100 && hasMoreRef.current) {
      fetchServices(currentPage + 1, searchQuery, false);
    }
  };

  // Get display label - Show only SAC code
  const getOptionLabel = (option: ServiceSummary) => {
    if (!option) return '';
    return `${option.saccode || ''}`; // Only show SAC code
  };

  // Filter options to show only those matching the search (by SAC code)
  const filteredOptions = summaryItems.filter(option => {
    if (!searchQuery) return true;
    return String(option.saccode).includes(searchQuery);
  });

  // Handle option selection
  const handleOptionSelect = (_: React.SyntheticEvent, selectedValue: ServiceSummary | null) => {
    onChange(selectedValue);
    if (selectedValue) {
      setInputValue(String(selectedValue.saccode)); // Set input to SAC code only
    } else {
      setInputValue(''); // Clear input
    }
  };

  return (
    <Autocomplete
      fullWidth={fullWidth}
      options={filteredOptions}
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
                {summaryLoading ? <CircularProgress color="inherit" size={20} /> : null}
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
              Service ID: {option.serviceId}
            </div>
          </div>
        </li>
      )}
      ListboxProps={{
        ref: listboxRef,
        onScroll: handleScroll,
        style: { maxHeight: 250 }
      }}
      loading={summaryLoading}
      loadingText="Loading services..."
      noOptionsText={searchQuery ? "No SAC codes found" : "Start typing to search SAC codes"}
      filterOptions={(options) => options} // We handle filtering manually
    />
  );
};

export default ServiceAutocomplete;