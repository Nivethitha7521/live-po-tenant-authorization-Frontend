import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/redux/store';
import { searchVendorsByExactName } from '@/features/yen-purchase/PurchaseMaster/vendorSlice';
import { VendorSearch } from '@/Models/vendor';

interface VendorSearchAutocompleteProps {
  value: VendorSearch | null;
  onChange: (item: VendorSearch | null) => void;
  label?: string;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  required?: boolean;
  limit?: number; // Added limit as optional prop
}

const VendorSearchAutocomplete: React.FC<VendorSearchAutocompleteProps> = ({
  value,
  onChange,
  label = "All Vendors",
  error = undefined,
  helperText = "",
  fullWidth = true,
  required = false,
  limit = 50 // Default limit if not provided
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const [open, setOpen] = useState(false);
  const [vendors, setVendors] = useState<VendorSearch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [noResultsFound, setNoResultsFound] = useState(false);
  
  // Ref to track if we've already checked for no results
  const hasCheckedNoResultsRef = useRef(false);

  // Memoize fetchVendors to prevent unnecessary re-renders
  const fetchVendors = useCallback((vendor_name: string, skipValue: number, forceRefresh = false) => {
    if (loading || (!forceRefresh && skipValue > 0 && !hasMore)) return;
    
    // Reset the no results check when search query changes
    if (skipValue === 0) {
      hasCheckedNoResultsRef.current = false;
      setNoResultsFound(false);
    }
    
    setLoading(true);
    dispatch(searchVendorsByExactName({ vendor_name, skip: skipValue, limit, forceRefresh }))
      .unwrap()
      .then((newVendors) => {
        if (skipValue === 0) {
          setVendors(newVendors);
          // Check if no results were found on initial load
          if (newVendors.length === 0) {
            setNoResultsFound(true);
            hasCheckedNoResultsRef.current = true;
          }
        } else {
          const existingVendorsMap = new Map(vendors.map(vendor => [vendor.vendorId, vendor]));
          
          newVendors.forEach(vendor => {
            if (!existingVendorsMap.has(vendor.vendorId)) {
              existingVendorsMap.set(vendor.vendorId, vendor);
            }
          });
          
          setVendors(Array.from(existingVendorsMap.values()));
        }
        
        // Update hasMore based on whether we got fewer results than limit
        if (newVendors.length > 0) {
          setSkip(skipValue + limit);
          setHasMore(newVendors.length === limit);
        } else {
          setHasMore(false);
          // Only set noResultsFound if this is the initial search (skipValue === 0)
          if (skipValue === 0 && !hasCheckedNoResultsRef.current) {
            setNoResultsFound(true);
            hasCheckedNoResultsRef.current = true;
          }
        }
        
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        // On error, assume no more results to prevent infinite retries
        setHasMore(false);
        if (skipValue === 0 && !hasCheckedNoResultsRef.current) {
          setNoResultsFound(true);
          hasCheckedNoResultsRef.current = true;
        }
      });
  }, [dispatch, loading, vendors, setLoading, setVendors, setSkip, limit, hasMore]);

  // Handle input change with debounce
  const handleInputChange = (_: React.SyntheticEvent, newInputValue: string) => {
    setInputValue(newInputValue);
    setSearchQuery(newInputValue);
    setSkip(0);
    setHasMore(true);
    hasCheckedNoResultsRef.current = false;
    setNoResultsFound(false);
    
    if (newInputValue.length === 0 || newInputValue.length >= 1) {
      setVendors([]);
      fetchVendors(newInputValue, 0);
    }
  };

  // Handle scrolling to load more results
  const handleScroll = (event: React.UIEvent<HTMLUListElement>) => {
    const target = event.currentTarget;
    
    // Don't fetch more if we know there are no results or we've already found no results
    if (noResultsFound || !hasMore) return;
    
    // Check if user has scrolled near the bottom
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 50) {
      fetchVendors(searchQuery, skip);
    }
  };

  // Initial load when component opens
  useEffect(() => {
    if (open && vendors.length === 0 && !loading && !noResultsFound) {
      fetchVendors(searchQuery, 0);
    }
  }, [open, fetchVendors, loading, searchQuery, vendors, noResultsFound]);

  // Filter vendors locally based on search query for more responsive UI
  const filteredVendors = vendors.filter(vendor => {
    if (!searchQuery) return true;
    
    const name = vendor.vendorName.toLowerCase();
    const search = searchQuery.toLowerCase();
    
    return name.startsWith(search) || name.includes(search);
  });

  return (
    <Autocomplete
      fullWidth={fullWidth}
      options={filteredVendors}
      getOptionLabel={(option: VendorSearch) => option.vendorName || ''}
      isOptionEqualToValue={(option: VendorSearch, value: VendorSearch | null) => 
        option.vendorId === value?.vendorId
      }
      value={value}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      onChange={(_, newValue) => onChange(newValue)}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      filterOptions={(options) => options}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          variant="outlined"
          size="small"
          error={error}
          helperText={helperText}
          required={required}
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
          {option.vendorName}
        </li>
      )}
      ListboxProps={{
        onScroll: handleScroll as React.UIEventHandler<HTMLUListElement>,
        style: {
          maxHeight: 200, // Limit height to prevent infinite scroll area
        }
      }}
      loading={loading}
      loadingText="Loading vendors..."
      noOptionsText={noResultsFound ? "No vendors found" : "Type to search vendors"}
    />
  );
};

export default VendorSearchAutocomplete;