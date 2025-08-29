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
  DialogContent,
  Dialog,
  DialogActions,
  DialogTitle,
  MenuItem,
  TextField,
  Snackbar,
  SelectChangeEvent,
  FormControl,
  Select,
  IconButton,
  Tooltip,
  AutocompleteChangeReason,
  Autocomplete,
} from '@mui/material';
import {
  fetchOutgoings,
  selectOutgoings,
  processPayment,
  setSnackbarMessage,
  setSnackbarOpen,
  clearSnackbarMessage, fetchBank, selectCurrentPage,
  selectPageSize,
  selectTotalItems, setPagination,
  fetchVendorDetails
} from '../../../../features/yen-purchase/Outgoing/outgoingPaymentSlice'; // Adjust the path as needed
import { AppDispatch } from '@/redux/store';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';  // CSV icon
import FilterAltIcon from '@mui/icons-material/FilterAlt'; // Import the filter icon
import PaymentIcon from '@mui/icons-material/Payment'; // Import Payment icon
import YenBookPage from '../../page';
import { fetchItemwiseGrns, fetchGrnById, selectGrn } from '@/features/yen-purchase/GRN/grnSlice';
import jsPDF from 'jspdf';
import "jspdf-autotable"; // Ensure this plugin is available for autoTable functionality
import { fetchBusinesses, fetchPhoto, selectBusinesses } from '@/features/account-setting/businessSlice';
import { GrnData } from '@/Models/grnModel';
import DateRangeFilter from '@/components/agingFilter';
import { Outgoing, VendorDetail } from '@/Models/outgoingModel';
import { format } from 'date-fns';
import Link from 'next/link';
import Papa from 'papaparse';
import { ChevronLeft, ChevronRight, Newspaper } from '@mui/icons-material';
import { ClearIcon } from '@mui/x-date-pickers/icons';
import DateRangeDialog from '@/components/dateRange';
import 'react-date-range/dist/styles.css'; // main style file
import 'react-date-range/dist/theme/default.css'; // theme css file
import moment from 'moment';

