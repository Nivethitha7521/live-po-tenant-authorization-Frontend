"use client";
import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Snackbar,
  FormControl,
  IconButton,
  Tooltip,
  Autocomplete,
  TextField,
} from "@mui/material";
import {
  fetchOutgoings,
  selectOutgoings,
  setSnackbarMessage,
  setSnackbarOpen, 
  clearSnackbarMessage, 
  selectCurrentPage,
  selectPageSize,
  selectTotalItems, 
  setPagination,
  fetchVendorDetails
} from "../../../../features/yen-purchase/Outgoing/outgoingPaymentSlice";
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { AppDispatch } from "@/redux/store";
import YenBookPage from "../../page";
import jsPDF from 'jspdf';
import "jspdf-autotable";
import { fetchBusinesses, fetchPhoto, selectBusinesses } from '@/features/account-setting/businessSlice';
import { fetchItemwiseGrns, selectGrn } from '@/features/yen-purchase/GRN/grnSlice';
import { format } from "date-fns";
import { Outgoing } from "@/Models/apModel";
import Link from "next/link";
import Papa from "papaparse";
import { ChevronLeft, ChevronRight } from "@mui/icons-material";
import DateRangeDialog from "@/components/dateRange";
import { ClearIcon } from "@mui/x-date-pickers/icons";
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import moment from "moment";
import { VendorDetail } from "@/Models/outgoingModel";
import { AutocompleteChangeReason } from "@mui/material/Autocomplete";

