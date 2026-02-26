"use client";
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, TextField, Button, Typography, Grid, Paper,
  TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogContentText,
  DialogActions,
  IconButton,
  Snackbar,
  Menu,
  MenuItem,
  Tooltip,
  Autocomplete
} from '@mui/material';
import { usePermissions } from "@/hooks/usePermissions";

import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DescriptionIcon from '@mui/icons-material/Description';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import { ClearIcon } from '@mui/x-date-pickers/icons';
import {
  selectPurchaseListState,
  clearSnackbarMessage,
  selectCurrentPage,
  selectPageSize,
  selectTotalItems,
  setPagination,
  setSearchQueryItem,
  setRandomQueryItem
} from '../../../../features/yen-purchase/PurchaseOrder/purchaseListSlice';
import { AppDispatch } from '@/redux/store';
import YenPurchasePage from '../../page';
import Link from 'next/link';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { fetchBusinesses, selectBusinesses } from '@/features/account-setting/businessSlice';
import { Item,PurchaseOrderData,TaxDetails } from '@/Models/purchaseModel';
import { PurchaseItemSearch, setSnackbarMessage, setSnackbarOpen } from '@/features/yen-purchase/PurchaseOrder/purchaseOrderSlice';
import { toWords } from 'number-to-words';
import Papa from 'papaparse';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import DateRangeDialog from '@/components/dateRange';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import moment from 'moment';
import { POsearchPurchaseItems } from '@/features/yen-purchase/PurchaseMaster/purchaseItemSlice';
import VendorSearchAutocomplete from '../../../../components/vendorsearchautocomplete';
import PurchaseOrderRandomIdSearch from '../../../../components/yen-purchase/pendingpo/infiniteScroll';
import { VendorSearch } from '@/Models/vendor';
import { fetchGrnConvertedPurchaseOrders, selectGrnConvertedPurchaseList, selectTotalGrnConvertedItems } from '../../../../features/yen-purchase/PurchaseOrder/purchaseListSlice';

// Helper function to add footer with "Page X of Y" and "This is computer generated" centered at the bottom
const addFooter = (doc: jsPDF, pageNumber: number, totalPages: number) => {
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const fontSize = 8;
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  const computerGeneratedText = "This is computer generated";
  const computerGeneratedY = pageHeight - 20;
  const computerGeneratedWidth = doc.getStringUnitWidth(computerGeneratedText) * fontSize / doc.internal.scaleFactor;
  const computerGeneratedX = (pageWidth - computerGeneratedWidth) / 2;
  doc.text(computerGeneratedText, computerGeneratedX, computerGeneratedY);
  const footerText = `Page ${pageNumber} of ${totalPages}`;
  const footerY = pageHeight - 10;
  const textWidth = doc.getStringUnitWidth(footerText) * fontSize / doc.internal.scaleFactor;
  const textX = (pageWidth - textWidth) / 2;
  doc.text(footerText, textX, footerY);
};

const GrnConvertedPo: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { hasPermission, permissions } = usePermissions();

// Module visible check
const isGrnConvertedVisible =
  permissions?.yenerp?.purchaseorders_grn_converted &&
  !(
    permissions?.yenerp?.purchaseorders_grn_converted?.hide === true ||
    permissions?.yenerp?.purchaseorders_grn_converted?.hide === 1
  );

// Individual permissions
const canRead = hasPermission(
  "yenerp",
  "purchaseorders_grn_converted",
  "read"
);

