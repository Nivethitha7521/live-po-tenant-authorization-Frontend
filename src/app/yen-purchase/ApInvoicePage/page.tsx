"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, TextField, Button, Typography, Grid, Paper,
  TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  CircularProgress,
  IconButton,
  Snackbar,
  Backdrop,
  Tooltip,
  Menu,
  MenuItem,
  Autocomplete,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FilterAltIcon from '@mui/icons-material/FilterAlt'; // Import the filter icon
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';  // CSV icon
import ClearIcon from "@mui/icons-material/Clear"; // Clear icon
import { AppDispatch, RootState } from '@/redux/store';
import { fetchApInvoices, selectApinvoice, convertToGrnFromApReturned, updateApdiscountInvoice, setPagination, setSnackbarMessage, setSnackbarOpen, clearSnackbarMessage, setSearchQuery, selectTotalItems, selectCurrentPage, selectPageSize, postOutgoingAndUpdateDiscount } from '../../../features/yen-purchase/AP/apInvoiceSlice';
import YenPurchasePage from '../page';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import Link from 'next/link';
import { ApInvoice } from '@/Models/apModel';
import DateRangeFilter from '@/components/agingFilter';
import jsPDF from 'jspdf';
import "jspdf-autotable"; // Ensure this plugin is available for autoTable functionality
import { fetchBusinesses, fetchPhoto, selectBusinesses } from '@/features/account-setting/businessSlice';
import { addDays, format, parse } from 'date-fns';
import Papa from 'papaparse';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import 'react-date-range/dist/styles.css'; // main style file
import 'react-date-range/dist/theme/default.css'; // theme css file
import DateRangeDialog from '@/components/dateRange';
import { Vendor } from '@/Models/purchaseModel';
import { fetchAllVendors, selectPurchaseOrderState } from '@/features/yen-purchase/PurchaseOrder/purchaseOrderSlice';
import moment from 'moment';
import VendorSearchAutocomplete from '@/components/vendorsearchautocomplete';
import { VendorSearch } from '@/Models/vendor';
import { fetchDebitCreditNotesByDocument, selectDebitCreditNote, setDebitCreditDialogOpen, setDebitCreditDocumentId, setDebitCreditDocumentType } from '@/features/yen-purchase/DebitNoteSlice';
import DebitCreditNoteDialog from '@/components/yen-purchase/DebitNoteDialog';
import { Tab } from 'react-bootstrap';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
interface TaxAmounts {
  sgst: { [key: string]: number }; // SGST amounts with rate as key
  cgst: { [key: string]: number }; // CGST amounts with rate as key
  igst: { [key: string]: number }; // IGST amounts with rate as key
}

const initialApInvoiceState: ApInvoice = {
  invoiceId: '',
  purchaseOrderId: '',
  vendorName: '',
  apinvoiceDate: null,
  invoiceDate: null,
  invoiceNo: '',
  dueDate: null,
  itemDetails: [],
  comments: '',
  attachments: null,
  createdDate: null,
  poDate: null,
  lastUpdatedDate: null,
  status: '',
  invoiceAmount: 0,
  taxDetails: 0,
  discountDetails: 0,
  paymentTerms: '',
  paymentStatus: '',
  randomId: '',
  discountPrice: 0,
  grnId: '',
  grnDate: null,
  apDiscountPrice: 0,
  address: '',
  country: '',
  state: '',
  city: '',
  postalCode: 0,
  gstNumber: '',
  contactpersonEmail: '',
  shippingAddress: '',
  billingAddress: '',
  apReturnedDate: null,
  apPerson: '',
  apReturnedPerson: '',
  poRandomId: '',
  grnRandomId: '',
  apRandomId: '',
  debitAmount: 0,
  hasDebitCreditNotes: false
};

const VerifiedApInvoicePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [apInvoice] = useState<ApInvoice>(initialApInvoiceState);
  const [selectedInvoice, setSelectedInvoice] = useState<ApInvoice | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false); // For viewing item details
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);   // For confirming AP return
  const [outgoingDialogOpen, setOutgoingDialogOpen] = useState(false); // For confirming outgoing payment
  const { apInvoices, loading, error, snackbarOpen, snackbarMessage } = useSelector(selectApinvoice);
  const { businesses } = useSelector(selectBusinesses);
  const { vendors } = useSelector(selectPurchaseOrderState);
  const [discountPrice, setDiscountPrice] = useState(apInvoice.discountPrice || 0);
  const [apDiscountPrice, setApDiscountPrice] = useState<number>(apInvoice.apDiscountPrice ?? 0);
  const [loadingCenter, setLoading] = useState(false); // Loading state
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null); const [fetchedBusinessIds, setFetchedBusinessIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendorName, setSelectedVendorName] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<VendorSearch | null>(null);
  const [status, setStatus] = useState('Pending'); // Default status filter is "Pending"
  const [filteredAp, setFilteredAp] = useState<ApInvoice[]>([]); // Explicit type declaration
  const [dialogDownloadOpen, setDialogDownloadOpen] = useState(false);
  const [dialogSummaryOpen, setDialogSummaryOpen] = useState(false);
  const currentPage = useSelector(selectCurrentPage);
  const pageSize = useSelector(selectPageSize);
  const totalItems = useSelector(selectTotalItems);
  const newPage = useSelector(selectCurrentPage);
  const [anchorElDownload, setAnchorElDownload] = useState<null | HTMLElement>(null); // Allow anchorEl to be null or an HTMLElement
  const [selectionRange, setSelectionRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    key: 'selection',
  });
  const [anchorElDate, setAnchorElDate] = useState<null | HTMLElement>(null);
  const dateField = 'apinvoiceDate';
  const fromDate = moment().utc().startOf('day').toDate(); // Start of the day (in UTC)
  const toDate = moment().utc().endOf('day').toDate(); // End of the day (in UTC)
  const [shouldFetch, setShouldFetch] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const debitCreditNotes = useSelector((state: RootState) => selectDebitCreditNote(state).debitCreditNotes);
  useEffect(() => {
    fetchBusinesses();
  }, [dispatch])
  useEffect(() => {
    if (shouldFetch && !loading) {
      const action = fetchApInvoices({
        page: newPage,
        size: pageSize,
        status,
        dateFilterField: dateField,
        fromDate,
        toDate
      });
      dispatch(action);
      setShouldFetch(false);
    }
  }, [dispatch, newPage, pageSize, status, dateField, fromDate, toDate, loading, shouldFetch]);
  useEffect(() => {
    businesses.forEach((business) => {
      if (!fetchedBusinessIds.has(business.businessId)) {
        dispatch(fetchPhoto(business.businessId));
        setFetchedBusinessIds(prevSet => new Set(prevSet).add(business.businessId));
      }
    });
  }, [businesses, fetchedBusinessIds, dispatch]);
  useEffect(() => {
    dispatch(fetchAllVendors());
    dispatch(fetchBusinesses());
  }, [dispatch]);
  const handleViewDetails = (invoice: ApInvoice) => {
    setSelectedInvoice(invoice);
    setDetailsDialogOpen(true); // Open the details dialog
  };
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > Math.ceil(totalItems / pageSize)) {
      // Optionally handle out-of-bounds page number
      return;
    }
    const appliedFromDate = selectionRange?.startDate instanceof Date ? moment(selectionRange.startDate).startOf('day').toDate() : fromDate;
    const appliedToDate = selectionRange?.endDate instanceof Date ? moment(selectionRange.endDate).endOf('day').toDate() : toDate;
    dispatch(setPagination({ page: newPage, size: pageSize }));
    dispatch(fetchApInvoices({
      page: newPage, size: pageSize, status, dateFilterField: dateField, fromDate: appliedFromDate, toDate: appliedToDate, vendorName: selectedVendorName || '',
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
  const handleViewCreditNotes = (invoiceId: string) => {
    console.log('Opening DebitCreditNoteDialog for invoiceId:', invoiceId);
    dispatch(setDebitCreditDocumentId(invoiceId)); // Set documentId
    dispatch(setDebitCreditDocumentType('AP Invoice')); // Set documentType
    dispatch(setDebitCreditDialogOpen(true)); // Open dialog
    dispatch(fetchDebitCreditNotesByDocument({ documentId: invoiceId, page: 1, size: 50 }));
  };
  const handleCloseDetailsDialog = () => {
    setDetailsDialogOpen(false);
    setSelectedInvoice(null); // Clear the selected invoice
  };
  const handleDiscountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setApDiscountPrice(value === '' ? 0 : parseFloat(value) || 0); // Handle empty input and invalid numbers
  };

  const handleOpen = () => {
    setDialogSummaryOpen(true);
  };
  const handleClose = () => {
    setDialogSummaryOpen(false);
  };
  // Precompute isDisabled and tooltipTitle based on hasDebitCreditNotes
  const invoiceCreditNoteStatus = useMemo(() => {
    const statusMap: { [key: string]: { isDisabled: boolean; tooltipTitle: string } } = {};
    apInvoices.forEach((invoice) => {
      const hasDebitCreditNotes = invoice.hasDebitCreditNotes ?? debitCreditNotes.some((note) => note.documentId === invoice.invoiceId);
      statusMap[invoice.invoiceId] = {
        isDisabled: !hasDebitCreditNotes,
        tooltipTitle: hasDebitCreditNotes ? 'View Debit/Credit Notes' : 'No Debit/Credit Notes Available',
      };
    });
    return statusMap;
  }, [apInvoices, debitCreditNotes]);
  const generateInvoicePDF = () => {
    const doc = new jsPDF();
    let yOffset = 7; // Starting y-offset for content

    const business = businesses.length > 0 ? businesses[0] : null;

    if (!business) {
      console.error('Business info not found!');
      return;
    }

    // Add business image on the left side
    if (business.imageUrl) {
      try {
        doc.addImage(business.imageUrl, 'JPEG', 14, yOffset, 20, 20); // Adjust image size and position
      } catch (e) {
        console.error("Image failed to load:", e);
      }
    }

    yOffset += 10; // Move down after image to create space for the title

    // Add a title for the PDF
    doc.setFontSize(12); // Increase title font size
    const title = "APInvoice Order Summary";
    const pageWidth = doc.internal.pageSize.width; // Get page width directly
    const fontSize = doc.getFontSize(); // Get font size using the public method
    const titleWidth = doc.getStringUnitWidth(title) * fontSize / doc.internal.scaleFactor;
    const titleX = (pageWidth - titleWidth) / 2;
    doc.text(title, titleX, yOffset); // Centered title

    // Underline the title - Adjusting the line position
    const underlineOffset = 3; // Adjust distance from the title to underline
    doc.setLineWidth(0.1); // Set line width for the underline
    doc.line(titleX, yOffset + underlineOffset, titleX + titleWidth, yOffset + underlineOffset); // Draw the underline

    yOffset += 15; // Move yOffset down after the title and underline to ensure space

    // Format the current date
    const today = new Date();
    const currentDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

    // Calculate the total ordered amount before generating the table
    const totalInvoiceAmount = (filterAp || []).reduce((sum, order) => {
      const orderInvoiceAmount = order.invoiceAmount || 0; // Get the invoice amount for the order
      return sum + orderInvoiceAmount; // Accumulate the total invoice amount
    }, 0);

    // Display "Total Invoice Amount" and "Date" on the same row
    doc.setFontSize(10); // Smaller font size for these details
    doc.text(`Total Invoice Amount: ${totalInvoiceAmount.toFixed(2)}`, 14, yOffset); // Total on the left

    // Calculate xOffset for the date to align it to the right
    const totalWidth = doc.getStringUnitWidth(`Total Invoice Amount: ${totalInvoiceAmount.toFixed(2)}`) * fontSize / doc.internal.scaleFactor;
    const dateX = pageWidth - totalWidth - 14; // Right-align date text

    doc.text(`Date: ${currentDate}`, dateX, yOffset); // Date on the right of the total

    yOffset += 5; // Add space before the table for better readability

    // Table headers for summary data
    const headers = [
      ["S.No", "AP.No", "Invoice Date", "InvoiceNo", "Vendor Name", "TotalItems"]
    ];

    // Prepare rows for purchase order summary (filter on only the valid orders)
    const rows = (filterAp || []).map((ap, index) => {
      const totalItemsQuantity = Array.isArray(ap.itemDetails) && ap.itemDetails.length > 0
        ? ap.itemDetails.reduce((sum, item) => sum + (item.quantity || 0), 0)
        : 0;

      const totalInvoiceAmount = ap.invoiceAmount || 0;
      const totalDiscount = ap.discountDetails || 0;
      const finalAmount = totalInvoiceAmount - totalDiscount;

      if (!ap.randomId || !ap.vendorName || !ap.apinvoiceDate || totalInvoiceAmount <= 0) {
        return null;
      }

      return [
        (index + 1).toString(), // Serial number as first column
        ap.randomId.toString(),
        ap.invoiceDate ? format(new Date(ap.invoiceDate), 'dd-MM-yyyy') : '',
        ap.invoiceNo,
        ap.vendorName.toString(),
        totalItemsQuantity.toString(),
      ];
    }).filter(row => row !== null);

    // Add the table to the PDF with custom styles
    doc.autoTable({
      head: headers,
      body: rows,
      startY: yOffset, // Start the table below the "Total Ordered Amount"
      styles: {
        fillColor: [30, 144, 255], // DodgerBlue color
        textColor: [255, 255, 255], // White text color
        lineColor: [0, 0, 0], // Black table borders
        fontSize: 8
      },
      headStyles: {
        fillColor: [0, 0, 128], // DodgerBlue background for the header
        textColor: [255, 255, 255] // White text color for header
      },
      bodyStyles: {
        fillColor: [255, 255, 255], // White background for rows
        textColor: [0, 0, 0] // Black text color for rows
      },
      columnStyles: {
        0: { halign: 'center' }, // Center-align "SNO"
        1: { halign: 'center' }, // Center-align "apId"
        2: { halign: 'center' }, // Center-align "Invoice Date"
        3: { halign: 'center' }, // Center-align "InvoiceNo"
        4: { halign: 'center' }, // Center-align "Vendor Name"
        5: { halign: 'center' } // Center-align "Total Items"
      }
    });

    // Add page numbers to all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${totalPages}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }

    // Save the PDF with a dynamic name based on purchase order ID
    const pdfFilename = `ApVendorwise.pdf`;
    doc.save(pdfFilename);
    setDialogDownloadOpen(false);
  };
  const handleVendorChange = (vendor: VendorSearch | null) => {
    setSelectedVendor(vendor);
    setSelectedVendorName(vendor ? vendor.vendorName : '');
  };

  const handleExportCSV = () => {
    // Define the headers for the CSV
    const headers = [
      "AP No",
      "Vendor Name",
      "Total Items",
      "Invoice Date",
      "Total Invoice Amount",
      "Final Amount"
    ];

    // Map the AP data into the CSV rows
    const rows = (filterAp || []).map((ap) => {
      const totalItemsQuantity = Array.isArray(ap.itemDetails) && ap.itemDetails.length > 0
        ? ap.itemDetails.reduce((sum, item) => sum + (item.quantity || 0), 0)
        : 0;

      const totalInvoiceAmount = ap.invoiceAmount || 0;
      const totalDiscount = ap.discountDetails || 0;
      const finalAmount = totalInvoiceAmount - totalDiscount;

      if (!ap.randomId || !ap.vendorName || !ap.apinvoiceDate || totalInvoiceAmount <= 0) {
        return null;
      }

      return [
        ap.randomId.toString(),
        ap.vendorName.toString(),
        totalItemsQuantity.toString(),
        ap.apinvoiceDate ? format(new Date(ap.apinvoiceDate), 'dd-MM-yyyy') : '',  // Format ap.apinvoiceDate
        totalInvoiceAmount.toFixed(2).toString(),
        finalAmount.toFixed(2).toString(),
      ];
    }).filter(row => row !== null);

    // Combine the headers and rows into the final CSV data
    const csvData = [headers, ...rows];

    // Use PapaParse to generate the CSV string
    const csv = Papa.unparse(csvData);

    // Create a blob for the CSV data
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

    // Create a download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "APVendorwise.csv");

    // Trigger the download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDialogDownloadOpen(false);
  };

  const handleSearchChange = (event: React.ChangeEvent<{}>, newValue: string) => {
    setSearchQuery(newValue); // Update the search query
  };

  const handleVendorSelect = (vendor: Vendor | null) => {
    if (vendor) {
      setSelectedVendor(vendor);
      setSelectedVendorName(vendor.vendorName); // Set selected vendor name
    } else {
      setSelectedVendor(null);
      setSelectedVendorName(''); // Clear selection if no vendor is selected
    }
  };
  const generatePendingInvoiceSummaryPDF = () => {
    const doc = new jsPDF();

    const yOffset = 10; // Start position for the content

    // Add business image to the left corner (if available)
    const business = businesses.length > 0 ? businesses[0] : null;
    if (business && business.imageUrl) {
      try {
        doc.addImage(business.imageUrl, 'JPEG', 14, yOffset, 20, 20); // Adjust image size and position
      } catch (e) {
        console.error("Image failed to load:", e);
      }
    }

    // Adjust yOffset after the image (if any)
    let currentYOffset = yOffset + 10; // Add space after the image

    // Title for the Invoice Summary
    doc.setFontSize(12);
    const title = "Pending Invoice Summary";
    const pageWidth = doc.internal.pageSize.width;
    const titleWidth = doc.getStringUnitWidth(title) * doc.getFontSize() / doc.internal.scaleFactor;
    const titleX = (pageWidth - titleWidth) / 2; // Center the title
    doc.text(title, titleX, currentYOffset);
    doc.setLineWidth(0.1); // Set line width for the underline
    doc.line(titleX, yOffset + 2, titleX + titleWidth, yOffset + 2); // Draw the underline

    currentYOffset += 15; // Move down after title for space

    // Filter out invoices with status 'Pending'
    const pendingInvoices = (apInvoices || []).filter(invoice => invoice.status === "Pending");

    // Calculate the total amounts for the pending invoices
    const totalAmount = pendingInvoices.reduce((sum, invoice) => {
      const total = invoice.itemDetails.reduce((totalItem, item) => totalItem + (item.stockQuantity * item.unitPrice), 0);
      return sum + total;
    }, 0);

    const totalTax = pendingInvoices.reduce((sum, invoice) => {
      const tax = invoice.itemDetails.reduce((taxItem, item) => taxItem + (item.purchasetaxName * item.stockQuantity * item.unitPrice) / 100, 0);
      return sum + tax;
    }, 0);

    const totalDiscount = pendingInvoices.reduce((sum, invoice) => {
      const discount = invoice.itemDetails.reduce((discountItem, item) => discountItem + (item.discountAmount || 0), 0);
      return sum + discount;
    }, 0);

    const totalInvoiceAmount = totalAmount + totalTax - totalDiscount;

    const today = new Date();
    const currentDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

    // Display the summary data (total amounts, date)
    doc.setFontSize(10);
    doc.text(`Total Invoice Amount: ${totalInvoiceAmount.toFixed(2)}`, 14, currentYOffset);
    doc.text(`Date: ${currentDate}`, pageWidth - 14, currentYOffset, { align: 'right' });

    currentYOffset += 5; // Add space before the table for better readability

    // Table headers for Invoice Summary
    const headers = [
      ["S.No", "AP.No", "Vendor Name", "Item Name", "Quantity", "Price", "Tax", "Discount", "Total"],
    ];

    // Rows based on pending invoices data
    const rows = pendingInvoices.map((invoice, index) => {
      return invoice.itemDetails.map((item) => [
        (index + 1).toString(), // Serial number as first column
        invoice.randomId.toString(),
        invoice.vendorName, // Vendor Name
        item.itemName, // Item Name
        item.stockQuantity, // Quantity
        item.unitPrice, // Price
        `${item.purchasetaxName}%`, // Tax Rate
        item.discountAmount, // Discount Amount
        item.totalPrice // Total
      ]);
    }).flat(); // Flatten the rows array

    // Add the table to the PDF with custom styles
    doc.autoTable({
      head: headers,
      body: rows,
      startY: currentYOffset, // Start the table below the summary section
      styles: {
        fillColor: [30, 144, 255], // DodgerBlue color
        textColor: [255, 255, 255], // White text color
        lineColor: [0, 0, 0], // Black table borders
        fontSize: 8
      },
      headStyles: {
        fillColor: [0, 0, 128], // Dark blue background for header
        textColor: [255, 255, 255], // White text color for header
      },
      bodyStyles: {
        fillColor: [255, 255, 255], // White background for rows
        textColor: [0, 0, 0], // Black text color for rows
      },
      columnStyles: {
        4: { halign: 'right' }, // Right-align "Price"
        5: { halign: 'right' }, // Right-align "Tax"
        6: { halign: 'right' }, // Right-align "Discount"
        7: { halign: 'right' }, // Right-align "Total"
      },
    });

    // Add page numbers to all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${totalPages}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }

    // Save the PDF with a dynamic name based on the first Pending Invoice Number
    const pdfFilename = `PendingInvoiceItemwise.pdf`;
    doc.save(pdfFilename);
    handleClose();
  };
  const generatePendingInvoiceSummaryCSV = () => {
    // Define CSV headers
    const headers = ["S.No", "AP.No", "Vendor Name", "Item Name", "Quantity", "Price", "Tax", "Discount", "Total"];

    // Prepare rows by mapping through pending invoices
    const rows = (apInvoices || []).filter(invoice => invoice.status === "Pending").map((invoice, index) => {
      return invoice.itemDetails.map((item) => [
        (index + 1).toString(), // Serial number
        invoice.randomId.toString(),
        invoice.vendorName,
        item.itemName,
        item.stockQuantity,
        item.unitPrice,
        `${item.purchasetaxName}%`,  // Tax Rate
        item.discountAmount,         // Discount Amount
        item.totalPrice              // Total
      ]);
    }).flat();

    // Combine headers and rows
    const csvData = [headers, ...rows];

    // Convert to CSV format using PapaParse
    const csv = Papa.unparse(csvData);

    // Create a Blob and trigger download
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "PendingInvoiceItemwise.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    handleClose(); // Close any modal/dialog if used
  };
const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };
  const handleFilterClick = () => {
    let filtered = apInvoices;

    const formattedStartDate = selectionRange?.startDate instanceof Date ? moment(selectionRange.startDate).startOf('day').toDate() : fromDate;
    const formattedEndDate = selectionRange?.endDate instanceof Date ? moment(selectionRange.endDate).endOf('day').toDate() : toDate;

    // Filter based on selected vendor name
    if (selectedVendorName) {
      filtered = filtered.filter(ap =>
        ap.vendorName?.toLowerCase().includes(selectedVendorName.toLowerCase())
      );
    }

    // Filter based on start date
    if (formattedStartDate) {
      filtered = filtered.filter(ap => {
        const invoiceDateParsed = ap.apinvoiceDate ? new Date(ap.apinvoiceDate) : null;
        return invoiceDateParsed && invoiceDateParsed >= formattedStartDate;
      });
    }

    // Filter based on end date
    if (formattedEndDate) {
      filtered = filtered.filter(ap => {
        const invoiceDateParsed = ap.apinvoiceDate ? new Date(ap.apinvoiceDate) : null;
        return invoiceDateParsed && invoiceDateParsed <= formattedEndDate;
      });
    }

    // Filter based on status
    if (status) {
      filtered = filtered.filter(ap => ap.status === status);
    }

    // Dispatch the action with filters
    dispatch(fetchApInvoices({
      page: newPage,
      size: pageSize,
      fromDate: formattedStartDate,
      toDate: formattedEndDate,
      vendorName: selectedVendorName || '',
      status: status || '',
    }))
      .then(response => {
        const data = response.payload || [];

        // Handle no results inside the fulfilled case
        if (data.length === 0) {
          setSnackbarMessage('No matching AP invoices found.');
          setSnackbarOpen(true); // Open snackbar
        } else {
          setFilteredAp(filtered); // Update filtered AP invoices state for frontend display
        }
      })
      .catch(error => {
        console.error('Error fetching AP invoices:', error);
        setSnackbarMessage(error.message || 'Error fetching AP invoices');
        setSnackbarOpen(true); // Open snackbar on failure
      });
  };
  const handleFilterClose = () => {
    // Reset filter states (except for the date)
    setSelectionRange({
      startDate: new Date(),  // Set to current date
      endDate: new Date(),    // Set to current date
      key: 'selection',       // Retain the key
    });
    setSelectedVendor(null); // Clear vendor selection
    dispatch(fetchApInvoices({ page: 1, size: pageSize, status, dateFilterField: dateField, fromDate, toDate }));
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorElDownload(event.currentTarget as HTMLElement); // Cast event.currentTarget to HTMLElement
  };

  const handleCloseAnchor = () => {
    setAnchorElDownload(null); // Close the dropdown menu
  };
  const handleVendorwiseClick = () => {
    setDialogDownloadOpen(true); // Perform vendorwise action
    handleCloseAnchor(); // Close the dropdown after the action
  };
  const handleItemwiseClick = () => {
    handleOpen(); // Perform itemwise action
    handleCloseAnchor(); // Close the dropdown after the action
  };

  const handleReturnAp = async () => {
    if (!selectedInvoice) return;
    setLoading(true);
    try {
      // Dispatch the action and await the result
      await dispatch(convertToGrnFromApReturned(selectedInvoice.invoiceId)).unwrap();
      dispatch(fetchApInvoices({
        page: newPage, size: pageSize, status, dateFilterField: dateField, fromDate, toDate, vendorName: selectedVendorName || '',
      }));
      // Action completed successfully
      console.log('Conversion to GRN successful!');

    } catch (err) {
      // Log or handle error
      console.error('Error converting AP to GRN:', err);

    } finally {
      // Close dialogs after the action is finished
      setReturnDialogOpen(false);
      setDetailsDialogOpen(false);
      setLoading(false);

    }
  };


  // Submit handler in your component
  const handleSubmit = () => {
    if (selectedInvoice) {
      dispatch(updateApdiscountInvoice({ invoiceId: selectedInvoice.invoiceId, apDiscountPrice }));
      dispatch(setSnackbarMessage('Discount price updated successfully'));
      dispatch(setSnackbarOpen(true));
    } else {
      console.error('No invoice selected');
    }
  };

  const handlePostOutgoingPayment = () => {
    if (!selectedInvoice) return;
    setLoading(true);

    // Get the discount price from the TextField, default to 0 if invalid or empty
    const discountToApply = isNaN(apDiscountPrice) || apDiscountPrice === null ? 0 : apDiscountPrice;

    // Dispatch the combined thunk to post the Outgoing Payment and apply the discount
    dispatch(postOutgoingAndUpdateDiscount({ invoiceId: selectedInvoice.invoiceId, apDiscountPrice: discountToApply }))
      .unwrap()
      .then(() => {
        console.log('Outgoing payment posted and discount applied successfully!');
        dispatch(setSnackbarMessage('Outgoing payment posted and discount applied successfully'));
        dispatch(setSnackbarOpen(true));
      })
      .catch((err: any) => {
        console.error('Error posting outgoing payment and applying discount:', err);
        dispatch(setSnackbarMessage('Error posting outgoing payment and applying discount'));
        dispatch(setSnackbarOpen(true));
      })
      .finally(() => {
        setOutgoingDialogOpen(false); // Close the Outgoing Payment dialog
        setDetailsDialogOpen(false); // Close the details dialog
        setLoading(false);
        // Refresh the AP Invoices list to reflect the updated status and discount
        dispatch(fetchApInvoices({ page: newPage, size: pageSize, status, dateFilterField: dateField, fromDate, toDate }));
      });
  };

  const handleDownload = async (apinvoiceId: string) => {
    const apinvoice = apInvoices.find((invoice: ApInvoice) => invoice.invoiceId === apinvoiceId);

    if (!apinvoice) {
      console.error('AP Invoice not found!');
      return;
    }

    const business = businesses.length > 0 ? businesses[0] : null;

    if (!business) {
      console.error('Business info not found!');
      return;
    }

    const doc = new jsPDF();
    let yOffset = 10;

    if (business.imageUrl) {
      doc.addImage(business.imageUrl, 'JPEG', 35, yOffset, 25, 25);
    }

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 128);
    doc.text('AP Invoice', 90, yOffset + 5);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(business.companyName || '', 90, yOffset + 10);

    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(business.address1 || '', 90, yOffset + 15);
    doc.text(`Tel.No: ${business.phoneNo || ''}`, 90, yOffset + 20);
    doc.text(`E-Mail: ${business.emailId || ''}`, 90, yOffset + 25);
    doc.text(`GSTIN: ${business.gstIn || ''}`, 90, yOffset + 30);

    yOffset += 40;
    const invoiceDate = apinvoice.invoiceDate ? new Date(apinvoice.invoiceDate) : new Date('2025-06-30');
    const paymentTermsDays = apinvoice.paymentTerms ? parseInt(apinvoice.paymentTerms, 10) : 15;
    const dueDate = addDays(invoiceDate, paymentTermsDays);

    const columnWidth = 60.6;
    const tableHeader = [
      ['Vendor Details', 'Billing Address', 'Invoice Details'],
    ];

    const vendorDetailsRows = [
      [
        `${apinvoice.vendorName || 'Not Provided'}\n` +
        `GSTIN: ${apinvoice.gstNumber || 'Not Provided'}\n` +
        `Address: ${apinvoice.address || 'Not Provided'}\n` +
        `City: ${apinvoice.city || 'Not Provided'}\n` +
        `State: ${apinvoice.state || 'Not Provided'}\n` +
        `Country: ${apinvoice.country || 'Not Provided'}\n` +
        `Email: ${apinvoice.contactpersonEmail || 'Not Provided'}`,
        `Billing Address: ${apinvoice.billingAddress || 'Not Provided'}`,
        `PO No: ${apinvoice.poRandomId || 'Not Provided'}\n` +
        `GRN No: ${apinvoice.grnRandomId || 'Not Provided'}\n` +
        `AP No: ${apinvoice.randomId || 'Not Provided'}\n` +
        `Invoice No: ${apinvoice.invoiceNo || 'Not Provided'}\n` +
        `Invoice Date: ${apinvoice.invoiceDate ? format(new Date(apinvoice.invoiceDate), 'dd-MM-yyyy') : 'Not Provided'}\n` +
        `Payment Terms: ${apinvoice.paymentTerms || '15'} \n` +
        `Due Date: ${format(dueDate, 'dd-MM-yyyy')}\n` +
        `Currency: ${'INR'}`,
      ]
    ];

    doc.autoTable({
      head: tableHeader,
      body: vendorDetailsRows,
      startY: yOffset,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 4,
        halign: 'left',
        valign: 'top',
        overflow: 'linebreak',
      },
      columnStyles: {
        0: { cellWidth: columnWidth, valign: 'top' },
        1: { cellWidth: columnWidth, valign: 'top' },
        2: { cellWidth: columnWidth, valign: 'top' },
      },
      headStyles: {
        fillColor: [0, 0, 128],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      bodyStyles: {
        lineColor: [0, 0, 0],
        minCellHeight: 15,
      },
      tableLineColor: [0, 0, 0],
      tableLineWidth: 0.1,
    });

    yOffset += 45;

    const itemHeader = ['SI No', 'Description', 'HsnCode', 'Count','Qty','Stock Qty', 'Unit Price', 'Tax', 'Amount'];
    const tableRows = apinvoice.itemDetails.map((item, index) => {
      const unitPrice = item.unitPrice || 0;
      const quantity = item.quantity || 0;
      const totalAmount = unitPrice * quantity;

      return [
        `${index + 1}`,
        item.itemName || 'Item Description',
        item.hsnCode,
        item.nos,
        item.eachQuantity,
        `${item.stockQuantity} ${item.uom || 'Kgs'}`,
        `${unitPrice.toFixed(2)}`,
        `${item.purchasetaxName}%`,
        `${totalAmount.toFixed(2)}`,
      ];
    });

    const numberOfBlankRows = Math.max(0, 10 - tableRows.length);
    for (let i = 0; i < numberOfBlankRows; i++) {
      tableRows.push(['', '', '', '', '', '', '']);
    }

    doc.autoTable({
      head: [itemHeader],
      body: tableRows,
      startY: yOffset,
      theme: 'grid',
      styles: {
        fontSize: 8,
        halign: 'center',
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [0, 0, 128],
        textColor: [255, 255, 255],
      },
      bodyStyles: {
        lineColor: [0, 0, 0],
      },
    });
    yOffset = doc.autoTable.previous.finalY;

    const taxRates = {
      CGST: new Map<number, number>(),
      SGST: new Map<number, number>(),
      IGST: new Map<number, number>(),
    };

    apinvoice.itemDetails.forEach((item) => {
      const taxableAmount = item.unitPrice * item.stockQuantity;

      if (item.taxType === 'cgst_sgst') {
        const cgstRate = item.purchasetaxName / 2;
        const sgstRate = item.purchasetaxName / 2;
        const cgstAmount = (cgstRate / 100) * taxableAmount;
        const sgstAmount = (sgstRate / 100) * taxableAmount;

        taxRates.CGST.set(cgstRate, (taxRates.CGST.get(cgstRate) || 0) + cgstAmount);
        taxRates.SGST.set(sgstRate, (taxRates.SGST.get(sgstRate) || 0) + sgstAmount);
      } else if (item.taxType === 'igst') {
        const igstAmount = (item.purchasetaxName / 100) * taxableAmount;
        taxRates.IGST.set(item.purchasetaxName, (taxRates.IGST.get(item.purchasetaxName) || 0) + igstAmount);
      }
    });

    const totalWithoutTax = apinvoice.itemDetails.reduce((sum, item) => {
      return sum + item.unitPrice * item.stockQuantity;
    }, 0);

    const taxSummary: [string, string][] = [
      [`Total Amount`, totalWithoutTax.toFixed(2) || '0'],
      [`Total Discount`, apinvoice.discountDetails?.toFixed(2) || '0'],
    ];

    taxRates.CGST.forEach((amount, rate) => {
      taxSummary.push([`CGST @${rate}%`, amount.toFixed(2)]);
    });

    taxRates.SGST.forEach((amount, rate) => {
      taxSummary.push([`SGST @${rate}%`, amount.toFixed(2)]);
    });

    taxRates.IGST.forEach((amount, rate) => {
      taxSummary.push([`IGST @${rate}%`, amount.toFixed(2)]);
    });

    yOffset = doc.autoTable.previous.finalY;
    taxSummary.push([`Total [Including Tax]`, apinvoice.invoiceAmount?.toFixed(2) || '0']);

    doc.autoTable({
      head: [['Description', 'Amount']],
      body: taxSummary,
      startY: yOffset,
      theme: 'grid',
      styles: {
        fontSize: 8,
        halign: 'right',
        cellPadding: 2,
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        fontStyle: 'bold',
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
      },
    });

    doc.text("Declaration:", 10, doc.autoTable.previous.finalY + 35);
    doc.text("We declare that this invoice shows the actual price of the described items and that all particulars are true and correct.", 10, doc.autoTable.previous.finalY + 40);

    doc.text("Authorized Signatory:", 120, doc.autoTable.previous.finalY + 48);
    doc.text("_____________________", 120, doc.autoTable.previous.finalY + 60);
    const imageUrl = '/images/pending.jpeg';

    yOffset = doc.autoTable.previous.finalY + 5;
    doc.addImage(imageUrl, 'JPEG', 150, yOffset, 30, 25);

    // Add page numbers to all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${totalPages}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }

    doc.save(`ReturnedApInvoice${apinvoice.randomId}.pdf`);
  };
  const handleStartDateChange = (value: Date | null) => {
    setStartDate(value); // Update the startDate state with Date or null
  };

  // Handler for end date change
  const handleEndDateChange = (value: Date | null) => {
    setEndDate(value); // Update the endDate state with Date or null
  };
  const taxAmounts: TaxAmounts = selectedInvoice
    ? selectedInvoice.itemDetails.reduce((acc: TaxAmounts, item) => {
      const totalPrice = item.totalPrice || 0;
      const taxPercentage = Number(item.purchasetaxName); // Assuming this is the total tax percentage

      if (item.taxType === "cgst_sgst") {
        const sgstPercentage = taxPercentage / 2; // Divide for SGST
        const cgstPercentage = taxPercentage / 2; // Divide for CGST

        const sgstAmount = (totalPrice * sgstPercentage) / 100;
        const cgstAmount = (totalPrice * cgstPercentage) / 100;

        // Accumulate SGST
        acc.sgst[sgstPercentage] = (acc.sgst[sgstPercentage] || 0) + sgstAmount;
        // Accumulate CGST
        acc.cgst[cgstPercentage] = (acc.cgst[cgstPercentage] || 0) + cgstAmount;

      } else if (item.taxType === "igst") {
        const igstAmount = (totalPrice * taxPercentage) / 100;

        // Accumulate IGST
        acc.igst[taxPercentage] = (acc.igst[taxPercentage] || 0) + igstAmount; // Use taxPercentage as key
      }

      return acc;
    }, { sgst: {}, cgst: {}, igst: {} } as TaxAmounts) // Initialize igst as an object
    : { sgst: {}, cgst: {}, igst: {} }; // Initialize igst as an object

  // Collect all unique rates
  const uniqueRates = new Set([
    ...Object.keys(taxAmounts.sgst),
    ...Object.keys(taxAmounts.cgst),
    ...Object.keys(taxAmounts.igst), // Collect keys from igst as well
  ]);

  const filterAp = apInvoices.filter(ap => ap.status === 'Pending');

  return (
    <Box>
      <YenPurchasePage />
      <Box sx={{ p: 1, backgroundColor: 'white' }}>
        {/* First Row - AP Invoice List, Returned AP buttons, and Typography */}
        <Box display="flex" alignItems="center" mb={1} ml={1}>
          <Link href="/yen-purchase/ApInvoicePage" passHref>
            <Button
              variant="contained"
              sx={{
                backgroundColor: 'white',
                color: 'black',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                },
                mr: 1,
                minWidth: '100px',
              }}
            >
              AP List
            </Button>
          </Link>
          <Link href="/yen-purchase/ApInvoicePage/ReturnAp" passHref>
            <Button
              variant="contained"
              color="primary"
              sx={{
                mr: 2,
                minWidth: '100px',
              }}
            >
              Return AP
            </Button>
          </Link>
        </Box>

        {/* Second Row: Search Vendor, Date Range, Filter, Clear, and Download Icons */}
        <Grid container alignItems="center" spacing={1} wrap="nowrap" ml={0.2} sx={{ mb: 0.7 }}>
          {/* Date Range Dialog */}
          <Grid item>
            <DateRangeDialog
              selectionRange={selectionRange}
              setSelectionRange={setSelectionRange}
            />
          </Grid>

          {/* All Vendors Autocomplete */}
          <Grid item xs={2}>
            <VendorSearchAutocomplete
              value={selectedVendor}
              onChange={handleVendorChange}
              label="All Vendors"
            />
          </Grid>

          {/* Filter Icon */}
          <Grid item>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <IconButton
                onClick={handleFilterClick}
                color="primary"
                disabled={loading}
                className="icon-button-outline"
                size="small"
                sx={{ p: 0.3 }}
              >
                <FilterAltIcon fontSize="small" />
              </IconButton>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.75rem',
                  textAlign: 'center',
                  mt: 0.3, // Small margin-top for spacing
                }}
              >
                Filter
              </Typography>
            </Box>
          </Grid>

          <Grid item>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <IconButton
                onClick={handleFilterClose}
                color="primary"
                disabled={loading}
                size="small"
                sx={{ p: 0.3 }}
                className="icon-button-outline"
              >
                <ClearIcon fontSize="small" />
              </IconButton>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.75rem',
                  textAlign: 'center',
                  mt: 0.3,
                }}
              >
                Clear
              </Typography>
            </Box>
          </Grid>

          {/* Spacer to push Download to the right */}
          <Grid item sx={{ flexGrow: 1 }} />

          {/* Download Icon */}
          <Grid item>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <IconButton
                onClick={handleClick}
                color="primary"
                disabled={!filterAp || Object.keys(filterAp).length === 0}
                size="small"
                sx={{ p: 0.3 }}
                className="icon-button-outline"
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.75rem',
                  textAlign: 'center',
                  mt: 0.3,
                }}
              >
                Download
              </Typography>
            </Box>
          </Grid>
          <Menu
            anchorEl={anchorElDownload}
            open={Boolean(anchorElDownload)}
            onClose={handleCloseAnchor}
          >
            <MenuItem onClick={handleVendorwiseClick}>Vendorwise</MenuItem>
            <MenuItem onClick={handleItemwiseClick}>Itemwise</MenuItem>
          </Menu>
        </Grid>

        <Grid container spacing={1} sx={{ pl: 2 }}>
          <TableContainer
            component={Paper}
            sx={{
              maxHeight: 'calc(100vh - 180px)',
              overflowY: 'auto',
              width: '100%',
            }}
          >
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>S.No</TableCell>
                  <TableCell>APId</TableCell>
                  <TableCell>Invoice ID</TableCell>
                  <TableCell>Vendor Name</TableCell>
                  <TableCell>Invoice Date</TableCell>
                  <TableCell>Total Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {apInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      No data available
                    </TableCell>
                  </TableRow>
                ) : (
                  apInvoices.map((invoice, index) => {
                    const { isDisabled, tooltipTitle } = invoiceCreditNoteStatus[invoice.invoiceId] || {
                      isDisabled: true,
                      tooltipTitle: 'No Debit/Credit Notes Available',
                    };
                    return (
                      <TableRow key={invoice.randomId}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{invoice.randomId}</TableCell>
                        <TableCell>{invoice.invoiceNo}</TableCell>
                        <TableCell>{invoice.vendorName}</TableCell>
                        <TableCell>
                          {invoice.invoiceDate ? format(invoice.invoiceDate, 'dd-MM-yyyy') : ''}
                        </TableCell>
                        <TableCell>{invoice.invoiceAmount.toFixed(2)}</TableCell>
                        <TableCell>{invoice.status}</TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center">
                            <Tooltip title="View Detail">
                              <IconButton
                                color="primary"
                                onClick={() => handleViewDetails(invoice)}
                              >
                                <VisibilityIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Download PDF">
                              <IconButton
                                color="primary"
                                onClick={() => handleDownload(invoice.invoiceId)}
                              >
                                <PictureAsPdfIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={tooltipTitle}>
                              <span>
                                <IconButton
                                  color="primary"
                                  onClick={() => handleViewCreditNotes(invoice.invoiceId)}
                                  disabled={isDisabled}
                                >
                                  <DescriptionIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'end', alignItems: 'center', mt: 0.1 }}>
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

        <Dialog open={detailsDialogOpen} onClose={handleCloseDetailsDialog}   maxWidth={false}
          fullWidth={true}
          fullScreen={isFullScreen}
          container={document.body} // Always render in document.body
          disablePortal={false} // Use portal to break out of parent containers
          sx={isFullScreen ? {
            '& .MuiDialog-container': {
              position: 'fixed !important',
              top: '0 !important',
              left: '0 !important',
              right: '0 !important',
              bottom: '0 !important',
              width: '100vw !important',
              height: '100vh !important',
              maxWidth: 'none !important',
              maxHeight: 'none !important',
              margin: '0 !important',
              zIndex: 9999,
            },
            '& .MuiDialog-paper': {
              width: '100vw !important',
              height: '100vh !important',
              maxWidth: 'none !important',
              maxHeight: 'none !important',
              margin: '0 !important',
              borderRadius: '0 !important',
            }
          } : {}}
          PaperProps={{
            style: {
              height: isFullScreen ? '100vh' : 'auto',
              width: isFullScreen ? '100vw' : '90vw',
              maxWidth: isFullScreen ? 'none' : 'none',
              margin: isFullScreen ? 0 : 'auto',
              borderRadius: isFullScreen ? 0 : undefined,
            },
          }}
        >
          <DialogTitle sx={{
            fontWeight: 'bold',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: isFullScreen ? '16px 24px' : '16px' // Adjust padding for fullscreen
          }}>Invoice Details</DialogTitle>
          <DialogContent sx={{
            padding: isFullScreen ? '0 24px' : '20px', // Adjust content padding
            height: isFullScreen ? 'calc(100vh - 120px)' : 'auto', // Account for header/footer height
            overflow: 'auto'
          }}>
            {selectedInvoice && (
              <Box>
                {/* Single row for all IDs */}
                <Box sx={{ display: 'flex', gap: 3, mb: 2, flexWrap: 'wrap' }}>
                  <Typography variant="h6">
                    <strong>PO ID:</strong> {selectedInvoice.poRandomId}
                  </Typography>
                  <Typography variant="h6">
                    <strong>GRN ID:</strong> {selectedInvoice.grnRandomId}
                  </Typography>
                  <Typography variant="h6">
                    <strong>AP ID:</strong> {selectedInvoice.randomId}
                  </Typography>
                    <IconButton onClick={toggleFullScreen} color="primary" edge="end">
              {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
                </Box>

                {/* Vendor and date in a single row */}
                <Box sx={{ display: 'flex', gap: 3, mb: 2, flexWrap: 'wrap' }}>
                  <Typography variant="h6">
                    <strong>Vendor:</strong> {selectedInvoice.vendorName}
                  </Typography>
                  <Typography variant="h6">
                    <strong>Invoice Date:</strong> {selectedInvoice?.invoiceDate ? format(new Date(selectedInvoice.invoiceDate), 'dd-MM-yyyy') : ''}
                  </Typography>
                  <Typography variant="h6">
                    <strong>Total Amount:</strong> {selectedInvoice.invoiceAmount}
                  </Typography>
                </Box>

                <TableContainer component={Paper} sx={{ mt: 2 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Item Name</TableCell>
                        <TableCell>Received Quantity</TableCell>
                        <TableCell>UOM</TableCell>
                        <TableCell>Returned Quantity</TableCell>
                        <TableCell>Count</TableCell>
                        <TableCell>Quantity</TableCell>
                        <TableCell>Stock Quantity</TableCell>
                        <TableCell>Bef Tax Discount(%)</TableCell>
                        <TableCell>Af Tax Discount(%)</TableCell>
                        <TableCell>Tax(%)</TableCell>
                        <TableCell>Unit Price</TableCell>
                        <TableCell>Total Price</TableCell>
                        <TableCell>Final Price</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedInvoice.itemDetails.map((item) => (
                        <TableRow key={item.itemId}>
                          <TableCell>{item.itemName}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{item.uom}</TableCell>
                          <TableCell>{item.returnedQuantity || 0}</TableCell>
                          <TableCell>{item.nos}</TableCell>
                          <TableCell>{item.eachQuantity}</TableCell>
                          <TableCell>{item.stockQuantity}</TableCell>
                          <TableCell>{item.befTaxDiscount}</TableCell>
                          <TableCell>{item.afTaxDiscount}</TableCell>
                          <TableCell>{item.purchasetaxName}</TableCell>
                          <TableCell>{item.unitPrice}</TableCell>
                          <TableCell>{item.totalPrice.toFixed(2)}</TableCell>
                          <TableCell>{item.finalPrice.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      {/* Discount Input Row */}
                      <TableRow>
                        <TableCell colSpan={12} align="right">
                          <strong>New Discount Price:</strong>
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            value={apDiscountPrice.toString()}
                            onChange={handleDiscountChange}
                            inputProps={{ min: "0", step: "0.01" }}
                            className="custom-textfield"
                          />
                        </TableCell>
                      </TableRow>
                      {/* Total Discounted Amount */}
                      <TableRow>
                        <TableCell colSpan={12} align="right">
                          <strong>Total Discounted Amount:</strong>
                        </TableCell>
                        <TableCell>
                          {(selectedInvoice.discountPrice + (isNaN(apDiscountPrice) ? 0 : apDiscountPrice)).toFixed(2)}
                        </TableCell>
                      </TableRow>
                      {/* Tax Breakdown */}
                      {Array.from(uniqueRates).map((rate) => (
                        <React.Fragment key={rate}>
                          {taxAmounts.sgst[rate] !== undefined && (
                            <TableRow>
                              <TableCell colSpan={11} />
                              <TableCell>
                                <strong>{`SGST (${Number(rate)}%):`}</strong>
                              </TableCell>
                              <TableCell>{taxAmounts.sgst[rate].toFixed(2)}</TableCell>
                            </TableRow>
                          )}
                          {taxAmounts.cgst[rate] !== undefined && (
                            <TableRow>
                              <TableCell colSpan={11} />
                              <TableCell>
                                <strong>{`CGST (${Number(rate)}%):`}</strong>
                              </TableCell>
                              <TableCell>{taxAmounts.cgst[rate].toFixed(2)}</TableCell>
                            </TableRow>
                          )}
                          {taxAmounts.igst[rate] !== undefined && (
                            <TableRow>
                              <TableCell colSpan={11} />
                              <TableCell>
                                <strong>{`IGST (${Number(rate)}%):`}</strong>
                              </TableCell>
                              <TableCell>{taxAmounts.igst[rate].toFixed(2)}</TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                      {/* Total Debit Amount */}
                      <TableRow>
                        <TableCell colSpan={12} align="right">
                          <strong>Total Debit Amount:</strong>
                        </TableCell>
                        <TableCell>{selectedInvoice.debitAmount?.toFixed(2) ?? '0.00'}</TableCell>
                      </TableRow>
                      {/* Total Invoice Amount After Discount */}
                      <TableRow>
                        <TableCell colSpan={12} align="right">
                          <strong>Total Invoice Amount:</strong>
                        </TableCell>
                        <TableCell>
                          {(selectedInvoice.invoiceAmount - (selectedInvoice.discountPrice + (isNaN(apDiscountPrice) ? 0 : apDiscountPrice))).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button variant="contained" sx={{ mr: '5px' }} color="primary" onClick={() => setReturnDialogOpen(true)}>
              Return AP Invoice
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={() => setOutgoingDialogOpen(true)}
              disabled={selectedInvoice?.status === 'Outgoing Posted'} // Disable if already posted
            >
              Post Outgoing Payment
            </Button>    <Button variant="contained" onClick={handleCloseDetailsDialog}>Close</Button>
          </DialogActions>
        </Dialog>
        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={1000}
          onClose={() => dispatch(clearSnackbarMessage())}
          message={snackbarMessage}
        />

        {/* Return AP Invoice Confirmation Dialog */}
        <Dialog open={returnDialogOpen} onClose={() => setReturnDialogOpen(false)}>
          <DialogTitle>Return AP Invoice</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to return the AP Invoice?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReturnDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleReturnAp} color="primary">
              Confirm
            </Button>
          </DialogActions>
        </Dialog>

        {/* Post Outgoing Payment Confirmation Dialog */}
        <Dialog open={outgoingDialogOpen} onClose={() => setOutgoingDialogOpen(false)}>
          <DialogTitle>Post Outgoing Payment</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to post the outgoing payment?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOutgoingDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePostOutgoingPayment} color="primary">
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
        <Backdrop
          sx={{
            color: '#fff',
            zIndex: 9999,
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
          open={loadingCenter}
        >
          <CircularProgress color="inherit" />
        </Backdrop>
        {/* Pdf Excel */}
        <Dialog open={dialogDownloadOpen} onClose={() => setDialogDownloadOpen(false)}>
          <DialogTitle>Select Export Format</DialogTitle>
          <DialogContent>
            Choose whether you want to download the report as an Excel (CSV) file or generate a PDF.
          </DialogContent>
          <DialogActions>
            {/* Button to download CSV */}
            <Button
              onClick={handleExportCSV}
              variant="contained"
              color="primary"
              startIcon={<DescriptionIcon />}
            >
              Download CSV
            </Button>

            {/* Button to generate PDF */}
            <Button
              onClick={generateInvoicePDF}
              variant="contained"
              color="secondary"
              startIcon={<PictureAsPdfIcon />}
            >
              Generate PDF
            </Button>
            <Button
              onClick={() => setDialogDownloadOpen(false)} // Close the dialog on cancel
              variant="outlined"
            >
              Cancel
            </Button>
          </DialogActions>
        </Dialog>
        {/* Dialog for choosing export options */}
        <Dialog open={dialogSummaryOpen} onClose={handleClose}>
          <DialogTitle>Export Options</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Please choose whether you want to export the data as a CSV or generate a PDF.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            {/* Export CSV Button */}
            <Button
              onClick={generatePendingInvoiceSummaryCSV}
              variant="contained"
              color="secondary"
              startIcon={<DescriptionIcon />}
            >
              Export Excel
            </Button>

            {/* Generate PDF Button */}
            <Button
              onClick={generatePendingInvoiceSummaryPDF}
              variant="contained"
              color="primary"
              startIcon={<PictureAsPdfIcon />}
            >
              Generate PDF
            </Button>

            {/* Cancel Button */}
            <Button variant='outlined' onClick={handleClose}>
              Cancel
            </Button>
          </DialogActions>
        </Dialog>
        <DebitCreditNoteDialog />
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

export default React.memo(VerifiedApInvoicePage);