const PaidPaymentComponent = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { outgoings, loading, snackbarOpen, snackbarMessage, outgoingvendor } = useSelector(selectOutgoings);
  const { itemwise } = useSelector(selectGrn);
  const { businesses } = useSelector(selectBusinesses);
  const [fetchedBusinessIds, setFetchedBusinessIds] = useState(new Set());
  const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'succeeded' | 'failed'>('idle');
  const [openDetailsDialog, setOpenDetailsDialog] = useState(false);
  const [selectedOutgoing, setSelectedOutgoing] = useState<any>(null);
  const [selectedVendorName, setSelectedVendorName] = useState<VendorDetail | null>(null);
  const [filteredOutgoing, setFilteredOutgoing] = useState<Outgoing[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const currentPage = useSelector(selectCurrentPage);
  const pageSize = useSelector(selectPageSize);
  const totalItems = useSelector(selectTotalItems);
  const newPage = useSelector(selectCurrentPage);
  const [selectionRange, setSelectionRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    key: 'selection',
  });
  const dateField = 'paymentDate';
  const StartDate = moment().utc().startOf('day').toDate();
  const EndDate = moment().utc().endOf('day').toDate();
  const [shouldFetch, setShouldFetch] = useState(true);

  useEffect(() => {
    if (shouldFetch && newPage && pageSize) {
      const action = fetchOutgoings({
        page: newPage,
        size: pageSize,
        filterByStatus: true,
        filterBy: dateField,
        fromDate: StartDate,
        toDate: EndDate
      });
      dispatch(action);
      setShouldFetch(false);
    }
  }, [dispatch, newPage, pageSize, StartDate, EndDate, dateField, shouldFetch]);

  useEffect(() => {
    if (loadingState === 'idle') {
      dispatch(fetchItemwiseGrns());
      dispatch(fetchVendorDetails({ filterByStatus: true }));
    }
  }, [loadingState, dispatch]);

  useEffect(() => {
    dispatch(fetchBusinesses());
  }, [dispatch]);

  useEffect(() => {
    businesses.forEach((business) => {
      if (!fetchedBusinessIds.has(business.businessId)) {
        dispatch(fetchPhoto(business.businessId));
        setFetchedBusinessIds(prevSet => new Set(prevSet).add(business.businessId));
      }
    });
  }, [businesses, fetchedBusinessIds, dispatch]);

  // Calculate total paid amount from payment history
  const calculateTotalPaid = (payment: any) => {
    let totalPaid = 0;
    
    if (payment.paymentHistory && payment.paymentHistory.length > 0) {
      payment.paymentHistory.forEach((history: any) => {
        totalPaid += history.amount || 0;
      });
    }
    
    return totalPaid;
  };

  const paidOutgoings = outgoings.filter(payment => {
    return payment.status === 'Fully Paid' || payment.status === 'Partially Paid';
  });

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > Math.ceil(totalItems / pageSize)) {
      return;
    }
    const appliedFromDate = selectionRange?.startDate instanceof Date ? moment(selectionRange.startDate).startOf('day').toDate() : StartDate;
    const appliedToDate = selectionRange?.endDate instanceof Date ? moment(selectionRange.endDate).endOf('day').toDate() : EndDate;
    dispatch(setPagination({ page: newPage, size: pageSize }));
    dispatch(fetchOutgoings({
      page: newPage, 
      size: pageSize, 
      filterByStatus: true, 
      filterBy: dateField, 
      fromDate: appliedFromDate,
      toDate: appliedToDate, 
      vendorName: selectedVendorName?.vendorName,
    }));
  };

  const handleNextPage = () => {
    if (currentPage * pageSize < totalItems) {
      handlePageChange(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  };

  const handleFilterClick = () => {
    const formattedStartDate = selectionRange?.startDate instanceof Date
      ? moment(selectionRange.startDate).startOf('day').toDate()
      : StartDate;
    const formattedEndDate = selectionRange?.endDate instanceof Date
      ? moment(selectionRange.endDate).endOf('day').toDate()
      : EndDate;

    const filterParams: any = {
      page: newPage,
      size: pageSize,
      filterByStatus: true,
      filterBy: dateField,
    };

    if (formattedStartDate) {
      filterParams.fromDate = formattedStartDate;
    }
    if (formattedEndDate) {
      filterParams.toDate = formattedEndDate;
    }
    if (selectedVendorName?.vendorName && selectedVendorName.vendorName.trim() !== '') {
      filterParams.vendorName = selectedVendorName.vendorName.trim();
    }

    console.log('Applying filters:', filterParams);

    dispatch(fetchOutgoings(filterParams))
      .then((response) => {
        const data = response.payload as { outgoings: Outgoing[]; totalItems: number } | string;

        console.log('Filtered outgoings:', data);

        if (typeof data === 'string') {
          dispatch(setSnackbarMessage(data));
          dispatch(setSnackbarOpen(true));
          setFilteredOutgoing([]);
        } else if (data.outgoings.length === 0) {
          dispatch(setSnackbarMessage('No matching Outgoing Payment found.'));
          dispatch(setSnackbarOpen(true));
          setFilteredOutgoing([]);
        } else {
          setFilteredOutgoing(data.outgoings);
        }
      })
      .catch((error) => {
        console.error('Error fetching outgoing:', error);
        dispatch(setSnackbarMessage(error.message || 'Error fetching outgoing'));
        dispatch(setSnackbarOpen(true));
        setFilteredOutgoing([]);
      });
  };

  const handleFilterClose = () => {
    setSelectionRange({
      startDate: new Date(),
      endDate: new Date(),
      key: 'selection',
    });
    setSelectedVendorName(null);
    dispatch(fetchOutgoings({
      page: 1, 
      size: pageSize, 
      filterByStatus: true, 
      filterBy: dateField, 
      fromDate: StartDate,
      toDate: EndDate
    }));
  };

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case "fully paid":
        return { backgroundColor: "white", boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)" };
      case "partially paid":
        return { backgroundColor: "orange", boxShadow: "0px 4px 12px rgba(255, 165, 0, 0.5)" };
      case "advance paid":
        return { backgroundColor: "yellow", boxShadow: "0px 4px 12px rgba(255, 255, 0, 0.5)" };
      default:
        return { backgroundColor: "gray", boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)" };
    }
  };

  const handleVendorChange = (
    event: React.SyntheticEvent,
    newValue: VendorDetail | null,
    reason: AutocompleteChangeReason
  ) => {
    setSelectedVendorName(newValue);
  };

  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const generateOutgoingInvoicePDF = () => {
    const doc = new jsPDF();
    let yOffset = 10;

    const logoX = 12;
    const titleX = 80;

    const business = businesses.length > 0 ? businesses[0] : null;

    if (business && business.imageUrl) {
      try {
        doc.addImage(business.imageUrl, 'JPEG', logoX, yOffset, 20, 20);
      } catch (e) {
        console.error("Image failed to load:", e);
      }
    }

    doc.setFontSize(12);
    doc.text("Payment Acknowledgement Summary", titleX, yOffset + 10);

    const titleWidth = doc.getTextWidth("Payment Acknowledgement  Summary");
    const lineY = yOffset + 12;
    doc.setLineWidth(0.1);
    doc.line(titleX, lineY, titleX + titleWidth, lineY);

    yOffset += 20;

    // Use paidOutgoings instead of filtering again
    const totalPayableAmount = paidOutgoings.reduce((sum, outgoing) => {
      return sum + (outgoing.totalPayableAmount || 0);
    }, 0);

    const today = new Date();
    const currentDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

    doc.setFontSize(10);
    doc.text(`Total Payable Amount: ${totalPayableAmount.toFixed(2)}`, 145, yOffset);
    doc.text(`Date: ${currentDate}`, 14, yOffset);

    yOffset += 5;

    // FIXED: Use calculateTotalPaid function for consistent calculation
    const rows = paidOutgoings.map((payment, index) => {
      const totalPaid = calculateTotalPaid(payment);
      const totalPayable = payment.totalPayableAmount || 0;

      return [
        `${index + 1}`,
        payment.randomId ? payment.randomId.toString() : "N/A",
        payment.vendorName ? payment.vendorName.toString() : "N/A",
        payment.invoiceDate ? format(new Date(payment.invoiceDate), 'dd-MM-yyyy') : 'Not Provided',
        totalPaid.toFixed(2),  // Use calculated total paid
        totalPayable.toFixed(2),
        payment.status || "Unknown"
      ];
    });

    doc.autoTable({
      head: [["S.No", "Outgoing ID", "Vendor Name", "Invoice Date", "Paid Amount", "Total Payable Amount", "Status"]],
      body: rows,
      startY: 33,
      styles: {
        fillColor: [0, 0, 128],
        textColor: [255, 255, 255],
        lineColor: [0, 0, 0],
        fontSize: 8
      },
      headStyles: {
        fillColor: [0, 0, 128],
        textColor: [255, 255, 255]
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0]
      },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'center' }
      }
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      const pageY = doc.internal.pageSize.height - 10;
      const computerGeneratedY = pageY - 10;
      doc.text("This is computer generated", doc.internal.pageSize.width / 2, computerGeneratedY, { align: 'center' });
      doc.text(`Page ${i} of ${totalPages}`, doc.internal.pageSize.width / 2, pageY, { align: 'center' });
    }

    const pdfFilename = `Paidpayment.pdf`;
    doc.save(pdfFilename);
    handleCloseDialog();
  };

  const generatePaidPaymentCSV = () => {
    const headers = [
      "S.No", "Outgoing ID", "Vendor Name", "Invoice Date", "Paid Amount", "Total Payable Amount", "Status"
    ];

    // FIXED: Use calculateTotalPaid function for consistent calculation
    const rows = paidOutgoings.map((payment, index) => {
      const totalPaid = calculateTotalPaid(payment);
      const totalPayable = payment.totalPayableAmount || 0;

      return [
        `${index + 1}`,
        payment.randomId ? payment.randomId.toString() : "N/A",
        payment.vendorName ? payment.vendorName.toString() : "N/A",
        payment.invoiceDate ? format(new Date(payment.invoiceDate), 'dd-MM-yyyy') : 'Not Provided',
        totalPaid.toFixed(2),  // Use calculated total paid
        totalPayable.toFixed(2),
        payment.status || "Unknown"
      ];
    });

    const csvData = [headers, ...rows];
    const csv = Papa.unparse(csvData);

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "PaidPaymentSummary.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    handleCloseDialog();
  };
