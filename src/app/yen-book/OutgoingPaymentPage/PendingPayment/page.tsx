"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
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
  Dialog,
  DialogActions,
  DialogTitle,
  Snackbar,
  IconButton,
  Tooltip,
  Autocomplete,
  DialogContent,
  FormControl,
  TextField,
} from '@mui/material';
import {
  fetchOutgoings,
  selectOutgoings,
  setSnackbarMessage,
  setSnackbarOpen,
  clearSnackbarMessage,
  fetchBank,
  selectCurrentPage,
  selectPageSize,
  selectTotalItems,
  setPagination,
  fetchVendorDetails,
  fetchActiveDebitsVendor, // Add this import
} from '../../../../features/yen-purchase/Outgoing/outgoingPaymentSlice';
import { AppDispatch } from '@/redux/store';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import PaymentIcon from '@mui/icons-material/Payment';
import YenBookPage from '../../page';
import { fetchItemwiseGrns, selectGrn } from '@/features/yen-purchase/GRN/grnSlice';
import { fetchBusinesses, fetchPhoto, selectBusinesses } from '@/features/account-setting/businessSlice';
import jsPDF from 'jspdf';
import "jspdf-autotable";
import { Outgoing, VendorDetail } from '@/Models/outgoingModel';
import { format } from 'date-fns';
import Link from 'next/link';
import Papa from 'papaparse';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import DateRangeDialog from '@/components/dateRange';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import moment from 'moment';
import SinglePaymentDialog from '@/components/yen-purchase/OutgoingComponent/SinglePayment';
import { ClearIcon } from '@mui/x-date-pickers/icons';
import { usePermissions } from "@/hooks/usePermissions";


