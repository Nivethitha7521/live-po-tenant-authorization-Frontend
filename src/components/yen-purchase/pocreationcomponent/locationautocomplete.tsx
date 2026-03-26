"use client";
import React, { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Autocomplete, TextField, CircularProgress, Box, Typography, IconButton } from "@mui/material";
import ClearIcon from '@mui/icons-material/Clear';
import { AppDispatch, RootState } from "@/redux/store";
import {
  fetchLocations,
  selectStorageLocations,
} from "../../../features/yen-purchase/PurchaseMaster/StorageLocationSlice";
import { Location } from "@/Models/storagelocation";

interface LocationAutocompleteProps {
  value: Location | null;
  onChange: (location: Location | null) => void;
  label?: string;
  error?: boolean;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  locationId?: string;
  locationName?: string;
  isEditMode?: boolean;
}

const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({
  value,
  onChange,
  label = "Select Receiving Location",
  error = false,
  helperText = "",
  required = false,
  disabled = false,
  locationId,
  locationName,
  isEditMode = false,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { location: locations, loading } = useSelector((state: RootState) =>
    selectStorageLocations(state)
  );
  const [options, setOptions] = useState<Location[]>([]);
  const [inputValue, setInputValue] = useState('');
  const hasInitialized = useRef(false);
  const isManuallyCleared = useRef(false);
  
  const PRODUCTION_LOCATION_ID = "WH001";

  // Fetch locations from the API
  useEffect(() => {
    if (locations.length === 0) {
      dispatch(fetchLocations());
    }
  }, [dispatch, locations.length]);

  // Process locations when they change
  useEffect(() => {
    const sortedLocations = [...locations].sort((a, b) =>
      (a.branchName || "").localeCompare(b.branchName || "")
    );
    setOptions(sortedLocations);
  }, [locations]);

  // Handle initial value setting (only once, not on every re-render)
  useEffect(() => {
    // Skip if manually cleared or already initialized
    if (isManuallyCleared.current) {
      return;
    }

    if (!hasInitialized.current && options.length > 0 && !value) {
      if (isEditMode) {
        // EDIT MODE: Use the location from the PO data
        if (locationId) {
          let locationFromPO = options.find(
            (loc) => loc.locationId === locationId
          );

          if (!locationFromPO && locationName) {
            locationFromPO = options.find(
              (loc) => loc.branchName === locationName
            );
          }

          if (locationFromPO) {
            console.log("✅ Edit mode: Setting location from PO:", locationFromPO.branchName);
            onChange(locationFromPO);
            setInputValue(locationFromPO.branchName || '');
          }
        }
      } else {
        // CREATE MODE: Set default to Production WH-Main
        const defaultLocation = options.find(
          (loc) => loc.locationId === PRODUCTION_LOCATION_ID
        );
        
        if (defaultLocation) {
          console.log("🏭 Create mode: Setting default location to Production WH-Main:", defaultLocation.branchName);
          onChange(defaultLocation);
          setInputValue(defaultLocation.branchName || '');
        } else if (options.length > 0) {
          console.log("⚠️ Production WH-Main not found, using first available location:", options[0].branchName);
          onChange(options[0]);
          setInputValue(options[0].branchName || '');
        }
      }
      
      hasInitialized.current = true;
    }
  }, [options, locationId, locationName, value, onChange, isEditMode]);

  // Update inputValue when value changes externally
  useEffect(() => {
    if (value) {
      setInputValue(value.branchName || '');
    } else if (!isManuallyCleared.current) {
      setInputValue('');
    }
  }, [value]);

  const handleChange = (
    event: React.SyntheticEvent,
    newValue: Location | null
  ) => {
    console.log("📍 Location selected by user:", newValue);
    
    if (newValue === null) {
      // User cleared the selection
      isManuallyCleared.current = true;
      hasInitialized.current = true; // Prevent re-initialization
      setInputValue(''); // Clear input field
    } else {
      // User selected a location
      isManuallyCleared.current = false;
      setInputValue(newValue.branchName || '');
    }
    
    onChange(newValue);
  };

  const handleClear = () => {
    // Manually clear the field
    isManuallyCleared.current = true;
    hasInitialized.current = true;
    setInputValue('');
    onChange(null);
  };

  const handleInputChange = (event: React.SyntheticEvent, newInputValue: string, reason: string) => {
    if (reason === 'input') {
      setInputValue(newInputValue);
      
      // If user types something and it's not empty, consider it as manual entry
      if (newInputValue.trim() !== '') {
        isManuallyCleared.current = false;
      } else if (newInputValue === '') {
        // User deleted all text - clear the selection
        isManuallyCleared.current = true;
        onChange(null);
      }
    } else if (reason === 'reset') {
      // Reset triggered by clear button
      setInputValue('');
    }
  };

  if (loading && options.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <TextField
          label={label}
          disabled
          size="small"
          variant="outlined"
          fullWidth
        />
        {loading && <CircularProgress size={20} sx={{ ml: 1 }} />}
      </Box>
    );
  }

  return (
    <Autocomplete
      fullWidth
      options={options}
      value={value}
      onChange={handleChange}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      getOptionLabel={(option) => {
        return option?.branchName ? option.branchName : "";
      }}
      renderOption={(props, option) => {
        const { key, ...otherProps } = props;
        return (
          <li key={key} {...otherProps}>
            <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
              <Typography variant="body1" fontWeight="medium">
                {option.branchName}
              </Typography>
              {option.locationId && (
                <Typography variant="caption" color="text.secondary">
                  ID: {option.locationId}
                </Typography>
              )}
            </Box>
          </li>
        );
      }}
      isOptionEqualToValue={(option, value) =>
        option?.locationId === value?.locationId
      }
      loading={loading}
      disabled={disabled || loading}
      clearOnEscape
      handleHomeEndKeys
      filterOptions={(options, state) => {
        const searchText = state.inputValue.toLowerCase();
        return options.filter(option =>
          option.branchName?.toLowerCase().includes(searchText) ||
          option.locationId?.toLowerCase().includes(searchText)
        );
      }}
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
                {loading ? (
                  <CircularProgress color="inherit" size={20} />
                ) : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      noOptionsText={
        loading
          ? "Loading locations..."
          : "No locations available"
      }
    />
  );
};

export default LocationAutocomplete;