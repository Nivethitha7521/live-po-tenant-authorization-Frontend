import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '@/redux/store';
import {
  fetchPurchaseOrderRandomIds,
  selectPurchaseListState
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
  const [page, setPage] = useState(0);
  const isScrollingRef = useRef(false);

  const fetchResults = useCallback((currentPage: number) => {
    dispatch(fetchPurchaseOrderRandomIds({
      query: inputValue,
      skip: currentPage * LIMIT
    }));
  }, [dispatch, inputValue]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLUListElement>) => {
    const listboxNode = event.currentTarget;
    const scrollThreshold = 0.8;

    if (listboxNode.scrollTop + listboxNode.clientHeight >=
        listboxNode.scrollHeight * scrollThreshold) {
      if (!loading && hasMore) {
        isScrollingRef.current = true;
        const nextPage = page + 1;
        setPage(nextPage);
        fetchResults(nextPage);
      }
    }
  }, [page, hasMore, fetchResults, loading]);

  const handleOpen = () => {
    setOpen(true);
    if (randomIds.length === 0 && !loading) {
      fetchResults(0);
    }
  };

  const handleClose = () => {
    if (!isScrollingRef.current) {
      setOpen(false);
    }
  };

  const handleChange = (_: unknown, newValue: PurchaseRandomId | null) => {
    onChange(newValue?.randomId || '');
    isScrollingRef.current = false;
    setOpen(false);
  };

  useEffect(() => {
    if (!loading) {
      // Small timeout to ensure scroll event completes
      const timer = setTimeout(() => {
        isScrollingRef.current = false;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  return (
    <Autocomplete
      open={open}
      onOpen={handleOpen}
      onClose={handleClose}
      options={randomIds}
      getOptionLabel={(option) => option.randomId || ''}
      isOptionEqualToValue={(option, value) => option.randomId === value?.randomId}
      value={randomIds.find(id => id.randomId === value) || null}
      inputValue={inputValue}
      onInputChange={(_, newValue) => setInputValue(newValue)}
      onChange={handleChange}
      filterOptions={(options, state) => {
        if (!state.inputValue) return options;
        return options.filter(option => 
          option.randomId.toLowerCase().includes(state.inputValue.toLowerCase())
        );
      }}
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
        />
      )}
      ListboxProps={{
        onScroll: handleScroll,
        style: { 
          maxHeight: '150px',
          overflow: 'auto',
          position: 'relative'
        }
      }}
      loading={loading}
      loadingText="Loading more..."
      noOptionsText={inputValue ? "No matches" : "Scroll to load items"}
      disableCloseOnSelect={true}
      blurOnSelect={false}
    />
  );
};

export default PurchaseOrderRandomIdSearch;