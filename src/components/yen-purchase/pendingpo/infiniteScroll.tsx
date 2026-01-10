import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '@/redux/store';
import {
  fetchPurchaseOrderRandomIds,
  selectPurchaseListState,
  resetRandomIds
} from '@/features/yen-purchase/PurchaseOrder/purchaseListSlice';
import { PurchaseRandomId } from '@/Models/purchaseModel';

const LIMIT = 20;
interface PurchaseOrderRandomIdSearchProps {
  value: string;
  onChange: (randomId: string) => void;
  label?: string;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  required?: boolean;
}

const PurchaseOrderRandomIdSearch: React.FC<PurchaseOrderRandomIdSearchProps> = ({
  value,
  onChange,
  label = "PO ID",
  error = undefined,
  helperText = "",
  fullWidth = true,
  required = false
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { randomIds, loading, hasMore } = useSelector(selectPurchaseListState);
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const isScrollingRef = useRef(false);
  const fetchTimeoutRef = useRef<NodeJS.Timeout>();
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const previousQueryRef = useRef<string>('');
  const isInitialMountRef = useRef(true);

  // Set initial input value from external value
  useEffect(() => {
    if (value && isInitialMountRef.current) {
      setInputValue(value);
      isInitialMountRef.current = false;
    }
  }, [value]);

  // Debounce input for API calls - only trigger after user stops typing for 500ms
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Don't debounce if input is being cleared
    if (inputValue === '') {
      setDebouncedQuery('');
      return;
    }

    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedQuery(inputValue);
    }, 500); // Wait 500ms after user stops typing

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [inputValue]);

  // Fetch data ONLY when debounced query changes AND dropdown is open
  useEffect(() => {
    if (!open) return;

    // Only fetch if query actually changed and has at least 1 character
    if (debouncedQuery !== previousQueryRef.current) {
      previousQueryRef.current = debouncedQuery;
      
      // Clear any pending fetch timeout
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      
      // Small delay before fetching to ensure we have the right query
      fetchTimeoutRef.current = setTimeout(() => {
        // Reset list and fetch new data for the new query
        dispatch(resetRandomIds());
        
        dispatch(fetchPurchaseOrderRandomIds({
          skip: 0,
          query: debouncedQuery
        }));
      }, 100);
    }
  }, [debouncedQuery, open, dispatch]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLUListElement>) => {
    const listboxNode = event.currentTarget;
    const scrollThreshold = 0.9;

    if (
      listboxNode.scrollTop + listboxNode.clientHeight >=
      listboxNode.scrollHeight * scrollThreshold
    ) {
      if (!loading && hasMore && !isScrollingRef.current) {
        isScrollingRef.current = true;
        
        // Calculate next skip based on current loaded items
        const nextSkip = randomIds.length;
        
        dispatch(fetchPurchaseOrderRandomIds({
          skip: nextSkip,
          query: debouncedQuery
        }));
      }
    }
  }, [loading, hasMore, randomIds.length, debouncedQuery, dispatch]);

  const handleOpen = () => {
    setOpen(true);
    
    // Only fetch if we have no data or the query has changed
    if (randomIds.length === 0 && !loading) {
      // Small delay to prevent race conditions
      setTimeout(() => {
        dispatch(fetchPurchaseOrderRandomIds({
          skip: 0,
          query: debouncedQuery || ''
        }));
      }, 50);
    }
  };

  const handleClose = () => {
    if (!isScrollingRef.current) {
      setOpen(false);
      // Reset input to the selected value when closing
      if (value) {
        setInputValue(value);
      }
    }
  };

  const handleChange = (_: unknown, newValue: PurchaseRandomId | null) => {
    if (newValue) {
      onChange(newValue.randomId);
      setInputValue(newValue.randomId); // Update input with selected value
    } else {
      onChange('');
      setInputValue('');
    }
    setOpen(false);
  };

  const handleInputChange = (_: unknown, newInputValue: string) => {
    // Always update the input value immediately for responsive typing
    setInputValue(newInputValue);
    
    // If input is completely cleared, immediately clear the selected value
    if (newInputValue === '') {
      onChange('');
      setDebouncedQuery('');
      previousQueryRef.current = '';
    }
  };

  useEffect(() => {
    if (!loading) {
      // Reset scrolling flag after loading completes
      const timer = setTimeout(() => {
        isScrollingRef.current = false;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Get the selected value object for Autocomplete
  const selectedValue = useMemo(() => {
    return randomIds.find(id => id.randomId === value) || null;
  }, [randomIds, value]);

  return (
    <Autocomplete
      fullWidth={fullWidth}
      open={open}
      onOpen={handleOpen}
      onClose={handleClose}
      options={randomIds}
      getOptionLabel={(option) => option.randomId || ''}
      isOptionEqualToValue={(option, val) => 
        option.randomId === val?.randomId
      }
      value={selectedValue}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      onChange={handleChange}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          variant="outlined"
          size="small"
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
          placeholder="Type PO ID..."
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
      loadingText="Loading PO IDs..."
      noOptionsText={
        loading 
          ? "Searching..." 
          : inputValue && debouncedQuery === inputValue 
            ? "No PO IDs found" 
            : "Type to search"
      }
      filterOptions={(options) => options} // Disable frontend filtering
      disableCloseOnSelect={true}
      blurOnSelect={false}
      clearOnBlur={false}
      clearOnEscape={false}
      selectOnFocus={true}
    />
  );
};

export default PurchaseOrderRandomIdSearch;