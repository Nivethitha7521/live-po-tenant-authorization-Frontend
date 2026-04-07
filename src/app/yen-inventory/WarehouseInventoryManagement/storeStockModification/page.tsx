"use client";
import React, { useEffect, useCallback, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogTitle,
  DialogContent,
  TextField,
  Typography,
  IconButton,
  Divider,
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchPurchaseItems,
  fetchWarehouses,
  approveItem,
  fetchApprovedItems,
  resetApprovedItems,
  resetPurchaseItems,
  clearError,
  RawMaterialStore,
  setSearchParams,
  setCategoryNameSearchTerm,
  setSubcategoryNameSearchTerm,
  setItemNameSearchTerm,
  setVarianceNameSearchTerm,
  setIsLoadingMore,
  setIsFullScreen,
  setOpenSnackbar,
  setSnackbarMessage,
  setOpenAdjustmentDialog,
  setOpenApproveDialog,
  setOpenDownloadDialog,
  setSelectedItem,
  setAdjustedPhysicalStock,
  setAdjustmentReason,
  setSelectedApproveItem,
  setApproveDescription,
  setVisibleColumns,
  FetchPurchaseItemsParams,
} from "../../../../features/yen_inventory/wharehoueStoreSlice";
import FilterBar from "../../../../components/Inventory/storestockvarience/filterBar";
import DataTable from "../../../../components/Inventory/storestockvarience/dataTable";
import FeedbackSnackbar from "../../../../components/Inventory/physcialstockvarience/feedbackSnakbar";
import { AppDispatch, RootState } from "@/redux/store";
import { usePermissions } from "@/hooks/usePermissions";
import { throttle, debounce } from "lodash";
import axios from "axios";
import WarehouseInventoryManagementPage from "../page";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import ApprovedStockTable from "../../../../components/Inventory/storestockvarience/ui/approvedStocktable";
import { useTodayDate } from "@/components/Hooks/useTodayDate";
import { API_BASE_URL } from "@/features/yen_inventory/OuletePhysicalStockSlice";

export interface SearchParams {
  itemName: string[];
  category: string[];
  subcategory: string[];
  varianceName: string[];
  locationName: string;
  createdDate?: string;
}

const WarehouseRawMaterialsStockModification: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { hasPermission, isModuleVisible } = usePermissions();

