import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/redux/store';
import { searchVendors } from '@/features/yen-purchase/PurchaseMaster/vendorSlice';
import { VendorSummary } from '@/Models/vendor';

interface VendorAutocompleteProps {
  value: VendorSummary | null;
  onChange: (item: VendorSummary | null) => void;
  label?: string;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  required?: boolean;
}

const VendorAutocomplete: React.FC<VendorAutocompleteProps> = ({
  value,
  onChange,
  label = "Select Vendor",
  error = undefined,
  helperText = "",
  fullWidth = true,
  required = false
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const [open, setOpen] = useState(false);
  const [allVendors, setAllVendors] = useState<VendorSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [skip, setSkip] = useState(0);
  const limit = 50;
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const listboxRef = useRef<HTMLUListElement | null>(null);

  // Memoize fetchVendors to prevent unnecessary re-creation
  const fetchVendors = useCallback((searchQuery: string, skipValue: number, forceRefresh = false) => {
    if (loading) return;

    setLoading(true);
    dispatch(searchVendors({ searchQuery, skip: skipValue, limit, forceRefresh }))
      .unwrap()
      .then((newVendors) => {
        if (skipValue === 0) {
          setAllVendors(newVendors);
        } else {
          const existingVendorsMap = new Map(allVendors.map(vendor => [vendor.vendorId, vendor]));
          newVendors.forEach(vendor => {
            if (!existingVendorsMap.has(vendor.vendorId)) {
              existingVendorsMap.set(vendor.vendorId, vendor);
            }
          });
          setAllVendors(Array.from(existingVendorsMap.values()));
        }
        setSkip(skipValue + limit);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [dispatch, loading, allVendors, limit]);

  // Initial load when autocomplete opens
  useEffect(() => {
    if (open && allVendors.length === 0 && !loading) {
      fetchVendors(searchQuery, 0, true);
    }
  }, [open, allVendors, fetchVendors, loading, searchQuery]); // Added dependencies

  const handleInputChange = (_: React.SyntheticEvent, newInputValue: string) => {
    setInputValue(newInputValue);
    setSearchQuery(newInputValue);
    setSkip(0);
    fetchVendors(newInputValue, 0, true);
  };

  const loadMoreVendors = useCallback(() => {
    if (loading) return;
    fetchVendors(searchQuery, skip, true);
  }, [fetchVendors, loading, searchQuery, skip]);

  const handleScroll = (event: React.UIEvent<HTMLUListElement>) => {
    const target = event.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 50) {
      loadMoreVendors();
    }
  };

  // Handle key down events - Select first matching on Tab
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Tab' && open && allVendors.length > 0) {
      // Find the first matching option based on current search query
      const firstMatch = allVendors.find(vendor => 
        vendor.vendorName?.toLowerCase().includes(searchQuery.toLowerCase()) || false
      );
      if (firstMatch) {
        // Select the first matching vendor
        onChange(firstMatch);
        setInputValue(firstMatch.vendorName || '');
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

  return (
    <Autocomplete
      fullWidth={fullWidth}
      options={allVendors}
      getOptionLabel={(option: VendorSummary) => option.vendorName || ''}
      isOptionEqualToValue={(option: VendorSummary, value: VendorSummary | null) => 
        option.vendorId === value?.vendorId
      }
      value={value}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      onChange={(_, selectedValue) => onChange(selectedValue)}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      onKeyDown={handleKeyDown}
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
          required={required}
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
        <li {...props} key={option.vendorId}>
          {option.vendorName || ''}
        </li>
      )}
      ListboxProps={{
        ref: listboxRef,
        onScroll: handleScroll as React.UIEventHandler<HTMLUListElement>
      }}
      loading={loading}
      loadingText="Loading vendors..."
    />
  );
};

export default VendorAutocomplete;