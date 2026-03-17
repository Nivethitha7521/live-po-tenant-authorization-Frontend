// components/Inventory/physcialstockvarience/filterBar.tsx
"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  Box,
  IconButton,
  Menu,
  Checkbox,
  Typography,
  Button,
  Divider,
  Stack,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch } from "@/redux/store";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  selectFilterOptions,
  selectVisibleColumns,
  Branch,
  setSearchParams,
} from "../../../features/yen_inventory/OutletPhysicalVarianceSlice";
import CollapsibleFilter from "./ui/collabsfiler";
import FilterListIcon from "@mui/icons-material/FilterList";
import ClearIcon from "@mui/icons-material/Clear";
import { formatDateDDMMYYYY, useTodayDate } from "@/components/Hooks/useTodayDate";

export interface SearchParams {
  itemName: string[];
  varianceName: string[];
  category: string[];
  subCategory: string[];
  location?: string[];
  queryDate?: string;
}

type FilterField = keyof Omit<SearchParams, "queryDate" | "location">;

interface FilterBarProps {
  searchParams: SearchParams;
  onSearchChange: (field: keyof SearchParams, value: string[] | string) => void;
  branches: Branch[];
  selectedLocation: string;
  onLocationChange: (selectedOptions: string[] | string) => void;
  visibleColumns: Record<string, boolean>;
  onToggleColumn: (column: string) => void;
  fieldTypes: string[];
  staticColumns: string[];
  loading: boolean;
  isFullScreen?: boolean;
  fullScreenContainerRef?: React.RefObject<HTMLDivElement | null>;
  setResetAnchorEl?: (callback: () => void) => void;
  showColumnFilter: boolean;
  onLoadMoreFilterOptions?: (
    field: FilterField,
    page: number,
    search?: string
  ) => Promise<void>;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const FilterBarComponent: React.FC<FilterBarProps> = ({
  searchParams,
  onSearchChange,
  branches,
  selectedLocation,
  onToggleColumn,
  onLocationChange,
  fieldTypes,
  staticColumns,
  isFullScreen,
  fullScreenContainerRef,
  showColumnFilter,
  onRefresh,
  isRefreshing,
  onLoadMoreFilterOptions,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const filterOptions = useSelector(selectFilterOptions);
  const columns = useSelector(selectVisibleColumns);

  const apiDate = useTodayDate();
  const currentDate = searchParams.queryDate || apiDate;


  const filterFields: FilterField[] = [
    "category",
    "subCategory",
    "itemName",
    "varianceName",
  ];

  /* ---------------- Column Filter State ---------------- */
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [columnSearch, setColumnSearch] = useState("");

  const open = Boolean(anchorEl);
  const handleIconClick = (event: React.MouseEvent<HTMLButtonElement>) =>
    setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const columnOptions = useMemo(
    () => [
      ...staticColumns.map((col) => ({ label: col, value: col })),
      ...(selectedLocation
        ? fieldTypes
          .filter((col) => col !== "Action")
          .map((col) => ({ label: col, value: col }))
        : []),
    ],
    [staticColumns, fieldTypes, selectedLocation]
  );

  const selectedColumns = useMemo(
    () => Object.keys(columns).filter((col) => columns[col]),
    [columns]
  );

  const filteredColumnOptions = useMemo(() => {
    return columnOptions.filter((col) =>
      col.label.toLowerCase().includes(columnSearch.toLowerCase())
    );
  }, [columnOptions, columnSearch]);

  const handleColumnChange = useCallback(
    (column: string) => {
      onToggleColumn(column);
    },
    [onToggleColumn]
  );


  const handleClearAllFilters = () => {
    dispatch(
      setSearchParams({
        itemName: [],
        varianceName: [],
        category: [],
        subCategory: [],
        location: selectedLocation ? [selectedLocation] : [],
        queryDate: searchParams.queryDate || apiDate,
      })
    );
  };

  const isAnyFilterActive = filterFields.some(
    (field) => searchParams[field]?.length > 0
  );

  // --- FIX: Handlers for Search and Scroll ---

  // Handle Scroll Bottom (Load More)
  const handleFilterScroll = useCallback(
    (field: FilterField) => {
      if (!onLoadMoreFilterOptions) return;

      const currentFieldData = filterOptions[field];
      // Calculate next page based on current count and limit (assumed 50)
      const nextPage = (currentFieldData.page || 1) + 1;

      onLoadMoreFilterOptions(field, nextPage, currentFieldData.search);
    },
    [filterOptions, onLoadMoreFilterOptions]
  );

  // Handle Search Input Change
  const handleFilterSearch = useCallback(
    (field: FilterField, searchTerm: string) => {
      if (!onLoadMoreFilterOptions) return;
      // Reset to page 1 when searching
      onLoadMoreFilterOptions(field, 1, searchTerm);
    },
    [onLoadMoreFilterOptions]
  );

  const selectedBranchAlias = useMemo(() => {
    const branch = branches.find(
      (b) => b.locationId === selectedLocation
    );
    return branch?.aliasName || branch?.locationName || selectedLocation;
  }, [branches, selectedLocation]);





  /* ---------------- Render ---------------- */

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#fff",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: 1, mt: 0.5 }}>

        {/* Date */}
        <CollapsibleFilter
          title="Date"
          selectedOptions={currentDate ? formatDateDDMMYYYY(currentDate) : ""}
          onChange={(val) => onSearchChange("queryDate", val)}
          onClear={() => onSearchChange("queryDate", "")}
          inputType="date"

          isMulti={false}
          disabled
        />

        {/* Location */}
        <CollapsibleFilter
          title="Location"
          options={branches.map((b) => ({
            label: `${b.locationName} (${b.locationId || ""})`,
            value: b.locationId,
          }))}
          selectedOptions={selectedLocation}
          onChange={onLocationChange}
          onClear={() => onLocationChange("")}
          inputType="single-select"
          isMulti={false}
          showSelectedCount={false}
          showRemoveOption={false}
          displayLabel={selectedBranchAlias}

        />

        {/* Dynamic Filters */}
        {filterFields.map((field) => (
          <CollapsibleFilter
            key={field}
            title={field.charAt(0).toUpperCase() + field.slice(1)}
            options={
              filterOptions[field]?.values.map((val: any) => ({
                label: typeof val === "string" ? val : val.name,
                value: typeof val === "string" ? val : val.id ?? val.name,
              })) || []
            }
            selectedOptions={searchParams[field]}
            onChange={(val) => onSearchChange(field, val)}
            onClear={() => onSearchChange(field, [])}
            inputType="multi-select"
            isMulti
            // --- FIX: Pass handlers here ---
            onScrollBottom={() => handleFilterScroll(field)}
            onSearch={(term) => handleFilterSearch(field, term)}
            loading={filterOptions[field]?.loading || false}
          />
        ))}
        <Stack direction="row" spacing={2}>

          {/* Clear */}
          <Button
            onClick={handleClearAllFilters}
            disabled={!isAnyFilterActive}
            color="error"
            variant="outlined"
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              py: 1,
              px: 2,
              minWidth: 70,
            }}
          >
            <ClearIcon fontSize="small" />
            <Typography variant="caption">
              Clear
            </Typography>
          </Button>

