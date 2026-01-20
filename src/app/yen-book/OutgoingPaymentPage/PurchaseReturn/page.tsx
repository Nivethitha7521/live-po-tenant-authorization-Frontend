"use client";
import React, { useState, useEffect, useMemo } from 'react';
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
} from '@/features/yen-purchase/GRN/grnSlice';
import { AppDispatch, RootState } from '@/redux/store';
import { Outgoing, VendorDetail } from '@/Models/outgoingModel';
import { ItemDetail } from '@/Models/grnModel';
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

const PurchaseReturnPage = React.memo(() => {
    const dispatch = useDispatch<AppDispatch>();
    const { outgoings, snackbarMessage, snackbarOpen, outgoingvendor } = useSelector(selectOutgoings);
    const { itemwise, snackbarMessageGRN, snackbarOpenGRN } = useSelector(selectGrn);
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
        return [...outgoings].map(payment => {
            const totalPaid =
                (payment.advanceAmount || 0) +
                (payment.partialAmount || 0) +
                (payment.fullPaymentAmount || 0);
            const total = payment.payableAmount || 0;
            return { ...payment, totalPaid, total };
        });
    }, [outgoings]);

    useEffect(() => {
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

    const handlePageChange = (newPage: number) => {
        if (newPage < 1 || newPage > Math.ceil(totalItems / pageSize)) return;
        dispatch(setPagination({ page: newPage, size: pageSize }));
        dispatch(fetchOutgoings({
            page: newPage,
            size: pageSize,
            fromDate: isFilterActive ? moment(selectionRange.startDate).startOf('day').toDate() : fromDate,
            toDate: isFilterActive ? moment(selectionRange.endDate).endOf('day').toDate() : toDate,
            vendorName: selectedVendorName?.vendorName,
        }));
    };

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

    const handleFilterClose = () => {
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
    };

    // Modified handleReturnProcess to show option dialog
    const handleReturnProcess = async (outgoing: any) => {
        try {
            const grnId = outgoing.grnId;
            const outgoingId = outgoing.outgoingId || outgoing._id;
            const randomId = outgoing.randomId;
            const totalPayableAmount = outgoing.totalPayableAmount || 0;

            console.log('Processing return for:', { grnId, outgoingId, randomId });

            // Set common data
            setSelectedDocumentId(outgoingId);
            setSelectedDocumentNumber(randomId);
            setMaxDebitAmount(totalPayableAmount);

            if (grnId) {
                // Fetch GRN details
                const result = await dispatch(fetchGrnById(grnId)).unwrap();

                // Transform items
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

                // Show option dialog when we have both GRN and items
                if (transformedItems.length > 0) {
                    setReturnOptionOpen(true);
                } else {
                    // No items, go directly to amount-wise
                    setAmountWiseDialogOpen(true);
                }
            } else {
                // No GRN ID, directly show amount-wise dialog
                setAmountWiseDialogOpen(true);
            }
        } catch (error) {
            console.error('Error in handleReturnProcess:', error);
            dispatch(setSnackbarMessageGRN('Failed to fetch details.'));
            dispatch(setSnackbarOpenGRN(true));
        }
    };

    // Handle option selections
    const handleSelectItemWise = () => {
        setReturnOptionOpen(false);
        setItemWiseDialogOpen(true);
    };

    const handleSelectAmountWise = () => {
        setReturnOptionOpen(false);
        setAmountWiseDialogOpen(true);
    };

    // Handle return completion
    const handleReturnComplete = () => {
        // Close all dialogs
        setReturnOptionOpen(false);
        setItemWiseDialogOpen(false);
        setAmountWiseDialogOpen(false);
        
        // Reset state
        setSelectedDocumentId(null);
        setSelectedDocumentNumber('');
        setSelectedGrnId(null);
        setSelectedGrnItems([]);
        setMaxDebitAmount(0);

        // Refresh data
        dispatch(fetchOutgoings({
            page: currentPage,
            size: pageSize,
            fromDate: isFilterActive ? moment(selectionRange.startDate).startOf('day').toDate() : fromDate,
            toDate: isFilterActive ? moment(selectionRange.endDate).endOf('day').toDate() : toDate,
            vendorName: selectedVendorName?.vendorName,
        }));
    };

    const handleReturnCancel = () => {
        setReturnOptionOpen(false);
        setItemWiseDialogOpen(false);
        setAmountWiseDialogOpen(false);
        setSelectedDocumentId(null);
        setSelectedDocumentNumber('');
        setSelectedGrnId(null);
        setSelectedGrnItems([]);
        setMaxDebitAmount(0);
    };

    const getRandomId = (grnId: string): string | undefined => {
        const grn = itemwise.find(grn => grn.grnId === grnId);
        return grn?.randomId;
    };

    // Rest of your existing functions (generatePDF, generateCSV, etc.)
    const generateOutgoingInvoicePDF = () => {
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
            outgoing.totalPrice?.toFixed(2) || "0.00",
            outgoing.payableAmount?.toFixed(2) || "0.00",
            outgoing.totalPaid?.toFixed(2) || "0.00",
            outgoing.totalPayableAmount?.toFixed(2) || "0.00",
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
    };

    const generateOutgoingSummaryCSV = () => {
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
            outgoing.totalPrice?.toFixed(2) || "0.00",
            outgoing.payableAmount?.toFixed(2) || "0.00",
            outgoing.totalPaid?.toFixed(2) || "0.00",
            outgoing.totalPayableAmount?.toFixed(2) || "0.00",
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
    };

    return (
        <Box sx={{ p: 1, backgroundColor: 'white' }}>
            <YenBookPage />
            <Box display="flex" alignItems="center" justifyContent="space-between" marginTop={1}>
                <Box display="flex" alignItems="center">
                    <Link href="/yen-book/OutgoingPaymentPage" passHref>
                        <Button variant="contained" color="primary" sx={{ mr: '5px', ml: '15px' }}>
                            Outgoing Payment
                        </Button>
                    </Link>
                    <Link href="/yen-book/OutgoingPaymentPage/PreOutgoing" passHref>
                        <Button variant="contained" color="primary" sx={{ mr: '2px' }}>
                         Advance Payment
                        </Button>
                    </Link>
                    <Link href="/yen-book/OutgoingPaymentPage/PendingPayment" passHref>
                        <Button variant="contained" color="primary" sx={{ mr: '2px' }} >
                            Partial Payment
                        </Button>
                    </Link>
                    <Link href="/yen-book/OutgoingPaymentPage/PaidPayment" passHref>
                        <Button variant="contained" color="primary" sx={{ mr: '2px' }} >
                            Payment Done
                        </Button>
                    </Link>
                    <Link href="/yen-book/OutgoingPaymentPage/Ledger" passHref>
                        <Button variant="contained" color="primary" sx={{ mr: '2px' }} >
                            Ledger
                        </Button>
                    </Link>

                    <Link href="/yen-book/OutgoingPaymentPage/PurchaseReturn" passHref>
                        <Button variant="contained" sx={{
                            backgroundColor: 'white',
                            color: 'black',
                            '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                            },
                        }}>Purchase Return</Button>
                    </Link>
                </Box>
            </Box>
            
            {/* Filter controls remain the same */}
            <Grid container spacing={1} alignItems="center" justifyContent="flex-start" sx={{ mb: 1, mt: 1, ml: 0.1 }}>
                {/* Your existing filter controls */}
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
                                    <TableCell>Total Amount</TableCell>
                                    <TableCell>Total</TableCell>
                                    <TableCell>Paid Amount</TableCell>
                                    <TableCell>Remaining Amount</TableCell>
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
                                            <TableCell>{index + 1}</TableCell>
                                            <TableCell>{getRandomId(payment.grnId) || 'N/A'}</TableCell>
                                            <TableCell>{payment.randomId}</TableCell>
                                            <TableCell>{payment.vendorName}</TableCell>
                                            <TableCell>{payment.invoiceNo || 'N/A'}</TableCell>
                                            <TableCell>
                                                {payment.invoiceDate ? format(new Date(payment.invoiceDate), 'dd-MM-yyyy') : ''}
                                            </TableCell>
                                            <TableCell>{payment.totalPrice?.toFixed(2)}</TableCell>
                                            <TableCell>{payment.payableAmount?.toFixed(2)}</TableCell>
                                            <TableCell>{payment.totalPaid?.toFixed(2)}</TableCell>
                                            <TableCell>{payment.totalPayableAmount?.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Box display="flex" alignItems="center">
                                                    <Tooltip title="Process Return">
                                                        <IconButton
                                                            color="primary"
                                                            onClick={() => handleReturnProcess(payment)}
                                                            disabled={!payment.totalPayableAmount || payment.totalPayableAmount <= 0}
                                                        >
                                                            <ReturnIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <Box sx={{ display: 'flex', justifyContent: 'end', alignItems: 'center' }}>
                        <IconButton
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft />
                        </IconButton>
                        <Typography variant="body1" sx={{ mx: 2 }}>
                            Page {currentPage}
                        </Typography>
                        <IconButton
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage * pageSize >= totalItems}
                        >
                            <ChevronRight />
                        </IconButton>
                    </Box>
                </Grid>
            </Grid>

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