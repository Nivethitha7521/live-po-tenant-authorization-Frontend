'use client';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import 'react-date-range/dist/styles.css';
import { usePermissions } from "@/hooks/usePermissions";
import { useRouter } from "next/navigation";
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
    Stack,
} from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import GetAppIcon from '@mui/icons-material/GetApp';

import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ClearIcon from '@mui/icons-material/Clear';
import FileDownloadIcon from "@mui/icons-material/FileDownload";

import HistoryIcon from '@mui/icons-material/History';

import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/redux/store';
import moment from 'moment';

import {
    fetchStockLedger,
    searchPurchaseItems,
    addSelectedItem,
    removeSelectedItem,
    clearStockLedger,
    clearSearchResults,
    clearSelectedItems,
    setSearchQuery,
    selectStockLedger,
    selectStockLoading,
    selectSearchResults,
    selectSearchLoading,
    selectSelectedItems,
    exportStockLedgerExcel,
    selectSearchQuery,
    selectWarehouses,
    selectSelectedWarehouse,
    clearSelectedWarehouse,
    setSelectedWarehouse,
    fetchWarehouses
} from '../../../../features/yen_inventory/ledgerrawSlice';

import { startOfMonth, endOfDay } from 'date-fns';
import DateRangeDialog from '../../../../components/Inventory/ledger/daterangeDialog';
import WarehouseInventoryManagementPage from '../page';
import CollapsibleFilter from '@/components/Inventory/physcialstockvarience/ui/collabsfiler';
import { debounce } from 'lodash';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { convertImageToBase64 } from '@/components/Hooks/useTodayDate';
import { selectBusinesses } from '@/features/businessSlice';
import DownloadDialog from '@/components/Inventory/ledger/ConfirmDialog';

interface SelectedItem {
    randomId: string;
    itemName: string;
}

