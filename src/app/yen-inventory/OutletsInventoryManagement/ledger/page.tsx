'use client';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';

import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableContainer,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Dialog,
  DialogTitle,
  DialogActions,
  CircularProgress,
  Stack
} from '@mui/material';

import FilterAltIcon from '@mui/icons-material/FilterAlt';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import DownloadIcon from '@mui/icons-material/Download';
import { useRouter } from "next/navigation"; // ✅ ADD
import { usePermissions } from "@/hooks/usePermissions"; // ✅ ADD
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/redux/store';
import moment from 'moment';
import { startOfMonth, endOfDay } from 'date-fns';
import DateRangeDialog from '../../../../components/Inventory/ledger/daterangeDialog';
import CollapsibleFilter from '@/components/Inventory/physcialstockvarience/ui/collabsfiler';
import { debounce } from 'lodash';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import {
  fetchStockLedger,
  searchPurchaseItems,
  addSelectedItem,
  removeSelectedItem,
  clearStockLedger,
  clearSearchResults,
  clearSelectedItems,
  setSearchQuery,
  selectStockLedgers,
  selectStockLoading,
  selectSearchResults,
  selectSearchLoading,
  selectSelectedItems,
  exportStockLedgerExcel,
  selectSearchQuery,
  searchBranches,
  setBranchSearchQuery,
  addSelectedBranch,
  clearSelectedBranches,
  fetchAllPurchaseItems,
} from '../../../../features/yen_inventory/ledgeroutletSlice';
import { selectBusinesses } from '@/features/businessSlice';
import { convertImageToBase64 } from '@/components/Hooks/useTodayDate';

import OutletsInventoryManagementPage from '../page';
import DownloadDialog from '@/components/Inventory/ledger/ConfirmDialog';

