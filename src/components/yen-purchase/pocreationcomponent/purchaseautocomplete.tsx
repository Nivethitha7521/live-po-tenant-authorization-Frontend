import React, { useEffect, useState, useRef } from 'react';
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
  inputRef?: React.RefObject<HTMLInputElement> | React.ForwardedRef<HTMLInputElement>;
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
  const isEditingRef = useRef(false);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const inputElementRef = useRef<HTMLInputElement | null>(null);

  // CRITICAL FIX: Sync inputValue with value when value changes (e.g., from edit)
  useEffect(() => {
    if (value) {
      // Set the input value to show the item name
      setInputValue(value.itemName);
      console.log('✅ Set inputValue to:', value.itemName);
      
      // CRITICAL FIX: Set cursor to end of input after value is set
      setTimeout(() => {
        if (inputElementRef.current) {
          // Focus and move cursor to end
          inputElementRef.current.focus();
          const length = inputElementRef.current.value.length;
          inputElementRef.current.setSelectionRange(length, length);
          console.log('✅ Cursor moved to end of input');
        }
      }, 50);
    } else {
      setInputValue('');
    }
  }, [value]);

  // Reset when location changes
  useEffect(() => {
    if (value && !isEditingRef.current) {
      onChange(null);
    }
    if (!isEditingRef.current) {
      setInputValue('');
      setOptions([]);
    }
  }, [locationId]);

  // Search when input changes
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Don't search if input matches current selected item
    if (value && inputValue === value.itemName) {
      setOptions([]);
      return;
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
  }, [inputValue, dispatch, locationId, value]);

  // Handle Tab key to select first option
  const handleKeyDown = (event: React.KeyboardEvent) => {
    // If Tab is pressed and there are options available
    if (event.key === 'Tab' && options.length > 0 && inputValue.trim() !== '') {
      // Check if current value is not already selected or doesn't match input
      if (!value || value.itemName !== inputValue) {
        event.preventDefault(); // Prevent default tab behavior temporarily
        
        // Select the first option
        const firstOption = options[0];
        onChange(firstOption);
        setInputValue(firstOption.itemName);
        
        // After selection, allow natural tab flow to next field
        setTimeout(() => {
          // Programmatically move focus to next element
          const focusableElements = document.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          const currentIndex = Array.from(focusableElements).findIndex(
            el => el === autocompleteRef.current?.querySelector('input')
          );
          if (currentIndex !== -1 && focusableElements[currentIndex + 1]) {
            (focusableElements[currentIndex + 1] as HTMLElement).focus();
          }
        }, 0);
      }
    }
    
    // Optional: Handle Enter key to select first option if nothing selected
    if (event.key === 'Enter' && !value && options.length > 0 && inputValue.trim() !== '') {
      event.preventDefault();
      const firstOption = options[0];
      onChange(firstOption);
      setInputValue(firstOption.itemName);
    }
  };

  // Function to set cursor position when input gets focus
  const handleInputFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    // If there's a value, move cursor to end
    if (event.target.value) {
      const length = event.target.value.length;
      event.target.setSelectionRange(length, length);
    }
  };

  // Helper function to set refs
  const setRefs = (node: HTMLInputElement | null) => {
    // Set internal ref
    inputElementRef.current = node;
    
    // Set external ref if provided
    if (inputRef) {
      if (typeof inputRef === 'function') {
        inputRef(node);
      } else {
        // Handle React.RefObject
        (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
      }
    }
  };

  return (
    <div ref={autocompleteRef}>
      <Autocomplete
        value={value}
        onChange={(event, newValue) => {
          isEditingRef.current = false;
          onChange(newValue);
          if (newValue) {
            setInputValue(newValue.itemName);
          } else {
            setInputValue('');
          }
        }}
        inputValue={inputValue}
        onInputChange={(event, newInputValue, reason) => {
          // Only update on user typing
          if (reason === 'input') {
            setInputValue(newInputValue);
            // Clear selection if user types something different
            if (value && newInputValue !== value.itemName) {
              isEditingRef.current = false;
              onChange(null);
            }
          }
        }}
        onKeyDown={handleKeyDown}
        options={options}
        getOptionLabel={(option) => option?.itemName || ''}
        isOptionEqualToValue={(option, value) => option?.itemName === value?.itemName}
        autoHighlight
        selectOnFocus
        clearOnBlur={false}
        handleHomeEndKeys
        loading={loading}
        renderInput={(params) => (
          <TextField
            {...params}
            inputRef={setRefs}
            label={label}
            error={error}
            helperText={helperText}
            onFocus={handleInputFocus}
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
    </div>
  );
};

export default PurchaseItemAutocomplete;