const canRead = hasPermission("yenerp","warehousephysicalstockvariancemodification","read");
const canApprove = hasPermission("yenerp","warehousephysicalstockvariancemodification","approve");
  const {
    rawmaterialItems,
    totalItems,
    status,
    error,
    categoryNameOptions,
    subcategoryNameOptions,
    itemNameOptions,
    varianceNameOptions,
    categoryNameTotal,
    subcategoryNameTotal,
    itemNameTotal,
    varianceNameTotal,
    categoryNamePage,
    subcategoryNamePage,
    itemNamePage,
    varianceNamePage,
    warehouses,
    warehouseError,
    approvedItems,
    approvedItemsTotal,
    approvedItemsStatus,
    approvedItemsError,
    hasMore,
    searchParams,
    categoryNameSearchTerm,
    subcategoryNameSearchTerm,
    itemNameSearchTerm,
    varianceNameSearchTerm,
    isLoadingMore,
    isFullScreen,
    openSnackbar,
    snackbarMessage,
    openAdjustmentDialog,
    openApproveDialog,
    openDownloadDialog,
    selectedItem,
    adjustedPhysicalStock,
    adjustmentReason,
    selectedApproveItem,
    approveDescription,
    visibleColumns,
  } = useSelector((state: RootState) => state.rawMaterialStore);

  const ITEMS_PER_PAGE = 30;
  const DROPDOWN_LIMIT = 50;
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const approvedTableContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const previousFiltersRef = useRef<SearchParams>(searchParams);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const todayDate = useTodayDate();
  const [tableView, setTableView] = useState<"stock" | "approved">("stock");

  const currentPage = Math.ceil(rawmaterialItems.length / ITEMS_PER_PAGE);
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  const [isApproving, setIsApproving] = useState(false);

  const startItem =
    rawmaterialItems.length === 0
      ? 0
      : (currentPage - 1) * ITEMS_PER_PAGE + 1;

  const endItem = Math.min(
    rawmaterialItems.length,
    totalItems
  );


  const staticColumns = useMemo(
    () => ["S.No", "Item Code", "Item Name", "Category", "Subcategory", "Location Name"],
    []
  );

  const fieldTypes = useMemo(
    () => [
      "Opening Stock",
      "Receiving Stock",
      "Returned Stock",
      "Dispatch Stock",
      "WH-Return",
      "Calc System",
      "SystemStock",
      "PhysicalStock",

      "Variance",
      "Status",
      "Action",
    ],
    []
  );

  useEffect(() => {
    dispatch(fetchWarehouses()).catch(() => {
      dispatch(setSnackbarMessage("Error fetching warehouses."));
      dispatch(setOpenSnackbar(true));
    });
  }, [dispatch]);

  useEffect(() => {
    if (tableView === "approved" && searchParams.locationName && approvedItemsStatus === "idle") {
      dispatch(
        fetchApprovedItems({
          page: 1,
          limit: ITEMS_PER_PAGE,
          locationName: searchParams.locationName,
          date: todayDate,
        })
      ).catch(() => {
        dispatch(setSnackbarMessage("Error fetching approved items."));
        dispatch(setOpenSnackbar(true));
      });
    }
  }, [dispatch, tableView, searchParams.locationName, approvedItemsStatus, todayDate]);

  const debouncedFilterChange = useMemo(
    () =>
      debounce((filters: SearchParams) => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        dispatch(resetPurchaseItems());

        dispatch(
          fetchPurchaseItems({
            skip: 0,
            limit: ITEMS_PER_PAGE,
            locationName: filters.locationName,
            itemName: filters.itemName.length > 0 ? filters.itemName : undefined,
            category: filters.category.length > 0 ? filters.category : undefined,
            subcategory: filters.subcategory.length > 0 ? filters.subcategory : undefined,
            varianceName: filters.varianceName.length > 0 ? filters.varianceName : undefined,
            createdDate: todayDate,
            fetchDropdowns: true,
          })
        )
          .unwrap()
          .catch((error) => {
            if (error.name !== "AbortError") {
              dispatch(setSnackbarMessage("Error fetching items."));
              dispatch(setOpenSnackbar(true));
            }
          });
      }, 500),
    [dispatch, ITEMS_PER_PAGE, todayDate]
  );



  useEffect(() => {
    if (!searchParams.locationName || tableView === "approved") return;

    const prev = previousFiltersRef.current;

    const locationChanged = prev.locationName !== searchParams.locationName;
    const dateChanged = prev.createdDate !== searchParams.createdDate;
    const selectionsChanged =
      JSON.stringify(prev.itemName) !== JSON.stringify(searchParams.itemName) ||
      JSON.stringify(prev.category) !== JSON.stringify(searchParams.category) ||
      JSON.stringify(prev.subcategory) !== JSON.stringify(searchParams.subcategory) ||
      JSON.stringify(prev.varianceName) !== JSON.stringify(searchParams.varianceName);

    const hasChanged = locationChanged || dateChanged || selectionsChanged;

    if (hasChanged) {
      previousFiltersRef.current = searchParams;

      debouncedFilterChange(searchParams);
    }

    return () => {
      debouncedFilterChange.cancel();
    };
  }, [searchParams, debouncedFilterChange, tableView]);

  useEffect(() => {
    if (error || warehouseError || approvedItemsError) {
      dispatch(setSnackbarMessage(`Error: ${error || warehouseError || approvedItemsError}`));
      dispatch(setOpenSnackbar(true));
      dispatch(clearError());
    }
  }, [error, warehouseError, approvedItemsError, dispatch]);

  const loadMoreData = useCallback(() => {
    if (isLoadingMore || status === "loading" || !hasMore || !searchParams.locationName) {
      return;
    }

    const nextSkip = rawmaterialItems.length;
    dispatch(setIsLoadingMore(true));

    dispatch(
      fetchPurchaseItems({
        skip: nextSkip,
        limit: ITEMS_PER_PAGE,
        locationName: searchParams.locationName,
        itemName: searchParams.itemName.length > 0 ? searchParams.itemName : undefined,
        category: searchParams.category.length > 0 ? searchParams.category : undefined,
        subcategory: searchParams.subcategory.length > 0 ? searchParams.subcategory : undefined,
        varianceName: searchParams.varianceName.length > 0 ? searchParams.varianceName : undefined,
        createdDate: todayDate,
        fetchDropdowns: false,
      })
    )
      .unwrap()
      .catch(() => {
        dispatch(setSnackbarMessage("Error loading more items."));
        dispatch(setOpenSnackbar(true));
      })
      .finally(() => {
        dispatch(setIsLoadingMore(false));
      });
  }, [
    dispatch,
    isLoadingMore,
    status,
    hasMore,
    rawmaterialItems.length,
    searchParams,
    ITEMS_PER_PAGE,
  ]);



  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      const { scrollTop, scrollHeight, clientHeight } = target;

      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      if (
        distanceFromBottom <= 10 &&
        !isLoadingMore &&
        status !== "loading" &&
        hasMore &&
        searchParams.locationName
      ) {
        loadMoreData();
      }
    },
    [isLoadingMore, status, hasMore, searchParams.locationName, loadMoreData]
  );


  const handleSearchChange = useCallback(
    (field: string, value: string[] | string) => {
      const currentValue = searchParams[field as keyof SearchParams];
      const newValue = value;
      if (JSON.stringify(currentValue) !== JSON.stringify(newValue)) {
        dispatch(setSearchParams({
          ...searchParams,
          [field]: value,
          ...(field === "locationName" ? { createdDate: todayDate } : {}),
        }));
      }
    },
    [dispatch, searchParams, todayDate]
  );


  const getSearchTerm = useCallback(
    (field: string) => {
      if (field === "category") return categoryNameSearchTerm;
      if (field === "subcategory") return subcategoryNameSearchTerm;
      if (field === "itemName") return itemNameSearchTerm;
      if (field === "varianceName") return varianceNameSearchTerm;
      return "";
    },
    [categoryNameSearchTerm, subcategoryNameSearchTerm, itemNameSearchTerm, varianceNameSearchTerm]
  );

  const getCurrentPage = useCallback(
    (field: string) => {
      if (field === "category") return categoryNamePage;
      if (field === "subcategory") return subcategoryNamePage;
      if (field === "itemName") return itemNamePage;
      if (field === "varianceName") return varianceNamePage;
      return 1;
    },
    [categoryNamePage, subcategoryNamePage, itemNamePage, varianceNamePage]
  );

  const addOtherFilters = useCallback((params: FetchPurchaseItemsParams, currentField: string) => {
    if (searchParams.category.length > 0 && currentField !== "category") {
      params.category = searchParams.category;
    }
    if (searchParams.subcategory.length > 0 && currentField !== "subcategory") {
      params.subcategory = searchParams.subcategory;
    }
    if (searchParams.itemName.length > 0 && currentField !== "itemName") {
      params.itemName = searchParams.itemName;
    }
    if (searchParams.varianceName.length > 0 && currentField !== "varianceName") {
      params.varianceName = searchParams.varianceName;
    }
  }, [searchParams]);

  const setAllDropdownParams = useCallback((params: FetchPurchaseItemsParams, targetField: string, targetPage: number, targetSearch: string | undefined) => {
    const dropdownFields = ["category", "subcategory", "itemName", "varianceName"] as const;
    dropdownFields.forEach((ddField) => {
      const search = ddField === targetField ? targetSearch : getSearchTerm(ddField);
      const page = ddField === targetField ? targetPage : getCurrentPage(ddField);
      params[`${ddField}Search`] = search || undefined;
      params[`${ddField}Page`] = page;
      params[`${ddField}Limit`] = DROPDOWN_LIMIT;
    });
  }, [getSearchTerm, getCurrentPage, DROPDOWN_LIMIT]);

  const handleFilterSearch = useMemo(
    () =>
      debounce((field: string, searchTerm: string) => {
        if (field === "locationName") return;

        if (field === "category") dispatch(setCategoryNameSearchTerm(searchTerm));
        if (field === "subcategory") dispatch(setSubcategoryNameSearchTerm(searchTerm));
        if (field === "itemName") dispatch(setItemNameSearchTerm(searchTerm));
        if (field === "varianceName") dispatch(setVarianceNameSearchTerm(searchTerm));

        if (searchTerm.length > 0 && searchTerm.length < 2) return;

        const dropdownParams: FetchPurchaseItemsParams = {
          skip: 0,
          limit: 0,
          fetchDropdowns: true,
          locationName: searchParams.locationName,
          createdDate: todayDate,
        };

        setAllDropdownParams(dropdownParams, field, 1, searchTerm);
        addOtherFilters(dropdownParams, field);

        dispatch(fetchPurchaseItems(dropdownParams));
      }, 150),
    [
      dispatch,
      searchParams.locationName,
      searchParams.createdDate,
      setAllDropdownParams,
      addOtherFilters,
    ]
  );


  const handleFilterScrollBottom = useMemo(
    () =>
      throttle(
        (field: "category" | "subcategory" | "itemName" | "varianceName" | "locationName") => {
          if (field === "locationName") return;

          const total =
            field === "category"
              ? categoryNameTotal
              : field === "subcategory"
                ? subcategoryNameTotal
                : field === "itemName"
                  ? itemNameTotal
                  : varianceNameTotal;

          const currentPage =
            field === "category"
              ? categoryNamePage
              : field === "subcategory"
                ? subcategoryNamePage
                : field === "itemName"
                  ? itemNamePage
                  : varianceNamePage;

          const loadedCount = currentPage * DROPDOWN_LIMIT;
          if (loadedCount >= total) return;

          const dropdownParams: FetchPurchaseItemsParams = {
            skip: 0,
            limit: 0,
            fetchDropdowns: true,
            locationName: searchParams.locationName,
            createdDate: todayDate,
          };

          const targetSearch = getSearchTerm(field) || undefined;

          setAllDropdownParams(dropdownParams, field, currentPage + 1, targetSearch);
          addOtherFilters(dropdownParams, field);

          dispatch(fetchPurchaseItems(dropdownParams));
        },
        200
      ),
    [
      dispatch,
      categoryNameTotal,
      subcategoryNameTotal,
      itemNameTotal,
      varianceNameTotal,
      categoryNamePage,
      subcategoryNamePage,
      itemNamePage,
      varianceNamePage,
      searchParams.locationName,
      searchParams.createdDate,
      getSearchTerm,
      DROPDOWN_LIMIT,
      setAllDropdownParams,
      addOtherFilters,
    ]
  );




  const handleDownloadCSV = useCallback(async () => {
    if (!searchParams.locationName) {
      dispatch(setSnackbarMessage("Please select a Warehouse to download CSV."));
      dispatch(setOpenSnackbar(true));
      return;
    }
    try {
      const response = await axios.get(`${API_BASE_URL}/warehouseinventoryvariance/export/csv`, {
        params: {
          locationName: searchParams.locationName,
          itemName: searchParams.itemName,
          category: searchParams.category,
          subcategory: searchParams.subcategory,
          createdDate: todayDate,
        },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `items_${searchParams.locationName}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      dispatch(setSnackbarMessage("CSV downloaded successfully."));
      dispatch(setOpenSnackbar(true));
    } catch {
      dispatch(setSnackbarMessage("Error downloading CSV."));
      dispatch(setOpenSnackbar(true));
    } finally {
      dispatch(setOpenDownloadDialog(false));
    }
  }, [dispatch, searchParams]);

  const handleAdjustmentDialogClose = useCallback(
    async (confirm: boolean) => {
      if (confirm && selectedItem) {
        try {
          dispatch(setSnackbarMessage(`Stock adjusted for ${selectedItem.itemName}`));
          dispatch(setOpenSnackbar(true));
        } catch {
          dispatch(setSnackbarMessage("Error adjusting stock."));
          dispatch(setOpenSnackbar(true));
        }
      }
      dispatch(setOpenAdjustmentDialog(false));
      dispatch(setSelectedItem(null));
      dispatch(setAdjustedPhysicalStock(""));
      dispatch(setAdjustmentReason(""));
    },
    [dispatch, selectedItem]
  );


  const handleApproveConfirm = useCallback(async () => {
    if (!selectedApproveItem) return;

    setIsApproving(true);

    try {
      await dispatch(
        approveItem({
          item_id: selectedApproveItem.randomId,
          locationId: selectedApproveItem.locationId,
          approved_by: "",
          description: approveDescription,
        })
      ).unwrap();
      setIsApproving(false);

      await dispatch(
        fetchPurchaseItems({
          skip: 0,
          limit: ITEMS_PER_PAGE,
          locationName: searchParams.locationName,
          itemName: searchParams.itemName.length ? searchParams.itemName : undefined,
          category: searchParams.category.length ? searchParams.category : undefined,
          subcategory: searchParams.subcategory.length ? searchParams.subcategory : undefined,
          varianceName: searchParams.varianceName.length ? searchParams.varianceName : undefined,
          createdDate: todayDate,
          fetchDropdowns: true,
        })
      ).unwrap();

      dispatch(setSnackbarMessage("Approved successfully."));
      dispatch(setOpenSnackbar(true));
    } catch (err) {
      console.error("Approve failed", err);

      setIsApproving(false);
      dispatch(setSnackbarMessage("Error approving item."));
      dispatch(setOpenSnackbar(true));
    } finally {
      setIsApproving(false);
      dispatch(setOpenApproveDialog(false));
      dispatch(setSelectedApproveItem(null));
      dispatch(setApproveDescription(""));
    }
  }, [dispatch, selectedApproveItem, approveDescription, searchParams, ITEMS_PER_PAGE, todayDate]);




  const formattedFilterOptions = useMemo(
    () => ({
      category: (categoryNameOptions || []).map((opt) => opt.value),
      subcategory: (subcategoryNameOptions || []).map((opt) => opt.value),
      itemName: (itemNameOptions || []).map((opt) => opt.value),
      varianceName: (varianceNameOptions || []).map((opt) => opt.value),
      warehouses: (warehouses || []).map((w) => ({ name: w.locationName, aliasName: w.aliasName, locationId: w.locationId })),
    }),
    [categoryNameOptions, subcategoryNameOptions, itemNameOptions, varianceNameOptions, warehouses]
  );

  const toggleTableView = useCallback(() => {
    setTableView((prev) => {
      const newView = prev === "stock" ? "approved" : "stock";
      if (newView === "approved") {
        dispatch(resetPurchaseItems());
        if (searchParams.locationName) {
          dispatch(
            fetchApprovedItems({
              page: 1,
              limit: ITEMS_PER_PAGE,
              locationName: searchParams.locationName,
              date: searchParams.createdDate || undefined,
            })
          ).catch(() => {
            dispatch(setSnackbarMessage("Error fetching approved items."));
            dispatch(setOpenSnackbar(true));
          });
        }
      } else if (newView === "stock" && searchParams.locationName) {
        dispatch(resetApprovedItems());
        dispatch(
          fetchPurchaseItems({
            skip: 0,
            limit: ITEMS_PER_PAGE,
            locationName: searchParams.locationName,
            itemName:
              searchParams.itemName.length > 0 ? searchParams.itemName : undefined,
            category:
              searchParams.category.length > 0 ? searchParams.category : undefined,
            subcategory:
              searchParams.subcategory.length > 0
                ? searchParams.subcategory
                : undefined,
            varianceName:
              searchParams.varianceName.length > 0
                ? searchParams.varianceName
                : undefined,
            createdDate: todayDate,
            fetchDropdowns: true,
          })
        )
          .unwrap()
          .catch((error) => {
            if (error.name !== "AbortError") {
              dispatch(setSnackbarMessage("Error re-fetching stock items."));
              dispatch(setOpenSnackbar(true));
            }
          });
      }
      return newView;
    });
  }, [dispatch, searchParams, ITEMS_PER_PAGE]);

  const handleRefreshData = useCallback(() => {
    if (!searchParams.locationName) return;

    setIsRefreshing(true);

    // We dispatch fetchPurchaseItems with the CURRENT searchParams
    // We use skip: 0 to reload from the beginning
    dispatch(
      fetchPurchaseItems({
        skip: 0,
        limit: ITEMS_PER_PAGE,
        locationName: searchParams.locationName,
        itemName: searchParams.itemName.length > 0 ? searchParams.itemName : undefined,
        category: searchParams.category.length > 0 ? searchParams.category : undefined,
        subcategory: searchParams.subcategory.length > 0 ? searchParams.subcategory : undefined,
        varianceName: searchParams.varianceName.length > 0 ? searchParams.varianceName : undefined,
        createdDate: searchParams.createdDate || todayDate,
        fetchDropdowns: true, // Optional: set to false if you don't need to refresh dropdown options
      })
    )
      .unwrap()
      .then(() => {
        dispatch(setSnackbarMessage("Data refreshed"));
        dispatch(setOpenSnackbar(true));
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          dispatch(setSnackbarMessage("Error refreshing data."));
          dispatch(setOpenSnackbar(true));
        }
      })
      .finally(() => {
        setIsRefreshing(false);
      });
  }, [dispatch, searchParams, todayDate, ITEMS_PER_PAGE]);



  // In your WarehouseRawMaterialsStockModification component, update the handler:
  const handleClearFilters = useCallback(() => {
    // Clear only these filter fields, keep locationName and createdDate
    dispatch(setSearchParams({
      ...searchParams, // Keep existing locationName and createdDate
      category: [],
      subcategory: [],
      itemName: [],
      varianceName: [],
    }));

    // Clear search terms for these dropdowns
    dispatch(setCategoryNameSearchTerm(""));
    dispatch(setSubcategoryNameSearchTerm(""));
    dispatch(setItemNameSearchTerm(""));
    dispatch(setVarianceNameSearchTerm(""));

    // Reset items to trigger a new search with only location and date
    dispatch(resetPurchaseItems());

    // If location is selected, fetch fresh data with only location and date
    if (searchParams.locationName) {
      dispatch(
        fetchPurchaseItems({
          skip: 0,
          limit: ITEMS_PER_PAGE,
          locationName: searchParams.locationName,
          createdDate: todayDate,
          fetchDropdowns: true,
        })
      ).catch((error) => {
        if (error.name !== "AbortError") {
          dispatch(setSnackbarMessage("Error fetching items after clearing filters."));
          dispatch(setOpenSnackbar(true));
        }
      });
    }
  }, [dispatch, searchParams, ITEMS_PER_PAGE]);

if (!isModuleVisible("yenerp","warehousephysicalstockvariancemodification")) {
  return (
    <Box p={3}>
      <Typography color="error">
        You do not have access to Physical Stock Variance Modification module
      </Typography>
    </Box>
  );
}
if (!canRead) {
  return (
    <Box p={3}>
      <Typography color="error">
        You do not have permission to view this page
      </Typography>
    </Box>
  );
}
  return (
    <Box
      sx={{
        width: "100%",
        backgroundColor: "#ffffff",
        display: "flex",
        flexDirection: "column",
        height: isFullScreen ? "100vh" : "calc(110vh - 120px)",
        position: isFullScreen ? "fixed" : "relative",
        top: isFullScreen ? 0 : "auto",
        left: isFullScreen ? 0 : "auto",
        zIndex: isFullScreen ? 1200 : "auto",
        overflow: isFullScreen ? "hidden" : "auto",
      }}
    >
      {!isFullScreen && <WarehouseInventoryManagementPage />}

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid #e0e0e0",
          flexShrink: 0,
        }}
      >
        {tableView === "stock" ? (
          <FilterBar

            searchParams={searchParams}
            onSearchChange={handleSearchChange}
            setOpenDownloadDialog={() => dispatch(setOpenDownloadDialog(true))}
            filterOptions={formattedFilterOptions}
            visibleColumns={visibleColumns}
            onColumnVisibilityChange={(columns) => dispatch(setVisibleColumns(columns))}
            onFilterSearch={handleFilterSearch}
            onFilterScrollBottom={handleFilterScrollBottom}
            getWarehouseName={(id: string) => {
              const warehouse = warehouses.find((w) => w.aliasName === id || w.locationName === id);
              return warehouse?.locationName || id;
            }}
            isFullScreen={isFullScreen}
            onToggleFullScreen={() => dispatch(setIsFullScreen(!isFullScreen))}
            onClearAllFilters={handleClearFilters} // Update this to use the new handler
            onRefresh={handleRefreshData} // 2. Pass the handler
            isRefreshing={isRefreshing}    // 3. Pass loading state
          />
        ) : (
          <Box sx={{ flex: 1 }} />
        )}
        <Button
          variant="contained"
          onClick={toggleTableView}
          sx={{ flexShrink: 0, whiteSpace: "nowrap", minWidth: "auto" }}
        >
          {tableView === "stock" ? " Approved Items" : " Stock Data"}
        </Button>
        <IconButton
          onClick={() => dispatch(setIsFullScreen(!isFullScreen))}
          sx={{ flexShrink: 0, color: "primary.main" }}
        >
          {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
        </IconButton>
      </Box>

      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {searchParams.locationName ? (
          <>
            {tableView === "stock" && (
              <>
                <Box ref={tableContainerRef}>
                  <DataTable
                    filteredItems={rawmaterialItems}
                    canApprove={canApprove}
                    visibleColumns={visibleColumns}
                    staticColumns={staticColumns}
                    fieldTypes={fieldTypes}
                    totalColspan={Object.keys(visibleColumns).filter((key) => visibleColumns[key]).length}
                    hasMoreData={hasMore}
                    isLoadingMore={isLoadingMore}
                    isFullScreen={isFullScreen}
                    handleTableScroll={handleScroll}
                    handleApproveClick={(item: RawMaterialStore) => {
                      dispatch(setSelectedApproveItem({
                        ...item,
                        locationId: searchParams.locationName, // IMPORTANT
                      }));
                      dispatch(setOpenApproveDialog(true));
                    }}
                    scrollContainerRef={tableContainerRef}
                  />
                </Box>
                <Box
                  sx={{
                    position: "sticky",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: "white",
                    p: 1,
                    textAlign: "right",
                    borderTop: "1px solid #e0e0e0",
                    zIndex: 10,
                    flexShrink: 0,
                  }}
                >
                  <Typography variant="body2" color="textSecondary">
                    Showing {startItem}–{endItem} of {totalItems} items
                    {" "}(
                    Page {currentPage} of {totalPages}
                    )
                  </Typography>

                </Box>
              </>
            )}
            {tableView === "approved" && (
              <>
                <ApprovedStockTable
                  isFullScreen={isFullScreen}
                  scrollContainerRef={approvedTableContainerRef}
                />
                <Box
                  sx={{
                    position: "sticky",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: "white",
                    p: 1,
                    textAlign: "right",
                    borderTop: "1px solid #e0e0e0",
                    zIndex: 10,
                    flexShrink: 0,
                  }}
                >
                  <Typography variant="body2" color="textSecondary">
                    Approved Items: {approvedItems.length} / {approvedItemsTotal}
                    {approvedItems.length < approvedItemsTotal && " (Scroll for more)"}
                  </Typography>
                </Box>
              </>
            )}
          </>
        ) : (
          <Box
            sx={{
              p: 4,
              textAlign: "center",
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography
              variant="h4"           // bigger font size
              color="textPrimary"     // darker color for visibility
              fontWeight="bold"       // bold text
            >
              Please select a warehouse to view stock data
            </Typography>
          </Box>
        )}

      </Box>

      {/* Dialogs */}
      <Dialog open={openAdjustmentDialog} onClose={() => handleAdjustmentDialogClose(false)}>
        <DialogTitle>Adjust Stock: {selectedItem?.itemName}</DialogTitle>
        <DialogContent>
          <TextField
            label="Physical Stock"
            value={adjustedPhysicalStock}
            onChange={(e) => dispatch(setAdjustedPhysicalStock(e.target.value))}
            fullWidth
            sx={{ mt: 2 }}
          />
          <TextField
            label="Adjustment Reason"
            value={adjustmentReason}
            onChange={(e) => dispatch(setAdjustmentReason(e.target.value))}
            fullWidth
            multiline
            rows={4}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleAdjustmentDialogClose(false)}>Cancel</Button>
          <Button onClick={() => handleAdjustmentDialogClose(true)} variant="contained">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openApproveDialog}
        onClose={() => dispatch(setOpenApproveDialog(false))}
        BackdropProps={{
          sx: {
            backdropFilter: "blur(6px)",          // background blur
            WebkitBackdropFilter: "blur(6px)",   // Safari support
            backgroundColor: "rgba(0,0,0,0.25)", // semi-transparent overlay
          },
        }}
        PaperProps={{
          sx: {
            width: 420,
            maxWidth: "90%",
            borderRadius: 3,
            overflow: "hidden",
            bgcolor: "rgba(255,255,255,0.8)", // frosted glass effect
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(10px)",
          },
        }}
      >
        <DialogTitle sx={{ textAlign: "center", fontWeight: 800 }}>
          Approve Item: {selectedApproveItem?.itemName ?? "N/A"}
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ padding: 3 }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 2,
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
            }}
          >
            <Box>
              <Typography variant="body2" color="text.secondary">
                System Stock
              </Typography>
              <Typography variant="body1" fontWeight={700}>
                {selectedApproveItem?.updatedCurrentSystem ?? 0}
              </Typography>
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary">
                Physical Stock
              </Typography>
              <Typography variant="body1" fontWeight={700}>
                {selectedApproveItem?.physicalClosing ?? 0}
              </Typography>
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary">
                Stock Variance
              </Typography>
              <Typography
                variant="body1"
                fontWeight={700}
                color={
                  "error.main"
                }
              >
                {selectedApproveItem?.variance ?? 0}
              </Typography>
            </Box>
          </Box>

          <TextField
            label="Description for Approval"
            value={approveDescription}
            onChange={(e) => dispatch(setApproveDescription(e.target.value))}
            fullWidth
            rows={4}
            autoFocus
            sx={{ mt: 2 }}
          />

          <Typography sx={{ mt: 2, fontWeight: 700 }}>
            Are you sure you want to approve this item?
          </Typography>
        </DialogContent>

        <DialogActions sx={{ justifyContent: "center", pb: 2, px: 3 }}>
          <Button
            onClick={() => dispatch(setOpenApproveDialog(false))}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>

          <Button
            onClick={handleApproveConfirm}
            variant="contained"
            sx={{ borderRadius: 2, px: 4 }}
            disabled={isApproving || !selectedApproveItem}
          >
            {isApproving ? "Approving..." : "Confirm Approve"}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={openDownloadDialog} onClose={() => dispatch(setOpenDownloadDialog(false))}>
        <DialogTitle>Download CSV</DialogTitle>
        <DialogContent>
          <Typography>
            Download  items data for location: {searchParams.locationName}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => dispatch(setOpenDownloadDialog(false))}>Cancel</Button>
          <Button
            onClick={handleDownloadCSV}
            variant="contained"
            disabled={!searchParams.locationName}
          >
            Download
          </Button>
        </DialogActions>
      </Dialog>

      <FeedbackSnackbar
        open={openSnackbar}
        message={snackbarMessage}
        onClose={() => dispatch(setOpenSnackbar(false))}
      />
    </Box>
  );
};

export default WarehouseRawMaterialsStockModification;