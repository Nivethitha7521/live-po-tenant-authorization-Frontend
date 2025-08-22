import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Autocomplete, TextField } from '@mui/material';
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
  const [allItems, setAllItems] = useState<PurchaseItemSearchAdd[]>([]);
  const [filteredItems, setFilteredItems] = useState<PurchaseItemSearchAdd[]>([]);
  const [searchQueryItem, setSearchQueryItem] = useState('');
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 50;
  const [loading, setLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const listboxRef = useRef<HTMLUListElement | null>(null);

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
  );

  // Clean up debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

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

  // Initialize with current value
  useEffect(() => {
    if (value && value.itemName) {
      setSearchQueryItem(value.itemName);
    }
  }, [value]);

  // Handle scroll to load more items
  const handleScroll = useCallback(() => {
    if (!listboxRef.current || !hasMore || loading) return;

    const { scrollTop, scrollHeight, clientHeight } = listboxRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 10) {
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

  // Attach scroll event listener
  useEffect(() => {
    const listbox = listboxRef.current;
    if (listbox) {
      listbox.addEventListener('scroll', handleScroll);
      return () => listbox.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // Handle search input change
  const handleSearchChangeItem = (newInputValue: string) => {
    setSearchQueryItem(newInputValue);
    const filtered = allItems.filter((item) =>
      item.itemName?.toLowerCase().includes(newInputValue.toLowerCase())
    );
    setFilteredItems(filtered);
    debouncedSearch(newInputValue);
  };

  // Handle item selection
  const handleItemSelect = (_: any, selectedItem: PurchaseItemSearchAdd | null) => {
    onChange(selectedItem);
    setSearchQueryItem(selectedItem ? selectedItem.itemName : '');
    setOpen(false);
  };

  return (
    <Autocomplete
      fullWidth={fullWidth}
      options={filteredItems}
      getOptionLabel={(option: PurchaseItemSearchAdd) => option.itemName || ''}
      isOptionEqualToValue={(option, value) =>
        option?.purchaseitemId === value?.purchaseitemId
      }
      value={value}
      inputValue={searchQueryItem}
      onInputChange={(_, newInputValue) => handleSearchChangeItem(newInputValue)}
      onChange={handleItemSelect}
      open={open}
      onOpen={() => {
        setOpen(true);
        if (!initialLoadDone) {
          setInitialLoadDone(true);
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
      noOptionsText={searchQueryItem ? 'No items found' : 'Type to search'}
      filterOptions={(options) => options}
    />
  );
};

export default PurchaseItemAutocomplete;