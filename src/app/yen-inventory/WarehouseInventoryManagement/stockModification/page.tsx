"use client";

import React, {
  useEffect,
  useRef,
  useCallback,
  useMemo,
  ChangeEvent,
} from "react";
import { Box } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchRawMaterials,
  fetchWarehouses,
  updateRawMaterialStock,
  selectFilterOptions,
  selectRawMaterialsLoading,
  selectFilteredRawMaterials,
  selectHasMore,
  selectFilters,
  selectWarehouses,
  selectWarehousesLoading,
  setFilter,
  resetRawMaterials,
  selectOpenSnackbar,
  setOpenSnackbar,
  selectOpenDownloadDialog,
  setOpenDownloadDialog,
  selectEditMessage,
  setEditMessage,
  selectOpenDialog,
  setOpenDialog,
  selectOpenModal,
  setOpenModal,
  selectUpdatedStocks,
  setUpdatedStocks,
  selectChanges,
  setChanges,
  selectChangedRows,
  setChangedRows,
  RawMaterial,
  RawMaterialsState,
  clearAllFilters,
  downloadExportCSV,
  downloadSampleCSV,
  importRawMaterialStock,
  updateRawMaterialsBulk,
} from "../../../../features/yen_inventory/wharehoueSlice";
import { AppDispatch, RootState } from "@/redux/store";
import FilterBar from "../../../../components/Inventory/stock/filterBar";
import DataTable from "../../../../components/Inventory/stock/dataTable";
import PaginationControls from "../../../../components/Inventory/stock/paginationcontrol";
import ConfirmDialog from "../../../../components/Inventory/stock/confirmDailog";
import FeedbackSnackbar from "../../../../components/Inventory/stock/feedbackSnakbar";
import UpdatedStocksModal from "../../../../components/Inventory/stock/updateStockModel";
import DownloadDialog from "../../../../components/Inventory/stock/downloadDialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import WarehouseInventoryManagementPage from "../page";
import { useTodayDate } from "@/components/Hooks/useTodayDate";
import { usePermissions } from "../../../../hooks/usePermissions";
export interface TableRowData {
  id: string;
  index: number;
  itemName: string;
  varianceName: string;
  category: string;
  subcategory: string;
  locationId: string;
  systemStock: number;
  systemStockSo: number;
  physicalStock: number;
  itemCode: string;
  previousSystemStock: number;
  randomId: string;
}



type SearchKey =
  | "categorySearch"
  | "subCategorySearch"
  | "itemNameSearch"
  | "varianceNameSearch";

type PageKey =
  | "categoryPage"
  | "subCategoryPage"
  | "itemNamePage"
  | "varianceNamePage";

type LimitKey =
  | "categoryLimit"
  | "subCategoryLimit"
  | "itemNameLimit"
  | "varianceNameLimit";

const WarehousePhysicalStockModification: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { hasPermission } = usePermissions();

