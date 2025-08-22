"use client";
import React, { useState, useEffect, useMemo } from "react";
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
  Box,
  Snackbar,
  FormControl,
  MenuItem,
  Select,
  SelectChangeEvent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Icon,
  AutocompleteChangeReason,
  Autocomplete,
  TextField,
} from "@mui/material";
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';  // CSV icon
import DownloadIcon from '@mui/icons-material/Download';
import FilterAltIcon from '@mui/icons-material/FilterAlt'; // Import the filter icon
import {
  fetchOutgoings,
  selectOutgoings,
  setSnackbarMessage,
  setSnackbarOpen, clearSnackbarMessage,
  selectCurrentPage,
  selectPageSize,
  selectTotalItems, setPagination, fetchVendorDetails
} from "../../../../features/yen-purchase/Outgoing/outgoingPaymentSlice"; // Adjust the path as needed
import { AppDispatch } from "@/redux/store";
import YenBookPage from "../../page";
import { fetchGrnById, fetchItemwiseGrns, selectGrn } from '@/features/yen-purchase/GRN/grnSlice';
import jsPDF from 'jspdf';
import "jspdf-autotable"; // Ensure this plugin is available for autoTable functionality
import { fetchBusinesses, fetchPhoto, selectBusinesses } from '@/features/account-setting/businessSlice';
import { GrnData } from '@/Models/grnModel';
import { Outgoing, VendorDetail } from "@/Models/outgoingModel";
import { format } from "date-fns";
import Link from "next/link";
import { openDialog } from "@/features/posDeviceSlice";
import Papa from "papaparse";
import { ChevronLeft, ChevronRight } from "@mui/icons-material";
import DateRangeDialog from "@/components/dateRange";
import { ClearIcon } from "@mui/x-date-pickers/icons";
import 'react-date-range/dist/styles.css'; // main style file
import 'react-date-range/dist/theme/default.css'; // theme css file
import moment from "moment";

