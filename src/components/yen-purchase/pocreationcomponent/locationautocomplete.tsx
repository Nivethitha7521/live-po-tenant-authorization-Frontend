// LocationAutocomplete.tsx
// Fixed: Defaults to "Tehri" dynamically, shows/updates selections reliably

"use client";
import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import { AppDispatch, RootState } from '@/redux/store';
import { fetchStorageLocations, selectStorageLocations } from '../../../features/yen-purchase/PurchaseMaster/StorageLocationSlice';

import { Location } from '@/Models/storagelocation';

interface LocationAutocompleteProps {
  value: Location | null;
  onChange: (location: Location | null) => void;
  label?: string;
  error?: boolean;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
}

const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({
  value,
  onChange,
  label = "Select Location",
  error = false,
  helperText = "",
  required = false,
  disabled = false,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { location: locations, loading } = useSelector((state: RootState) => selectStorageLocations(state));
  const [options, setOptions] = useState<Location[]>([]);
  const hasSetDefault = useRef(false);

  useEffect(() => {
    if (locations.length === 0) {
      dispatch(fetchStorageLocations());
    }
  }, [dispatch, locations.length]);

  useEffect(() => {
    // Filter active locations (status === '1')
    const activeLocations = locations.filter((loc: Location) => loc.status === '1');
    setOptions(activeLocations);

    // Set default to "Tehri" (or first active) if no value selected and not already set
    if (!value && activeLocations.length > 0 && !hasSetDefault.current) {
      // Dynamically find "Tehri" (case-insensitive partial match on branchName)
      let defaultLocation: Location | undefined = activeLocations.find((loc: Location) =>
        loc.branchName?.toLowerCase().includes('tehri')
      );
      // Fallback to first if no "Tehri"
      if (!defaultLocation) {
        defaultLocation = activeLocations[14];
      }
      if (defaultLocation) {
        onChange(defaultLocation);
        hasSetDefault.current = true;
        console.log('Default set to:', defaultLocation.branchName);  // Debug log
      }
    }
  }, [locations, value, onChange]);  // Removed activeLocations dep to avoid loops; relies on locations

  const handleChange = (event: React.SyntheticEvent, newValue: Location | null) => {
    onChange(newValue);
    // Reset flag ONLY if cleared to null (allows re-default on next mount/clear)
    // Don't reset on every change to prevent loops
    if (newValue === null) {
      hasSetDefault.current = false;
    }
  };

  if (loading && options.length === 0) {
    return <TextField label={label} disabled size="small" variant="outlined" />;  // Graceful loading placeholder
  }

  return (
    <Autocomplete
      fullWidth
      options={options}
      value={value}
      onChange={handleChange}
      getOptionLabel={(option) => option.branchName || ''}
      isOptionEqualToValue={(option, value) => option.branchId === value?.branchId}
      loading={loading}
      disabled={disabled || loading}
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
      noOptionsText={loading ? "Loading..." : "No active locations available"}
    />
  );
};

export default LocationAutocomplete;