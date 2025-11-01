"use client";
import React, { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Button, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Typography, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Grid, TextField, CircularProgress, IconButton, Snackbar, Paper, Tooltip, Menu,
  MenuItem, Autocomplete,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ClearIcon from "@mui/icons-material/Clear";
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { AppDispatch, RootState } from '../../../../redux/store';
import {
  fetchReturnedGrns,
  setSearchQuery,
  setSelectedGrnId,
  fetchRandomNumbers,
  selectGrn,
  updateGrnCancelStatus,
  setSnackbarOpenGRN,
  setSnackbarMessageGRN,
  clearSnackbarMessage,
  selectCurrentPage,
  selectPageSize,
  selectTotalItems,
  setPagination,
} from '../../../../features/yen-purchase/GRN/grnSlice';
import YenPurchasePage from '../../page';
import Link from 'next/link';
import { FetchGrnsReturnPayload, GrnData, ItemDetail, ReturnHistory } from '@/Models/grnModel';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { fetchBusinesses, fetchPhoto, selectBusinesses } from '@/features/account-setting/businessSlice';
import { selectPurchaseOrderState } from '@/features/yen-purchase/PurchaseOrder/purchaseOrderSlice';
import { addDays, format } from 'date-fns';
import Papa from 'papaparse';
import DateRangeDialog from '@/components/dateRange';
import moment from 'moment';
import VendorSearchAutocomplete from '@/components/vendorsearchautocomplete';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { VendorSearch } from '@/Models/vendor';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';

const GrnReturn: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { purchaseorders, loading, error, snackbarOpenGRN, snackbarMessageGRN, itemwise } = useSelector(selectGrn);
  const { businesses } = useSelector(selectBusinesses);
  // const { vendors } = useSelector(selectPurchaseOrderState);
  const selectedGrnId = useSelector((state: RootState) => state.grn.selectedGrnId);
  const [viewItemsDialogOpen, setViewItemsDialogOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<null | (() => void)>(null);
  const [totalReturnedAmount, setTotalReturnedAmount] = useState<number>(0);
  const [totalDiscount, setTotalDiscount] = useState<number>(0);
  const [fetchedBusinessIds, setFetchedBusinessIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendorName, setSelectedVendorName] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<VendorSearch | null>(null);
  const [filteredGrn, setFilteredGrn] = useState<GrnData[]>([]);
  const [dialogDownloadOpen, setDialogDownloadOpen] = useState(false);
  const [dialogSummaryOpen, setDialogSummaryOpen] = useState(false);
  const currentPage = useSelector(selectCurrentPage);
  const pageSize = useSelector(selectPageSize);
  const totalItems = useSelector(selectTotalItems);
  const newPage = useSelector(selectCurrentPage);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [anchorElDownload, setAnchorElDownload] = useState<null | HTMLElement>(null);
  const [selectionRange, setSelectionRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    key: 'selection',
  });
  const dateField = 'grnReturnedDate' as const;
  const fromDate = moment().utc().startOf('day').toDate();
  const toDate = moment().utc().endOf('day').toDate();
  const [shouldFetch, setShouldFetch] = useState(true);

  // Memoize dependencies
  const memoizedFromDate = useMemo(() => fromDate, [fromDate]);
  const memoizedToDate = useMemo(() => toDate, [toDate]);

  useEffect(() => {
    console.log('useEffect triggered with:', {
      newPage,
      pageSize,
      dateField,
      fromDate: memoizedFromDate,
      toDate: memoizedToDate,
      loading,
      shouldFetch,
    });
    if (shouldFetch && !loading) {
      const action = fetchReturnedGrns({
        page: newPage,
        size: pageSize,
        dateFilterField: dateField,
        fromDate: memoizedFromDate,
        toDate: memoizedToDate,
      });
      console.log('Action payload:', action);
      dispatch(action);
      setShouldFetch(false);
    }
  }, [
    dispatch,
    newPage,
    pageSize,
    dateField,
    memoizedFromDate,
    memoizedToDate,
    loading,
    shouldFetch,
  ]);

  useEffect(() => {
    dispatch(fetchRandomNumbers());
  }, [dispatch]);

  const selectedGrn = itemwise.find(grn => grn.grnId === selectedGrnId);

  useEffect(() => {
    if (selectedGrn) {
      setTotalDiscount(selectedGrn.totalReturnedDiscount || 0);
      setTotalReturnedAmount(selectedGrn.totalReturnedAmount || 0);
    }
  }, [selectedGrn]);

  useEffect(() => {
    let isMounted = true;
    if (isMounted) {
      dispatch(fetchBusinesses());
    }
    return () => {
      isMounted = false;
    }
  }, [dispatch]);

  useEffect(() => {
    businesses.forEach((business) => {
      if (!fetchedBusinessIds.has(business.businessId)) {
        dispatch(fetchPhoto(business.businessId));
        setFetchedBusinessIds(prevSet => new Set(prevSet).add(business.businessId));
      }
    });
  }, [businesses, fetchedBusinessIds, dispatch]);

  const handleSearchChange = (event: React.ChangeEvent<{}>, newValue: string) => {
    setSearchQuery(newValue);
  };
const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };
  const handleVendorSelect = (vendor: VendorSearch | null) => {
    if (vendor) {
      setSelectedVendor(vendor);
      setSelectedVendorName(vendor.vendorName);
    } else {
      setSelectedVendor(null);
      setSelectedVendorName('');
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > Math.ceil(totalItems / pageSize)) {
      return;
    }
    dispatch(setPagination({ page: newPage, size: pageSize }));
    dispatch(fetchReturnedGrns({ page: newPage, size: pageSize, status, fromDate, toDate }));
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

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorElDownload(event.currentTarget as HTMLElement);
  };

  const handleCloseAnchor = () => {
    setAnchorElDownload(null);
  };

  const handleVendorwiseClick = () => {
    setDialogDownloadOpen(true);
    handleCloseAnchor();
  };

  const handleItemwiseClick = () => {
    setDialogSummaryOpen(true);
    handleCloseAnchor();
  };

  const handleExportCSV = () => {
    const headers = [
      "S.No",
      "GRN No",
      "Vendor Name",
      "Total Items",
      "GRN Date",
      "Total Returned Amount",
      "Final Amount"
    ];

    const rows = (filteredGrn.length > 0 ? filteredGrn : itemwise).map((grn, index) => {
      const totalItemsQuantity = Array.isArray(grn.itemDetails) && grn.itemDetails.length > 0
        ? grn.itemDetails.reduce((sun, item) => sun + (item.returnedQuantity || 0), 0)
        : 0;

      const totalOrderAmount = grn.totalReturnedAmount || 0;
      const totalDiscount = grn.totalReturnedDiscount || 0;
      const finalAmount = totalOrderAmount - totalDiscount;

      if (!grn.randomId || !grn.vendorName || !grn.grnDate || totalOrderAmount <= 0) {
        return null;
      }

      return [
        `${index + 1}`,
        grn.randomId.toString(),
        grn.vendorName.toString(),
        totalItemsQuantity.toString(),
        grn.grnDate ? format(new Date(grn.grnDate), 'dd-MM-yyyy') : '',
        totalOrderAmount.toFixed(2).toString(),
        finalAmount.toFixed(2).toString(),
      ];
    }).filter(row => row !== null);

    const csvData = [headers, ...rows];
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "GRNSummary.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDialogDownloadOpen(false);
  };

  const handleGrnSelect = (grnId: string) => {
    dispatch(setSelectedGrnId(grnId));
    setViewItemsDialogOpen(true);
  };

  const handleCloseViewItemsDialog = () => {
    setViewItemsDialogOpen(false);
    dispatch(setSelectedGrnId(null));
  };

  const handleOpen = () => {
    setDialogSummaryOpen(true);
  };

  const handleClose = () => {
    setDialogSummaryOpen(false);
  };

  const getRandomId = (purchaseOrderId: string): string | undefined => {
    const order = purchaseorders.find(po => po.purchaseOrderId === purchaseOrderId);
    return order?.randomId;
  };

  const handleOpenDialog = (action: () => void) => {
    setDialogAction(() => action);
    setDialogOpen(true);
  };

  const handleCancelAp = (grnId: string) => {
    handleOpenDialog(() => {
      dispatch(updateGrnCancelStatus(grnId));
    });
    setViewItemsDialogOpen(false);
  };

  const handleFilterClick = () => {
    const formattedStartDate = selectionRange?.startDate instanceof Date
      ? moment(selectionRange.startDate).startOf('day').toDate()
      : fromDate;
    const formattedEndDate = selectionRange?.endDate instanceof Date
      ? moment(selectionRange.endDate).endOf('day').toDate()
      : toDate;

    dispatch(
      fetchReturnedGrns({
        page: newPage,
        size: pageSize,
        fromDate: formattedStartDate instanceof Date ? formattedStartDate : undefined,
        toDate: formattedEndDate instanceof Date ? formattedEndDate : undefined,
        vendorName: selectedVendorName || '',
        status: status || '',
        dateFilterField: dateField,
      })
    )
      .unwrap()
      .then((payload: FetchGrnsReturnPayload) => {
        const data = payload.grns || [];
        if (data.length === 0) {
          setSnackbarMessageGRN('No matching GRN found.');
          setSnackbarOpenGRN(true);
        } else {
          setFilteredGrn(data);
        }
      })
      .catch((error: any) => {
        setSnackbarMessageGRN(error.message || 'Error fetching GRN');
        setSnackbarOpenGRN(true);
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
    dispatch(fetchReturnedGrns({ page: newPage, size: pageSize, status, dateFilterField: dateField, fromDate, toDate }));
    setFilteredGrn([]);
  };
const generatePDF = () => {
  const doc = new jsPDF();
  let yOffset = 10;

  const business = businesses.length > 0 ? businesses[0] : null;

  if (!business) {
    console.error('Business info not found!');
    return;
  }

  if (business.imageUrl) {
    try {
      doc.addImage(business.imageUrl, 'JPEG', 10, yOffset - 5, 20, 20);
    } catch (e) {
      console.error("Image failed to load:", e);
    }
  }

  doc.setFontSize(12);
  const title = "Returned GRN Order Summary";
  const pageWidth = doc.internal.pageSize.width;
  const logoWidth = 20;
  const logoOffsetX = 10;
  const titleStartX = logoOffsetX + logoWidth + 5;
  const titleWidth = doc.getStringUnitWidth(title) * 12 / doc.internal.scaleFactor;
  const centerX = (pageWidth - titleStartX) / 2 + titleStartX - titleWidth / 2;

  doc.text(title, centerX, yOffset);
  doc.setLineWidth(0.5);
  doc.line(centerX, yOffset + 2, centerX + titleWidth, yOffset + 2);
  yOffset += 15;

  const today = new Date();
  const currentDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

  const totalReceivedAmount = (filteredGrn.length > 0 ? filteredGrn : itemwise).reduce((sum, order) => {
    const totalOrderAmount = order.totalReceivedAmount || 0;
    return sum + totalOrderAmount;
  }, 0);

  doc.setFontSize(10);
  const dateX = 10;
  const totalReceivedX = pageWidth - 10 - doc.getStringUnitWidth(`Total Returned: ${totalReceivedAmount.toFixed(2)}`) * 10 / doc.internal.scaleFactor;

  doc.text(`Date: ${currentDate}`, dateX, yOffset);
  doc.text(`Total Returned: ${totalReceivedAmount.toFixed(2)}`, totalReceivedX, yOffset);
  yOffset += 10;

  const headers = [
    ["S.No", "GrnId", "Vendor Name", "Total Items Quantity", "Ordered Date", "Total Returned Amount"],
  ];

  const rows = (filteredGrn.length > 0 ? filteredGrn : itemwise).map((grn, index) => {
    const totalItemsQuantity = Array.isArray(grn.itemDetails) && grn.itemDetails.length > 0
      ? grn.itemDetails.reduce((sum, item) => sum + (item.returnedQuantity || 0), 0)
      : 0;

    const totalOrderAmount = grn.totalReturnedAmount || 0;
    const totalDiscount = grn.totalReturnedDiscount || 0;
    const finalAmount = totalOrderAmount - totalDiscount;

    if (!grn.randomId || !grn.vendorName || !grn.grnDate || totalOrderAmount <= 0) {
      return null;
    }

    return [
      `${index + 1}`,
      grn.randomId.toString(),
      grn.vendorName.toString(),
      totalItemsQuantity.toString(),
      grn.grnDate ? format(new Date(grn.grnDate), 'dd-MM-yyyy') : '',
      finalAmount.toFixed(2).toString(),
    ];
  }).filter(row => row !== null);

  doc.autoTable({
    head: headers,
    body: rows,
    startY: 30,
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
      4: { halign: 'right' },
    }
  });

  // Add page numbers and computer generated note to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    const pageWidth = doc.internal.pageSize.width;
    const pageCenterX = pageWidth / 2;
    const bottomY = doc.internal.pageSize.height - 10;
    const computerGeneratedY = bottomY - 5;

    // Add "This is computer generated" centered above page number
    doc.text("This is computer generated", pageCenterX, computerGeneratedY, { align: 'center' });

    // Add page number centered below
    doc.text(`Page ${i} of ${totalPages}`, pageCenterX, bottomY, { align: 'center' });
  }

  const pdfFilename = `GrnReturn.pdf`;
  doc.save(pdfFilename);
  setDialogDownloadOpen(false);
};


  const generateSummaryCSV = () => {
    const headers = [
      "S.No", "GRN No", "Vendor Name", "Item Name", "Total Quantity", "Returned Quantity", "Price", "Tax", "Discount", "Final Price", "Return History"
    ];
    const rows = (filteredGrn.length > 0 ? filteredGrn : itemwise).flatMap((grn, index) =>
      (grn.itemDetails || []).map((item) => {
        const returnHistoryText = Array.isArray(item.returnHistory) && item.returnHistory.length > 0
          ? item.returnHistory.map((history, idx) =>
              `Return ${idx + 1}: Date: ${history.date ? format(new Date(history.date), 'dd-MM-yyyy HH:mm:ss') : 'N/A'}, By: ${history.by }, Qty: ${history.totalUnits || 0} ${item.uom }, Reason: ${history.reason }`
            ).join('; ')
          : 'No return history';
        return [
          `${index + 1}`,
          grn.randomId ,
          grn.vendorName ,
          item.itemName ,
          item.quantity || 0,
          item.returnedQuantity || 0,
          (item.unitPrice || 0).toFixed(2),
          `${item.purchasetaxName || 0}%`,
          item.discount || 0,
          ((item.unitPrice || 0) * (item.returnedQuantity || 0) * (1 - (item.discount || 0) / 100)).toFixed(2),
          returnHistoryText,
        ];
      })
    );

    const csv = Papa.unparse([headers, ...rows]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", "ReturnedGRNItemwise.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDialogSummaryOpen(false);
  };

const generateSummaryPDF = () => {
  const doc = new jsPDF();
  let yOffset = 10;
  const business = businesses.length > 0 ? businesses[0] : null;

  if (!business) {
    dispatch(setSnackbarMessageGRN('Business info not found!'));
    dispatch(setSnackbarOpenGRN(true));
    return;
  }

  if (business.imageUrl) {
    try {
      doc.addImage(business.imageUrl, 'JPEG', 14, yOffset, 20, 20);
    } catch (e) {
      console.error("Image failed to load:", e);
    }
  }

  yOffset += 10;
  doc.setFontSize(12);
  const title = "Returned GRN Order Detailed Summary";
  const pageWidth = doc.internal.pageSize.width;
  const titleWidth = doc.getStringUnitWidth(title) * 12 / doc.internal.scaleFactor;
  doc.text(title, (pageWidth - titleWidth) / 2, yOffset);
  doc.setLineWidth(0.1);
  doc.line((pageWidth - titleWidth) / 2, yOffset + 2, (pageWidth + titleWidth) / 2, yOffset + 2);
  yOffset += 15;

  const today = new Date();
  const currentDate = format(today, 'dd/MM/yyyy');
  const totalReturnedAmount = (filteredGrn.length > 0 ? filteredGrn : itemwise).reduce((sum, order) => sum + (order.totalReturnedAmount || 0), 0);

  doc.setFontSize(10);
  doc.text(`Total Returned Amount: ${totalReturnedAmount.toFixed(2)}`, 14, yOffset);
  doc.text(`Date: ${currentDate}`, pageWidth - 50, yOffset);
  yOffset += 10;

  const headers = [
    ["S.No", "GRN No", "Vendor Name", "Item Name", "ReceivedQuantity", "Returned", "Price", "Tax", "Discount", "Final Price"],
  ];
  const rows = (filteredGrn.length > 0 ? filteredGrn : itemwise).flatMap((grn, index) =>
    (grn.itemDetails || []).map((item) => {
      return [
        `${index + 1}`,
        grn.randomId ,
        grn.vendorName ,
        item.itemName ,
        item.receivedQuantity || 0,
        item.returnedQuantity || 0,
        (item.unitPrice || 0).toFixed(2),
        `${item.purchasetaxName || 0}%`,
        item.discount || 0,
        ((item.unitPrice || 0) * (item.returnedQuantity || 0) * (1 - (item.discount || 0) / 100)).toFixed(2),
      ];
    })
  );

  doc.autoTable({
    head: headers,
    body: rows,
    startY: yOffset,
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [0, 0, 128], textColor: [255, 255, 255] },
    bodyStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0] },
    columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' }, 10: { cellWidth: 60 } },
  });

  // Add page numbers and computer generated note to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    const pageWidth = doc.internal.pageSize.width;
    const pageCenterX = pageWidth / 2;
    const bottomY = doc.internal.pageSize.height - 10;
    const computerGeneratedY = bottomY - 5;

    // Add "This is computer generated" centered above page number
    doc.text("This is computer generated", pageCenterX, computerGeneratedY, { align: 'center' });

    // Add page number centered below
    doc.text(`Page ${i} of ${totalPages}`, pageCenterX, bottomY, { align: 'center' });
  }

  doc.save('ReturnedGRNItemwise.pdf');
  setDialogSummaryOpen(false);
};

  const handleVendorChange = (vendor: VendorSearch | null) => {
    setSelectedVendor(vendor);
    setSelectedVendorName(vendor ? vendor.vendorName : '');
  };

  const handleDownload = async (grnId: string) => {
  console.log('handleDownload called with grnId:', grnId);
  const grn = itemwise.find((g) => g.grnId === grnId);
  if (!grn) {
    dispatch(setSnackbarMessageGRN('GRN not found!'));
    dispatch(setSnackbarOpenGRN(true));
    return;
  }

  const business = businesses.length > 0 ? businesses[0] : null;
  if (!business) {
    dispatch(setSnackbarMessageGRN('Business info not found!'));
    dispatch(setSnackbarOpenGRN(true));
    return;
  }

  const doc = new jsPDF();
  let yOffset = 10;

  // Add business logo
  if (business.imageUrl) {
    try {
      doc.addImage(business.imageUrl, 'JPEG', 35, yOffset, 25, 25);
    } catch (e) {
      console.error("Image failed to load:", e);
    }
  }

  // Add header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 128);
  doc.text('Goods Receipt Note - Return History', 90, yOffset + 5);
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(business.companyName , 90, yOffset + 10);
  doc.setFontSize(8);
  doc.text(business.address1 , 90, yOffset + 15);
  doc.text(`Tel.No: ${business.phoneNo }`, 90, yOffset + 20);
  doc.text(`E-Mail: ${business.emailId }`, 90, yOffset + 25);
  doc.text(`GSTIN: ${business.gstIn }`, 90, yOffset + 30);
  yOffset += 40;

  // Add GRN details
  const createdDate = grn.createdDate ? new Date(grn.createdDate) : new Date('2025-06-30');
  const paymentTermsDays = grn.paymentTerms ? parseInt(grn.paymentTerms, 10) : 15;
  const dueDate = addDays(createdDate, paymentTermsDays);

  const columnWidth = 60.6;
  const tableHeader = [['Vendor Details', 'Billing Address', 'GRN Details']];
  const vendorDetailsRows = [[
    `Name: ${grn.vendorName  || ''}\nGSTIN: ${grn.gstNumber || '' }\nAddress: ${grn.address || ''}\nCity: ${grn.city || ''}\nState: ${grn.state || ''}\nCountry: ${grn.country || ''}\nEmail: ${grn.contactpersonEmail || ''}`,
    `Billing Address: ${grn.billingAddress || ''}`,
    `Po No: ${grn.poRandomID }\nGRN No: ${grn.randomId }\nGRN Date: ${grn.createdDate ? format(new Date(grn.createdDate), 'dd-MM-yyyy') : 'N/A'}\nPayment Terms: ${grn.paymentTerms || '15'} \nDue Date: ${format(dueDate, 'dd-MM-yyyy')}\nCurrency: INR`,
  ]];

  doc.autoTable({
    head: tableHeader,
    body: vendorDetailsRows,
    startY: yOffset,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 4, halign: 'left', valign: 'top', overflow: 'linebreak' },
    columnStyles: { 0: { cellWidth: columnWidth }, 1: { cellWidth: columnWidth }, 2: { cellWidth: columnWidth } },
    headStyles: { fillColor: [0, 0, 128], textColor: [255, 255, 255], fontStyle: 'bold' },
    bodyStyles: { lineWidth: 0.1, lineColor: [0, 0, 0], minCellHeight: 15 },
  });

  yOffset = doc.autoTable.previous.finalY;

  // Add items table matching dialog structure
  const itemHeader = ['Item Name', 'UOM', 'Quantity', 'Returned Quantity', 'Unit Price', 'Return Date', 'Returned By', 'Return Quantity', 'Reason'];
  const itemRows = (grn.itemDetails || [])
    .filter(item => item.returnedQuantity > 0 && Array.isArray(item.returnHistory) && item.returnHistory.length > 0)
    .flatMap((item, index) =>
      (item.returnHistory || []).map((history, historyIndex) => [
        item.itemName ,
        item.uom ,
        (item.quantity || 0).toString(),
        (item.returnedQuantity || 0).toString(),
        (item.unitPrice || 0).toFixed(2),
        history.date ? format(new Date(history.date), 'dd-MM-yyyy HH:mm:ss') : 'N/A',
        history.by ,
        `${history.totalUnits || 0} ${item.uom }`,
        history.reason ,
      ])
    );

  doc.autoTable({
    head: [itemHeader],
    body: itemRows,
    startY: yOffset,
    theme: 'grid',
    styles: { fontSize: 8, halign: 'center', cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [0, 0, 128], textColor: [255, 255, 255], lineWidth: { top: 0, right: 0.1, bottom: 0.1, left: 0.1 } },
    bodyStyles: { lineColor: [0, 0, 0], lineWidth: { top: 0, right: 0.1, bottom: 0, left: 0.1 } },
    columnStyles: {
      0: { halign: 'left' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      7: { halign: 'right' },
      8: { cellWidth: 40 },
    },
  });

  yOffset = doc.autoTable.previous.finalY;

  // Add tax summary using calculateTaxDetails
  const taxDetails = calculateTaxDetails();
  const taxSummary = [
    ['Total Discount', (grn.totalReturnedDiscount || 0).toFixed(2)],
    ...Object.entries(taxDetails).flatMap(([rate, { sgstAmount, cgstAmount, igstAmount }]) => {
      const rows = [];
      if (sgstAmount > 0 || cgstAmount > 0) {
        rows.push([`SGST (${(parseFloat(rate) / 2).toFixed(2)}%)`, sgstAmount.toFixed(2)]);
        rows.push([`CGST (${(parseFloat(rate) / 2).toFixed(2)}%)`, cgstAmount.toFixed(2)]);
      }
      if (igstAmount > 0) {
        rows.push([`IGST (${parseFloat(rate)}%)`, igstAmount.toFixed(2)]);
      }
      return rows;
    }),
    ['Final Returned Amount', (grn.totalReturnedAmount || 0).toFixed(2)],
  ];

  doc.autoTable({
    body: taxSummary,
    startY: yOffset,
    theme: 'grid',
    styles: { fontSize: 8, halign: 'right', cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 },
  });

  // Add declaration
  doc.text("Declaration:", 15, doc.autoTable.previous.finalY + 5);
  doc.text("We declare that this invoice shows the actual price of the described items and that all particulars are true and correct.", 15, doc.autoTable.previous.finalY + 10);
  doc.text("Authorized Signatory:", 120, doc.autoTable.previous.finalY + 18);
  doc.text("_____________________", 120, doc.autoTable.previous.finalY + 25);

  // Add page numbers and computer generated note to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    const pageWidth = doc.internal.pageSize.width;
    const pageCenterX = pageWidth / 2;
    const bottomY = doc.internal.pageSize.height - 10;
    const computerGeneratedY = bottomY - 5;

    // Add "This is computer generated" centered above page number
    doc.text("This is computer generated", pageCenterX, computerGeneratedY, { align: 'center' });

    // Add page number centered below
    doc.text(`Page ${i} of ${totalPages}`, pageCenterX, bottomY, { align: 'center' });
  }

  doc.save(`${grn.vendorName} ${grn.randomId}_ReturnHistory.pdf`);
};

    const calculateItemTotal = (receivedQuantity: number, damagedQuantity: number, unitPrice: number): number => {
    const netQuantity = receivedQuantity - damagedQuantity;
    return netQuantity * unitPrice;
  };

  const calculateTaxDetails = () => {
    let taxDetails: { [key: string]: { sgstAmount: number; cgstAmount: number; igstAmount: number } } = {};

    selectedGrn?.itemDetails.forEach(item => {
      let totalPrice = calculateItemTotal(item.receivedQuantity, item.damagedQuantity || 0, item.unitPrice);

      if (item.befTaxDiscount) {
        totalPrice -= item.befTaxDiscountAmount || 0;
      }

      const taxRate = item.purchasetaxName || 0;
      const taxType = item.taxType || '';

      let taxAmount = (taxRate / 100) * totalPrice;

      if (!taxDetails[taxRate]) {
        taxDetails[taxRate] = { sgstAmount: 0, cgstAmount: 0, igstAmount: 0 };
      }

      if (taxType === 'cgst_sgst') {
        taxDetails[taxRate].sgstAmount += taxAmount / 2;
        taxDetails[taxRate].cgstAmount += taxAmount / 2;
      } else if (taxType === 'igst') {
        taxDetails[taxRate].igstAmount += taxAmount;
      }

      if (item.afTaxDiscount) {
        taxDetails[taxRate].sgstAmount -= (item.afTaxDiscountAmount || 0) / 2;
        taxDetails[taxRate].cgstAmount -= (item.afTaxDiscountAmount || 0) / 2;
        taxDetails[taxRate].igstAmount -= item.afTaxDiscountAmount || 0;
      }
    });

    return taxDetails;
  };

  const taxDetails = calculateTaxDetails();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Typography>Error: {error}</Typography>;
  }

  return (
    <Box>
      <YenPurchasePage />
      <Box sx={{ px: 1, backgroundColor: 'white' }}>
        <Box mb={1}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Box display="flex" alignItems="center">
              <Link href="/yen-purchase/GrnPage" passHref>
                <Button variant="contained" color="primary" sx={{ mr: 1, ml: 1 }}>
                  GRN List
                </Button>
              </Link>
              <Link href="/yen-purchase/GrnPage/GrnReturn" passHref>
                <Button
                  variant="contained"
                  sx={{
                    backgroundColor: 'white',
                    color: 'black',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    },
                    mr: 2,
                  }}
                >
                  Return GRN
                </Button>
              </Link>
            </Box>
          </Box>
          <Grid container alignItems="center" spacing={0.5} wrap="nowrap" ml={0.5}>
            <Grid item>
              <DateRangeDialog
                selectionRange={selectionRange}
                setSelectionRange={setSelectionRange}
                onApply={handleFilterClick}
              />
            </Grid>
            <Grid item xs={2}>
              <VendorSearchAutocomplete
                value={selectedVendor}
                onChange={handleVendorChange}
                label="Vendor Name"
              />
            </Grid>
            <Grid item>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <IconButton
                  color="primary"
                  className="icon-button-outline"
                  onClick={handleFilterClick}
                  disabled={loading}
                  size="small"
                  sx={{ p: 0.3 }}
                >
                  <FilterAltIcon fontSize="small" />
                </IconButton>
                <Typography
                  variant="caption"
                  align="center"
                  sx={{
                    maxWidth: 30,
                    wordBreak: 'break-word',
                    lineHeight: 1.1,
                    mt: 0.1,
                  }}
                >
                  Filter
                </Typography>
              </Box>
            </Grid>
            <Grid item>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <IconButton
                  className="icon-button-outline"
                  color="primary"
                  onClick={handleFilterClose}
                  disabled={loading}
                  size="small"
                  sx={{ p: 0.3 }}
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
                <Typography
                  variant="caption"
                  align="center"
                  sx={{
                    maxWidth: 30,
                    wordBreak: 'break-word',
                    lineHeight: 1.1,
                    mt: 0.1,
                  }}
                >
                  Clear
                </Typography>
              </Box>
            </Grid>
            <Grid item sx={{ flexGrow: 1 }} />
            <Grid item>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <IconButton
                  onClick={handleClick}
                  color="primary"
                  className="icon-button-outline"
                  disabled={!itemwise || itemwise.length === 0}
                  size="small"
                  sx={{ p: 0.3 }}
                >
                  {loading ? 'Loading...' : <DownloadIcon fontSize="small" />}
                </IconButton>
                <Typography
                  variant="caption"
                  align="center"
                  sx={{
                    maxWidth: 50,
                    wordBreak: 'break-word',
                    lineHeight: 1.1,
                    mt: 0.1,
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
        </Box>
        <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 205px)', overflowY: 'auto', width: '100%', ml: 1 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>S.No</TableCell>
                <TableCell>GRN Id</TableCell>
                <TableCell>PO Id</TableCell>
                <TableCell>Vendor Name</TableCell>
                <TableCell>Order Date</TableCell>
                <TableCell>Total Items</TableCell>
                <TableCell>Total Quantity</TableCell>
                <TableCell>Returned Quantity</TableCell>
                <TableCell>Total Price</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">Loading...</TableCell>
                </TableRow>
              ) : itemwise.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">No GRN data available</TableCell>
                </TableRow>
              ) : (
                (filteredGrn.length > 0 ? filteredGrn : itemwise).map((grn, index) => (
                  <TableRow key={grn.grnId}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{grn.randomId || 'N/A'}</TableCell>
                    <TableCell>{getRandomId(grn.purchaseOrderId) || 'N/A'}</TableCell>
                    <TableCell>{grn.vendorName || 'N/A'}</TableCell>
                    <TableCell>{grn.createdDate ? format(new Date(grn.createdDate), 'dd-MM-yyyy') : 'N/A'}</TableCell>
                    <TableCell>{grn.itemDetails?.length || 0}</TableCell>
                    <TableCell>{grn.itemDetails?.reduce((acc, item) => acc + (item.quantity || 0), 0) || 0}</TableCell>
                    <TableCell>{grn.itemDetails?.reduce((acc, item) => acc + (item.returnedQuantity || 0), 0) || 0}</TableCell>
                    <TableCell>{(grn.totalReturnedAmount || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <Tooltip title="View Details">
                          <IconButton color="primary" onClick={() => handleGrnSelect(grn.grnId)}>
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download PDF">
                          <IconButton color="primary" onClick={() => handleDownload(grn.grnId)}>
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
  <Dialog
          open={viewItemsDialogOpen}
          onClose={handleClose}
          maxWidth={false}
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
          }}>GRN Return History      <IconButton onClick={toggleFullScreen} color="primary" edge="end">
              {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton></DialogTitle>
      <DialogContent sx={{
            padding: isFullScreen ? '0 24px' : '20px', // Adjust content padding
            height: isFullScreen ? 'calc(100vh - 120px)' : 'auto', // Account for header/footer height
            overflow: 'auto'
          }}>
    {selectedGrn && (
      <Box>
        {/* Header Information */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">
            <strong>PO ID:</strong> {selectedGrn.poRandomID || 'N/A'}
          </Typography>
          <Typography variant="h6">
            <strong>GRN ID:</strong> {selectedGrn.randomId }
          </Typography>
          <Typography variant="h6">
            <strong>Vendor:</strong> {selectedGrn.vendorName }
          </Typography>
        </Box>
        
        {selectedGrn && selectedGrn.itemDetails && (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Item Name</TableCell>
                <TableCell>UOM</TableCell>
                <TableCell>Quantity</TableCell>
                <TableCell>Overall Returned Qty</TableCell>
                <TableCell>Unit Price</TableCell>
                <TableCell>Return Date</TableCell>
                <TableCell>Returned By</TableCell>
                <TableCell>Return Qty</TableCell>
                <TableCell>Reason</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {selectedGrn.itemDetails
                .filter(item => item.returnedQuantity > 0 && Array.isArray(item.returnHistory) && item.returnHistory.length > 0)
                .flatMap(item =>
                  item.returnHistory?.map((history, idx) => (
                    <TableRow key={`${item.itemId}-return-${idx}`}>
                      <TableCell>{item.itemName || 'N/A'}</TableCell>
                      <TableCell>{item.uom || 'N/A'}</TableCell>
                      <TableCell>{item.quantity || 0}</TableCell>
                      <TableCell>{item.returnedQuantity || 0}</TableCell>
                      <TableCell>{(item.unitPrice || 0).toFixed(2)}</TableCell>
                      <TableCell>{history.date ? format(new Date(history.date), 'dd-MM-yyyy HH:mm:ss') : 'N/A'}</TableCell>
                      <TableCell>{history.by || 'N/A'}</TableCell>
                      <TableCell>{`${history.totalUnits || 0} ${item.uom || 'N/A'}`}</TableCell>
                      <TableCell>{history.reason || 'N/A'}</TableCell>
                    </TableRow>
                  ))
                )}
              <TableRow>
                <TableCell colSpan={8} align="right"><strong>Total Discount:</strong></TableCell>
                <TableCell>{totalDiscount.toFixed(2)}</TableCell>
              </TableRow>
              {Object.entries(taxDetails).map(([rate, { sgstAmount, cgstAmount, igstAmount }]) => (
                <React.Fragment key={rate}>
                  {(sgstAmount > 0 || cgstAmount > 0) && (
                    <>
                      <TableRow>
                        <TableCell colSpan={8} align="right"><strong>SGST ({(parseFloat(rate) / 2).toFixed(2)}%):</strong></TableCell>
                        <TableCell>{sgstAmount.toFixed(2)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={8} align="right"><strong>CGST ({(parseFloat(rate) / 2).toFixed(2)}%):</strong></TableCell>
                        <TableCell>{cgstAmount.toFixed(2)}</TableCell>
                      </TableRow>
                    </>
                  )}
                  {igstAmount > 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="right"><strong>IGST ({parseFloat(rate)}%):</strong></TableCell>
                      <TableCell>{igstAmount.toFixed(2)}</TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
              <TableRow>
                <TableCell colSpan={8} align="right"><strong>Final Returned Amount:</strong></TableCell>
                <TableCell>{totalReturnedAmount.toFixed(2)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </Box>
    )}
  </DialogContent>
  <DialogActions>
    <Button onClick={handleCloseViewItemsDialog} color="primary">
      Close
    </Button>
  </DialogActions>
</Dialog>
        <Dialog open={dialogDownloadOpen} onClose={() => setDialogDownloadOpen(false)}>
          <DialogTitle>Select Export Format</DialogTitle>
          <DialogContent>
            Choose whether you want to download the report as an Excel (CSV) file or generate a PDF.
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
              onClick={generatePDF}
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
        <Dialog open={dialogSummaryOpen} onClose={handleClose}>
          <DialogTitle>Export Options</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Please choose whether you want to export the data as a CSV or generate a PDF.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={generateSummaryCSV}
              variant="contained"
              color="secondary"
              startIcon={<DescriptionIcon />}
            >
              Export Excel
            </Button>
            <Button
              onClick={generateSummaryPDF}
              variant="contained"
              color="primary"
              startIcon={<PictureAsPdfIcon />}
            >
              Generate PDF
            </Button>
            <Button variant='outlined' onClick={handleClose}>
              Cancel
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
          <DialogTitle>Confirm Action</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to perform this action?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)} color="primary">
              Cancel
            </Button>
            <Button
              onClick={() => {
                dialogAction && dialogAction();
                setDialogOpen(false);
              }}
              color="primary"
              autoFocus
            >
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
        <Snackbar
          open={snackbarOpenGRN}
          message={snackbarMessageGRN}
          autoHideDuration={3000}
          onClose={() => dispatch(clearSnackbarMessage())}
        />
      </Box>
    </Box>
  );
};

export default GrnReturn;