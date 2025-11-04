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
  autoFocus?: boolean;
}

const PurchaseItemAutocomplete: React.FC<PurchaseItemAutocompleteProps> = ({
  value,
  onChange,
  label = 'All Items',
  error = false,
  helperText = '',
  fullWidth = true,
  inputRef,
  autoFocus = false,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<PurchaseItemSearchAdd[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 50;
  const [loading, setLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const listboxRef = useRef<HTMLUListElement | null>(null);
  const [isUserSelection, setIsUserSelection] = useState(false);

  // Deduplicate items based on purchaseitemId
  const deduplicateItems = (items: PurchaseItemSearchAdd[]): PurchaseItemSearchAdd[] => {
    return Array.from(
      new Map(items.map((item) => [item.purchaseitemId, item])).values()
    );
  };

  // Load items function
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
      if (isInitialLoad) {
        setInitialLoadDone(true);
      }
    }
  }, [dispatch, limit]);

  // Debounced search function
  const debouncedSearch = useMemo(
    () =>
      debounce((query: string) => {
        loadItems(query, 0, true);
      }, 300),
    [loadItems]
  );

  // Clean up debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  // Load initial items when dropdown opens
  useEffect(() => {
    if (open && !initialLoadDone && options.length === 0) {
      loadItems('', 0, true);
    }
  }, [open, initialLoadDone, options.length, loadItems]);

  // Initialize with current value
  useEffect(() => {
    if (value && value.itemName) {
      setSearchQuery(value.itemName);
    }
  }, [value]);

  // Handle scroll to load more items
  const handleScroll = useCallback(() => {
    if (!listboxRef.current || !hasMore || loading) return;

    const { scrollTop, scrollHeight, clientHeight } = listboxRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 10) {
      loadItems(searchQuery, skip);
    }
  }, [hasMore, loading, loadItems, searchQuery, skip]);

  // Attach scroll event listener
  useEffect(() => {
    const listbox = listboxRef.current;
    if (listbox) {
      listbox.addEventListener('scroll', handleScroll);
      return () => listbox.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll, options]);

  // Handle search input change
  const handleSearchChange = (newInputValue: string) => {
    setSearchQuery(newInputValue);
    if (newInputValue.length >= 1) {
      debouncedSearch(newInputValue);
    } else {
      loadItems('', 0, true);
    }
  };

  // Handle item selection
  const handleItemSelect = (_: any, selectedItem: PurchaseItemSearchAdd | null) => {
    setIsUserSelection(true);
    onChange(selectedItem);
    setSearchQuery(selectedItem ? selectedItem.itemName : '');
    setOpen(false);
  };

  // Handle key down events - Select first matching on Tab
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Tab' && open && options.length > 0) {
      // Find the first matching option based on current search query
      const firstMatch = options.find(opt => 
        opt.itemName.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (firstMatch) {
        // Select the first matching item
        onChange(firstMatch);
        setSearchQuery(firstMatch.itemName);
        setOpen(false);
        // Prevent default to avoid any unwanted behavior, but allow tab to focus next field
        event.preventDefault();
        // Note: To programmatically focus next field, you might need a ref to next input, but for now, let natural tab flow
      } else {
        // If no match, just close dropdown
        setOpen(false);
      }
    }
  };

  // Handle blur event
  const handleBlur = (event: React.FocusEvent) => {
    // Reset user selection flag
    setIsUserSelection(false);
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
      onOpen={() => {
        setOpen(true);
        setIsUserSelection(false);
        if (options.length === 0 && !loading) {
          loadItems('', 0, true);
        }
      }}
      onClose={() => setOpen(false)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      // Enable auto-selection for Tab behavior
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
          autoFocus={autoFocus}
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
      filterOptions={(options) => options}
    />
  );
};

export default PurchaseItemAutocomplete;