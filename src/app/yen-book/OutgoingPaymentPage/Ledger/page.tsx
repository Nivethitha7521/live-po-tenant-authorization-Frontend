"use client";
import React, { useEffect, useRef, useState } from "react";
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
  CircularProgress,
  Snackbar,
  SelectChangeEvent,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  AutocompleteChangeReason,
  Autocomplete,
  TextField,
} from "@mui/material";
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';  // CSV icon
import {
  fetchOutgoings, selectOutgoings, selectCurrentPage,
  selectPageSize,
  selectTotalItems, setPagination, clearSnackbarMessage, setSnackbarMessage, setSnackbarOpen,
  fetchVendorDetails
} from "../../../../features/yen-purchase/Outgoing/outgoingPaymentSlice"; // Adjust the path as needed
import { AppDispatch } from "@/redux/store";
import YenBookPage from "../../page";
import { fetchBusinesses, fetchPhoto, selectBusinesses } from '@/features/account-setting/businessSlice';
import DateRangeFilter from "@/components/agingFilter";
import FilterAltIcon from '@mui/icons-material/FilterAlt'; // Import the filter icon
// Import jsPDF and autoTable
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { Outgoing, VendorDetail } from "@/Models/outgoingModel";
import { format } from "date-fns";
import Link from "next/link";
import Papa from "papaparse";
import { ChevronLeft, ChevronRight } from "@mui/icons-material";
import 'react-date-range/dist/styles.css'; // main style file
import 'react-date-range/dist/theme/default.css'; // theme css file
import DateRangeDialog from "@/components/dateRange";
import { ClearIcon } from "@mui/x-date-pickers/icons";
import moment from "moment";
import { selectApinvoice } from "@/features/yen-purchase/AP/apInvoiceSlice";
import { selectGrn } from "@/features/yen-purchase/GRN/grnSlice";

const LedgerPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { outgoings, loading, error, snackbarMessage, snackbarOpen, outgoingvendor } = useSelector(selectOutgoings);
  const [selectedVendorName, setSelectedVendorName] = useState<VendorDetail | null>(null); // Default is null  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [totalpayment, setTotalPayment] = useState<number>(); // Initialize totalpayment as a number
  const [filteredOutgoing, setFilteredOutgoing] = useState<Outgoing[]>([]); // Explicit type declaration
  const [selectedDays, setSelectedDays] = useState<number | undefined>(undefined); // Using undefined to indicate "All Data"
  const { businesses } = useSelector(selectBusinesses);
  const { randomIdap } = useSelector(selectApinvoice);
  const { itemwise } = useSelector(selectGrn);
  const [fetchedBusinessIds, setFetchedBusinessIds] = useState(new Set());
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
  const isFetchingRef = React.useRef(false);
  const isInitialLoad = useRef(true);
  const handleFilterChange = (event: SelectChangeEvent<string | number>) => {
    const selectedValue = event.target.value;
    const selectedValueAsNumber = selectedValue === '' ? undefined : Number(selectedValue);

    setSelectedDays(selectedValueAsNumber); // Update local state

    // Dispatch the action with the selected filter
    dispatch(fetchOutgoings({
      page: newPage,  // Use current page (should be defined in your component state)
      size: pageSize,     // Use page size (should be defined in your component state)
      filterByStatus: true,
      filterBy: dateField,
      fromDate: StartDate,
      toDate: EndDate
    }));
  };
  // Initial data fetching
  useEffect(() => {
    if (isInitialLoad.current) {
      console.log('Initial load: Fetching businesses and vendor details');
      dispatch(fetchBusinesses());
      dispatch(fetchVendorDetails({ fetchAll: true }));
      isInitialLoad.current = false;
    }
  }, [dispatch]);

  // Fetch outgoings with controlled dependencies
  useEffect(() => {
    console.log('useEffect for fetchOutgoings triggered with dependencies:', {
      currentPage,
      pageSize,
      selectedDays,
      selectionRange,
      selectedVendorName,
    });

    const fetchData = async () => {
      if (isFetchingRef.current) {
        console.log('Fetch skipped: Already fetching');
        return;
      }

      isFetchingRef.current = true;
      try {
        console.log('Starting fetchOutgoings');
        const formattedStartDate = moment(selectionRange.startDate).startOf('day').toDate();
        const formattedEndDate = moment(selectionRange.endDate).endOf('day').toDate();

        await dispatch(fetchOutgoings({
          page: currentPage,
          size: pageSize,
          filterByStatus: true,
          filterBy: 'paymentDate',
          fromDate: formattedStartDate,
          toDate: formattedEndDate,
          vendorName: selectedVendorName?.vendorName,
        }));
        console.log('fetchOutgoings completed');
      } catch (error) {
        console.error('Error fetching outgoings:', error);
      } finally {
        isFetchingRef.current = false;
        console.log('isFetchingRef reset');
      }
    };

    fetchData();
  }, [dispatch, currentPage, pageSize, selectionRange.startDate, selectionRange.endDate, selectedVendorName]);
  // Fetch data based on the selected vendor
  const handleOpenDialog = () => {
    setOpenDialog(true);
  };
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > Math.ceil(totalItems / pageSize)) return;

    dispatch(setPagination({ page: newPage, size: pageSize }));
    // Don't dispatch fetchOutgoings here - let the useEffect handle it
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



  const handleCloseDialog = () => {
    setOpenDialog(false);
  };
  // Get unique vendor names for the dropdown
  const vendorNames = Array.from(
    new Set(
      outgoings.map(outgoing => outgoing.vendorName) // Maps to vendorName
    )
  );

  const handleVendorChange = (
    event: React.SyntheticEvent,
    newValue: VendorDetail | null, // `newValue` is a VendorDetail or null
    reason: AutocompleteChangeReason
  ) => {
    setSelectedVendorName(newValue); // Set the selected vendor directly
  };

  useEffect(() => {
    businesses.forEach((business) => {
      if (!fetchedBusinessIds.has(business.businessId)) {
        dispatch(fetchPhoto(business.businessId));
        setFetchedBusinessIds(prevSet => new Set(prevSet).add(business.businessId));
      }
    });
  }, [businesses, fetchedBusinessIds, dispatch]);
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
        page: newPage, size: pageSize,
        fromDate: formattedStartDate instanceof Date ? formattedStartDate : undefined,
        toDate: formattedEndDate instanceof Date ? formattedEndDate : undefined,
        vendorName: selectedVendorName?.vendorName, // Use vendorName from selectedVendorName object
        filterBy: 'paymentDate',
        filterByStatus: true
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
    setSelectedVendorName(null);
    setSelectedDays(undefined);
    dispatch(fetchOutgoings({
      page: 1, size: pageSize, filterBy: dateField,
      fromDate: StartDate,
      toDate: EndDate
    }));
  }

  const generateOutgoingInvoicePDF = () => {
    const doc = new jsPDF();

    // Starting yOffset for content
    let yOffset = 10;

    // Define the logo and title position
    const logoX = 12;  // Position for logo
    const titleX = 80; // Position for title

    // Add business image on the left side (adjust as needed)
    const business = businesses.length > 0 ? businesses[0] : null;

    if (business && business.imageUrl) {
      try {
        // Add image with width 20, height 20, adjust the size/position as per your requirements
        doc.addImage(business.imageUrl, 'JPEG', logoX, yOffset, 20, 20);
      } catch (e) {
        console.error("Image failed to load:", e);
      }
    }

    // Add heading/title below the image
    yOffset += 10;  // Add some space below the image
    const title = "Purchase Ledger";
    doc.setFontSize(12);  // Set font size for the heading

    // Get the width of the title text
    const titleWidth = doc.getTextWidth(title);

    // Set the title in the center based on its width
    doc.text(title, (doc.internal.pageSize.getWidth() - titleWidth) / 2, yOffset);

    // Add a line below the title
    yOffset += 2;
    doc.setLineWidth(0.1); // Set line thickness
    doc.line(
      (doc.internal.pageSize.getWidth() - titleWidth) / 2, // Start X (centered based on title width)
      yOffset, // Y position
      (doc.internal.pageSize.getWidth() + titleWidth) / 2, // End X (centered based on title width)
      yOffset // Y position
    );

    // Adjust yOffset for content below heading and image
    yOffset += 10;

    // Define the columns for the PDF
    const columns = [
      "S.No",
      "Payment Date",
      "Vendor Name",
      "Invoice Date",
      "Payment Method",
      "Reference No", // Add new column for reference number
      "Account Payable(Credit)",
      "Paid Amount(Debit)",
      "Remaining Amount",
    ];

    // Filter out only the rows where there is a payment
    const rows = filteredPayments.map((outgoing: any, index) => {
      const paidAmount = outgoing.fullPaymentAmount || outgoing.partialAmount || outgoing.advanceAmount || 0;

      // Skip rows where no payment is made (i.e., paidAmount is 0 or undefined)
      if (paidAmount === 0) return null;

      // Determine reference based on payment method
      let reference: string | undefined = "";
      if (outgoing.paymentMethod === "cash") {
        reference = outgoing.cashVoucherNo?.toString();
      } else if (outgoing.paymentMethod === "neft") {
        reference = outgoing.neftNo?.toString();
      } else if (outgoing.paymentMethod === "rtgs") {
        reference = outgoing.rtgsNo?.toString();
      } else if (outgoing.paymentMethod === "cheque") {
        reference = outgoing.chequeNo?.toString();
      } else if (outgoing.paymentMethod === "online") {
        reference = outgoing.onlinePayment?.toString();
      }

      return [
        `${index + 1}`,
        outgoing.lastUpdatedDate ? format(new Date(outgoing.lastUpdatedDate), 'dd-MM-yyyy') : 'Not Provided',
        outgoing.vendorName,
        outgoing.invoiceDate ? format(new Date(outgoing.invoiceDate), 'dd-MM-yyyy') : 'Not Provided',
        outgoing.paymentMethod, // Payment Method
        reference || 'N/A', // Add Reference Number here
        (outgoing.payableAmount || 0).toFixed(2),
        paidAmount.toFixed(2),
        (outgoing.totalPayableAmount || 0).toFixed(2),
      ];
    }).filter(row => row !== null); // Remove null rows (where no payment was made)

    // Only generate the table if there are rows to display
    if (rows.length > 0) {
      doc.autoTable({
        head: [columns],
        body: rows,
        startY: 30,
        headStyles: {
          fillColor: [0, 0, 128],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold",
        },
        bodyStyles: {
          fontSize: 7,
          textColor: [0, 0, 0]
        },
      });
      const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Page ${i} of ${totalPages}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
  }
  
      doc.save("Ledger_Report.pdf");
    } else {
      // If no payments exist, show a message in the PDF
      doc.text("No payments have been made to generate a report.", 20, 20);
      doc.save("Ledger_Report_Payments.pdf");
    }
    handleCloseDialog();

  };
  // Add these helper functions to resolve random IDs (adapted from OutgoingPaymentComponent)
  const getRandomId = (grnId: string, itemwise: any[]): string | undefined => {
    const grn = itemwise.find(grn => grn.grnId === grnId);
    return grn?.randomId;
  };

  const getApRandomId = (apinvoiceId: string, randomIdap: any[]): string | undefined => {
    const ap = randomIdap.find(ap => ap.invoiceId === apinvoiceId);
    return ap?.randomId;
  };

  const generateLedgerCSV = () => {

    // Define the columns for the CSV
    const columns = [
      "S.No",
      "Outgoing No", // Added for Outgoing randomId
      "PO No", // Added for PO randomId
      "GRN No", // Added for GRN randomId
      "AP No", // Added for AP randomId
      "Payment Date",
      "Vendor Name",
      "Invoice No", // Added for invoice number
      "Invoice Date",
      "Payment Method",
      "Reference No",
      "Tax Details", // Added for tax details
      "Discount Amount", // Added for discount
      "Account Payable (Credit)", // Aligned with invoiceplusdebit
      "Paid Amount (Debit)", // Aligned with paidAmount
      "Remaining Amount",
      "Payment Status", // Added for status
    ];

    // Filter outgoings to match table logic (only include rows with payments)
    const rows = outgoings
      .map((outgoing: Outgoing, index: number) => {
        const paidAmount =
          outgoing.fullPaymentAmount || outgoing.partialAmount || outgoing.advanceAmount || 0;

        // Skip rows where no payment is made
        if (paidAmount === 0) return null;

        // Determine reference based on payment method
        let reference: string | undefined = "";
        if (outgoing.paymentMethod === "cash") {
          reference = outgoing.cashVoucherNo?.toString();
        } else if (outgoing.paymentMethod === "neft") {
          reference = outgoing.neftNo?.toString();
        } else if (outgoing.paymentMethod === "rtgs") {
          reference = outgoing.rtgsNo?.toString();
        } else if (outgoing.paymentMethod === "cheque") {
          reference = outgoing.chequeNo?.toString();
        } else if (outgoing.paymentMethod === "online") {
          reference = outgoing.onlinePayment?.toString();
        } else if (outgoing.paymentMethod === "upi") {
          reference = outgoing.upi?.toString();
        } else if (outgoing.paymentMethod === "imps") {
          reference = outgoing.impsNo?.toString();
        }

        return [
          `${index + 1}`,
          outgoing.randomId || "N/A", // Outgoing No
          outgoing.poRandomId || "N/A", // PO No
          getRandomId(outgoing.grnId || "", itemwise) || "N/A", // GRN No
          getApRandomId(outgoing.invoiceId || "", randomIdap) || "N/A", // AP No
          outgoing.paymentDate
            ? format(new Date(outgoing.paymentDate), "dd-MM-yyyy")
            : outgoing.lastUpdatedDate
              ? format(new Date(outgoing.lastUpdatedDate), "dd-MM-yyyy")
              : "N/A", // Prefer paymentDate, fallback to lastUpdatedDate
          outgoing.vendorName || "N/A",
          outgoing.invoiceNo || "N/A", // Invoice No
          outgoing.invoiceDate ? format(new Date(outgoing.invoiceDate), "dd-MM-yyyy") : "N/A",
          outgoing.paymentMethod || "N/A",
          reference || "N/A",
          outgoing.taxDetails || "N/A", // Tax Details
          (outgoing.discountDetails || 0).toFixed(2), // Discount Amount
          (outgoing.invoiceplusdebit || outgoing.payableAmount || 0).toFixed(2), // Account Payable (Credit)
          paidAmount.toFixed(2), // Paid Amount (Debit)
          (outgoing.totalPayableAmount || 0).toFixed(2), // Remaining Amount
          outgoing.status || "N/A", // Payment Status
        ];
      })
      .filter(row => row !== null); // Remove null rows

    // Generate CSV if there are rows, otherwise provide a fallback message
    if (rows.length > 0) {
      const csvData = [columns, ...rows];
      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "Ledger_Report.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const noDataMessage = "No payments have been made to generate a report.";
      const csvData = [["Message"], [noDataMessage]];
      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "Ledger_Report_No_Payments.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    handleCloseDialog();
  };
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Typography color="error">{error}</Typography>;

  const filteredPayments = outgoings.filter(outgoing =>
    outgoing.status === 'Fully Paid' ||
    outgoing.status === 'Advance Paid' ||
    outgoing.status === 'Partially Paid'
  );
  return (
    <Box>
      <YenBookPage />
      <Box sx={{ p: 1, backgroundColor: "white" }}>
        <Box display="flex" alignItems="center" mb={2} ml={1}>
          <Grid container alignItems="center" justifyContent="flex-start">
            <Grid item>
              <Link href="/yen-book/OutgoingPaymentPage" passHref>
                <Button variant="contained" color="primary" sx={{ mr: 1 }}>
                  Outgoing Payment
                </Button>
              </Link>
            </Grid>

            <Grid item>
              <Link href="/yen-book/OutgoingPaymentPage/PreOutgoing" passHref>
                <Button variant="contained" color="primary" sx={{ mr: 1 }}>
                  Pre Outgoing
                </Button>
              </Link>
            </Grid>

            <Grid item>
              <Link href="/yen-book/OutgoingPaymentPage/AdvancePayment" passHref>
                <Button variant="contained" color="primary" sx={{ mr: 1 }}>
                  Advance Payment
                </Button>
              </Link>
            </Grid>

            <Grid item>
              <Link href="/yen-book/OutgoingPaymentPage/PendingPayment" passHref>
                <Button variant="contained" color="primary" sx={{ mr: 1 }}>
                  Partial Payment
                </Button>
              </Link>
            </Grid>

            <Grid item>
              <Link href="/yen-book/OutgoingPaymentPage/PaidPayment" passHref>
                <Button variant="contained" color="primary" sx={{ mr: 1 }}>
                  Payment Done
                </Button>
              </Link>
            </Grid>

            <Grid item>
              <Link href="/yen-book/OutgoingPaymentPage/Ledger" passHref>
                <Button variant="contained" sx={{
                  backgroundColor: 'white',
                  color: 'black',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  },
                  mr: 1
                }}>
                  Ledger
                </Button>
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
      ml: 2,
    }}
