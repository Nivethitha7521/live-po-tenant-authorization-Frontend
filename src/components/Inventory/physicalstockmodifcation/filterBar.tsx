"use client";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Box, Button, Typography, IconButton } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import ClearIcon from "@mui/icons-material/Clear";
import RefreshIcon from "@mui/icons-material/Refresh";

import { AppDispatch } from "@/redux/store";
import {
  selectFilterOptions,
  clearFilterSearch,
  setFilterSearch,
  fetchItems,
  Branch,
} from "../../../features/yen_inventory/OuletePhysicalStockSlice";
import CollapsibleFilter from "../physcialstockvarience/ui/collabsfiler";
import { debounce, DebouncedFunc } from "lodash";
import { formatDateDDMMYYYY } from "@/components/Hooks/useTodayDate";

interface SearchParams {
  itemName: string[];
  varianceName: string[];
  category: string[];
  subCategory: string[];
}

interface FilterBarProps {
  searchParams: SearchParams;
  onSearchChange: (field: keyof SearchParams, value: string[] | string) => void;
  branches: Branch[];
  selectedBranches: string;
  onBranchChange: (value: string | string[]) => void;
  setOpenDownloadDialog?: (open: boolean) => void;
  handleDownloadCSV: () => void;
  onToggleColumn?: (column: string) => void;
  onImportFile?: (file: File) => void;
  handleDownloadSampleCSV: () => void;
  skipNextSearch?: () => void;
  todayDate: string | null;
  skipNextSearchRef: React.MutableRefObject<boolean>;
  onRefresh?: () => void;
}

type FilterField = keyof Omit<SearchParams, "queryDate">;

