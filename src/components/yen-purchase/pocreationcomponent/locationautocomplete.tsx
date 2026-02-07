// LocationAutocomplete.tsx
// Fixed: Defaults to "Tehri" dynamically, shows/updates selections reliably

"use client";
import React, { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Autocomplete, TextField, CircularProgress } from "@mui/material";
import { AppDispatch, RootState } from "@/redux/store";
import {
  fetchStorageLocations,
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
    selectStorageLocations(state),
  );
  const [options, setOptions] = useState<Location[]>([]);
  const hasSetDefault = useRef(false);

  useEffect(() => {
    if (locations.length === 0) {
      dispatch(fetchStorageLocations());
    }
  }, [dispatch, locations.length]);

  useEffect(() => {
    // Filter active locations (status === 'active' or '1')
    const activeLocations = locations.filter(
      (loc: Location) =>
        loc.status === "active" ||
        loc.status === "1" ||
        loc.status === "Active",
    );

    // Sort alphabetically for better UX
    const sortedLocations = [...activeLocations].sort((a, b) =>
      a.branchName?.localeCompare(b.branchName || ""),
    );

    setOptions(sortedLocations);

    // Set default if no value selected and not already set
    if (!value && sortedLocations.length > 0 && !hasSetDefault.current) {
      // Try to find "Tehri" (case-insensitive)
      let defaultLocation = sortedLocations.find((loc: Location) =>
        loc.branchName?.toLowerCase().includes("tehri"),
      );

      // Fallback to first location if "Tehri" not found
      if (!defaultLocation) {
        defaultLocation = sortedLocations[0];
      }

      if (defaultLocation) {
        onChange(defaultLocation);
        hasSetDefault.current = true;
        console.log("Location default set to:", defaultLocation.branchName);
      }
    }
  }, [locations, value, onChange]);

  const handleChange = (
    event: React.SyntheticEvent,
    newValue: Location | null,
  ) => {
    onChange(newValue);
    if (newValue === null) {
      hasSetDefault.current = false;
    }
  };

  // Debug logging (remove in production)
  console.log("Location options:", options);
  console.log("Current value:", value);

  // Filter active locations (status === '1')

  if (loading && options.length === 0) {
    return <TextField label={label} disabled size="small" variant="outlined" />; // Graceful loading placeholder
  }

  return (
    <Autocomplete
      fullWidth
      options={options}
      value={value}
      onChange={handleChange}
      getOptionLabel={(option) => option.branchName || ""}
      isOptionEqualToValue={(option, value) =>
        option.branchId === value?.branchId
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
      noOptionsText={loading ? "Loading..." : "No active locations available"}
    />
  );
};

export default LocationAutocomplete;
