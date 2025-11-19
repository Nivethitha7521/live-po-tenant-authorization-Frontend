"use client";
import React, { useEffect, useRef, useState } from 'react';
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
  Popover,
  Autocomplete
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DescriptionIcon from '@mui/icons-material/Description';  // CSV icon
import FilterAltIcon from '@mui/icons-material/FilterAlt'; // Import the filter icon
import BlockIcon from '@mui/icons-material/Block'; // Deactivate icon from Material UI
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { ClearIcon } from '@mui/x-date-pickers/icons';
import {
  selectPurchaseListState,
  setSelectedOrder, updateReceivedDamagedQuantities, updatePurchaseOrderStatusToPending, updateInvoiceDetails,
  deactivatePurchaseOrder,
  fetchPurchaseOrders, clearSnackbarMessage,
  selectCurrentPage,
  selectPageSize,
  selectTotalItems, setPagination, setSearchQueryItem,
  setRandomQueryItem,
  fetchAllPurchaseOrders
} from '../../../../features/yen-purchase/PurchaseOrder/purchaseListSlice';
import { AppDispatch } from '@/redux/store';
import YenPurchasePage from '../../page';
import Link from 'next/link';
import { format, parse } from 'date-fns';
import { PurchaseItemSearchAdd, TaxDetails, Vendor } from '@/Models/purchaseModel';
import RefreshIcon from '@mui/icons-material/Refresh';
import jsPDF from 'jspdf';
import 'jspdf-autotable'; // This is needed to use autoTable with jsPDF
import { fetchBusinesses, fetchPhoto, selectBusinesses } from '@/features/account-setting/businessSlice';
import { Item, PurchaseOrderData } from '@/Models/purchaseListModel';
import { fetchAllVendors, PurchaseItemSearch, selectPurchaseOrderState, setSnackbarMessage, setSnackbarOpen } from '@/features/yen-purchase/PurchaseOrder/purchaseOrderSlice';
import { toWords } from 'number-to-words';
import Papa from 'papaparse';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import DateRangeDialog from '@/components/dateRange';
import 'react-date-range/dist/styles.css'; // main style file
import 'react-date-range/dist/theme/default.css'; // theme css file
import moment from 'moment';
import { POsearchPurchaseItems } from '@/features/yen-purchase/PurchaseMaster/purchaseItemSlice';
import VendorSearchAutocomplete from '../../../../components/vendorsearchautocomplete';
import PurchaseOrderRandomIdSearch from '../../../../components/yen-purchase/pendingpo/infiniteScroll';
import { VendorSearch } from '@/Models/vendor';


// Helper function to add footer with "Page X of Y" and "This is computer generated" centered at the bottom
const addFooter = (doc: jsPDF, pageNumber: number, totalPages: number) => {
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const fontSize = 8;
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0); // Black color for the text

  // Computer generated text
  const computerGeneratedText = "This is computer generated";
  const computerGeneratedY = pageHeight - 20;
  const computerGeneratedWidth = doc.getStringUnitWidth(computerGeneratedText) * fontSize / doc.internal.scaleFactor;
  const computerGeneratedX = (pageWidth - computerGeneratedWidth) / 2;
  doc.text(computerGeneratedText, computerGeneratedX, computerGeneratedY);

  // Page number text
  const footerText = `Page ${pageNumber} of ${totalPages}`;
  const footerY = pageHeight - 10; // Position page number 10 units from the bottom
  const textWidth = doc.getStringUnitWidth(footerText) * fontSize / doc.internal.scaleFactor;
  const textX = (pageWidth - textWidth) / 2; // Center the footer text
  doc.text(footerText, textX, footerY);
};

