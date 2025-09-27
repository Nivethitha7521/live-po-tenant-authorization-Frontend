"use client";
import React, { useState, useEffect, act } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, TextField, Button, Typography, Grid, Paper,
  TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  CircularProgress,
  Snackbar,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Autocomplete,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import FilterAltIcon from '@mui/icons-material/FilterAlt'; // Import the filter icon
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DescriptionIcon from '@mui/icons-material/Description';  // CSV icon
import ClearIcon from "@mui/icons-material/Clear"; // Clear icon
import { AppDispatch, RootState } from '@/redux/store';
import { clearSnackbarMessage, fetchApInvoices, setPagination, selectApinvoice, setSnackbarMessage, setSnackbarOpen, selectCurrentPage, selectPageSize, selectTotalItems } from '../../../../features/yen-purchase/AP/apInvoiceSlice';
import YenPurchasePage from '../../page';
import Link from 'next/link';
import { ApInvoice } from '@/Models/apModel';
import { fetchBusinesses, fetchPhoto, selectBusinesses } from '@/features/account-setting/businessSlice';
import jsPDF from 'jspdf';
import "jspdf-autotable"; // Ensure this plugin is available for autoTable functionality
import DateRangeFilter from '@/components/agingFilter';
import { format, parse } from 'date-fns';
import Papa from 'papaparse';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import 'react-date-range/dist/styles.css'; // main style file
import 'react-date-range/dist/theme/default.css'; // theme css file
import DateRangeDialog from '@/components/dateRange';
import { Vendor } from '@/Models/purchaseModel';
import { fetchAllVendors, selectPurchaseOrderState } from '@/features/yen-purchase/PurchaseOrder/purchaseOrderSlice';
import moment from 'moment';
import { selectTotalVendors } from '@/features/yen-purchase/PurchaseMaster/vendorSlice';
import VendorSearchAutocomplete from '@/components/vendorsearchautocomplete';
import { VendorSearch } from '@/Models/vendor';
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
  dueDate: null,
  invoiceDate: null,
  invoiceNo: '',
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
  hasDebitCreditNotes: false
};

const ReturnnedApInvoicePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [apInvoice, setApInvoice] = useState<ApInvoice>(initialApInvoiceState);
  const [selectedInvoice, setSelectedInvoice] = useState<ApInvoice | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false); // For viewing item details
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);   // For confirming AP return
  const [outgoingDialogOpen, setOutgoingDialogOpen] = useState(false); // For confirming outgoing payment
  const { apInvoices, loading, error, snackbarMessage, snackbarOpen } = useSelector(selectApinvoice);
  const { businesses } = useSelector(selectBusinesses);
  const [fetchedBusinessIds, setFetchedBusinessIds] = useState(new Set());
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendorName, setSelectedVendorName] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<VendorSearch | null>(null);
  const [status, setStatus] = useState('Returned'); // Default status filter is "Pending"
  const [filteredAp, setFilteredAp] = useState<ApInvoice[]>([]); // Explicit type declaration
  const filterAp = apInvoices.filter(ap => ap.status === 'Returned');
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
  const dateField = 'apReturnedDate'; // You can dynamically set this if you want to switch between orderDate, approvedDate, or rejectedDate
  const fromDate = moment().utc().startOf('day').toDate(); // Start of the day (in UTC)
  const toDate = moment().utc().endOf('day').toDate(); // End of the day (in UTC)
  const [shouldFetch, setShouldFetch] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Helper function to store fetched data in localStorage
  const storeLocally = (key: string, value: any) => {
    localStorage.setItem(key, JSON.stringify(value));
  };
  // Helper function to retrieve data from localStorage
  const retrieveLocally = (key: string): any => {
    const storedData = localStorage.getItem(key);
    return storedData ? JSON.parse(storedData) : null;
  };
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
    const cachedBusinesses = retrieveLocally('businesses');
    if (!cachedBusinesses) {
      dispatch(fetchBusinesses()).then((fetchedData) => {
        storeLocally('businesses', fetchedData); // Store fetched data locally
      });
    }
  }, [dispatch]);
  useEffect(() => {
    dispatch(fetchAllVendors());
  }, [dispatch]);
  // 3. Fetch Business Photos (fetch only for new businesses and store locally)
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
  useEffect(() => {
    // Load the fetched business IDs from localStorage (if any)
    const storedFetchedIds = localStorage.getItem('fetchedBusinessIds');
    if (storedFetchedIds) {
      setFetchedBusinessIds(new Set(JSON.parse(storedFetchedIds)));
    }
  }, []);

  useEffect(() => {
    businesses.forEach((business) => {
      // Check if the business photo has been fetched or not
      if (!fetchedBusinessIds.has(business.businessId)) {
        dispatch(fetchPhoto(business.businessId)); // Fetch the photo for the business
        setFetchedBusinessIds((prevSet) => {
          const updatedSet = new Set(prevSet).add(business.businessId);
          // Update the localStorage with the new fetched business IDs
          localStorage.setItem('fetchedBusinessIds', JSON.stringify(Array.from(updatedSet)));
          return updatedSet;
        });
      }
    });
  }, [businesses, fetchedBusinessIds, dispatch]);


  const handleViewDetails = (invoice: ApInvoice) => {
    setSelectedInvoice(invoice);
    setDetailsDialogOpen(true); // Open the details dialog
  };