const canRead = hasPermission("yenerp", "warehousephysicalstockmodification", "read");
const canAdd = hasPermission("yenerp", "warehousephysicalstockmodification", "add");
const canEdit = hasPermission("yenerp", "warehousephysicalstockmodification", "edit");
const canHide = hasPermission("yenerp", "warehousephysicalstockmodification", "hide");
  const filterOptions = useSelector(selectFilterOptions);
  const loading = useSelector(selectRawMaterialsLoading);
  const warehouses = useSelector(selectWarehouses);
  const warehousesLoading = useSelector(selectWarehousesLoading);
  const rows = useSelector(
    (state: RootState) => state.rawMaterials.accumulatedRawMaterials
  );
  const filteredRawMaterials = useSelector(selectFilteredRawMaterials);
  const hasMore = useSelector(selectHasMore);
  const currentFilters = useSelector(selectFilters);
  const openSnackbar = useSelector(selectOpenSnackbar);
  const openDownloadDialog = useSelector(selectOpenDownloadDialog);
  const editMessage = useSelector(selectEditMessage);
  const openDialog = useSelector(selectOpenDialog);
  const openModal = useSelector(selectOpenModal);
  const updatedStocks = useSelector(selectUpdatedStocks);
  const changes = useSelector(selectChanges);
  const changedRows = useSelector(selectChangedRows);
  const todayDate = useTodayDate();


  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const isInitializedRef = useRef(false);

  const limit = currentFilters.limit || 30;
  const total = filteredRawMaterials?.total || 0;
  const currentPage = currentFilters.page;
  const totalPages = Math.ceil(total / limit);
  const startItem = (currentPage - 1) * limit + 1;
  const endItem = Math.min(startItem + limit - 1, total);



  const isInitialLoading = loading && total === 0;


  // Fetch warehouses on mount
  useEffect(() => {
    dispatch(fetchWarehouses({}));
  }, [dispatch]);

  // Initial load
  useEffect(() => {
    if (!todayDate) {
      return;
    }

    if (
      !isInitializedRef.current &&
      warehouses.length > 0 &&
      !warehousesLoading &&
      currentFilters.locationId
    ) {
      dispatch(
        fetchRawMaterials({
          params: {
            page: 1,
            limit: 30,
            locationId: currentFilters.locationId,
            includeDropdowns: true,
            createdDate: todayDate,
          } as Partial<RawMaterialsState["filters"]>,
          skipCache: true,
          append: false,
        })
      );
      isInitializedRef.current = true;
    }
  }, [
    dispatch,
    warehouses.length,
    warehousesLoading,
    currentFilters.locationId,
    todayDate,
  ]);

  const handleSearchChange = useCallback(
    (field: keyof RawMaterialsState["filters"], value: string | string[]) => {
      dispatch(setChanges([]));
      dispatch(setUpdatedStocks([]));
      dispatch(setChangedRows({}));

      const processed = Array.isArray(value) ? value : value ? [value] : [];

      // update filter in state
      dispatch(setFilter({ key: field, value: field === "locationId" ? value : processed }));
      dispatch(setFilter({ key: "page", value: 1 }));

      // fetch using latest state via thunk
      dispatch(
        fetchRawMaterials({
          params: {
            ...(field === "locationId"
              ? { locationId: value as string }
              : { [field]: processed }),
            page: 1,
            includeDropdowns: true,
            createdDate: todayDate,
          } as Partial<RawMaterialsState["filters"]>,
          append: false,
          skipCache: true,
        })
      );
    },
    [dispatch]
  );


  const handleClearAllFilters = useCallback(() => {
    dispatch(clearAllFilters());

    dispatch(
      fetchRawMaterials({
        params: {
          ...currentFilters,
          purchasecategoryName: undefined,
          purchasesubcategoryName: undefined,
          itemName: undefined,
          varianceName: undefined,
          createdDate: todayDate,
          page: 1,
        },
        skipCache: true,
        append: false,
      })
    );
  }, [dispatch, currentFilters]);

  const handleTableScrollBottom = useCallback(() => {
    if (hasMore && !loading && !loadingRef.current) {
      loadingRef.current = true;
      const nextPage = currentFilters.page + 1;

      dispatch(
        fetchRawMaterials({
          page: nextPage,
          append: true,
          skipCache: true,
          params: {
            ...currentFilters,
            page: nextPage,
            createdDate: todayDate,
          },
        })
      )
        .unwrap()
        .then(() => {
          dispatch(setFilter({ key: "page", value: nextPage }));
        })
        .catch(() => { })
        .finally(() => {
          loadingRef.current = false;
        });
    }
  }, [hasMore, loading, currentFilters.page, dispatch]);

  const handleFilterScrollBottom = useCallback(
    (field: "categories" | "subcategories" | "itemNames" | "varianceNames") => {
      const map: Record<
        "categories" | "subcategories" | "itemNames" | "varianceNames",
        { page: PageKey; limit: LimitKey; search: SearchKey }
      > = {
        categories: {
          page: "categoryPage",
          limit: "categoryLimit",
          search: "categorySearch",
        },
        subcategories: {
          page: "subCategoryPage",
          limit: "subCategoryLimit",
          search: "subCategorySearch",
        },
        itemNames: {
          page: "itemNamePage",
          limit: "itemNameLimit",
          search: "itemNameSearch",
        },
        varianceNames: {
          page: "varianceNamePage",
          limit: "varianceNameLimit",
          search: "varianceNameSearch",
        },
      };

      const { page, limit: limitKey, search } = map[field];
      const nextPage =
        (currentFilters[page as keyof typeof currentFilters] as number) + 1;

      dispatch(
        fetchRawMaterials({
          params: {
            ...currentFilters,
            [page]: nextPage,
            [limitKey]: currentFilters[limitKey] || 10,
            [search]: currentFilters[search] || "",
            createdDate: todayDate,
          },
          field,
          append: true,
        })
      );

      dispatch(setFilter({ key: page, value: nextPage }));
    },
    [dispatch, currentFilters]
  );

  const handleFilterSearch = useCallback(
    (
      field: "categories" | "subcategories" | "itemNames" | "varianceNames",
      searchTerm: string
    ) => {
      const fieldMapping = {
        categories: {
          page: "categoryPage",
          limit: "categoryLimit",
          search: "categorySearch"
        },
        subcategories: {
          page: "subCategoryPage",
          limit: "subCategoryLimit",
          search: "subCategorySearch"
        },
        itemNames: {
          page: "itemNamePage",
          limit: "itemNameLimit",
          search: "itemNameSearch"
        },
        varianceNames: {
          page: "varianceNamePage",
          limit: "varianceNameLimit",
          search: "varianceNameSearch"
        },
      };

      const { page, limit, search } = fieldMapping[field];
      const pageKey = page as PageKey;
      const limitKey = limit as LimitKey;
      const searchKey = search as SearchKey;

      dispatch(setFilter({ key: pageKey, value: 1 }));
      dispatch(setFilter({ key: searchKey, value: searchTerm }));

      const searchParams = {
        ...currentFilters,
        [pageKey]: 1,
        [limitKey]: currentFilters[limitKey] || 10,
        [searchKey]: searchTerm,
      };

      dispatch(
        fetchRawMaterials({
          params: searchParams,
          field,
          append: false,
          isFilterRequest: true,
        })
      );
    },
    [dispatch, currentFilters]
  );

  // Load next page (pagination)
  const loadNextPage = useCallback(async () => {
    if (loadingRef.current || !hasMore || loading) return;

    loadingRef.current = true;
    const nextPage = currentFilters.page + 1;

    try {
      await dispatch(
        fetchRawMaterials({
          params: {
            ...currentFilters,
            page: nextPage,
            createdDate: todayDate,
          },
          append: true,
          skipCache: true,
        })
      ).unwrap();


      dispatch(setFilter({ key: "page", value: nextPage }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error loading next page";
      dispatch(setEditMessage(message));
      dispatch(setOpenSnackbar(true));
    } finally {
      loadingRef.current = false;
    }
  }, [dispatch, hasMore, currentFilters.page, loading]);


  const loadPreviousPage = useCallback(async () => {
    if (currentFilters.page <= 1 || loadingRef.current || loading) return;
    loadingRef.current = true;

    try {
      const prevPage = currentFilters.page - 1;
      dispatch(setFilter({ key: "page", value: prevPage }));

      await dispatch(
        fetchRawMaterials({
          params: {
            ...currentFilters,
            page: prevPage,
            createdDate: todayDate,
          },
          append: false,
          skipCache: true,
        })
      ).unwrap();

    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Error loading previous page";
      dispatch(setEditMessage(message));
      dispatch(setOpenSnackbar(true));
    } finally {
      loadingRef.current = false;
    }
  }, [dispatch, currentFilters, loading]);

  const mappedRows: TableRowData[] = useMemo(() => {
    return rows.map((item: RawMaterial, index: number) => {
      const change = changes.find((c) => c.randomId === item.randomId);

      return {
        id: item.randomId,
        index: index + 1,
        itemName: item.itemName || "-",
        varianceName: item.varianceName || "-",
        category: item.category || "-",
        subcategory: item.subcategory || "-",
        locationId: currentFilters.locationId || "-",
        systemStockSo: item.systemStockSo || 0,
        systemStock: item.stockQuantity || 0,
        physicalStock:
          change?.newValue !== undefined
            ? change.newValue
            : 0, itemCode: item.itemCode ? String(item.itemCode) : "N/A",
        previousSystemStock: item.previousSystemStock || 0,
        randomId: item.randomId,
      };
    });
  }, [rows, changes, currentFilters.locationId]);

  const handlePhysicalStockChange = useCallback(
    (
      event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      itemName: string,
      varianceName: string,
      randomId: string,
      currentSystemStock: number
    ) => {
      const rawValue = event.target.value;

      // ✅ User cleared the field — remove it from changes entirely
      if (rawValue === "") {
        dispatch(setChanges(changes.filter((c) => c.randomId !== randomId)));
        dispatch(setUpdatedStocks(updatedStocks.filter((c) => c.randomId !== randomId)));
        const updatedChangedRows = { ...changedRows };
        delete updatedChangedRows[randomId];
        dispatch(setChangedRows(updatedChangedRows));
        return;
      }

      const numericValue = Number(rawValue);

      const updatedChange = {
        itemName,
        newValue: numericValue,
        varianceName: varianceName || "N/A",
        randomId,
        systemStock: currentSystemStock,
        locationId: currentFilters.locationId,
      };

      dispatch(
        setChanges(
          changes.some((c) => c.randomId === randomId)
            ? changes.map((c) => (c.randomId === randomId ? updatedChange : c))
            : [...changes, updatedChange]
        )
      );

      dispatch(
        setUpdatedStocks(
          updatedStocks.some((c) => c.randomId === randomId)
            ? updatedStocks.map((c) => (c.randomId === randomId ? updatedChange : c))
            : [...updatedStocks, updatedChange]
        )
      );

      dispatch(setChangedRows({ ...changedRows, [randomId]: true }));
    },
    [dispatch, currentFilters.locationId, changes, updatedStocks, changedRows]
  );

  const handleSubmitClick = useCallback(() => {
    if (changes.length > 0) {
      dispatch(setUpdatedStocks(changes));
      dispatch(setOpenDialog(true));
    } else {
      dispatch(setEditMessage("No changes to submit."));
      dispatch(setOpenSnackbar(true));
    }
  }, [dispatch, changes]);

  const handleConfirmSubmit = useCallback(async () => {
    dispatch(setOpenDialog(false));

    if (changes.length === 0) {
      dispatch(setEditMessage("No changes to submit."));
      dispatch(setOpenSnackbar(true));
      return;
    }

    try {
      if (changes.length === 1) {
        // Single update
        const change = changes[0];

        await dispatch(updateRawMaterialStock({
          randomId: change.randomId,
          warehouseId: currentFilters.locationId,
          physicalStock: change.newValue,
          updatedBy: "",
          description: "",
        })).unwrap();

      } else {
        // Bulk update
        await dispatch(updateRawMaterialsBulk({
          warehouseId: currentFilters.locationId,
          updates: changes.map((c) => ({
            randomId: c.randomId,
            warehouseId: currentFilters.locationId,
            physicalStock: c.newValue,
          })),
        })).unwrap();
      }

      dispatch(setEditMessage("Raw materials updated successfully."));
      dispatch(setChanges([]));
      dispatch(setUpdatedStocks([]));
      dispatch(setChangedRows({}));
      dispatch(resetRawMaterials());

      await dispatch(fetchRawMaterials({
        params: {
          ...currentFilters,
          page: 1,
          includeDropdowns: true,
          createdDate: todayDate,

        },
        skipCache: true,
      })).unwrap();

    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update raw materials.";
      dispatch(setEditMessage(message));
    } finally {
      dispatch(setOpenSnackbar(true));
    }
  }, [dispatch, changes, currentFilters]);


  const handleSnackbarClose = useCallback(
    (event?: React.SyntheticEvent | Event, reason?: string) => {
      if (reason === "clickaway") return;
      dispatch(setOpenSnackbar(false));
    },
    [dispatch]
  );

  const handleCloseModal = useCallback(() => {
    dispatch(setOpenModal(false));
  }, [dispatch]);

  const handleRefreshData = useCallback(async () => {
  if (!currentFilters.locationId) return; // optional check

  try {
    dispatch(resetRawMaterials()); // optional: clear previous data if needed
    await dispatch(
      fetchRawMaterials({
        params: {
          ...currentFilters,
          page: 1, // or keep current page if you prefer
          includeDropdowns: true,
          createdDate: todayDate,
        },
        skipCache: true,
        append: false,
      })
    ).unwrap();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Error refreshing raw materials";
    dispatch(setEditMessage(message));
    dispatch(setOpenSnackbar(true));
  }
}, [dispatch, currentFilters, todayDate]);

  const handleDownloadCSV = useCallback(() => {
    if (!currentFilters.locationId) {
      dispatch(setEditMessage("Please select a warehouse first."));
      dispatch(setOpenSnackbar(true));
      return;
    }



    dispatch(

      downloadExportCSV({
        locationId: currentFilters.locationId,
        aliasName: currentFilters.aliasName,
        purchasecategoryName: Array.isArray(currentFilters.purchasecategoryName)
          ? currentFilters.purchasecategoryName.join(',')
          : currentFilters.purchasecategoryName,
        purchasesubcategoryName: Array.isArray(currentFilters.purchasesubcategoryName)
          ? currentFilters.purchasesubcategoryName.join(',')
          : currentFilters.purchasesubcategoryName,
        itemName: Array.isArray(currentFilters.itemName)
          ? currentFilters.itemName.join(',')
          : currentFilters.itemName,
        varianceName: Array.isArray(currentFilters.varianceName)
          ? currentFilters.varianceName.join(',')
          : currentFilters.varianceName,
      })


    );
  }, [dispatch, currentFilters]);

  const handleDownloadSampleCSV = useCallback(() => {
    dispatch(downloadSampleCSV());
  }, [dispatch]);

  const handleImportCSV = useCallback(async (file: File) => {
    if (!currentFilters.locationId) {
      dispatch(setEditMessage("Please select a warehouse first."));
      dispatch(setOpenSnackbar(true));
      return;
    }

    try {
      await dispatch(
        importRawMaterialStock({
          file,
          locationId: currentFilters.locationId,
          updated_by: "",
        })
      ).unwrap();

      dispatch(setEditMessage("CSV imported successfully."));
      dispatch(setOpenSnackbar(true));

      // Refresh data
      dispatch(resetRawMaterials());
      await dispatch(
        fetchRawMaterials({
          params: {
            ...currentFilters,
            page: 1,
            createdDate: todayDate,

            includeDropdowns: true
          },
          skipCache: true,
          append: false,
        })
      ).unwrap();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Failed to import CSV";
      dispatch(setEditMessage(message));
      dispatch(setOpenSnackbar(true));
    }
  }, [dispatch, currentFilters]);

  const downloadPDF = useCallback(() => {
    if (updatedStocks.length === 0) {
      dispatch(setEditMessage("No updated stock data to download."));
      dispatch(setOpenSnackbar(true));
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Updated Raw Materials", 14, 16);

    const tableData = updatedStocks.map((stock) => [
      stock.itemName || "N/A",
      stock.varianceName || "N/A",
      stock.locationId || "N/A",
      stock.systemStock.toString(),
      stock.newValue.toString(),
    ]);

    autoTable(doc, {
      head: [["Item Name", "Variance", "Warehouse", "System Stock", "Physical Stock"]],
      body: tableData,
      startY: 20,
      styles: { fontSize: 10, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    doc.save(`updated_raw_materials_${currentFilters.locationId || "all"}.pdf`);
  }, [dispatch, updatedStocks, currentFilters.locationId]);

  const downloadExcel = useCallback(() => {
    if (updatedStocks.length === 0) {
      dispatch(setEditMessage("No updated stock data to download."));
      dispatch(setOpenSnackbar(true));
      return;
    }

    const formattedData = updatedStocks.map((stock) => ({
      "Item Name": stock.itemName || "N/A",
      Variance: stock.varianceName || "N/A",
      Warehouse: stock.locationId || "N/A",
      "System Stock": stock.systemStock,
      "Physical Stock": stock.newValue,
    }));

    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Updated Raw Materials");
    XLSX.writeFile(wb, `updated_raw_materials_${currentFilters.locationId || "all"}.xlsx`);
  }, [dispatch, updatedStocks, currentFilters.locationId]);

  const normalizeToArray = (value?: string | string[]): string[] | undefined => {
    if (!value) return undefined;
    if (typeof value === "string") return [value];
    return value;
  };

  const normalizedFilters = {
    ...currentFilters,
    purchasecategoryName: normalizeToArray(currentFilters.purchasecategoryName),
    purchasesubcategoryName: normalizeToArray(currentFilters.purchasesubcategoryName),
    itemName: normalizeToArray(currentFilters.itemName),
    varianceName: normalizeToArray(currentFilters.varianceName),
  };

  const formattedFilterOptions = useMemo(
    () => ({
      categories: filterOptions?.categories?.values || [],
      subcategories: filterOptions?.subcategories?.values || [],
      itemNames: filterOptions?.itemNames?.values || [],
      varianceNames: filterOptions?.varianceNames?.values || [],
      warehouses: Array.isArray(warehouses)
        ? warehouses.map((w) => ({
          label: `${w.locationName} (${w.aliasName})`, // 👈 show both in dropdown
          value: w.locationId,
          aliasName: w.aliasName, // 👈 keep alias separately
        }))
        : [],
    }),
    [filterOptions, warehouses]
  );

if (!canRead) {
  return <div>No Permission</div>;
}
  return (
    <Box>
      <WarehouseInventoryManagementPage />

      <FilterBar
handleRefreshData={handleRefreshData}
        todayDate={todayDate}
        onClearAll={handleClearAllFilters}
        searchParams={normalizedFilters}
        onSearchChange={handleSearchChange}
        setOpenDownloadDialog={(value) => dispatch(setOpenDownloadDialog(value))}
        filterOptions={formattedFilterOptions}
        onFilterScrollBottom={handleFilterScrollBottom}
        onFilterSearch={handleFilterSearch}
        warehousesLoading={warehousesLoading}
        onDownloadCSV={handleDownloadCSV}
        onDownloadSampleCSV={handleDownloadSampleCSV}
        onImportCSV={canAdd ? handleImportCSV : undefined}
      />

      <DataTable
        inputRefs={inputRefs}
        tableContainerRef={tableContainerRef}
        rows={mappedRows}
        onPhysicalStockChange={handlePhysicalStockChange}
        loading={loading}
        hasMore={hasMore}
        onScrollBottom={handleTableScrollBottom}
        changedRows={changedRows}
        canEdit={canEdit}
      />
      
        {!isInitialLoading && total > 0 && canEdit && (
        <PaginationControls
          currentPage={currentPage}
          totalItems={total}
          totalPages={totalPages}
          hasMoreData={hasMore}
          loading={loading}
          startItem={startItem}
          endItem={endItem}
          onPreviousPage={loadPreviousPage}
          onNextPage={loadNextPage}
          onSubmitClick={handleSubmitClick}
        />
        )}
      


      <ConfirmDialog
        open={openDialog}
        totalItems={total}
        changes={changes}
        onClose={() => dispatch(setOpenDialog(false))}
        onConfirm={handleConfirmSubmit}
      />

      <FeedbackSnackbar
        open={openSnackbar}
        message={editMessage}
        onClose={handleSnackbarClose}
      />

      <UpdatedStocksModal
        open={openModal}
        updatedStocks={updatedStocks}
        onClose={handleCloseModal}
        onDownloadPDF={downloadPDF}
        onDownloadExcel={downloadExcel}
      />

      <DownloadDialog
        open={openDownloadDialog}
        onClose={() => dispatch(setOpenDownloadDialog(false))}
        onDownloadPDF={downloadPDF}
        onDownloadCSV={downloadExcel}
      />
    </Box>
  );
};

export default WarehousePhysicalStockModification;