>
Description:<br />
      Purchase Ledger page. Here, you can track both <strong>credit</strong> and <strong>debit</strong> transactions, monitor payments made.
    </Typography>
  </Grid> */}

            <Grid container spacing={2} alignItems="center" sx={{ mt: 1 }}>
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

              {/* Commented-out Days Filter */}
              {/* <Grid item>
    <FormControl fullWidth>
      <Select
        value={selectedDays || ""} // Ensure default value is "All Data"
        onChange={handleFilterChange}
        displayEmpty
      >
        <MenuItem value="">All Data</MenuItem>
        <MenuItem value={30}>30 Days</MenuItem>
        <MenuItem value={60}>60 Days</MenuItem>
        <MenuItem value={90}>90 Days</MenuItem>
      </Select>
    </FormControl>
  </Grid> */}

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
                    sx={{ p: 0.3, marginRight: '10px' }}
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
        <TableContainer
          sx={{
            maxHeight: 'calc(100vh - 230px)', // Dynamic height based on viewport
            overflowY: 'auto',
            width: '100%',
            p: 2
          }}
        >
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>S.No</TableCell>
                <TableCell>Payment Date</TableCell>
                <TableCell>Vendor Name</TableCell>
                <TableCell>Payment</TableCell>
                <TableCell>Reference</TableCell> {/* New Column for Reference */}
                <TableCell>Invoice Date</TableCell>
                <TableCell>Account Payable(Credit)</TableCell>
                <TableCell>Debit</TableCell>
                <TableCell>Payable Amount</TableCell>
                <TableCell>PaidAmount</TableCell>
                <TableCell>Remaining Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {outgoings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} style={{ textAlign: 'center' }}>
                    No data available
                  </TableCell>
                </TableRow>
              ) : (
                outgoings
                  // .filter((outgoing) => selectedVendorName ? outgoing.vendorName === selectedVendorName?.vendorName : true) // Filter by vendor if selected
                  .map((outgoing, index: number) => {
                    const paidAmount = outgoing.fullPaymentAmount || outgoing.partialAmount || outgoing.advanceAmount || 0;

                    // Only show rows if a payment method and amount exist
                    if (!paidAmount) return null;

                    // Determine reference based on payment method
                    let reference: string | undefined = "";
                    if (outgoing.paymentMethod === "cash") {
                      reference = outgoing.cashVoucherNo?.toString();
                    } else if (outgoing.paymentMethod === "neft") {
                      reference = outgoing.neftNo?.toString();
                    } else if (outgoing.paymentMethod === "rtgs") {
                      reference = outgoing.rtgsNo?.toString();
                    } else if (outgoing.paymentMethod === "cheque") {
                      reference = outgoing.chequeNo?.toString();
                    } else if (outgoing.paymentMethod === "online") {
                      reference = outgoing.onlinePayment?.toString();
                    }

                    return (
                      <TableRow key={index}>
                        <TableCell>{index+1}</TableCell>
                        <TableCell>{outgoing.lastUpdatedDate ? format(new Date(outgoing.lastUpdatedDate), 'dd-MM-yyyy') : 'N/A'}</TableCell>
                        <TableCell>{outgoing.vendorName || 'N/A'}</TableCell>
                        <TableCell>{outgoing.paymentMethod || 'N/A'}</TableCell>
                        <TableCell>{reference || "N/A"}</TableCell>
                        <TableCell>{outgoing.invoiceDate ? format(new Date(outgoing.invoiceDate), 'dd-MM-yyyy') : 'N/A'}</TableCell>
                        <TableCell>{outgoing.invoiceplusdebit || 0}</TableCell>
                        <TableCell>{(outgoing.debitAmount || 0).toFixed(2)}</TableCell>
                        <TableCell>{outgoing.payableAmount}</TableCell>
                        <TableCell>{paidAmount.toFixed(2)}</TableCell>
                        <TableCell>{(outgoing.totalPayableAmount || 0).toFixed(2)}</TableCell>
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
              onClick={generateLedgerCSV}
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

export default LedgerPage;