const RejectedPo: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { purchaseList, purchaseOrders, loading, error, snackbarMessage, snackbarOpen, searchQueryItem, randomIdSearch } = useSelector(selectPurchaseListState);
  const { businesses } = useSelector(selectBusinesses);
  const [isPending, setIsPending] = useState(false);
  const [selectedOrder, setSelectedOrderState] = useState<any | null>(null);
  const [deleteOrder, setSelectedDeleteOrderState] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openMovePendingDialog, setOpenMovePendingDialog] = useState(false);
  const [updatedItems, setUpdatedItems] = useState<any[]>([]);
  const [totalOrderAmount, setTotalOrderAmount] = useState<number>(0);
  const [taxDetails, setTaxDetails] = useState<TaxDetails>({});
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false); // State for delete confirmation dialog
  const [totalOrderAmountDiscount, setTotalOrderAmountDiscount] = useState<number>(0);
  const [totalDiscountPrice, setTotalDiscountPrice] = useState(0);
  const [fetchedBusinessIds, setFetchedBusinessIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendorName, setSelectedVendorName] = useState('');
  const [status, setStatus] = useState('Rejected'); // Default status filter is "Pending"
  const [filteredOrder, setFilteredOrders] = useState<PurchaseOrderData[]>([]); // Explicit type declaration
  const [dialogDownloadOpen, setDialogDownloadOpen] = useState(false);
  const [dialogSummaryOpen, setDialogSummaryOpen] = useState(false);
  const currentPage = useSelector(selectCurrentPage);
  const pageSize = useSelector(selectPageSize);
  const totalItems = useSelector(selectTotalItems);
  const newPage = useSelector(selectCurrentPage);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null); // Allow anchorEl to be null or an HTMLElement
  const [selectionRange, setSelectionRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    key: 'selection',
  });
  const [open, setOpen] = useState(false);
  const [anchorElDate, setAnchorElDate] = useState<null | HTMLElement>(null);
  const [selectedVendor, setSelectedVendor] = useState<VendorSearch | null>(null);
  const [selectedRandomId, setSelectedRandomId] = useState('');
  const dateField = 'rejectedDate'; // You can dynamically set this if you want to switch between orderDate, approvedDate, or rejectedDate
  const fromDate = moment().utc().startOf('day').toDate(); // Start of the day (in UTC)
  const toDate = moment().utc().endOf('day').toDate(); // End of the day (in UTC)
  const [skip, setSkip] = useState<number>(0);
  const [limit, setLimit] = useState<number>(50);
  const [allItems, setAllItems] = useState<PurchaseItemSearch[]>([]);
  const [newItem, setNewItem] = useState<PurchaseItemSearch | null>(null);
  const [newItemId, setNewItemId] = useState<string>('');
  const [shouldFetch, setShouldFetch] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  const filteredOrders = purchaseList.filter(order => order.poStatus === 'Rejected');

  useEffect(() => {
    if (shouldFetch && !loading) {
      const action = fetchPurchaseOrders({ page: newPage, size: pageSize, dateField: dateField });
      dispatch(action);
      setShouldFetch(false);
    }
  }, [dispatch, newPage, pageSize, status, shouldFetch, loading]);

  useEffect(() => {
    dispatch(fetchBusinesses());
    dispatch(POsearchPurchaseItems({ searchQuery: searchQueryItem, skip, limit }))
  }, [dispatch, searchQueryItem, skip, limit]);

  useEffect(() => {
    businesses.forEach((business) => {
      if (!fetchedBusinessIds.has(business.businessId)) {
        dispatch(fetchPhoto(business.businessId));
        setFetchedBusinessIds(prevSet => new Set(prevSet).add(business.businessId));
      }
    });
  }, [businesses, fetchedBusinessIds, dispatch]);

  useEffect(() => {
    // Assuming 'poData' is your purchase order data object
    if (selectedOrder) {
      // Set the total discount amount from your PO data
      setTotalDiscountPrice(selectedOrder.totalDiscount || 0);
      setTotalOrderAmountDiscount(selectedOrder.totalOrderAmount);
    }
  }, [selectedOrder]); // Make sure poData is in the dependency array if it's fetched or updated
  useEffect(() => {
    if (selectedOrder && selectedOrder.items) {
      let totalDiscount = 0;
      let totalAmount = 0;
      const taxes: TaxDetails = {};

      selectedOrder.items.forEach((item: Item) => {
        // Calculate discount (befTaxDiscount + afTaxDiscount)
        const itemDiscount = (item.befTaxDiscount || 0) + (item.afTaxDiscount || 0);
        totalDiscount += itemDiscount;

        // Calculate total amount
        const itemTotalPrice = item.pendingTotalPrice || 0;
        totalAmount += itemTotalPrice;

        // Calculate taxes
        if (item.taxType === 'cgst_sgst') {
          const cgstPercentage = (item.taxPercentage || 0) / 2;
          const sgstPercentage = (item.taxPercentage || 0) / 2;
          const cgstAmount = (cgstPercentage / 100) * (item.newPrice || 0) * (item.pendingTotalQuantity || 0);
          const sgstAmount = (sgstPercentage / 100) * (item.newPrice || 0) * (item.pendingTotalQuantity || 0);

          taxes[`CGST_${cgstPercentage}`] = {
            type: 'CGST',
            percentage: cgstPercentage,
            amount: (taxes[`CGST_${cgstPercentage}`]?.amount || 0) + cgstAmount,
          };
          taxes[`SGST_${sgstPercentage}`] = {
            type: 'SGST',
            percentage: sgstPercentage,
            amount: (taxes[`SGST_${sgstPercentage}`]?.amount || 0) + sgstAmount,
          };
        } else if (item.taxType === 'igst') {
          const igstPercentage = item.taxPercentage || 0;
          const igstAmount = (igstPercentage / 100) * (item.newPrice || 0) * (item.pendingTotalQuantity || 0);

          taxes[`IGST_${igstPercentage}`] = {
            type: 'IGST',
            percentage: igstPercentage,
            amount: (taxes[`IGST_${igstPercentage}`]?.amount || 0) + igstAmount,
          };
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
    // Use either the selected range if available or default date range
    const appliedFromDate = selectionRange?.startDate instanceof Date ? moment(selectionRange.startDate).startOf('day').toDate() : fromDate;
    const appliedToDate = selectionRange?.endDate instanceof Date ? moment(selectionRange.endDate).endOf('day').toDate() : toDate;

    // Dispatch pagination with the current filters or default date range
    dispatch(setPagination({ page: newPage, size: pageSize }));

    // Fetch the purchase orders with correct date range and filters
    dispatch(fetchPurchaseOrders({
      page: newPage,
      size: pageSize,
      vendorName: selectedVendorName || '',
      status: status || '',
      itemName: searchQueryItem || '',
      randomId: randomIdSearch || '',
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
  const handleVendorwiseClick = () => {
    setDialogDownloadOpen(true); // Perform vendorwise action
    handleCloseAnchor(); // Close the dropdown after the action
  };

  const handleItemwiseClick = () => {
    handleOpen(); // Perform itemwise action
    handleCloseAnchor(); // Close the dropdown after the action
  };
  // Handle input change and trigger search on Enter key press
  const handleSearchChangeRandomId = (e: React.ChangeEvent<{}>, newValue: string) => {
    dispatch(setRandomQueryItem(newValue)); // Update the Redux state with the new search query for randomId
  };
  const handleOpen = () => {
    setDialogSummaryOpen(true);
  };
  const handleClose = () => {
    setDialogSummaryOpen(false);
  };

  const handleOpenDeactivateDialog = (purchaseOrderId: string) => {
    console.log('Deactivate purchaseOrderId:', purchaseOrderId);
    setSelectedDeleteOrderState(purchaseOrderId); // Set the order ID directly
    setOpenDeleteDialog(true); // Open confirmation dialog
  };
  // Close delete dialog
  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false); // Close the delete confirmation dialog
  };

  const handleDelete = (purchaseOrderId: string) => {
    console.log('Deactivate purchaseOrderId:', purchaseOrderId);
    dispatch(deactivatePurchaseOrder(purchaseOrderId)); // Dispatch delete action with the selected purchaseOrderId
  };

  const handleConfirmDelete = () => {
    if (deleteOrder) { // Now using directly selected ID
      console.log('Confirming deactivate for purchaseOrderId:', deleteOrder);
      handleDelete(deleteOrder); // Pass the selected ID for deletion
      setOpenDeleteDialog(false); // Close dialog after confirmation
      setOpenDialog(false);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    let yOffset = 5;
    let totalPages = 1;

    const business = businesses.length > 0 ? businesses[0] : null;

    if (!business) {
      console.error('Business info not found!');
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
    const title = "Rejected Purchase Order Summary";
    const pageWidth = doc.internal.pageSize.width;
    const fontSize = doc.getFontSize();
    const titleWidth = doc.getStringUnitWidth(title) * fontSize / doc.internal.scaleFactor;
    const titleX = (pageWidth - titleWidth) / 2;
    doc.text(title, titleX, yOffset);
    doc.line(titleX, yOffset + 2, titleX + titleWidth, yOffset + 2);
    yOffset += 15;

    const totalOrderedAmount = (filteredOrders || []).reduce((sum, order) => {
      const pendingOrderAmount = order.pendingOrderAmount || 0;
      return sum + pendingOrderAmount;
    }, 0);

    const today = new Date();
    const currentDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

    doc.setFontSize(10);
    doc.text(`Total Ordered Amount: ${totalOrderedAmount.toFixed(2)}`, 14, yOffset);
    const dateWidth = doc.getStringUnitWidth(`Date: ${currentDate}`) * 10 / doc.internal.scaleFactor;
    const dateX = pageWidth - dateWidth - 14;
    doc.text(`Date: ${currentDate}`, dateX, yOffset);
    yOffset += 5;

    const headers = [["SNo", "PoId", "Vendor Name", "Total Items Quantity", "Ordered Date", "Total Order Amount"]];

    const rows = (filteredOrders || []).map((order, index) => {
      const totalItemsQuantity = Array.isArray(order.items) && order.items.length > 0
        ? order.items.reduce((sum, item) => sum + (item.pendingTotalQuantity || 0), 0)
        : 0;

      const totalOrderAmount = order.pendingOrderAmount || 0;
      const totalDiscount = order.pendingDiscountAmount || 0;
      const finalAmount = totalOrderAmount - totalDiscount;

      if (!order.randomId || !order.vendorName || !order.orderDate || totalOrderAmount <= 0) {
        return null;
      }

      return [
        (index + 1).toString(),
        order.randomId.toString(),
        order.vendorName.toString(),
        totalItemsQuantity.toString(),
        order.orderDate ? format(new Date(order.orderDate), 'dd-MM-yyyy') : '',
        finalAmount.toFixed(2).toString(),
      ];
    }).filter(row => row !== null);

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

    const pdfFilename = `RejectedPOVendorwise.pdf`;
    doc.save(pdfFilename);
    setDialogDownloadOpen(false);
  };

  const handleSearchChange = (event: any) => {
    setSearchQuery(event.target.value);
    setSelectedVendorName(event.target.value); // Update vendor name to filter
  };


  // Format the date using date-fns
  const formatDateTime = (date: Date): string => {
    return format(date, 'dd:MM:yyyy hh:mm a');
  };
  const handleViewDetailsClick = (orderId: string) => {
    const selectedOrder = purchaseList.find(order => order.purchaseOrderId === orderId);
    if (selectedOrder) {
      setSelectedOrderState(selectedOrder);
      setOpenDialog(true);
      setUpdatedItems(selectedOrder.items);
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedOrderState(null);
  };
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget as HTMLElement); // Cast event.currentTarget to HTMLElement
  };

  const handleCloseAnchor = () => {
    setAnchorEl(null); // Close the dropdown menu
  };

  const handleUpdateStatus = async (orderId: string) => {
    const selectedOrder = purchaseList.find(order => order.purchaseOrderId === orderId);
    console.log('Selected Order:', selectedOrder); // Check the selectedOrder value
    if (selectedOrder) {
      dispatch(updatePurchaseOrderStatusToPending(selectedOrder.purchaseOrderId))
        .then(() => {
          dispatch(fetchPurchaseOrders({ page: newPage, size: pageSize, status }));
          setIsPending(!isPending); // Toggle the button state
        });
    }
    setOpenMovePendingDialog(false);
    handleCloseDialog();
  };

  const handleOpenMovePendingDialog = () => {
    setOpenMovePendingDialog(true);
  };
  const generateSummaryPDF = () => {
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
    doc.save('RejectedPOItemwise.pdf');
    handleClose();
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
  const title = 'Rejected Purchase Order Detailed Summary';
  const pageWidth = doc.internal.pageSize.width;
  const fontSize = doc.getFontSize();
  const titleWidth = doc.getStringUnitWidth(title) * fontSize / doc.internal.scaleFactor;
  const titleX = (pageWidth - titleWidth) / 2;
  doc.text(title, titleX, yOffset);
  doc.line(titleX, yOffset + 2, titleX + titleWidth, yOffset + 2);
  yOffset += 15;
  const totalOrderedAmount = (filteredOrders || []).reduce((sum, order) => {
    const pendingOrderAmount = order.pendingOrderAmount || 0;
    return sum + pendingOrderAmount;
  }, 0);
  const today = new Date();
  const currentDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
  doc.setFontSize(10);
  const totalText = `Total Ordered Amount: ${totalOrderedAmount.toFixed(2)}`;
  doc.text(totalText, 14, yOffset);
  const dateWidth = doc.getStringUnitWidth(`Date: ${currentDate}`) * 10 / doc.internal.scaleFactor;
  const dateX = pageWidth - dateWidth - 14;
  doc.text(`Date: ${currentDate}`, dateX, yOffset);
  yOffset += 10;
  const headers = [
    ['S.No', 'Purchase Order No', 'Vendor Name', 'Item Name', 'Quantity', 'Price', 'Tax', 'Discount', 'Final Price', 'Expiry Date'],
  ];
  const rows: (string | number)[][] = [];
  let sno = 1;
  (filteredOrders || []).forEach((order) => {
    (order.items || []).forEach((item) => {
      rows.push([
        sno++,
        order.randomId || 'N/A',
        order.vendorName || 'N/A',
        item.itemName || 'N/A',
        item.pendingTotalQuantity || 0,
        (item.pendingTotalPrice || 0).toFixed(2),
        `${item.taxPercentage || 0}%`,
        (item.pendingDiscountAmount || 0).toFixed(2),
        (item.pendingFinalPrice || 0).toFixed(2),
        item.expiryDate ? format(new Date(item.expiryDate), 'dd-MM-yyyy') : 'N/A',
      ]);
    });
  });
  if (rows.length === 0) {
    doc.setFontSize(10);
    doc.text('No rejected purchase orders found.', 14, yOffset);
    const finalTotalPages = doc.getNumberOfPages();
    for (let i = 1; i <= finalTotalPages; i++) {
      doc.setPage(i);
      addFooter(doc, i, finalTotalPages);
    }
    doc.save('RejectedPOItemwise.pdf');
    handleClose();
    return;
  }
  doc.autoTable({
    head: headers,
    body: rows,
    startY: yOffset,
    styles: {
      fontSize: 8,
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
  const pdfFilename = `RejectedPOItemwise.pdf`;
  doc.save(pdfFilename);
  handleClose();
};

 const handleDownload = async (poid: string) => {
  const purchaseOrder = purchaseList.find((order) => order.purchaseOrderId === poid);

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
  doc.setTextColor(0, 0, 128);
  doc.text('Rejected Order', 90, yOffset + 5);

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
     `Shipping Address: ${purchaseOrder.shippingAddress || ''}`,
     `PO No: ${purchaseOrder.randomId || ''}\n` +
     `PO Date: ${purchaseOrder.orderDate ? format(new Date(purchaseOrder.orderDate), 'dd-MM-yyyy') : 'Not Provided'}\n` +
     `Due Date: ${purchaseOrder.expectedDeliveryDate ? format(new Date(purchaseOrder.expectedDeliveryDate), 'dd-MM-yyyy') : 'Not Provided'}\n` +
     `Payment Terms: ${purchaseOrder.paymentTerms || ''}\n` +
     `Status: ${purchaseOrder.poStatus || ''}\n` +
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
      fillColor: [0, 0, 128],
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

  // Items Table Section
  const itemHeader = ['SI No', 'Description', 'HsnCode', 'Count', 'Qty', 'Rejected Qty', 'Unit Price', 'Tax', 'Amount'];
  const tableRows = purchaseOrder.items.map((item, index) => {
    const unitPrice = item.newPrice || 0;
    const quantity = item.pendingTotalQuantity || 0;
    const totalAmount = unitPrice * quantity;

    return [
      `${index + 1}`,
      item.itemName || 'Item Description',
      item.hsnCode,
      item.pendingCount || 'N/A',
      item.pendingQuantity || 'N/A',
      `${quantity} ${item.uom || 'Kgs'}`,
      `${unitPrice.toFixed(2)}`,
      `${item.taxPercentage || 0}%`,
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
      4: { halign: 'right' },
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

  // Tax Summary - Modified with multi-column layout
  const taxRates = {
    CGST: new Map<number, number>(),
    SGST: new Map<number, number>(),
    IGST: new Map<number, number>(),
  };

  // Calculate individual tax amounts
  purchaseOrder.items.forEach(item => {
    if (item.taxType === 'cgst_sgst') {
      const cgstAmount = (item.taxPercentage / 2) * item.newPrice * item.pendingTotalQuantity / 100;
      const sgstAmount = (item.taxPercentage / 2) * item.newPrice * item.pendingTotalQuantity / 100;
      taxRates.CGST.set(item.taxPercentage / 2, (taxRates.CGST.get(item.taxPercentage / 2) || 0) + cgstAmount);
      taxRates.SGST.set(item.taxPercentage / 2, (taxRates.SGST.get(item.taxPercentage / 2) || 0) + sgstAmount);
    } else if (item.taxType === 'igst') {
      const igstAmount = item.taxPercentage * item.newPrice * item.pendingTotalQuantity / 100;
      taxRates.IGST.set(item.taxPercentage, (taxRates.IGST.get(item.taxPercentage) || 0) + igstAmount);
    }
  });

  const totalWithoutTax = purchaseOrder.items.reduce((sum, item) => sum + (item.pendingTotalPrice ?? 0), 0);
  
  // Create tax summary with multi-column approach
  const taxSummary: any[] = [];
  
  // First row: Total Amount and Total Discount (right aligned)
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

  // Calculate overall tax totals
  const totalCGST = Array.from(taxRates.CGST.values()).reduce((sum, amount) => sum + amount, 0);
  const totalSGST = Array.from(taxRates.SGST.values()).reduce((sum, amount) => sum + amount, 0);
  const totalIGST = Array.from(taxRates.IGST.values()).reduce((sum, amount) => sum + amount, 0);

  // CGST Row - Individual breakdowns and total in one row
  const cgstBreakdown = Array.from(taxRates.CGST.entries())
    .map(([rate, amount]) => `CGST @${rate}%: ${amount.toFixed(2)}`)
    .join('   ');
  
  taxSummary.push([
    { content: cgstBreakdown, styles: { halign: 'left', fontStyle: 'bold' } },
    { content: 'Total CGST:', styles: { halign: 'left' } },
    { content: totalCGST.toFixed(2), styles: { fontStyle: 'bold' } }
  ]);

  // SGST Row - Individual breakdowns and total in one row
  const sgstBreakdown = Array.from(taxRates.SGST.entries())
    .map(([rate, amount]) => `SGST @${rate}%: ${amount.toFixed(2)}`)
    .join('   ');
  
  taxSummary.push([
    { content: sgstBreakdown, styles: { halign: 'left', fontStyle: 'bold' } },
     { content: 'Total SGST:', styles: { halign: 'left' } },
    { content: totalSGST.toFixed(2), styles: { fontStyle: 'bold' } }
  ]);

  // IGST Row - Individual breakdowns and total in one row
  const igstBreakdown = Array.from(taxRates.IGST.entries())
    .map(([rate, amount]) => `IGST @${rate}%: ${amount.toFixed(2)}`)
    .join('   ');
  
  taxSummary.push([
    { content: igstBreakdown, styles: { halign: 'left', fontStyle: 'bold' } },
     { content: 'Total IGST:', styles: { halign: 'left' } },
    { content: totalIGST.toFixed(2), styles: { fontStyle: 'bold' } }
  ]);

  // Final calculations
  const totalTaxAmount = totalCGST + totalSGST + totalIGST;
  const subtotalAfterDiscount = totalWithoutTax - (purchaseOrder.pendingDiscountAmount || 0);
  const totalWithTax = subtotalAfterDiscount + totalTaxAmount;

  const roundedTotalWithTax = totalWithTax.toFixed(2);
  const roundedTotalWithTaxInt = Math.round(totalWithTax);
  const roundOffAmount = (roundedTotalWithTaxInt - totalWithTax).toFixed(2);

  // Round Off Amount (right aligned)
  taxSummary.push([
    { content: '', styles: { halign: 'left' } },
          { content: 'Round Off Amount:', styles: { halign: 'left' } },
    { content: roundOffAmount, styles: { fontStyle: 'bold' } }
  ]);

  function capitalizeFirstLetter(str: string) {
    return str.replace(/\b\w/g, char => char.toUpperCase());
  }
  const amountInWords = capitalizeFirstLetter(toWords(roundedTotalWithTaxInt)) + ' only';
  
  // Amount in Words and Final Total (spanning multiple rows if needed)
  const wordsLines = doc.splitTextToSize(`Amount In Words: ${amountInWords}`, 120);
  const finalTotalLabel = 'Total [Including Tax]:';
  const finalTotalValue = roundedTotalWithTaxInt.toFixed(2);
  
  if (wordsLines.length === 1) {
    // Single line for amount in words
    taxSummary.push([
      { content: wordsLines[0], styles: { halign: 'left', fontStyle: 'bold' } },
      { content: finalTotalLabel, styles: { halign: 'left', fontStyle: 'bold' } },
      { content: finalTotalValue, styles: { fontStyle: 'bold' } }
    ]);
  } else {
    // Multiple lines for amount in words
    for (let i = 0; i < wordsLines.length; i++) {
      if (i === wordsLines.length - 1) {
        // Last line: include final total label and value
        taxSummary.push([
          { content: wordsLines[i], styles: { halign: 'left', fontStyle: 'bold' } },
          { content: finalTotalLabel, styles: { halign: 'left', fontStyle: 'bold' } },
          { content: finalTotalValue, styles: { fontStyle: 'bold' } }
        ]);
      } else {
        // Other lines: empty for columns 1 and 2
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
      1:{cellWidth :36,halign:'left'},
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

  // Terms & Conditions (Left Side)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Terms & Conditions', 10, yOffset);
  yOffset += 5;

  const staticTerms = [
    '1. Please quote our Purchase Order No. in your Delivery Note.',
    '2. Defective and excess quantity will not be accepted.',
    '3. Subject to Ramanathapuram Jurisdiction Only',
  ];

  const maxWidth = 90; // Width for text wrapping
  const lineHeight = 5; // Line height for consistent spacing

  // Static Terms
  staticTerms.forEach((term) => {
    const lines = doc.splitTextToSize(term, maxWidth);
    lines.forEach((line: string) => {
      doc.setFont('helvetica', 'normal');
      doc.text(line, 10, yOffset);
      yOffset += lineHeight;
    });
  });

  // Dynamic Terms
  let customTerms = purchaseOrder.termsandConditions;
  if (Array.isArray(customTerms)) {
    const validCustomTerms = customTerms.filter(term => typeof term === 'string' && term.trim().length > 0);
    if (validCustomTerms.length > 0) {
      yOffset += 2; // Small gap between static and dynamic terms
      validCustomTerms.forEach((term, index) => {
        const termNumber = staticTerms.length + index + 1;
        const customTermWithNumber = `${termNumber}. ${term.trim()}`;
        const termsLines = doc.splitTextToSize(customTermWithNumber, maxWidth);
        termsLines.forEach((line: string) => {
          doc.setFont('helvetica', 'normal');
          doc.text(line, 10, yOffset);
          yOffset += lineHeight;
        });
      });
    }
  } else {
    console.warn('termsandConditions is not an array or is invalid:', customTerms);
  }

  // Position for Authorized Signatory Image (right side below tax summary)
  const taxSummaryEndY = doc.autoTable.previous.finalY;
  const imageY = taxSummaryEndY + 10;
  const imageUrl = '/images/rejected.jpg';
  doc.addImage(imageUrl, 'JPEG', 150, imageY, 30, 25);

  // Declaration below terms
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

  // Authorized Signatory Text (Below Declaration, right aligned below image)
  const signatoryY = imageY + 35 + 10;
  doc.setFont('helvetica', 'bold');
  doc.text('Authorized Signatory', 130, signatoryY);

  // Update total pages and re-render footers
  const finalTotalPages = doc.getNumberOfPages();
  for (let i = 1; i <= finalTotalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, finalTotalPages);
  }

  doc.save(`${purchaseOrder.vendorName} ${purchaseOrder.randomId}.pdf`);
};
  const confirmMovePending = () => {
    // Logic to MovePending changes goes here
    handleUpdateStatus(selectedOrder.purchaseOrderId);
    console.log('Changes MovePending:', selectedOrder);
    setOpenMovePendingDialog(false);
  };

  const handleCloseDate = () => {
    setAnchorElDate(null);
  };
  const handleVendorChange = (vendor: VendorSearch | null) => {
    setSelectedVendor(vendor);
    setSelectedVendorName(vendor ? vendor.vendorName : '');
  };

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };
  // Handle input change and update the search query for items
  const handleSearchChangeItem = (newInputValue: string) => {
    setSearchQueryItem(newInputValue);
    setSkip(0); // Reset skip when search query changes
    setAllItems([]); // Clear all items when search query changes

    // Immediately fetch items with the new search query
    dispatch(POsearchPurchaseItems({ searchQuery: newInputValue, skip: 0, limit }))
      .unwrap()
      .then((newItems) => {
        setAllItems(newItems);
        setSkip(limit); // Set skip to limit for next fetch
      });
  };

  const handleItemSelect = (item: PurchaseItemSearch | null) => {
    if (item) {
      setNewItem(item);
      setNewItemId(item.purchaseitemId);
      // Set open state to false after selection
      setOpen(false);
    } else {
      setNewItem(null);
      setNewItemId('');
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
  // Scroll handler (unchanged)
  const handleScroll = (event: React.UIEvent<HTMLUListElement>) => {
    const target = event.currentTarget;
    if (target.scrollHeight - target.scrollTop === target.clientHeight) {
      loadMoreItems();
    }
  };
  const handleRandomIdChange = (randomId: string) => {
    setSelectedRandomId(randomId);
    // You can add additional logic here if needed
  };


  const handleFilterClick = () => {
    let filtered = purchaseList;

    // Ensure proper date handling with Date objects
    const formattedStartDate = selectionRange?.startDate instanceof Date ? moment(selectionRange.startDate).startOf('day').toDate() : fromDate;
    const formattedEndDate = selectionRange?.endDate instanceof Date ? moment(selectionRange.endDate).endOf('day').toDate() : toDate;

    // Apply frontend filters before the API call
    if (selectedVendorName) {
      filtered = filtered.filter(purchase =>
        purchase.vendorName?.toLowerCase().includes(selectedVendorName.toLowerCase())
      );
    }

    if (formattedStartDate) {
      filtered = filtered.filter(purchase => {
        const orderDateParsed = purchase.orderDate ? new Date(purchase.orderDate) : null;
        return orderDateParsed && orderDateParsed >= formattedStartDate;
      });
    }

    if (formattedEndDate) {
      filtered = filtered.filter(purchase => {
        const orderDateParsed = purchase.orderDate ? new Date(purchase.orderDate) : null;
        return orderDateParsed && orderDateParsed <= formattedEndDate;
      });
    }

    if (status) {
      filtered = filtered.filter(purchase => purchase.poStatus === status);
    }
    if (selectedRandomId) {
      filtered = filtered.filter(purchase => purchase.randomId == randomIdSearch);
    }
    console.log('Filtered Orders (Frontend):', filtered);

    // After frontend filters, dispatch the fetchPurchaseOrders action to fetch filtered data from the backend
    dispatch(fetchPurchaseOrders({
      page: newPage,                    // Assuming page is 1 for this example
      size: pageSize,                   // Example page size
      fromDate: formattedStartDate,  // Pass Date object directly
      toDate: formattedEndDate,      // Pass Date object directly
      vendorName: selectedVendorName || '',
      status: status || '',
      itemName: searchQueryItem || '', // Pass itemName filter if necessary
      randomId: selectedRandomId || '',
      dateField: dateField
    }))
      .then(response => {
        const data = response.payload || [];
        if (data.length === 0) {
          console.log('No matching orders found.');
          setSnackbarMessage('No matching orders found.');
          setSnackbarOpen(true);
        } else {
          setFilteredOrders(data); // Assuming you want to set the filtered data
        }
      })
      .catch(error => {
        console.error('Error fetching purchase orders:', error);
        setSnackbarMessage(error.message || 'Error fetching purchase orders');
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
    setSelectedVendor(null); // Clear vendor selection
    setNewItem(null); // Clear item search query
    setSelectedRandomId(''); // Clear randomId
    setStatus(''); // Clear status filter
    dispatch(fetchPurchaseOrders({ page: newPage, size: pageSize, dateField: dateField }));
  }
  const generateSummaryCSV = () => {
    const headers = ["S.No", "Purchase Order No", "Vendor Name", "Item Name", "Quantity", "Price", "Tax", "Discount", "Final Price"];

    const rows = (filteredOrders || []).map((order, index) => {
      return (order.items || []).map((item) => [
        (index + 1), // S.No
        order.randomId,
        order.vendorName,
        item.itemName,
        item.pendingTotalQuantity,
        item.pendingTotalPrice,
        `${item.taxPercentage}%`,
        item.discountAmount,
        item.pendingFinalPrice?.toFixed(2),
      ]);
    }).flat();

    const csvData = [headers, ...rows];  // Combine headers and rows

    // Use PapaParse to convert array to CSV string and trigger download
    const csv = Papa.unparse(csvData);

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "POReturnedItemwise.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    handleClose();
  };

  const handleExportCSV = (): void => {
    const csvContent = generateCSVContent();
    downloadCSV(csvContent, 'POReturnedVendorwise.csv');  // Name your CSV file
  };

  const generateCSVContent = (): string => {
    // Define the headers for the CSV
    const headers = 'S.No,PoId,Vendor Name,Total Items,Ordered Date,Total Order Amount\n';

    // Prepare the rows for purchase order summary (filter only valid orders)
    const rows = (filteredOrders || []).map((order, index) => {
      const totalItemsQuantity = Array.isArray(order.items) && order.items.length > 0
        ? order.items.reduce((sum, item) => sum + (item.pendingTotalQuantity || 0), 0)
        : 0;

      const pendingOrderAmount = order.pendingOrderAmount || 0;
      const pendingDiscountAmount = order.pendingDiscountAmount || 0;
      const finalAmount = pendingOrderAmount - pendingDiscountAmount;

      // Skip invalid rows
      if (!order.randomId || !order.vendorName || !order.orderDate || pendingOrderAmount <= 0) {
        return null;
      }

      // Create CSV row for the current order
      return [
        (index + 1), // S.No
        order.randomId,
        order.vendorName,
        totalItemsQuantity,
        order.orderDate ? format(new Date(order.orderDate), 'dd-MM-yyyy') : '',
        finalAmount.toFixed(2)
      ].join(',');  // Join each value with a comma to create a CSV row
    }).filter(row => row !== null).join('\n');  // Filter out null rows and join with newline

    // Combine headers and rows into the final CSV content
    return `${headers}${rows}`;
  };

  const downloadCSV = (csvContent: string, fileName: string): void => {
    // Create a Blob from the CSV content
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    // Create a download link and trigger the CSV download
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();

    // Cleanup after the download is triggered
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDialogDownloadOpen(false);
  };
  if (loading) {
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
          {/* First Row: Purchase Order Links and Typography */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'nowrap',
              gap: 1,
            }}
          >
            {/* Purchase Order Links */}
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
                Rejected
              </Button>
            </Link>
            {/* <Grid container justifyContent="flex-end" >
                <Typography
                  sx={{
                    textAlign: 'left', // Align the text inside the box
                    color: '#333', // Text color
                    pl: 2,
                    pr: 2,
                    boxShadow: 3,
                    borderRadius: 1,
                    padding: '6px', // Padding to give it a message box feel
                    border: '1px solid #ccc', // Light border around the box
                    marginBottom: '16px', // Space from other elements
                    maxWidth: '300px', // Limit width for better message box look
                    whiteSpace: 'normal', // Allows the text to wrap into multiple lines
                    fontWeight: 'bold' // Use 'fontWeight' instead of 'fontStyle' for bold text
                  }}
                >
                  Description:<br />
                  All the purchase orders that have been <strong>Rejected</strong>.
                  You can edit them and move them back to <strong>Pending PO</strong>.
                </Typography>
              </Grid> */}
          </Box>

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
              {/* Date Range Dialog and OK Button */}
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
                    disabled={!filteredOrders || Object.keys(filteredOrders).length === 0}
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
                    <MenuItem onClick={handleVendorwiseClick}>Vendorwise</MenuItem>
                    <MenuItem onClick={handleItemwiseClick}>Itemwise</MenuItem>
                  </Menu>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Box>
        <TableContainer component={Paper} sx={{ maxHeight: '400px', overflowY: 'auto' }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell className='table-number-right'>S.No</TableCell>
                <TableCell>Order ID</TableCell>
                <TableCell>Vendor Name</TableCell>
                <TableCell>Order Date</TableCell>
                <TableCell className='table-number-right'>Total PO Items</TableCell>
                <TableCell className='table-number-right'>Total Price</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>View Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">No Rejected Data</TableCell> {/* Span across all columns */}
                </TableRow>
              ) : (
                filteredOrders.map((order, index) => {  // Add the index parameter here
                  const totalQuantity = Array.isArray(order.items) ? order.items.reduce((acc, item) => acc + item.pendingTotalQuantity, 0) : 0;
                  return (
                    <TableRow key={order.purchaseOrderId}>
                      <TableCell className='table-number-right'>{index + 1}</TableCell>
                      <TableCell>{order.randomId}</TableCell>
                      <TableCell>{order.vendorName}</TableCell>
                      <TableCell>{order.orderDate ? format(new Date(order.orderDate), 'dd-MM-yyyy') : ''}</TableCell> {/* Custom format */}
                      <TableCell className='table-number-right'>{totalQuantity}</TableCell>
                      <TableCell className='table-number-right'>{(order.pendingOrderAmount ?? 0).toFixed(2)}</TableCell>
                      <TableCell>{order.poStatus}</TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          {/* View Button with Eye Icon */}
                          <Tooltip title="View Details">
                            <IconButton
                              onClick={() => handleViewDetailsClick(order.purchaseOrderId)}
                              color="primary"
                              sx={{ mr: 1 }} // margin right to separate icons
                            >
                              <VisibilityIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Download">
                            <IconButton
                              color="primary"
                              onClick={() => handleDownload(order.purchaseOrderId)}
                            >
                              <PictureAsPdfIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Deactivate">
                            <IconButton
                              color="error"
                              onClick={() => handleOpenDeactivateDialog(order.purchaseOrderId)}
                            >
                              <BlockIcon />
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
      </Box>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth={false}
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
        }}>
        <DialogTitle sx={{
          fontWeight: 'bold',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: isFullScreen ? '16px 24px' : '16px' // Adjust padding for fullscreen
        }}>
          <span>Rejected Order Details {selectedOrder?.randomId ? `${selectedOrder.randomId}` : ''}</span>
          <span>Vendor Name:{selectedOrder?.vendorName || 'Unknown Vendor'}</span>
          <IconButton onClick={toggleFullScreen} color="primary" edge="end">
            {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{
          padding: isFullScreen ? '0 24px' : '20px', // Adjust content padding
          height: isFullScreen ? 'calc(100vh - 120px)' : 'auto', // Account for header/footer height
          overflow: 'auto'
        }}>
          <TableContainer
            component={Paper}
            sx={{
              maxHeight: 'calc(100vh - 250px)', // Dynamic height based on viewport
              overflowY: 'auto',
              width: '100%',
            }}
          >
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell className='table-number-right'>Item Id</TableCell>
                  <TableCell>Item Name</TableCell>
                  <TableCell>Uom</TableCell>
                  <TableCell className='table-number-right'>Pkt Count</TableCell>
                  <TableCell className='table-number-right'>Quantity</TableCell>
                  <TableCell className='table-number-right'>PO Quantity</TableCell>
                  <TableCell className='table-number-right'>Price</TableCell>
                  <TableCell className='table-number-right'>Discount</TableCell> {/* New column for total discount (befTax + afTax) */}
                  <TableCell className='table-number-right'>Tax Amount</TableCell> {/* New column for tax amount */}
                  <TableCell className='table-number-right'>Total Price</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedOrder?.items?.length === 0 || !selectedOrder?.items ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">No Items Available</TableCell>
                  </TableRow>
                ) : (
                  selectedOrder.items.map((item: Item, index: number) => {
                    // Calculate item-wise discount (befTaxDiscount + afTaxDiscount)
                    const itemDiscount = (item.befTaxDiscount || 0) + (item.afTaxDiscount || 0);

                    // Calculate item-wise tax amount
                    let taxAmount = 0;
                    if (item.taxType === 'cgst_sgst') {
                      const cgstAmount = ((item.taxPercentage || 0) / 2 / 100) * (item.newPrice || 0) * (item.pendingTotalQuantity || 0);
                      const sgstAmount = ((item.taxPercentage || 0) / 2 / 100) * (item.newPrice || 0) * (item.pendingTotalQuantity || 0);
                      taxAmount = cgstAmount + sgstAmount;
                    } else if (item.taxType === 'igst') {
                      taxAmount = ((item.taxPercentage || 0) / 100) * (item.newPrice || 0) * (item.pendingTotalQuantity || 0);
                    }

                    return (
                      <TableRow key={item.itemId}>
                        <TableCell className='table-number-right'>{index + 1}</TableCell>
                        <TableCell>{item.itemName || 'N/A'}</TableCell>
                        <TableCell>{item.uom || 'N/A'}</TableCell>
                        <TableCell className='table-number-right'>{item.pendingCount || 0}</TableCell>
                        <TableCell className='table-number-right'>{item.pendingQuantity || 0}</TableCell>
                        <TableCell className='table-number-right'>{item.poQuantity || 0}</TableCell>
                        <TableCell className='table-number-right'>{(item.newPrice || 0).toFixed(2)}</TableCell>
                        <TableCell className='table-number-right'>{itemDiscount.toFixed(2)}</TableCell>
                        <TableCell className='table-number-right'>{taxAmount.toFixed(2)}</TableCell>
                        <TableCell className='table-number-right'>{(item.pendingTotalPrice || 0).toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
                {/* Summary Rows */}
                <TableRow>
                  <TableCell colSpan={9} align="right"><strong>Total Discount:</strong></TableCell>
                  <TableCell colSpan={3}>{totalDiscountPrice.toFixed(2)}</TableCell>
                </TableRow>
                {Object.entries(taxDetails).map(([key, tax]) => (
                  <TableRow key={key}>
                    <TableCell colSpan={9} align="right">
                      <strong>{tax.type} ({tax.percentage.toFixed(2)}%):</strong>
                    </TableCell>
                    <TableCell colSpan={3}>{tax.amount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={9} align="right"><strong>Total Order Amount:</strong></TableCell>
                  <TableCell colSpan={3}>{totalOrderAmount.toFixed(2)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Box display="flex" justifyContent="flex-end" mt={1}>
            <Box sx={{ mr: 2 }}>
              <Button variant="contained" onClick={handleOpenMovePendingDialog}>
                Move to Pending PO
              </Button>
            </Box>
          </Box>
        </DialogActions>
      </Dialog>
      {/* Confirmation Dialog for Deleting PO */}
      <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Confirm Delete Purchase Order</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to Deactivated this Purchase Order permanently? Once Deactiavted, it cannot be recovered.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error">
            Deactivated Permanently
          </Button>
        </DialogActions>
      </Dialog>
      {/* MovePending Confirmation Dialog */}
      <Dialog open={openMovePendingDialog} onClose={() => setOpenMovePendingDialog(false)}>
        <DialogTitle>Confirm Pending</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to Move to Pending this PO?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenMovePendingDialog(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={confirmMovePending} color="primary">
            Confirm
          </Button>
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
            onClick={generatePDF}
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
            onClick={generateSummaryCSV}
            variant="contained"
            color="secondary"
            startIcon={<DescriptionIcon />}
          >
            Export Excel
          </Button>

          {/* Generate PDF Button */}
          <Button
            onClick={generateSummaryPDF}
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

export default React.memo(RejectedPo);