const PendingPaymentComponent = React.memo(() => {
  const dispatch = useDispatch<AppDispatch>();
   const { hasPermission, isModuleVisible } = usePermissions();
  const canReadPartial = hasPermission("yenerp", "partialpayment", "read");

  if (!canReadPartial) {
    return (
      <Box p={2}>
        <Typography color="error">
          You do not have access to the Partial Payment module.
        </Typography>
      </Box>
    );
  }
  const { outgoings, loading, snackbarMessage, snackbarOpen, banks, outgoingvendor } = useSelector(selectOutgoings);
  const { itemwise } = useSelector(selectGrn);
  const { businesses } = useSelector(selectBusinesses);
  const currentPage = useSelector(selectCurrentPage);
  const pageSize = useSelector(selectPageSize);
  const totalItems = useSelector(selectTotalItems);
  const [selectedOutgoing, setSelectedOutgoing] = useState<any>(null);
  const [openDetailsDialog, setOpenDetailsDialog] = useState(false);
  const [openDownloadDialog, setOpenDownloadDialog] = useState(false);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [selectedVendorName, setSelectedVendorName] = useState<VendorDetail | null>(null);
  const [fetchedBusinessIds, setFetchedBusinessIds] = useState(new Set());
  const [selectionRange, setSelectionRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    key: 'selection',
  });
  const dateField = 'paymentDate';
  const StartDate = moment().utc().startOf('day').toDate();
  const EndDate = moment().utc().endOf('day').toDate();
  const [status, setStatus] = useState('Partially Paid');
  const [shouldFetch, setShouldFetch] = useState(true);
  const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'succeeded' | 'failed'>('idle');

  useEffect(() => {
    if (shouldFetch && loadingState === 'idle') {
      dispatch(fetchOutgoings({
        page: currentPage,
        size: pageSize,
        status: status,
        filterBy: dateField,
        fromDate: StartDate,
        toDate: EndDate,
      }));
      setShouldFetch(false);
    }
  }, [dispatch, currentPage, pageSize, status, StartDate, EndDate, dateField, loadingState, shouldFetch]);

  useEffect(() => {
    if (loadingState === 'idle') {
      dispatch(fetchItemwiseGrns());
      dispatch(fetchVendorDetails({ status: status }));
    }
  }, [loadingState, dispatch, status]);

  useEffect(() => {
    dispatch(fetchBusinesses());
    dispatch(fetchBank());
  }, [dispatch]);

  useEffect(() => {
    businesses.forEach((business) => {
      if (!fetchedBusinessIds.has(business.businessId)) {
        dispatch(fetchPhoto(business.businessId));
        setFetchedBusinessIds((prevSet) => new Set(prevSet).add(business.businessId));
      }
    });
  }, [businesses, fetchedBusinessIds, dispatch]);

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
      status: status,
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

  const handleViewDetails = (outgoing: any) => {
    setSelectedOutgoing(outgoing);
    setOpenDetailsDialog(true);
  };

  const handleOpenDownloadDialog = () => {
    setOpenDownloadDialog(true);
  };

  const handleCloseDownloadDialog = () => {
    setOpenDownloadDialog(false);
  };

  const handlePaymentSuccess = () => {
    dispatch(fetchOutgoings({
      page: currentPage,
      size: pageSize,
      status: status,
      filterBy: dateField,
      fromDate: StartDate,
      toDate: EndDate,
    }));
  };

  const vendorNames = Array.from(
    new Set(
      outgoings
        .filter((outgoing) => outgoing.status === 'Partially Paid')
        .map((outgoing) => outgoing.vendorName)
    )
  );

  const handleVendorChange = (
    event: React.SyntheticEvent,
    newValue: VendorDetail | null,
    reason: string
  ) => {
    setSelectedVendorName(newValue);
  };

  const handleFilterClick = () => {
    let filtered = outgoings;
    const formattedStartDate = selectionRange?.startDate instanceof Date ? moment(selectionRange.startDate).startOf('day').toDate() : StartDate;
    const formattedEndDate = selectionRange?.endDate instanceof Date ? moment(selectionRange.endDate).endOf('day').toDate() : EndDate;

    if (selectedVendorName && selectedVendorName.vendorName) {
      filtered = filtered.filter((outgoing) =>
        outgoing.vendorName?.toLowerCase().includes(selectedVendorName.vendorName.toLowerCase())
      );
    }

    if (formattedStartDate) {
      filtered = filtered.filter((outgoing) => {
        const paymentDateParsed = outgoing.paymentDate ? new Date(outgoing.paymentDate) : null;
        return paymentDateParsed && paymentDateParsed >= formattedStartDate;
      });
    }

    if (formattedEndDate) {
      filtered = filtered.filter((outgoing) => {
        const paymentDateParsed = outgoing.paymentDate ? new Date(outgoing.paymentDate) : null;
        return paymentDateParsed && paymentDateParsed <= formattedEndDate;
      });
    }

    dispatch(
      fetchOutgoings({
        page: currentPage,
        size: pageSize,
        fromDate: formattedStartDate instanceof Date ? formattedStartDate : undefined,
        toDate: formattedEndDate instanceof Date ? formattedEndDate : undefined,
        vendorName: selectedVendorName?.vendorName,
        filterBy: 'paymentDate',
        status: status,
      })
    )
      .then((response) => {
        let data: Outgoing[] = [];
        if (typeof response.payload === 'string') {
          console.error('Error response:', response.payload);
          dispatch(setSnackbarMessage(response.payload));
          dispatch(setSnackbarOpen(true));
        } else if (Array.isArray(response.payload)) {
          data = response.payload;
        } else if (response.payload && typeof response.payload === 'object' && 'outgoings' in response.payload) {
          data = response.payload.outgoings;
        }

        if (data.length === 0) {
          console.log('No matching outgoing found.');
          dispatch(setSnackbarMessage('No matching Outgoing Payment found.'));
          dispatch(setSnackbarOpen(true));
        }
      })
      .catch((error) => {
        console.error('Error fetching outgoing:', error);
        dispatch(setSnackbarMessage(error.message || 'Error fetching outgoing'));
        dispatch(setSnackbarOpen(true));
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
      status: status,
      filterBy: dateField,
      fromDate: StartDate,
      toDate: EndDate,
    }));
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
    doc.text("Pending Payment Invoice Summary", titleX, yOffset + 10);
    const titleWidth = doc.getTextWidth("Pending Payment Invoice Summary");
    doc.setLineWidth(0.1);
    doc.line(titleX, yOffset + 12, titleX + titleWidth, yOffset + 12);

    yOffset += 25;
    const totalPayableAmount = filteredPayments.reduce((sum, outgoing) => sum + (outgoing.totalPayableAmount || 0), 0);
    const today = new Date();
    const currentDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
    doc.setFontSize(10);
    doc.text(`Total Payable Amount: ${totalPayableAmount.toFixed(2)}`, 145, yOffset);
    doc.text(`Date: ${currentDate}`, 14, yOffset);

    yOffset += 5;
    const headers = [
      ["S.No", "Outgoing ID", "Vendor Name", "Invoice No", "InvoiceDate", "Total Invoice Amount", "Final Amount"],
    ];
    const rows = filteredPayments.map((outgoing, index) => {
      const totalPayableAmount = outgoing.totalPayableAmount || 0;
      const totalDiscount = outgoing.discountDetails || 0;
      const finalAmount = totalPayableAmount - totalDiscount;

      if (!outgoing.randomId || !outgoing.vendorName || !outgoing.invoiceDate || totalPayableAmount <= 0) {
        return null;
      }

      return [
        `${index + 1}`,
        outgoing.randomId.toString(),
        outgoing.vendorName.toString(),
        outgoing.invoiceNo,
        outgoing.invoiceDate ? format(new Date(outgoing.invoiceDate), 'dd-MM-yyyy') : 'Not Provided',
        outgoing.payableAmount,
        outgoing.totalPayableAmount || '',
      ];
    }).filter(row => row !== null);

    if (rows.length === 0) {
      doc.text("No valid outgoing to display.", 10, 30);
      doc.save("Nooutgoing.pdf");
      return;
    }

    doc.autoTable({
      head: headers,
      body: rows,
      startY: yOffset,
      styles: { fillColor: [30, 144, 255], textColor: [255, 255, 255], lineColor: [0, 0, 0], fontSize: 8 },
      headStyles: { fillColor: [0, 0, 128], textColor: [255, 255, 255] },
      bodyStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0] },
      columnStyles: { 4: { halign: 'left' }, 5: { halign: 'left' } },
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
    doc.save("Pendingpayment.pdf");
    handleCloseDownloadDialog();
  };

  const generateOutgoingSummaryCSV = () => {
    const headers = [
      ["S.No", "Outgoing ID", "Vendor Name", "Invoice No", "Invoice Date", "Total Invoice Amount", "Remaining Amount"],
    ];
    const rows = filteredPayments.map((outgoing, index) => {
      const totalPayableAmount = outgoing.totalPayableAmount || 0;
      const totalDiscount = outgoing.discountDetails || 0;
      const finalAmount = totalPayableAmount - totalDiscount;
      const remainingAmount = outgoing.partialAmount || 0;
      const randomId = outgoing.randomId || 'N/A';

      if (!outgoing.vendorName) {
        return null;
      }

      return [
        `${index + 1}`,
        randomId.toString(),
        outgoing.vendorName.toString(),
        outgoing.invoiceNo,
        outgoing.invoiceDate ? format(new Date(outgoing.invoiceDate), 'dd-MM-yyyy') : 'Not Provided',
        remainingAmount.toFixed(2),
        finalAmount.toFixed(2),
      ];
    }).filter(row => row !== null);

    const csvData = [headers[0], ...rows];
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "PendingpaymentSummary.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    handleCloseDownloadDialog();
  };
