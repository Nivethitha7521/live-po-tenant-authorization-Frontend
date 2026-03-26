import React, { useEffect, useState } from 'react';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import { useDispatch } from 'react-redux';
import { searchPurchaseItems } from '@/features/yen-purchase/PurchaseMaster/purchaseItemSlice';
import { PurchaseItemSearchAdd } from '@/Models/purchaseModel';
import { AppDispatch } from '@/redux/store';

interface PurchaseItemAutocompleteProps {
  value: PurchaseItemSearchAdd | null;
  onChange: (item: PurchaseItemSearchAdd | null) => void;
  label: string;
  error?: boolean;
  helperText?: string;
  inputRef?: React.RefObject<HTMLInputElement>;
  locationId?: string | null;
  autoFocus?: boolean;
}

const PurchaseItemAutocomplete: React.FC<PurchaseItemAutocompleteProps> = ({
  value,
  onChange,
  label,
  error,
  helperText,
  inputRef,
  locationId,
  autoFocus = false
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<PurchaseItemSearchAdd[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // CRITICAL: Clear input value when value becomes null (item removed or added)
  useEffect(() => {
    if (value === null) {
      setInputValue('');  // Clear the displayed text in the dropdown
      setOptions([]);     // Clear options to prevent showing old results
    }
  }, [value]);

  // Reset when locationId changes
  useEffect(() => {
    if (value) {
      onChange(null);
    }
    setInputValue('');
    setOptions([]);
  }, [locationId]);

  // Search when input changes
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (inputValue.trim().length < 1) {
      setOptions([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await dispatch(searchPurchaseItems({
          searchQuery: inputValue,
          skip: 0,
          limit: 20,
          locationId: locationId,
          forceRefresh: true
        })).unwrap();
        
        console.log(`🔍 Search results for "${inputValue}" with location ${locationId || 'all'}:`, 
          results?.map(r => ({ name: r.itemName, stock: r.availableStock })) || []
        );
        
        setOptions(results || []);
      } catch (error) {
        console.error('Search failed:', error);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    setSearchTimeout(timeoutId);
    
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [inputValue, dispatch, locationId]);

  return (
    <Autocomplete
      value={value}
      onChange={(event, newValue) => {
        onChange(newValue);
        // When selection changes, update inputValue to show the selected item's name
        if (newValue) {
          setInputValue(newValue.itemName);
        } else {
          setInputValue('');
        }
      }}
      inputValue={inputValue}
      onInputChange={(event, newInputValue, reason) => {
        // Only update inputValue on user typing, not on selection
        if (reason === 'input') {
          setInputValue(newInputValue);
          onChange(null);
        }
      }}
      options={options}
      getOptionLabel={(option) => option?.itemName || ''}
      isOptionEqualToValue={(option, value) => option?.itemName === value?.itemName}
      autoHighlight
      autoSelect
      selectOnFocus
      clearOnBlur={false}
      handleHomeEndKeys
      loading={loading}
      renderInput={(params) => (
        <TextField
          {...params}
          inputRef={inputRef}
          label={label}
          error={error}
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
          autoFocus={autoFocus}
        />
      )}
    />
  );
};

export default PurchaseItemAutocomplete;