const StockSummaryPage = () => {
    const dispatch = useDispatch<AppDispatch>();
const router = useRouter();
const { hasPermission, isModuleVisible,permissions } = usePermissions();

const canRead = hasPermission("yenerp", "warehousestockledger", "read");
console.log("🔍 ALL PERMISSIONS:", permissions);
console.log("📦 warehouse module:", permissions?.yenerp?.warehousestockledger);
console.log("🏪 outlet module:", permissions?.yenerp?.stockledger);
    const stockLedger = useSelector(selectStockLedger);
    const loading = useSelector(selectStockLoading);
    const searchResults = useSelector(selectSearchResults);
    const warehouses = useSelector(selectWarehouses);
    const selectedWarehouse = useSelector(selectSelectedWarehouse);

    const searchLoading = useSelector(selectSearchLoading);
    const selectedItems = useSelector((state: RootState) => state.stockSummary.selectedItems) as SelectedItem[];
    const { businesses } = useSelector(selectBusinesses);
    const business = businesses?.[0];
    const searchQuery = useSelector(selectSearchQuery);
    const currentPage = useSelector((state: RootState) => state.stockSummary.currentPage);
    const hasMore = useSelector((state: RootState) => state.stockSummary.hasMore);

    const [openDialog, setOpenDialog] = useState(false);
    const [locationName, setLocationName] = useState('');
    const debouncedSearchRef = useRef<any>(null);
    const isFetchingRef = useRef(false);

    const today = new Date();
    const [selectionRange, setSelectionRange] = useState({
        startDate: startOfMonth(today),
        endDate: endOfDay(today),
        key: 'selection',
    });

    useEffect(() => {
        dispatch(fetchWarehouses({ page: 1, limit: 30 }));
    }, [dispatch]);

    useEffect(() => {
        dispatch(searchPurchaseItems({ search: '', page: 1 }));

        debouncedSearchRef.current = debounce((term: string) => {
            dispatch(searchPurchaseItems({ search: term, page: 1 }));
        }, 400);

        return () => debouncedSearchRef.current?.cancel();
    }, [dispatch]);

    const handleSearchChange = (value: string) => {
        dispatch(setSearchQuery(value));
        dispatch(clearSearchResults());
        debouncedSearchRef.current?.(value);
    };

    const handleScrollBottom = useCallback(() => {
        if (searchLoading || !hasMore || isFetchingRef.current) return;

        isFetchingRef.current = true;
        dispatch(
            searchPurchaseItems({
                search: searchQuery,
                page: currentPage,
            })
        ).finally(() => {
            isFetchingRef.current = false;
        });
    }, [dispatch, currentPage, searchLoading, hasMore, searchQuery]);

    // ------------------ PDF Download ------------------

    interface JsPDFWithAutoTable extends jsPDF {
        lastAutoTable?: { finalY: number };
    }

    const handleDownloadPDF = async () => {
        if (!stockLedger || selectedItems.length === 0) return;

        // Define ERP Colors
        const PRIMARY_BLUE: [number, number, number] = [25, 118, 210];
        const LIGHT_BLUE_BG: [number, number, number] = [235, 245, 255];
        const DARK_TEXT: [number, number, number] = [40, 40, 40];

        const doc = new jsPDF("p", "mm", "a4") as JsPDFWithAutoTable;

        let logo = "";
        if (business?.imageUrl) {
            try {
                logo = await convertImageToBase64(business.imageUrl);
            } catch { }
        }

        const warehouseName = warehouses.find(w => w.locationId === selectedWarehouse)?.locationName || '';

        selectedItems.forEach((item, index) => {
            const ledger = stockLedger[item.randomId];
            if (!ledger) return;

            if (index > 0) doc.addPage();

            // --- 1. Top Header Banner ---
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
            doc.text(`Period: ${moment(selectionRange.startDate).format("DD-MM-YYYY")} to ${moment(selectionRange.endDate).format("DD-MM-YYYY")}`, 196, 20, { align: "right" });
            doc.text(`Warehouse: ${warehouseName}`, 196, 25, { align: "right" });

            // --- 2. Item & Balance Info Box (Separate from Table) ---
            doc.setDrawColor(200);
            doc.line(14, 38, 196, 38);

            // Item Name
            doc.setFontSize(10);
            doc.setTextColor(...PRIMARY_BLUE);
            doc.setFont("helvetica", "bold");
            doc.text(`Item: ${item.itemName}`, 14, 45);

            // Balance Summary Boxes
            doc.setFillColor(...LIGHT_BLUE_BG);
            doc.rect(14, 48, 182, 10, "F"); // Light blue background for totals

            doc.setFontSize(9);
            doc.setTextColor(...DARK_TEXT);
            doc.text(`Opening Balance: ${ledger.openingReference.closingStock.toFixed(2)}`, 18, 54.5);
            doc.text(`Closing Balance: ${ledger.closingSummary.closingStock.toFixed(2)}`, 140, 54.5);

            // --- 3. Transaction Table with Blue Header ---
            autoTable(doc, {
                startY: 62,
                margin: { left: 14, right: 14 },
                theme: 'grid',
                head: [[
                    "Date",
                    "Vendor / Particulars",
                    "In Stock",
                    "Ret. Out",
                    "Dispatch Location",
                    "Out",
                    "Balance"
                ]],
                // Only transaction rows here - Opening/Closing rows removed
                body: ledger.transactions.map((row) => ([
                    moment(row.date).format("DD-MM-YYYY"),
                    row.grnVendorName || row.dispatchBranch || "-",
                    row.inStock > 0 ? row.inStock.toFixed(2) : "-",
                    row.returnedStock > 0 ? row.returnedStock.toFixed(2) : "-",
                    row.dispatchBranch || "-",
                    row.outStock > 0 ? row.outStock.toFixed(2) : "-",
                    row.balanceStock.toFixed(2),
                ])),
                styles: {
                    fontSize: 8,
                    cellPadding: 2.5,
                    valign: 'middle',
                    font: 'helvetica',
                    lineWidth: 0.1,
                    lineColor: [200, 200, 200]
                },
                headStyles: {
                    fillColor: PRIMARY_BLUE, // Solid Blue Header
                    textColor: [255, 255, 255], // White Text
                    fontStyle: 'bold',
                    halign: 'center'
                },
                columnStyles: {
                    0: { cellWidth: 22, halign: 'left' },
                    1: { cellWidth: 'auto', halign: 'left' },
                    2: { cellWidth: 18, halign: 'right' },
                    3: { cellWidth: 18, halign: 'right' },
                    4: { cellWidth: 35, halign: 'left' },
                    5: { cellWidth: 18, halign: 'right' },
                    6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' }
                },
                didDrawPage: (data) => {
                    const h = doc.internal.pageSize.getHeight();
                    doc.setFontSize(7);
                    doc.setTextColor(150);
                    doc.text(`Generated: ${moment().format("DD-MM-YYYY HH:mm")}`, 14, h - 10);
                    doc.text(`Page ${doc.getNumberOfPages()}`, 196, h - 10, { align: "right" });
                }
            });
        });

        doc.save(`WarehouseStockLedger_YenERP_${moment().format("DD_MM_YYYY")}.pdf`);
    };

    const headerStyle = {
        fontWeight: 700,
        bgcolor: '#f1f5f9',
        color: '#475569',
        fontSize: '0.85rem',
        textTransform: 'uppercase',
        py: 1.5,
        borderBottom: '2px solid #e2e8f0'
    };

    const handleDownloadExcel = () => {
        if (selectedItems.length === 0) return;

        const warehouseName = warehouses.find(w => w.locationId === selectedWarehouse)?.locationId || '';

        dispatch(exportStockLedgerExcel({
            fromDate: moment(selectionRange.startDate).format("YYYY-MM-DD"),
            toDate: moment(selectionRange.endDate).format("YYYY-MM-DD"),
            itemRandomId: selectedItems.map(i => i.randomId).join(","),
            locationName: warehouseName || undefined,
        }));
    };

    const branchDisplayName = selectedWarehouse
        ? ` (${warehouses.find(w => w.locationId === selectedWarehouse)?.aliasName || ''})`
        : 'All Locations';

    // ------------------ Item Selection ------------------
    const handleItemSelectionChange = (selected: string[]) => {
        const selectedObjects = searchResults
            .filter(item => selected.includes(item.randomId))
            .map(item => ({ randomId: item.randomId, itemName: item.itemName }));

        dispatch(clearSelectedItems());
        selectedObjects.forEach(item => dispatch(addSelectedItem(item)));
    };

    // ------------------ Apply Filter ------------------
    const handleFilterClick = () => {
        if (selectedItems.length === 0 || !selectedWarehouse) return;

        const warehouseName = warehouses.find(w => w.locationId === selectedWarehouse)?.locationId || '';

        dispatch(fetchStockLedger({
            fromDate: moment(selectionRange.startDate).format('YYYY-MM-DD'),
            toDate: moment(selectionRange.endDate).format('YYYY-MM-DD'),
            itemRandomId: selectedItems.map(i => i.randomId).join(','),
            locationName: warehouseName,
        }));
    };

    const handleFilterClose = () => {
        dispatch(clearStockLedger());
        dispatch(clearSelectedItems());
        dispatch(clearSelectedWarehouse());
        dispatch(clearSearchResults());
        setLocationName('');
        dispatch(searchPurchaseItems({ search: '', page: 1 }));
    };


    return (
        <Box sx={{ backgroundColor: '#f9f9f9', minHeight: '100vh', pb: 4 }}>
            <WarehouseInventoryManagementPage />
            {/* ACTION BAR */}
            <Paper elevation={0} sx={{ mx: 3, p: 1, borderRadius: 2, }}>
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                    <CollapsibleFilter
                        title="Warehouse"
                        inputType="single-select"
                        options={warehouses.map(w => ({ label: w.locationName, value: w.locationId }))}
                        selectedOptions={selectedWarehouse ? [selectedWarehouse] : []}
                        onChange={(v) => dispatch(setSelectedWarehouse(v as string))}
                        onClear={() => dispatch(clearSelectedWarehouse())}
                        displayLabel={branchDisplayName}
                    />

                    <CollapsibleFilter
                        title="Select Items"
                        inputType="multi-select"
                        isMulti
                        options={searchResults.map((item) => ({
                            label: item.itemName,
                            value: item.randomId,
                        }))}
                        selectedOptions={selectedItems.map(i => i.randomId)}
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
                            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <TuneIcon />}
                            onClick={handleFilterClick}
                            disabled={selectedItems.length === 0 || !selectedWarehouse}
                            sx={{ borderRadius: '8px', textTransform: 'none', px: 3 }}
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
                            startIcon={<GetAppIcon />}
                            disabled={!stockLedger}
                            onClick={() => setOpenDialog(true)}
                            sx={{ borderRadius: '8px', textTransform: 'none', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
                        >
                            Export
                        </Button>
                    </Stack>
                </Stack>
            </Paper>

            {selectedItems.length === 0 && (
                <Box sx={{ mt: 6, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <Typography variant="h6" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                        Select the Warehouse & items to view the data
                    </Typography>
                </Box>
            )}

            {/* ... after the Action Bar ... */}

            {selectedItems.length > 0 && stockLedger && (
                <Box sx={{ mx: 3 }}>
                    {/* Main Scrollable Container */}
                    <Box
                        sx={{
                            height: 'calc(100vh - 240px)', // Adjusted to give more space
                            overflowY: 'auto',
                            borderRadius: 3,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                            border: '1px solid #e5e7eb',
                            backgroundColor: '#fff',
                            '&::-webkit-scrollbar': { width: '8px' },
                            '&::-webkit-scrollbar-thumb': { bgcolor: '#cbd5e1', borderRadius: '4px' }
                        }}
                    >
                        {selectedItems.map((item) => {
                            const ledger = stockLedger[item.randomId];
                            if (!ledger) return null;

                            return (
                                <Box key={item.randomId} sx={{ mb: 4 }}>
                                    {/* ITEM HEADER - Now the primary header */}
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
                                                {ledger.itemDetails.itemName}
                                            </Typography>
                                            <Typography sx={{ fontSize: 13, opacity: 0.8 }}>
                                                ({ledger.itemDetails.uom})
                                            </Typography>
                                        </Stack>

                                        <Typography sx={{ fontWeight: 600, bgcolor: 'rgba(255,255,255,0.2)', px: 2, py: 0.5, borderRadius: 1 }}>
                                            Current Stock: {ledger.closingSummary.closingStock.toFixed(2)}
                                        </Typography>
                                    </Box>

                                    {/* TABLE SECTION */}
                                    <TableContainer component={Box}>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell sx={headerStyle} align="left">Date</TableCell>
                                                    <TableCell sx={headerStyle} align="left">Vendor Name</TableCell>
                                                    <TableCell sx={headerStyle} align="right">In Stock</TableCell>
                                                    <TableCell sx={headerStyle} align="right">Ret. to Vendor</TableCell>
                                                    <TableCell sx={headerStyle} align="right">Returned Stock</TableCell>
                                                    <TableCell sx={headerStyle} align="left">Dispatch loc</TableCell>
                                                    <TableCell sx={headerStyle} align="right">Out Stock</TableCell>
                                                    <TableCell sx={headerStyle} align="right">Balance</TableCell>
                                                    {/* <TableCell sx={headerStyle} align="center">UOM</TableCell> */}
                                                </TableRow>
                                            </TableHead>

                                            <TableBody>
                                                {/* OPENING STOCK - CENTERED SEPARATE ROW */}
                                                <TableRow sx={{ bgcolor: '#fff9db' }}>
                                                    <TableCell colSpan={9} align="center" sx={{ py: 1.5, borderBottom: '1px solid #fab005' }}>
                                                        <Typography variant="subtitle2" sx={{ color: '#856404', fontWeight: 700, letterSpacing: 0.5 }}>
                                                            OPENING STOCK AS ON {moment(ledger.openingReference.date).format('DD-MM-YYYY')} : {ledger.openingReference.closingStock.toFixed(2)} {ledger.itemDetails.uom}
                                                        </Typography>
                                                    </TableCell>
                                                </TableRow>

                                                {/* TRANSACTIONS */}
                                                {ledger.transactions.map((row, idx) => (
                                                    <TableRow key={idx} hover>
                                                        <TableCell align="left">{moment(row.date).format('DD-MM-YYYY')}</TableCell>
                                                        <TableCell align="left">{row.grnVendorName || '-'}</TableCell>
                                                        <TableCell align="right" sx={{ color: '#2e7d32', fontWeight: 600 }}>{row.inStock || '0.00'}</TableCell>
                                                        <TableCell align="right" sx={{ color: '#d32f2f' }}>{row.returnedToVendor || '0.00'}</TableCell>
                                                        <TableCell align="right" sx={{ color: '#ed6c02' }}>{row.returnedStock || '0.00'}</TableCell>
                                                        <TableCell align="left">{row.dispatchBranch || '-'}</TableCell>
                                                        <TableCell align="right" sx={{ color: '#c62828', fontWeight: 600 }}>{row.outStock || '0.00'}</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>{row.balanceStock.toFixed(2)}</TableCell>
                                                        {/* <TableCell align="center" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{ledger.itemDetails.uom}</TableCell> */}
                                                    </TableRow>
                                                ))}

                                                {/* CLOSING STOCK - CENTERED SEPARATE ROW */}
                                                <TableRow sx={{ bgcolor: '#e7f5ff' }}>
                                                    <TableCell colSpan={9} align="center" sx={{ py: 1.5, borderTop: '2px solid #1976d2' }}>
                                                        <Typography variant="subtitle2" sx={{ color: '#1864ab', fontWeight: 700, letterSpacing: 0.5 }}>
                                                            CLOSING STOCK AS ON {moment(ledger.closingSummary.date).format('DD-MM-YYYY')} : {ledger.closingSummary.closingStock.toFixed(2)} {ledger.itemDetails.uom}
                                                        </Typography>
                                                    </TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Box>
                            );
                        })}
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