const StockSummaryPage = () => {
   const router = useRouter();
  const { hasPermission } = usePermissions();

  const canRead = hasPermission("yenerp", "stockledger", "read");

  useEffect(() => {
    if (!canRead) {
      router.replace("/unauthorized"); // 👉 illa na "/" use pannalaam
    }
  }, [canRead, router]);

  if (!canRead) return null;
  /* ✅ RBAC END */

  const dispatch = useDispatch<AppDispatch>();

  const stockLedgers = useSelector(selectStockLedgers);
  const loading = useSelector(selectStockLoading);
  const searchResults = useSelector(selectSearchResults);
  const { businesses } = useSelector(selectBusinesses);
  const business = businesses?.[0]; const searchLoading = useSelector(selectSearchLoading);
  const selectedItems = useSelector(selectSelectedItems);
  const searchQuery = useSelector(selectSearchQuery);

  const branchSelected = useSelector((state: RootState) => state.stockSummaryOutlet.branchSelected);
  const branchSearchResults = useSelector((state: RootState) => state.stockSummaryOutlet.branchSearchResults);
  const branchSearchLoading = useSelector((state: RootState) => state.stockSummaryOutlet.branchSearchLoading);
  const branchSearchQuery = useSelector((state: RootState) => state.stockSummaryOutlet.branchSearchQuery);
  const branchCurrentPage = useSelector((state: RootState) => state.stockSummaryOutlet.branchCurrentPage);
  const branchHasMore = useSelector((state: RootState) => state.stockSummaryOutlet.branchHasMore);

  const currentPage = useSelector((state: RootState) => state.stockSummaryOutlet.currentPage);
  const hasMore = useSelector((state: RootState) => state.stockSummaryOutlet.hasMore);

  const [openDialog, setOpenDialog] = useState(false);
  const debouncedSearchRef = useRef<any>(null);
  const debouncedBranchSearchRef = useRef<any>(null);
  const isFetchingRef = useRef(false);

  const today = new Date();
  const [selectionRange, setSelectionRange] = useState({
    startDate: startOfMonth(today),
    endDate: endOfDay(today),
    key: 'selection',
  });

  const headerStyle = {
    fontWeight: 700,
    bgcolor: '#f1f5f9',
    color: '#475569',
    fontSize: '0.85rem',
    textTransform: 'uppercase',
    py: 1.5,
    borderBottom: '2px solid #e2e8f0'
  };

  useEffect(() => {
    dispatch(searchPurchaseItems({ page: 1, limit: 20 }));
    dispatch(searchBranches({ search: "", page: 1, limit: 50 }));

    debouncedSearchRef.current = debounce((term: string) => {
      dispatch(searchPurchaseItems({ search: term, page: 1, limit: 20 }));
    }, 400);

    debouncedBranchSearchRef.current = debounce((term: string) => {
      dispatch(searchBranches({ search: term, page: 1, limit: 50 }));
    }, 400);

    return () => {
      debouncedSearchRef.current?.cancel();
      debouncedBranchSearchRef.current?.cancel();
    };
  }, [dispatch]);

  const handleSearchChange = (value: string) => {
    dispatch(setSearchQuery(value));
    dispatch(clearSearchResults());
    debouncedSearchRef.current?.(value);
  };


  const handleItemSelectionChange = (selected: string[]) => {
    selectedItems
      .filter((item) => !selected.includes(item))
      .forEach((item) => dispatch(removeSelectedItem(item)));

    selected
      .filter((item) => !selectedItems.includes(item))
      .forEach((item) => dispatch(addSelectedItem(item)));
  };


  const handleScrollBottom = useCallback(() => {
    if (searchLoading || !hasMore || isFetchingRef.current) return;
    isFetchingRef.current = true;
    dispatch(searchPurchaseItems({ search: searchQuery, page: currentPage + 1, limit: 20 }))
      .finally(() => { isFetchingRef.current = false; });
  }, [dispatch, currentPage, searchLoading, hasMore, searchQuery]);

  const handleBranchSearchChange = (value: string) => {
    dispatch(setBranchSearchQuery(value));
    debouncedBranchSearchRef.current?.(value);
  };

  const handleBranchScrollBottom = () => {
    if (branchSearchLoading || !branchHasMore) return;
    dispatch(searchBranches({ search: branchSearchQuery, page: branchCurrentPage + 1, limit: 50 }));
  };

  const handleFilterClick = () => {
    if (selectedItems.length === 0 || branchSelected.length === 0) return;

    dispatch(fetchStockLedger({
      fromDate: moment(selectionRange.startDate).format('YYYY-MM-DD'),
      toDate: moment(selectionRange.endDate).format('YYYY-MM-DD'),
      itemCode: selectedItems,
      locationId: branchSelected[0],
    }));
  };

  const handleFilterClose = () => {
    dispatch(clearStockLedger());
    dispatch(clearSelectedItems());
    dispatch(clearSelectedBranches());
    dispatch(clearSearchResults());
    dispatch(setSearchQuery(""));

    // 👇 IMPORTANT: re-fetch first page items
    dispatch(searchPurchaseItems({ page: 1, limit: 20 }));
  };

  const displayValue = (value?: number) => {
    return (Number(value) || 0).toFixed(2);
  };

  const formatNumber = (value?: number) => {
    return (Number(value) || 0).toFixed(2);
  };

  const handleDownloadPDF = async () => {
    if (!stockLedgers || stockLedgers.length === 0) return;

    const PRIMARY_BLUE: [number, number, number] = [25, 118, 210];
    const LIGHT_BLUE_BG: [number, number, number] = [235, 245, 255];
    const DARK_TEXT: [number, number, number] = [40, 40, 40];

    const doc = new jsPDF("p", "mm", "a4");

    const formatNumber = (value?: number) =>
      (Number(value) || 0).toFixed(2);

    // Get selected branch
    const selectedBranch = branchSearchResults.find(
      (b) => b.locationId === branchSelected[0]
    );

    const branchDisplayName = selectedBranch
      ? `${selectedBranch.locationName} (${selectedBranch.aliasName})`
      : "All Locations";

    // Convert Logo
    let logo = "";
    if (business?.imageUrl) {
      try {
        logo = await convertImageToBase64(business.imageUrl);
      } catch { }
    }

    stockLedgers.forEach((ledger, index) => {
      if (index > 0) doc.addPage();

      /* ================= HEADER BANNER ================= */

      doc.setFillColor(245, 247, 250);
      doc.rect(0, 0, 210, 35, "F");

      if (logo) doc.addImage(logo, "PNG", 14, 8, 25, 12);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...DARK_TEXT);
      doc.text(business?.companyName || "Company Name", 45, 14);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`${business?.address1 || ""} ${business?.address2 || ""}`, 45, 19);
      doc.text(`GSTIN: ${business?.gstIn || "-"}`, 45, 23);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...PRIMARY_BLUE);
      doc.text("STOCK LEDGER REPORT", 196, 14, { align: "right" });

      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(
        `Period: ${moment(selectionRange.startDate).format("DD-MM-YYYY")} to ${moment(selectionRange.endDate).format("DD-MM-YYYY")}`,
        196,
        20,
        { align: "right" }
      );
      doc.text(`Location: ${branchDisplayName}`, 196, 25, { align: "right" });

      /* ================= ITEM INFO BOX ================= */

      doc.setDrawColor(200);
      doc.line(14, 38, 196, 38);

      doc.setFontSize(10);
      doc.setTextColor(...PRIMARY_BLUE);
      doc.setFont("helvetica", "bold");
      doc.text(`Item: ${ledger.varianceName}`, 14, 45);

      doc.setFillColor(...LIGHT_BLUE_BG);
      doc.rect(14, 48, 182, 10, "F");

      doc.setFontSize(9);
      doc.setTextColor(...DARK_TEXT);

      doc.text(
        `Opening Balance: ${formatNumber(ledger.openingBalance)}`,
        18,
        54.5
      );

      doc.text(
        `Closing Balance: ${formatNumber(ledger.closingBalance)}`,
        140,
        54.5
      );

      /* ================= TABLE ================= */

      autoTable(doc, {
        startY: 62,
        margin: { left: 14, right: 14 },
        theme: "grid",
        head: [[
          "Date",
          "Opening",
          "Dispatch",
          "Sales",
          "Sales Return",
          "Transfer In",
          "Transfer Out",
          "Wastage",
          "Balance"
        ]],
        body: ledger.transactions.map((row: any) => ([
          moment(row.date).format("DD-MM-YYYY"),
          formatNumber(row.openingStock),
          formatNumber(row.dispatchQty),
          formatNumber(row.salesQty),
          formatNumber(row.salesReturnQty),
          formatNumber(row.stockTransferInQty),
          formatNumber(row.stockTransferOutQty),
          formatNumber(
            (Number(row.wastageReceivedQty) || 0) +
            (Number(row.wastageReturnQty) || 0)
          ),
          formatNumber(row.closingStock),
        ])),
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          valign: "middle",
          font: "helvetica",
          lineWidth: 0.1,
          lineColor: [200, 200, 200]
        },
        headStyles: {
          fillColor: PRIMARY_BLUE,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center"
        },
        columnStyles: {
          0: { cellWidth: 22, halign: "left" },
          1: { halign: "right" },
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
          6: { halign: "right" },
          7: { halign: "right" },
          8: { halign: "right", fontStyle: "bold" },
        },
        didDrawPage: () => {
          const h = doc.internal.pageSize.getHeight();
          doc.setFontSize(7);
          doc.setTextColor(150);
          doc.text(
            `Generated: ${moment().format("DD-MM-YYYY HH:mm")}`,
            14,
            h - 10
          );
          doc.text(
            `Page ${doc.getNumberOfPages()}`,
            196,
            h - 10,
            { align: "right" }
          );
        }
      });
    });

    doc.save(`OutletStockLedger_YenERP_${moment().format("DD_MM_YYYY")}.pdf`);
  };
  const handleDownloadExcel = () => {
    if (selectedItems.length === 0 || branchSelected.length === 0) return;

    dispatch(
      exportStockLedgerExcel({
        locationName: branchSelected[0],
        itemCodes: selectedItems,
        fromDate: moment(selectionRange.startDate).format('YYYY-MM-DD'),
        toDate: moment(selectionRange.endDate).format('YYYY-MM-DD'),
      })
    );

    setOpenDialog(false);
  };


  const branchDisplayName = (() => {
    if (!branchSelected.length) return "All Locations";

    const branch = branchSearchResults.find(
      b => b.locationId === branchSelected[0]
    );

    return branch
      ? `(${branch.aliasName})`
      : "All Locations";
  })();


  return (
    <Box sx={{ backgroundColor: '#f9f9f9', minHeight: '100vh', pb: 4 }}>
      <OutletsInventoryManagementPage />

      {/* FILTER BAR */}
      <Paper elevation={0} sx={{ mx: 3, p: 1, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">

          <CollapsibleFilter
            title="Location"
            inputType="single-select"
            options={branchSearchResults.map(b => ({
              label: `${b.locationName} (${b.aliasName})`,
              value: b.locationId
            }))}
            selectedOptions={branchSelected[0] || ''}
            onChange={(v) => {
              dispatch(clearSelectedBranches());
              dispatch(addSelectedBranch(v as string));
            }}
            onClear={() => dispatch(clearSelectedBranches())}
            onSearch={handleBranchSearchChange}
            onScrollBottom={handleBranchScrollBottom}
            loading={branchSearchLoading}
            showSelectedCount
            displayLabel={branchDisplayName}
          />

          {/* ITEM FILTER */}
          <CollapsibleFilter
            title="Select Items"
            inputType="multi-select"
            isMulti
            options={searchResults.map(item => ({
              label: item.varianceName,
              value: item.itemCode,
            }))}
            selectedOptions={selectedItems}
            onChange={(v) => handleItemSelectionChange(v as string[])}
            onClear={() => dispatch(clearSelectedItems())}
            onSearch={handleSearchChange}
            onScrollBottom={handleScrollBottom}
            loading={searchLoading}
            showSelectedCount
          />

          <DateRangeDialog
            selectionRange={selectionRange}
            setSelectionRange={setSelectionRange}
            onApply={handleFilterClick}
          />

          <Box sx={{ flexGrow: 1 }} />

          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={18} /> : <FilterAltIcon />}
              onClick={handleFilterClick}
              disabled={selectedItems.length === 0 || branchSelected.length === 0}
              sx={{ borderRadius: 2 }}
            >
              Apply Filter
            </Button>

            <Button
              variant="outlined"
              startIcon={<RotateLeftIcon />}
              onClick={handleFilterClose}
              sx={{ borderRadius: '8px', textTransform: 'none' }}
            >
              Reset
            </Button>

            <Button
              variant="contained"
              color="success"
              startIcon={<DownloadIcon />}
              disabled={!stockLedgers || stockLedgers.length === 0}
              onClick={() => setOpenDialog(true)}
              sx={{ borderRadius: '8px', textTransform: 'none', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
            >
              Export
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* MAIN TABLE SECTION (WAREHOUSE STYLE - MATCHED) */}
      {selectedItems.length > 0 && stockLedgers && stockLedgers.length > 0 && (
        <Box sx={{ mx: 3 }}>
          {/* Main Scrollable Container */}
          <Box
            sx={{
              height: 'calc(100vh - 240px)',
              overflowY: 'auto',
              borderRadius: 3,
              boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
              border: '1px solid #e5e7eb',
              backgroundColor: '#fff',
              '&::-webkit-scrollbar': { width: '8px' },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: '#cbd5e1',
                borderRadius: '4px'
              }
            }}
          >
            {stockLedgers.map((ledger, index) => (
              <Box key={index} sx={{ mb: 4 }}>

                {/* ITEM HEADER - SAME AS WAREHOUSE */}
                <Box
                  sx={{
                    px: 3,
                    py: 1.8,
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    background: 'linear-gradient(90deg,#1976d2,#42a5f5)',
                    color: '#fff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  <Stack direction="row" alignItems="baseline" spacing={1}>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                      {ledger.varianceName}
                    </Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                      ({ledger.uom})
                    </Typography>
                  </Stack>

                  <Typography
                    sx={{
                      fontWeight: 600,
                      bgcolor: 'rgba(255,255,255,0.2)',
                      px: 2,
                      py: 0.5,
                      borderRadius: 1
                    }}
                  >
                    Current Stock: {ledger.closingBalance.toFixed(2)}
                  </Typography>
                </Box>

                {/* TABLE SECTION */}
                <TableContainer component={Box}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={headerStyle} align="left">Date</TableCell>
                        <TableCell sx={headerStyle} align="right">Opening</TableCell>
                        <TableCell sx={headerStyle} align="right">Dispatch</TableCell>
                        <TableCell sx={headerStyle} align="right">Sales</TableCell>
                        <TableCell sx={headerStyle} align="right">Sales Return</TableCell>
                        <TableCell sx={headerStyle} align="right">Transfer In</TableCell>
                        <TableCell sx={headerStyle} align="right">Transfer Out</TableCell>
                        <TableCell sx={headerStyle} align="right">Wastage</TableCell>
                        <TableCell sx={headerStyle} align="right">Balance</TableCell>
                      </TableRow>
                    </TableHead>

                    <TableBody>

                      {/* OPENING STOCK ROW - SAME STYLE */}
                      <TableRow sx={{ bgcolor: '#fff9db' }}>
                        <TableCell
                          colSpan={9}
                          align="center"
                          sx={{
                            py: 1.5,
                            borderBottom: '1px solid #fab005'
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            sx={{
                              color: '#856404',
                              fontWeight: 700,
                              letterSpacing: 0.5
                            }}
                          >
                            OPENING STOCK AS ON {moment(ledger.openingDate).format('DD-MM-YYYY')} :
                            {ledger.openingBalance.toFixed(2)}
                          </Typography>
                        </TableCell>
                      </TableRow>

                      {ledger.transactions.map((row, idx) => (
                        <TableRow key={idx} hover>
                          <TableCell align="left">
                            {moment(row.date).format('DD-MM-YYYY')}
                          </TableCell>

                          <TableCell align="right" sx={{ color: '#475569', fontWeight: 600 }}>
                            {displayValue(row.openingStock)}
                          </TableCell>

                          <TableCell align="right" sx={{ color: '#1976d2', fontWeight: 600 }}>
                            {displayValue(row.dispatchQty)}
                          </TableCell>

                          <TableCell align="right" sx={{ color: '#c62828', fontWeight: 600 }}>
                            {displayValue(row.salesQty)}
                          </TableCell>

                          <TableCell align="right" sx={{ color: '#2e7d32', fontWeight: 600 }}>
                            {displayValue(row.salesReturnQty)}
                          </TableCell>

                          <TableCell align="right" sx={{ color: '#2e7d32', fontWeight: 600 }}>
                            {displayValue(row.stockTransferInQty)}
                          </TableCell>

                          <TableCell align="right" sx={{ color: '#c62828', fontWeight: 600 }}>
                            {displayValue(row.stockTransferOutQty)}
                          </TableCell>

                          <TableCell align="right" sx={{ color: '#ed6c02', fontWeight: 600 }}>
                            {displayValue(
                              (Number(row.wastageReceivedQty) || 0) +
                              (Number(row.wastageReturnQty) || 0)
                            )}
                          </TableCell>

                          <TableCell
                            align="right"
                            sx={{
                              fontWeight: 800,
                              bgcolor: '#f8fafc',
                              color: '#111827'
                            }}
                          >
                            {displayValue(row.closingStock)}
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* CLOSING STOCK ROW - SAME STYLE */}
                      <TableRow sx={{ bgcolor: '#e7f5ff' }}>
                        <TableCell
                          colSpan={9}
                          align="center"
                          sx={{
                            py: 1.5,
                            borderTop: '2px solid #1976d2'
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            sx={{
                              color: '#1864ab',
                              fontWeight: 700,
                              letterSpacing: 0.5
                            }}
                          >
                            CLOSING STOCK :
                            {ledger.closingBalance.toFixed(2)}
                          </Typography>
                        </TableCell>
                      </TableRow>

                    </TableBody>
                  </Table>
                </TableContainer>

              </Box>
            ))}
          </Box>
        </Box>
      )}

      <DownloadDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onDownloadPDF={handleDownloadPDF}
        onDownloadExcel={handleDownloadExcel}
      />
    </Box>
  );
};

export default StockSummaryPage;