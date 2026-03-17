"use client";
import React, { useEffect, useRef, useCallback, useMemo, useState } from "react";
import {
  Box, IconButton, Button, Dialog, DialogActions, DialogContent, TextField, Typography, DialogTitle, Divider,
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchBranches, fetchItems, selectBranches, selectDataLoading, selectDataError, approveItem, Branchitem,
  selectSelectedLocation, setSelectedLocation, selectEditableRows, setEditableRows, selectChanges, setChanges,
  selectVisibleColumns, toggleColumn, SearchFilters, selectOpenFirstDialog, setOpenFirstDialog,
  selectOpenAdjustmentDialog, setOpenAdjustmentDialog, selectOpenApproveDialog, setOpenApproveDialog,
  selectSelectedItem, setSelectedItem, selectSelectedApproveItem, setSelectedApproveItem,
  selectAdjustmentReason, setAdjustmentReason, selectAdjustedPhysicalStock, setAdjustedPhysicalStock,
  selectApproveDescription, setApproveDescription, selectOpenSnackbar, setOpenSnackbar,
  selectSnackbarMessage, setSnackbarMessage, selectCurrentPage, setCurrentPage, selectHasMoreData,
  setHasMoreData, selectAllItems, setAllItems, selectTotalItems, setTotalItems, selectTotalPages,
  setTotalPages, selectIsLoadingMore, setIsLoadingMore, selectIsFullScreen, setIsFullScreen,
  selectTableView, setTableView, selectSearchParams, setSearchParams, setApprovedItemsFilters, FetchParams,
  selectFilterOptions, setDataLoading,
} from "../../../../features/yen_inventory/OutletPhysicalVarianceSlice";
import { usePermissions } from "@/hooks/usePermissions";
import OutletsInventoryManagementPage from "../page";
import FilterBar from "../../../../components/Inventory/physcialstockvarience/filterBar";
import DataTable from "../../../../components/Inventory/physcialstockvarience/dataTable";
import PaginationControls from "../../../../components/Inventory/physcialstockvarience/paginationcontrol";
import ConfirmDialog from "../../../../components/Inventory/physcialstockvarience/confirmDailog";
import FeedbackSnackbar from "../../../../components/Inventory/physcialstockvarience/feedbackSnakbar";
import { StockAdjustmentTable } from "../../../../components/Inventory/physcialstockvarience/ui/stockAdjustmentTable";
import { AppDispatch } from "@/redux/store";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import { StockAdjustmentDialog } from "@/components/Inventory/physicalstockmodifcation/stockadjustmentDialog";
import { useTodayDate } from "@/components/Hooks/useTodayDate";

export interface SearchParams {
  itemName: string[];
  varianceName: string[];
  category: string[];
  subCategory: string[];
  location?: string[];
  queryDate?: string;
}

const ITEMS_PER_PAGE = 30;

const OutletPhysicalStockModification: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { hasPermission, isModuleVisible } = usePermissions();
  const canRead = hasPermission("yenerp","physicalstockvariancemodification","read");
