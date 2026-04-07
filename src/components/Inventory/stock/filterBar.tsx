"use client";

import React, { useRef } from "react";
import {
  Typography,
  Box,
  IconButton,
  Button,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import ClearIcon from '@mui/icons-material/Clear';
import RefreshIcon from "@mui/icons-material/Refresh";

import {
  RawMaterialsState,
  downloadExportCSV,
  downloadSampleCSV,
  importRawMaterialStock,
  setEditMessage,
  setOpenSnackbar,
} from "@/features/yen_inventory/wharehoueSlice";
import CollapsibleFilter from "../physcialstockvarience/ui/collabsfiler";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/redux/store";
import { AxiosError } from "axios";
import { formatDateDDMMYYYY } from "@/components/Hooks/useTodayDate";

export interface FilterBarProps {
  searchParams: {
    page: number;
    limit: number;
    locationId: string;
    purchasecategoryName?: string[];
    purchasesubcategoryName?: string[];
    itemName?: string[];
    varianceName?: string[];
    createdDate?: string;
    categorySearch?: string;
    subCategorySearch?: string;
    itemNameSearch?: string;
    varianceNameSearch?: string;
    categoryPage: number;
    categoryLimit: number;
    subCategoryPage: number;
    subCategoryLimit: number;
    itemNamePage: number;
    itemNameLimit: number;
    varianceNamePage: number;
    varianceNameLimit: number;
    includeDropdowns?: boolean;
  };
  onClearAll: () => void;
  onSearchChange: (
    field: keyof RawMaterialsState["filters"],
    value: string | string[]
  ) => void;
  setOpenDownloadDialog: (open: boolean) => void;
  filterOptions: {
    itemNames: string[];
    varianceNames: string[];
    categories: string[];
    subcategories: string[];
    warehouses: { label: string; value: string; aliasName: string }[];
  };
  warehousesLoading?: boolean;
  onFilterScrollBottom: (
    field: "categories" | "subcategories" | "itemNames" | "varianceNames"
  ) => void;
  onFilterSearch: (
    field: "categories" | "subcategories" | "itemNames" | "varianceNames",
    searchTerm: string
  ) => void;
  displayLabel?: string;
  onImportSuccess?: () => void;
  onDownloadCSV?: () => void;
  onDownloadSampleCSV?: () => void;
  onImportCSV?: (file: File) => Promise<void>;
  todayDate: string | null;
  handleRefreshData: () => void;

}
const FilterBar: React.FC<FilterBarProps> = ({
  searchParams,
  onClearAll,
  onSearchChange,
  filterOptions,
  warehousesLoading,
  onFilterScrollBottom,
  onFilterSearch,
  onImportSuccess,
  onDownloadCSV,
  onDownloadSampleCSV,
  onImportCSV,
  todayDate,
  handleRefreshData,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadSampleCSV = () => {
    if (onDownloadSampleCSV) {
      onDownloadSampleCSV();
    } else {
      dispatch(downloadSampleCSV());
    }
  };

  const handleDownloadCSV = () => {
    if (onDownloadCSV) {
      onDownloadCSV();
    } else {
      if (!searchParams.locationId) {
        dispatch(setEditMessage("Please select a warehouse first."));
        dispatch(setOpenSnackbar(true));
        return;
      }
      dispatch(
        downloadExportCSV({
          locationId: searchParams.locationId,
          purchasecategoryName: searchParams.purchasecategoryName?.join(","),
          purchasesubcategoryName: searchParams.purchasesubcategoryName?.join(","),
          itemName: searchParams.itemName?.join(","),
          varianceName: searchParams.varianceName?.join(","),
        })
      );
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (onImportCSV) {
      try {
        await onImportCSV(file);
      } catch (error) {
        const err = error as Error;
        dispatch(setEditMessage(`Import failed: ${err.message}`));
        dispatch(setOpenSnackbar(true));
      }
    } else {
      if (!searchParams.locationId) {
        dispatch(setEditMessage("Please select a warehouse first."));
        dispatch(setOpenSnackbar(true));
        return;
      }
      try {
        await dispatch(importRawMaterialStock({ file, locationId: searchParams.locationId })).unwrap();
        dispatch(setEditMessage("CSV imported successfully"));
        dispatch(setOpenSnackbar(true));
        onImportSuccess?.();
      } catch (err) {
        const error = err as AxiosError;
        dispatch(setEditMessage(`Import failed: ${error?.message || "Unknown error"}`));
        dispatch(setOpenSnackbar(true));
      }
    }
    event.target.value = "";
  };
  const warehouseOptions = filterOptions.warehouses.map((w) => ({
    label: w.label,     // Only aliasName
    value: w.value,
    locationId: w.value,
  }));


  const isAnyFilterActive =
    (searchParams.purchasecategoryName?.length ?? 0) > 0 ||
    (searchParams.purchasesubcategoryName?.length ?? 0) > 0 ||
    (searchParams.itemName?.length ?? 0) > 0 ||
    (searchParams.varianceName?.length ?? 0) > 0;


  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 1,
        ml: 1,
        p: 1,
        position: "relative",
        zIndex: 1,
        "&:focus-within": { outline: "none" },
      }}
    >
      {/* <Typography
        variant="h6"
        sx={{
          fontWeight: "bold",
          fontSize: "0.9rem",
          color: "#333",
          flexShrink: 0,
        }}
      >
        Filters
      </Typography> */}

      {/* Each filter wrapped in a Box with flexShrink: 0 */}
      <Box sx={{ flexShrink: 0 }}>
        <CollapsibleFilter
          title="Date"
          options={[]}
          selectedOptions={todayDate ? formatDateDDMMYYYY(todayDate) : ""}
          onChange={(value) => {
            const singleValue = Array.isArray(value) ? value[0] || "" : value || "";
            onSearchChange("createdDate", singleValue);
          }}
          onClear={() => { }}
          onScrollBottom={() => { }}
          onSearch={() => { }}
          inputType="date"
          isMulti={false}
          showSelectedCount={false}
          showRemoveOption={false}
          restrictToTodayOnly={true}
          disabled={true}
        />
      </Box>

      <Box sx={{ flexShrink: 0 }}>
        <CollapsibleFilter
          title="Location"
          options={warehouseOptions}
          selectedOptions={searchParams.locationId ? [searchParams.locationId] : []}
          onChange={(value) => {
            const singleValue = Array.isArray(value) ? value[0] || "" : value || "";
            onSearchChange("locationId", singleValue);
          }}
          onClear={() => onSearchChange("locationId", "")}
          onScrollBottom={() => { }}
          onSearch={() => { }}
          inputType="single-select"
          isMulti={false}
          loading={warehousesLoading}
          showSelectedCount={false}
          showRemoveOption={false}
          displayLabel={
            filterOptions.warehouses.find(
              (w) => w.value === searchParams.locationId
            )?.aliasName
          }
        />
      </Box>

      <Box sx={{ flexShrink: 0 }}>
        <CollapsibleFilter
          title="Category"
          options={filterOptions.categories.map((name) => ({ label: name, value: name }))}
          selectedOptions={searchParams.purchasecategoryName || []}
          onChange={(value) => onSearchChange("purchasecategoryName", Array.isArray(value) ? value : [value])}
          onClear={() => onSearchChange("purchasecategoryName", [])}
          onScrollBottom={() => onFilterScrollBottom("categories")}
          onSearch={(term) => onFilterSearch("categories", term)}
          inputType="multi-select"
          isMulti={true}
        />
      </Box>

      <Box sx={{ flexShrink: 0 }}>
        <CollapsibleFilter
          title="Subcategory"
          options={filterOptions.subcategories.map((name) => ({ label: name, value: name }))}
          selectedOptions={searchParams.purchasesubcategoryName || []}
          onChange={(value) => onSearchChange("purchasesubcategoryName", Array.isArray(value) ? value : [value])}
          onClear={() => onSearchChange("purchasesubcategoryName", [])}
          onScrollBottom={() => onFilterScrollBottom("subcategories")}
          onSearch={(term) => onFilterSearch("subcategories", term)}
          inputType="multi-select"
          isMulti={true}
        />
      </Box>

      <Box sx={{ flexShrink: 0 }}>
        <CollapsibleFilter
          title="ItemGroup"
          options={filterOptions.itemNames.map((name) => ({ label: name, value: name }))}
          selectedOptions={searchParams.itemName || []}
          onChange={(value) => onSearchChange("itemName", Array.isArray(value) ? value : [value])}
          onClear={() => onSearchChange("itemName", [])}
          onScrollBottom={() => onFilterScrollBottom("itemNames")}
          onSearch={(term) => onFilterSearch("itemNames", term)}
          inputType="multi-select"
          isMulti={true}
        />
      </Box>

      <Box sx={{ flexShrink: 0 }}>
        <CollapsibleFilter
          title="Item Name"
          options={filterOptions.varianceNames.map((name) => ({ label: name, value: name }))}
          selectedOptions={searchParams.varianceName || []}
          onChange={(value) => onSearchChange("varianceName", Array.isArray(value) ? value : [value])}
          onClear={() => onSearchChange("varianceName", [])}
          onScrollBottom={() => onFilterScrollBottom("varianceNames")}
          onSearch={(term) => onFilterSearch("varianceNames", term)}
          inputType="multi-select"
          isMulti={true}
        />
      </Box>

      <Button
        variant="outlined"
        color="error"
        onClick={onClearAll}
        disabled={!isAnyFilterActive}
        sx={{ minWidth: 'auto', p: 0.6, flexShrink: 0 }}
      >
        <ClearIcon fontSize="small" />
      </Button>


      {/* Right-Aligned Buttons: Sample | Import | Export */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          ml: "auto",
          mr: 2,
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <IconButton
            color="primary"
            onClick={handleRefreshData}
            className="icon-button-outline"
            size="small"
            sx={{ p: 0.7 }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
          <Typography
            variant="caption"
            align="center"
            sx={{
              maxWidth: 50,
              wordBreak: "break-word",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textOverflow: "ellipsis",
              lineHeight: 1.1,
              mt: 0.2,
            }}
          >
            REFRESH
          </Typography>
        </Box>
        {/* Sample */}
        <Box
          sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}
        >

          <IconButton
            color="primary"
            onClick={handleDownloadSampleCSV}
            className="icon-button-outline"
            size="small"
            sx={{ p: 0.7 }}
          >
            <InsertDriveFileIcon fontSize="small" />
          </IconButton>
          <Typography
            variant="caption"
            align="center"
            sx={{
              maxWidth: 40,
              wordBreak: "break-word",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textOverflow: "ellipsis",
              lineHeight: 1.1,
              mt: 0.2,
            }}
          >
            SAMPLE
          </Typography>
        </Box>

        {/* Import */}
        <Box
          sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}
        >
          <IconButton
  color="primary"
  onClick={handleImportClick}
  disabled={!onImportCSV}  // ✅ add பண்ணுங்க
  className="icon-button-outline"
  size="small"
  sx={{ p: 0.7, opacity: !onImportCSV ? 0.4 : 1 }}  // ✅ grey out
>
            <UploadFileIcon fontSize="small" />
          </IconButton>
          <Typography
            variant="caption"
            align="center"
            sx={{
              maxWidth: 40,
              wordBreak: "break-word",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textOverflow: "ellipsis",
              lineHeight: 1.1,
              mt: 0.2,
            }}
          >
            IMPORT
          </Typography>
        </Box>

        {/* Export */}
        <Box
          sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}
        >
          <IconButton
            color="primary"
            onClick={handleDownloadCSV}
            className="icon-button-outline"
            size="small"
            sx={{ p: 0.7 }}
          >
            <FileDownloadIcon fontSize="small" />
          </IconButton>
          <Typography
            variant="caption"
            align="center"
            sx={{
              maxWidth: 40,
              wordBreak: "break-word",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textOverflow: "ellipsis",
              lineHeight: 1.1,
              mt: 0.2,
            }}
          >
            EXPORT
          </Typography>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

        </Box>
      </Box>
    </Box>
  );
};

export default FilterBar;
