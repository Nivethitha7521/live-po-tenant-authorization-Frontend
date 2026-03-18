// LocationAutocomplete.tsx
// Working with the actual API response

"use client";
import React, { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Autocomplete, TextField, CircularProgress } from "@mui/material";
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
  const { location: locations, loading } = useSelector((state: RootState) =>
    selectStorageLocations(state)
  );
  const [options, setOptions] = useState<Location[]>([]);
  const hasSetDefault = useRef(false);

  // Fetch locations from the API
  useEffect(() => {
    if (locations.length === 0) {
      dispatch(fetchLocations());
    }
  }, [dispatch, locations.length]);

  // Process locations when they change
  useEffect(() => {
    console.log("All locations from API:", locations);
    
    // Locations are already filtered to active ones in the slice
    // Just sort alphabetically for better UX
    const sortedLocations = [...locations].sort((a, b) =>
      (a.branchName || "").localeCompare(b.branchName || "")
    );

    setOptions(sortedLocations);

    // Set default if no value selected and not already set
    if (!value && sortedLocations.length > 0 && !hasSetDefault.current) {
      // Try to find "Tehri" (case-insensitive)
      let defaultLocation = sortedLocations.find((loc: Location) =>
        loc.branchName?.toLowerCase().includes("tehri")
      );

      // If "Tehri" not found, try "ECR" 
      if (!defaultLocation) {
        defaultLocation = sortedLocations.find((loc: Location) =>
          loc.branchName?.toLowerCase().includes("ecr")
        );
      }

      // Fallback to first location if no specific match found
      if (!defaultLocation) {
        defaultLocation = sortedLocations[0];
      }

      if (defaultLocation) {
        onChange(defaultLocation);
        hasSetDefault.current = true;
        console.log("Default location set to:", defaultLocation.branchName);
      }
    }
  }, [locations, value, onChange]);

  const handleChange = (
    event: React.SyntheticEvent,
    newValue: Location | null
  ) => {
    onChange(newValue);
    if (newValue === null) {
      hasSetDefault.current = false;
    }
  };

  if (loading && options.length === 0) {
    return (
      <TextField
        label={label}
        disabled
        size="small"
        variant="outlined"
        fullWidth
      />
    );
  }

  return (
    <Autocomplete
      fullWidth
      options={options}
      value={value}
      onChange={handleChange}
      getOptionLabel={(option) => option?.branchName || ""}
      isOptionEqualToValue={(option, value) => 
        option?.locationId === value?.locationId
      }
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
          : "No active locations available"
      }
    />
  );
};

export default LocationAutocomplete;