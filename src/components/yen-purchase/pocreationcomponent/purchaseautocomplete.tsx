import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
<<<<<<< HEAD
import { Autocomplete, TextField } from '@mui/material';
=======
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
>>>>>>> recover-branch
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
<<<<<<< HEAD
  const [allItems, setAllItems] = useState<PurchaseItemSearchAdd[]>([]);
  const [filteredItems, setFilteredItems] = useState<PurchaseItemSearchAdd[]>([]);
  const [searchQueryItem, setSearchQueryItem] = useState('');
=======
  const [options, setOptions] = useState<PurchaseItemSearchAdd[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
>>>>>>> recover-branch
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 50;
  const [loading, setLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const listboxRef = useRef<HTMLUListElement | null>(null);

<<<<<<< HEAD
  // Create a debounced search function with useMemo
  const debouncedSearch = useMemo(
    () =>
      debounce((query: string) => {
        if (query.length >= 1) {
          setLoading(true);
          dispatch(searchPurchaseItems({ searchQuery: query, skip: 0, limit }))
            .unwrap()
            .then((newItems) => {
              const uniqueItems = deduplicateItems([...allItems, ...(newItems || [])]);
              setAllItems(uniqueItems);
              setFilteredItems(
                uniqueItems.filter((item) =>
                  item.itemName?.toLowerCase().includes(query.toLowerCase())
                )
              );
              setSkip(limit);
              setHasMore(newItems?.length === limit);
            })
            .catch(() => {
              setFilteredItems([]);
            })
            .finally(() => {
              setLoading(false);
            });
        } else {
          setFilteredItems(allItems);
        }
      }, 300),
    [allItems, dispatch, limit] // Dependencies for the debounced function
=======
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
>>>>>>> recover-branch
  );

  // Clean up debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

<<<<<<< HEAD
  // Deduplicate items based on purchaseitemId
  const deduplicateItems = (items: PurchaseItemSearchAdd[]): PurchaseItemSearchAdd[] => {
    return Array.from(
      new Map(items.map((item) => [item.purchaseitemId, item])).values()
    );
  };

  // Load initial items
  useEffect(() => {
    const loadInitialItems = async () => {
      setLoading(true);
      try {
        const result = await dispatch(
          searchPurchaseItems({ searchQuery: '', skip: 0, limit })
        ).unwrap();
        const items = result || [];
        setAllItems(items);
        setFilteredItems(items);
        setHasMore(items.length === limit);
        setSkip(limit);
      } catch (error) {
        console.error('Error loading initial items:', error);
        setAllItems([]);
        setFilteredItems([]);
      } finally {
        setLoading(false);
        setInitialLoadDone(true);
      }
    };

    if (!initialLoadDone) {
      loadInitialItems();
    }
  }, [dispatch, initialLoadDone]);
=======
  // Load initial items when dropdown opens
  useEffect(() => {
    if (open && !initialLoadDone && options.length === 0) {
      loadItems('', 0, true);
    }
  }, [open, initialLoadDone, options.length, loadItems]);
>>>>>>> recover-branch

  // Initialize with current value
  useEffect(() => {
    if (value && value.itemName) {
<<<<<<< HEAD
      setSearchQueryItem(value.itemName);
=======
      setSearchQuery(value.itemName);
>>>>>>> recover-branch
    }
  }, [value]);

  // Handle scroll to load more items
  const handleScroll = useCallback(() => {
    if (!listboxRef.current || !hasMore || loading) return;

    const { scrollTop, scrollHeight, clientHeight } = listboxRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 10) {
<<<<<<< HEAD
      setLoading(true);
      dispatch(searchPurchaseItems({ searchQuery: searchQueryItem, skip, limit }))
        .unwrap()
        .then((newItems) => {
          const uniqueItems = deduplicateItems([...allItems, ...(newItems || [])]);
          setAllItems(uniqueItems);
          setFilteredItems(
            searchQueryItem
              ? uniqueItems.filter((item) =>
                  item.itemName?.toLowerCase().includes(searchQueryItem.toLowerCase())
                )
              : uniqueItems
          );
          setSkip(skip + limit);
          setHasMore(newItems?.length === limit);
        })
        .catch(() => {
          setHasMore(false);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [allItems, dispatch, hasMore, loading, searchQueryItem, skip, limit]);
=======
      loadItems(searchQuery, skip);
    }
  }, [hasMore, loading, loadItems, searchQuery, skip]);
>>>>>>> recover-branch

  // Attach scroll event listener
  useEffect(() => {
    const listbox = listboxRef.current;
    if (listbox) {
      listbox.addEventListener('scroll', handleScroll);
      return () => listbox.removeEventListener('scroll', handleScroll);
    }
<<<<<<< HEAD
  }, [handleScroll]);

  // Handle search input change
  const handleSearchChangeItem = (newInputValue: string) => {
    setSearchQueryItem(newInputValue);
    const filtered = allItems.filter((item) =>
      item.itemName?.toLowerCase().includes(newInputValue.toLowerCase())
    );
    setFilteredItems(filtered);
    debouncedSearch(newInputValue);
=======
  }, [handleScroll, options]); // Re-attach when options change

  // Handle search input change
  const handleSearchChange = (newInputValue: string) => {
    setSearchQuery(newInputValue);
    if (newInputValue.length >= 1) {
      debouncedSearch(newInputValue);
    } else {
      // If input is cleared, load initial items again
      loadItems('', 0, true);
    }
>>>>>>> recover-branch
  };

  // Handle item selection
  const handleItemSelect = (_: any, selectedItem: PurchaseItemSearchAdd | null) => {
    onChange(selectedItem);
<<<<<<< HEAD
    setSearchQueryItem(selectedItem ? selectedItem.itemName : '');
=======
    setSearchQuery(selectedItem ? selectedItem.itemName : '');
>>>>>>> recover-branch
    setOpen(false);
  };

  return (
    <Autocomplete
      fullWidth={fullWidth}
<<<<<<< HEAD
      options={filteredItems}
=======
      options={options}
>>>>>>> recover-branch
      getOptionLabel={(option: PurchaseItemSearchAdd) => option.itemName || ''}
      isOptionEqualToValue={(option, value) =>
        option?.purchaseitemId === value?.purchaseitemId
      }
      value={value}
<<<<<<< HEAD
      inputValue={searchQueryItem}
      onInputChange={(_, newInputValue) => handleSearchChangeItem(newInputValue)}
=======
      inputValue={searchQuery}
      onInputChange={(_, newInputValue) => handleSearchChange(newInputValue)}
>>>>>>> recover-branch
      onChange={handleItemSelect}
      open={open}
      onOpen={() => {
        setOpen(true);
<<<<<<< HEAD
        if (!initialLoadDone) {
          setInitialLoadDone(true);
=======
        // Load items immediately when opening if none are loaded
        if (options.length === 0 && !loading) {
          loadItems('', 0, true);
>>>>>>> recover-branch
        }
      }}
      onClose={() => setOpen(false)}
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
<<<<<<< HEAD
=======
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
>>>>>>> recover-branch
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
<<<<<<< HEAD
      noOptionsText={searchQueryItem ? 'No items found' : 'Type to search'}
      filterOptions={(options) => options}
=======
      noOptionsText={loading ? "Loading..." : (searchQuery ? 'No items found' : 'Type to search')}
      filterOptions={(options) => options} // Disable default filtering
>>>>>>> recover-branch
    />
  );
};

export default PurchaseItemAutocomplete;