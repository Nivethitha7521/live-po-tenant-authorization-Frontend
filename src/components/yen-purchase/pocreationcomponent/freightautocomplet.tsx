// FreightAutocomplete.tsx
"use client";
import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import { AppDispatch, RootState } from '@/redux/store';
import { Freight } from '@/Models/freightModel';
import { fetchFreightItems } from '@/features/yen-purchase/PurchaseMaster/FreightMasterSlice';


interface FreightAutocompleteProps {
  value: Freight | null;
  onChange: (freight: Freight | null) => void;
  label?: string;
  error?: boolean;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  defaultFreightName?: string; // Optional prop to set default freight by name
}

const FreightAutocomplete: React.FC<FreightAutocompleteProps> = ({
  value,
  onChange,
  label = "Select Freight",
  error = false,
  helperText = "",
  required = false,
  disabled = false,
  defaultFreightName = "", // Default to empty, can be set via prop
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { items: freightItems, loading } = useSelector((state: RootState) => state.freightItems || {
    items: [],
    loading: false
  });
  
  const [options, setOptions] = useState<Freight[]>([]);
  const hasSetDefault = useRef(false);

  useEffect(() => {
    if (freightItems.length === 0) {
      dispatch(fetchFreightItems());
    }
  }, [dispatch, freightItems.length]);

  useEffect(() => {
    // Filter active freight items (status === 'active' or '1')
    const activeFreight = freightItems.filter((freight: Freight) => 
      freight.status === 'active' || freight.status === '1'
    );
    setOptions(activeFreight);

    // Set default freight if no value selected and not already set
    if (!value && activeFreight.length > 0 && !hasSetDefault.current) {
      let defaultFreight: Freight | undefined;
      
      // If defaultFreightName prop is provided, try to find matching freight
      if (defaultFreightName) {
        defaultFreight = activeFreight.find((freight: Freight) =>
          freight.freightName?.toLowerCase().includes(defaultFreightName.toLowerCase())
        );
      }
      
      // Fallback to first active freight if no specific default found
      if (!defaultFreight && activeFreight.length > 0) {
        defaultFreight = activeFreight[0];
      }
      
      if (defaultFreight) {
        onChange(defaultFreight);
        hasSetDefault.current = true;
        console.log('Default freight set to:', defaultFreight.freightName);
      }
    }
  }, [freightItems, value, onChange, defaultFreightName]);

  const handleChange = (event: React.SyntheticEvent, newValue: Freight | null) => {
    onChange(newValue);
    // Reset flag if cleared to null (allows re-default on next mount/clear)
    if (newValue === null) {
      hasSetDefault.current = false;
    }
  };

  if (loading && options.length === 0) {
    return <TextField label={label} disabled size="small" variant="outlined" />;
  }

  return (
    <Autocomplete
      fullWidth
      options={options}
      value={value}
      onChange={handleChange}
      getOptionLabel={(option) => option.freightName || ''}
      isOptionEqualToValue={(option, value) => option.freightId === value?.freightId}
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
      noOptionsText={loading ? "Loading..." : "No active freight available"}
    />
  );
};

export default FreightAutocomplete;