const handleDownload = async (outgoingId: string) => {
  const outgoingdetail = outgoings.find((outgoing) => outgoing.outgoingId === outgoingId);
  if (!outgoingdetail) {
    console.error('Outgoing not found!');
    return;
  }

  const business = businesses.length > 0 ? businesses[0] : null;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let yOffset = 20; // Start with more space for header

  // Add logo centered at the top
  if (business && business.imageUrl) {
    try {
      const logoWidth = 25;
      const logoX = (pageWidth - logoWidth) / 2; // Center the logo
      doc.addImage(business.imageUrl, 'JPEG', logoX, 10, logoWidth, 25); // Centered logo
    } catch (e) {
      console.error("Image failed to load:", e);
    }
  }

  // Title "Partial Payment" centered below the logo
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 128);
  const titleX = pageWidth / 2; // Center the title
  doc.text('Partial Payment', titleX, 45, { align: 'center' });

  // Underline below the title, centered
  const titleWidth = doc.getTextWidth('Partial Payment');
  const underlineX = titleX - (titleWidth / 2);
  doc.setDrawColor(0, 0, 128);
  doc.setLineWidth(0.5);
  doc.line(underlineX, 47, underlineX + titleWidth, 47);

  // Adjust yOffset for next content
  yOffset = 55; // Space after header

  const relatedOutgoings = outgoings.filter(outgoing => outgoing.grnId === outgoingdetail.grnId);
  if (relatedOutgoings.length === 0) {
    console.error('No related outgoing items found!');
    return;
  }

  for (const outgoing of relatedOutgoings) {
    const paymentMethod = outgoing.paymentMethod;
    let paymentDetails = '';
    if (paymentMethod === 'neft') {
      paymentDetails = `NEFT No: ${outgoing.neftNo}`;
    } else if (paymentMethod === 'rtgs') {
      paymentDetails = `RTGS No: ${outgoing.rtgsNo}`;
    }

    // Add Payment details to the PDF
    doc.setFontSize(10);
    doc.text(`Payment Method: ${paymentMethod}`, 14, yOffset);
    doc.text(paymentDetails, 14, yOffset + 10);

    yOffset += 20;

    // Vendor and Business Details
    const vendorDetailsRows = [
      [
        `Vendor Name: ${outgoing.vendorName || ''}\n` +
        `GSTIN: ${outgoing.gstNumber || ''}\n` +
        `Address: ${outgoing.address || ''}\n` +
        `City: ${outgoing.city || ''}\n` +
        `State: ${outgoing.state || ''}\n` +
        `Country: ${outgoing.country || ''}\n` +
        `Email: ${outgoing.contactpersonEmail || ''}`,
        `Business Name: ${business?.companyName || ''}\n` +
        `GSTIN: ${business?.gstIn || ''}\n` +
        `Address: ${business?.address1 || ''}\n` +
        `Phone: ${business?.phoneNo || ''}\n` +
        `Email: ${business?.emailId || ''}`,
        `Outgoing No: ${outgoing.randomId}\n` +
        `PO No: ${outgoing.poRandomId}\n` +
        `GRN No: ${outgoing.grnRandomId}\n` +
        `AP No: ${outgoing.apRandomId}\n` +
        `Date: ${outgoing.createdDate ? format(new Date(outgoing.createdDate), 'dd-MM-yyyy') : ''}`
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

    yOffset = doc.autoTable.previous.finalY; // Set to finalY directly to avoid extra space

    // Items Table Header
    const itemHeader = [
      'Invoice No',
      'Invoice Date',
      'Vendor Name',
      'Item Name',
      'Tax Details',
      'Tax Amount',
      'Without Tax Value',
      'With Tax Value'
    ];

    const filteredItems = outgoing.grnId
      ? itemwise.filter(grn => grn.grnId === outgoing.grnId).flatMap(grn => grn.itemDetails)
      : []; // Default empty array if no matching grnId

    const tableRows = filteredItems.length > 0
      ? filteredItems.map((item) => {
        const unitPrice = item.unitPrice || 0;
        const quantity = item.quantity || 0;
        const withoutTaxValue = unitPrice * quantity;
        const taxAmount = withoutTaxValue * (item.purchasetaxName / 100);
        const withTaxValue = withoutTaxValue + taxAmount;

        return [
          outgoing.invoiceNo || 'N/A',  // Invoice No
          outgoing.invoiceDate ? format(new Date(outgoing.invoiceDate), 'dd-MM-yyyy') : 'Not Provided',  // Invoice Date
          outgoing.vendorName || 'N/A',  // Vendor Name
          item.itemName,
          `${item.purchasetaxName}%`,  // Tax Details
          taxAmount.toFixed(2),  // Tax Amount
          withoutTaxValue.toFixed(2),  // Without Tax Value (corrected)
          withTaxValue.toFixed(2),  // With Tax Value (corrected)
        ];
      })
      : [
        [
          outgoing.invoiceNo || '',  // Invoice No
          outgoing.invoiceDate ? format(new Date(outgoing.invoiceDate), 'dd-MM-yyyy') : 'Not Provided',  // Invoice Date
          outgoing.vendorName || 'N/A',  // Vendor Name
          'N/A',
          'N/A',  // Tax Details (No items, no tax)
          '0.00',  // Tax Amount
          '0.00',  // Without Tax Value
          '0.00',  // With Tax Value
        ]
      ];  // Fallback row for when there are no items

    doc.autoTable({
      head: [itemHeader],
      body: tableRows,
      startY: yOffset,
      theme: 'grid',
      styles: { fontSize: 8, halign: 'center', cellPadding: 2 },
      headStyles: { fillColor: [0, 0, 128], textColor: [255, 255, 255], lineWidth: 0.1, lineColor: [0, 0, 0] },
      bodyStyles: { lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], },
      columnStyles: {
        0: { halign: 'center' },
        1: { halign: 'left' },
        2: { halign: 'left' },
        3: { halign: 'left' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
      },
    });

    yOffset = doc.autoTable.previous.finalY; // Directly use finalY to avoid any spacing

    // Overall Total Payable Amount
    const discount = outgoing.discountDetails || 0;
    const totalPayableAmount = outgoing.totalPayableAmount || 0;
    const partialAmount = outgoing.partialAmount || 0;

    let paidAmount = partialAmount; // For partially paid

    // Now you can update the summaryTable with payment status, paid amount, and pending amount.
    const summaryTable = [
      ['Discount', discount.toFixed(2)],
      ['Paid Amount', paidAmount.toFixed(2)],
      ['Total Payable Amount', totalPayableAmount.toFixed(2)],

    ];

    doc.autoTable({
      head: [['Description', 'Amount']],
      body: summaryTable,
      startY: yOffset,
      theme: 'grid',
      styles: { fontSize: 8, halign: 'right', cellPadding: 2 },
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.1 },
      bodyStyles: { lineColor: [0, 0, 0], lineWidth: 0.1 },
    });

    yOffset = doc.autoTable.previous.finalY + 10; // Space below summary table

    // Determine status image based on status
    let statusImage = '';
    if (outgoing.status === 'active') {
      statusImage = '/images/pending.jpeg'; // Path to the pending image
    } else if (outgoing.status === 'Partially Paid') {
      statusImage = '/images/partial.jpg'; // Path to the partially paid image
    } else if (outgoing.status === 'Advance Paid') {
      statusImage = '/images/advancecash.jpg'; // Path to the advance paid image
    }

    // If a status image exists, add it to the PDF below the table, centered
    if (statusImage) {
      const img = new Image();
      img.src = statusImage;

      // Wait for image to load before adding to the document
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          const imgWidth = 30;
          const imgX = (pageWidth - imgWidth) / 2; // Center the image
          doc.addImage(img, 'jpg', imgX, yOffset, imgWidth, 25);
          resolve();
        };
        img.onerror = reject;
      });
    }

    yOffset += 40; // Additional space after image for next section if any
  }

  // Add footer with "This is computer generated" and page number to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(0);
    const pageY = doc.internal.pageSize.height - 10;
    const computerGeneratedY = pageY - 10;
    doc.text("This is computer generated", pageWidth / 2, computerGeneratedY, { align: 'center' });
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageY, { align: 'center' });
  }

  // Save the PDF with a dynamic name based on outgoing order ID
  doc.save(`${outgoingdetail.vendorName} ${outgoingdetail.randomId}_PartialPayment.pdf`);
};  
const filteredPayments = outgoings.filter(outgoing => outgoing.status === 'Partially Paid');

  return (
    <Box>
      <YenBookPage />
      <Box sx={{ p: 1, backgroundColor: 'white', m: 1 }}>
        <Box display="flex" alignItems="center" mb={2}>
          <Grid container spacing={1} alignItems="center" justifyContent="flex-start">
            <Grid container spacing={1} alignItems="center" ml={0.3}>
              {isModuleVisible("yenerp", "outgoingpayment") && (
                <Grid item>
                  <Link href="/yen-book/OutgoingPaymentPage" passHref>
                    <Button variant="contained" color="primary">
                      Outgoing Payment
                    </Button>
                  </Link>
                </Grid>
              )}
              <Grid item>
                {isModuleVisible("yenerp", "advancepayment") && (
                  <Link
                    href="/yen-book/OutgoingPaymentPage/PreOutgoing"
                    passHref
                  >
                    <Button variant="contained" color="primary">
                      Advance Payment
                    </Button>
                  </Link>
                )}
              </Grid>
              {/* <Grid item>
                <Link href="/yen-book/OutgoingPaymentPage/AdvancePayment" passHref>
                  <Button variant="contained" color="primary">Advance Payment</Button>
                </Link>
              </Grid> */}
                 {isModuleVisible("yenerp", "partialpayment") && (
                <Grid item>
                  <Link
                    href="/yen-book/OutgoingPaymentPage/PendingPayment"
                    passHref
                  >
                    <Button
                      variant="contained"
                      sx={{
                        backgroundColor: "white",
                        color: "black",
                        "&:hover": {
                          backgroundColor: "rgba(255, 255, 255, 0.8)",
                        },
                      }}
                    >
                      Partial Payment
                    </Button>
                  </Link>
                </Grid>
              )}
              <Grid item>
                {isModuleVisible("yenerp", "paymentdone") && (
                  <Link
                    href="/yen-book/OutgoingPaymentPage/PaidPayment"
                    passHref
                  >
                    <Button variant="contained" color="primary">
                      Payment Done
                    </Button>
                  </Link>
                )}
              </Grid>
             {isModuleVisible("yenerp", "ledger") && (
                <Grid item>
                  <Link href="/yen-book/OutgoingPaymentPage/Ledger" passHref>
                    <Button variant="contained" color="primary">
                      Ledger
                    </Button>
                  </Link>
                </Grid>
              )}
                    <Grid item>
                {isModuleVisible("yenerp", "purchasereturn") && (
                  <Link
                    href="/yen-book/OutgoingPaymentPage/PurchaseReturn"
                    passHref
                  >
                    <Button variant="contained" color="primary">
                      Purchase Return
                    </Button>
                  </Link>
                )}
              </Grid>
            </Grid>

            <Grid container spacing={2} alignItems="center" sx={{ mt: 0.5, ml: 0 }}>
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
                        InputProps={{ ...params.InputProps, style: { fontSize: '12px' } }}
                      />
                    )}
                    sx={{ fontSize: '12px' }}
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
                  <Typography variant="caption" align="center" sx={{ maxWidth: 60, wordBreak: 'break-word', mt: 0.2 }}>
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
                  <Typography variant="caption" align="center" sx={{ maxWidth: 60, wordBreak: 'break-word', mt: 0.2 }}>
                    Clear
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs sx={{ flexGrow: 1 }} />
              <Grid item xs="auto">
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <IconButton
                    onClick={handleOpenDownloadDialog}
                    color="primary"
                    className="icon-button-outline"
                    size="small"
                    sx={{ p: 0.3 }}
                    disabled={!filteredPayments || filteredPayments.length === 0}
                  >
                    <DownloadIcon fontSize="small" />
                  </IconButton>
                  <Typography variant="caption" align="center" sx={{ maxWidth: 60, wordBreak: 'break-word', mt: 0.2 }}>
                    Download
                  </Typography>
                </Box>
              </Grid>
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
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>No</TableCell>
                    <TableCell>Vendor Name</TableCell>
                    <TableCell>Invoice No</TableCell>
                    <TableCell>Invoice Date</TableCell>
                    <TableCell>Total Amount</TableCell>
                    <TableCell>Amount Paid</TableCell>
                    <TableCell>Payment Date</TableCell>
                    <TableCell>Discount Amount</TableCell>
                    <TableCell>Payable Amount</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} style={{ textAlign: 'center' }}>
                        No data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.map((payment, index) => {
                      const totalPaid = payment.paymentHistory?.reduce((sum, history) => sum + (history.amount || 0), 0) || 0;
                      const totalAmount = totalPaid + (payment.totalPayableAmount || 0);

                      return (
                        <TableRow key={payment.outgoingId}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{payment.vendorName}</TableCell>
                          <TableCell>{payment.invoiceNo || 'N/A'}</TableCell>
                          <TableCell>{payment.invoiceDate ? format(new Date(payment.invoiceDate), 'dd-MM-yyyy') : 'N/A'}</TableCell>
                          <TableCell>{totalAmount.toFixed(2)}</TableCell>
                          <TableCell>{totalPaid.toFixed(2)}</TableCell>
                          <TableCell>{payment.paymentDate ? format(new Date(payment.paymentDate), 'dd-MM-yyyy') : 'N/A'}</TableCell>
                          <TableCell>{payment.discountDetails?.toFixed(2) || '0.00'}</TableCell>
                          <TableCell>{(payment.totalPayableAmount || 0).toFixed(2)}</TableCell>
                          <TableCell>
                            <Tooltip title='Pay'>
                              <IconButton
                                color='primary'
                                onClick={() => handleViewDetails(payment)}
                                disabled={selectedRows.length > 1}
                              >
                                <PaymentIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title='Download'>
                              <IconButton
                                color="primary"
                                sx={{ ml: 0.2 }}
                                onClick={() => handleDownload(payment.outgoingId ?? '')}
                              >
                                <PictureAsPdfIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'end', alignItems: 'center' }}>
                <IconButton
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  aria-label="Previous Page"
                >
                  <ChevronLeft />
                </IconButton>
                <Typography variant="body1" sx={{ mx: 2 }}>
                  Page {currentPage}
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

        <SinglePaymentDialog
          open={openDetailsDialog}
          onClose={() => setOpenDetailsDialog(false)}
          selectedOutgoing={selectedOutgoing}
          currentPage={currentPage}
          pageSize={pageSize}
          dateField={dateField}
          onPaymentSuccess={handlePaymentSuccess}
        />

        <Dialog open={openDownloadDialog} onClose={handleCloseDownloadDialog}>
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
            <Button onClick={handleCloseDownloadDialog}>
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
});

PendingPaymentComponent.displayName = 'PendingPaymentComponent';

export default PendingPaymentComponent;