const PendingPaymentComponent = React.memo(() => {
  const dispatch = useDispatch<AppDispatch>();
  const { outgoings, loading, snackbarMessage, snackbarOpen, banks, outgoingvendor } = useSelector(selectOutgoings);
  const [selectedOutgoing, setSelectedOutgoing] = useState<any>(null);
  const [openDetailsDialog, setOpenDetailsDialog] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const { itemwise } = useSelector(selectGrn);
  const { businesses } = useSelector(selectBusinesses);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [paymentDetailsToSend, setPaymentDetailsToSend] = useState<any>(null);
  const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'succeeded' | 'failed'>('idle');
  const [fetchedBusinessIds, setFetchedBusinessIds] = useState(new Set());
  const [selectedVendorName, setSelectedVendorName] = useState<VendorDetail | null>(null); // Default is null  const [openDialog, setOpenDialog] = useState(false);  // Control dialog visibility
  const [paymentDetails, setPaymentDetails] = useState<{
    paymentMethod: string;
    chequeNo: number;
    transactionNumber: string;
    neftNo: string;
    cashVoucherNo: string;
    amount: string;
    bankName: string;
    paymentType: "full" | "partial" | "advance"; // Explicitly typed
    rtgsNo: string;
    paymentMode: "Cash" | "Bank"; // Add paymentMode here
    pettyCashAmount: number; // Add pettyCashAmount for Cash payment mode
    hoCash: number; // Add hoCash for Cash payment mode
    upi: string; // Add upi for UPI payment method
    impsNo: string; // Add impsNo for IMPS payment method
  }>({
    paymentMethod: '',
    chequeNo: 0,
    transactionNumber: '',
    neftNo: '',
    cashVoucherNo: '',
    amount: '',
    bankName: '',
    paymentType: 'advance', // Default value
    rtgsNo: '',
    paymentMode: 'Cash', // Default value for paymentMode (Cash or Bank)
    pettyCashAmount: 0, // Default value for pettyCashAmount
    hoCash: 0, // Default value for hoCash
    upi: '', // Default value for upi
    impsNo: '', // Default value for impsNo
  });
  const [totalpayment, setTotalPayment] = useState<number>(); // Initialize totalpayment as a number
  const [filteredOutgoing, setFilteredOutgoing] = useState<Outgoing[]>([]); // Explicit type declaration
  const [status, setStatus] = useState('Partially Paid'); // Default status filter is "Pending"
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
  const StartDate = moment().utc().startOf('day').toDate(); // Start of the month
  const EndDate = moment().utc().endOf('day').toDate(); // End of the month
  const [error, setError] = useState<string>('');
  const [shouldFetch, setShouldFetch] = useState(true);

  useEffect(() => {
    if (shouldFetch && loadingState === 'idle') {
      const action = fetchOutgoings({
        page: newPage,
        size: pageSize,
        status: status,
        filterBy: dateField,
        fromDate: StartDate,
        toDate: EndDate
      });
      dispatch(action);
      setShouldFetch(false);
    }
  }, [dispatch, newPage, pageSize, status, StartDate, EndDate, dateField, loadingState, shouldFetch]); // Added loadingState
  useEffect(() => {
    if (loadingState === 'idle') {
      dispatch(fetchItemwiseGrns());
      dispatch(fetchVendorDetails({ status: status }));
    }
  }, [loadingState, dispatch, status]); // Added status
  useEffect(() => {
    dispatch(fetchBusinesses());
    dispatch(fetchBank());
  }, [dispatch]);
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > Math.ceil(totalItems / pageSize)) {
      return;
    }
    const appliedFromDate = selectionRange?.startDate instanceof Date ? moment(selectionRange.startDate).startOf('day').toDate() : StartDate;
    const appliedToDate = selectionRange?.endDate instanceof Date ? moment(selectionRange.endDate).endOf('day').toDate() : EndDate;
    dispatch(setPagination({ page: newPage, size: pageSize }));
    dispatch(fetchOutgoings({
      page: newPage, size: pageSize, status: status, filterBy: dateField,
      fromDate: appliedFromDate, vendorName: selectedVendorName?.vendorName,
      toDate: appliedToDate
    }));
  };

  const handleNextPage = () => {
    if (currentPage * pageSize) {
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
  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const parseDate = (dateStr: any) => {
    if (!dateStr || typeof dateStr !== 'string') {
      throw new Error('Invalid date string');
    }

    const [day, month, year] = dateStr.split('/');

    // Check if date is in valid format (DD/MM/YYYY)
    if (!day || !month || !year || day.length !== 2 || month.length !== 2 || year.length !== 4) {
      throw new Error('Invalid date string format');
    }

    return new Date(`${year}-${month}-${day}`);
  };
  const handlePaymentMethodChange = (e: React.ChangeEvent<{ value: unknown }>) => {
    const selectedMethod = e.target.value as string;
    setPaymentDetails(prevDetails => ({
      ...prevDetails,
      paymentMethod: selectedMethod,
    }));
  };
  const generateOutgoingInvoicePDF = () => {
    // Initialize jsPDF instance
    const doc = new jsPDF();

    // Starting yOffset for content
    let yOffset = 10;

    // Define the logo and title position
    const logoX = 12;  // Position for logo
    const titleX = 80; // Position for title and summary text (adjusted to make space for the logo)

    // Add business image on the left side (adjust as needed)
    const business = businesses.length > 0 ? businesses[0] : null;

    if (business && business.imageUrl) {
      try {
        doc.addImage(business.imageUrl, 'JPEG', logoX, yOffset, 20, 20);  // Adjust image size and position
      } catch (e) {
        console.error("Image failed to load:", e);
      }
    }

    doc.setFontSize(12);  // Increase title font size
    doc.text("Pending Payment Invoice Summary", titleX, yOffset + 10);  // Title at the top next to the logo

    // Calculate the width of the title text
    const titleWidth = doc.getTextWidth("Pending Payment Invoice Summary");

    // Draw a line under the title
    const lineY = yOffset + 12; // Position of the line (slightly below the text)
    doc.setLineWidth(0.1); // Set line width
    doc.line(titleX, lineY, titleX + titleWidth, lineY); // Draw line from start to end of the title


    // Update yOffset for next row content (Date and Amount)
    yOffset += 25;  // Adjust position for the next content

    // Calculate the total ordered amount before generating the table
    const totalPayableAmount = (filteredPayments || []).reduce((sum, outgoing) => {
      const totalPayableAmount = outgoing.totalPayableAmount || 0;  // Ensure it's a number
      return sum + totalPayableAmount;
    }, 0);

    // Current date formatting
    const today = new Date();
    const currentDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

    // Display the "Total Payable Amount" and "Date" in the next row
    doc.setFontSize(10);
    doc.text(`Total Payable Amount: ${totalPayableAmount.toFixed(2)}`, 145, yOffset);  // Left-align amount
    doc.text(`Date: ${currentDate}`, 14, yOffset);  // Right-align date

    yOffset += 5;  // Adjust space before the table

    // Table headers for summary data
    const headers = [
      ["S.No", "Outgoing ID", "Vendor Name", "Invoice No", "InvoiceDate", "Total Invoice Amount", "Final Amount"],
    ];

    // Prepare rows for purchase order summary (filter only the valid orders)
    const rows = (filteredPayments || []).map((outgoing, index) => {
      const totalPayableAmount = outgoing.totalPayableAmount || 0;
      const totalDiscount = outgoing.discountDetails || 0;
      const finalAmount = totalPayableAmount - totalDiscount;

      if (!outgoing.randomId || !outgoing.vendorName || !outgoing.invoiceDate || totalPayableAmount <= 0) {
        return null;  // Skip invalid rows
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

    // If no rows are available, handle the case
    if (rows.length === 0) {
      doc.text("No valid outgoing to display.", 10, 30);  // Optional message
      doc.save("Nooutgoing.pdf");  // Save a PDF with the message
      return;
    }

    // Add the table to the PDF with custom styles
    doc.autoTable({
      head: headers,
      body: rows,
      startY: yOffset,  // Start the table below the "Total Ordered Amount"
      styles: {
        fillColor: [30, 144, 255],  // DodgerBlue color
        textColor: [255, 255, 255], // White text color
        lineColor: [0, 0, 0],       // Black table borders
        fontSize: 8
      },
      headStyles: {
        fillColor: [0, 0, 128],  // DodgerBlue background for the header
        textColor: [255, 255, 255]  // White text color for header
      },
      bodyStyles: {
        fillColor: [255, 255, 255],  // White background for rows
        textColor: [0, 0, 0]         // Black text color for rows
      },
      columnStyles: {
        4: { halign: 'left' },  // Right-align "Total Order Amount"
        5: { halign: 'left' }   // Right-align "Final Amount"
      }
    });
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${totalPages}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }
    // Save the PDF with a dynamic name based on purchase order ID
    const pdfFilename = `Pendingpayment.pdf`;
    doc.save(pdfFilename);
    handleCloseDialog();
  };


  const vendorNames = Array.from(
    new Set(
      outgoings
        .filter(outgoing => outgoing.status === 'Partially Paid') // Filters out null and zero totalPayableAmount
        .map(outgoing => outgoing.vendorName) // Maps to vendorName
    )
  );

  const handlePaymentTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedType = e.target.value as "full" | "partial" | "advance"; // Explicitly cast to the type
    setPaymentDetails(prevDetails => ({
      ...prevDetails,
      paymentType: selectedType,
      amount: selectedType === 'full' && selectedOutgoing
        ? selectedOutgoing.totalPayableAmount?.toString() ?? ''
        : '',
    }));
    setError('');
  };
  const handleVendorChange = (
    event: React.SyntheticEvent,
    newValue: VendorDetail | null, // `newValue` is a VendorDetail or null
    reason: AutocompleteChangeReason
  ) => {
    setSelectedVendorName(newValue); // Set the selected vendor directly
  };

  const handleFilterClick = () => {
    let filtered = outgoings;

    // Ensure proper date handling with Date objects
    const formattedStartDate = selectionRange?.startDate instanceof Date ? moment(selectionRange.startDate).startOf('day').toDate() : StartDate;
    const formattedEndDate = selectionRange?.endDate instanceof Date ? moment(selectionRange.endDate).endOf('day').toDate() : EndDate;

    // Filter based on selected vendor name
    if (selectedVendorName && selectedVendorName.vendorName) {
      filtered = filtered.filter((outgoing) =>
        outgoing.vendorName?.toLowerCase().includes(selectedVendorName.vendorName.toLowerCase())
      );
    }

    // Filter based on start date
    if (formattedStartDate) {
      filtered = filtered.filter(outgoing => {
        const paymentDateParsed = outgoing.paymentDate
          ? new Date(outgoing.paymentDate) : null;
        // Only compare dates if invoiceDateParsed is valid
        return paymentDateParsed && paymentDateParsed >= formattedStartDate;
      });
    }

    // Filter based on end date
    if (formattedEndDate) {
      filtered = filtered.filter(outgoing => {
        const paymentDateParsed = outgoing.paymentDate
          ? new Date(outgoing.paymentDate) // Ensure invoiceDate is formatted as a string
          : null;
        // Only compare dates if invoiceDateParsed is valid
        return paymentDateParsed && paymentDateParsed <= formattedEndDate;
      });
    }

    // Send filters to the backend
    dispatch(
      fetchOutgoings({
        page: newPage,
        size: pageSize,
        fromDate: formattedStartDate instanceof Date ? formattedStartDate : undefined,
        toDate: formattedEndDate instanceof Date ? formattedEndDate : undefined,
        vendorName: selectedVendorName?.vendorName, // Use vendorName from selectedVendorName object
        filterBy: 'paymentDate',
        status: status
      })
    )
      .then((response) => {
        const data = response.payload || [];

        if (data.length === 0) {
          console.log('No matching outgoing found.');
          setSnackbarMessage('No matching Outgoing Payment found.');
          setSnackbarOpen(true);
        } else {
          setFilteredOutgoing(data); // Update filtered orders state with the data from the backend
        }
      })
      .catch((error) => {
        console.error('Error fetching outgoing:', error);
        setSnackbarMessage(error.message || 'Error fetching outgoing');
        setSnackbarOpen(true);
      });
  };

  const handleFilterClose = () => {
    // Reset filter states (except for the date)
    setSelectionRange({
      startDate: new Date(),  // Set to current date
      endDate: new Date(),    // Set to current date
      key: 'selection',       // Retain the key
    });
    setStatus(''); // Clear status filter
    setSelectedVendorName(null);
    dispatch(fetchOutgoings({
      page: 1, size: pageSize, status: status, filterBy: dateField,
      fromDate: StartDate,
      toDate: EndDate
    }));
  }

  useEffect(() => {
    businesses.forEach((business) => {
      if (!fetchedBusinessIds.has(business.businessId)) {
        dispatch(fetchPhoto(business.businessId));
        setFetchedBusinessIds(prevSet => new Set(prevSet).add(business.businessId));
      }
    });
  }, [businesses, fetchedBusinessIds, dispatch]);
  const handleDownload = async (outgoingId: string) => {
    const outgoingdetail = outgoings.find((outgoing) => outgoing.outgoingId === outgoingId);

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
    doc.text('Pending Payment', 90, yOffset + 5);

    // Add underline
    const textWidth = doc.getTextWidth('Pending Payment'); // Get the width of the text
    doc.setDrawColor(0, 0, 128); // Set underline color (same as text color)
    doc.line(90, yOffset + 7, 90 + textWidth, yOffset + 7); // Draw the underline

    yOffset += 10;
    // Add Business Logo if available
    if (business && business.imageUrl) {
      try {
        let logoX = 20; // Position for the logo horizontally
        let yOffset = 5; // Position for the content vertically
        doc.addImage(business.imageUrl, 'JPEG', logoX, yOffset, 20, 20);  // Adjust image size and position
      } catch (e) {
        console.error("Image failed to load:", e);
      }
    }


    const relatedOutgoings = outgoings.filter(outgoing => outgoing.grnId === outgoingdetail.grnId);
    if (relatedOutgoings.length === 0) {
      console.error('No related outgoing items found!');
      return;
    }

    for (const outgoing of relatedOutgoings) {
      let yOffset = 15;
      // Payment Details Section
      const paymentMethod = outgoingdetail.paymentMethod || 'Not Provided';
      let paymentDetails = '';

      if (paymentMethod === 'cash') {
        paymentDetails = `Cash Voucher No: ${outgoingdetail.cashVoucherNo || 'Not Provided'}`;
      } else if (paymentMethod === 'neft') {
        paymentDetails = `NEFT No: ${outgoingdetail.neftNo || 'Not Provided'}`;
      } else if (paymentMethod === 'rtgs') {
        paymentDetails = `RTGS No: ${outgoingdetail.rtgsNo || 'Not Provided'}`;
      }

      // Add Payment details to the PDF
      doc.setFontSize(10);
      doc.text(`Payment Method: ${paymentMethod}`, 14, yOffset + 10);
      doc.text(paymentDetails, 14, yOffset + 20);

      yOffset += 20;
      // Vendor and Business Details
      const vendorDetailsRows = [
        [
          `Vendor Name: ${outgoingdetail.vendorName || 'Not Provided'}\n` +
          `GSTIN: ${outgoingdetail.gstNumber || 'Not Provided'}\n` +
          `Address: ${outgoingdetail.address || 'Not Provided'}\n` +
          `City: ${outgoingdetail.city || 'Not Provided'}\n` +
          `State: ${outgoingdetail.state || 'Not Provided'}\n` +
          `Country: ${outgoingdetail.country || 'Not Provided'}\n` +
          `Email: ${outgoingdetail.contactpersonEmail || 'Not Provided'}`,
          `Business Name: ${business?.companyName || ''}\n` +
          `GSTIN: ${business?.gstIn || ''}\n` +
          `Address: ${business?.address1 || ''}\n` +
          `Phone: ${business?.phoneNo || ''}\n` +
          `Email: ${business?.emailId || ''}`,
          `Outgoing No: ${outgoingdetail.randomId || 'Not Provided'}\n` +
          `Date: ${outgoingdetail.createdDate ? format(new Date(outgoingdetail.createdDate), 'dd-MM-yyyy') : 'Not Provided'}`
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
        : [];

      const tableRows = filteredItems.map((item, index) => {
        const unitPrice = item.unitPrice || 0;
        const quantity = item.quantity || 0;
        const withoutTaxValue = unitPrice * quantity;
        const taxAmount = withoutTaxValue * (item.purchasetaxName / 100);
        const withTaxValue = withoutTaxValue + taxAmount;

        return [
          outgoingdetail.invoiceNo || '', // Invoice No
          outgoingdetail.invoiceDate ? format(new Date(outgoingdetail.invoiceDate), 'dd-MM-yyyy') : 'Not Provided',
          outgoingdetail.vendorName || 'N/A',    // Vendor Name
          item.itemName || 'N/A',
          `${item.purchasetaxName}%`,            // Tax Details
          taxAmount.toFixed(2),                  // Tax Amount
          withoutTaxValue.toFixed(2),            // Without Tax Value
          withTaxValue.toFixed(2),               // With Tax Value
        ];
      });

      doc.autoTable({
        head: [itemHeader],
        body: tableRows,
        startY: yOffset,
        theme: 'grid',
        styles: { fontSize: 8, halign: 'center', cellPadding: 2 },
        headStyles: { fillColor: [0, 0, 128], textColor: [255, 255, 255], lineWidth: 0.1, lineColor: [0, 0, 0] },
        bodyStyles: { lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
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
      const summaryTable = [
        ['Discount', discount.toFixed(2)],
        ['Paid Amount', partialAmount.toFixed(2)],
        ['Total Payable Amount', totalPayableAmount.toFixed(2)]
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

      const imageUrl = '/images/pending.jpeg';

      // Adjust yOffset further if you need to add space below the signature
      yOffset = doc.autoTable.previous.finalY + 5; // Move down after the signature
      doc.addImage(imageUrl, 'JPEG', 150, yOffset, 30, 30); // Add image with desired width and height
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${totalPages}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
      }

      doc.save(`${outgoingdetail.randomId}.pdf`);
    }
  };

  const generateOutgoingSummaryCSV = () => {
    console.log(filteredPayments);

    // Define headers for the CSV
    const headers = [
      ["S.No", "Outgoing ID", "Vendor Name", "Invoice No", "Invoice Date", "Total Invoice Amount", "Remaining Amount"],
    ];

    // Prepare rows for the CSV data
    const rows = (filteredPayments || []).map((outgoing, index) => {
      // Fallback handling for missing data
      const totalPayableAmount = outgoing.totalPayableAmount || 0;
      const totalDiscount = outgoing.discountDetails || 0;
      const finalAmount = totalPayableAmount - totalDiscount;
      const remainingAmount = outgoing.partialAmount || 0;
      const randomId = outgoing.randomId || 'N/A';
      // Skip rows if critical fields are missing
      if (!outgoing.vendorName) {
        return null;  // Skip rows without essential info
      }

      // Return row with fallback values for missing or null fields
      return [
        `${index + 1}`,
        randomId.toString() || 'N/A',  // Use 'N/A' for missing ID
        outgoing.vendorName.toString() || 'N/A', // Use 'N/A' for missing Vendor Name
        outgoing.invoiceNo || 'Not Provided',   // Fallback if Invoice No is missing
        outgoing.invoiceDate ? format(new Date(outgoing.invoiceDate), 'dd-MM-yyyy') : 'Not Provided',  // Fallback if Invoice Date is missing
        remainingAmount.toFixed(2),  // Remaining Amount (advance)
        finalAmount.toFixed(2),  // Total Invoice Amount after discount
      ];
    }).filter(row => row !== null);  // Remove null rows

    // Combine headers and rows
    const csvData = [headers[0], ...rows];

    // Use PapaParse to convert array to CSV string and trigger download
    const csv = Papa.unparse(csvData);

    // Create a Blob from the CSV string
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    // Trigger download
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "PendingpaymentSummary.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    handleCloseDialog();
  };
  // Update your validateAmount function
  const validateAmount = (amount: string): string => {
    if (!amount) return 'Please enter an amount';

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return 'Invalid amount format';
    if (numAmount <= 0) return 'Amount must be greater than 0';

    return '';
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === 'amount') {
      // Only allow numbers and decimal point
      if (!/^\d*\.?\d*$/.test(value)) {
        return;
      }

      const validationError = validateAmount(value);
      setError(validationError);
    }

    setPaymentDetails(prevDetails => ({
      ...prevDetails,
      [name]: value,
    }));
  };

  const handleConfirmPayment = async () => {
    if (!selectedOutgoing || !paymentDetails.amount) {
      setSnackbarMessage('Please enter a valid amount');
      setSnackbarOpen(true);
      return;
    }

    // Re-validate amount before submission
    const validationError = validateAmount(paymentDetails.amount);
    if (validationError) {
      setError(validationError);
      setSnackbarMessage(validationError);
      setSnackbarOpen(true);
      return; // Prevent submission if error exists
    }

    // Check payment type limits
    const paymentAmount = parseFloat(paymentDetails.amount);
    const maxAllowed = selectedOutgoing.totalPayableAmount;

    if (paymentDetails.paymentType === 'partial' && paymentAmount > maxAllowed) {
      setError(`Partial payment cannot exceed ${maxAllowed.toFixed(2)}`);
      setSnackbarOpen(true);
      return;
    }

    if (paymentDetails.paymentType === 'advance' && paymentAmount > maxAllowed) {
      setError(`Advance payment cannot exceed ${maxAllowed.toFixed(2)}`);
      setSnackbarOpen(true);
      return;
    }
    const outgoingId = selectedOutgoing.outgoingId;

    // Automatically set pettyCashAmount or hoCash based on payment method if payment mode is Cash
    const updatedPaymentDetails = {
      ...paymentDetails,
      pettyCashAmount: paymentDetails.paymentMode === 'Cash' && paymentDetails.paymentMethod === 'pettyCash' ? parseFloat(paymentDetails.amount) : 0,
      hoCash: paymentDetails.paymentMode === 'Cash' && paymentDetails.paymentMethod === 'hoCash' ? parseFloat(paymentDetails.amount) : 0,
    };
    const paymentDetailsToSend = {
      outgoingId: outgoingId.toString(),
      paymentType: updatedPaymentDetails.paymentType,
      totalPayableAmount: selectedOutgoing.totalPayableAmount || 0,
      fullPaymentAmount: updatedPaymentDetails.paymentType === 'full' ? parseFloat(updatedPaymentDetails.amount) : 0,
      partialAmount: updatedPaymentDetails.paymentType === 'partial' ? parseFloat(updatedPaymentDetails.amount) : 0,
      advanceAmount: updatedPaymentDetails.paymentType === 'advance' ? parseFloat(updatedPaymentDetails.amount) : 0,
      paymentMethod: updatedPaymentDetails.paymentMethod,
      paymentMode: updatedPaymentDetails.paymentMode,
      pettyCashAmount: updatedPaymentDetails.pettyCashAmount, // Automatically set
      hoCash: updatedPaymentDetails.hoCash, // Automatically set
      upi: updatedPaymentDetails.upi,
      bankName: updatedPaymentDetails.bankName,
      impsNo: updatedPaymentDetails.impsNo,
      neftNo: updatedPaymentDetails.paymentMethod === 'neft' ? updatedPaymentDetails.neftNo : undefined,
      rtgsNo: updatedPaymentDetails.paymentMethod === 'rtgs' ? updatedPaymentDetails.rtgsNo : undefined,
    };

    console.log(paymentDetailsToSend);

    // Sending the payment details to the backend
    setPaymentDetailsToSend(paymentDetailsToSend);
    setConfirmDialogOpen(true); // Open confirmation dialog
  };

  const resetPaymentDetails = () => {
    setPaymentDetails({
      paymentMethod: '',
      chequeNo: 0,
      transactionNumber: '',
      neftNo: '',
      cashVoucherNo: '',
      amount: '',
      bankName: '',
      paymentType: 'advance', // Default value
      rtgsNo: '',
      paymentMode: 'Cash', // Default value for paymentMode
      pettyCashAmount: 0, // Default value for pettyCashAmount
      hoCash: 0, // Default value for hoCash
      upi: '', // Default value for upi
      impsNo: '', // Default value for impsNo
    });
  };

  const handleClosePayDialog = () => {
    setOpenDetailsDialog(false);
    resetPaymentDetails();
  };
  const handlePaymentModeChange = (e: React.ChangeEvent<{ value: unknown }>) => {
    const selectedMode = e.target.value as 'Cash' | 'Bank';
    setPaymentDetails(prevDetails => ({
      ...prevDetails,
      paymentMode: selectedMode,
      paymentMethod: '',  // Reset payment method when payment mode changes
    }));
  };

  const handleRowSelect = (outgoingId: string) => {
    setSelectedRows((prevSelectedRows) => {
      if (prevSelectedRows.includes(outgoingId)) {
        // If already selected, deselect it
        return prevSelectedRows.filter(id => id !== outgoingId);
      } else {
        // If not selected, add to the selected rows
        return [...prevSelectedRows, outgoingId];
      }
    });
  };
  const filteredPayments = outgoings.filter(outgoing => outgoing.status === 'Partially Paid');
  return (
    <Box>
      <YenBookPage />
      <Box sx={{ p: 1, backgroundColor: 'white', m: 1 }}>
        <Box display="flex" alignItems="center" mb={2}>
          <Grid container spacing={1} alignItems="center" justifyContent="flex-start">
            {/* Row with buttons and Typography */}
            <Grid container spacing={1} alignItems="center" ml={0.3}>
              {/* Buttons */}
              <Grid item>
                <Link href="/yen-book/OutgoingPaymentPage" passHref>
                  <Button variant="contained" color="primary">Outgoing Payment</Button>
                </Link>
              </Grid>
              <Grid item>
                <Link href="/yen-book/OutgoingPaymentPage/PreOutgoing" passHref>
                  <Button variant="contained" color="primary">Pre Outgoing</Button>
                </Link>
              </Grid>
              <Grid item>
                <Link href="/yen-book/OutgoingPaymentPage/AdvancePayment" passHref>
                  <Button variant="contained" color="primary">Advance Payment</Button>
                </Link>
              </Grid>
              <Grid item>
                <Link href="/yen-book/OutgoingPaymentPage/PendingPayment" passHref>
                  <Button variant="contained" sx={{
                    backgroundColor: 'white',  // White background
                    color: 'black',            // White text
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.8)', // Slightly darker on hover
                    },
                  }}>
                    Partial Payment
                  </Button>
                </Link>
              </Grid>
              <Grid item>
                <Link href="/yen-book/OutgoingPaymentPage/PaidPayment" passHref>
                  <Button variant="contained" color="primary">Payment Done</Button>
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
              {/* Typography - placed in the same row as buttons
              <Grid item sx={{ ml: 'auto' }}>
                <Typography
                  sx={{
                    pl: 1,
                    pr: 1,
                    boxShadow: 3,
                    borderRadius: 1,
                    padding: '8px',
                    textAlign: 'center',
                    maxWidth: '450px',
                    fontWeight: 'bold',
                    flexGrow: 1,
                    ml: 2,
                  }}
                >
                  Description:<br />
                  Pending Payment page. Here, you can view all pending payments and track the payments you have already processed to vendors. Payments can be processed directly from this page.
                </Typography> 
              </Grid>*/}
            </Grid>


            <Grid container spacing={2} alignItems="center" sx={{ mt: 0.5, ml: 0 }}>
              {/* Date Range Picker */}
              <Grid item xs="auto">
                <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                  <DateRangeDialog
                    selectionRange={selectionRange}
                    setSelectionRange={setSelectionRange}
                  />
                </Box>
              </Grid>

              {/* Vendor Search */}
              <Grid item xs={6} sm={4} md={2}>
                <FormControl fullWidth>
                  <Autocomplete
                    value={selectedVendorName} // VendorDetail | null
                    onChange={handleVendorChange} // Handles VendorDetail object
                    options={outgoingvendor} // Array of VendorDetail objects
                    getOptionLabel={(option: VendorDetail) => option.vendorName || ''} // Specify how to display the vendor name
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="All Vendors"
                        variant="outlined"
                        size="small"
                        InputProps={{
                          ...params.InputProps,
                          style: { fontSize: '12px' }, // Adjust font size as needed
                        }}
                      />
                    )}
                    sx={{
                      fontSize: '12px', // Adjust font size of the Autocomplete input as needed
                    }}
                  />
                </FormControl>
              </Grid>

              {/* Filter Button */}
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
                  <Typography
                    variant="caption"
                    align="center"
                    sx={{
                      maxWidth: 60,
                      wordBreak: 'break-word',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      lineHeight: 1.1,
                      mt: 0.2,
                    }}
                  >
                    Filter
                  </Typography>
                </Box>
              </Grid>

              {/* Clear Filter Button */}
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
                  <Typography
                    variant="caption"
                    align="center"
                    sx={{
                      maxWidth: 60,
                      wordBreak: 'break-word',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      lineHeight: 1.1,
                      mt: 0.2,
                    }}
                  >
                    Clear
                  </Typography>
                </Box>
              </Grid>

              {/* Spacer to Push Download to the End */}
              <Grid item xs sx={{ flexGrow: 1 }} />

              {/* Download Button */}
              <Grid item xs="auto">
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <IconButton
                    onClick={handleOpenDialog}
                    color="primary"
                    className="icon-button-outline"
                    size="small"
                    sx={{ p: 0.3 }}
                    disabled={!filteredPayments || filteredPayments.length === 0}
                  >
                    <DownloadIcon fontSize="small" />
                  </IconButton>
                  <Typography
                    variant="caption"
                    align="center"
                    sx={{
                      maxWidth: 60,
                      wordBreak: 'break-word',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      lineHeight: 1.1,
                      mt: 0.2,
                    }}
                  >
                    Download
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Grid>
        </Box>

        <Grid container spacing={2}>
          {/* Main Table */}
          <Grid item xs={12}>
            <TableContainer
              component={Paper}
              sx={{
                maxHeight: 'calc(100vh - 230px)', // Dynamic height based on viewport
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
                    <TableCell>Amount Paid</TableCell> {/* New Column */}
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
                  ) : (filteredPayments.map((payment, index) => {
                    // Calculate the total paid
                    const totalAmount =
                      (payment.partialAmount || 0) +
                      (payment.totalPayableAmount || 0);

                    return (
                      <TableRow key={payment.outgoingId}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{payment.vendorName}</TableCell>
                        <TableCell>{payment.invoiceNo || 'N/A'}</TableCell>
                        <TableCell>{payment.invoiceDate ? format(payment.invoiceDate, 'dd-MM-yyyy') : 'N/A'}</TableCell>
                        <TableCell>{totalAmount.toFixed(2)}</TableCell> {/* Display total amount */}
                        <TableCell>{payment.partialAmount?.toFixed(2) ?? ''}</TableCell>
                        <TableCell>{payment.paymentDate ? format(payment.paymentDate, 'dd-MM-yyyy') : 'N/A'}</TableCell>
                        <TableCell>{payment.discountDetails?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell>{(payment.totalPayableAmount || 0).toFixed(2)}</TableCell> {/* Display Total Payable Amount */}
                        <TableCell>
                          <Tooltip title='Pay'>
                            <IconButton
                              color='primary'
                              onClick={() => handleViewDetails(payment)}
                              disabled={selectedRows.length > 1} // Disable if any rows are selected
                            >
                              <PaymentIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title='Download'>
                            <IconButton
                              color="primary" sx={{ ml: 0.2 }}
                              onClick={() => handleDownload(payment.outgoingId ?? '')} // Corrected usage of purchaseOrderId
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

        <Dialog open={openDetailsDialog} onClose={() => setOpenDetailsDialog(false)}>
          <DialogTitle>Payment Details</DialogTitle>
          <DialogContent>
            <Typography variant="body1" gutterBottom>
              Total Amount: {selectedOutgoing?.totalPayableAmount?.toFixed(2) || 'N/A'}
            </Typography>

            {/* Payment Type Selector */}
            <TextField
              select
              name="paymentType"
              label="Payment Type"
              value={paymentDetails.paymentType}
              onChange={handlePaymentTypeChange}
              fullWidth
              margin="normal"
            >
              <MenuItem value="full">Full Payment</MenuItem>
              <MenuItem value="partial">Partial Payment</MenuItem>
              <MenuItem value="advance">Advance Payment</MenuItem>
            </TextField>

            {/* Amount Input */}
            <TextField
              autoComplete="off"
              name="amount"
              label="Amount"
              value={paymentDetails.amount}
              onChange={handleInputChange}
              fullWidth
              margin="normal"
              required
              error={!!error}
              helperText={error}
              disabled={paymentDetails.paymentType === 'full'} // Disable for full payment type
            />

            {/* Payment Mode (Cash or Bank) */}
            <TextField
              select
              name="paymentMode"
              label="Payment Mode"
              value={paymentDetails.paymentMode}
              onChange={handlePaymentModeChange}
              fullWidth
              margin="normal"
            >
              <MenuItem value="Cash">Cash</MenuItem>
              <MenuItem value="Bank">Bank</MenuItem>
            </TextField>

            {/* Show Fields Based on Payment Mode */}
            {paymentDetails.paymentMode === 'Cash' && (
              <>
                <TextField
                  select
                  name="paymentMethod"
                  label="Payment Method"
                  value={paymentDetails.paymentMethod}
                  onChange={handleInputChange}
                  fullWidth
                  margin="normal"
                  required
                >
                  <MenuItem value="pettyCash">Petty Cash</MenuItem>
                  <MenuItem value="hoCash">HO Cash</MenuItem>
                </TextField>
              </>
            )}

            {/* Show Fields Based on Bank Payment Mode */}
            {paymentDetails.paymentMode === 'Bank' && (
              <>
                {/* Fetch Bank Details Dynamically */}
                <TextField
                  select
                  name="bankName"
                  label="Bank Name"
                  value={paymentDetails.bankName}
                  onChange={handleInputChange}
                  fullWidth
                  margin="normal"
                >
                  {banks.map((bank) => (
                    <MenuItem key={bank.bankMasterId} value={bank.bankName}>
                      {bank.bankName}
                    </MenuItem>
                  ))}
                </TextField>

                {/* Payment Method (e.g., NEFT, RTGS, IMPS, UPI) */}
                <TextField
                  select
                  name="paymentMethod"
                  label="Payment Method"
                  value={paymentDetails.paymentMethod}
                  onChange={handlePaymentMethodChange}
                  fullWidth
                  margin="normal"
                >
                  <MenuItem value="neft">NEFT</MenuItem>
                  <MenuItem value="rtgs">RTGS</MenuItem>
                  <MenuItem value="imps">IMPS</MenuItem>
                  <MenuItem value="upi">UPI</MenuItem>
                </TextField>

                {/* Fields for Bank Payment Methods */}
                {paymentDetails.paymentMethod === 'neft' && (
                  <TextField
                    autoComplete="off"
                    name="neftNo"
                    label="NEFT Number"
                    value={paymentDetails.neftNo}
                    onChange={handleInputChange}
                    fullWidth
                    margin="normal"
                    required
                  />
                )}
                {paymentDetails.paymentMethod === 'rtgs' && (
                  <TextField
                    autoComplete="off"
                    name="rtgsNo"
                    label="RTGS Number"
                    value={paymentDetails.rtgsNo}
                    onChange={handleInputChange}
                    fullWidth
                    margin="normal"
                    required
                  />
                )}
                {paymentDetails.paymentMethod === 'imps' && (
                  <TextField
                    autoComplete="off"
                    name="impsNo"
                    label="IMPS Number"
                    value={paymentDetails.impsNo}
                    onChange={handleInputChange}
                    fullWidth
                    margin="normal"
                    required
                  />
                )}
                {paymentDetails.paymentMethod === 'upi' && (
                  <TextField
                    autoComplete="off"
                    name="upi"
                    label="UPI ID"
                    value={paymentDetails.upi}
                    onChange={handleInputChange}
                    fullWidth
                    margin="normal"
                    required
                  />
                )}
              </>
            )}
          </DialogContent>

          <DialogActions>
            <Button onClick={handleClosePayDialog} color="primary">
              Cancel
            </Button>
            <Button onClick={handleConfirmPayment} color="primary">
              Confirm Payment
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Confirm Payment</DialogTitle>
          <DialogContent>
            <Typography variant="body1">Are you sure you want to process the payment for this outgoing?</Typography>
            <Typography variant="body2" style={{ marginTop: 10 }}>
              Vendor: {selectedOutgoing?.vendorName} <br />
              Invoice No: {selectedOutgoing?.invoiceNo} <br />
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDialogOpen(false)} variant="contained" color="primary">Cancel</Button>
            <Button onClick={async () => {
              try {
                await dispatch(processPayment(paymentDetailsToSend)).unwrap();
                resetPaymentDetails();
                handleClosePayDialog();
                dispatch(fetchOutgoings({
                  page: newPage, size: pageSize, status: status, filterBy: dateField,
                  fromDate: StartDate,
                  toDate: EndDate
                }));
                setConfirmDialogOpen(false); // Close the confirmation dialog
              } catch (error) {
                console.error('Failed to process payment:', error);
                alert('Failed to process payment. Please try again.');
                setConfirmDialogOpen(false); // Close the confirmation dialog if error occurs
              }
            }} variant="contained" color="primary">Confirm</Button>
          </DialogActions>
        </Dialog>
        <Dialog open={openDialog} onClose={handleCloseDialog}>
          <DialogTitle>Choose a file format</DialogTitle>
          <DialogContent>
            <p>Select the file format you want to download:</p>
          </DialogContent>
          <DialogActions>
            {/* Button to download PDF */}
            <Button
              onClick={generateOutgoingInvoicePDF}
              variant="contained"
              color="primary"
              startIcon={<PictureAsPdfIcon />}
            >
              Download PDF
            </Button>

            {/* Button to download CSV */}
            <Button
              onClick={generateOutgoingSummaryCSV}
              variant="contained"
              color="secondary"
              startIcon={<DescriptionIcon />}
            >
              Download CSV
            </Button>

            {/* Cancel button */}
            <Button onClick={handleCloseDialog} >
              Cancel
            </Button>
          </DialogActions>
        </Dialog>
        <Snackbar
          open={snackbarOpen}
          message={snackbarMessage}
          autoHideDuration={3000}
          onClose={() => dispatch(clearSnackbarMessage())} // Manually close the snackbar when clicked
        />
      </Box>
    </Box>
  );
});

PendingPaymentComponent.displayName = 'PendingPaymentComponent';

export default PendingPaymentComponent;
