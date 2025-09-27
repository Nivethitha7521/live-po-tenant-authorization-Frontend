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
  SelectChangeEvent,
  FormControl,
  MenuItem,
  Select,
  IconButton,
  Tooltip,
  AutocompleteChangeReason,
  Autocomplete,
  TextField,
} from "@mui/material";
import {
  fetchOutgoings,
  selectOutgoings,
  setSnackbarMessage,
  setSnackbarOpen, clearSnackbarMessage, selectCurrentPage,
  selectPageSize,
  selectTotalItems, setPagination,
  fetchVendorDetails
} from "../../../../features/yen-purchase/Outgoing/outgoingPaymentSlice"; // Adjust the path as needed
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';  // CSV icon
import FilterAltIcon from '@mui/icons-material/FilterAlt'; // Import the filter icon
import VisibilityIcon from '@mui/icons-material/Visibility'; // Import Visibility icon
import { AppDispatch } from "@/redux/store";
import YenBookPage from "../../page";
import jsPDF from 'jspdf';
import "jspdf-autotable"; // Ensure this plugin is available for autoTable functionality
import { fetchBusinesses, fetchPhoto, selectBusinesses } from '@/features/account-setting/businessSlice';
import { fetchGrnById, fetchItemwiseGrns, selectGrn } from '@/features/yen-purchase/GRN/grnSlice';
import { format } from "date-fns";
import DateRangeFilter from "@/components/agingFilter";
import { Outgoing } from "@/Models/apModel";
import Link from "next/link";
import Papa from "papaparse";
import { ChevronLeft, ChevronRight } from "@mui/icons-material";
import DateRangeDialog from "@/components/dateRange";
import { ClearIcon } from "@mui/x-date-pickers/icons";
import 'react-date-range/dist/styles.css'; // main style file
import 'react-date-range/dist/theme/default.css'; // theme css file
import moment from "moment";
import { VendorDetail } from "@/Models/outgoingModel";