const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };
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
  const parseDate = (dateStr: any) => {
    if (!dateStr || typeof dateStr !== 'string') {
      throw new Error('Invalid date string');
    }

    const [day, month, year] = dateStr.split('/');
    return new Date(`${year}-${month}-${day}`);
  };
  const handleCloseDetailsDialog = () => {
    setDetailsDialogOpen(false);
    setSelectedInvoice(null); // Clear the selected invoice
  };
  const handleStartDateChange = (value: Date | null) => {
    setStartDate(value); // Update the startDate state with Date or null
  };

  // Handler for end date change
  const handleEndDateChange = (value: Date | null) => {
    setEndDate(value); // Update the endDate state with Date or null
  };
  const handleFilterClick = () => {
    let filtered = apInvoices;

    const formattedStartDate = selectionRange?.startDate instanceof Date ? selectionRange.startDate : undefined;
    const formattedEndDate = selectionRange?.endDate instanceof Date ? selectionRange.endDate : undefined;

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
  const handleOpen = () => {
    setDialogSummaryOpen(true);
  };
  const handleClose = () => {
    setDialogSummaryOpen(false);
  };
  const generateInvoicePDF = () => {
    const doc = new jsPDF();
    let yOffset = 7;  // Starting y-offset for content

    const business = businesses.length > 0 ? businesses[0] : null;

    if (!business) {
      console.error('Business info not found!');
      return;
    }

    // Add business image on the left side
    if (business.imageUrl) {
      try {
        doc.addImage(business.imageUrl, 'JPEG', 14, yOffset, 20, 20);  // Adjust image size and position
      } catch (e) {
        console.error("Image failed to load:", e);
      }
    }

    yOffset += 10;  // Move down after image to create space for the title

    // Add a title for the PDF
    doc.setFontSize(12);  // Increase title font size
    const title = "APInvoice Order Summary";
    const pageWidth = doc.internal.pageSize.width;  // Get page width directly
    const fontSize = doc.getFontSize();  // Get font size using the public method
    const titleWidth = doc.getStringUnitWidth(title) * fontSize / doc.internal.scaleFactor;
    const titleX = (pageWidth - titleWidth) / 2;
    doc.text(title, titleX, yOffset);  // Centered title
    doc.setLineWidth(0.1);  // Set line width for the underline
    doc.line(titleX, yOffset + 2, titleX + titleWidth, yOffset + 2);  // Draw the underline need underline
    yOffset += 15;  // Move yOffset down after the title  

    // Format the current date
    const today = new Date();
    const currentDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

    // Calculate the total ordered amount before generating the table
    const totalInvoiceAmount = (filterAp || []).reduce((sum, order) => {
      const orderInvoiceAmount = order.invoiceAmount || 0;  // Get the invoice amount for the order
      return sum + orderInvoiceAmount;  // Accumulate the total invoice amount
    }, 0);

    // Display "Total Invoice Amount" and "Date" on the same row
    doc.setFontSize(10);  // Smaller font size for these details
    doc.text(`Total Invoice Amount: ${totalInvoiceAmount.toFixed(2)}`, 14, yOffset);  // Total on the left

    // Calculate xOffset for the date to align it to the right
    const totalWidth = doc.getStringUnitWidth(`Total Invoice Amount: ${totalInvoiceAmount.toFixed(2)}`) * fontSize / doc.internal.scaleFactor;
    const dateX = pageWidth - totalWidth - 14;  // Right-align date text

    doc.text(`Date: ${currentDate}`, dateX, yOffset);  // Date on the right of the total

    yOffset += 5;  // Add space before the table for better readability

    // Table headers for summary data
    const headers = [
      ["S.No", "AP.No", "Invoice Date", "InvoiceNo", "Vendor Name", "TotalItems", "Invoice Amount"],
    ];

    // Prepare rows for purchase order summary (filter only the valid orders)
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
        totalInvoiceAmount.toFixed(2),
      ];
    }).filter(row => row !== null);

    // Add the table to the PDF with custom styles
    doc.autoTable({
      head: headers,
      body: rows,
      startY: yOffset,  // Start the table at the updated yOffset
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
        columnStyles: {
          0: { halign: 'center' }, // Center-align "SNO"
          1: { halign: 'center' }, // Center-align "apId"
          2: { halign: 'center' }, // Center-align "Invoice Date"
          3: { halign: 'center' }, // Center-align "InvoiceNo"
          4: { halign: 'center' }, // Center-align "Vendor Name"
          5: { halign: 'center' }, // Center-align "Total Items"
          6: { halign: 'center' }  // Center-align "Total Invoice Amount"
        }
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
    const pdfFilename = `Ap.pdf`;
    doc.save(pdfFilename);
    setDialogDownloadOpen(false);
  };

  const generateReturnedInvoiceSummaryPDF = () => {
    const doc = new jsPDF();

    const yOffset = 10;  // Start position for the content

    // Add business image to the left corner (if available)
    const business = businesses.length > 0 ? businesses[0] : null;
    if (business && business.imageUrl) {
      try {
        doc.addImage(business.imageUrl, 'JPEG', 14, yOffset, 20, 20);  // Adjust image size and position
      } catch (e) {
        console.error("Image failed to load:", e);
      }
    }

    // Adjust yOffset after the image (if any)
    let currentYOffset = yOffset + 10;  // Add space after the image

    // Title for the Invoice Summary
    doc.setFontSize(12);
    const title = "Pending Invoice Summary";
    const pageWidth = doc.internal.pageSize.width;
    const titleWidth = doc.getStringUnitWidth(title) * doc.getFontSize() / doc.internal.scaleFactor;
    const titleX = (pageWidth - titleWidth) / 2;  // Center the title
    doc.text(title, titleX, currentYOffset);
    doc.setLineWidth(0.1);  // Set line width for the underline
    doc.line(titleX, yOffset + 2, titleX + titleWidth, yOffset + 2);  // Draw the underline need underline
    currentYOffset += 15;  // Move down after title for space

    // Filter out invoices with status 'Pending'
    const returnedInvoices = (apInvoices || []).filter(invoice => invoice.status === "Returned");

    // Calculate the total amounts for the Returned invoices
    const totalAmount = returnedInvoices.reduce((sum, invoice) => {
      const total = invoice.itemDetails.reduce((totalItem, item) => totalItem + (item.stockQuantity * item.unitPrice), 0);
      return sum + total;
    }, 0);

    const totalTax = returnedInvoices.reduce((sum, invoice) => {
      const tax = invoice.itemDetails.reduce((taxItem, item) => taxItem + (item.purchasetaxName * item.stockQuantity * item.unitPrice) / 100, 0);
      return sum + tax;
    }, 0);

    const totalDiscount = returnedInvoices.reduce((sum, invoice) => {
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

    currentYOffset += 5;  // Add space before the table for better readability
    // Table headers for Invoice Summary
    const headers = [
      ["S.No", "AP.No", "Vendor Name", "Item Name", "Quantity", "Price", "Tax", "Discount", "Total"],
    ];

    // Rows based on Returned invoices data
    const rows = returnedInvoices.map((invoice, index) => {
      return invoice.itemDetails.map((item) => [
        (index + 1).toString(), // Serial number as first column
        invoice.invoiceNo,  // Invoice Number
        invoice.vendorName,     // Vendor Name
        item.itemName,          // Item Name
        item.stockQuantity,          // Quantity
        item.unitPrice,             // Price
        `${item.purchasetaxName}%`,     // Tax Rate
        item.discountAmount,    // Discount Amount
        item.totalPrice
      ]);
    }).flat();  // Flatten the rows array

    // Add the table to the PDF with custom styles
    doc.autoTable({
      head: headers,
      body: rows,
      startY: 40,  // Start the table below the summary section
      styles: {
        fillColor: [30, 144, 255],  // DodgerBlue color
        textColor: [255, 255, 255], // White text color
        lineColor: [0, 0, 0],       // Black table borders
        fontSize: 8
      },
      headStyles: {
        fillColor: [0, 0, 128],  // Dark blue background for header
        textColor: [255, 255, 255],  // White text color for header
      },
      bodyStyles: {
        fillColor: [255, 255, 255],  // White background for rows
        textColor: [0, 0, 0],         // Black text color for rows
      },
      columnStyles: {
        4: { halign: 'right' },  // Right-align "Price"
        5: { halign: 'right' },  // Right-align "Tax"
        6: { halign: 'right' },  // Right-align "Discount"
        7: { halign: 'right' },  // Right-align "Total"
      },
    });
    // Add page numbers to all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${totalPages}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }

    // Save the PDF with a dynamic name based on the first Returned Invoice Number
    const pdfFilename = `ReturnedInvoiceItemwise.pdf`;
    doc.save(pdfFilename);
    handleClose();
  };


  // The download function for the AP Invoice
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

    // Set a border for the document
    // doc.rect(5, 5, 200, 287); // Page borders

    // Header Section
    if (business.imageUrl) {
      doc.addImage(business.imageUrl, 'JPEG', 35, yOffset, 25, 25);
    }

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 128); // Set text color to blue
    doc.text('AP Invoice', 90, yOffset + 5);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0); // Set text color to black
    doc.text(business.companyName || '', 90, yOffset + 10);

    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0); // Revert text color to black
    doc.text(business.address1 || '', 90, yOffset + 15);
    doc.text(`Tel.No: ${business.phoneNo || ''}`, 90, yOffset + 20);
    doc.text(`E-Mail: ${business.emailId || ''}`, 90, yOffset + 25);
    doc.text(`GSTIN: ${business.gstIn || ''}`, 90, yOffset + 30);

    yOffset += 40;

    // Table header and vendor details
    const columnWidth = 60.6;
    const tableHeader = [
      ['Vendor Details', 'Billing Address', 'Invoice Details'],
    ];

 const vendorDetailsRows = [
      [
        `${apinvoice.vendorName }\n` +
        `GSTIN: ${apinvoice.gstNumber }\n` +
        `Address: ${apinvoice.address }\n` +
        `City: ${apinvoice.city }\n` +
        `State: ${apinvoice.state }\n` +
        `Country: ${apinvoice.country }\n` +
        `Email: ${apinvoice.contactpersonEmail }`,
        `Billing Address: ${apinvoice.billingAddress }`,
        `PO No: ${apinvoice.poRandomId }\n` +
        `GRN No: ${apinvoice.grnRandomId }\n` +
        `AP No: ${apinvoice.randomId }\n` +
        `Invoice No: ${apinvoice.invoiceNo }\n` +
        `Invoice Date: ${apinvoice.invoiceDate ? format(new Date(apinvoice.invoiceDate), 'dd-MM-yyyy') : ''}\n` +
        `Payment Terms: ${apinvoice.paymentTerms || '15'} \n` +
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
    });

    yOffset += 45;

    // Items Table Section
    const itemHeader = ['SI No', 'Description', 'HsnCode', 'Pkt Count','Qty','Stock Qty', 'Unit Price', 'Tax', 'Amount'];
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

    // Add blank rows if fewer than 10 items
    const numberOfBlankRows = Math.max(0, 10 - tableRows.length);
    for (let i = 0; i < numberOfBlankRows; i++) {
      tableRows.push(['', '', '', '', '']);
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

    // Calculate individual tax amounts for GRN
    const taxRates = {
      CGST: new Map<number, number>(), // To store CGST tax amounts by percentage
      SGST: new Map<number, number>(), // To store SGST tax amounts by percentage
      IGST: new Map<number, number>(), // To store IGST tax amounts by percentage
    };

    // Sum up taxes for each GRN item
    apinvoice.itemDetails.forEach((item) => {
      const taxableAmount = item.unitPrice * item.stockQuantity; // Tax based on received quantity

      if (item.taxType === 'cgst_sgst') {
        const cgstRate = item.purchasetaxName / 2;
        const sgstRate = item.purchasetaxName / 2;
        const cgstAmount = (cgstRate / 100) * taxableAmount;
        const sgstAmount = (sgstRate / 100) * taxableAmount;

        // Accumulate CGST and SGST by percentage
        taxRates.CGST.set(cgstRate, (taxRates.CGST.get(cgstRate) || 0) + cgstAmount);
        taxRates.SGST.set(sgstRate, (taxRates.SGST.get(sgstRate) || 0) + sgstAmount);
      } else if (item.taxType === 'igst') {
        const igstAmount = (item.purchasetaxName / 100) * taxableAmount;
        taxRates.IGST.set(item.purchasetaxName, (taxRates.IGST.get(item.purchasetaxName) || 0) + igstAmount);
      }
    });

    // Calculate the total price without taxes for GRN items
    const totalWithoutTax = apinvoice.itemDetails.reduce((sum, item) => {
      return sum + item.unitPrice * item.stockQuantity;
    }, 0);

    // Create tax summary with individual rates
    const taxSummary: [string, string][] = [
      [`Total Amount`, totalWithoutTax.toFixed(2) || '0'],
      [`Total Discount`, apinvoice.discountDetails?.toFixed(2) || '0'],
    ];

    // Add CGST first, grouped by percentage
    taxRates.CGST.forEach((amount, rate) => {
      taxSummary.push([`CGST @${rate}%`, amount.toFixed(2)]);
    });

    // Add SGST next, grouped by percentage
    taxRates.SGST.forEach((amount, rate) => {
      taxSummary.push([`SGST @${rate}%`, amount.toFixed(2)]);
    });

    // Add IGST last, grouped by percentage
    taxRates.IGST.forEach((amount, rate) => {
      taxSummary.push([`IGST @${rate}%`, amount.toFixed(2)]);
    });

    yOffset = doc.autoTable.previous.finalY;
    // Add total order amount including tax
    taxSummary.push([`Total [Including Tax]`, apInvoice.invoiceAmount?.toFixed(2) || '0']);

    // Render the tax summary table in the PDF
    doc.autoTable({
      head: [['Description', 'Amount']],
      body: taxSummary,
      startY: yOffset,
      theme: 'grid',
      styles: {
        fontSize: 8,
        halign: 'right',
        cellPadding: 2,
        lineColor: [0, 0, 0],  // Black borders for header
        lineWidth: 0.1,  // Keep borders for header
      },
      headStyles: {
        fillColor: [255, 255, 255], // White background for the header
        textColor: [0, 0, 0], // Black text color
        fontStyle: 'bold', // Bold text for the header
      },
    });
    doc.text("Declaration:", 10, doc.autoTable.previous.finalY + 35);
    doc.text("We declare that this invoice shows the actual price of the described items and that all particulars are true and correct.", 10, doc.autoTable.previous.finalY + 40);

    // Authorized Signatory Section
    doc.text("Authorized Signatory:", 120, doc.autoTable.previous.finalY + 48);
    doc.text("_____________________", 120, doc.autoTable.previous.finalY + 60);
    // const imageUrl = '/images/pending.jpeg';

    // Adjust yOffset further if you need to add space below the signature
    yOffset = doc.autoTable.previous.finalY + 5; // Move down after the signature
    // doc.addImage(imageUrl, 'JPEG', 150, yOffset, 30, 25); // Add image with desired width and height
    // Add page numbers to all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${totalPages}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }

    // Save the PDF
    doc.save(`ap_invoice${apinvoice.invoiceNo}.pdf`);
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
    link.setAttribute("download", "ReturnedAPSummary.csv");

    // Trigger the download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDialogDownloadOpen(false);
  };
  const generateReturnedInvoiceSummaryCSV = () => {
    // Define CSV headers
    const headers = ["S.No", "AP.No", "Vendor Name", "Item Name", "Quantity", "Price", "Tax", "Discount", "Total"];

    // Prepare rows by mapping through pending invoices
    const rows = (apInvoices || []).filter(invoice => invoice.status === "Returned").map((invoice, index) => {
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
    link.setAttribute("download", "ReturnedInvoiceItemwise.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    handleClose(); // Close any modal/dialog if used
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

  const handleVendorChange = (vendor: VendorSearch | null) => {
    setSelectedVendor(vendor);
    setSelectedVendorName(vendor ? vendor.vendorName : '');
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

  return (
    <Box>
      <YenPurchasePage />
      <Box sx={{ p: 1, backgroundColor: 'white' }}>
        {/* First Row - AP Invoice List, Returned AP buttons */}
        <Box display="flex" alignItems="center" mb={1} ml={1}>
          <Link href="/yen-purchase/ApInvoicePage" passHref>
            <Button
              variant="contained"
              sx={{
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
                backgroundColor: 'white',
                color: 'black',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                },
                mr: 1,
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
                  mt: 0.3,
                }}
              >
                Filter
              </Typography>
            </Box>
          </Grid>

          {/* Clear Icon */}
          <Grid item>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <IconButton
                onClick={handleFilterClose}
                color="primary"
                disabled={loading}
                className="icon-button-outline"
                size="small"
                sx={{ p: 0.3 }}
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
                disabled={!apInvoices || apInvoices.length === 0}
                className="icon-button-outline"
                size="small"
                sx={{ p: 0.3 }}
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

        <Grid container spacing={1} sx={{ px:1 ,pl:1 }}>
          <TableContainer
            component={Paper}
            sx={{
              maxHeight: 'calc(100vh - 180px)', // Match VerifiedApInvoicePage
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
                  apInvoices.map((invoice, index) => (
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
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
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
      </Box>

      {/* Invoice Details Dialog */}
      <Dialog open={detailsDialogOpen} onClose={handleCloseDetailsDialog} maxWidth="lg" fullWidth>
        <DialogTitle>Invoice Details</DialogTitle>
        <DialogContent>
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
                      <TableCell>UOM</TableCell>
                      <TableCell>Pkt Count</TableCell>
                      <TableCell>Quantity</TableCell>
                      <TableCell>Stock Quantity</TableCell>
                      <TableCell>Discount(%)</TableCell>
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
                        <TableCell>{item.uom}</TableCell>
                        <TableCell>{item.nos}</TableCell>
                        <TableCell>{item.eachQuantity}</TableCell>
                        <TableCell>{item.stockQuantity}</TableCell>
                        <TableCell>{item.befTaxDiscount}</TableCell>
                        <TableCell>{item.purchasetaxName}</TableCell>
                        <TableCell>{item.unitPrice}</TableCell>
                        <TableCell>{item.totalPrice}</TableCell>
                        <TableCell>{item.finalPrice}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={9} align="right"><strong>Discount Amount:</strong></TableCell>
                      <TableCell>{selectedInvoice.discountDetails.toFixed(2)}</TableCell>
                    </TableRow>
                    {Array.from(uniqueRates).map((rate) => (
                      <React.Fragment key={rate}>
                        {taxAmounts.sgst[rate] !== undefined && (
                          <TableRow>
                            <TableCell colSpan={8}></TableCell>
                            <TableCell>
                              <strong>{`SGST (${Number(rate)}%):`}</strong>
                            </TableCell>
                            <TableCell>{taxAmounts.sgst[rate].toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        {taxAmounts.cgst[rate] !== undefined && (
                          <TableRow>
                            <TableCell colSpan={8}></TableCell>
                            <TableCell>
                              <strong>{`CGST (${Number(rate)}%):`}</strong>
                            </TableCell>
                            <TableCell>{taxAmounts.cgst[rate].toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        {taxAmounts.igst[rate] !== undefined && (
                          <TableRow>
                            <TableCell colSpan={8}></TableCell>
                            <TableCell>
                              <strong>{`IGST (${Number(rate)}%):`}</strong>
                            </TableCell>
                            <TableCell>{taxAmounts.igst[rate].toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}

                    <TableRow>
                      <TableCell colSpan={9} align="right"><strong>Total Invoice Amount:</strong></TableCell>
                      <TableCell>{selectedInvoice.invoiceAmount.toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetailsDialog}>Close</Button>
        </DialogActions>
      </Dialog>
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
            onClick={generateReturnedInvoiceSummaryCSV}
            variant="contained"
            color="secondary"
            startIcon={<DescriptionIcon />}
          >
            Export Excel
          </Button>

          {/* Generate PDF Button */}
          <Button
            onClick={generateReturnedInvoiceSummaryPDF}
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

      <Snackbar
        open={snackbarOpen}
        message={snackbarMessage}
        autoHideDuration={3000}
        onClose={() => dispatch(clearSnackbarMessage())} // Manually close the snackbar when clicked
      />

    </Box>
  );
};

export default React.memo(ReturnnedApInvoicePage);