const canApprove = hasPermission("yenerp","physicalstockvariancemodification","approve");
  const branches = useSelector(selectBranches);
  const loading = useSelector(selectDataLoading);
  const selectedLocation = useSelector(selectSelectedLocation);
  const error = useSelector(selectDataError);
  const editableRows = useSelector(selectEditableRows);
  const changes = useSelector(selectChanges);
  const visibleColumns = useSelector(selectVisibleColumns);
  const openFirstDialog = useSelector(selectOpenFirstDialog);
  const openAdjustmentDialog = useSelector(selectOpenAdjustmentDialog);
  const filterOptions = useSelector(selectFilterOptions);
  const openApproveDialog = useSelector(selectOpenApproveDialog);
  const selectedItem = useSelector(selectSelectedItem);
  const selectedApproveItem = useSelector(selectSelectedApproveItem);
  const adjustmentReason = useSelector(selectAdjustmentReason);
  const adjustedPhysicalStock = useSelector(selectAdjustedPhysicalStock);
  const approveDescription = useSelector(selectApproveDescription);
  const openSnackbar = useSelector(selectOpenSnackbar);
  const snackbarMessage = useSelector(selectSnackbarMessage);
  const currentPage = useSelector(selectCurrentPage);
  const hasMoreData = useSelector(selectHasMoreData);
  const allItems = useSelector(selectAllItems);
  const totalItems = useSelector(selectTotalItems);
  const totalPages = useSelector(selectTotalPages);
  const isLoadingMore = useSelector(selectIsLoadingMore);
  const isFullScreen = useSelector(selectIsFullScreen);
  const tableView = useSelector(selectTableView);
  const searchParams = useSelector(selectSearchParams);

  const isApprovingRef = useRef(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const fullScreenContainerRef = useRef<HTMLDivElement | null>(null);
  const filterMenuAnchorEl = useRef<(() => void) | null>(null);
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Refs to prevent effect recursion
  const prevTriggersRef = useRef({ location: "", searchStr: "" });
  const filterOptionsRef = useRef(filterOptions);
  const [isRefreshing, setIsRefreshing] = useState(false);


  const apiDate = useTodayDate();

  // Keep filterOptions ref in sync
  useEffect(() => { filterOptionsRef.current = filterOptions; }, [filterOptions]);

  // Fetch branches on mount
  useEffect(() => {
    if (branches.length === 0) dispatch(fetchBranches());
  }, [dispatch, branches.length]);

  // Set approved items filters
  useEffect(() => {
    if (tableView === "Approved" && selectedLocation) {
      dispatch(setApprovedItemsFilters({ branch: selectedLocation, date: searchParams.queryDate || "" }));
    }
  }, [dispatch, tableView, selectedLocation, searchParams.queryDate]);

  // Error snackbar
  useEffect(() => {
    if (error) { dispatch(setSnackbarMessage(`Error: ${error}`)); dispatch(setOpenSnackbar(true)); }
  }, [error, dispatch]);

  const fieldTypes = useMemo(() => [
    "Opening-Stock", "Receiving-Stock", "Stock IN", "Stock OUT", "Sales", "Sales Return",
    "Wastages", "Warehouse Return", "Calc System", "System Stock", "Physical Stock",
    "Variance", "Status", "Action",
  ], []);

  const staticColumns = useMemo(() => ["itemCode", "Item Name", "Variance Name", "Category", "Subcategory"], []);

  // ─────────────────────────────────────────────────────────────────────────────
  // loadPage — fetches table data (and optionally filter options)
  // ─────────────────────────────────────────────────────────────────────────────
  const loadPage = useCallback(
    async (page: number, isReset: boolean = false, includeFilters: boolean = true) => {
      if (isFetchingRef.current) return;
      if (loading && !isReset) return;

      isFetchingRef.current = true;
      try {
        if (page > 1) dispatch(setIsLoadingMore(true));
        if (page === 1) dispatch(setDataLoading(true));

        const searchFilters: Partial<SearchFilters> = {
          page,
          limit: ITEMS_PER_PAGE,
          includeSalesReturn: true,
          includeWastageReturn: true,
          includeStockTransfer: true,
          include_filter_options: includeFilters,
          // ← only_filter_options is NOT set here (this is a table fetch)
        };

        if (selectedLocation) searchFilters.locationId = selectedLocation;

        const dynamicFilters: Partial<SearchFilters> = {
          ...(searchParams.itemName?.length && { itemName: searchParams.itemName }),
          ...(searchParams.varianceName?.length && { varianceName: searchParams.varianceName }),
          ...(searchParams.category?.length && { category: searchParams.category }),
          ...(searchParams.subCategory?.length && { subCategory: searchParams.subCategory }),
          queryDate: apiDate,
        };
        Object.assign(searchFilters, dynamicFilters);

        if (includeFilters) {
          const fo = filterOptionsRef.current;
          searchFilters.categoryPage = isReset ? 1 : fo.category.page;
          searchFilters.categoryLimit = 50;
          searchFilters.subCategoryPage = isReset ? 1 : fo.subCategory.page;
          searchFilters.subCategoryLimit = 50;
          searchFilters.itemNamePage = isReset ? 1 : fo.itemName.page;
          searchFilters.itemNameLimit = 50;
          searchFilters.varianceNamePage = isReset ? 1 : fo.varianceName.page;
          searchFilters.varianceNameLimit = 50;
        }

        const result = await dispatch(
          fetchItems({
            ...searchFilters,
            locationId: searchFilters.locationId || "",
            resetFilterOptions: isReset,
          } as FetchParams)
        ).unwrap();

        const newItems =
          page === 1
            ? result.branchwise || []
            : [...allItems, ...(result.branchwise || [])];

        dispatch(setAllItems(newItems));
        dispatch(setHasMoreData((result.branchwise || []).length >= ITEMS_PER_PAGE));
        dispatch(setTotalItems(result.total || 0));
        dispatch(setTotalPages(Math.ceil((result.total || 0) / ITEMS_PER_PAGE)));
      } catch {
        dispatch(setSnackbarMessage("Error fetching data."));
        dispatch(setOpenSnackbar(true));
      } finally {
        dispatch(setIsLoadingMore(false));
        dispatch(setDataLoading(false));
        isFetchingRef.current = false;
      }
    },
    [loading, selectedLocation, searchParams, dispatch, allItems, apiDate]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // loadFilterOptions — fetches ONLY filter dropdown options, table is untouched
  // ─────────────────────────────────────────────────────────────────────────────
  const loadFilterOptions = useCallback(
    async (
      field: "category" | "subCategory" | "itemName" | "varianceName",
      page: number,
      search?: string
    ) => {
      if (!selectedLocation) return;

      const params: FetchParams = {
        locationId: selectedLocation,
        include_filter_options: true,
        only_filter_options: true, // ← key flag: backend skips table data
        queryDate: apiDate,
        // Pass current active filters so dropdown values are contextually filtered
        ...(searchParams.category?.length && { category: searchParams.category }),
        ...(searchParams.subCategory?.length && { subCategory: searchParams.subCategory }),
        ...(searchParams.itemName?.length && { itemName: searchParams.itemName }),
        ...(searchParams.varianceName?.length && { varianceName: searchParams.varianceName }),
        // Only pass the specific field being paginated / searched
        ...(field === "category" && {
          categoryPage: page,
          categoryLimit: 50,
          ...(search !== undefined && { categorySearch: search }),
        }),
        ...(field === "subCategory" && {
          subCategoryPage: page,
          subCategoryLimit: 50,
          ...(search !== undefined && { subCategorySearch: search }),
        }),
        ...(field === "itemName" && {
          itemNamePage: page,
          itemNameLimit: 50,
          ...(search !== undefined && { itemNameSearch: search }),
        }),
        ...(field === "varianceName" && {
          varianceNamePage: page,
          varianceNameLimit: 50,
          ...(search !== undefined && { varianceNameSearch: search }),
        }),
        // NO `page` param → reducer skips table update block entirely
      };

      await dispatch(fetchItems(params));
    },
    [dispatch, selectedLocation, apiDate, searchParams]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Infinite scroll for table
  // ─────────────────────────────────────────────────────────────────────────────
  const loadMoreData = useCallback(async () => {
    if (isLoadingMore || !hasMoreData || loading || isFetchingRef.current) return;
    const nextPage = currentPage + 1;
    dispatch(setCurrentPage(nextPage));
    await loadPage(nextPage, false, false); // no filter options on table scroll
  }, [isLoadingMore, hasMoreData, loading, currentPage, loadPage, dispatch]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Trigger on location / search param change
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedLocation) return;

    const searchStr = JSON.stringify(searchParams);
    const locationChanged = selectedLocation !== prevTriggersRef.current.location;
    const searchChanged = searchStr !== prevTriggersRef.current.searchStr;

    if (!locationChanged && !searchChanged) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      prevTriggersRef.current = { location: selectedLocation, searchStr };

      dispatch(setCurrentPage(1));
      dispatch(setAllItems([]));

      if (locationChanged) {
        loadPage(1, true, true); // full reset
      } else {
        loadPage(1, false, true); // filter changed, preserve filter option pages
      }
    }, 500);

    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [selectedLocation, searchParams, loadPage, dispatch]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────────────
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = target;
    const scrollPosition = (scrollTop + clientHeight) / scrollHeight;

    if (
      scrollPosition >= 0.8 &&
      !loading &&
      !isLoadingMore &&
      hasMoreData &&
      selectedLocation &&
      !isFetchingRef.current
    ) {
      loadMoreData();
    }
  }, [loading, isLoadingMore, hasMoreData, selectedLocation, loadMoreData]);

  const handleLocationChange = useCallback((value: string | string[]) => {
    const selectedValue = Array.isArray(value) ? value[0] : value;
    if (selectedValue !== selectedLocation) dispatch(setSelectedLocation(selectedValue));
  }, [dispatch, selectedLocation]);

  const handleSearchChange = useCallback((field: keyof SearchParams, value: string[] | string) => {
    dispatch(setSearchParams({ ...searchParams, [field]: value }));
  }, [dispatch, searchParams]);

  const handleCellEdit = useCallback(
    (id: string, field: string, value: string, itemName: string, varianceName: string) => {
      dispatch(setEditableRows({ ...editableRows, [id]: { ...editableRows[id], [field]: value === "" ? "" : value } }));
      const newChanges = changes.some(
        (c) => c.itemName === itemName && c.varianceName === varianceName && c.locationName === selectedLocation && c.field === field
      )
        ? changes.map((c) =>
          c.itemName === itemName && c.varianceName === varianceName && c.locationName === selectedLocation && c.field === field
            ? { ...c, newValue: value }
            : c
        )
        : [...changes, { itemName, varianceName, locationName: selectedLocation!, field, newValue: value }];
      dispatch(setChanges(newChanges));
    },
    [dispatch, editableRows, changes, selectedLocation]
  );

  const handleToggleColumn = useCallback((column: string) => dispatch(toggleColumn(column)), [dispatch]);

  const handleApproveClick = useCallback((item: Branchitem) => {
    dispatch(setSelectedApproveItem(item));
    dispatch(setOpenApproveDialog(true));
    dispatch(setApproveDescription(""));
  }, [dispatch]);

  const handleApproveConfirm = useCallback(async () => {
    if (!selectedApproveItem || !selectedLocation) return;
    try {
      const branch = branches.find(
        (b) => b.locationName === selectedLocation || b.aliasName === selectedLocation
      );
      await dispatch(
        approveItem({
          itemCode: selectedApproveItem.itemCode,
          locationId: branch?.locationId || selectedLocation,
          approvedBy: "",
          description: approveDescription || adjustmentReason || "",
        })
      ).unwrap();

      dispatch(setCurrentPage(1));
      await loadPage(1, false, true);

      dispatch(setSnackbarMessage(`Item "${selectedApproveItem.itemName}" approved successfully`));
      dispatch(setOpenSnackbar(true));
    } catch (error: any) {
      dispatch(
        setSnackbarMessage(error?.response?.data?.detail || error?.message || "Failed to approve item")
      );
      dispatch(setOpenSnackbar(true));
    } finally {
      dispatch(setOpenApproveDialog(false));
      dispatch(setSelectedApproveItem(null));
      dispatch(setApproveDescription(""));
    }
  }, [dispatch, branches, selectedLocation, selectedApproveItem, approveDescription, adjustmentReason, loadPage]);

  const handleAdjustmentDialogClose = useCallback(() => {
    dispatch(setOpenAdjustmentDialog(false));
    dispatch(setSelectedItem(null));
    dispatch(setAdjustedPhysicalStock(""));
    dispatch(setAdjustmentReason(""));
  }, [dispatch]);

  const handleSnackbarClose = useCallback(() => dispatch(setOpenSnackbar(false)), [dispatch]);

  const handleRefresh = useCallback(async () => {
    if (!selectedLocation) return;

    setIsRefreshing(true);

    try {
      dispatch(setCurrentPage(1));
      dispatch(setAllItems([]));

      await loadPage(1, false, true);

      dispatch(setSnackbarMessage("Data refreshed."));
      dispatch(setOpenSnackbar(true));
    } catch {
      dispatch(setSnackbarMessage("Error refreshing data."));
      dispatch(setOpenSnackbar(true));
    }
    finally {
      setIsRefreshing(false);
    }
  }, [dispatch, selectedLocation, loadPage]);


  const getTotalColspan = useCallback(() => {
    const visibleStaticCount = staticColumns.filter((col) => visibleColumns[col]).length;
    const visibleFieldCount = selectedLocation ? fieldTypes.filter((col) => visibleColumns[col]).length : 0;
    return visibleStaticCount + visibleFieldCount;
  }, [visibleColumns, selectedLocation, fieldTypes, staticColumns]);

  const toggleFullScreen = useCallback(() => {
    dispatch(setIsFullScreen(!isFullScreen));
    if (isFullScreen && filterMenuAnchorEl.current) filterMenuAnchorEl.current();
  }, [dispatch, isFullScreen]);

  const toggleTableView = useCallback(() => {
    dispatch(setTableView(tableView === "Stock" ? "Approved" : "Stock"));
    if (filterMenuAnchorEl.current) filterMenuAnchorEl.current();
  }, [dispatch, tableView]);

  const itemsWithIds = useMemo(
    () =>
      allItems.map((item: Branchitem, index: number) => {
        const row: Branchitem & { id: string } = {
          id: item.id || `${item.itemName}-${item.varianceName || "N/A"}-${index}`,
          itemName: item.itemName || "N/A",
          varianceName: item.varianceName || "N/A",
          category: item.category || "N/A",
          subCategory: item.subCategory || "N/A",
          itemCode: item.itemCode || "N/A",
          openingStockQty: item.openingStockQty?.toString() ?? "0",
          closingStockQty: item.closingStockQty?.toString() ?? "0",
          stockStatus: item.stockStatus ?? "unknown",
          received: item.receivedQty?.toString() ?? item.received?.toString() ?? "0",
          dispatchedQty: item.dispatchedQty?.toString() ?? "0",
          salesQty: item.salesQty?.toString() ?? "0",
          salesReturn: item.salesReturnQty?.toString() ?? item.salesReturn?.toString() ?? "0",
          wastageReturnQty: item.wastageReturnQty?.toString() ?? "0",
          warehouseReturnQty: item.warehouseReturnQty?.toString() ?? "0",
          stockTransferInQty: item.stockTransferInQty?.toString() ?? "0",
          stockTransferOutQty: item.stockTransferOutQty?.toString() ?? "0",
          currentSystemQty: item.currentSystemQty?.toString() ?? "0",
          stockVariance: item.stockVariance?.toString() ?? "0",
          approvalStatus: item.approvalStatus ?? "Pending",
          physicalVariance: item.physicalVariance?.toString() ?? "0",
          updatedCurrentSystemQty: item.updatedCurrentSystemQty?.toString() ?? "0",
          physicalClosingQty: item.physicalClosingQty?.toString() ?? "0",
        };

        if (selectedLocation) {
          fieldTypes.forEach((field) => {
            const key = `${selectedLocation}-${field}`;
            switch (field) {
              case "Opening-Stock": row[key] = item.openingStockQty?.toString() ?? "0"; break;
              case "Receiving-Stock": row[key] = item.dispatchedQty?.toString() ?? "0"; break;
              case "Stock IN": row[key] = item.stockTransferInQty?.toString() ?? "0"; break;
              case "Stock OUT": row[key] = item.stockTransferOutQty?.toString() ?? "0"; break;
              case "Sales": row[key] = item.salesQty?.toString() ?? "0"; break;
              case "Sales Return": row[key] = item.salesReturnQty?.toString() ?? item.salesReturn?.toString() ?? "0"; break;
              case "Wastages": row[key] = item.wastageReturnQty?.toString() ?? "0"; break;
              case "Warehouse Return": row[key] = item.warehouseReturnQty?.toString() ?? "0"; break;
              case "Calc System": row[key] = item.currentSystemQty?.toString() ?? "0"; break;
              case "Physical Stock": row[key] = item.physicalClosingQty?.toString() ?? "0"; break;
              case "Variance": row[key] = item.stockVariance?.toString() ?? "0"; break;
              case "System Stock": row[key] = item.updatedCurrentSystemQty?.toString() ?? "0"; break;
              case "Status": row[key] = item.approvalStatus ?? "Pending"; break;
              case "Physical Variance": row[key] = item.physicalVariance?.toString() ?? "0"; break;
              case "Approve Button": row[key] = "Approve"; break;
              default: row[key] = item[key]?.toString() ?? "0";
            }
          });
        }
        return row;
      }),
    [allItems, selectedLocation, fieldTypes]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  const filterBar = (
    <FilterBar
      key={`filter-${selectedLocation}`}
      onRefresh={handleRefresh}
      searchParams={searchParams}
      onSearchChange={handleSearchChange}
      branches={branches}
      selectedLocation={selectedLocation}
      onLocationChange={handleLocationChange}
      visibleColumns={visibleColumns}
      onToggleColumn={handleToggleColumn}
      fieldTypes={fieldTypes}
      staticColumns={staticColumns}
      loading={loading}
      isFullScreen={isFullScreen}
      fullScreenContainerRef={fullScreenContainerRef}
      setResetAnchorEl={(fn) => (filterMenuAnchorEl.current = fn)}
      showColumnFilter
      // ← NEW prop: lets FilterBar load more dropdown options without touching the table
      onLoadMoreFilterOptions={loadFilterOptions}
      isRefreshing={isRefreshing}    // 3. Pass loading state

    />
  );

  const tableSection = (
    <>
      {tableView === "Approved" ? (
        <StockAdjustmentTable isFullScreen={isFullScreen} />
      ) : (
        <DataTable
          loading={loading}
          filteredItems={itemsWithIds}
          visibleColumns={{ ...visibleColumns, ...(isFullScreen ? {} : { "Physical Closing": true }) }}
          fieldTypes={fieldTypes}
          selectedLocation={selectedLocation}
          editableRows={editableRows}
          onCellEdit={handleCellEdit}
          totalColspan={getTotalColspan()}
          onScroll={handleScroll}
          hasMoreData={hasMoreData}
          isLoadingMore={isLoadingMore}
          scrollContainerRef={scrollContainerRef}
          inputRefs={inputRefs}
          isFullScreen={isFullScreen}
        handleApproveClick={handleApproveClick}
canApprove={canApprove}
        />
      )}
    </>
  );

  const dialogs = (
    <>
      <StockAdjustmentDialog
        open={openAdjustmentDialog}
        item={selectedItem}
        adjustedPhysicalStock={adjustedPhysicalStock}
        adjustmentReason={adjustmentReason}
        onCancel={handleAdjustmentDialogClose}
        onChangePhysicalStock={(value) => dispatch(setAdjustedPhysicalStock(value))}
        onChangeReason={(value) => dispatch(setAdjustmentReason(value))}
        fullScreen={isFullScreen}
      />

      <Dialog
        open={openApproveDialog}
        onClose={() => dispatch(setOpenApproveDialog(false))}
        disablePortal
        fullScreen={false} // keep it non-fullscreen if you want
        sx={{ zIndex: 10001 }} // make sure zIndex is above fullScreen Box
        BackdropProps={{
          sx: {
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            backgroundColor: "rgba(0,0,0,0.25)",
          },
        }}
        PaperProps={{
          sx: {
            width: 420,
            maxWidth: "90%",
            borderRadius: 3,
            overflow: "hidden",
            backdropFilter: "blur(4px)", // adds blur behind dialog
            backgroundColor: "rgba(255,255,255,0.8)", // semi-transparent
            WebkitBackdropFilter: "blur(10px)",
          },
        }}
      >
        <DialogTitle sx={{ textAlign: "center", fontWeight: 800 }}>
          Approve Item: {selectedApproveItem?.varianceName ?? "N/A"}
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ padding: 3 }}>
          {(() => {
            const stockVariance = Number(selectedApproveItem?.stockVariance ?? 0);
            return (
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">System Stock</Typography>
                  <Typography variant="body1" fontWeight={700}>{selectedApproveItem?.updatedCurrentSystemQty ?? 0}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Physical Stock</Typography>
                  <Typography variant="body1" fontWeight={700}>{selectedApproveItem?.physicalClosingQty ?? 0}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Stock Variance</Typography>
                  <Typography variant="body1" fontWeight={700} color={"error.main"}>
                    {stockVariance}
                  </Typography>
                </Box>
              </Box>
            );
          })()}
          <TextField
            label="Description for Approval"
            value={approveDescription}
            onChange={(e) => dispatch(setApproveDescription(e.target.value))}
            fullWidth
            rows={4}
            autoFocus
            sx={{ mt: 2 }}
          />
          <Typography sx={{ mt: 2, fontWeight: 700 }}>Are you sure you want to approve this item?</Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", pb: 2, px: 3 }}>
          <Button onClick={() => dispatch(setOpenApproveDialog(false))} variant="outlined" sx={{ borderRadius: 2 }}>Cancel</Button>
          <Button
   onClick={handleApproveConfirm}
   disabled={!canApprove || isApprovingRef.current}
   variant="contained"
