"use client";
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { usePermissions } from '../../../../hooks/usePermissions';

import { Box } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchBranches,
  fetchItems,
  importItems,
  setFilter,
  setMultipleFilters,
  resetItems,
  clearError,
  selectBranches,
  selectItems,
  selectDataLoading,
  selectFilters,
  selectFilteredItems,
  selectHasMore,
  updateStock,
  toggleColumn,
  downloadCSV,
  downloadSampleCSV,
  updateStockBulk,
} from "../../../../features/yen_inventory/OuletePhysicalStockSlice";
import { AppDispatch } from "@/redux/store";
import OutletsInventoryManagementPage from "../page";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import FilterBar from "../../../../components/Inventory/physicalstockmodifcation/filterBar";
import DataTable, { Row } from "../../../../components/Inventory/physicalstockmodifcation/dataTable";
import PaginationControls from "../../../../components/Inventory/physicalstockmodifcation/paginationcontrol";
import ConfirmDialog from "../../../../components/Inventory/physicalstockmodifcation/confirmDailog";
import FeedbackSnackbar from "../../../../components/Inventory/physicalstockmodifcation/feedbackSnakbar";
import UpdatedStocksModal from "../../../../components/Inventory/physicalstockmodifcation/updateStockModel";
import DownloadDialog from "@/components/Inventory/physicalstockmodifcation/downloadfile";
import { AxiosError } from "axios";
import { useTodayDate } from "@/components/Hooks/useTodayDate";

interface SearchParams {
  itemName: string[];
  varianceName: string[];
  category: string[];
  subCategory: string[];
  location: string[];
}

export interface TableRow {
  index?: number;
  itemCode: string;
  category: string;
  subcategory: string;
  itemName: string;
  varianceName: string;
  closingQty: string;
  systemStock?: number;
  systemstockSo?: number;
  physicalStock?: number;
  previousSystemStock?: number;
}