const FilterBar: React.FC<FilterBarProps> = ({
  searchParams,
  onSearchChange,
  branches,
  selectedBranches,
  onBranchChange,
  handleDownloadCSV,
  onImportFile,
  handleDownloadSampleCSV,
  skipNextSearch,
  todayDate,
  skipNextSearchRef,
  onRefresh,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const filterOptions = useSelector(selectFilterOptions);
  const isFetchingRef = useRef(false);



  // Guard to initialize debounce only once
  const isInitializedRef = useRef(false);

  const debouncedSearchRef = useRef<
    Record<FilterField, DebouncedFunc<(searchTerm: string) => void> | null>
  >({
    category: null,
    subCategory: null,
    itemName: null,
    varianceName: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filterFields: FilterField[] = [
    "category",
    "subCategory",
    "itemName",
    "varianceName",
  ];

  /* ---------------------- Initialize Debounced Search ---------------------- */
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    filterFields.forEach((field) => {
      debouncedSearchRef.current[field] = debounce(
        async (searchTerm: string) => {
          if (!searchTerm?.trim()) {
            dispatch(clearFilterSearch(field));

            await dispatch(
              fetchItems({
                params: {
                  [`${field}Page`]: 1,
                  [`${field}Limit`]: 50,
                  [`${field}Search`]: "",
                  include_filter_options: true,
                },
                field,
                append: false,
                skipCache: true,
              })
            );
            return;
          }

          dispatch(setFilterSearch({ field, searchFilter: searchTerm }));

          await dispatch(
            fetchItems({
              params: {
                [`${field}Page`]: 1,
                [`${field}Limit`]: 50,
                [`${field}Search`]: searchTerm,
                include_filter_options: true,
              },
              field,
              append: false,
              skipCache: true,
            })
          );
        },
        300 // 1 second debounce
      );
    });

    return () => {
      filterFields.forEach((field) => {
        debouncedSearchRef.current[field]?.cancel();
      });
    };
  }, [dispatch, filterFields]);


  /* ------------------------ Scroll Handler ------------------------ */
  const createScrollHandler = useCallback(
    (field: FilterField) => async () => {
      const fieldOptions = filterOptions[field];
      if (!fieldOptions?.hasMore || isFetchingRef.current || fieldOptions.loading) return;

      isFetchingRef.current = true;
      try {
        const nextPage = (fieldOptions.page || 1) + 1;
        const searchTerm = fieldOptions.searchFilter || "";

        await dispatch(
          fetchItems({
            params: {
              [`${field}Page`]: nextPage,
              [`${field}Limit`]: 50,
              [`${field}Search`]: searchTerm,
              include_filter_options: true,
            },
            field,
            append: true,
            skipCache: true,
          })
        ).unwrap();
      } catch (err) {
        console.error(`Failed to load more ${field}:`, err);
      } finally {
        isFetchingRef.current = false;
      }
    },
    [dispatch, filterOptions]
  );

  /* ------------------------ Search Handler ------------------------ */
  const createSearchHandler = useCallback(
    (field: FilterField) => (searchTerm: string) => {
      debouncedSearchRef.current[field]?.(searchTerm);
    },
    []
  );

  /* ------------------------ Clear Single Filter ------------------------ */
  const handleClearFilter = useCallback(
    (field: FilterField) => {
      debouncedSearchRef.current[field]?.cancel();
      dispatch(clearFilterSearch(field));
      onSearchChange(field, []);
    },
    [dispatch, onSearchChange]
  );

  /* ------------------------ Global Clear Filters ------------------------ */
  const isAnyFilterActive = useMemo(
    () => filterFields.some((field) => searchParams[field].length > 0),
    [filterFields, searchParams]
  );

  const handleGlobalClearFilters = useCallback(() => {
    // Cancel all debounced searches
    filterFields.forEach((field) => {
      debouncedSearchRef.current[field]?.cancel();
    });

    // Clear redux filter search
    filterFields.forEach((field) => {
      dispatch(clearFilterSearch(field));
    });

    // Clear selected filters in parent
    filterFields.forEach((field) => {
      onSearchChange(field, []);
    });

    // DO NOT set skipNextSearchRef here 
  }, [dispatch, filterFields, onSearchChange]);



  /* ------------------------ File Upload ------------------------ */
  const handleImportClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImportFile?.(file);
    e.target.value = "";
  };

  /* ------------------------ Branch Options ------------------------ */
  const branchOptions = useMemo(
    () =>
      branches.map((branch) => ({
        label: `${branch.locationName} (${branch.locationId || "N/A"})`,
        value: branch.locationId,
        locationName: branch.locationName,
      })),
    [branches]
  );

  const selectedBranch = useMemo(
    () => branches.find((b) => b.locationId === selectedBranches),
    [branches, selectedBranches]
  );

  /* --------------------------- Render --------------------------- */
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
      {/* <Typography variant="h6" sx={{ fontWeight: "bold", fontSize: "1rem", color: "#333" }}>
        Filters
      </Typography> */}

      {/* Date */}
      <CollapsibleFilter
        title="Date"
        selectedOptions={todayDate ? formatDateDDMMYYYY(todayDate) : ""}
        inputType="date"
        isMulti={false}
        showSelectedCount={false}
        restrictToTodayOnly
        disabled
        onChange={() => { }}
        onClear={() => { }}
      />

      {/* Branch / Location */}
      <CollapsibleFilter
        title="Location"
        options={branchOptions}
        selectedOptions={selectedBranches}
        onChange={onBranchChange}
        onClear={() => onBranchChange("")}
        inputType="single-select"
        isMulti={false}
        showSelectedCount={false}
        showRemoveOption={false}
        displayLabel={selectedBranch ? selectedBranch.aliasName : ""}
      />

      {/* Dynamic Filters */}
      {filterFields.map((field) => {
        const fieldOptions = filterOptions[field];
        const options =
          fieldOptions?.values?.map((val) => ({
            label: val.name ?? "",
            value: val.id,
          })) || [];

        return (
          <CollapsibleFilter
            key={field}
            title={field.charAt(0).toUpperCase() + field.slice(1)}
            options={options}
            selectedOptions={searchParams[field]}
            onChange={(value) => onSearchChange(field, value as string[])}
            onClear={() => handleClearFilter(field)}
            onScrollBottom={createScrollHandler(field)}
            onSearch={createSearchHandler(field)}
            inputType="multi-select"
            isMulti
            loading={fieldOptions?.loading || false}
            searchValue={fieldOptions?.searchFilter || ""}
          />
        );
      })}

      {/* Global Clear */}
      <Button
        variant="outlined"
        color="error"
        onClick={handleGlobalClearFilters}
        disabled={!isAnyFilterActive}
        sx={{ minWidth: "auto", padding: 1 }}
      >
        <ClearIcon />
      </Button>

      {/* Right Buttons */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, ml: "auto", mr: 2 }}>
        {/* Refresh */}
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <IconButton
            color="primary"
            onClick={onRefresh}
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
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
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
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
         <IconButton
  color="primary"
  onClick={handleImportClick}
  disabled={!onImportFile}  // ✅ add பண்ணுங்க
  className="icon-button-outline"
  size="small"
  sx={{ p: 0.7, opacity: !onImportFile ? 0.4 : 1 }}  // ✅ grey out
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
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
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
        </Box>
      </Box>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv"
        style={{ display: "none" }}
      />
    </Box>
  );
};

export default React.memo(FilterBar);