>
   Confirm Approve
</Button>
        </DialogActions>
      </Dialog>

      {!isFullScreen && tableView === "Stock" && selectedLocation && totalItems > 0 && (
        <PaginationControls
          currentPage={currentPage}
          totalItems={totalItems}
          totalPages={totalPages}
          loading={loading}
          onSaveChanges={() => dispatch(setOpenFirstDialog(true))}
          changesLength={changes.length}
          isFullScreen={isFullScreen}
        />
      )}
      {!isFullScreen && (
        <ConfirmDialog
          open={openFirstDialog}
          totalItems={totalItems}
          changesLength={changes.length}
          onClose={handleSnackbarClose}
          fullScreen={isFullScreen}
        />
      )}
      <FeedbackSnackbar open={openSnackbar} message={snackbarMessage} onClose={handleSnackbarClose} />
    </>
  );
if (!isModuleVisible("yenerp","physicalstockvariancemodification")) {
  return (
    <Box p={3}>
      <Typography color="error">
        You do not have access to Physical Stock Variance Modification module
      </Typography>
    </Box>
  );
}
  return (
    <Box
      ref={fullScreenContainerRef}
      sx={{
        ...(isFullScreen
          ? { position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 9999, backgroundColor: "#ffffff", display: "flex", flexDirection: "column", overflow: "hidden" }
          : {}),
      }}
    >
      {isFullScreen ? (
        <>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, borderBottom: "1px solid #e0e0e0", flexShrink: 0, minHeight: 60, backgroundColor: "white", zIndex: 2 }}>
            {tableView === "Stock" ? <Box sx={{ flex: 1 }}>{filterBar}</Box> : <Box sx={{ flex: 1 }} />}
            <Button variant="contained" onClick={toggleTableView} sx={{ flexShrink: 0, whiteSpace: "nowrap", minWidth: "auto" }}>
              {tableView === "Stock" ? "Show Approved Items" : "Show Stock Variance"}
            </Button>
            <IconButton onClick={toggleFullScreen} sx={{ flexShrink: 0, color: "primary.main" }}>
              <FullscreenExitIcon />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <Box sx={{ flex: 1, overflowY: "auto" }}>{tableSection}</Box>
            {tableView === "Stock" && selectedLocation && totalItems > 0 && (
              <Box sx={{ flexShrink: 0, borderTop: "1px solid #e0e0e0", bgcolor: "white", p: 1 }}>
                <PaginationControls
                  currentPage={currentPage}
                  totalItems={totalItems}
                  totalPages={totalPages}
                  loading={loading}
                  onSaveChanges={() => dispatch(setOpenFirstDialog(true))}
                  changesLength={changes.length}
                  isFullScreen={isFullScreen}
                />
              </Box>
            )}
            {dialogs}
          </Box>
        </>
      ) : (
        <>
          <OutletsInventoryManagementPage />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, backgroundColor: "white", borderBottom: "1px solid #e0e0e0" }}>
            {tableView === "Stock" ? filterBar : <Box sx={{ flex: 1 }} />}
            <Button variant="contained" onClick={toggleTableView} sx={{ flexShrink: 0 }}>
              {tableView === "Stock" ? "Show Approved Items" : "Show Stock Variance"}
            </Button>
            <IconButton onClick={toggleFullScreen}>
              <FullscreenIcon />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <Box sx={{ flex: 1 }}>{tableSection}</Box>
            {dialogs}
          </Box>
        </>
      )}
    </Box>
  );
};

export default OutletPhysicalStockModification;