const AdvancePaymentComponent = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { outgoings, loading, snackbarMessage, snackbarOpen, outgoingvendor } = useSelector(selectOutgoings);
  const { itemwise } = useSelector(selectGrn);
  const { businesses } = useSelector(selectBusinesses);
  const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'succeeded' | 'failed'>('idle');
  const [fetchedBusinessIds, setFetchedBusinessIds] = useState(new Set());
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedVendorName, setSelectedVendorName] = useState<VendorDetail | null>(null); // Default is null
  const [totalpayment, setTotalPayment] = useState<number>(); // Initialize totalpayment as a number
  const [filteredOutgoing, setFilteredOutgoing] = useState<Outgoing[]>([]); // Explicit type declaration
  const [status, setStatus] = useState('Advance Paid'); // Default status filter is "Pending"
  const [openDialog, setOpenDialog] = useState(false);  // Control dialog visibility
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
  }, [dispatch, newPage, pageSize, status, loadingState, dateField, StartDate, EndDate, shouldFetch]);
  useEffect(() => {
    if (loadingState === 'idle') {
      dispatch(fetchItemwiseGrns());
      dispatch(fetchVendorDetails({ status: status }));
    }
  }, [loadingState, status, dispatch]);

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
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > Math.ceil(totalItems / pageSize)) {
      return;
    }
    const appliedFromDate = selectionRange?.startDate instanceof Date ? moment(selectionRange.startDate).startOf('day').toDate() : StartDate;
    const appliedToDate = selectionRange?.endDate instanceof Date ? moment(selectionRange.endDate).endOf('day').toDate() : EndDate;
    dispatch(setPagination({ page: newPage, size: pageSize }));
    dispatch(fetchOutgoings({
      page: newPage, size: pageSize, status: status, filterBy: dateField,
      fromDate: appliedFromDate,
      toDate: appliedToDate, vendorName: selectedVendorName?.vendorName, // Use vendorName from selectedVendorName object

    }))
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

  useEffect(() => {
    businesses.forEach((business) => {
      if (!fetchedBusinessIds.has(business.businessId)) {
        dispatch(fetchPhoto(business.businessId));
        setFetchedBusinessIds(prevSet => new Set(prevSet).add(business.businessId));
      }
    });
  }, [businesses, fetchedBusinessIds, dispatch]);

  const handleStartDateChange = (value: Date | null) => {
    setStartDate(value); // Update the startDate state with Date or null
  };
  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  // Handler for end date change
  const handleEndDateChange = (value: Date | null) => {
    setEndDate(value); // Update the endDate state with Date or null
  };
  const handleVendorChange = (
    event: React.SyntheticEvent,
    newValue: VendorDetail | null, // `newValue` is a VendorDetail or null
    reason: AutocompleteChangeReason
  ) => {
    setSelectedVendorName(newValue); // Set the selected vendor directly
  };

  const filteredPayments = useMemo(() => {
    const safeOutgoings = outgoings; // Fallback to an empty array if outgoings is undefined
    return safeOutgoings;
  }, [outgoings]);
  console.log(filteredPayments);
  const generateOutgoingInvoicePDF = () => {
    // Initialize jsPDF instance
    const doc = new jsPDF();

    // Starting yOffset for content
    let yOffset = 10;

    // Define the logo and title position
    const logoX = 14;  // Position for logo
    const titleX = 80; // Position for title and summary text

    // Add business image on the left side (adjust as needed)
    const business = businesses.length > 0 ? businesses[0] : null;

    if (business && business.imageUrl) {
      try {
        doc.addImage(business.imageUrl, 'JPEG', logoX, yOffset, 20, 20);  // Adjust image size and position
      } catch (e) {
        console.error("Image failed to load:", e);
      }
    }

    // Adjust the title and summary below the image
    doc.setFontSize(12);  // Increase title font size
    doc.text("Advance Payment Invoice Summary", titleX, yOffset + 10);  // Title at the top next to the logo
    // Add underline below the title
    const titleWidth = doc.getTextWidth("Advance Payment Invoice Summary");  // Get the width of the title text
    const underlineStartX = titleX;  // X position for the start of the underline (same as titleX)
    const underlineEndX = underlineStartX + titleWidth;  // X position for the end of the underline
    doc.setLineWidth(0.5);  // Set the thickness of the underline
    doc.line(underlineStartX, yOffset + 12, underlineEndX, yOffset + 12);  // Draw the underline below the title

    // Update yOffset for next row content (Date and Amount)
    yOffset += 25;  // Adjust position for the next content

    // Filter outgoings based on "Advance Paid" status
    const filteredOutgoings = outgoings.filter(outgoing => {
      return outgoing.status === 'Advance Paid';
    });

    // Calculate the total payable amount for the filtered outgoings
    const totalPayableAmount = filteredOutgoings.reduce((sum, outgoing) => {
      return sum + (outgoing.totalPayableAmount || 0);
    }, 0);

    // Current date formatting
    const today = new Date();
    const currentDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

    // Display the "Date" on the left and "Total Payable Amount" on the right in the next row
    doc.setFontSize(10);
    doc.text(`Total Payable Amount: ${totalPayableAmount.toFixed(2)}`, 14, yOffset);  // Left-align amount
    doc.text(`Date: ${currentDate}`, 140, yOffset);  // Right-align date

    yOffset += 7;  // Adjust space before the table

    // Table headers
    const headers = [
      ["S.No", "Outgoing ID", "Vendor Name", "Invoice No", "Invoice Date", "Advance", "Total Outgoing Amount"]
    ];

    // Map and format rows based on filteredOutgoings
    const rows = filteredOutgoings.map((outgoing, index) => {
      const outgoingAmount = outgoing.totalPayableAmount || 0;
      // Ensure valid data for each outgoing row
      return [
        `${index + 1}`,
        outgoing.randomId ? outgoing.randomId.toString() : "N/A",
        outgoing.vendorName ? outgoing.vendorName.toString() : "N/A",
        outgoing.invoiceNo || "N/A",
        outgoing.invoiceDate ? format(new Date(outgoing.invoiceDate), 'dd-MM-yyyy') : 'N/A',
        outgoing.advanceAmount?.toFixed(2) || "0.00",
        outgoingAmount.toFixed(2)
      ];
    });

    // Add the table to the PDF using autoTable
    doc.autoTable({
      head: headers,
      body: rows,
      startY: yOffset,  // Start the table below the "Date" and "Total Payable Amount"
      styles: {
        fillColor: [30, 144, 255],  // DodgerBlue color
        textColor: [255, 255, 255], // White text color
        lineColor: [0, 0, 0],       // Black table borders
        fontSize: 8,                // Set the font size here
      },
      headStyles: {
        fillColor: [0, 0, 128],  // Dark Blue background for the header
        textColor: [255, 255, 255]  // White text color for header
      },
      bodyStyles: {
        fillColor: [255, 255, 255],  // White background for rows
        textColor: [0, 0, 0]         // Black text color for rows
      },
      columnStyles: {
        4: { halign: 'right' },  // Right-align "Advance"
        5: { halign: 'center' }, // Center-align "Total Outgoing Amount"
      },

    });
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${totalPages}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }
    // Save the generated PDF with a dynamic filename
    const pdfFilename = `Outgoing_Invoice_Summary.pdf`;
    doc.save(pdfFilename);
    handleCloseDialog();
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
        const invoiceDateParsed = outgoing.invoiceDate
          ? new Date(outgoing.invoiceDate) : null;
        // Only compare dates if invoiceDateParsed is valid
        return invoiceDateParsed && invoiceDateParsed >= formattedStartDate;
      });
    }

    // Filter based on end date
    if (formattedEndDate) {
      filtered = filtered.filter(outgoing => {
        const invoiceDateParsed = outgoing.invoiceDate
          ? new Date(outgoing.invoiceDate) // Ensure invoiceDate is formatted as a string
          : null;
        // Only compare dates if invoiceDateParsed is valid
        return invoiceDateParsed && invoiceDateParsed <= formattedEndDate;
      });
    }

    // Send filters to the backend
    dispatch(
      fetchOutgoings({
        page: newPage, size: pageSize,
        fromDate: formattedStartDate instanceof Date ? formattedStartDate : undefined,
        toDate: formattedEndDate instanceof Date ? formattedEndDate : undefined,
        vendorName: selectedVendorName?.vendorName, // Use vendorName from selectedVendorName object
        filterBy: 'paymentDate',
        status: 'Advance Paid'
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
    }))
  }

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
      const remainingAmount = outgoing.advanceAmount || 0;
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
    link.setAttribute("download", "OutgoingSummary.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    handleCloseDialog();
  };

  const vendorNames = Array.from(
    new Set(
      (outgoings || []).map(outgoing => outgoing.vendorName) // Ensures outgoings is not undefined
    )
  );


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
    doc.text('Advance Payment', 90, yOffset + 5);

    // Add underline
    const textWidth = doc.getTextWidth('Advance Payment'); // Get the width of the text
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
        `Business Name: ${business?.companyName || 'Not Provided'}\n` +
        `GSTIN: ${business?.gstIn || 'Not Provided'}\n` +
        `Address: ${business?.address1 || 'Not Provided'}\n` +
        `Phone: ${business?.phoneNo || 'Not Provided'}\n` +
        `Email: ${business?.emailId || 'Not Provided'}`,
        `Outgoing No: ${outgoingdetail.randomId || 'Not Provided'}\n` +
        `Date: ${outgoingdetail.createdDate ? format(new Date(outgoingdetail.createdDate), 'dd-MM-yyyy') : 'Not Provided'}`
      ]
    ];

    doc.autoTable({
      head: [['Vendor Details', 'Business Details', 'Outgoing Payment Details']],
      body: vendorDetailsRows,
      startY: yOffset,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 4, halign: 'left', valign: 'top', overflow: 'linebreak' },
      columnStyles: { 0: { cellWidth: 60.6 }, 1: { cellWidth: 60.6 }, 2: { cellWidth: 60.6 } },
      headStyles: { fillColor: [0, 0, 128], textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { lineWidth: 0.1, lineColor: [0, 0, 0], textColor: [0, 0, 0], minCellHeight: 15 },
      tableLineColor: [0, 0, 0],
      tableLineWidth: 0.1,
    });

    yOffset = doc.autoTable.previous.finalY;

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

    const filteredItems = outgoingdetail.grnId
      ? itemwise.filter(grn => grn.grnId === outgoingdetail.grnId).flatMap(grn => grn.itemDetails)
      : [];

    const tableRows = filteredItems.map((item) => {
      const unitPrice = item.unitPrice || 0;
      const quantity = item.quantity || 0;
      const withoutTaxValue = unitPrice * quantity;
      const taxAmount = withoutTaxValue * (item.purchasetaxName / 100);
      const withTaxValue = withoutTaxValue + taxAmount;

      return [
        outgoingdetail.invoiceNo || 'N/A',
        outgoingdetail.invoiceDate ? format(new Date(outgoingdetail.invoiceDate), 'dd-MM-yyyy') : 'Not Provided',
        outgoingdetail.vendorName || 'N/A',
        item.itemName || 'N/A',
        `${item.purchasetaxName || 0}%`,
        taxAmount.toFixed(2),
        withoutTaxValue.toFixed(2),
        withTaxValue.toFixed(2),
      ];
    });

    // If no items exist (like in advance payment case), show default values
    if (tableRows.length === 0) {
      tableRows.push([
        'N/A', 'N/A', outgoingdetail.vendorName || 'N/A', 'N/A', '0%', '0.00', '0.00', '0.00'
      ]);
    }

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

    yOffset = doc.autoTable.previous.finalY;

    // Overall Total Payable Amount or Advance Amount
    const discount = outgoingdetail.discountDetails || 0;
    const totalPayableAmount = outgoingdetail.totalPayableAmount || 0;
    const advanceAmount = outgoingdetail.advanceAmount || 0;

    const summaryTable = [
      ['Discount', discount.toFixed(2)],
      ['Advance Amount', advanceAmount.toFixed(2)],
      ['Total Payable Amount', totalPayableAmount ? totalPayableAmount.toFixed(2) : '0.00']
    ];

    doc.autoTable({
      head: [['Description', 'Amount']],
      body: summaryTable,
      startY: yOffset,
      theme: 'grid',
      styles: { fontSize: 8, halign: 'right', cellPadding: 2 },
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.1 },
      bodyStyles: { lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], },
    });

    const imageUrl = '/images/advancecash.jpg';

    // Adjust yOffset further if you need to add space below the signature
    yOffset = doc.autoTable.previous.finalY + 5; // Move down after the signature
    doc.addImage(imageUrl, 'JPEG', 150, yOffset, 30, 25); // Add image with desired width and height
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${totalPages}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }
    doc.save(`${outgoingdetail.vendorName}_PaymentDetails.pdf`);
  };

  return (
    <Box>
      {/* Parent Component */}
      <YenBookPage />
      <Box sx={{ p: 1, backgroundColor: "white", m: 1 }}>
        <Box display="flex" alignItems="center" mb={2}>
          <Grid container spacing={1} alignItems="center" justifyContent="space-between" >
            <Grid container alignItems="center" gap={1} ml={1}>
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
                  <Button variant="contained" sx={{
                    backgroundColor: 'white',
                    color: 'black',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    },
                  }}>
                    Advance Payment
                  </Button>
                </Link>
              </Grid>

              <Grid item>
                <Link href="/yen-book/OutgoingPaymentPage/PendingPayment" passHref>
                  <Button variant="contained" color="primary">Partial Payment</Button>
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
              {/* <Grid item sx={{ ml: 'auto' }}>
    <Typography
      sx={{
        pl: 2,
        pr: 2,
        boxShadow: 3,
        borderRadius: 1,
        padding: '8px',
        textAlign: 'left',
        maxWidth: '370px',
        fontWeight: 'bold',
        flexGrow: 1,
      }}
    >
                      Description:<br />
      Welcome to the Advance Payment page. Here, you can view all advance payments made to vendors.
    </Typography>
  </Grid> */}
            </Grid>

            <Grid container spacing={2} alignItems="center" sx={{ mt: 1 }}>
              {/* Date Range Picker */}
              <Grid item xs="auto">
                <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', ml: 1 }}>
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

              {/* Filter Clear Button */}
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


        {/* Main Table */}
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TableContainer
              component={Paper}
              sx={{
                maxHeight: 'calc(100vh - 230px)', // Dynamic height based on viewport
                overflowY: 'auto',
                width: '100%',
              }}
            >
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>No</TableCell>
                    <TableCell>Vendor Name</TableCell>
                    <TableCell>Invoice No</TableCell>
                    <TableCell>Invoice Date</TableCell>
                    <TableCell>Total Amount (Advance + Payable)</TableCell>
                    <TableCell>Advance Amount Paid</TableCell>
                    <TableCell>Payment Date</TableCell>
                    <TableCell>Tax Percentage</TableCell>
                    <TableCell>Discount Amount</TableCell>
                    <TableCell>Total Payable Amount</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} style={{ textAlign: 'center' }}>
                        No data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.map((payment: any, index) => {
                      // Calculate total amount
                      const totalAmount =
                        (payment.advanceAmount || 0) + (payment.totalPayableAmount || 0);

                      return (
                        <TableRow key={payment.outgoingId}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{payment.vendorName}</TableCell>
                          <TableCell>{payment.invoiceNo || "N/A"}</TableCell>
                          <TableCell>{payment.invoiceDate ? format(payment.invoiceDate, 'dd-MM-yyyy') : 'N/A'}</TableCell>
                          <TableCell>{totalAmount.toFixed(2)}</TableCell>
                          <TableCell>
                            {(payment.advanceAmount || 0).toFixed(2)}
                          </TableCell>
                          <TableCell>{payment.paymentDate ? format(payment.paymentDate, 'dd-MM-yyyy') : 'N/A'}</TableCell>

                          <TableCell>
                            {(payment.taxDetails || 0).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {(payment.discountDetails || 0).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {(payment.totalPayableAmount || 0).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Tooltip title='PDF Download'>
                              <IconButton
                                color="primary"
                                sx={{ ml: 0.1 }} // Adds some margin between the buttons
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
};

export default AdvancePaymentComponent;