const handleDownload = async (outgoingId: string) => {
  const outgoingdetail = paidOutgoings.find((outgoing) => outgoing.outgoingId === outgoingId);
  if (!outgoingdetail) {
    console.error('Outgoing not found!');
    return;
  }
  const business = businesses.length > 0 ? businesses[0] : null;
  const doc = new jsPDF();
  let yOffset = 10;

  // Header Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 128);
  doc.text('Payment Acknowledgement', 90, yOffset + 5);
  const textWidth = doc.getTextWidth('Payment Acknowledgement');
  doc.setDrawColor(0, 0, 128);
  doc.line(90, yOffset + 7, 90 + textWidth, yOffset + 7);
  yOffset += 10;

  // Add Business Logo if available
  if (business && business.imageUrl) {
    try {
      doc.addImage(business.imageUrl, 'JPEG', 20, 5, 20, 20);
    } catch (e) {
      console.error("Image failed to load:", e);
    }
  }

  // FIXED: Use calculateTotalPaid for paid amount
  const totalPaidAmount = calculateTotalPaid(outgoingdetail);

  // Vendor and Business Details
  const vendorDetailsRows = [
    [
      `Vendor Name: ${outgoingdetail.vendorName || ''}\n` +
      `GSTIN: ${outgoingdetail.gstNumber || ''}\n` +
      `Address: ${outgoingdetail.address || ''}\n` +
      `City: ${outgoingdetail.city || ''}\n` +
      `State: ${outgoingdetail.state || ''}\n` +
      `Country: ${outgoingdetail.country || ''}\n` +
      `Email: ${outgoingdetail.contactpersonEmail || ''}`,
      `Business Name: ${business?.companyName || ''}\n` +
      `GSTIN: ${business?.gstIn || ''}\n` +
      `Address: ${business?.address1 || ''}\n` +
      `Phone: ${business?.phoneNo || ''}\n` +
      `Email: ${business?.emailId || ''}`,
      `Outgoing No: ${outgoingdetail.randomId}\n` +
      `Date: ${outgoingdetail.createdDate
        ? format(new Date(outgoingdetail.createdDate), 'dd-MM-yyyy')
        : 'Not Provided'}\n` +
      `Total Paid: ${totalPaidAmount.toFixed(2)}`
    ]
  ];

  doc.autoTable({
    head: [['Vendor Details', 'Business Details', 'Outgoing Payment Details']],
    body: vendorDetailsRows,
    startY: yOffset,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 4, halign: 'left', valign: 'top', overflow: 'linebreak' },
    columnStyles: { 0: { cellWidth: 60.6 }, 1: { cellWidth: 60.6 }, 2: { cellWidth: 60.6 } },
    headStyles: { fillColor: [0, 0, 128], textColor: [255, 255, 255], fontStyle: 'bold' },
    bodyStyles: { lineWidth: 0.1, lineColor: [0, 0, 0], textColor: [0, 0, 0], minCellHeight: 15 },
    tableLineColor: [0, 0, 0],
    tableLineWidth: 0.1,
  });

  yOffset = doc.autoTable.previous.finalY;

  // Payment History Section
  if (outgoingdetail.paymentHistory && outgoingdetail.paymentHistory.length > 0) {
    const paymentHeaders = ['Date', 'Payment Method', 'Reference No', 'Type', 'Amount'];
    const paymentRows = outgoingdetail.paymentHistory.map((payment: any) => [
      payment.date ? format(new Date(payment.date), 'dd-MM-yyyy') : 'N/A',
      payment.paymentMethod || 'N/A',
      payment.neftNo || payment.rtgsNo || payment.chequeNo || 'N/A',
      payment.paymentType || 'Regular',
            (payment.amount || 0).toFixed(2),
    ]);
    // Add total row
  
    doc.autoTable({
      head: [paymentHeaders],
      body: paymentRows,
      startY: yOffset,
      theme: 'grid',
      styles: { fontSize: 8, halign: 'center', cellPadding: 2 },
      headStyles: { fillColor: [0, 0, 128], textColor: [255, 255, 255], lineWidth: 0.1, lineColor: [0, 0, 0] },
      bodyStyles: { lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'left' },
        2: { halign: 'left' },
        3: { halign: 'center' },
         4: { halign: 'right' },
      },
    });
    yOffset = doc.autoTable.previous.finalY;
  }

  // Summary Section
  const discount = outgoingdetail.discountDetails || 0;
  const totalPayableAmount = outgoingdetail.totalPayableAmount || 0;
  const summaryTable = [
    ['Discount', discount.toFixed(2)],
    ['Total Paid Amount', totalPaidAmount.toFixed(2)],
    ['Total Payable Amount', totalPayableAmount.toFixed(2)]
  ];
  doc.autoTable({
    head: [['Description', 'Amount']],
    body: summaryTable,
    startY: yOffset,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 3, overflow: 'linebreak', halign: 'right' },
    columnStyles: {
      0: { cellWidth: 90, halign: 'right' },
      1: { cellWidth: 91.7, halign: 'right' }
    },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.1 },
    bodyStyles: { lineColor: [0, 0, 0], lineWidth: 0.1 },
  });

  yOffset = doc.autoTable.previous.finalY + 10;

  // Add PAID logo below the table
  const statusImage = '/images/paid.jpg';
  if (statusImage) {
    const img = new Image();
    img.src = statusImage;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        doc.addImage(img, 'JPG', 150, yOffset,30, 25);
        resolve();
      };
      img.onerror = reject;
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(0);
    const pageY = doc.internal.pageSize.height - 10;
    const computerGeneratedY = pageY - 10;
    doc.text("This is computer generated", doc.internal.pageSize.width / 2, computerGeneratedY, { align: 'center' });
    doc.text(`Page ${i} of ${totalPages}`, doc.internal.pageSize.width / 2, pageY, { align: 'center' });
  }
  doc.save(`${outgoingdetail.vendorName} ${outgoingdetail.randomId}_PaymentDetails.pdf`);
};
 const handleViewDetails = (index: number) => {
    setSelectedOutgoing(paidOutgoings[index]);
    setOpenDetailsDialog(true);
  };

  const handleCloseDetailsDialog = () => {
    setOpenDetailsDialog(false);
  };

  return (
    <Box>
      <YenBookPage />
      <Box sx={{ p: 1, backgroundColor: "white", mx: 1 }}>
        <Box display="flex" flexDirection="column" alignItems="start" mb={1}>
          <Grid container spacing={1} alignItems="center">
            <Grid item>
              <Link href="/yen-book/OutgoingPaymentPage" passHref>
                <Button variant="contained" color="primary">Outgoing Payment</Button>
              </Link>
            </Grid>
            <Grid item>
              <Link href="/yen-book/OutgoingPaymentPage/PreOutgoing" passHref>
                <Button variant="contained" color="primary">Advance Payment</Button>
              </Link>
            </Grid>
            <Grid item>
              <Link href="/yen-book/OutgoingPaymentPage/PendingPayment" passHref>
                <Button variant="contained" color="primary">Partial Payment</Button>
              </Link>
            </Grid>
            <Grid item>
              <Link href="/yen-book/OutgoingPaymentPage/PaidPayment" passHref>
                <Button variant="contained" sx={{
                  backgroundColor: 'white',
                  color: 'black',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  },
                }}>
                  Payment Done
                </Button>
              </Link>
            </Grid>
            <Grid item>
              <Link href="/yen-book/OutgoingPaymentPage/Ledger" passHref>
                <Button variant="contained" color="primary">Ledger</Button>
              </Link>
            </Grid>
            <Grid item>
              <Link href="/yen-book/OutgoingPaymentPage/PurchaseReturn" passHref>
                <Button variant="contained" color="primary">Purchase Return</Button>
              </Link>
            </Grid>
          </Grid>

          <Grid container spacing={1} alignItems="center" sx={{ mt: 1 }}>
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
                  onChange={handleVendorChange}
                  options={outgoingvendor}
                  getOptionLabel={(option: VendorDetail) => option.vendorName || ''}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="All Vendors"
                      variant="outlined"
                      size="small"
                      InputProps={{
                        ...params.InputProps,
                        style: { fontSize: '12px' },
                      }}
                    />
                  )}
                  sx={{
                    fontSize: '12px',
                  }}
                />
              </FormControl>
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
                <Typography variant="caption" align="center" sx={{ maxWidth: 60, wordBreak: 'break-word' }}>
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
                <Typography variant="caption" align="center" sx={{ maxWidth: 60, wordBreak: 'break-word' }}>
                  Clear
                </Typography>
              </Box>
            </Grid>

            <Grid item xs sx={{ flexGrow: 1 }} />

            <Grid item xs="auto">
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <IconButton
                  onClick={handleOpenDialog}
                  color="primary"
                  className="icon-button-outline"
                  size="small"
                  sx={{ p: 0.3 }}
                  disabled={!paidOutgoings || paidOutgoings.length === 0}
                >
                  <DownloadIcon fontSize="small" />
                </IconButton>
                <Typography variant="caption" align="center" sx={{ maxWidth: 60, wordBreak: 'break-word' }}>
                  Download
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TableContainer
              component={Paper}
              sx={{
                maxHeight: 'calc(100vh - 230px)',
                overflowY: 'auto',
                width: '100%',
              }}
            >
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>No</TableCell>
                    <TableCell>Outgoing Reference</TableCell>
                    <TableCell>Vendor Name</TableCell>
                    <TableCell>Invoice No</TableCell>
                    <TableCell>Invoice Date</TableCell>
                    <TableCell>Total Payable Amount</TableCell>
                    <TableCell>Paid Amount</TableCell>
                    <TableCell>Payment Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paidOutgoings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} style={{ textAlign: 'center' }}>
                        No data available
                      </TableCell>
                    </TableRow>
                  ) : (paidOutgoings.map((payment, index) => {
                    const totalPaidAmount = calculateTotalPaid(payment);

                    return (
                      <TableRow key={payment.outgoingId}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{payment.randomId}</TableCell>
                        <TableCell>{payment.vendorName}</TableCell>
                        <TableCell>{payment.invoiceNo || "N/A"}</TableCell>
                        <TableCell>{payment.invoiceDate ? format(new Date(payment.invoiceDate), 'dd-MM-yyyy') : 'N/A'}</TableCell>
                        <TableCell>₹{payment.totalPayableAmount?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell>₹{totalPaidAmount.toFixed(2)}</TableCell>
                        <TableCell>{payment.paymentDate ? format(new Date(payment.paymentDate), 'dd-MM-yyyy') : 'N/A'}</TableCell>
                        <TableCell>
                          <Box
                            sx={{
                              ...getStatusStyle(payment.status || ''),
                              borderRadius: "25px",
                              padding: "4px",
                              textAlign: "center",
                            }}
                          >
                            {payment.status}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Tooltip title='View'>
                            <IconButton color='primary' onClick={() => handleViewDetails(index)}>
                              <VisibilityIcon />
                            </IconButton>
                          </Tooltip>
                          <IconButton
                            color="primary" 
                            sx={{ ml: 0.2 }}
                            onClick={() => handleDownload(payment.outgoingId ?? '')}
                          >
                            <PictureAsPdfIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  }))}
                </TableBody>
              </Table>
            </TableContainer>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'end', alignItems: 'center', mt: 2 }}>
                <IconButton
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  aria-label="Previous Page"
                >
                  <ChevronLeft />
                </IconButton>
                <Typography variant="body1" sx={{ mx: 2 }}>
                  Page {currentPage} of {Math.ceil(totalItems / pageSize)}
                </Typography>
                <IconButton
                  onClick={handleNextPage}
                  disabled={currentPage * pageSize >= totalItems}
                  aria-label="Next Page"
                >
                  <ChevronRight />
                </IconButton>
              </Box>
            </Grid>
          </Grid>
        </Grid>

        {/* FIXED: View Details Dialog */}
        <Dialog open={openDetailsDialog} onClose={handleCloseDetailsDialog} maxWidth="lg" fullWidth>
          <DialogTitle>Payment Details</DialogTitle>
          <DialogContent>
            {selectedOutgoing && (
              <Box>
                {/* Basic Information */}
                <Table>
                  <TableBody>
                     <TableRow>
                      <TableCell><strong>Outgoing Reference:</strong></TableCell>
                      <TableCell>{selectedOutgoing.randomId}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Vendor Name:</strong></TableCell>
                      <TableCell>{selectedOutgoing.vendorName}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Invoice No:</strong></TableCell>
                      <TableCell>{selectedOutgoing.invoiceNo || "N/A"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Total Payable Amount:</strong></TableCell>
                      <TableCell>₹{selectedOutgoing.payableAmount?.toFixed(2) || '0.00'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Total Paid Amount:</strong></TableCell>
                      <TableCell>₹{calculateTotalPaid(selectedOutgoing).toFixed(2)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Status:</strong></TableCell>
                      <TableCell>
                        <Box
                          sx={{
                            ...getStatusStyle(selectedOutgoing.status || ''),
                            borderRadius: "25px",
                            padding: "4px 8px",
                            textAlign: "center",
                            display: 'inline-block',
                            minWidth: '100px'
                          }}
                        >
                          {selectedOutgoing.status}
                        </Box>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                {/* Payment History */}
                {selectedOutgoing.paymentHistory && selectedOutgoing.paymentHistory.length > 0 && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Payment History
                    </Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell><strong>Date</strong></TableCell>
                            <TableCell><strong>Payment Method</strong></TableCell>
                            <TableCell><strong>Reference No</strong></TableCell>
                            <TableCell><strong>Amount</strong></TableCell>
                            <TableCell><strong>Type</strong></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedOutgoing.paymentHistory.map((payment: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell>
                                {payment.date ? format(new Date(payment.date), 'dd-MM-yyyy') : 'N/A'}
                              </TableCell>
                              <TableCell>{payment.paymentMethod || 'N/A'}</TableCell>
                              <TableCell>
                                {payment.neftNo || payment.rtgsNo || payment.chequeNo || 'N/A'}
                              </TableCell>
                              <TableCell>₹{(payment.amount || 0).toFixed(2)}</TableCell>
                              <TableCell>{payment.paymentType || 'Regular'}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow sx={{ backgroundColor: 'action.hover' }}>
                            <TableCell colSpan={4} align="right"><strong>Total Paid:</strong></TableCell>
                            <TableCell><strong>₹{calculateTotalPaid(selectedOutgoing).toFixed(2)}</strong></TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDetailsDialog} color="primary">
              Close
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={openDialog} onClose={handleCloseDialog}>
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
              onClick={generatePaidPaymentCSV}
              variant="contained"
              color="secondary"
              startIcon={<DescriptionIcon />}
            >
              Download CSV
            </Button>
            <Button onClick={handleCloseDialog}>
              Cancel
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbarOpen}
          message={snackbarMessage}
          autoHideDuration={3000}
          onClose={() => dispatch(clearSnackbarMessage())}
        />
      </Box>
    </Box>
  );
};

export default PaidPaymentComponent;