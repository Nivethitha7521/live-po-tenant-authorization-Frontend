import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/redux/store';
import { PurchaseItemSearchAdd } from '@/Models/purchaseModel';
import { searchPurchaseItems } from '@/features/yen-purchase/PurchaseMaster/purchaseItemSlice';
import debounce from 'lodash/debounce';

interface PurchaseItemAutocompleteProps {
  value: PurchaseItemSearchAdd | null;
  onChange: (item: PurchaseItemSearchAdd | null) => void;
  label?: string;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  autoFocus?: boolean;  // NEW: Prop to enable auto-focus
}

const PurchaseItemAutocomplete: React.FC<PurchaseItemAutocompleteProps> = ({
  value,
  onChange,
  label = 'All Items',
  error = false,
  helperText = '',
  fullWidth = true,
  inputRef,
  autoFocus = false,  // NEW: Default false
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<PurchaseItemSearchAdd[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 50;
  const [loading, setLoading] = useState(false);
  const listboxRef = useRef<HTMLUListElement | null>(null);
  const [isUserSelection, setIsUserSelection] = useState(false);

  // CRITICAL FIX: Sync searchQuery with external value
  useEffect(() => {
    if (value === null) {
      setSearchQuery('');
    } else if (value && value.itemName && searchQuery !== value.itemName) {
      setSearchQuery(value.itemName);
    }
  }, [value]);  // Only depend on value for stability

  // Deduplicate items based on purchaseitemId (unchanged)
  const deduplicateItems = (items: PurchaseItemSearchAdd[]): PurchaseItemSearchAdd[] => {
    return Array.from(
      new Map(items.map((item) => [item.purchaseitemId, item])).values()
    );
  };

  // Load items function (unchanged)
  const loadItems = useCallback(async (query: string, currentSkip: number, isInitialLoad = false) => {
    setLoading(true);
    try {
      const result = await dispatch(
        searchPurchaseItems({ searchQuery: query, skip: currentSkip, limit })
      ).unwrap();
     
      const newItems = result || [];
     
      if (isInitialLoad) {
        setOptions(newItems);
      } else {
        setOptions(prev => deduplicateItems([...prev, ...newItems]));
      }
     
      setHasMore(newItems.length === limit);
      setSkip(currentSkip + limit);
    } catch (error) {
      console.error('Error loading items:', error);
      if (isInitialLoad) {
        setOptions([]);
      }
    } finally {
      setLoading(false);
    }
  }, [dispatch, limit]);

  // UPDATED Debounced search: Reduced delay for snappier typing
  const debouncedSearch = useMemo(
    () =>
      debounce((query: string) => {
        loadItems(query, 0, true);
      }, 200),  // REDUCED: From 300ms to 200ms
    [loadItems]
  );

  // Clean up debounced function on unmount (unchanged)
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  // REMOVED: No longer auto-load on open (load only on typing)

  // Handle scroll to load more items (unchanged)
  const handleScroll = useCallback(() => {
    if (!listboxRef.current || !hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = listboxRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 10) {
      loadItems(searchQuery, skip);
    }
  }, [hasMore, loading, loadItems, searchQuery, skip]);

  // Attach scroll event listener (unchanged)
  useEffect(() => {
    const listbox = listboxRef.current;
    if (listbox) {
      listbox.addEventListener('scroll', handleScroll);
      return () => listbox.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll, options]);  // Added options dep for re-attach if needed

  // UPDATED Handle search input change: Open only on typing, clear value if editing selected, reset list for new search
  const handleSearchChange = (newInputValue: string) => {
    setSearchQuery(newInputValue);
    // If there's a current value and input differs, clear the value to start new search
    if (value && newInputValue !== (value.itemName || '')) {
      onChange(null);
    }
    if (newInputValue.length >= 1) {
      setOpen(true);
      // Reset for new search
      setOptions([]);
      setSkip(0);
      setHasMore(true);
      debouncedSearch(newInputValue);
    } else {
      setOpen(false);
      // No load for empty query
    }
  };

  // Handle item selection (unchanged)
  const handleItemSelect = (_: any, selectedItem: PurchaseItemSearchAdd | null) => {
    setIsUserSelection(true);
    onChange(selectedItem);
    setSearchQuery(selectedItem ? selectedItem.itemName : '');
    setOpen(false);  // Close after selection
  };

  // Handle key down events - Select first matching on Tab (IMPROVED: Works even if partial open)
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Tab' && open && options.length > 0) {
      const firstMatch = options.find(opt =>
        opt.itemName.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (firstMatch) {
        onChange(firstMatch);
        setSearchQuery(firstMatch.itemName);
        setOpen(false);
        event.preventDefault();  // Prevent tab navigation, but allow focus shift
      } else {
        setOpen(false);
      }
    }
  };

  // UPDATED Handle blur event: Clear partial input if no selection
  const handleBlur = (event: React.FocusEvent) => {
    setIsUserSelection(false);
    // If no value selected and input has text, clear the input on blur
    if (value === null && searchQuery.trim() !== '') {
      setSearchQuery('');
    }
  };

  return (
    <Autocomplete
      fullWidth={fullWidth}
      options={options}
      getOptionLabel={(option: PurchaseItemSearchAdd) => option.itemName || ''}
      isOptionEqualToValue={(option, value) =>
        option?.purchaseitemId === value?.purchaseitemId
      }
      value={value}
      inputValue={searchQuery}
      onInputChange={(_, newInputValue) => handleSearchChange(newInputValue)}
      onChange={handleItemSelect}
      open={open}
      // CHANGED: No auto-open on focus; only opens on typing
      openOnFocus={false}
      onOpen={() => {
        setOpen(true);
        setIsUserSelection(false);
      }}
      onClose={() => setOpen(false)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      // Keep filterOptions as-is (allows free typing without filtering)
      filterOptions={(options, state) => options}
      freeSolo={false}
      autoSelect={true}
      disableCloseOnSelect={false}
      blurOnSelect={true}
      selectOnFocus={false}
      clearOnBlur={false}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          variant="outlined"
          size="small"
          error={error}
          helperText={helperText}
          inputRef={inputRef}
          autoFocus={autoFocus}  // NEW: Use prop for auto-focus after clear
          onKeyDown={handleKeyDown}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => (
        <li {...props} key={option.purchaseitemId}>
          {option.itemName}
        </li>
      )}
      ListboxProps={{
        ref: listboxRef,
        style: { maxHeight: 300, overflow: 'auto' },
      }}
      loading={loading}
      loadingText="Loading items..."
      noOptionsText={loading ? "Loading..." : (searchQuery ? 'No items found' : 'Type to search')}
    />
  );
};

export default PurchaseItemAutocomplete;