const OutletPhysicalStockModification: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { hasPermission, isModuleVisible } = usePermissions();
  const canRead = hasPermission("yenerp", "physicalstockmodification", "read");
  const canAdd = hasPermission("yenerp", "physicalstockmodification", "add");
  const canEdit = hasPermission("yenerp", "physicalstockmodification", "edit");
  const canHide = hasPermission("yenerp", "physicalstockmodification", "hide");

  const branches = useSelector(selectBranches);
  const filteredItems = useSelector(selectFilteredItems);
  const items = useSelector(selectItems);
  const filters = useSelector(selectFilters);
  const loading = useSelector(selectDataLoading);
  const hasMoreData = useSelector(selectHasMore);

  const { page, limit } = filters;

  const total = filteredItems?.total || 0;
  const totalPages = Math.ceil(total / limit);
  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(startItem + limit - 1, total);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isInitializedRef = useRef(false);
  const prevBranchesLengthRef = useRef(0);
  const skipNextSearchRef = useRef(false);
  const todayDate = useTodayDate();
  const [resetInputs, setResetInputs] = useState(false);


  const [searchParams, setSearchParams] = useState<SearchParams>(() => ({
    itemName: filters.itemName ? filters.itemName.split(",") : [],
    varianceName: filters.varianceName ? filters.varianceName.split(",") : [],
    category: filters.category ? filters.category.split(",") : [],
    subCategory: filters.subCategory ? filters.subCategory.split(",") : [],
    location: filters.branch ? [filters.branch] : [],
  }));


  const [selectedBranches, setSelectedBranches] = useState<string>("");
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [openDownloadDialog, setOpenDownloadDialog] = useState(false);
  const [editMessage, setEditMessage] = useState("");

  const [changes, setChanges] = useState<
    {
      itemName: string;
      locationId: string;
      newValue: number;
      varianceName: string;
      itemCode: string;
    }[]
  >([]);

  const [openDialog, setOpenDialog] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [updatedStocks, setUpdatedStocks] = useState<
    {
      itemName: string;
      locationId: string;
      newValue: number;
      varianceName: string;
      itemCode: string;
    }[]
  >([]);

  const isInitialLoading = loading && total === 0;



  // Fetch branches
  useEffect(() => {
    if (branches.length === 0) {
      dispatch(fetchBranches());
    }
  }, [dispatch, branches.length]);

  // Set default branch
  useEffect(() => {
    if (!todayDate) return; // ✅ WAIT FOR DATE

    if (branches.length > 0 && prevBranchesLengthRef.current === 0 && !isInitializedRef.current) {
      const defaultBranch = branches[0].locationId;
      setSelectedBranches(defaultBranch);

      dispatch(
        setMultipleFilters({
          branch: defaultBranch,
          date: todayDate,
        })
      );

      isInitializedRef.current = true;
      prevBranchesLengthRef.current = branches.length;
    } else if (branches.length > prevBranchesLengthRef.current) {
      prevBranchesLengthRef.current = branches.length;
    }
  }, [branches, dispatch, todayDate]);




  // 🔥 Load filter options ONLY once
  useEffect(() => {
    if (!todayDate || !selectedBranches) return;

    dispatch(
      fetchItems({
        params: {
          branch: selectedBranches,
          date: todayDate,
          include_filter_options: true,
        },
        append: false,
        skipCache: true,
      })
    );
  }, [dispatch, todayDate, selectedBranches]);


  // Utility
  const arrayToCSV = (arr: string[]) =>
    arr.length > 0 ? arr.map((s) => s.trim()).join(",") : undefined;

  // Search
  const handleSearch = useCallback(async () => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }

    if (!selectedBranches || selectedBranches.length === 0) {
      setEditMessage("Please select a branch before searching.");
      setOpenSnackbar(true);
      return;
    }

    if (loadingRef.current) return;
    loadingRef.current = true;

    dispatch(resetItems());

    const filterUpdates: Partial<typeof filters> = {
      page: 1,
      date: todayDate,
      branch: selectedBranches,
      category: arrayToCSV(searchParams.category),
      subCategory: arrayToCSV(searchParams.subCategory),
      itemName: arrayToCSV(searchParams.itemName),
      varianceName: arrayToCSV(searchParams.varianceName),
    };

    dispatch(setMultipleFilters(filterUpdates));

    try {
      await dispatch(
        fetchItems({
          params: {
            ...filterUpdates,
            include_filter_options: false,
          },
          append: false,
          page: 1,
          skipCache: true,
        })
      ).unwrap();
    } catch (error) {
      let message = "Error searching data. Please try again.";

      if (error instanceof AxiosError) {
        message = error.response?.data?.message || error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }

      setEditMessage(message);
      setOpenSnackbar(true);
    } finally {
      loadingRef.current = false;
    }
  }, [
    selectedBranches,
    searchParams,
    todayDate,
    dispatch,

  ]);

  const handleSearchChange = useCallback(
    (field: keyof SearchParams, value: string[] | string) => {
      const newValue = Array.isArray(value) ? value : [value];

      setSearchParams((prev) => {
        const prevValue = prev[field];

        // Shallow compare arrays to prevent redundant updates
        const isSame =
          prevValue.length === newValue.length &&
          prevValue.every((v, i) => v === newValue[i]);

        if (isSame) {
          return prev; // No change → skip state update
        }

        return {
          ...prev,
          [field]: newValue,
        };
      });

      // Only reset items if actual change occurred
      if (newValue.length > 0) {
        dispatch(resetItems());
      }
    },
    [dispatch]
  );

  useEffect(() => {
    if (!isInitializedRef.current) return;

    const timeout = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => clearTimeout(timeout);

  }, [
    searchParams.category,
    searchParams.subCategory,
    searchParams.itemName,
    searchParams.varianceName,
    selectedBranches,
  ]);


  const loadNextPage = useCallback(async () => {
    if (loadingRef.current || !hasMoreData || loading) return;
    loadingRef.current = true;
    try {
      const nextPage = page + 1;
      await dispatch(
        fetchItems({
          append: true,
          page: nextPage,
          params: {
            category: arrayToCSV(searchParams.category),
            subCategory: arrayToCSV(searchParams.subCategory),
            itemName: arrayToCSV(searchParams.itemName),
            varianceName: arrayToCSV(searchParams.varianceName),
            branch: selectedBranches,
          },
        })
      ).unwrap();
    } catch (error: unknown) {
      let message = "Error loading next page";
      if (error instanceof AxiosError)
        message = error.response?.data?.message || error.message;
      else if (error instanceof Error) message = error.message;
      setEditMessage(message);
      setOpenSnackbar(true);
    } finally {
      loadingRef.current = false;
    }
  }, [dispatch, hasMoreData, loading, page, searchParams, selectedBranches]);

  const loadPreviousPage = useCallback(async () => {
    if (loadingRef.current || loading || page <= 1) return;
    loadingRef.current = true;
    try {
      const prevPage = Math.max(1, page - 1);
      dispatch(resetItems());
      await dispatch(
        fetchItems({
          append: false,
          page: prevPage,
          params: {
            category: arrayToCSV(searchParams.category),
            subCategory: arrayToCSV(searchParams.subCategory),
            itemName: arrayToCSV(searchParams.itemName),
            varianceName: arrayToCSV(searchParams.varianceName),
            branch: selectedBranches,
          },
        })
      ).unwrap();
      tableContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error: unknown) {
      let message = "Error loading previous page";
      if (error instanceof AxiosError)
        message = error.response?.data?.message || error.message;
      else if (error instanceof Error) message = error.message;
      setEditMessage(message);
      setOpenSnackbar(true);
    } finally {
      loadingRef.current = false;
    }
  }, [dispatch, page, loading, searchParams, selectedBranches]);

  const handleScroll = useCallback(() => {
    if (!tableContainerRef.current || loadingRef.current || !hasMoreData || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = tableContainerRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 200) loadNextPage();
  }, [hasMoreData, loading, loadNextPage]);

  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;
    let timeoutId: NodeJS.Timeout | null = null;
    const throttled = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        handleScroll();
        timeoutId = null;
      }, 200);
    };
    container.addEventListener("scroll", throttled, { passive: true });
    return () => {
      container.removeEventListener("scroll", throttled);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [handleScroll]);
  const handleBranchChange = useCallback(
    (value: string | string[]) => {
      const branch = Array.isArray(value) ? value[0] : value;
      if (branch === selectedBranches) return;
      skipNextSearchRef.current = true;

      setSelectedBranches(branch);
      dispatch(setFilter({ key: "branch", value: branch }));

      // Only fetch items for the new branch without clearing filters
      handleSearch();
    },
    [selectedBranches, dispatch]
  );

  const handleImportFile = useCallback(
    async (file: File) => {
      if (!selectedBranches) {
        setEditMessage("Please select a branch before importing.");
        setOpenSnackbar(true);
        return;
      }

      try {
        await dispatch(importItems({ file, branchAlias: selectedBranches })).unwrap();
        setEditMessage("Items imported successfully.");
        setOpenSnackbar(true);

        // Refetch items after successful import
        await dispatch(
          fetchItems({
            params: {
              ...filters,
              page: 1,
              category: arrayToCSV(searchParams.category),
              subCategory: arrayToCSV(searchParams.subCategory),
              itemName: arrayToCSV(searchParams.itemName),
              varianceName: arrayToCSV(searchParams.varianceName),
              branch: selectedBranches,
            },
            append: false,
            skipCache: true,
          })
        ).unwrap();
      } catch (error: unknown) {
        let message = "Import failed. Please try again.";
        if (error instanceof AxiosError) {
          message = error.response?.data?.message || error.message;
        } else if (error instanceof Error) {
          message = error.message;
        }
        setEditMessage(message);
        setOpenSnackbar(true);
      }
    },
    [dispatch, filters, searchParams, selectedBranches]
  );

  // mappedRows — UPDATED
  const mappedRows: Row[] = useMemo(() => {
   return items.map((item: any, index: number) => ({
      index: (page - 1) * limit + index + 1,

      itemCode: item.itemCode || "N/A",

      category: item.category?.name ?? "-",
      subcategory: item.subCategory?.name ?? "-",
      itemName: item.itemName?.name ?? "-",
      varianceName: item.varianceName?.name ?? "N/A",

      closingQty: item.closingQty ?? "0",

      systemStock: item.systemStock ?? 0,
      systemStockSo: item.systemStockSo ?? 0,
      physicalStock: item.physicalStock ?? 0,
      previousSystemStock: item.previousSystemStock ?? 0,
    }));
  }, [items, page, limit]);

  // Physical stock change
  const handlePhysicalStockChange = useCallback(
    (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      itemName: string,
      varianceName: string,
      locationId: string,
      itemCode: string
    ) => {
      const rawValue = event.target.value;

      // ✅ If user cleared the field, REMOVE it from changes entirely
      if (rawValue === "") {
        setChanges((prev) =>
          prev.filter(
            (c) =>
              !(
                c.itemCode === itemCode &&
                c.itemName === itemName &&
                c.varianceName === varianceName &&
                c.locationId === locationId
              )
          )
        );
        setUpdatedStocks((prev) =>
          prev.filter(
            (c) =>
              !(
                c.itemCode === itemCode &&
                c.itemName === itemName &&
                c.varianceName === varianceName &&
                c.locationId === locationId
              )
          )
        );
        return; // ✅ Stop here — don't add 0
      }

      const numericValue = Number(rawValue);

      const updatedChange = {
        itemName,
        locationId,
        newValue: numericValue,
        varianceName: varianceName || "N/A",
        itemCode,
      };

      setChanges((prev) => {
        const idx = prev.findIndex(
          (c) =>
            c.itemCode === itemCode &&
            c.itemName === itemName &&
            c.varianceName === varianceName &&
            c.locationId === locationId
        );
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = updatedChange;
          return copy;
        }
        return [...prev, updatedChange];
      });

      setUpdatedStocks((prev) => {
        const idx = prev.findIndex(
          (c) =>
            c.itemCode === itemCode &&
            c.itemName === itemName &&
            c.varianceName === varianceName &&
            c.locationId === locationId
        );
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = updatedChange;
          return copy;
        }
        return [...prev, updatedChange];
      });
    },
    []
  );
  // Submit
  const handleSubmitClick = useCallback(() => {
    if (!canEdit) return;
    if (changes.length > 0) {
      setUpdatedStocks(changes);
      setOpenDialog(true);
    } else {
      setEditMessage("No changes to submit.");
      setOpenSnackbar(true);
    }
  }, [changes, canEdit]);

  const handleConfirmSubmit = useCallback(async () => {
    setOpenDialog(false);

    try {
      if (changes.length === 0) {
        setEditMessage("No changes to submit.");
        setOpenSnackbar(true);
        return;
      }

      const updates = changes.map((change) => ({
        itemCode: change.itemCode,
        locationId: change.locationId,
        physical_stock: change.newValue,
      }));

      await dispatch(
        updateStockBulk({
          updates,
          updatedBy: "",
          description: "B",
        })
      ).unwrap();

      setEditMessage("Stock updated successfully.");
      setOpenSnackbar(true);

      setChanges([]);
      setUpdatedStocks([]);
      setResetInputs(true);

      setTimeout(() => setResetInputs(false), 50);

      await dispatch(
        fetchItems({
          params: {
            ...filters,
            page: 1,
            category: arrayToCSV(searchParams.category),
            subCategory: arrayToCSV(searchParams.subCategory),
            itemName: arrayToCSV(searchParams.itemName),
            varianceName: arrayToCSV(searchParams.varianceName),
            branch: selectedBranches,
          },
          append: false,
          skipCache: true,
        })
      ).unwrap();
    } catch (error: unknown) {
      let message = "Error submitting stock updates.";
      if (error instanceof AxiosError) {
        message = error.response?.data?.message || error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }

      setEditMessage(message);
      setOpenSnackbar(true);
    }
  }, [dispatch, changes, searchParams, filters, selectedBranches]);

  // Snackbar & Modal
  const handleSnackbarClose = useCallback(
    (event?: React.SyntheticEvent | Event, reason?: string) => {
      if (reason === "clickaway") return;
      setOpenSnackbar(false);
      dispatch(clearError());
    },
    [dispatch]
  );

  const handleRefresh = useCallback(async () => {
    if (!selectedBranches) {
      setEditMessage("Please select a branch before refreshing.");
      setOpenSnackbar(true);
      return;
    }

    try {
      loadingRef.current = true;

      dispatch(resetItems());

      await dispatch(
        fetchItems({
          params: {
            page: 1,
            date: todayDate,
            branch: selectedBranches,
            category: arrayToCSV(searchParams.category),
            subCategory: arrayToCSV(searchParams.subCategory),
            itemName: arrayToCSV(searchParams.itemName),
            varianceName: arrayToCSV(searchParams.varianceName),
            include_filter_options: false,
          },
          append: false,
          skipCache: true, // 🔥 forces fresh API call
        })
      ).unwrap();
    } catch (error: unknown) {
      let message = "Error refreshing data.";
      if (error instanceof AxiosError) {
        message = error.response?.data?.message || error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      setEditMessage(message);
      setOpenSnackbar(true);
    } finally {
      loadingRef.current = false;
    }
  }, [dispatch, selectedBranches, todayDate, searchParams]);

  const handleCloseModal = useCallback(() => setOpenModal(false), []);

  const downloadPDF = useCallback(() => {
    if (updatedStocks.length === 0) {
      setEditMessage("No updated stock data available to download.");
      setOpenSnackbar(true);
      return;
    }
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString();
    doc.setFontSize(18);
    doc.text("Updated Physical Stock Report", 14, 20);
    doc.setFontSize(11);
    doc.text(`Generated on: ${timestamp}`, 14, 28);
    doc.text(`Total Items Updated: ${updatedStocks.length}`, 14, 35);
    const tableData = updatedStocks.map((stock) => [
      stock.itemName || "N/A",
      stock.varianceName || "N/A",
      stock.locationId || "N/A",
      stock.newValue !== undefined ? stock.newValue.toString() : "0",
    ]);
    autoTable(doc, {
      startY: 42,
      head: [["Item Name", "Variance", "Branch Name", "New Value"]],
      body: tableData,
      styles: { fontSize: 10, cellPadding: 2 },
      headStyles: { fillColor: [63, 81, 181], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 },
    });
    doc.save("updated_stocks_report.pdf");
  }, [updatedStocks]);

  const downloadExcel = useCallback(() => {
    if (updatedStocks.length === 0) {
      setEditMessage("No updated stock data available to download.");
      setOpenSnackbar(true);
      return;
    }
    const formattedData = updatedStocks.map((stock) => ({
      "Item Name": stock.itemName || "N/A",
      Variance: stock.varianceName || "N/A",
      "Branch Name": stock.locationId || "N/A",
      "New Value": stock.newValue !== undefined ? stock.newValue : 0,
    }));
    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Updated Stocks");
    XLSX.writeFile(wb, "updated_stocks.xlsx");
  }, [updatedStocks]);


  const handleDownload = () => {
    dispatch(downloadCSV({
      selectedBranches: selectedBranches,
      searchParams
    }))
      .unwrap()
      .catch(err => {
        setEditMessage(err);
        setOpenSnackbar(true);
      });
  };


  const handleDownloadSampleCSV = () => {
    dispatch(downloadSampleCSV());
  };
// ✅ ADD BEFORE RETURN

if (canHide) return null;

if (!canRead) {
  return <div>No Permission</div>;
}
  return (
    <Box>
      <OutletsInventoryManagementPage />
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "nowrap", overflowX: "auto" }}>
        <FilterBar
          skipNextSearchRef={skipNextSearchRef}
          onRefresh={handleRefresh}
          todayDate={todayDate}
          searchParams={searchParams}
          onSearchChange={handleSearchChange}
          branches={branches}
          selectedBranches={selectedBranches}
          onBranchChange={handleBranchChange}
          setOpenDownloadDialog={setOpenDownloadDialog}
          handleDownloadCSV={handleDownload}
          onToggleColumn={(column) => dispatch(toggleColumn(column))}
          handleDownloadSampleCSV={handleDownloadSampleCSV}
          onImportFile={canAdd ? handleImportFile : undefined}
        

        />
      </Box>

      <Box>
        <DataTable
          resetInputs={resetInputs}
          inputRefs={inputRefs}
          tableContainerRef={tableContainerRef}
          rows={mappedRows}
          selectedBranches={selectedBranches}
          canEdit={canEdit}
          onPhysicalStockChange={handlePhysicalStockChange}
          loading={loading}
        />
      </Box>

      {!isInitialLoading && total > 0 && canEdit && (
        <Box>
          <PaginationControls
            currentPage={page}
            totalItems={total}
            totalPages={totalPages}
            hasMoreData={hasMoreData}
            loading={loading}
            startItem={startItem}
            endItem={endItem}
            onPreviousPage={loadPreviousPage}
            onNextPage={loadNextPage}
            onSubmitClick={handleSubmitClick}
          />
        </Box>
      )}

      <ConfirmDialog
        open={openDialog}
        totalItems={total}
        changes={changes}
        onClose={() => setOpenDialog(false)}
        onConfirm={handleConfirmSubmit}
      />
      <FeedbackSnackbar open={openSnackbar} message={editMessage} onClose={handleSnackbarClose} />
      <UpdatedStocksModal open={openModal} updatedStocks={updatedStocks} onClose={handleCloseModal} onDownloadPDF={downloadPDF} onDownloadExcel={downloadExcel} />
      <DownloadDialog open={openDownloadDialog} onClose={() => setOpenDownloadDialog(false)} onDownloadPDF={downloadPDF} onDownloadCSV={downloadExcel} />
    </Box>
  );
};

export default OutletPhysicalStockModification;
