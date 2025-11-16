"use client";
import React, { useState, useEffect } from 'react';
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
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DescriptionIcon from '@mui/icons-material/Description';
import ClearIcon from "@mui/icons-material/Clear";
import { AppDispatch, RootState } from '@/redux/store';
import { 
  clearSnackbarMessage, 
  fetchApInvoices, 
  setPagination, 
  selectApinvoice, 
  setSnackbarMessage, 
  setSnackbarOpen, 
  selectCurrentPage, 
  selectPageSize, 
  selectTotalItems 
} from '../../../../features/yen-purchase/AP/apInvoiceSlice';
import YenPurchasePage from '../../page';
import Link from 'next/link';
import { ApInvoice } from '@/Models/apModel';
import { fetchBusinesses, fetchPhoto, selectBusinesses } from '@/features/account-setting/businessSlice';
import jsPDF from 'jspdf';
import "jspdf-autotable";
import { format } from 'date-fns';
import Papa from 'papaparse';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import DateRangeDialog from '@/components/dateRange';
import { Vendor } from '@/Models/purchaseModel';
import { fetchAllVendors } from '@/features/yen-purchase/PurchaseOrder/purchaseOrderSlice';
import moment from 'moment';
import { VendorSearch } from '@/Models/vendor';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import VendorSearchAutocomplete from '@/components/vendorsearchautocomplete';

interface TaxAmounts {
  sgst: { [key: string]: number };
  cgst: { [key: string]: number };
  igst: { [key: string]: number };
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
  hasDebitCreditNotes: false,
  apRoundOff: 0
};

const ReturnnedApInvoicePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [selectedInvoice, setSelectedInvoice] = useState<ApInvoice | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const { apInvoices, loading, error, snackbarMessage, snackbarOpen } = useSelector(selectApinvoice);
  const { businesses } = useSelector(selectBusinesses);
  const [fetchedBusinessIds, setFetchedBusinessIds] = useState(new Set());
  const [selectedVendorName, setSelectedVendorName] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<VendorSearch | null>(null);
  const status = 'Returned'; // Fixed status for this page
  const [dialogDownloadOpen, setDialogDownloadOpen] = useState(false);
  const [dialogSummaryOpen, setDialogSummaryOpen] = useState(false);
  const currentPage = useSelector(selectCurrentPage);
  const pageSize = useSelector(selectPageSize);
  const totalItems = useSelector(selectTotalItems);
  const newPage = useSelector(selectCurrentPage);
  const [anchorElDownload, setAnchorElDownload] = useState<null | HTMLElement>(null);
  const [selectionRange, setSelectionRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    key: 'selection',
  });
  const dateField = 'apReturnedDate';
  const fromDate = moment().utc().startOf('day').toDate();
  const toDate = moment().utc().endOf('day').toDate();
  const [shouldFetch, setShouldFetch] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Filter only Returned invoices
  const returnedInvoices = apInvoices.filter(ap => ap.status === 'Returned');

  // Helper functions for localStorage
  const storeLocally = (key: string, value: any) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  const retrieveLocally = (key: string): any => {
    const storedData = localStorage.getItem(key);
    return storedData ? JSON.parse(storedData) : null;
  };

  // Fetch AP invoices with Returned status
  useEffect(() => {
    if (shouldFetch && !loading) {
      const action = fetchApInvoices({
        page: newPage,
        size: pageSize,
        dateFilterField: dateField,
        fromDate,
        toDate,
      });
      dispatch(action);
      setShouldFetch(false);
    }
  }, [dispatch, newPage, pageSize, dateField, fromDate, toDate, loading, shouldFetch]);

  // Fetch businesses
  useEffect(() => {
    const cachedBusinesses = retrieveLocally('businesses');
    if (!cachedBusinesses) {
      dispatch(fetchBusinesses()).then((fetchedData) => {
        storeLocally('businesses', fetchedData);
      });
    }
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchAllVendors());
  }, [dispatch]);

  // Fetch business photos
  useEffect(() => {
    const storedFetchedIds = localStorage.getItem('fetchedBusinessIds');
    if (storedFetchedIds) {
      setFetchedBusinessIds(new Set(JSON.parse(storedFetchedIds)));
    }
  }, []);

  useEffect(() => {
    businesses.forEach((business) => {
      if (!fetchedBusinessIds.has(business.businessId)) {
        dispatch(fetchPhoto(business.businessId));
        setFetchedBusinessIds((prevSet) => {
          const updatedSet = new Set(prevSet).add(business.businessId);
          localStorage.setItem('fetchedBusinessIds', JSON.stringify(Array.from(updatedSet)));
          return updatedSet;
        });
      }
    });
  }, [businesses, fetchedBusinessIds, dispatch]);

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > Math.ceil(totalItems / pageSize)) {
      return;
    }
    const appliedFromDate = selectionRange?.startDate instanceof Date ? moment(selectionRange.startDate).startOf('day').toDate() : fromDate;
    const appliedToDate = selectionRange?.endDate instanceof Date ? moment(selectionRange.endDate).endOf('day').toDate() : toDate;
    
    dispatch(setPagination({ page: newPage, size: pageSize }));
    dispatch(fetchApInvoices({
      page: newPage, 
      size: pageSize,  
      dateFilterField: dateField, 
      fromDate: appliedFromDate, 
      toDate: appliedToDate, 
      vendorName: selectedVendorName || '',
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

  // View details handler
  const handleViewDetails = (invoice: ApInvoice) => {
    setSelectedInvoice(invoice);
    setDetailsDialogOpen(true);
  };

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  // Download menu handlers
  const handleDownloadMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorElDownload(event.currentTarget as HTMLElement);
  };

  const handleDownloadMenuClose = () => {
    setAnchorElDownload(null);
  };

  const handleVendorwiseClick = () => {
    setDialogDownloadOpen(true);
    handleDownloadMenuClose();
  };

  const handleItemwiseClick = () => {
    setDialogSummaryOpen(true);
    handleDownloadMenuClose();
  };

  // Filter handlers
  const handleFilterClick = () => {
    const formattedStartDate = selectionRange?.startDate instanceof Date ? selectionRange.startDate : undefined;
    const formattedEndDate = selectionRange?.endDate instanceof Date ? selectionRange.endDate : undefined;

    dispatch(fetchApInvoices({
      page: newPage,
      size: pageSize,
      fromDate: formattedStartDate,
      toDate: formattedEndDate,
      vendorName: selectedVendorName || '',
    }))
      .then(response => {
        const data = response.payload || [];
        if (data.length === 0) {
          dispatch(setSnackbarMessage('No matching returned AP invoices found.'));
          dispatch(setSnackbarOpen(true));
        }
      })
      .catch(error => {
        console.error('Error fetching returned AP invoices:', error);
        dispatch(setSnackbarMessage(error.message || 'Error fetching returned AP invoices'));
        dispatch(setSnackbarOpen(true));
      });
  };

  const handleFilterClose = () => {
    setSelectionRange({
      startDate: new Date(),
      endDate: new Date(),
      key: 'selection',
    });
    setSelectedVendor(null);
    setSelectedVendorName('');
    dispatch(fetchApInvoices({ 
      page: 1, 
      size: pageSize, 
      dateFilterField: dateField, 
      fromDate, 
      toDate,
    }));
  };

  const handleCloseDetailsDialog = () => {
    setDetailsDialogOpen(false);
    setSelectedInvoice(null);
  };

  const handleVendorChange = (vendor: VendorSearch | null) => {
    setSelectedVendor(vendor);
    setSelectedVendorName(vendor ? vendor.vendorName : '');
  };

  // PDF Generation functions
  const generateInvoicePDF = () => {
    const doc = new jsPDF();
    let yOffset = 7;

    const business = businesses.length > 0 ? businesses[0] : null;
    if (!business) {
      console.error('Business info not found!');
      return;
    }

    // Add business image
    if (business.imageUrl) {
      try {
        doc.addImage(business.imageUrl, 'JPEG', 14, yOffset, 20, 20);
      } catch (e) {
        console.error("Image failed to load:", e);
      }
    }

    yOffset += 10;

    // Title
    doc.setFontSize(12);
    const title = "Returned AP Invoice Summary";
    const pageWidth = doc.internal.pageSize.width;
    const fontSize = doc.getFontSize();
    const titleWidth = doc.getStringUnitWidth(title) * fontSize / doc.internal.scaleFactor;
    const titleX = (pageWidth - titleWidth) / 2;
    doc.text(title, titleX, yOffset);
    doc.setLineWidth(0.1);
    doc.line(titleX, yOffset + 2, titleX + titleWidth, yOffset + 2);
    yOffset += 15;

    // Calculate total invoice amount
    const totalInvoiceAmount = returnedInvoices.reduce((sum, invoice) => {
      return sum + (invoice.invoiceAmount || 0);
    }, 0);

    const today = new Date();
    const currentDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

    // Display totals
    doc.setFontSize(10);
    doc.text(`Total Returned Amount: ${totalInvoiceAmount.toFixed(2)}`, 14, yOffset);
    const totalWidth = doc.getStringUnitWidth(`Total Returned Amount: ${totalInvoiceAmount.toFixed(2)}`) * fontSize / doc.internal.scaleFactor;
    const dateX = pageWidth - totalWidth - 14;
    doc.text(`Date: ${currentDate}`, dateX, yOffset);
    yOffset += 5;

    // Table headers
    const headers = [
      ["S.No", "AP.No", "Invoice Date", "InvoiceNo", "Vendor Name", "TotalItems", "Invoice Amount"],
    ];

    // Prepare rows
    const rows = returnedInvoices.map((ap, index) => {
      const totalItemsQuantity = Array.isArray(ap.itemDetails) && ap.itemDetails.length > 0
        ? ap.itemDetails.reduce((sum, item) => sum + (item.quantity || 0), 0)
        : 0;

      if (!ap.randomId || !ap.vendorName || !ap.apinvoiceDate) {
        return null;
      }

      return [
        (index + 1).toString(),
        ap.randomId.toString(),
        ap.invoiceDate ? format(new Date(ap.invoiceDate), 'dd-MM-yyyy') : '',
        ap.invoiceNo,
        ap.vendorName.toString(),
        totalItemsQuantity.toString(),
        (ap.invoiceAmount || 0).toFixed(2),
      ];
    }).filter(row => row !== null);

    // Add table
    doc.autoTable({
      head: headers,
      body: rows,
      startY: yOffset,
      styles: {
        fillColor: [30, 144, 255],
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
        0: { halign: 'center' },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'center' }
      }
    });

    // Add page numbers and footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${totalPages}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }

    doc.setPage(totalPages);
    doc.setFontSize(8);
    const computerGeneratedText = "This is computer generated";
    const textWidth = doc.getStringUnitWidth(computerGeneratedText) * doc.getFontSize() / doc.internal.scaleFactor;
    const textX = (doc.internal.pageSize.width - textWidth) / 2;
    doc.text(computerGeneratedText, textX, doc.internal.pageSize.height - 20, { align: 'center' });

    const pdfFilename = `Returned_AP_Summary.pdf`;
    doc.save(pdfFilename);
    setDialogDownloadOpen(false);
  };

  const generateReturnedInvoiceSummaryPDF = () => {
    const doc = new jsPDF();
    let yOffset = 10;

    const business = businesses.length > 0 ? businesses[0] : null;
    if (business && business.imageUrl) {
      try {
        doc.addImage(business.imageUrl, 'JPEG', 14, yOffset, 20, 20);
      } catch (e) {
        console.error("Image failed to load:", e);
      }
    }

    let currentYOffset = yOffset + 10;

    // Title
    doc.setFontSize(12);
    const title = "Returned Invoice Itemwise Summary";
    const pageWidth = doc.internal.pageSize.width;
    const titleWidth = doc.getStringUnitWidth(title) * doc.getFontSize() / doc.internal.scaleFactor;
    const titleX = (pageWidth - titleWidth) / 2;
    doc.text(title, titleX, currentYOffset);
    doc.setLineWidth(0.1);
    doc.line(titleX, yOffset + 2, titleX + titleWidth, yOffset + 2);
    currentYOffset += 15;

    // Calculate totals
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

    // Display summary
    doc.setFontSize(10);
    doc.text(`Total Returned Amount: ${totalInvoiceAmount.toFixed(2)}`, 14, currentYOffset);
    doc.text(`Date: ${currentDate}`, pageWidth - 14, currentYOffset, { align: 'right' });
    currentYOffset += 5;

    // Table headers
    const headers = [
      ["S.No", "AP.No", "Vendor Name", "Item Name", "Quantity", "Price", "Tax", "Discount", "Total"],
    ];

    // Prepare rows
    const rows = returnedInvoices.map((invoice, index) => {
      return invoice.itemDetails.map((item) => [
        (index + 1).toString(),
        invoice.randomId.toString(),
        invoice.vendorName,
        item.itemName,
        item.stockQuantity.toString(),
        item.unitPrice.toFixed(2),
        `${item.purchasetaxName}%`,
        (item.discountAmount || 0).toFixed(2),
        (item.totalPrice || 0).toFixed(2)
      ]);
    }).flat();

    // Add table
    doc.autoTable({
      head: headers,
      body: rows,
      startY: currentYOffset,
      styles: {
        fillColor: [30, 144, 255],
        textColor: [255, 255, 255],
        lineColor: [0, 0, 0],
        fontSize: 8
      },
      headStyles: {
        fillColor: [0, 0, 128],
        textColor: [255, 255, 255],
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
      },
    });

    // Add page numbers and footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${totalPages}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }

    doc.setPage(totalPages);
    doc.setFontSize(8);
    const computerGeneratedText = "This is computer generated";
    const textWidth = doc.getStringUnitWidth(computerGeneratedText) * doc.getFontSize() / doc.internal.scaleFactor;
    const textX = (doc.internal.pageSize.width - textWidth) / 2;
    doc.text(computerGeneratedText, textX, doc.internal.pageSize.height - 20, { align: 'center' });

    const pdfFilename = `Returned_Invoice_Itemwise.pdf`;
    doc.save(pdfFilename);
    setDialogSummaryOpen(false);
  };

  // Individual invoice PDF download
  const handleDownload = async (apinvoiceId: string) => {
    const apinvoice = returnedInvoices.find((invoice: ApInvoice) => invoice.invoiceId === apinvoiceId);

    if (!apinvoice) {
      console.error('Returned AP Invoice not found!');
      return;
    }

    const business = businesses.length > 0 ? businesses[0] : null;
    if (!business) {
      console.error('Business info not found!');
      return;
    }

    const doc = new jsPDF();
    let yOffset = 10;

    // Header Section
    if (business.imageUrl) {
      doc.addImage(business.imageUrl, 'JPEG', 35, yOffset, 25, 25);
    }

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 128);
    doc.text('RETURNED AP INVOICE', 80, yOffset + 5);

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

    // Vendor and invoice details table
    const columnWidth = 60.6;
    const tableHeader = [
      ['Vendor Details', 'Shipping Address', 'Invoice Details'],
    ];

    const vendorDetailsRows = [
      [
        `${apinvoice.vendorName || ''}\n` +
        `GSTIN: ${apinvoice.gstNumber || ''}\n` +
        `Address: ${apinvoice.address || ''}\n` +
        `City: ${apinvoice.city || ''}\n` +
        `State: ${apinvoice.state || ''}\n` +
        `Country: ${apinvoice.country || ''}\n` +
        `Email: ${apinvoice.contactpersonEmail || ''}`,
        `Shipping Address: ${apinvoice.shippingAddress}`,
        `PO No: ${apinvoice.poRandomId}\n` +
        `GRN No: ${apinvoice.grnRandomId}\n` +
        `AP No: ${apinvoice.randomId}\n` +
        `Invoice No: ${apinvoice.invoiceNo}\n` +
        `Invoice Date: ${apinvoice.invoiceDate ? format(new Date(apinvoice.invoiceDate), 'dd-MM-yyyy') : ''}\n` +
        `Return Date: ${apinvoice.apReturnedDate ? format(new Date(apinvoice.apReturnedDate), 'dd-MM-yyyy') : ''}\n` +
        `Payment Terms: ${apinvoice.paymentTerms || '15'}`,
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

    // Items Table
    const itemHeader = ['SI No', 'Description', 'HsnCode', 'Pkt Count', 'Qty', 'Stock Qty', 'Unit Price', 'Tax', 'Amount'];
    const tableRows = apinvoice.itemDetails.map((item, index) => {
      const unitPrice = item.unitPrice || 0;
      const quantity = item.quantity || 0;
      const totalAmount = unitPrice * quantity;

      return [
        `${index + 1}`,
        item.itemName || 'Item Description',
        item.hsnCode,
        item.nos,
        `${item.eachQuantity || 0} ${item.uom || 'Kgs'}`,
        `${item.stockQuantity} ${item.uom || 'Kgs'}`,
        `${unitPrice.toFixed(2)}`,
        `${item.purchasetaxName}%`,
        `${totalAmount.toFixed(2)}`,
      ];
    });

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

    // Tax calculation
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
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
      },
    });

    // Footer
    doc.text("Declaration:", 10, doc.autoTable.previous.finalY + 35);
    doc.text("We declare that this invoice shows the actual price of the described items and that all particulars are true and correct.", 10, doc.autoTable.previous.finalY + 40);
    doc.text("Authorized Signatory:", 120, doc.autoTable.previous.finalY + 48);
    doc.text("_____________________", 120, doc.autoTable.previous.finalY + 60);

    // Page numbers and footer text
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${totalPages}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }

    doc.setPage(totalPages);
    doc.setFontSize(8);
    const computerGeneratedText = "This is computer generated - RETURNED INVOICE";
    const textWidth = doc.getStringUnitWidth(computerGeneratedText) * doc.getFontSize() / doc.internal.scaleFactor;
    const textX = (doc.internal.pageSize.width - textWidth) / 2;
    doc.text(computerGeneratedText, textX, doc.internal.pageSize.height - 20, { align: 'center' });

    doc.save(`Returned_AP_Invoice_${apinvoice.invoiceNo}.pdf`);
  };

  // CSV Export functions
  const handleExportCSV = () => {
    const headers = [
      "AP No",
      "Vendor Name",
      "Total Items",
      "Invoice Date",
      "Return Date",
      "Total Invoice Amount",
      "Final Amount"
    ];

    const rows = returnedInvoices.map((ap) => {
      const totalItemsQuantity = Array.isArray(ap.itemDetails) && ap.itemDetails.length > 0
        ? ap.itemDetails.reduce((sum, item) => sum + (item.quantity || 0), 0)
        : 0;

      const totalInvoiceAmount = ap.invoiceAmount || 0;
      const totalDiscount = ap.discountDetails || 0;
      const finalAmount = totalInvoiceAmount - totalDiscount;

      if (!ap.randomId || !ap.vendorName || !ap.apinvoiceDate) {
        return null;
      }

      return [
        ap.randomId.toString(),
        ap.vendorName.toString(),
        totalItemsQuantity.toString(),
        ap.apinvoiceDate ? format(new Date(ap.apinvoiceDate), 'dd-MM-yyyy') : '',
        ap.apReturnedDate ? format(new Date(ap.apReturnedDate), 'dd-MM-yyyy') : '',
        totalInvoiceAmount.toFixed(2).toString(),
        finalAmount.toFixed(2).toString(),
      ];
    }).filter(row => row !== null);

    const csvData = [headers, ...rows];
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Returned_AP_Summary.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDialogDownloadOpen(false);
  };

  const generateReturnedInvoiceSummaryCSV = () => {
    const headers = ["S.No", "AP.No", "Vendor Name", "Item Name", "Quantity", "Price", "Tax", "Discount", "Total"];

    const rows = returnedInvoices.map((invoice, index) => {
      return invoice.itemDetails.map((item) => [
        (index + 1).toString(),
        invoice.randomId.toString(),
        invoice.vendorName,
        item.itemName,
        item.stockQuantity.toString(),
        item.unitPrice.toFixed(2),
        `${item.purchasetaxName}%`,
        (item.discountAmount || 0).toFixed(2),
        (item.totalPrice || 0).toFixed(2)
      ]);
    }).flat();

    const csvData = [headers, ...rows];
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Returned_Invoice_Itemwise.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDialogSummaryOpen(false);
  };

  // Tax calculation for details dialog
  const taxAmounts: TaxAmounts = selectedInvoice
    ? selectedInvoice.itemDetails.reduce((acc: TaxAmounts, item) => {
      const totalPrice = item.totalPrice || 0;
      const taxPercentage = Number(item.purchasetaxName);

      if (item.taxType === "cgst_sgst") {
        const sgstPercentage = taxPercentage / 2;
        const cgstPercentage = taxPercentage / 2;
        const sgstAmount = (totalPrice * sgstPercentage) / 100;
        const cgstAmount = (totalPrice * cgstPercentage) / 100;

        acc.sgst[sgstPercentage] = (acc.sgst[sgstPercentage] || 0) + sgstAmount;
        acc.cgst[cgstPercentage] = (acc.cgst[cgstPercentage] || 0) + cgstAmount;
      } else if (item.taxType === "igst") {
        const igstAmount = (totalPrice * taxPercentage) / 100;
        acc.igst[taxPercentage] = (acc.igst[taxPercentage] || 0) + igstAmount;
      }

      return acc;
    }, { sgst: {}, cgst: {}, igst: {} } as TaxAmounts)
    : { sgst: {}, cgst: {}, igst: {} };

  const uniqueRates = new Set([
    ...Object.keys(taxAmounts.sgst),
    ...Object.keys(taxAmounts.cgst),
    ...Object.keys(taxAmounts.igst),
  ]);

  return (
    <Box>
      <YenPurchasePage />
      <Box sx={{ p: 1, backgroundColor: 'white' }}>
        {/* Navigation Buttons */}
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

        {/* Filter Controls */}
        <Grid container alignItems="center" spacing={1} wrap="nowrap" ml={0.2} sx={{ mb: 0.7 }}>
          {/* Date Range Dialog */}
          <Grid item>
            <DateRangeDialog
              selectionRange={selectionRange}
              setSelectionRange={setSelectionRange}
              onApply={handleFilterClick}
            />
          </Grid>

          {/* Vendor Search */}
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

          {/* Spacer */}
          <Grid item sx={{ flexGrow: 1 }} />

          {/* Download Icon */}
          <Grid item>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <IconButton
                onClick={handleDownloadMenuClick}
                color="primary"
                disabled={returnedInvoices.length === 0}
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
            onClose={handleDownloadMenuClose}
          >
            <MenuItem onClick={handleVendorwiseClick}>Vendorwise</MenuItem>
            <MenuItem onClick={handleItemwiseClick}>Itemwise</MenuItem>
          </Menu>
        </Grid>

        {/* Main Table */}
        <Grid container spacing={1} sx={{ px: 1, pl: 1 }}>
          <TableContainer
            component={Paper}
            sx={{
              maxHeight: 'calc(100vh - 250px)',
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
                  <TableCell>Return Date</TableCell>
                  <TableCell>Total Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {returnedInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      No returned invoices available
                    </TableCell>
                  </TableRow>
                ) : (
                  returnedInvoices.map((invoice, index) => (
                    <TableRow key={invoice.randomId}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{invoice.randomId}</TableCell>
                      <TableCell>{invoice.invoiceNo}</TableCell>
                      <TableCell>{invoice.vendorName}</TableCell>
                      <TableCell>
                        {invoice.invoiceDate ? format(new Date(invoice.invoiceDate), 'dd-MM-yyyy') : ''}
                      </TableCell>
                      <TableCell>
                        {invoice.apReturnedDate ? format(new Date(invoice.apReturnedDate), 'dd-MM-yyyy') : ''}
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

          {/* Pagination */}
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
                Page {currentPage} of {Math.ceil(totalItems / pageSize)}
              </Typography>
              <IconButton
      onClick={handleNextPage}
      disabled={currentPage >= Math.ceil(totalItems / pageSize)}
      aria-label="Next Page"
    >
      <ChevronRight />
    </IconButton>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Invoice Details Dialog */}
      <Dialog 
        open={detailsDialogOpen} 
        onClose={handleCloseDetailsDialog} 
        maxWidth="lg" 
        fullWidth
        fullScreen={isFullScreen}
      >
        <DialogTitle>
          Returned Invoice Details
          <IconButton 
            onClick={toggleFullScreen} 
            color="primary" 
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedInvoice && (
            <Box>
              {/* IDs Row */}
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
              </Box>

              {/* Vendor and Date Row */}
              <Box sx={{ display: 'flex', gap: 3, mb: 2, flexWrap: 'wrap' }}>
                <Typography variant="h6">
                  <strong>Vendor:</strong> {selectedInvoice.vendorName}
                </Typography>
                <Typography variant="h6">
                  <strong>Invoice Date:</strong> {selectedInvoice.invoiceDate ? format(new Date(selectedInvoice.invoiceDate), 'dd-MM-yyyy') : ''}
                </Typography>
                <Typography variant="h6">
                  <strong>Return Date:</strong> {selectedInvoice.apReturnedDate ? format(new Date(selectedInvoice.apReturnedDate), 'dd-MM-yyyy') : ''}
                </Typography>
                <Typography variant="h6">
                  <strong>Total Amount:</strong> {selectedInvoice.invoiceAmount.toFixed(2)}
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
                        <TableCell>{item.unitPrice.toFixed(2)}</TableCell>
                        <TableCell>{item.totalPrice.toFixed(2)}</TableCell>
                        <TableCell>{item.finalPrice.toFixed(2)}</TableCell>
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

      {/* Vendorwise Download Dialog */}
      <Dialog open={dialogDownloadOpen} onClose={() => setDialogDownloadOpen(false)}>
        <DialogTitle>Export Returned AP Summary</DialogTitle>
        <DialogContent>
          Choose whether you want to download the returned AP summary as an Excel (CSV) file or generate a PDF.
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleExportCSV}
            variant="contained"
            color="primary"
            startIcon={<DescriptionIcon />}
          >
            Download CSV
          </Button>
          <Button
            onClick={generateInvoicePDF}
            variant="contained"
            color="secondary"
            startIcon={<PictureAsPdfIcon />}
          >
            Generate PDF
          </Button>
          <Button
            onClick={() => setDialogDownloadOpen(false)}
            variant="outlined"
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Itemwise Download Dialog */}
      <Dialog open={dialogSummaryOpen} onClose={() => setDialogSummaryOpen(false)}>
        <DialogTitle>Export Returned Itemwise Summary</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Please choose whether you want to export the returned itemwise data as a CSV or generate a PDF.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={generateReturnedInvoiceSummaryCSV}
            variant="contained"
            color="secondary"
            startIcon={<DescriptionIcon />}
          >
            Export Excel
          </Button>
          <Button
            onClick={generateReturnedInvoiceSummaryPDF}
            variant="contained"
            color="primary"
            startIcon={<PictureAsPdfIcon />}
          >
            Generate PDF
          </Button>
          <Button variant='outlined' onClick={() => setDialogSummaryOpen(false)}>
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
  );
};

export default React.memo(ReturnnedApInvoicePage);