          {/* Refresh */}
          <Button
            onClick={onRefresh}
            disabled={!selectedLocation || isRefreshing}
            color="primary"
            variant="outlined"
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              py: 1,
              px: 2,
              minWidth: 70,
            }}
          >
            <RefreshIcon fontSize="small" />
            <Typography variant="caption">
              Refresh
            </Typography>
          </Button>

        </Stack>
        {/* Compact Column Filter */}
        {showColumnFilter && selectedLocation && (
          <>
            <IconButton
              size="small"
              onClick={handleIconClick}
              sx={{
                textTransform: "none",
                fontSize: "0.9rem",
                color: open ? "primary.main" : "inherit",
                backgroundColor: open ? "action.selected" : "transparent",
                "&:hover": {
                  backgroundColor: "action.hover",
                },
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <FilterListIcon fontSize="small" />
            </IconButton>

            <Menu
              open={open}
              anchorEl={anchorEl}
              onClose={handleMenuClose}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              disableScrollLock
              container={isFullScreen ? fullScreenContainerRef?.current : undefined}
              PaperProps={{
                sx: {
                  width: 200,
                  borderRadius: 2,
                  p: 1,
                  mt: 1,
                  boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
                  zIndex: isFullScreen ? 1500 : 1300,
                },
              }}
            >
              {/* Header */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 0.5,
                }}
              >
                <Typography fontWeight={600} fontSize="0.78rem">
                  Show/Hide Columns
                </Typography>

                <IconButton size="small" onClick={handleMenuClose}>
                  <CloseIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Box>

              <Divider />

              {/* Column List */}
              <Box sx={{ maxHeight: 170, overflowY: "auto", mt: 0.5 }}>
                {filteredColumnOptions.map((option) => {
                  const isChecked = selectedColumns.includes(option.value);

                  return (
                    <Box
                      key={option.value}
                      onClick={() => handleColumnChange(option.value)}
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        px: 0.7,
                        py: 0.45,
                        borderRadius: 1,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        "&:hover": {
                          backgroundColor: "#eef2f6",
                        },
                      }}
                    >
                      <Typography
                        fontSize="0.72rem"
                        fontWeight={isChecked ? 500 : 400}
                        color={isChecked ? "text.primary" : "text.secondary"}
                        noWrap
                      >
                        {option.label}
                      </Typography>

                      <Checkbox
                        size="small"
                        checked={isChecked}
                        onClick={(e) => e.stopPropagation()}
                        sx={{ p: 0.25 }}
                      />
                    </Box>
                  );
                })}
              </Box>
            </Menu>
          </>
        )}
      </Box>
    </Box>
  );
};

export default React.memo(FilterBarComponent);