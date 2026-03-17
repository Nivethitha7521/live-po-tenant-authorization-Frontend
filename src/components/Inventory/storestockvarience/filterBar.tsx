import React, { useState, useRef } from "react";
import {
  Typography,
  Menu,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Box,
  Button,
  IconButton,
  Divider,
  TextField,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import FilterListIcon from "@mui/icons-material/FilterList";
import RefreshIcon from "@mui/icons-material/Refresh"; // 1. Import Refresh Icon
import CollapsibleFilter from "../physcialstockvarience/ui/collabsfiler";
import ClearIcon from '@mui/icons-material/Clear';
import { formatDateDDMMYYYY, getTodayDate } from "@/components/Hooks/useTodayDate";

export interface FilterBarProps {
  searchParams: {
    itemName: string[];
    varianceName: string[];
    category: string[];
    subcategory: string[];
    locationName: string;
    createdDate?: string;
  };
  onSearchChange: (field: string, value: string[] | string) => void;
  setOpenDownloadDialog: (open: boolean) => void;
  filterOptions: {
    category: string[];
    subcategory: string[];
    itemName: string[];
    varianceName: string[];
    warehouses: { name: string; locationId: string; aliasName: string }[];
  };
  visibleColumns: Record<string, boolean>;
  onColumnVisibilityChange: (columns: Record<string, boolean>) => void;
  onFilterSearch: (
    field: "category" | "subcategory" | "itemName" | "varianceName" | "locationName",
    searchTerm: string
  ) => void;
  onFilterScrollBottom: (
    field: "category" | "subcategory" | "itemName" | "varianceName" | "locationName"
  ) => void;
  getWarehouseName: (id: string) => string;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  onClearAllFilters?: () => void;
  onRefresh?: () => void; // 2. Add onRefresh prop
  isRefreshing?: boolean; // 3. Add loading state prop (optional but good for UX)
}

const FilterBar: React.FC<FilterBarProps> = ({
  searchParams,
  onSearchChange,
  filterOptions,
  visibleColumns,
  onColumnVisibilityChange,
  onFilterSearch,
  onFilterScrollBottom,
  onClearAllFilters,
  onRefresh,
  isRefreshing,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const columnButtonRef = useRef<HTMLButtonElement | null>(null);
  const [columnSearch, setColumnSearch] = useState("")

  // ... (existing handlers: handleColumnClick, handleColumnClose, handleColumnToggle, etc.)

  const handleClearFilters = () => {
    onSearchChange("category", []);
    onSearchChange("subcategory", []);
    onSearchChange("itemName", []);
    onSearchChange("varianceName", []);
    onFilterSearch("category", "");
    onFilterSearch("subcategory", "");
    onFilterSearch("itemName", "");
    onFilterSearch("varianceName", "");
    if (onClearAllFilters) {
      onClearAllFilters();
    }
  };

  const open = Boolean(anchorEl);

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 2,
        ml: 1,
        p: 1,
        width: "100%",
      }}
    >
      {/* Left Section: Filters */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
          flexGrow: 1,
        }}
      >
        {/* Date Filter */}
        <CollapsibleFilter
          title="Date"
          selectedOptions={searchParams.createdDate ? formatDateDDMMYYYY(searchParams.createdDate) : ""}
          onChange={(value) =>
            onSearchChange("createdDate", Array.isArray(value) ? value[0] : value)
          }
          onClear={() => onSearchChange("createdDate", getTodayDate())}
          inputType="date"
          isMulti={false}
          showSelectedCount={false}
          restrictToTodayOnly={true}
          disabled={true}
        />

        {/* Location Filter */}
        <CollapsibleFilter
          title="Location"
          options={filterOptions.warehouses.map((warehouse) => ({
            label: `${warehouse.name} (${warehouse.locationId})`,
            value: warehouse.locationId,
          }))}
          selectedOptions={
            searchParams.locationName
              ? [searchParams.locationName]
              : []
          }
          onChange={(value) =>
            onSearchChange(
              "locationName",
              Array.isArray(value) ? value[0] : value
            )
          }
          onClear={() => {
            onSearchChange("locationName", "");
            onFilterSearch("locationName", "");
          }}
          onScrollBottom={() => onFilterScrollBottom("locationName")}
          onSearch={(searchTerm) =>
            onFilterSearch("locationName", searchTerm)
          }
          inputType="single-select"
          isMulti={false}
          showSelectedCount={false}
          showRemoveOption={false}
          displayLabel={
            searchParams.locationName
              ? filterOptions.warehouses.find(w => w.locationId === searchParams.locationName)?.aliasName
              : "Location"
          }
        />

        {/* Category, Subcategory, Itemgroup, ItemName Filters */}
        {/* ... (Keep your existing CollapsibleFilter components here exactly as they are) ... */}

        <CollapsibleFilter
          title="Category"
          options={filterOptions.category.map((name) => ({ label: name, value: name }))}
          selectedOptions={searchParams.category}
          onChange={(value) => onSearchChange("category", Array.isArray(value) ? value : [value])}
          onClear={() => { onSearchChange("category", []); onFilterSearch("category", ""); }}
          onScrollBottom={() => onFilterScrollBottom("category")}
          onSearch={(searchTerm) => onFilterSearch("category", searchTerm)}
          inputType="multi-select"
          isMulti={true}
        />

        <CollapsibleFilter
          title="Subcategory"
          options={filterOptions.subcategory.map((name) => ({ label: name, value: name }))}
          selectedOptions={searchParams.subcategory}
          onChange={(value) => onSearchChange("subcategory", Array.isArray(value) ? value : [value])}
          onClear={() => { onSearchChange("subcategory", []); onFilterSearch("subcategory", ""); }}
          onScrollBottom={() => onFilterScrollBottom("subcategory")}
          onSearch={(searchTerm) => onFilterSearch("subcategory", searchTerm)}
          inputType="multi-select"
          isMulti={true}
        />

        <CollapsibleFilter
          title="Itemgroup"
          options={filterOptions.itemName.map((name) => ({ label: name, value: name }))}
          selectedOptions={searchParams.itemName}
          onChange={(value) => onSearchChange("itemName", Array.isArray(value) ? value : [value])}
          onClear={() => { onSearchChange("itemName", []); onFilterSearch("itemName", ""); }}
          onScrollBottom={() => onFilterScrollBottom("itemName")}
          onSearch={(searchTerm) => onFilterSearch("itemName", searchTerm)}
          inputType="multi-select"
          isMulti={true}
        />

        <CollapsibleFilter
          title="ItemName"
          options={filterOptions.varianceName.map((name) => ({ label: name, value: name }))}
          selectedOptions={searchParams.varianceName}
          onChange={(value) => onSearchChange("varianceName", Array.isArray(value) ? value : [value])}
          onClear={() => { onSearchChange("varianceName", []); onFilterSearch("varianceName", ""); }}
          onScrollBottom={() => onFilterScrollBottom("varianceName")}
          onSearch={(searchTerm) => onFilterSearch("varianceName", searchTerm)}
          inputType="multi-select"
          isMulti={true}
        />
        {/* Clear Filters */}
        <Button
          variant="outlined"
          color="error"
          onClick={handleClearFilters}
          disabled={
            !(
              searchParams.category.length > 0 ||
              searchParams.subcategory.length > 0 ||
              searchParams.itemName.length > 0 ||
              searchParams.varianceName.length > 0
            )
          }
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            py: 0.8,
            px: 1.5,
            minWidth: 65,
          }}
        >
          <ClearIcon fontSize="small" />
          <Typography variant="caption">Clear</Typography>
        </Button>

        {/* Refresh */}
        <Button
          variant="outlined"
          color="primary"
          onClick={onRefresh}
          disabled={!searchParams.locationName || isRefreshing}
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            py: 0.8,
            px: 1.5,
            minWidth: 65,
          }}
        >
          <RefreshIcon fontSize="small" />
          <Typography variant="caption">
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Typography>
        </Button>

        {/* Column Visibility Button */}
        {searchParams.locationName && (
          <IconButton
            ref={columnButtonRef}
            onClick={(e) => { setAnchorEl(e.currentTarget); }}
            sx={{
              textTransform: "none",
              fontSize: "0.9rem",
              color: open ? "primary.main" : "inherit",
              backgroundColor: open ? "action.selected" : "transparent",
              "&:hover": { backgroundColor: "action.hover" },
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <FilterListIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Column Visibility Menu */}
      <Menu
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        disableScrollLock
        PaperProps={{
          sx: {
            width: 200,
            maxHeight: 260,
            borderRadius: 2,
            p: 1,
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            mt: 1,
          },
        }}
      >
        {/* Menu Content (Keep existing) */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
          <Typography fontSize="0.8rem" fontWeight={600}>
            Show/Hide Columns
          </Typography>
          <IconButton size="small" onClick={() => setAnchorEl(null)}>
            <CloseIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Box>
        <Divider sx={{ mb: 0.5 }} />
        <Box sx={{ maxHeight: 200, overflowY: "auto" }}>
          {["Item Code", "Item Name", "Itemgroup", "Category", "Subcategory", "Opening Stock", "Receiving Stock", "Returned Stock", "Dispatch Stock", "WH-Return", "Calc System", "SystemStock", "PhysicalStock", "Variance", "Status"].map((column) => {
            const isChecked = !!visibleColumns[column];
            return (
              <Box
                key={column}
                onClick={() => onColumnVisibilityChange({ ...visibleColumns, [column]: !visibleColumns[column] })}
                sx={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  px: 0.8, py: 0.5, borderRadius: 1, cursor: "pointer",
                  "&:hover": { backgroundColor: "#f4f6f8" },
                }}
              >
                <Typography fontSize="0.75rem" fontWeight={isChecked ? 500 : 400} color={isChecked ? "text.primary" : "text.secondary"} noWrap>
                  {column}
                </Typography>
                <Checkbox size="small" checked={isChecked} sx={{ p: 0.3 }} />
              </Box>
            );
          })}
        </Box>
      </Menu>
    </Box>
  );
};

export default FilterBar;