const canExport = hasPermission(
  "yenerp",
  "purchaseorders_grn_converted",
  "export" // if backend supports
);

  const { loading, error, snackbarMessage, snackbarOpen, searchQueryItem, randomIdSearch } = useSelector(selectPurchaseListState);
  const grnConvertedPurchaseList = useSelector(selectGrnConvertedPurchaseList);
  const totalGrnConvertedItems = useSelector(selectTotalGrnConvertedItems);
  const { businesses } = useSelector(selectBusinesses);
  
  const [selectedOrder, setSelectedOrderState] = useState<any | null>(null);
  const [totalOrderAmount, setTotalOrderAmount] = useState<number>(0);
  const [taxDetails, setTaxDetails] = useState<TaxDetails>({});
  const [totalDiscountPrice, setTotalDiscountPrice] = useState(0);
  const [selectedVendorName, setSelectedVendorName] = useState('');
  const [filteredOrders, setFilteredOrders] = useState<PurchaseOrderData[]>([]);
  const [dialogDownloadOpen, setDialogDownloadOpen] = useState(false);
  const [dialogSummaryOpen, setDialogSummaryOpen] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const currentPage = useSelector(selectCurrentPage);
  const pageSize = useSelector(selectPageSize);
  const totalItems = useSelector(selectTotalGrnConvertedItems);
  const newPage = useSelector(selectCurrentPage);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectionRange, setSelectionRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    key: 'selection',
  });
  const [open, setOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorSearch | null>(null);
  const [selectedRandomId, setSelectedRandomId] = useState('');
  const [skip, setSkip] = useState<number>(0);
  const [limit, setLimit] = useState<number>(50);
  const [allItems, setAllItems] = useState<PurchaseItemSearch[]>([]);
  const [newItem, setNewItem] = useState<PurchaseItemSearch | null>(null);
  const [shouldFetch, setShouldFetch] = useState(true);
  
useEffect(() => {
  if (shouldFetch && !loading) {
    // Initial fetch with no filters
    dispatch(fetchGrnConvertedPurchaseOrders({ 
      page: newPage, 
      size: pageSize 
    }));
    setShouldFetch(false);
  }
}, [dispatch, newPage, pageSize, shouldFetch, loading]);

  useEffect(() => {
    dispatch(fetchBusinesses());
    dispatch(POsearchPurchaseItems({ searchQuery: searchQueryItem, skip, limit }))
  }, [dispatch, searchQueryItem, skip, limit]);

  useEffect(() => {
    setFilteredOrders(grnConvertedPurchaseList);
  }, [grnConvertedPurchaseList]);

  // Update useEffect for selectedOrder calculations - USE poQuantity* FIELDS
  useEffect(() => {
    if (selectedOrder && selectedOrder.items) {
      let totalDiscount = 0;
      let totalAmount = 0;
      const taxes: TaxDetails = {};
      
      selectedOrder.items.forEach((item: Item) => {
        // Use poQuantityDiscountAmount for discount
        const itemDiscount = item.poQuantityDiscountAmount || 0;
        totalDiscount += itemDiscount;
        
        // Use poQuantitypendingTotalPrice for total amount
        const itemTotalPrice = item.poQuantitypendingTotalPrice || 0;
        totalAmount += itemTotalPrice;
        
        // Calculate taxes from poQuantity* tax fields
        if (item.taxType === 'cgst_sgst') {
          const cgstPercentage = (item.taxPercentage || 0) / 2;
          const sgstPercentage = (item.taxPercentage || 0) / 2;
          const cgstAmount = item.poQuantitycgst || 0;
          const sgstAmount = item.poQuantitysgst || 0;
          
          if (cgstAmount > 0) {
            taxes[`CGST_${cgstPercentage}`] = {
              type: 'CGST',
              percentage: cgstPercentage,
              amount: (taxes[`CGST_${cgstPercentage}`]?.amount || 0) + cgstAmount,
            };
          }
          
          if (sgstAmount > 0) {
            taxes[`SGST_${sgstPercentage}`] = {
              type: 'SGST',
              percentage: sgstPercentage,
              amount: (taxes[`SGST_${sgstPercentage}`]?.amount || 0) + sgstAmount,
            };
          }
        } else if (item.taxType === 'igst') {
          const igstPercentage = item.taxPercentage || 0;
          const igstAmount = item.poQuantityigst || 0;
          
          if (igstAmount > 0) {
            taxes[`IGST_${igstPercentage}`] = {
              type: 'IGST',
              percentage: igstPercentage,
              amount: (taxes[`IGST_${igstPercentage}`]?.amount || 0) + igstAmount,
            };
          }
        }
      });
      
      setTotalDiscountPrice(totalDiscount);
      setTaxDetails(taxes);
      setTotalOrderAmount(totalAmount);
    } else {
      setTotalDiscountPrice(0);
      setTaxDetails({});
      setTotalOrderAmount(0);
    }
  }, [selectedOrder]);
const handlePageChange = (newPage: number) => {
  if (newPage < 1 || newPage > Math.ceil(totalItems / pageSize)) {
    return;
  }
  dispatch(setPagination({ page: newPage, size: pageSize }));
  
  // Build filter params only if they have values
  const params: any = {
    page: newPage,
    size: pageSize,
  };

  // Only add filters if they have values
  if (selectedVendorName) {
    params.vendorName = selectedVendorName;
  }
  
  if (searchQueryItem) {
    params.itemName = searchQueryItem;
  }
  
  if (selectedRandomId) {
    params.randomId = selectedRandomId;
  }
  
  // Only add date filters if they're actually set (not default dates)
  const isDateFiltered = selectionRange?.startDate && 
                         selectionRange?.endDate && 
                         !isDefaultDateRange(selectionRange);
  
  if (isDateFiltered) {
    params.fromDate = moment(selectionRange.startDate).startOf('day').toDate();
    params.toDate = moment(selectionRange.endDate).endOf('day').toDate();
  }
  
  dispatch(fetchGrnConvertedPurchaseOrders(params));
};

// Helper function to check if date range is default (today to today)
const isDefaultDateRange = (range: any) => {
  if (!range?.startDate || !range?.endDate) return true;
  
  const today = new Date();
  const startDate = new Date(range.startDate);
  const endDate = new Date(range.endDate);
  
  return startDate.toDateString() === today.toDateString() && 
         endDate.toDateString() === today.toDateString();
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

  const handleVendorwiseClick = () => {
    setDialogDownloadOpen(true);
    handleCloseAnchor();
  };

  const handleItemwiseClick = () => {
    handleOpen();
    handleCloseAnchor();
  };

  const handleOpen = () => {
    setDialogSummaryOpen(true);
  };

  const handleClose = () => {
    setDialogSummaryOpen(false);
  };
// Generate GRN Converted Vendorwise PDF Summary
const generatePDF = () => {
  // Add safety check at the start
  if (!filteredOrders || filteredOrders.length === 0) {
    dispatch(setSnackbarMessage('No data available to generate PDF'));
    dispatch(setSnackbarOpen(true));
    setDialogDownloadOpen(false);
    return;
  }

  const doc = new jsPDF();
  let yOffset = 5;
  let totalPages = 1;
  const business = businesses.length > 0 ? businesses[0] : null;
  
  if (!business) {
    console.error('Business info not found!');
    dispatch(setSnackbarMessage('Business information not found'));
    dispatch(setSnackbarOpen(true));
    setDialogDownloadOpen(false);
    return;
  }
  
  if (business.imageUrl) {
    try {
      doc.addImage(business.imageUrl, 'JPEG', 14, yOffset, 20, 20);
    } catch (e) {
      console.error("Image failed to load:", e);
    }
  }
  
  yOffset += 7;
  doc.setFontSize(12);
  const title = "GRN Converted Purchase Order Summary";
  const pageWidth = doc.internal.pageSize.width;
  const fontSize = doc.getFontSize();
  const titleWidth = doc.getStringUnitWidth(title) * fontSize / doc.internal.scaleFactor;
  const titleX = (pageWidth - titleWidth) / 2;
  doc.text(title, titleX, yOffset);
  doc.line(titleX, yOffset + 2, titleX + titleWidth, yOffset + 2);
  
  yOffset += 15;
  // USE poQuantitypendingTotalPrice for total amount
  const totalOrderedAmount = (filteredOrders || []).reduce((sum, order) => {
    const orderAmount = order.poQuantitypendingTotalPrice || 0;
    return sum + orderAmount;
  }, 0);
  
  const today = new Date();
  const currentDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
  
  doc.setFontSize(10);
  doc.text(`Total GRN Converted Amount: ${totalOrderedAmount.toFixed(2)}`, 14, yOffset);
  const dateWidth = doc.getStringUnitWidth(`Date: ${currentDate}`) * 10 / doc.internal.scaleFactor;
  const dateX = pageWidth - dateWidth - 14;
  doc.text(`Date: ${currentDate}`, dateX, yOffset);
  
  yOffset += 5;
  const headers = [["SNo", "PO No", "Vendor Name", "Total Items GRN Qty", "GRN Date", "Total Order Amount"]];
  
  const rows = (filteredOrders || [])
    .filter(order => order && order.randomId && order.vendorName) // Filter out invalid orders
    .map((order, index) => {
      // USE poQuantity for GRN quantity
      const totalItemsQuantity = Array.isArray(order.items) && order.items.length > 0
        ? order.items.reduce((sum, item) => sum + (item.poQuantity || 0), 0)
        : 0;
      // USE poQuantitypendingTotalPrice for order amount
      const totalOrderAmount = order.totalOrderAmount+order.pendingOrderAmount || 0;
      
      return [
        (index + 1).toString(),
        order.randomId?.toString() || 'N/A',
        order.vendorName?.toString() || 'N/A',
        totalItemsQuantity.toString(),
        order.orderDate ? format(new Date(order.orderDate), 'dd-MM-yyyy') : format(new Date(), 'dd-MM-yyyy'),
        totalOrderAmount.toFixed(2).toString(),
      ];
    });
  
  if (rows.length === 0) {
    dispatch(setSnackbarMessage('No valid orders found to generate PDF'));
    dispatch(setSnackbarOpen(true));
    setDialogDownloadOpen(false);
    return;
  }
  
  doc.autoTable({
    head: headers,
    body: rows,
    startY: yOffset,
    styles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      fontSize: 8,
    },
    headStyles: {
      fillColor: [0, 0, 128],
      textColor: [255, 255, 255],
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
    },
    columnStyles: {
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
    didDrawPage: (data: { pageCount: number }) => {
      totalPages = data.pageCount;
      addFooter(doc, data.pageCount, totalPages);
    },
    margin: { bottom: 15 },
  });
  
  const finalTotalPages = doc.getNumberOfPages();
  for (let i = 1; i <= finalTotalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, finalTotalPages);
  }
  
  const pdfFilename = `GRNConverted_Vendorwise_${format(new Date(), 'ddMMyyyy')}.pdf`;
  doc.save(pdfFilename);
  setDialogDownloadOpen(false);
  dispatch(setSnackbarMessage('PDF generated successfully'));
  dispatch(setSnackbarOpen(true));
};

// Generate GRN Converted Itemwise PDF Detailed Summary
const generateSummaryPDF = () => {
  // Add safety check at the start
  if (!filteredOrders || filteredOrders.length === 0) {
    dispatch(setSnackbarMessage('No data available to generate PDF'));
    dispatch(setSnackbarOpen(true));
    handleClose();
    return;
  }

  const doc = new jsPDF();
  let yOffset = 5;
  let totalPages = 1;
  const business = businesses.length > 0 ? businesses[0] : null;
  
  if (!business) {
    console.error('Business info not found!');
    doc.setFontSize(12);
    doc.text('Error: Business info not found', 14, yOffset + 10);
    const finalTotalPages = doc.getNumberOfPages();
    for (let i = 1; i <= finalTotalPages; i++) {
      doc.setPage(i);
      addFooter(doc, i, finalTotalPages);
    }
    doc.save('GRNConverted_Itemwise.pdf');
    handleClose();
    dispatch(setSnackbarMessage('Business information not found'));
    dispatch(setSnackbarOpen(true));
    return;
  }
  
  if (business.imageUrl) {
    try {
      doc.addImage(business.imageUrl, 'JPEG', 14, yOffset, 20, 20);
    } catch (e) {
      console.error("Image failed to load:", e);
    }
  }
  
  yOffset += 7;
  doc.setFontSize(12);
  const title = 'GRN Converted Purchase Order Detailed Summary';
  const pageWidth = doc.internal.pageSize.width;
  const fontSize = doc.getFontSize();
  const titleWidth = doc.getStringUnitWidth(title) * fontSize / doc.internal.scaleFactor;
  const titleX = (pageWidth - titleWidth) / 2;
  doc.text(title, titleX, yOffset);
  doc.line(titleX, yOffset + 2, titleX + titleWidth, yOffset + 2);
  
  yOffset += 15;
  // USE poQuantitypendingTotalPrice for total amount
  const totalOrderedAmount = (filteredOrders || []).reduce((sum, order) => {
    const orderAmount = order.poQuantitypendingTotalPrice || 0;
    return sum + orderAmount;
  }, 0);
  
  const today = new Date();
  const currentDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
  
  doc.setFontSize(10);
  const totalText = `Total GRN Converted Amount: ${totalOrderedAmount.toFixed(2)}`;
  doc.text(totalText, 14, yOffset);
  const dateWidth = doc.getStringUnitWidth(`Date: ${currentDate}`) * 10 / doc.internal.scaleFactor;
  const dateX = pageWidth - dateWidth - 14;
  doc.text(`Date: ${currentDate}`, dateX, yOffset);
  
  yOffset += 10;
  const headers = [
    ['S.No', 'PO No', 'Vendor Name', 'Item Name', 'GRN Quantity', 'Price', 'Tax %', 'Tax Amount', 'Discount', 'Final Price'],
  ];
  
  const rows: (string | number)[][] = [];
  let sno = 1;
  
  (filteredOrders || [])
    .filter(order => order && order.items && order.items.length > 0)
    .forEach((order) => {
      (order.items || []).forEach((item) => {
        // Calculate tax amount from poQuantity* tax fields
        let taxAmount = 0;
        if (item.taxType === 'cgst_sgst') {
          taxAmount = (item.poQuantitycgst || 0) + (item.poQuantitysgst || 0);
        } else if (item.taxType === 'igst') {
          taxAmount = item.poQuantityigst || 0;
        }
        
        rows.push([
          sno++,
          order.randomId || 'N/A',
          order.vendorName || 'N/A',
          item.itemName || 'N/A',
          item.poQuantity || 0,
          (item.newPrice || 0).toFixed(2),
          `${item.taxPercentage || 0}%`,
          taxAmount.toFixed(2),
          (item.poQuantityDiscountAmount || 0).toFixed(2),
          (item.poQuantitypendingFinalPrice || 0).toFixed(2),
        ]);
      });
    });
  
  if (rows.length === 0) {
    doc.setFontSize(10);
    doc.text('No GRN converted purchase orders found.', 14, yOffset);
    const finalTotalPages = doc.getNumberOfPages();
    for (let i = 1; i <= finalTotalPages; i++) {
      doc.setPage(i);
      addFooter(doc, i, finalTotalPages);
    }
    doc.save('GRNConverted_Itemwise.pdf');
    handleClose();
    dispatch(setSnackbarMessage('No items found to generate PDF'));
    dispatch(setSnackbarOpen(true));
    return;
  }
  
  doc.autoTable({
    head: headers,
    body: rows,
    startY: yOffset,
    styles: {
      fontSize: 7,
      lineColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [0, 0, 128],
      textColor: [255, 255, 255],
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
    },
    columnStyles: {
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right' },
    },
    didDrawPage: (data: { pageCount: number }) => {
      totalPages = data.pageCount;
      addFooter(doc, data.pageCount, totalPages);
    },
    margin: { bottom: 15 },
  });
  
  const finalTotalPages = doc.getNumberOfPages();
  for (let i = 1; i <= finalTotalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, finalTotalPages);
  }
  
  const pdfFilename = `GRNConverted_Itemwise_${format(new Date(), 'ddMMyyyy')}.pdf`;
  doc.save(pdfFilename);
  handleClose();
  dispatch(setSnackbarMessage('PDF generated successfully'));
  dispatch(setSnackbarOpen(true));
};

