import React, { useState, useEffect } from 'react';
import {
  Autocomplete,
  TextField,
  CircularProgress,
  AutocompleteProps
} from '@mui/material';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/redux/store';
import { POsearchPurchaseItems } from '@/features/yen-purchase/PurchaseMaster/purchaseItemSlice';

export interface PurchaseItemSearch {
  purchaseitemId: string;
  itemName: string;
}

interface ItemSearchAutocompleteProps {
  value: PurchaseItemSearch | null;
  onChange: (value: PurchaseItemSearch | null) => void;
  label?: string;
  limit?: number;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
}

const ItemSearchAutocomplete: React.FC<ItemSearchAutocompleteProps> = ({
  value,
  onChange,
  label = "Search Items",
  limit = 50,
  disabled = false,
  error = false,
  helperText
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const [allItems, setAllItems] = useState<PurchaseItemSearch[]>([]);
  const [open, setOpen] = useState(false);
  const [isFetchingItems, setIsFetchingItems] = useState(false);
  const [skip, setSkip] = useState(0);
  const [searchQueryItem, setSearchQueryItem] = useState('');
  const [hasMore, setHasMore] = useState(true);

  const handleItemSelect = (selectedValue: PurchaseItemSearch | null) => {
    onChange(selectedValue);
  };

  const fetchItems = (searchQuery: string, skipCount: number, append = false) => {
    if (isFetchingItems) return;
    
    setIsFetchingItems(true);
    dispatch(POsearchPurchaseItems({ searchQuery, skip: skipCount, limit }))
      .unwrap()
      .then((newItems) => {
        if (newItems.length < limit) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }
        
        if (append) {
          setAllItems(prevItems => [...prevItems, ...newItems]);
        } else {
          setAllItems(newItems);
        }
        
        if (skipCount === 0) {
          setSkip(limit);
        } else {
          setSkip(prevSkip => prevSkip + limit);
        }
      })
      .catch((error) => {
        console.error('Error fetching items:', error);
        setHasMore(false);
      })
      .finally(() => setIsFetchingItems(false));
  };

  // Fix: Remove the restrictive condition
  const handleInputChange = (event: React.SyntheticEvent, newInputValue: string) => {
    setSearchQueryItem(newInputValue);
    
    // Debounce the API call
    const timeoutId = setTimeout(() => {
      fetchItems(newInputValue, 0, false);
    }, 300);
    
    return () => clearTimeout(timeoutId);
  };

  const handleOpen = () => {
    setOpen(true);
    // Load initial data when dropdown opens
    if (allItems.length === 0 && !isFetchingItems) {
      fetchItems(searchQueryItem || '', 0, false);
    }
  };

  const handleScroll = (event: React.UIEvent<HTMLUListElement>) => {
    const target = event.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 10;
    
    if (isAtBottom && hasMore && !isFetchingItems) {
      fetchItems(searchQueryItem, skip, true);
    }
  };

  return (
    <Autocomplete
      fullWidth
      options={allItems}
      getOptionLabel={(option: PurchaseItemSearch) => option.itemName || ""}
      isOptionEqualToValue={(option: PurchaseItemSearch, value: PurchaseItemSearch | null) =>
        option.purchaseitemId === value?.purchaseitemId
      }
      value={value}
      onInputChange={handleInputChange}
      onChange={(_, value) => handleItemSelect(value)}
      open={open}
      onOpen={handleOpen}
      onClose={() => setOpen(false)}
      disabled={disabled}
      loading={isFetchingItems}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          variant="outlined"
          size="small"
          error={error}
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {isFetchingItems ? <CircularProgress size={20} /> : null}
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
        onScroll: handleScroll,
      }}
    />
  );
};

export default ItemSearchAutocomplete;