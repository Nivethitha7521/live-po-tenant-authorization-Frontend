"use client";
import React, { useState, useEffect, useMemo,useCallback} from 'react';
import {
    Grid,
    Typography,
    TableContainer,
    Paper,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Button,
    Box,
    FormControl,
    Autocomplete,
    Tooltip,
    IconButton,
    Snackbar,
    Dialog,
    TextField,
    DialogActions,
    DialogContent,
    DialogTitle,
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import DownloadIcon from '@mui/icons-material/Download';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ReturnIcon from '@mui/icons-material/KeyboardReturn';

import { ClearIcon } from '@mui/x-date-pickers/icons';
import {
    fetchOutgoings,
    selectOutgoings,
    fetchVendorDetails,
    selectCurrentPage,
    selectPageSize,
    selectTotalItems,
    setPagination,
    setSnackbarMessage,
    setSnackbarOpen,
    clearSnackbarMessage,
} from '@/features/yen-purchase/Outgoing/outgoingPaymentSlice';
import {
    fetchGrnById,
    fetchItemwiseGrns,
    selectGrn,
    fetchReturnReasons,
    setSnackbarMessageGRN,
    setSnackbarOpenGRN,
    clearLastReturnData,
} from '@/features/yen-purchase/GRN/grnSlice';
import { AppDispatch, RootState } from '@/redux/store';
import { Outgoing, VendorDetail } from '@/Models/outgoingModel';
import { GrnResponse, ItemDetail,ItemDetailResponse } from '@/Models/grnModel';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import Papa from 'papaparse';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import DateRangeDialog from '@/components/dateRange';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import moment from 'moment';
import GrnReturnDialog from '@/components/yen-purchase/grncomponent/grnReturnDialog';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import YenBookPage from '../../page';
import Link from 'next/link';
import ReturnOptionDialog from '@/components/yen-purchase/OutgoingComponent/ReturnOptionDialog';
import AmountReturnDialog from '@/components/yen-purchase/OutgoingComponent/AmountReturnDialog.tsx';
import { usePermissions } from "@/hooks/usePermissions";
import ReturnStockUpdateDialog from '@/app/yen-purchase/GrnPage/Components/ReturnStockUpdateDialog';
import GrnDialog from '@/components/yen-purchase/OutgoingComponent/GRNDialog';

// Define interface for ReturnActionButton props
interface ReturnActionButtonProps {
    payment: {
        totalPayableAmount?: number;
        [key: string]: any;
    };
    onClick: (payment: any) => void;
}
const PurchaseReturnPage = React.memo(() => {
    const dispatch = useDispatch<AppDispatch>();
     const { isModuleVisible, hasPermission } = usePermissions();
  // 🔐 Purchase Return READ = OR condition
  const canReadPurchaseReturn =
    hasPermission("yenerp", "outgoingpayment", "read") ||
    hasPermission("yenerp", "partialpayment", "read") ||
    hasPermission("yenerp", "paymentdone", "read");

  // 👁️ Purchase Return VISIBLE (hide = false)
  const canShowPurchaseReturn =
    isModuleVisible("yenerp", "purchasereturn") && canReadPurchaseReturn;

    const { outgoings, snackbarMessage, snackbarOpen, outgoingvendor } = useSelector(selectOutgoings);
    const { itemwise, snackbarMessageGRN, snackbarOpenGRN,
        lastReturnStockUpdates,
        lastReturnedGrnId,
        showReturnStockUpdateDialog } = useSelector(selectGrn);
    const currentPage = useSelector(selectCurrentPage);
    const pageSize = useSelector(selectPageSize);
    const totalItems = useSelector(selectTotalItems);
    const [selectedVendorName, setSelectedVendorName] = useState<VendorDetail | null>(null);
    const [openDownloadDialog, setOpenDownloadDialog] = useState(false);
    const [isFilterActive, setIsFilterActive] = useState(false);
    const [selectionRange, setSelectionRange] = useState({
        startDate: new Date(),
        endDate: new Date(),
        key: 'selection',
    });
     // State for GRN view dialog
    const [viewGrnDialogOpen, setViewGrnDialogOpen] = useState(false);
    const [selectedGrnForView, setSelectedGrnForView] = useState<GrnResponse | null>(null);
    // New state for both return types
    const [returnOptionOpen, setReturnOptionOpen] = useState(false);
    const [itemWiseDialogOpen, setItemWiseDialogOpen] = useState(false);
    const [amountWiseDialogOpen, setAmountWiseDialogOpen] = useState(false);
    const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
    const [selectedDocumentNumber, setSelectedDocumentNumber] = useState<string>('');
    const [selectedGrnId, setSelectedGrnId] = useState<string | null>(null);
    const [selectedGrnItems, setSelectedGrnItems] = useState<ItemDetail[]>([]);
    const [maxDebitAmount, setMaxDebitAmount] = useState<number>(0);
    
    const dateField = 'invoiceDate';
    const fromDate = moment().utc().startOf('day').toDate();
    const toDate = moment().utc().endOf('day').toDate();

    const filteredPayments = useMemo(() => {
        if (!outgoings.length) return [];

        return outgoings.map(payment => {
            const totalPaid =
                (payment.advanceAmount || 0) +
                (payment.partialAmount || 0) +
                (payment.fullPaymentAmount || 0);
            const total = payment.payableAmount || 0;
            return { ...payment, totalPaid, total };
        });
    }, [outgoings]);
 // Function to handle GRN click and show details
    const handleGrnClick = useCallback(async (grnId: string) => {
        try {
            const result = await dispatch(fetchGrnById(grnId)).unwrap();
            if (result) {
                const transformedGrn: GrnResponse = {
                    grnId: result.grnId,
                    randomId: result.randomId,
                    vendorName: result.vendorName,
                    grnDate: typeof result.grnDate === 'string' ? new Date(result.grnDate) : result.grnDate,
                    itemDetails: result.itemDetails.map((item: ItemDetail) => ({
                        itemId: item.itemId,
                        itemName: item.itemName ?? 'Unknown',
                        receivedQuantity: Number(item.receivedQuantity) || 0,
                        returnedQuantity: Number(item.returnedQuantity) || 0,
                        quantity: Number(item.quantity) || 0,
                        unitPrice: Number(item.unitPrice) || 0,
                        totalPrice: Number(item.totalPrice) || 0,
                        purchasetaxName: item.purchasetaxName || 'N/A',
                        discountAmount: Number(item.discountAmount) || 0,
                        finalPrice: Number(item.finalPrice) || 0,
                    })) as ItemDetailResponse[],
                };
                setSelectedGrnForView(transformedGrn);
                setViewGrnDialogOpen(true);
            } else {
                dispatch(setSnackbarMessageGRN('GRN not found.'));
                dispatch(setSnackbarOpenGRN(true));
            }
        } catch (error) {
            dispatch(setSnackbarMessageGRN('Failed to fetch GRN details.'));
            dispatch(setSnackbarOpenGRN(true));
            console.error('Failed to fetch GRN details:', error);
        }
    }, [dispatch]);
    useEffect(() => {
         if (!canReadPurchaseReturn) return;
        dispatch(fetchOutgoings({
            page: currentPage,
            size: pageSize,
            fromDate,
            toDate,
        }));
        dispatch(fetchItemwiseGrns());
        dispatch(fetchVendorDetails({ fetchAll: true }));
        dispatch(fetchReturnReasons());
    }, [dispatch, currentPage, pageSize]);

   const handlePageChange = useCallback((newPage: number) => {
        if (newPage < 1 || newPage > Math.ceil(totalItems / pageSize)) return;
        dispatch(setPagination({ page: newPage, size: pageSize }));
        dispatch(fetchOutgoings({
            page: newPage,
            size: pageSize,
            fromDate: isFilterActive ? moment(selectionRange.startDate).startOf('day').toDate() : fromDate,
            toDate: isFilterActive ? moment(selectionRange.endDate).endOf('day').toDate() : toDate,
            vendorName: selectedVendorName?.vendorName,
        }));
    }, [dispatch, pageSize, totalItems, isFilterActive, selectionRange, selectedVendorName]);

    const handleFilterClick = () => {
        setIsFilterActive(true);
        const filterParams = {
            page: 1,
            size: pageSize,
            fromDate: moment(selectionRange.startDate).startOf('day').toDate(),
            toDate: moment(selectionRange.endDate).endOf('day').toDate(),
            vendorName: selectedVendorName?.vendorName,
            filterBy: 'paymentDate' as const,
        };

        dispatch(setPagination({ page: 1, size: pageSize }));
        dispatch(fetchOutgoings(filterParams)).then(response => {
            let outgoingData: Outgoing[] = [];

            if (typeof response.payload === 'string') {
                dispatch(setSnackbarMessage(response.payload));
                dispatch(setSnackbarOpen(true));
                return;
            } else if (Array.isArray(response.payload)) {
                outgoingData = response.payload;
            } else if (response.payload && typeof response.payload === 'object' && 'outgoings' in response.payload) {
                outgoingData = response.payload.outgoings;
            }

            if (outgoingData.length === 0) {
                dispatch(setSnackbarMessage('No matching Outgoing Payment found.'));
                dispatch(setSnackbarOpen(true));
            }
        }).catch(error => {
            dispatch(setSnackbarMessage(error.message || 'Error fetching outgoing'));
            dispatch(setSnackbarOpen(true));
        });
    };

    const handleFilterClose = useCallback(() => {
        setIsFilterActive(false);
        setSelectionRange({ startDate: new Date(), endDate: new Date(), key: 'selection' });
        setSelectedVendorName(null);
        dispatch(fetchOutgoings({
            page: 1,
            size: pageSize,
            filterBy: dateField,
            fromDate,
            toDate,
        }));
    }, [dispatch, pageSize]);

    // Modified handleReturnProcess to show option dialog
     const handleReturnProcess = useCallback(async (outgoing: any) => {
        try {
            const grnId = outgoing.grnId;
            const outgoingId = outgoing.outgoingId || outgoing._id;
            const randomId = outgoing.randomId;
            const totalPayableAmount = outgoing.totalPayableAmount || 0;

            console.log('Processing return for:', { grnId, outgoingId, randomId });

            setSelectedDocumentId(outgoingId);
            setSelectedDocumentNumber(randomId);
            setMaxDebitAmount(totalPayableAmount);

            if (grnId) {
                const result = await dispatch(fetchGrnById(grnId)).unwrap();

                const transformedItems: ItemDetail[] = result.itemDetails?.map((item: any) => ({
                    itemId: item.itemId,
                    itemName: item.itemName ?? 'Unknown',
                    receivedQuantity: Number(item.receivedQuantity) || 0,
                    returnedQuantity: Number(item.returnedQuantity) || 0,
                    quantity: Number(item.quantity) || 0,
                    unitPrice: Number(item.unitPrice) || 0,
                    totalPrice: Number(item.totalPrice) || 0,
                    purchasetaxName: item.purchasetaxName || 'N/A',
                    discountAmount: Number(item.discountAmount) || 0,
                    finalPrice: Number(item.finalPrice) || 0,
                    nos: item.nos || 0,
                    eachQuantity: item.eachQuantity || 0,
                    hsnCode: item.hsnCode || '',
                    befTaxDiscount: item.befTaxDiscount || 0,
                })) || [];

                setSelectedGrnId(grnId);
                setSelectedGrnItems(transformedItems);

                if (transformedItems.length > 0) {
                    setReturnOptionOpen(true);
                } else {
                    setAmountWiseDialogOpen(true);
                }
            } else {
                setAmountWiseDialogOpen(true);
            }
        } catch (error) {
            console.error('Error in handleReturnProcess:', error);
            dispatch(setSnackbarMessageGRN('Failed to fetch details.'));
            dispatch(setSnackbarOpenGRN(true));
        }
    }, [dispatch]);

    const handleSelectItemWise = useCallback(() => {
        setReturnOptionOpen(false);
        setItemWiseDialogOpen(true);
    }, []);

     const handleSelectAmountWise = useCallback(() => {
        setReturnOptionOpen(false);
        setAmountWiseDialogOpen(true);
    }, []);

    // Handle return completion
     const handleReturnComplete = useCallback(() => {
        console.log('Return completed, closing dialogs...');

        setReturnOptionOpen(false);
        setItemWiseDialogOpen(false);
        setAmountWiseDialogOpen(false);

        setSelectedDocumentId(null);
        setSelectedDocumentNumber('');
        setSelectedGrnId(null);
        setSelectedGrnItems([]);
        setMaxDebitAmount(0);

        dispatch(fetchOutgoings({
            page: currentPage,
            size: pageSize,
            fromDate: isFilterActive ? moment(selectionRange.startDate).startOf('day').toDate() : fromDate,
            toDate: isFilterActive ? moment(selectionRange.endDate).endOf('day').toDate() : toDate,
            vendorName: selectedVendorName?.vendorName,
        }));
    }, [dispatch, currentPage, pageSize, isFilterActive, selectionRange, selectedVendorName]);

    const handleStockUpdateClose = useCallback(() => {
        console.log('Closing stock update dialog');
        dispatch(clearLastReturnData());
    }, [dispatch]);

 const handleReturnCancel = useCallback(() => {
        console.log('Return cancelled, closing all dialogs');
        setReturnOptionOpen(false);
        setItemWiseDialogOpen(false);
        setAmountWiseDialogOpen(false);
        setSelectedDocumentId(null);
        setSelectedDocumentNumber('');
        setSelectedGrnId(null);
        setSelectedGrnItems([]);
        setMaxDebitAmount(0);
    }, []);

      const getRandomId = useCallback((grnId: string): string | undefined => {
        const grn = itemwise.find(grn => grn.grnId === grnId);
        return grn?.randomId;
    }, [itemwise]);

    // Rest of your existing functions (generatePDF, generateCSV, etc.)
   const generateOutgoingInvoicePDF = useCallback(() => {
        const doc = new jsPDF();
        let yOffset = 10;
        const titleX = 80;

        doc.setFontSize(12);
        doc.text("Purchase Return Summary", titleX, yOffset + 10);
        const titleWidth = doc.getTextWidth("Purchase Return Summary");
        doc.setLineWidth(0.5);
        doc.line(titleX, yOffset + 12, titleX + titleWidth, yOffset + 12);
        yOffset += 25;

        const totalPayableAmount = filteredPayments.reduce((sum, outgoing) => sum + (outgoing.totalPayableAmount || 0), 0);
        const today = new Date();
        const currentDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
        doc.setFontSize(10);
        doc.text(`Date: ${currentDate}`, 14, yOffset);
        doc.text(`Total Payable Amount: ${totalPayableAmount.toFixed(2)}`, 140, yOffset);
        yOffset += 5;

        const headers = [
            [
                "No",
                "GRN No",
                "Outgoing No",
                "Vendor Name",
                "Invoice No",
                "Invoice Date",
                "Total Amount",
                "Total",
                "Paid Amount",
                "Remaining Amount",
            ],
        ];

        const rows = filteredPayments.map((outgoing, index) => [
            `${index + 1}`,
            getRandomId(outgoing.grnId) || "N/A",
            outgoing.randomId?.toString(),
            outgoing.vendorName?.toString(),
            outgoing.invoiceNo || "N/A",
            outgoing.invoiceDate ? format(new Date(outgoing.invoiceDate), 'dd-MM-yyyy') : 'Not Provided',
            (outgoing.totalPrice || 0).toFixed(2),
            (outgoing.payableAmount || 0).toFixed(2),
            (outgoing.totalPaid || 0).toFixed(2),
            (outgoing.totalPayableAmount || 0).toFixed(2),
        ]);

        doc.autoTable({
            head: headers,
            body: rows,
            startY: yOffset,
            styles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], fontSize: 8 },
            headStyles: { fillColor: [0, 0, 128], textColor: [255, 255, 255] },
            bodyStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0] },
            columnStyles: {
                0: { halign: 'center' },
                1: { halign: 'left' },
                2: { halign: 'left' },
                3: { halign: 'left' },
                4: { halign: 'left' },
                5: { halign: 'left' },
                6: { halign: 'right' },
                7: { halign: 'right' },
                8: { halign: 'right' },
                9: { halign: 'right' },
            },
        });

        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.text(`Page ${i} of ${totalPages}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
        }
        doc.save('PurchaseReturns.pdf');
        setOpenDownloadDialog(false);
    }, [filteredPayments, getRandomId]);
    const generateOutgoingSummaryCSV = useCallback(() => {
        const headers = [
            "No",
            "GRN No",
            "Outgoing No",
            "Vendor Name",
            "Invoice No",
            "Invoice Date",
            "Total Amount",
            "Total",
            "Paid Amount",
            "Remaining Amount",
        ];

        const rows = filteredPayments.map((outgoing, index) => [
            `${index + 1}`,
            getRandomId(outgoing.grnId) || "N/A",
            outgoing.randomId?.toString(),
            outgoing.vendorName?.toString(),
            outgoing.invoiceNo || "N/A",
            outgoing.invoiceDate ? format(new Date(outgoing.invoiceDate), 'dd-MM-yyyy') : 'Not Provided',
            (outgoing.totalPrice || 0).toFixed(2),
            (outgoing.payableAmount || 0).toFixed(2),
            (outgoing.totalPaid || 0).toFixed(2),
            (outgoing.totalPayableAmount || 0).toFixed(2),
        ]);

        const csv = Papa.unparse([headers, ...rows]);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "PurchaseReturns.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setOpenDownloadDialog(false);
    }, [filteredPayments, getRandomId]);
    const ReturnActionButton = useCallback(({ payment, onClick }: ReturnActionButtonProps) => {
        const isDisabled = !payment.totalPayableAmount || payment.totalPayableAmount <= 0;
        const tooltipTitle = isDisabled ? "No amount available for return" : "Process Return";

        const button = (
            <IconButton
                color="primary"
                onClick={() => onClick(payment)}
                disabled={isDisabled}
            >
                <ReturnIcon />
            </IconButton>
        );

        return (
            <Tooltip title={tooltipTitle}>
                <span>{button}</span>
            </Tooltip>
        );
    }, []);
 // ⛔ HIDE true → page itself block
  if (!isModuleVisible("yenerp", "purchasereturn")) {
    return (
      <Box p={3}>
        <Typography color="error">
          You do not have access to Purchase Return module.
        </Typography>
      </Box>
    );
  }

  // ⛔ READ false → permission block
  if (!canReadPurchaseReturn) {
    return (
      <Box p={3}>
        <Typography color="warning">
          You don’t have permission to view Purchase Returns.
        </Typography>
      </Box>
    );
  }

    return (
        <Box sx={{ p: 1, backgroundColor: 'white' }}>
            <YenBookPage />
            <Box display="flex" alignItems="center" justifyContent="space-between" marginTop={1}>
                <Box display="flex" alignItems="center">
                    {isModuleVisible("yenerp", "outgoingpayment") && (
            <Link href={"/yen-book/OutgoingPaymentPage"}>
              <Button
                variant="contained"
                color="primary"
                sx={{ mr: "5px", ml: "15px" }}
              >
                Outgoing Payment
              </Button>
            </Link>
          )}
                  {isModuleVisible("yenerp", "advancepayment") && (
            <Link href={"/yen-book/OutgoingPaymentPage/PreOutgoing"}>
              <Button variant="contained" color="primary" sx={{ mr: "2px" }}>
                Advance Payment
              </Button>
            </Link>
          )}
                  {isModuleVisible("yenerp", "partialpayment") && (
            <Link href={"/yen-book/OutgoingPaymentPage/PendingPayment"}>
              <Button variant="contained" color="primary" sx={{ mr: "2px" }}>
                Partial Payment
              </Button>
            </Link>
          )}
                    {isModuleVisible("yenerp", "paymentdone") && (
            <Link href={"/yen-book/OutgoingPaymentPage/PaidPayment"}>
              <Button variant="contained" color="primary" sx={{ mr: "2px" }}>
                Payment Done
              </Button>
            </Link>
          )}
                     {isModuleVisible("yenerp", "ledger") && (
            <Link href={"/yen-book/OutgoingPaymentPage/Ledger"}>
              <Button variant="contained" color="primary" sx={{ mr: "2px" }}>
                Ledger
              </Button>
            </Link>
          )}
                      {canShowPurchaseReturn && (
            <Link href={"/yen-book/OutgoingPaymentPage/PurchaseReturn"}>
              <Button
                variant="contained"
                sx={{
                  backgroundColor: "white", // White background
                  color: "black", // Black text
                  "&:hover": {
                    backgroundColor: "rgba(255, 255, 255, 0.8)", // Slightly darker on hover
                  },
                }}
              >
                Purchase Return
              </Button>
            </Link>
          )}
                </Box>
            </Box>
            
            {/* Filter controls */}
            <Grid container spacing={1} alignItems="center" justifyContent="flex-start" sx={{ mb: 1, mt: 1, ml: 0.1 }}>
                <Grid item xs="auto">
                    <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                        <DateRangeDialog
                            selectionRange={selectionRange}
                            setSelectionRange={setSelectionRange}
                            onApply={handleFilterClick}
                        />
                    </Box>
                </Grid>
  <Grid item xs={6} sm={4} md={2}>
                    <FormControl fullWidth>
                        <Autocomplete
                            value={selectedVendorName}
                            onChange={(event, newValue) => setSelectedVendorName(newValue)}
                            options={outgoingvendor}
                            getOptionLabel={(option: VendorDetail) => option.vendorName || ''}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="All Vendors"
                                    variant="outlined"
                                    size="small"
                                />
                            )}
                        />
                    </FormControl>
                </Grid>

                <Grid item xs={6} sm={4} md={1}>
                    <TextField
                        fullWidth
                        value="All Data"
                        variant="outlined"
                        size="small"
                        InputProps={{ readOnly: true }}
                    />
                </Grid>

                <Grid item xs="auto">
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <IconButton
                            onClick={handleFilterClick}
                            className="icon-button-outline"
                            color="primary"
                            size="small"
                            sx={{ p: 0.3 }}
                        >
                            <FilterAltIcon fontSize="small" />
                        </IconButton>
                        <Typography variant="caption" align="center">
                            Filter
                        </Typography>
                    </Box>
                </Grid>

                <Grid item xs="auto">
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <IconButton
                            onClick={handleFilterClose}
                            className="icon-button-outline"
                            color="primary"
                            size="small"
                            sx={{ p: 0.3 }}
                        >
                            <ClearIcon fontSize="small" />
                        </IconButton>
                        <Typography variant="caption" align="center">
                            Clear
                        </Typography>
                    </Box>
                </Grid>

                <Grid item xs sx={{ flexGrow: 1 }} />

                <Grid item xs="auto">
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <IconButton
                            onClick={() => setOpenDownloadDialog(true)}
                            color="primary"
                            className="icon-button-outline"
                            size="small"
                            sx={{ p: 0.3 }}
                            disabled={!filteredPayments || filteredPayments.length === 0}
                        >
                            <DownloadIcon fontSize="small" />
                        </IconButton>
                        <Typography variant="caption" align="center">
                            Download
                        </Typography>
                    </Box>
                </Grid>
            </Grid>
            <Grid container spacing={2}>
                <Grid item xs={12} ml={2}>
                    <TableContainer
                        component={Paper}
                        sx={{ maxHeight: 'calc(100vh - 270px)', overflowY: 'auto', width: '100%' }}
                    >
                        <Table stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell>No</TableCell>
                                    <TableCell>GRN No</TableCell>
                                    <TableCell>Outgoing No</TableCell>
                                    <TableCell>Vendor Name</TableCell>
                                    <TableCell>Invoice No</TableCell>
                                    <TableCell>Invoice Date</TableCell>
                                    <TableCell align="right">Total Amount</TableCell>
                                    <TableCell align="right">Total</TableCell>
                                    <TableCell align="right">Paid Amount</TableCell>
                                    <TableCell align="right">Remaining Amount</TableCell>
                                    <TableCell>Action</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredPayments.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={13} style={{ textAlign: 'center' }}>
                                            No data available
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredPayments.map((payment, index) => (
                                       <TableRow key={payment.outgoingId || index}>
                                            <TableCell>{(currentPage - 1) * pageSize + index + 1}</TableCell>
                                            <TableCell>
                                                {payment.grnId ? (
                                                    <span
                                                        style={{ 
                                                            color: 'blue', 
                                                            cursor: 'pointer',
                                                            textDecoration: 'underline'
                                                        }}
                                                        onClick={() => handleGrnClick(payment.grnId)}
                                                    >
                                                        {getRandomId(payment.grnId) || payment.grnId}
                                                    </span>
                                                ) : (
                                                    '-'
                                                )}
                                            </TableCell>
                                            <TableCell>{payment.randomId}</TableCell>
                                            <TableCell>{payment.vendorName}</TableCell>
                                            <TableCell>{payment.invoiceNo || 'N/A'}</TableCell>
                                            <TableCell>
                                                {payment.invoiceDate ? format(new Date(payment.invoiceDate), 'dd-MM-yyyy') : ''}
                                            </TableCell>
                                             <TableCell align="right">{(payment.totalPrice || 0).toFixed(2)}</TableCell>
                                            <TableCell align="right">{(payment.payableAmount || 0).toFixed(2)}</TableCell>
                                            <TableCell align="right">{(payment.totalPaid || 0).toFixed(2)}</TableCell>
                                            <TableCell align="right">{(payment.totalPayableAmount || 0).toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Box display="flex" alignItems="center">
                                                    <ReturnActionButton
                                                        payment={payment}
                                                        onClick={() => handleReturnProcess(payment)}
                                                    />
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                   <Box sx={{ display: 'flex', justifyContent: 'end', alignItems: 'center', mt: 2 }}>
                        <IconButton
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft />
                        </IconButton>
                        <Typography variant="body1" sx={{ mx: 2 }}>
                            Page {currentPage} of {Math.ceil(totalItems / pageSize)}
                        </Typography>
                        <IconButton
                             onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage >= Math.ceil(totalItems / pageSize)}
                        >
                            <ChevronRight />
                        </IconButton>
                    </Box>
                </Grid>
            </Grid>
 {/* GRN View Dialog */}
            <GrnDialog
                open={viewGrnDialogOpen}
                onClose={() => setViewGrnDialogOpen(false)}
                grn={selectedGrnForView}
            />
            {/* Return Option Dialog */}
            <ReturnOptionDialog
                open={returnOptionOpen}
                onClose={handleReturnCancel}
                onSelectItemWise={handleSelectItemWise}
                onSelectAmountWise={handleSelectAmountWise}
                documentType="outgoing_payment"
                documentNumber={selectedDocumentNumber}
            />

            {/* Item-wise Return Dialog */}
            {itemWiseDialogOpen && selectedGrnId && selectedGrnItems.length > 0 && (
                <GrnReturnDialog
                    dialogItems={selectedGrnItems}
                    selectedGrnId={selectedGrnId}
                    currentPage={currentPage}
                    pageSize={pageSize}
                    status="active"
                    fromDate={fromDate.toISOString()}
                    toDate={toDate.toISOString()}
                    onReturnComplete={handleReturnComplete}
                    onCancel={handleReturnCancel}
                />
            )}

            {/* Amount-wise Return Dialog */}
            {amountWiseDialogOpen && selectedDocumentId && (
                <AmountReturnDialog
                     open={amountWiseDialogOpen}
                    onClose={handleReturnCancel}
                    onSuccess={handleReturnComplete}
                    documentId={selectedDocumentId}
                    documentType="outgoing_payment"
                    documentNumber={selectedDocumentNumber}
                    maxAmount={maxDebitAmount}
                    currentPage={currentPage}
                    pageSize={pageSize}
                />
            )}
     {/* Stock Update Dialog */}
            <ReturnStockUpdateDialog
                open={showReturnStockUpdateDialog}
                stockUpdates={lastReturnStockUpdates}
                grnId={lastReturnedGrnId}
                onClose={handleStockUpdateClose}
            />
            {/* Download Dialog */}
            <Dialog open={openDownloadDialog} onClose={() => setOpenDownloadDialog(false)}>
                <DialogTitle>Choose a file format</DialogTitle>
                <DialogContent>
                    <p>Select the file format you want to download:</p>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={generateOutgoingInvoicePDF}
                        variant="contained"
                        color="primary"
                        startIcon={<PictureAsPdfIcon />}
                    >
                        Download PDF
                    </Button>
                    <Button
                        onClick={generateOutgoingSummaryCSV}
                        variant="contained"
                        color="secondary"
                        startIcon={<DescriptionIcon />}
                    >
                        Download CSV
                    </Button>
                    <Button onClick={() => setOpenDownloadDialog(false)}>Cancel</Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar */}
            <Snackbar
                open={snackbarOpen || snackbarOpenGRN}
                message={snackbarMessage || snackbarMessageGRN}
                autoHideDuration={3000}
                onClose={() => {
                    dispatch(clearSnackbarMessage());
                    dispatch(setSnackbarOpenGRN(false));
                }}
            />
        </Box>
    );
});

PurchaseReturnPage.displayName = 'PurchaseReturnPage';

export default PurchaseReturnPage;