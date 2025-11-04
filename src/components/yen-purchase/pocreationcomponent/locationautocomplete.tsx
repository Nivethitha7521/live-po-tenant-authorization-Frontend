// LocationAutocomplete.tsx
// Assuming this is in '../../../../components/yen-purchase/pocreationcomponent/locationautocomplete.tsx'

"use client";
import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import { AppDispatch, RootState } from '@/redux/store';
import { fetchLocations, selectStorageLocations } from '../../../features/yen-purchase/PurchaseMaster/StorageLocationSlice'; // Fixed missing space after "from"

import { Location } from '@/Models/storagelocation'; // Ensure Location interface is imported here

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
  const [options, setOptions] = useState<Location[]>([]); // Filtered active locations
  const hasSetDefault = useRef(false); // Flag to ensure default is set only once

  useEffect(() => {
    // Fetch locations if not loaded
    if (locations.length === 0) {
      dispatch(fetchLocations());
    }
  }, [dispatch, locations.length]);

  useEffect(() => {
    // Filter active locations (status === '1')
    const activeLocations = locations.filter((loc: Location) => loc.status === '1');
    setOptions(activeLocations);

    // Set default to first active location if no value is selected and not already set
    if (!value && activeLocations.length > 0 && !hasSetDefault.current) {
      onChange(activeLocations[0]);
      hasSetDefault.current = true;
    }
  }, [locations, value, onChange]);

  const handleChange = (event: React.SyntheticEvent, newValue: Location | null) => {
    onChange(newValue);
    // Reset the default flag if user manually changes (including to null)
    if (newValue !== value) {
      hasSetDefault.current = false;
    }
  };

  return (
    <Autocomplete
      fullWidth
      options={options}
      value={value}
      onChange={handleChange}
      getOptionLabel={(option) => option.branchName || ''} // Display branchName - TypeScript now recognizes it from imported Location interface
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