const PaidPaymentComponent = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { outgoings, loading, snackbarOpen, snackbarMessage, outgoingvendor } = useSelector(selectOutgoings);
  const { itemwise } = useSelector(selectGrn);
  const { businesses } = useSelector(selectBusinesses);
  const [fetchedBusinessIds, setFetchedBusinessIds] = useState(new Set());
  const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'succeeded' | 'failed'>('idle');
  const [viewDetailsIndex, setViewDetailsIndex] = useState<number | null>(null); // Track the viewed vendor
  const [openDetailsDialog, setOpenDetailsDialog] = useState(false); // Control details dialog visibility
  const [selectedOutgoing, setSelectedOutgoing] = useState<any>(null); // Track the selected outgoing
  const [selectedVendorName, setSelectedVendorName] = useState<VendorDetail | null>(null); // Default is null
  const [filteredOutgoing, setFilteredOutgoing] = useState<Outgoing[]>([]); // Explicit type declaration
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
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
  }, [dispatch, newPage, pageSize, StartDate, EndDate, dateField, shouldFetch]); // Fixed dependencies
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
      page: newPage, size: pageSize, filterByStatus: true, filterBy: dateField, fromDate: appliedFromDate,
      toDate: appliedToDate, vendorName: selectedVendorName?.vendorName,
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



  const handleFilterClick = () => {
    // Prepare filter parameters
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
        // Explicitly type the response payload
        const data = response.payload as { outgoings: Outgoing[]; totalItems: number } | string;

        console.log('Filtered outgoings:', data);

        if (typeof data === 'string') {
          setSnackbarMessage(data);
          setSnackbarOpen(true);
          setFilteredOutgoing([]);
        } else if (data.outgoings.length === 0) {
          setSnackbarMessage('No matching Outgoing Payment found.');
          setSnackbarOpen(true);
          setFilteredOutgoing([]);
        } else {
          setFilteredOutgoing(data.outgoings);
        }
      })
      .catch((error) => {
        console.error('Error fetching outgoing:', error);
        setSnackbarMessage(error.message || 'Error fetching outgoing');
        setSnackbarOpen(true);
        setFilteredOutgoing([]);
      });
  };
  const handleFilterClose = () => {
    // Reset filter states (except for the date)
    setSelectionRange({
      startDate: new Date(),  // Set to current date
      endDate: new Date(),    // Set to current date
      key: 'selection',       // Retain the key
    });
    setSelectedVendorName(null);
    dispatch(fetchOutgoings({
      page: 1, size: pageSize, filterByStatus: true, filterBy: dateField, fromDate: StartDate,
      toDate: EndDate
    }));
  }
  // Function to get background color and shadow based on payment status
  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case "fully paid":
        return { backgroundColor: "white", boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)" };
      case "partially paid":
        return { backgroundColor: "orange", boxShadow: "0px 4px 12px rgba(255, 165, 0, 0.5)" };
      case "advance paid":
        return { backgroundColor: "yellow", boxShadow: "0px 4px 12px rgba(255, 255, 0, 0.5)" };
      default:
        return { backgroundColor: "gray", boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)" }; // Default style for unknown statuses
    }
  };

  const handleVendorChange = (
    event: React.SyntheticEvent,
    newValue: VendorDetail | null, // `newValue` is a VendorDetail or null
    reason: AutocompleteChangeReason
  ) => {
    setSelectedVendorName(newValue); // Set the selected vendor directly
  };

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
    doc.text("Paid Payment Invoice Summary", titleX, yOffset + 10);  // Title at the top next to the logo

    // Calculate the width of the title text
    const titleWidth = doc.getTextWidth("Paid Payment Invoice Summary");

    // Draw a line under the title
    const lineY = yOffset + 12; // Position of the line (slightly below the text)
    doc.setLineWidth(0.1); // Set line width
    doc.line(titleX, lineY, titleX + titleWidth, lineY); // Draw line from start to end of the title

    // Update yOffset for next row content (Date and Amount)
    yOffset += 20;  // Adjust position for the next content

    // Filtered outgoings logic (Adjust based on your requirements)
    const filteredOutgoings = outgoings.filter(outgoing => {
      return outgoing.status === 'Fully Paid' || outgoing.status === 'Advance Paid' || outgoing.status === 'Partially Paid';
    });

    // Calculate total payable amount for the filtered outgoings
    const totalPayableAmount = filteredOutgoings.reduce((sum, outgoing) => {
      return sum + (outgoing.totalPayableAmount || 0);
    }, 0);

    // Current date formatting
    const today = new Date();
    const currentDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

    // Add total payable amount and current date to the PDF
    doc.setFontSize(10);
    doc.text(`Total Payable Amount: ${totalPayableAmount.toFixed(2)}`, 145, yOffset);  // Left-align amount
    doc.text(`Date: ${currentDate}`, 14, yOffset);  // Right-align date

    yOffset += 5;  // Adjust space before the table

    // Map and format rows based on filteredOutgoings
    const rows = paidOutgoings.map((payment, index) => {
      const totalPaid = (payment.advanceAmount || 0) + (payment.partialAmount || 0) + (payment.fullPaymentAmount || 0);
      const totalPayable = payment.totalPayableAmount || 0;

      // Ensure valid data for each outgoing row
      return [
        `${index + 1}`,
        payment.randomId ? payment.randomId.toString() : "N/A",
        payment.vendorName ? payment.vendorName.toString() : "N/A",
        payment.invoiceDate ? format(new Date(payment.invoiceDate), 'dd-MM-yyyy') : 'Not Provided',
        totalPaid.toFixed(2),  // Display the total paid amount
        totalPayable.toFixed(2),  // Display the total payable amount
        payment.status || "Unknown"
      ];
    });

    // Add the table to the PDF using autoTable
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
        3: { halign: 'right' }, // Align amounts to the right
        4: { halign: 'center' } // Center-align the status
      }
    });
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${totalPages}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }
    // Save the generated PDF with a dynamic filename
    const pdfFilename = `Paidpayment.pdf`;
    doc.save(pdfFilename);
    handleCloseDialog();
  };
  const generatePaidPaymentCSV = () => {
    // Filter out valid paid payments
    const filteredOutgoings = outgoings.filter(outgoing => {
      return outgoing.status === 'Fully Paid' || outgoing.status === 'Advance Paid' || outgoing.status === 'Partially Paid';
    });

    // Prepare the headers for the CSV
    const headers = [
      "S.No", "Outgoing ID", "Vendor Name", "Invoice Date", "Paid Amount", "Total Payable Amount", "Status"
    ];

    // Map and format rows based on filteredOutgoings
    const rows = filteredOutgoings.map((payment, index) => {
      const totalPaid = (payment.advanceAmount || 0) + (payment.partialAmount || 0) + (payment.fullPaymentAmount || 0);
      const totalPayable = payment.totalPayableAmount || 0;

      return [
        `${index + 1}`,
        payment.randomId ? payment.randomId.toString() : "N/A",
        payment.vendorName ? payment.vendorName.toString() : "N/A",
        payment.invoiceDate ? format(new Date(payment.invoiceDate), 'dd-MM-yyyy') : 'Not Provided',
        totalPaid.toFixed(2),  // Display the total paid amount
        totalPayable.toFixed(2),  // Display the total payable amount
        payment.status || "Unknown"
      ];
    });

    // Use PapaParse to convert array to CSV string and trigger download
    const csvData = [headers, ...rows]; // Combine headers and rows
    const csv = Papa.unparse(csvData);

    // Create a Blob from the CSV string
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    // Trigger download
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
    doc.text('Paid Payment', 90, yOffset + 5);

    // Add underline
    const textWidth = doc.getTextWidth('Paid Payment'); // Get the width of the text
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


    // Payment Details Section
    const paymentMethod = outgoingdetail.paymentMethod;
    let paymentDetails = '';

    if (paymentMethod === 'neft') {
      paymentDetails = `NEFT No: ${outgoingdetail.neftNo}`;
    } else if (paymentMethod === 'rtgs') {
      paymentDetails = `RTGS No: ${outgoingdetail.rtgsNo}`;
    }

    // Add Payment details to the PDF
    doc.setFontSize(10);
    doc.text(`Payment Method: ${paymentMethod}`, 14, yOffset + 10);
    doc.text(paymentDetails, 14, yOffset + 20);

    yOffset += 17;

    // Vendor and Business Details
    const vendorDetailsRows = [
      [
        `Vendor Name: ${outgoingdetail.vendorName}\n` +
        `GSTIN: ${outgoingdetail.gstNumber}\n` +
        `Address: ${outgoingdetail.address}\n` +
        `City: ${outgoingdetail.city}\n` +
        `State: ${outgoingdetail.state}\n` +
        `Country: ${outgoingdetail.country}\n` +
        `Email: ${outgoingdetail.contactpersonEmail}`,
        `Business Name: ${business?.companyName}\n` +
        `GSTIN: ${business?.gstIn}\n` +
        `Address: ${business?.address1}\n` +
        `Phone: ${business?.phoneNo}\n` +
        `Email: ${business?.emailId}`,
        `Outgoing No: ${outgoingdetail.randomId}\n` +
        `Date: ${outgoingdetail.createdDate
          ? format(new Date(outgoingdetail.createdDate), 'dd-MM-yyyy')
          : 'Not Provided'}`
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
      'Paid Amount',
      'Without Tax Value',
      'With Tax Value'
    ];

    const filteredItems = outgoingdetail.grnId
      ? itemwise.filter(grn => grn.grnId === outgoingdetail.grnId).flatMap(grn => grn.itemDetails)
      : [];

    const tableRows = filteredItems.map((item, index) => {
      const unitPrice = item.unitPrice || 0;
      const quantity = item.quantity || 0;
      const withoutTaxValue = unitPrice * quantity;
      const taxAmount = withoutTaxValue * (item.purchasetaxName / 100);
      const withTaxValue = withoutTaxValue + taxAmount;

      const amountToDisplay = outgoingdetail.fullPaymentAmount || outgoingdetail.advanceAmount || outgoingdetail.partialAmount || 0.0;  // Show paidAmount if exists, otherwise advanceAmount, else '0.00'

      return [
        outgoingdetail.invoiceNo,      // Invoice No
        outgoingdetail.invoiceDate ? format(new Date(outgoingdetail.invoiceDate), 'dd-MM-yyyy') : 'Not Provided',
        outgoingdetail.vendorName,     // Vendor Name
        item.itemName,
        `${item.purchasetaxName}%`,        // Tax Details
        taxAmount.toFixed(2),                   // Tax Amount
        amountToDisplay.toFixed(2),             // Paid Amount (either paidAmount or advanceAmount)
        withoutTaxValue.toFixed(2),             // Without Tax Value
        withTaxValue.toFixed(2),                // With Tax Value
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
      bodyStyles: { lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], fontSize: 7 },
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

    // Overall Total Payable Amount or Advance Amount
    const discount = outgoingdetail.discountDetails || 0;
    const totalPayableAmount = outgoingdetail.totalPayableAmount || 0;
    const fullPaymentAmount = outgoingdetail.fullPaymentAmount || 0;
    const partialAmount = outgoingdetail.partialAmount || 0;
    const advanceAmount = outgoingdetail.advanceAmount || 0;

    let paidAmount = 0;

    if (outgoingdetail.status === 'Fully Paid') {
      paidAmount = fullPaymentAmount;
    } else if (outgoingdetail.status === 'Partially Paid') {
      paidAmount = partialAmount;
    } else if (outgoingdetail.status === 'Advance Paid') {
      paidAmount = advanceAmount;
    }

    const summaryTable = [
      ['Discount', discount.toFixed(2)],
      ['Paid Amount', paidAmount.toFixed(2)],
      ['Total Payable Amount', totalPayableAmount ? totalPayableAmount.toFixed(2) : '0.00']
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

    // Status Image
    let statusImage = '';
    if (outgoingdetail.status === 'Fully Paid') {
      statusImage = '/images/paid.jpg';
    } else if (outgoingdetail.status === 'Partially Paid') {
      statusImage = '/images/partial.jpg';
    } else if (outgoingdetail.status === 'Advance Paid') {
      statusImage = '/images/advancecash.jpg';
    }

    if (statusImage) {
      const img = new Image();
      img.src = statusImage;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          doc.addImage(img, 'jpg', 150, yOffset + 50, 30, 20);
          resolve();
        };
        img.onerror = reject;
      });
    }
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${totalPages}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }
    doc.save(`${outgoingdetail.vendorName}_PaymentDetails.pdf`);
  };

  // Handle toggling the item details view
  const handleViewDetails = (index: number) => {
    setSelectedOutgoing(paidOutgoings[index]); // Set the selected outgoing
    setOpenDetailsDialog(true); // Open the dialog
  };
  // Extract unique vendor names from the filtered outgoings
  const vendorNames = Array.from(
    new Set(paidOutgoings.map(outgoing => outgoing.vendorName)) // Map to vendorName and de-duplicate
  );


  // Handle closing the details dialog
  const handleCloseDetailsDialog = () => {
    setOpenDetailsDialog(false);
  };

  return (
    <Box>
      < YenBookPage />
      <Box sx={{ p: 1, backgroundColor: "white", mx: 1 }}>
        <Box display="flex" flexDirection="column" alignItems="start" mb={1}>
          {/* First Row: Six Buttons and Typography in the same row */}
          <Grid container spacing={1} alignItems="center">
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
{/* 
            <Grid item>
              <Link href="/yen-book/OutgoingPaymentPage/AdvancePayment" passHref>
                <Button variant="contained" color="primary">Advance Payment</Button>
              </Link>
            </Grid> */}

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
            {/* Typography on the same row, aligned right */}
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
                  ml: 2,
                }}
              >
                Description:<br />
                Paid Payments page. Here, you can track all the <strong>payments made to vendors</strong> and view the details of each transaction.
              </Typography>
            </Grid> */}
          </Grid>

          {/* Second Row: Date Range Picker, Vendor Dropdown, Filter Buttons, and Download Button */}
          <Grid container spacing={1} alignItems="center" sx={{ mt: 1 }}>
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
                  disabled={!paidOutgoings || paidOutgoings.length === 0}
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
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>No</TableCell>
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
                      <TableCell colSpan={8} style={{ textAlign: 'center' }}>
                        No data available
                      </TableCell>
                    </TableRow>
                  ) : (paidOutgoings.map((payment, index) => {
                    return (
                      <TableRow key={payment.outgoingId}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{payment.vendorName}</TableCell>
                        <TableCell>{payment.invoiceNo || "N/A"}</TableCell>
                        <TableCell>{payment.invoiceDate ? format(payment.invoiceDate, 'dd-MM-yyyy') : 'N/A'}</TableCell>
                        <TableCell>{payment.totalPayableAmount?.toFixed(2) || 0.00}</TableCell>
                        <TableCell>{payment.paidAmount?.toFixed(2)}</TableCell>
                        <TableCell>{payment.paymentDate ? format(payment.paymentDate, 'dd-MM-yyyy') : 'N/A'}</TableCell>
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
                            color="primary" sx={{ ml: 0.2 }}
                            onClick={() => handleDownload(payment.outgoingId ?? '')} // Corrected usage of purchaseOrderId
                          >
                            <PictureAsPdfIcon />
                          </IconButton>
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

        {/* Dialog for showing detailed payment information */}
        <Dialog open={openDetailsDialog} onClose={handleCloseDetailsDialog} maxWidth="md">
          <DialogTitle>Payment Details</DialogTitle>
          <DialogContent>
            {selectedOutgoing && (
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <strong>Vendor Name:</strong>
                    </TableCell>
                    <TableCell>{selectedOutgoing.vendorName}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <strong>Invoice No:</strong>
                    </TableCell>
                    <TableCell>{selectedOutgoing.invoiceNo}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <strong>Total Payable Amount:</strong>
                    </TableCell>
                    <TableCell>{selectedOutgoing.totalPayableAmount?.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <strong>Total Paid:</strong>
                    </TableCell>
                    <TableCell>
                      {(selectedOutgoing.advanceAmount || 0) +
                        (selectedOutgoing.partialAmount || 0) +
                        (selectedOutgoing.fullPaymentAmount || 0)}
                    </TableCell>

                  </TableRow>
                </TableBody>
              </Table>
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
              onClick={generatePaidPaymentCSV}
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

export default PaidPaymentComponent;