// Generate Summary CSV
const generateSummaryCSV = () => {
  // Add safety check at the start
  if (!filteredOrders || filteredOrders.length === 0) {
    dispatch(setSnackbarMessage('No data available to generate CSV'));
    dispatch(setSnackbarOpen(true));
    handleClose();
    return;
  }

  const headers = ["S.No", "PO No", "Vendor Name", "Item Name", "GRN Quantity", "Price", "Tax %", "Tax Amount", "Discount", "Final Price"];
  
  const rows = (filteredOrders || [])
    .filter(order => order && order.items && order.items.length > 0)
    .map((order, orderIndex) => {
      return (order.items || []).map((item, itemIndex) => {
        // Calculate tax amount from poQuantity* fields
        let taxAmount = 0;
        if (item.taxType === 'cgst_sgst') {
          taxAmount = (item.poQuantitycgst || 0) + (item.poQuantitysgst || 0);
        } else if (item.taxType === 'igst') {
          taxAmount = item.poQuantityigst || 0;
        }
        
        return [
          `${orderIndex + 1}.${itemIndex + 1}`,
          order.randomId || 'N/A',
          order.vendorName || 'N/A',
          item.itemName || 'N/A',
          item.poQuantity || 0,
          (item.newPrice || 0).toFixed(2),
          `${item.taxPercentage || 0}%`,
          taxAmount.toFixed(2),
          (item.poQuantityDiscountAmount || 0).toFixed(2),
          (item.poQuantitypendingFinalPrice || 0).toFixed(2),
        ];
      });
    }).flat();
  
  if (rows.length === 0) {
    dispatch(setSnackbarMessage('No items found to generate CSV'));
    dispatch(setSnackbarOpen(true));
    handleClose();
    return;
  }
  
  const csvData = [headers, ...rows];
  const csv = Papa.unparse(csvData);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `GRNConverted_Itemwise_${format(new Date(), 'ddMMyyyy')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  handleClose();
  dispatch(setSnackbarMessage('CSV generated successfully'));
  dispatch(setSnackbarOpen(true));
};

// Generate Vendorwise CSV
const handleExportCSV = (): void => {
  // Add safety check at the start
  if (!filteredOrders || filteredOrders.length === 0) {
    dispatch(setSnackbarMessage('No data available to generate CSV'));
    dispatch(setSnackbarOpen(true));
    setDialogDownloadOpen(false);
    return;
  }

  const csvContent = generateCSVContent();
  
  if (!csvContent || csvContent.includes('undefined') || csvContent.split('\n').length < 2) {
    dispatch(setSnackbarMessage('No valid data to generate CSV'));
    dispatch(setSnackbarOpen(true));
    setDialogDownloadOpen(false);
    return;
  }
  
  downloadCSV(csvContent, `GRNConverted_Vendorwise_${format(new Date(), 'ddMMyyyy')}.csv`);
};

const generateCSVContent = (): string => {
  const headers = 'S.No,PO No,Vendor Name,Total Items GRN Qty,GRN Date,Total Order Amount\n';
  
  const rows = (filteredOrders || [])
    .filter(order => order && order.randomId && order.vendorName) // Filter out invalid orders
    .map((order, index) => {
      const totalItemsQuantity = Array.isArray(order.items) && order.items.length > 0
        ? order.items.reduce((sum, item) => sum + (item.poQuantity || 0), 0)
        : 0;
      const totalOrderAmount = order.totalOrderAmount + order.pendingOrderAmount || 0;
      
      return [
        (index + 1),
        order.randomId || 'N/A',
        order.vendorName || 'N/A',
        totalItemsQuantity,
        order.orderDate ? format(new Date(order.orderDate), 'dd-MM-yyyy') : format(new Date(), 'dd-MM-yyyy'),
        totalOrderAmount.toFixed(2)
      ].join(',');
    }).join('\n');
  
  if (!rows) {
    return headers;
  }
  
  return `${headers}${rows}`;
};

const downloadCSV = (csvContent: string, fileName: string): void => {
  if (!csvContent || csvContent.length < 10) {
    dispatch(setSnackbarMessage('No data to download'));
    dispatch(setSnackbarOpen(true));
    setDialogDownloadOpen(false);
    return;
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  setDialogDownloadOpen(false);
  dispatch(setSnackbarMessage('CSV downloaded successfully'));
  dispatch(setSnackbarOpen(true));
};
// Individual Purchase Order PDF Download
  const handleDownload = async (poid: string) => {
    const purchaseOrder = grnConvertedPurchaseList.find((order) => order.purchaseOrderId === poid);
    if (!purchaseOrder) {
      console.error('Purchase Order not found!');
      return;
    }
    
    const business = businesses.length > 0 ? businesses[0] : null;
    if (!business) {
      console.error('Business info not found!');
      return;
    }
    
    const doc = new jsPDF();
    let yOffset = 10;
    let totalPages = 1;
    
    // Header Section
    if (business.imageUrl) {
      doc.addImage(business.imageUrl, 'JPEG', 35, yOffset, 25, 25);
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 128); // Dark green for GRN Converted
    doc.text('GRN CONVERTED PURCHASE ORDER', 90, yOffset + 5);
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(business.companyName || '', 90, yOffset + 10);
    doc.setFontSize(8);
    doc.text(business.address1 || '', 90, yOffset + 15);
    doc.text(`Tel.No: ${business.phoneNo || ''}`, 90, yOffset + 20);
    doc.text(`E-Mail: ${business.emailId || ''}`, 90, yOffset + 25);
    doc.text(`GSTIN: ${business.gstIn || ''}`, 90, yOffset + 30);
    
    yOffset += 35;
    
    // Vendor and PO Details Table
    const columnWidth = 60.6;
    const tableHeader = [['Vendor Details', 'Billing Address', 'PO Details']];
    const vendorDetailsRows = [
      [
        `${purchaseOrder.vendorName || ' '}\n` +
        `GSTIN: ${purchaseOrder.gstNumber || ''}\n` +
        `Address: ${purchaseOrder.address || ''}\n` +
        `City: ${purchaseOrder.city || ''}\n` +
        `State: ${purchaseOrder.state || ''}\n` +
        `Country: ${purchaseOrder.country || ''}\n` +
        `Email: ${purchaseOrder.contactpersonEmail || ''}\n` +
        `Phone: ${purchaseOrder.vendorContact || ''}`,
        `Shipping Address: ${purchaseOrder.billingAddress || ''}`,
        `PO No: ${purchaseOrder.randomId || ''}\n` +
        `PO Date: ${purchaseOrder.orderDate ? format(new Date(purchaseOrder.orderDate), 'dd-MM-yyyy') : 'Not Provided'}\n` +
        `Status: ${purchaseOrder.poStatus}\n` +
        `Currency: INR`,
      ],
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
        fillColor: [0, 0, 128], // Dark green for GRN Converted
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        lineWidth: 0,
      },
      bodyStyles: {
        lineWidth: 0.1,
        lineColor: [0, 0, 0],
        minCellHeight: 15,
      },
      margin: { bottom: 15 },
      didDrawPage: (data: { pageCount: number }) => {
        totalPages = data.pageCount;
        addFooter(doc, data.pageCount, totalPages);
      },
    });
    
    yOffset = doc.autoTable.previous.finalY;
    
    // Items Table Section - Show GRN quantities
    const itemHeader = ['SI No', 'Description', 'HSN Code', 'GRN Qty', 'UOM', 'Unit Price', 'Tax %', 'Discount', 'Amount'];
    const tableRows = purchaseOrder.items.map((item, index) => {
      const unitPrice = item.newPrice || 0;
      const quantity = item.poQuantity || 0; // GRN Quantity
      const discount = (item.befTaxDiscount || 0) + (item.afTaxDiscount || 0);
      const totalAmount = item.poQuantitypendingFinalPrice || 0;
      
      return [
        `${index + 1}`,
        item.itemName || 'Item Description',
        item.hsnCode || 'N/A',
        `${quantity}`,
        item.uom || 'Kgs',
        `${unitPrice.toFixed(2)}`,
        `${item.taxPercentage || 0}%`,
        `${discount.toFixed(2)}`,
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
        fillColor: [0, 0, 128], // Dark green for GRN Converted
        textColor: [255, 255, 255],
        lineWidth: { top: 0, right: 0.1, bottom: 0.1, left: 0.1 },
        lineColor: [0, 0, 0],
      },
      bodyStyles: {
        lineColor: [0, 0, 0],
        lineWidth: { top: 0, right: 0.1, bottom: 0, left: 0.1 },
      },
      columnStyles: {
        0: { halign: 'center' },
        1: { halign: 'left' },
        2: { halign: 'left' },
        3: { halign: 'right' },
        4: { halign: 'center' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
      },
      margin: { bottom: 15 },
      didDrawPage: (data: { pageCount: number }) => {
        totalPages = data.pageCount;
        addFooter(doc, data.pageCount, totalPages);
      },
    });
    
    yOffset = doc.autoTable.previous.finalY;
    
    // Calculate taxes for items
    const taxRates = {
      CGST: new Map<number, number>(),
      SGST: new Map<number, number>(),
      IGST: new Map<number, number>(),
    };
    
    // Calculate item taxes
    purchaseOrder.items.forEach(item => {
      if (item.taxType === 'cgst_sgst') {
        const cgstAmount = ((item.taxPercentage || 0) / 2 / 100) * (item.newPrice || 0) * (item.poQuantity || 0);
        const sgstAmount = ((item.taxPercentage || 0) / 2 / 100) * (item.newPrice || 0) * (item.poQuantity || 0);
        taxRates.CGST.set((item.taxPercentage || 0) / 2, (taxRates.CGST.get((item.taxPercentage || 0) / 2) || 0) + cgstAmount);
        taxRates.SGST.set((item.taxPercentage || 0) / 2, (taxRates.SGST.get((item.taxPercentage || 0) / 2) || 0) + sgstAmount);
      } else if (item.taxType === 'igst') {
        const igstAmount = ((item.taxPercentage || 0) / 100) * (item.newPrice || 0) * (item.poQuantity || 0);
        taxRates.IGST.set(item.taxPercentage || 0, (taxRates.IGST.get(item.taxPercentage || 0) || 0) + igstAmount);
      }
    });
    
    // Calculate freight taxes
    const freightTaxRates = {
      CGST: new Map<number, number>(),
      SGST: new Map<number, number>(),
      IGST: new Map<number, number>(),
    };
    
    if (purchaseOrder.freights && purchaseOrder.freights.length > 0) {
      purchaseOrder.freights.forEach((freight) => {
        const freightAmount = freight.amt || 0;
        const freightTaxAmount = freight.tAmt || 0;
        const freightTaxPercentage = freightAmount > 0 ? (freightTaxAmount / freightAmount) * 100 : 0;
        
        if (freight.taxType === 'cgst_sgst') {
          const cgstRate = freightTaxPercentage / 2;
          const sgstRate = freightTaxPercentage / 2;
          const cgstAmount = (cgstRate / 100) * freightAmount;
          const sgstAmount = (sgstRate / 100) * freightAmount;
          freightTaxRates.CGST.set(cgstRate, (freightTaxRates.CGST.get(cgstRate) || 0) + cgstAmount);
          freightTaxRates.SGST.set(sgstRate, (freightTaxRates.SGST.get(sgstRate) || 0) + sgstAmount);
        } else if (freight.taxType === 'igst') {
          freightTaxRates.IGST.set(freightTaxPercentage, (freightTaxRates.IGST.get(freightTaxPercentage) || 0) + freightTaxAmount);
        }
      });
    }
    
    const totalWithoutTax = purchaseOrder.items.reduce((sum, item) => sum + ((item.newPrice || 0) * (item.poQuantity || 0)), 0);
    
    // Create tax summary
    const taxSummary: any[] = [];
    taxSummary.push([
      { content: '', styles: { halign: 'left' } },
      { content: 'Total Amount:', styles: { halign: 'left' } },
      { content: totalWithoutTax.toFixed(2), styles: { fontStyle: 'bold' } }
    ]);
    taxSummary.push([
      { content: '', styles: { halign: 'left' } },
      { content: 'Total Discount:', styles: { halign: 'left' } },
      { content: `${purchaseOrder.pendingDiscountAmount?.toFixed(2) || '0.00'}`, styles: { fontStyle: 'bold' } }
    ]);
    
    const totalCGST = Array.from(taxRates.CGST.values()).reduce((sum, amount) => sum + amount, 0);
    const totalSGST = Array.from(taxRates.SGST.values()).reduce((sum, amount) => sum + amount, 0);
    const totalIGST = Array.from(taxRates.IGST.values()).reduce((sum, amount) => sum + amount, 0);
    
    const cgstBreakdown = Array.from(taxRates.CGST.entries())
      .map(([rate, amount]) => `CGST @${rate}%: ${amount.toFixed(2)}`)
      .join(' ');
    taxSummary.push([
      { content: cgstBreakdown, styles: { halign: 'left', fontStyle: 'bold' } },
      { content: 'Total CGST:', styles: { halign: 'left' } },
      { content: totalCGST.toFixed(2), styles: { fontStyle: 'bold' } }
    ]);
    
    const sgstBreakdown = Array.from(taxRates.SGST.entries())
      .map(([rate, amount]) => `SGST @${rate}%: ${amount.toFixed(2)}`)
      .join(' ');
    taxSummary.push([
      { content: sgstBreakdown, styles: { halign: 'left', fontStyle: 'bold' } },
      { content: 'Total SGST:', styles: { halign: 'left' } },
      { content: totalSGST.toFixed(2), styles: { fontStyle: 'bold' } }
    ]);
    
    const igstBreakdown = Array.from(taxRates.IGST.entries())
      .map(([rate, amount]) => `IGST @${rate}%: ${amount.toFixed(2)}`)
      .join(' ');
    taxSummary.push([
      { content: igstBreakdown, styles: { halign: 'left', fontStyle: 'bold' } },
      { content: 'Total IGST:', styles: { halign: 'left' } },
      { content: totalIGST.toFixed(2), styles: { fontStyle: 'bold' } }
    ]);
    
    const itemsTotalWithTax = totalWithoutTax + totalCGST + totalSGST + totalIGST;
    const totalFreightAmount = purchaseOrder.totalFreightAmount || 0;
    
    if (totalFreightAmount > 0) {
      taxSummary.push([
        { content: '', styles: { halign: 'left' } },
        { content: 'Freight Charges:', styles: { halign: 'left', fontStyle: 'bold' } },
        { content: totalFreightAmount.toFixed(2), styles: { fontStyle: 'bold' } }
      ]);
    }
    
    freightTaxRates.CGST.forEach((amount, rate) => {
      taxSummary.push([
        { content: `Freight CGST @${rate.toFixed(2)}%`, styles: { halign: 'left' } },
        { content: '', styles: { halign: 'left' } },
        { content: amount.toFixed(2), styles: { fontStyle: 'bold' } }
      ]);
    });
    
    freightTaxRates.SGST.forEach((amount, rate) => {
      taxSummary.push([
        { content: `Freight SGST @${rate.toFixed(2)}%`, styles: { halign: 'left' } },
        { content: '', styles: { halign: 'left' } },
        { content: amount.toFixed(2), styles: { fontStyle: 'bold' } }
      ]);
    });
    
    freightTaxRates.IGST.forEach((amount, rate) => {
      taxSummary.push([
        { content: `Freight IGST @${rate.toFixed(2)}%`, styles: { halign: 'left' } },
        { content: '', styles: { halign: 'left' } },
        { content: amount.toFixed(2), styles: { fontStyle: 'bold' } }
      ]);
    });
    
    const totalFreightTaxAmount = purchaseOrder.totalFreightTaxAmount || 0;
    const subtotalWithFreight = itemsTotalWithTax + totalFreightAmount + totalFreightTaxAmount;
    
    const roundOffAmount = purchaseOrder.roundOffValue || 0;
    const grandTotal = subtotalWithFreight + roundOffAmount;
    const roundedGrandTotal = Math.round(grandTotal);
    const finalRoundOff = roundedGrandTotal - grandTotal;
    
    taxSummary.push([
      { content: '', styles: { halign: 'left' } },
      { content: 'Round Off Amount:', styles: { halign: 'left' } },
      { content: purchaseOrder.roundOffValue?.toFixed(2) || '0.00', styles: { fontStyle: 'bold' } }
    ]);
    
    if (Math.abs(finalRoundOff) > 0.01) {
      taxSummary.push([
        { content: '', styles: { halign: 'left' } },
        { content: 'Final Round Off:', styles: { halign: 'left' } },
        { content: finalRoundOff.toFixed(2), styles: { fontStyle: 'bold' } }
      ]);
    }
    
    function capitalizeFirstLetter(str: string) {
      return str.replace(/\b\w/g, char => char.toUpperCase());
    }
    
    const amountInWords = capitalizeFirstLetter(toWords(roundedGrandTotal)) + ' only';
    const wordsLines = doc.splitTextToSize(`Amount In Words: ${amountInWords}`, 120);
    const finalTotalLabel = 'Total [Including Tax & Freight]:';
    const finalTotalValue = roundedGrandTotal.toFixed(2);
    
    if (wordsLines.length === 1) {
      taxSummary.push([
        { content: wordsLines[0], styles: { halign: 'left', fontStyle: 'bold' } },
        { content: finalTotalLabel, styles: { halign: 'left', fontStyle: 'bold' } },
        { content: finalTotalValue, styles: { fontStyle: 'bold' } }
      ]);
    } else {
      for (let i = 0; i < wordsLines.length; i++) {
        if (i === wordsLines.length - 1) {
          taxSummary.push([
            { content: wordsLines[i], styles: { halign: 'left', fontStyle: 'bold' } },
            { content: finalTotalLabel, styles: { halign: 'left', fontStyle: 'bold' } },
            { content: finalTotalValue, styles: { fontStyle: 'bold' } }
          ]);
        } else {
          taxSummary.push([
            { content: wordsLines[i], styles: { halign: 'left', fontStyle: 'bold' } },
            { content: '', styles: { halign: 'left' } },
            { content: '', styles: { halign: 'center' } }
          ]);
        }
      }
    }
    
    doc.autoTable({
      body: taxSummary,
      startY: yOffset,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { cellWidth: 115.5, halign: 'left' },
        1: { cellWidth: 36, halign: 'left' },
        2: { cellWidth: 30.2, halign: 'center' },
      },
      bodyStyles: {
        fontStyle: 'bold',
      },
      margin: { bottom: 15 },
      didDrawPage: (data: { pageCount: number }) => {
        totalPages = data.pageCount;
        addFooter(doc, data.pageCount, totalPages);
      },
    });
    
    yOffset = doc.autoTable.previous.finalY + 10;
    
    // Terms & Conditions
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Terms & Conditions', 10, yOffset);
    yOffset += 5;
    
    const staticTerms = [
      '1. This document is a GRN Converted Purchase Order.',
      '2. Goods received and accepted as per GRN.',
      '3. Subject to Ramanathapuram Jurisdiction Only',
    ];
    
    const maxWidth = 90;
    const lineHeight = 5;
    
    staticTerms.forEach((term) => {
      const lines = doc.splitTextToSize(term, maxWidth);
      lines.forEach((line: string) => {
        doc.setFont('helvetica', 'normal');
        doc.text(line, 10, yOffset);
        yOffset += lineHeight;
      });
    });
    
    // Position for GRN Converted Stamp/Image
    const taxSummaryEndY = doc.autoTable.previous.finalY;
   
    // Declaration
    doc.setFont('helvetica', 'bold');
    doc.text('Declaration:', 10, yOffset);
    yOffset += 5;
    
    const declarationText = 'We declare that this invoice shows the actual price of the described items and that all particulars are true and correct.';
    const declarationLines = doc.splitTextToSize(declarationText, 180);
    doc.setFont('helvetica', 'normal');
    declarationLines.forEach((line: string) => {
      doc.text(line, 10, yOffset);
      yOffset += lineHeight;
    });
    yOffset += 10; // space before signature

  // Authorized Signatory – now directly after Terms & Conditions
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Authorized Signatory', 130, yOffset);

  // Optional: signature line
  // doc.setLineWidth(0.4);
  doc.line(110, yOffset + 2, 180, yOffset + 2);
    
    const finalTotalPages = doc.getNumberOfPages();
    for (let i = 1; i <= finalTotalPages; i++) {
      doc.setPage(i);
      addFooter(doc, i, finalTotalPages);
    }
    
    doc.save(`${purchaseOrder.vendorName}_${purchaseOrder.randomId}_GRN_Converted.pdf`);
  };


  const handleViewDetailsClick = (orderId: string) => {
    const selectedOrder = grnConvertedPurchaseList.find(order => order.purchaseOrderId === orderId);
    if (selectedOrder) {
      setSelectedOrderState(selectedOrder);
      setOpenDialog(true);
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedOrderState(null);
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget as HTMLElement);
  };

  const handleCloseAnchor = () => {
    setAnchorEl(null);
  };

  const handleVendorChange = (vendor: VendorSearch | null) => {
    setSelectedVendor(vendor);
    setSelectedVendorName(vendor ? vendor.vendorName : '');
  };

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  const handleSearchChangeItem = (newInputValue: string) => {
    dispatch(setSearchQueryItem(newInputValue));
    setSkip(0);
    setAllItems([]);
    dispatch(POsearchPurchaseItems({ searchQuery: newInputValue, skip: 0, limit }))
      .unwrap()
      .then((newItems) => {
        setAllItems(newItems);
        setSkip(limit);
      });
  };

  const handleItemSelect = (item: PurchaseItemSearch | null) => {
    if (item) {
      setNewItem(item);
      setOpen(false);
    } else {
      setNewItem(null);
    }
  };

  const loadMoreItems = () => {
    dispatch(POsearchPurchaseItems({ searchQuery: searchQueryItem, skip, limit }))
      .unwrap()
      .then((newItems) => {
        if (newItems.length > 0) {
          setAllItems((prevItems) => [...prevItems, ...newItems]);
          setSkip((prevSkip) => prevSkip + limit);
        }
      });
  };

  const handleScroll = (event: React.UIEvent<HTMLUListElement>) => {
    const target = event.currentTarget;
    if (target.scrollHeight - target.scrollTop === target.clientHeight) {
      loadMoreItems();
    }
  };

  const handleRandomIdChange = (randomId: string) => {
    setSelectedRandomId(randomId);
  };
const handleFilterClick = () => {
  // Reset to page 1 when applying filters
  dispatch(setPagination({ page: 1, size: pageSize }));
  
  // Build filter params only if they have values
  const params: any = {
    page: 1,
    size: pageSize,
  };

  // Only add filters if they have values
  if (selectedVendorName) {
    params.vendorName = selectedVendorName;
  }
  
  if (searchQueryItem) {
    params.itemName = searchQueryItem;
  }
  
  if (selectedRandomId) {
    params.randomId = selectedRandomId;
  }
  
  // Only add date filters if they're actually set (not default)
  const isDateFiltered = selectionRange?.startDate && 
                         selectionRange?.endDate && 
                         !isDefaultDateRange(selectionRange);
  
  if (isDateFiltered) {
    params.fromDate = moment(selectionRange.startDate).startOf('day').toDate();
    params.toDate = moment(selectionRange.endDate).endOf('day').toDate();
  }
  
  dispatch(fetchGrnConvertedPurchaseOrders(params))
    .then((response: any) => {
      const data = response.payload?.purchaseOrders || [];
      if (data.length === 0) {
        dispatch(setSnackbarMessage('No matching GRN converted orders found.'));
        dispatch(setSnackbarOpen(true));
      }
    })
    .catch((error: any) => {
      console.error('Error fetching GRN converted purchase orders:', error);
      dispatch(setSnackbarMessage(error.message || 'Error fetching GRN converted orders'));
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
  setNewItem(null);
  setSelectedRandomId('');
  dispatch(setSearchQueryItem(''));
  
  // Also clear any random ID search in Redux
  dispatch(setRandomQueryItem(''));
  
  // Reset to page 1 with no filters
  dispatch(fetchGrnConvertedPurchaseOrders({ 
    page: 1, 
    size: pageSize 
  }));
  
  // Set pagination back to page 1
  dispatch(setPagination({ page: 1, size: pageSize }));
};
// ❌ Module hidden
if (!isGrnConvertedVisible) {
  return (
    <Box p={3}>
      <Typography color="error">
        You do not have access to the GRN Converted module.
      </Typography>
    </Box>
  );
}

// ❌ No read permission
if (!canRead) {
  return (
    <Box p={3}>
      <Typography color="error">
        You do not have permission to view GRN Converted Purchase Orders.
      </Typography>
    </Box>
  );
}


  if (loading && filteredOrders.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress style={{ color: 'primary' }} />
      </Box>
    );
  }

  if (error) return <Typography>Error: {error}</Typography>;

  return (
    <Box>
      <YenPurchasePage />
      <Box sx={{ px: 2, py: 1, backgroundColor: 'white' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* Navigation Buttons */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'nowrap',
              gap: 1,
            }}
          >
            <Link href="/yen-purchase/PurchaseOrder" passHref>
              <Button variant="contained" color="primary">
                Pending
              </Button>
            </Link>
            <Link href="/yen-purchase/PurchaseOrder/Approvedpo" passHref>
              <Button variant="contained" color="primary">
                Approved
              </Button>
            </Link>
            <Link href="/yen-purchase/PurchaseOrder/RejectedPo" passHref>
              <Button variant="contained" color="primary">
                Rejected
              </Button>
            </Link>
          {isGrnConvertedVisible && (
  <Link href="/yen-purchase/PurchaseOrder/GRNConvertedPO" passHref>
  <Button
                variant="contained"
                sx={{
                  backgroundColor: 'white',
                  color: 'black',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  },
                }}
              >
               GRN Converted
              </Button>
  </Link>
)}

          </Box>
          
          {/* Filter Section */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flexWrap: 'nowrap',
              width: '100%',
              overflowX: 'auto',
              py: 1,
            }}
          >
            <Grid container spacing={1} alignItems="center" wrap="nowrap" sx={{ width: 'auto', flexGrow: 1 }}>
              {/* Date Range Dialog */}
              <Grid item>
                <DateRangeDialog
                  selectionRange={selectionRange}
                  setSelectionRange={setSelectionRange}
                  onApply={handleFilterClick}
                />
              </Grid>
              
              {/* Vendor Search */}
              <Grid item xs={6} md={2}>
                <VendorSearchAutocomplete
                  value={selectedVendor}
                  onChange={handleVendorChange}
                  label="All Vendors"
                />
              </Grid>
              
              {/* Item Search */}
              <Grid item xs={6} md={2}>
                <Autocomplete
                  fullWidth
                  options={allItems}
                  getOptionLabel={(option: PurchaseItemSearch) => option.itemName || ''}
                  isOptionEqualToValue={(option: PurchaseItemSearch, value: PurchaseItemSearch | null) =>
                    option.purchaseitemId === value?.purchaseitemId
                  }
                  value={newItem}
                  onInputChange={(event, newInputValue) => {
                    handleSearchChangeItem(newInputValue);
                  }}
                  onChange={(_, value) => handleItemSelect(value)}
                  open={open}
                  onOpen={() => {
                    setOpen(true);
                    if (allItems.length === 0) {
                      dispatch(POsearchPurchaseItems({ searchQuery: '', skip: 0, limit }))
                        .unwrap()
                        .then((newItems) => {
                          setAllItems(newItems);
                          setSkip(limit);
                        });
                    }
                  }}
                  onClose={() => setOpen(false)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="All Items"
                      variant="outlined"
                      size="small"
                    />
                  )}
                  renderOption={(props, option) => (
                    <li {...props} key={option.purchaseitemId}>
                      {option.itemName}
                    </li>
                  )}
                  ListboxProps={{
                    onScroll: handleScroll as React.UIEventHandler<HTMLUListElement>
                  }}
                />
              </Grid>
              
              {/* PO ID Search */}
              <Grid item xs={6} md={1}>
                <PurchaseOrderRandomIdSearch
                  value={selectedRandomId}
                  onChange={handleRandomIdChange}
                  label="PO ID"
                />
              </Grid>
              
              {/* Filter Icon */}
              <Grid item>
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
              </Grid>
              
              {/* Filter Clear Icon */}
              <Grid item>
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
              </Grid>
              
              {/* Spacer to push download to the end */}
              <Grid item sx={{ flexGrow: 1 }} />
              
              {/* Download Button */}
              <Grid item xs="auto">
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <IconButton
                    onClick={handleClick}
                    color="primary"
                    className="icon-button-outline"
                    size="small"
                    sx={{ p: 0.3 }}
                    disabled={!filteredOrders || filteredOrders.length === 0}
                  >
                    {loading ? <CircularProgress size={16} /> : <DownloadIcon fontSize="small" />}
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
                  <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleCloseAnchor}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  >
                    <MenuItem onClick={handleVendorwiseClick}>Vendorwise Summary</MenuItem>
                    <MenuItem onClick={handleItemwiseClick}>Itemwise Detailed</MenuItem>
                  </Menu>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Box>
        
        {/* Table Section */}
        <TableContainer component={Paper} sx={{
          maxHeight: 'calc(100vh - 270px)',
          overflowY: 'auto',
          width: '100%',
          mt: 0.7
        }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell className='table-number-right'>S.No</TableCell>
                <TableCell>PO ID</TableCell>
                <TableCell>Vendor Name</TableCell>
                <TableCell>Order Date</TableCell>
                <TableCell className='table-number-right'>Total Qty</TableCell>
                <TableCell className='table-number-right'>Total Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">No GRN Converted Data</TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order, index) => {
                  const totalGrnQuantity = Array.isArray(order.items) 
                    ? order.items.reduce((acc, item) => acc + (item.poQuantity || 0), 0) 
                    : 0;
                  return (
                    <TableRow key={order.purchaseOrderId}>
                      <TableCell className='table-number-right'>{(currentPage - 1) * pageSize + index + 1}</TableCell>
                      <TableCell>{order.randomId}</TableCell>
                      <TableCell>{order.vendorName}</TableCell>
                      <TableCell>
                        {order.orderDate 
                          ? format(new Date(order.orderDate), 'dd-MM-yyyy') 
                          : format(new Date(), 'dd-MM-yyyy')}
                      </TableCell>
                      <TableCell className='table-number-right'>{totalGrnQuantity}</TableCell>
                      <TableCell className='table-number-right'>
                        {(order.totalOrderAmount + order.pendingOrderAmount || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>{order.poStatus}</TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <Tooltip title="View Details">
                            <IconButton
                              onClick={() => handleViewDetailsClick(order.purchaseOrderId)}
                              color="primary"
                              sx={{ mr: 1 }}
                            >
                              <VisibilityIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Download PDF">
                            <IconButton
                              color="primary"
                              onClick={() => handleDownload(order.purchaseOrderId)}
                            >
                              <PictureAsPdfIcon />
                            </IconButton>
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
        
        {/* Pagination */}
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
      </Box>
      
      {/* View Details Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog} 
        maxWidth={false}
        fullWidth={true}
        fullScreen={isFullScreen}
        container={document.body}
        disablePortal={false}
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
          backgroundColor: '#E8F5E9',
          padding: isFullScreen ? '16px 24px' : '16px'
        }}>
          <Box>
            <Typography variant="h6" component="span" sx={{ color: 'primary', fontWeight: 'bold' }}>
              GRN CONVERTED ORDER DETAILS
            </Typography>
            <Typography variant="subtitle1" sx={{ ml: 2, display: 'inline', color: '#000' }}>
              {selectedOrder?.randomId ? `PO: ${selectedOrder.randomId}` : ''}
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ display: 'inline', mr: 2 }}>
              Vendor: {selectedOrder?.vendorName || 'Unknown Vendor'}
            </Typography>
            <IconButton onClick={toggleFullScreen} color="primary" edge="end">
              {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{
          padding: isFullScreen ? '0 24px' : '20px',
          height: isFullScreen ? 'calc(100vh - 120px)' : 'auto',
          overflow: 'auto'
        }}>
          <TableContainer
            component={Paper}
            sx={{
              maxHeight: 'calc(100vh - 230px)',
              overflowY: 'auto',
              width: '100%',
              mt: 2
            }}
          >
            <Table stickyHeader>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#F5F5F5' }}>
                  <TableCell className='table-number-right'>S.No</TableCell>
                  <TableCell>Item Name</TableCell>
                  <TableCell>HSN Code</TableCell>
                  <TableCell>UOM</TableCell>
                  <TableCell className='table-number-right'>GRN Qty</TableCell>
                  <TableCell className='table-number-right'>Unit Price</TableCell>
                  <TableCell className='table-number-right'>Discount</TableCell>
                  <TableCell className='table-number-right'>Tax %</TableCell>
                  <TableCell className='table-number-right'>Tax Amount</TableCell>
                  <TableCell className='table-number-right'>Total Amount</TableCell>
                  <TableCell>Expiry Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedOrder?.items?.length === 0 || !selectedOrder?.items ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center">No Items Available</TableCell>
                  </TableRow>
                ) : (
                  selectedOrder.items.map((item: Item, index: number) => {
                    const itemDiscount = item.poQuantityDiscountAmount || 0;
                    let taxAmount = 0;
                    if (item.taxType === 'cgst_sgst') {
                      taxAmount = (item.poQuantitycgst || 0) + (item.poQuantitysgst || 0);
                    } else if (item.taxType === 'igst') {
                      taxAmount = item.poQuantityigst || 0;
                    }
                    
                    return (
                      <TableRow key={item.itemId || index}>
                        <TableCell className='table-number-right'>{index + 1}</TableCell>
                        <TableCell>{item.itemName || 'N/A'}</TableCell>
                        <TableCell>{item.hsnCode || 'N/A'}</TableCell>
                        <TableCell>{item.uom || 'N/A'}</TableCell>
                        <TableCell className='table-number-right'>{item.poQuantity || 0}</TableCell>
                        <TableCell className='table-number-right'>{(item.newPrice || 0).toFixed(2)}</TableCell>
                        <TableCell className='table-number-right'>{itemDiscount.toFixed(2)}</TableCell>
                        <TableCell className='table-number-right'>{item.taxPercentage || 0}%</TableCell>
                        <TableCell className='table-number-right'>{taxAmount.toFixed(2)}</TableCell>
                        <TableCell className='table-number-right'>{(item.poQuantitypendingFinalPrice || 0).toFixed(2)}</TableCell>
                        <TableCell>{item.expiryDate ? format(new Date(item.expiryDate), 'dd-MM-yyyy') : 'N/A'}</TableCell>
                      </TableRow>
                    );
                  })
                )}
                
                {/* Summary Rows */}
                {selectedOrder?.items && selectedOrder.items.length > 0 && (
                  <>
                    <TableRow>
                      <TableCell colSpan={9} align="right"><strong>Total Discount:</strong></TableCell>
                      <TableCell className='table-number-right'><strong>{totalDiscountPrice.toFixed(2)}</strong></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    {Object.entries(taxDetails).map(([key, tax]) => (
                      <TableRow key={key}>
                        <TableCell colSpan={9} align="right">
                          <strong>{tax.type} ({tax.percentage.toFixed(2)}%):</strong>
                        </TableCell>
                        <TableCell className='table-number-right'><strong>{tax.amount.toFixed(2)}</strong></TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ backgroundColor: '#E8F5E9' }}>
                      <TableCell colSpan={9} align="right"><strong>Total Order Amount:</strong></TableCell>
                      <TableCell className='table-number-right'><strong>{totalOrderAmount.toFixed(2)}</strong></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #E0E0E0' }}>
          <Button 
            variant="contained" 
            onClick={handleCloseDialog}
          >
            Close
          </Button>
          {selectedOrder && (
            <Button 
              variant="outlined" 
              onClick={() => {
                handleCloseDialog();
                handleDownload(selectedOrder.purchaseOrderId);
              }}
              startIcon={<PictureAsPdfIcon />}
            >
              Download PDF
            </Button>
          )}
        </DialogActions>
      </Dialog>
      
      {/* Download Options Dialog - Vendorwise */}
      <Dialog open={dialogDownloadOpen} onClose={() => setDialogDownloadOpen(false)}>
        <DialogTitle sx={{ color: 'primary', fontWeight: 'bold' }}>
          Export GRN Converted - Vendorwise Summary
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Choose whether you want to download the vendorwise summary report as an Excel (CSV) file or generate a PDF.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleExportCSV}
            variant="contained"
            startIcon={<DescriptionIcon />}
          >
            Download CSV
          </Button>
          <Button
            onClick={generatePDF}
            variant="contained"
            startIcon={<PictureAsPdfIcon />}
            sx={{ backgroundColor: 'primary' }}
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
      
      {/* Download Options Dialog - Itemwise */}
      <Dialog open={dialogSummaryOpen} onClose={handleClose}>
        <DialogTitle sx={{ color: 'primary', fontWeight: 'bold' }}>
          Export GRN Converted - Itemwise Detailed Report
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Please choose whether you want to export the detailed itemwise data as a CSV or generate a PDF.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={generateSummaryCSV}
            variant="contained"
            startIcon={<DescriptionIcon />}
          >
            Export Excel
          </Button>
          <Button
            onClick={generateSummaryPDF}
            variant="contained"
            startIcon={<PictureAsPdfIcon />}
          >
            Generate PDF
          </Button>
          <Button variant='outlined' onClick={handleClose}>
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

export default React.memo(GrnConvertedPo);
