"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/redux/store';
import { format } from 'date-fns';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ClearIcon from "@mui/icons-material/Clear";
import CheckIcon from '@mui/icons-material/Check';
import {
  Box, Button, Typography, Table, TableContainer, TableHead, TableRow, TableCell, TableBody,
  Paper, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Tooltip,
  Grid,
  Snackbar,
  DialogContentText,
  Menu,
  MenuItem,
  Chip,
  Divider,
  TextField,
  Alert,
  Stack
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import Link from 'next/link';
import { ServiceData, ServiceDescription } from '../Models/servicepo';
import { VendorSearch } from '@/Models/vendor';
import jsPDF from "jspdf";
import "jspdf-autotable";
import {
  fetchServices,
  selectServiceState,
  setSnackbarMessage,
  setSnackbarOpen,
} from '../Features/servicepo';
import {
  updateServiceOrderStatusToPending,
  convertServiceToAPOutgoing,
  selectConversionLoading,
  selectConversionError,
  selectConversionSuccess,
  clearConversionState
} from '../Features/servicelist';
import { fetchBusinesses, selectBusinesses } from '@/features/account-setting/businessSlice';
import Papa from 'papaparse';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import DateRangeDialog from '@/components/dateRange';
import VendorSearchAutocomplete from '@/components/vendorsearchautocomplete';
import { debounce } from 'lodash';
import YenPurchasePage from '../../page';
import ServiceIdSearch from '../Components/ServiceIDSeacrh';
import FreightSelectionDialog, { FreightData } from '../../PurchaseOrder/Component/freightSelectionDialog';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: any;
  }
}

interface AutoTableHookData {
  cursor?: { x: number; y: number };
  settings?: any;
  pageNumber?: number;
  doc: jsPDF;
}

// Helper function to add footer
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

// Helper function to get description objects
const getDescriptionsFromFlatArrays = (service: ServiceData): ServiceDescription[] => {
  const descriptions: ServiceDescription[] = [];

  // Get the maximum length from available arrays
  const maxLength = Math.max(
    service.descriptions?.length || 0,
    service.sacCode?.length || 0,
    service.from_dates?.length || 0,
    service.to_dates?.length || 0,
    service.fees?.length || 0
  );

  for (let i = 0; i < maxLength; i++) {
    // Create description from remarks if desc_descriptions doesn't exist
    const descriptionText = service.descriptions?.[i] ||
      service.remarks?.[i] ||
      `Service ${i + 1}`;

    descriptions.push({
      id: service.desc_ids?.[i] || `desc-${i}`,
      sacCode: service.sacCode?.[i] || '',
      description: descriptionText,
      from_date: service.from_dates?.[i],
      to_date: service.to_dates?.[i],
      fee: service.fees?.[i] || 0,
      tax_type: service.desc_tax_types?.[i] as 'cgst_sgst' | 'igst' || 'cgst_sgst',
      tax_per: service.desc_tax_pers?.[i] || 0,
      sgst: service.desc_sgst?.[i] || 0,
      cgst: service.desc_cgst?.[i] || 0,
      igst: service.desc_igst?.[i] || 0,
      total: service.desc_totals?.[i] || 0,
      taxAmount: service.desc_tax_amounts?.[i] || 0,
      totalFee: service.desc_total_fees?.[i] || 0,
      finalFee: service.desc_total_fees?.[i] || 0,
      discountAmount: service.desc_discount_amounts?.[i] || 0,
      remarks: service.remarks?.[i] || '',
      quantity: service.quantity?.[i] || 0,
      base_amount: service.base_amounts?.[i] || 0
    });
  }

  return descriptions;
};

const ApprovedService: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const serviceOrder = useSelector(selectServiceState);
  const { services, loading, error, snackbarMessage, snackbarOpen } = serviceOrder;
  const { businesses } = useSelector(selectBusinesses);

  // Conversion state
  const conversionLoading = useSelector(selectConversionLoading);
  const conversionError = useSelector(selectConversionError);
  const conversionSuccess = useSelector(selectConversionSuccess);

  // State for filters
  const [filters, setFilters] = useState({
    vendorName: '',
    serviceId: '',
    fromDate: '',
    toDate: '',
    workOrderFrom: '',
    workOrderTo: ''
  });

  const [selectedOrder, setSelectedOrder] = useState<ServiceData | null>(null);
  const [selectedDescriptions, setSelectedDescriptions] = useState<ServiceDescription[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectionRange, setSelectionRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    key: 'selection',
  });
  const [selectedVendor, setSelectedVendor] = useState<VendorSearch | null>(null);
  const [dialogDownloadOpen, setDialogDownloadOpen] = useState(false);
  const [dialogSummaryOpen, setDialogSummaryOpen] = useState(false);
  const [openMovePendingDialog, setOpenMovePendingDialog] = useState(false);
  const [openConvertToAPDialog, setOpenConvertToAPDialog] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [apRoundOff, setApRoundOff] = useState(''); // Start empty for easy typing
  const [apRoundOffError, setApRoundOffError] = useState('');
  const [openConvertConfirmation, setOpenConvertConfirmation] = useState(false);
  const [apInvoiceDate, setApInvoiceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [apInvoiceNo, setApInvoiceNo] = useState('');
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [freights, setFreights] = useState<FreightData[]>([]);
  // const [openFreightDialog, setOpenFreightDialog] = useState(false);
  // Fetch initial Approved services
  useEffect(() => {
    dispatch(fetchBusinesses());
    fetchApprovedServices();
  }, [dispatch]);
  // Handle conversion success/error
  useEffect(() => {
    if (conversionSuccess) {
      // Close both dialogs
      setOpenConvertConfirmation(false);
      setOpenConvertToAPDialog(false);

      // Reset form state
      handleDialogClose();

      // Show success message and refresh data
      dispatch(setSnackbarMessage('Service successfully converted to AP and Outgoing'));
      dispatch(setSnackbarOpen(true));
      fetchApprovedServices();

      // Clear conversion state
      dispatch(clearConversionState());
    }

    if (conversionError) {
      dispatch(setSnackbarMessage(conversionError));
      dispatch(setSnackbarOpen(true));
      // Keep the dialogs open on error so user can retry
    }
  }, [conversionSuccess, conversionError, dispatch]);
  // Function to fetch services with current filters
  const fetchApprovedServices = useCallback((additionalParams = {}) => {
    const allParams = {
      status: 'Approved',
      skip: (currentPage - 1) * pageSize,
      limit: pageSize,
      ...filters,
      ...additionalParams
    };

    const cleanedParams: Record<string, any> = {};

    Object.entries(allParams).forEach(([key, value]) => {
      if (value !== '' && value !== undefined) {
        cleanedParams[key] = value;
      }
    });

    dispatch(fetchServices(cleanedParams)).then((response: any) => {
      if (response.payload) {
        setTotalItems(response.payload.total || 0);
      }
    });
  }, [dispatch, filters, currentPage, pageSize]);

  // Debounced filter update
  const debouncedFetch = useMemo(
    () => debounce(fetchApprovedServices, 500),
    [fetchApprovedServices]
  );

  // Handle vendor change
  const handleVendorChange = useCallback((vendor: VendorSearch | null) => {
    setSelectedVendor(vendor);
    setFilters(prev => ({
      ...prev,
      vendorName: vendor ? vendor.vendorName : ''
    }));
    setCurrentPage(1);
    debouncedFetch({ vendorName: vendor ? vendor.vendorName : '' });
  }, [debouncedFetch]);

  // Handle service ID change
  const handleServiceIdChange = useCallback((serviceId: string) => {
    const cleanedId = serviceId.trim().toUpperCase();
    setSelectedServiceId(cleanedId);
    setFilters(prev => ({
      ...prev,
      serviceId: cleanedId
    }));

    // Debounce the API call
    debouncedFetch({ serviceId: cleanedId });
  }, [debouncedFetch]);

  // Handle date range change
  const handleDateRangeChange = useCallback((range: any) => {
    setSelectionRange(range);

    const newFilters = {
      workOrderFrom: range.startDate ? format(range.startDate, 'yyyy-MM-dd') : '',
      workOrderTo: range.endDate ? format(range.endDate, 'yyyy-MM-dd') : ''
    };

    setFilters(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
    debouncedFetch(newFilters);
  }, [debouncedFetch]);
  const handleApRoundOffChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setApRoundOff(value);

    // Clear error while user is typing
    setApRoundOffError('');
  }, [setApRoundOff, setApRoundOffError]);

  const handleApRoundOffBlur = useCallback(() => {
    // If empty, treat as 0 with no error
    if (apRoundOff === '' || apRoundOff === '-') {
      setApRoundOff('0.00');
      setApRoundOffError('');
      return;
    }

    // Parse the value
    const parsed = parseFloat(apRoundOff);

    // Check if valid number
    if (isNaN(parsed)) {
      setApRoundOffError('Please enter a valid number (e.g., 0.50, -0.25)');
      setApRoundOff('');
      return;
    }

    // Check range
    if (parsed > 2 || parsed < -2) {
      setApRoundOffError('Must be between -2.00 and +2.00');
      // Auto-correct to nearest limit
      const corrected = parsed > 2 ? '2.00' : '-2.00';
      setApRoundOff(corrected);
      return;
    }

    // Format to 2 decimal places
    const formatted = parsed.toFixed(2);
    setApRoundOff(formatted);
    setApRoundOffError('');
  }, [apRoundOff, setApRoundOff, setApRoundOffError]);
  // Clear all filters
  const handleFilterClose = useCallback(() => {
    setSelectionRange({
      startDate: new Date(),
      endDate: new Date(),
      key: 'selection',
    });
    setSelectedVendor(null);
    setSelectedServiceId('');
    setFilters({
      vendorName: '',
      serviceId: '',
      fromDate: '',
      toDate: '',
      workOrderFrom: '',
      workOrderTo: ''
    });
    setCurrentPage(1);

    // Fetch only Approved without filters
    dispatch(fetchServices({ status: 'Approved', skip: 0, limit: pageSize }));
  }, [dispatch, pageSize]);

  // Filter services to show only Approved
  const approvedServices = useMemo(() => {
    return services.filter(service => service.status === 'Approved');
  }, [services]);

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > Math.ceil(totalItems / pageSize)) return;
    setCurrentPage(newPage);
    fetchApprovedServices();
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

  // Menu handlers
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseAnchor = () => {
    setAnchorEl(null);
  };

  const handleVendorwiseClick = () => {
    setDialogDownloadOpen(true);
    handleCloseAnchor();
  };

  const handleDescriptionwiseClick = () => {
    setDialogSummaryOpen(true);
    handleCloseAnchor();
  };

  const handleViewDetailsClick = (serviceId: string) => {
    const selected = services.find((s: ServiceData) => s.serviceId === serviceId);
    if (selected) {
      setSelectedOrder(selected);
      const descriptions = getDescriptionsFromFlatArrays(selected);
      setSelectedDescriptions(descriptions);

      // If not stored yet, start with empty array
      const existingFreights: FreightData[] = selected.freights || []; // adjust field name as per your model
      setFreights(existingFreights);

      setApInvoiceDate(format(new Date(), 'yyyy-MM-dd'));
      setApInvoiceNo('');
      setApRoundOff('0.00');
      setOpenConvertToAPDialog(true);
    }
  };

  const handleDialogClose = () => {
    setSelectedOrder(null);
    setSelectedDescriptions([]);
    setOpenConvertToAPDialog(false);
    setOpenConvertConfirmation(false);
    setApInvoiceDate(format(new Date(), 'yyyy-MM-dd'));
    setApInvoiceNo('');
    setApRoundOff('0.00');
    setApRoundOffError('');

    // Also clear conversion states if needed
    dispatch(clearConversionState());
  };
  const handleCloseSnackbar = () => {
    dispatch(setSnackbarOpen(false));
  };

  // Move to Pending handler
  const handleOpenMovePendingDialog = () => {
    setOpenMovePendingDialog(true);
  };

  const handleCloseMovePendingDialog = () => {
    setOpenMovePendingDialog(false);
  };

  const handleConfirmMovePending = async () => {
    if (selectedOrder?.mongoId) {
      try {
        await dispatch(updateServiceOrderStatusToPending(selectedOrder.mongoId)).unwrap();
        dispatch(setSnackbarMessage('Service order moved to pending successfully'));
        dispatch(setSnackbarOpen(true));
        fetchApprovedServices();
        setOpenMovePendingDialog(false);
        handleDialogClose();
      } catch (error: any) {
        dispatch(setSnackbarMessage(error || 'Failed to move service order to pending'));
        dispatch(setSnackbarOpen(true));
      }
    }
  };
  const handleConfirmConvertToAP = () => {
    if (!selectedOrder || !apInvoiceNo.trim()) return;

    const request = {
      service_id: selectedOrder.mongoId,
      apRoundOff: apRoundOff || '0.00',
      invoiceNo: apInvoiceNo.trim(),
      invoiceDate: apInvoiceDate
    };

    dispatch(convertServiceToAPOutgoing(request)).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        // Close confirmation dialog first
        setOpenConvertConfirmation(false);

        // Close the main details dialog
        handleDialogClose();

        // Fetch updated data
        fetchApprovedServices();

        // Show success message
        dispatch(setSnackbarMessage('Service successfully converted to AP and Outgoing'));
        dispatch(setSnackbarOpen(true));
      }
    });
  };
  // Generate PDF for vendorwise report
  const generatePDF = () => {
    const doc = new jsPDF();
    let yOffset = 7;
    let pageCount = 1;
    const business = businesses[0] || null;
    if (!business) return;

    if (business.imageUrl) {
      doc.addImage(business.imageUrl, 'JPEG', 14, yOffset, 20, 20);
    }
    yOffset += 7;

    doc.setFontSize(12);
    const title = "Approved Service Orders - Vendor Summary";
    const pageWidth = doc.internal.pageSize.width;
    const titleWidth = doc.getStringUnitWidth(title) * doc.getFontSize() / doc.internal.scaleFactor;
    const titleX = (pageWidth - titleWidth) / 2;
    doc.text(title, titleX, yOffset);
    doc.line(titleX, yOffset + 2, titleX + titleWidth, yOffset + 2);
    yOffset += 13;

    const totalOrderedAmount = approvedServices.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const today = new Date();
    const currentDate = format(today, 'dd/MM/yyyy');

    doc.setFontSize(10);
    const totalText = `Total Approved Amount: ${totalOrderedAmount.toFixed(2)}`;
    const dateText = `Date: ${currentDate}`;
    const dateWidth = doc.getStringUnitWidth(dateText) * 10 / doc.internal.scaleFactor;
    doc.text(totalText, 14, yOffset);
    doc.text(dateText, pageWidth - dateWidth - 14, yOffset);
    yOffset += 5;

    const headers = [["S.No", "Service ID", "Vendor Name", "Total Descriptions", "Order Date", "Total Amount", "Status"]];
    const rows = approvedServices.map((service: ServiceData, index: number) => {
      const totalDescs = service.descriptions.length;
      const orderDate = service.workOrderDate ? format(new Date(service.workOrderDate), 'dd-MM-yyyy') : '';
      return [
        (index + 1).toString(),
        service.serviceId,
        service.vendorName,
        totalDescs.toString(),
        orderDate,
        (service.totalAmount || 0).toFixed(2),
        service.status
      ];
    });

    doc.autoTable({
      head: headers,
      body: rows,
      startY: yOffset,
      styles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [0, 100, 0], textColor: [255, 255, 255], fontSize: 8, halign: 'center' },
      bodyStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: 17, halign: 'center' },
        1: { cellWidth: 28, halign: 'center' },
        2: { cellWidth: 40, halign: 'center' },
        3: { cellWidth: 25, halign: 'center' },
        4: { cellWidth: 28, halign: 'center' },
        5: { cellWidth: 30, halign: 'right' },
        6: { cellWidth: 25, halign: 'center' }
      },
      margin: { left: 14, right: 14 },
      tableWidth: 193,
      didDrawPage: (data: AutoTableHookData) => {
        addFooter(doc, pageCount++, doc.getNumberOfPages());
      },
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addFooter(doc, i, totalPages);
    }

    doc.save('Approved_Service_Orders_Vendorwise.pdf');
    setDialogDownloadOpen(false);
  };

  const handleExportCSV = () => {
    const headers = 'SNO,Service ID,Vendor Name,Total Descriptions,Order Date,Total Amount,Status\n';
    const rows = approvedServices.map((service: ServiceData, index: number) => {
      const totalDescs = service.descriptions.length;
      const orderDate = service.workOrderDate ? format(new Date(service.workOrderDate), 'dd-MM-yyyy') : '';
      return [
        (index + 1),
        service.serviceId,
        service.vendorName,
        totalDescs,
        orderDate,
        (service.totalAmount || 0).toFixed(2),
        service.status
      ].join(',');
    }).join('\n');
    const csvContent = `${headers}${rows}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'Approved_Service_Orders_Vendorwise.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDialogDownloadOpen(false);
  };

  const generateSummaryPDF = () => {
    const doc = new jsPDF();
    let yOffset = 10;
    let pageCount = 1;
    const business = businesses[0] || null;
    if (!business) return;

    if (business.imageUrl) {
      doc.addImage(business.imageUrl, 'JPEG', 14, yOffset, 20, 20);
    }
    yOffset += 10;

    doc.setFontSize(12);
    const title = "Approved Service Orders - Detailed Summary";
    const pageWidth = doc.internal.pageSize.width;
    const titleWidth = doc.getStringUnitWidth(title) * doc.getFontSize() / doc.internal.scaleFactor;
    const titleX = (pageWidth - titleWidth) / 2;
    doc.text(title, titleX, yOffset);
    doc.setLineWidth(0.1);
    doc.line(titleX, yOffset + 2, titleX + titleWidth, yOffset + 2);
    yOffset += 15;

    const totalOrderedAmount = approvedServices.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const today = new Date();
    const currentDate = format(today, 'dd/MM/yyyy');

    doc.setFontSize(10);
    const totalText = `Total Approved Amount: ${totalOrderedAmount.toFixed(2)}`;
    const dateText = `Date: ${currentDate}`;
    const dateWidth = doc.getStringUnitWidth(dateText) * 10 / doc.internal.scaleFactor;
    doc.text(totalText, 14, yOffset);
    doc.text(dateText, pageWidth - dateWidth - 14, yOffset);
    yOffset += 5;

    const headers = [["S.No", "Service No", "Vendor Name", "Description", "From Date", "To Date", "Fee", "Tax %", "Total"]];
    const rows = approvedServices.map((service: ServiceData, sIndex: number) => {
      const descriptions = getDescriptionsFromFlatArrays(service);
      return descriptions.map((desc: ServiceDescription, dIndex: number) => {
        const globalIndex = sIndex * descriptions.length + dIndex + 1;
        const fromDate = desc.from_date ? format(new Date(desc.from_date), 'dd-MM-yyyy') : '';
        const toDate = desc.to_date ? format(new Date(desc.to_date), 'dd-MM-yyyy') : '';
        return [
          globalIndex.toString(),
          service.serviceId,
          service.vendorName,
          desc.description,
          fromDate,
          toDate,
          desc.fee.toFixed(2),
          `${desc.tax_per}%`,
          desc.total.toFixed(2),
        ];
      });
    }).flat();

    doc.autoTable({
      head: headers,
      body: rows,
      startY: yOffset,
      styles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [0, 100, 0], textColor: [255, 255, 255], fontSize: 8, halign: 'center' },
      bodyStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0] },
      columnStyles: {
        6: { halign: 'right' },
        7: { halign: 'center' },
        8: { halign: 'right' },
      },
      didDrawPage: (data: AutoTableHookData) => {
        addFooter(doc, pageCount++, doc.getNumberOfPages());
      },
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addFooter(doc, i, totalPages);
    }

    doc.save('Approved_Service_Orders_Descriptionwise.pdf');
    setDialogSummaryOpen(false);
  };

  const generateSummaryCSV = () => {
    const headers = ["S.No", "Service No", "Vendor Name", "Description", "From Date", "To Date", "Fee", "Tax %", "Total"];
    const rows = approvedServices.map((service: ServiceData, sIndex: number) => {
      const descriptions = getDescriptionsFromFlatArrays(service);
      return descriptions.map((desc: ServiceDescription, dIndex: number) => {
        const globalIndex = sIndex * descriptions.length + dIndex + 1;
        const fromDate = desc.from_date ? format(new Date(desc.from_date), 'dd-MM-yyyy') : '';
        const toDate = desc.to_date ? format(new Date(desc.to_date), 'dd-MM-yyyy') : '';
        return [
          globalIndex,
          service.serviceId,
          service.vendorName,
          desc.description,
          fromDate,
          toDate,
          desc.fee.toFixed(2),
          `${desc.tax_per}%`,
          desc.total.toFixed(2),
        ];
      });
    }).flat();
    const csvData = [headers, ...rows];
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Approved_Service_Orders_Descriptionwise.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDialogSummaryOpen(false);
  };
  const handleOpenConvertConfirmation = () => {
    setOpenConvertConfirmation(true);
  };


  // Individual PDF download
  const handleDownload = (service: ServiceData) => {
    const doc = new jsPDF();
    let yOffset = 10;
    let pageCount = 1;
    const business = businesses[0] || null;

    if (!business) return;

    // Header Section
    if (business.imageUrl) {
      doc.addImage(business.imageUrl, 'JPEG', 35, yOffset, 25, 25);
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 100, 0);
    doc.text('Approved Service Order', 90, yOffset + 5);

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(business.companyName || '', 90, yOffset + 10);

    doc.setFontSize(8);
    doc.text(business.address1 || '', 90, yOffset + 15);
    doc.text(`Tel.No: ${business.phoneNo || ''}`, 90, yOffset + 20);
    doc.text(`E-Mail: ${business.emailId || ''}`, 90, yOffset + 25);
    doc.text(`GSTIN: ${business.gstIn || ''}`, 90, yOffset + 30);

    yOffset += 35;

    // Vendor and Service Details
    const vendorDetailsRows = [
      [
        `${service.vendorName || ''}\n` +
        `Address: ${service.address || ''}\n` +
        `City: ${service.city || ''}\n` +
        `State: ${service.state || ''}\n` +
        `Country: ${service.country || ''}\n` +
        `Email: ${service.contactpersonEmail || ''}\n` +
        `Phone: ${service.vendorPhone || ''}`,
        `Service ID: ${service.serviceId}\n` +
        `Order Date: ${service.workOrderDate ? format(new Date(service.workOrderDate), 'dd-MM-yyyy') : ''}\n` +
        `Status: ${service.status}\n` +
        `Currency: INR`
      ],
    ];

    doc.autoTable({
      head: [['Vendor Details', 'Service Details']],
      body: vendorDetailsRows,
      startY: yOffset,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4, halign: 'left', valign: 'top' },
      headStyles: { fillColor: [0, 100, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { lineWidth: 0.1 },
      margin: { bottom: 15 },
    });

    yOffset = doc.autoTable.previous.finalY;

    // Service Items Table
    const descriptions = getDescriptionsFromFlatArrays(service);
    const itemHeader = ['S.No', 'Description', 'SAC Code', 'From Date', 'To Date', 'Fee', 'Tax %', 'Tax Amount', 'Total'];
    const tableRows = descriptions.map((desc: ServiceDescription, index: number) => {
      const fromDate = desc.from_date ? format(new Date(desc.from_date), 'dd-MM-yyyy') : '';
      const toDate = desc.to_date ? format(new Date(desc.to_date), 'dd-MM-yyyy') : '';
      const taxAmount = desc.sgst + desc.cgst + desc.igst;

      return [
        (index + 1).toString(),
        desc.description,
        desc.sacCode,
        fromDate,
        toDate,
        desc.fee.toFixed(2),
        `${desc.tax_per}%`,
        taxAmount.toFixed(2),
        desc.total.toFixed(2)
      ];
    });

    doc.autoTable({
      head: [itemHeader],
      body: tableRows,
      startY: yOffset,
      theme: 'grid',
      styles: { fontSize: 8, halign: 'center', cellPadding: 2 },
      headStyles: { fillColor: [0, 100, 0], textColor: [255, 255, 255] },
      bodyStyles: { lineColor: [0, 0, 0], lineWidth: 0.1 },
      columnStyles: {
        0: { halign: 'center' },
        1: { halign: 'left' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'right' },
        6: { halign: 'center' },
        7: { halign: 'right' },
        8: { halign: 'right' }
      },
      margin: { bottom: 15 },
    });

    yOffset = doc.autoTable.previous.finalY + 10;

    // Total Summary
    const totalFee = descriptions.reduce((sum, desc) => sum + desc.fee, 0);
    const totalTax = descriptions.reduce((sum, desc) => sum + (desc.sgst + desc.cgst + desc.igst), 0);
    const grandTotal = descriptions.reduce((sum, desc) => sum + desc.total, 0);

    const summaryRows = [
      ['Total Fee:', totalFee.toFixed(2)],
      ['Total Tax:', totalTax.toFixed(2)],
      ['Grand Total:', grandTotal.toFixed(2)]
    ];

    doc.autoTable({
      body: summaryRows,
      startY: yOffset,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: {
        0: { halign: 'right', fontStyle: 'bold' },
        1: { halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: 120 },
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addFooter(doc, i, totalPages);
    }

    doc.save(`${service.vendorName}_${service.serviceId}_Approved.pdf`);
  };

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
      <Box sx={{ px: 2, py: 1 }}>
        {/* Navigation Links */}
        <Grid container spacing={2} sx={{ mb: 1 }}>
          <Grid item xs={12} display="flex" alignItems="center">
            <Link href="/yen-purchase/ServiceOrder" passHref>
              <Button variant="contained" color="primary">
                Pending
              </Button>
            </Link>
            <Link href="/yen-purchase/ServiceOrder/ApprovedService" passHref>
              <Button
                variant="contained"
                sx={{
                  ml: 1,
                  backgroundColor: 'white',
                  color: 'black',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  },
                }}
              >
                Approved
              </Button>
            </Link>
            <Link href="/yen-purchase/ServiceOrder/RejectedService" passHref>
              <Button variant="contained" color="primary" sx={{ ml: 1 }}>
                Rejected
              </Button>
            </Link>
          </Grid>
        </Grid>

        {/* FILTERS */}
        <Grid
          container
          spacing={1}
          alignItems="center"
          justifyContent="flex-start"
          wrap="nowrap"
          sx={{
            display: 'inline-flex',
            minWidth: '100%',
          }}
        >
          <Grid item xs="auto">
            <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <DateRangeDialog
                selectionRange={selectionRange}
                setSelectionRange={handleDateRangeChange}
                onApply={() => debouncedFetch()}
              />
            </Box>
          </Grid>

          <Grid item xs={6} sm={4} md={2}>
            <VendorSearchAutocomplete
              value={selectedVendor}
              onChange={handleVendorChange}
              label="All Vendors"
            />
          </Grid>

          <Grid item xs={6} sm={4} md={1}>
            <ServiceIdSearch
              value={selectedServiceId}
              onChange={handleServiceIdChange}
              label="Service ID"
              fullWidth
            />
          </Grid>

          <Grid item xs="auto">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <IconButton
                onClick={() => debouncedFetch()}
                className="icon-button-outline"
                color="primary"
                size="small"
                sx={{ p: 0.3 }}
              >
                <FilterAltIcon fontSize="small" />
              </IconButton>
              <Typography variant="caption" align="center" sx={{ maxWidth: 60, wordBreak: 'break-word', mt: 0.2 }}>
                Filter
              </Typography>
            </Box>
          </Grid>

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
              <Typography variant="caption" align="center" sx={{ maxWidth: 60, wordBreak: 'break-word', mt: 0.2 }}>
                Clear
              </Typography>
            </Box>
          </Grid>

          <Grid item xs sx={{ flexGrow: 1 }} />

          <Grid item xs="auto">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <IconButton
                onClick={handleClick}
                color="primary"
                className="icon-button-outline"
                size="small"
                sx={{ p: 0.3 }}
                disabled={!approvedServices.length}
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
              <Typography variant="caption" align="center" sx={{ maxWidth: 60, wordBreak: 'break-word', mt: 0.2 }}>
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
                <MenuItem onClick={handleDescriptionwiseClick}>Descriptionwise</MenuItem>
              </Menu>
            </Box>
          </Grid>
        </Grid>

        {/* MAIN TABLE */}
        <TableContainer
          component={Paper}
          sx={{
            maxHeight: 'calc(100vh - 245px)',
            overflowY: 'auto',
            width: '100%',
            mt: 0.7
          }}
        >
          <Table stickyHeader sx={{ tableLayout: 'fixed', width: '100%' }}>
            <TableHead>
              <TableRow>
                <TableCell>S.No</TableCell>
                <TableCell>Service ID</TableCell>
                <TableCell>Vendor Name</TableCell>
                <TableCell>Order Date</TableCell>
                <TableCell>Total Descriptions</TableCell>
                <TableCell align="right">Total Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {approvedServices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No approved service orders found.
                  </TableCell>
                </TableRow>
              ) : (
                approvedServices.map((service: ServiceData, index: number) => (
                  <TableRow key={service.serviceId}>
                    <TableCell>{(currentPage - 1) * pageSize + index + 1}</TableCell>
                    <TableCell>{service.serviceId}</TableCell>
                    <TableCell>{service.vendorName}</TableCell>
                    <TableCell>
                      {service.workOrderDate ?
                        format(new Date(service.workOrderDate), 'dd-MM-yyyy') : ''}
                    </TableCell>
                    <TableCell>
                      {getDescriptionsFromFlatArrays(service).length}
                    </TableCell>
                    <TableCell align="right">{(service.totalAmount || 0).toFixed(2)}</TableCell>
                    <TableCell>{service.status}</TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <Tooltip title="View Details">
                          <IconButton
                            onClick={() => handleViewDetailsClick(service.serviceId)}
                            color='primary'
                            sx={{ mr: 1 }}
                          >
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Download PDF">
                          <IconButton
                            onClick={() => handleDownload(service)}
                            color='primary'
                            sx={{ mr: 1 }}
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

        {/* PAGINATION */}
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

        {/* VIEW DETAILS DIALOG - Updated Layout like GRN Dialog */}
        <Dialog
          open={openConvertToAPDialog}
          onClose={handleDialogClose}
          maxWidth="lg"
          fullWidth={true}
        >
          <DialogTitle>
            Approved Service Order Details - {selectedOrder?.serviceId || ''}
          </DialogTitle>

          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={7} md={3}>
                <TextField
                  autoComplete='off'
                  label="Invoice No *"
                  value={apInvoiceNo}
                  onChange={(e) => setApInvoiceNo(e.target.value)}
                  placeholder=""
                  fullWidth
                  required
                  size="small"  // ← Smaller field
                  error={!apInvoiceNo.trim()}
                  helperText={!apInvoiceNo.trim() ? "Required" : " "}
                />
              </Grid>
              <Grid item xs={12} sm={5} md={3}>
                <TextField
                  autoComplete='off'
                  label="Invoice Date *"
                  type="date"
                  value={apInvoiceDate}
                  onChange={(e) => setApInvoiceDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  required
                  size="small"  // ← Smaller field
                  inputProps={{
                    max: format(new Date(), 'yyyy-MM-dd'),
                  }}
                />
              </Grid>
            </Grid>
            {/* Service Descriptions Table */}
            <Typography variant="h6" gutterBottom>
              Service Descriptions
            </Typography>
            <TableContainer component={Paper} sx={{ mb: 4 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><b>S.No</b></TableCell>
                    <TableCell><b>SAC Code</b></TableCell>
                    <TableCell><b>Description</b></TableCell>
                    <TableCell><b>From Date</b></TableCell>
                    <TableCell><b>To Date</b></TableCell>
                    <TableCell align="right"><b>Fee</b></TableCell>
                    <TableCell align="center"><b>Tax (%)</b></TableCell>
                    <TableCell align="right"><b>Total</b></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedDescriptions.map((desc: ServiceDescription, index: number) => (
                    <TableRow key={desc.id || index}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{desc.sacCode}</TableCell>
                      <TableCell>{desc.description}</TableCell>
                      <TableCell>
                        {desc.from_date ? format(new Date(desc.from_date), 'dd-MM-yyyy') : ''}
                      </TableCell>
                      <TableCell>
                        {desc.to_date ? format(new Date(desc.to_date), 'dd-MM-yyyy') : ''}
                      </TableCell>
                      <TableCell align="right">{desc.fee.toFixed(2)}</TableCell>
                      <TableCell align="center">{desc.tax_per}%</TableCell>
                      <TableCell align="right">{desc.total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {selectedOrder && (
              <>
                <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
                  Order Summary
                </Typography>

                <Table size="small" sx={{ mb: 3 }}>
                  <TableBody>
                    {/* Service Tax */}
                    <TableRow>
                      <TableCell sx={{ border: 0, py: 0.5, whiteSpace: 'nowrap' }}>
                        Service Tax:
                      </TableCell>
                      <TableCell align="right" sx={{ border: 0, py: 0.5, whiteSpace: 'nowrap', width: '150px' }}>
                        ₹ {selectedDescriptions.reduce((sum, d) => sum + (d.taxAmount || 0), 0).toFixed(2)}
                      </TableCell>
                    </TableRow>

                    {/* Freight Amount */}
                    <TableRow>
                      <TableCell sx={{ border: 0, py: 0.5, whiteSpace: 'nowrap' }}>
                        Freight Amount:
                      </TableCell>
                      <TableCell align="right" sx={{ border: 0, py: 0.5, whiteSpace: 'nowrap', width: '150px' }}>
                        ₹ {freights.reduce((sum, f) => sum + f.amt, 0).toFixed(2)}
                      </TableCell>
                    </TableRow>

                    {/* Amount Before Round Off */}
                    <TableRow>
                      <TableCell sx={{ border: 0, py: 0.5, whiteSpace: 'nowrap' }}>
                        Amount Before Round Off:
                      </TableCell>
                      <TableCell align="right" sx={{ border: 0, py: 0.5, whiteSpace: 'nowrap', width: '150px' }}>
                        ₹ {selectedOrder.totalAmount?.toFixed(2) || '0.00'}
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell sx={{ border: 0, py: 0.5, whiteSpace: 'nowrap' }}>
                        AP Round Off:
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          autoComplete="off"
                          type="text"
                          value={apRoundOff}
                          onChange={handleApRoundOffChange}
                          onBlur={handleApRoundOffBlur}
                          onFocus={(e) => e.target.select()} // Select all text when clicked
                          placeholder="0.00"
                          size="small"
                          variant="outlined"
                          error={!!apRoundOffError}
                          helperText={apRoundOffError || ''}
                          sx={{
                            width: '100px',
                            '& .MuiInputBase-input': {
                              textAlign: 'right',
                              padding: '10px 12px',
                              fontSize: '1rem'
                            }
                          }}
                        />
                      </TableCell>
                    </TableRow>
                    {/* Final Invoice Amount - Highlighted */}
                    <TableRow sx={{ backgroundColor: '#e8f5e8' }}>
                      <TableCell sx={{ border: 0, py: 1, whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                        Final Invoice Amount:
                      </TableCell>
                      <TableCell align="right" sx={{ border: 0, py: 1, whiteSpace: 'nowrap', color: 'success.main' }}>
                        <strong style={{ fontSize: '1.25em' }}>
                          ₹ {(
                            (selectedOrder.totalAmount || 0) +
                            parseFloat(apRoundOff || '0')
                          ).toFixed(2)}
                        </strong>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </>
            )}
          </DialogContent>

          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button onClick={handleDialogClose} color="inherit">
              Close
            </Button>
            <Button onClick={handleOpenMovePendingDialog} variant="outlined" color="primary">
              Move to Pending
            </Button>
            <Button
              onClick={handleOpenConvertConfirmation}
              variant="contained"
              color="success"
              disabled={conversionLoading || !apInvoiceNo.trim() || !apInvoiceDate}
              startIcon={conversionLoading ? <CircularProgress size={20} /> : <CheckIcon />}
            >
              {conversionLoading ? 'Converting...' : 'Convert to AP Invoice'}
            </Button>
          </DialogActions>
        </Dialog>
        {/* FINAL CONFIRMATION DIALOG */}
        <Dialog open={openConvertConfirmation} onClose={() => !conversionLoading && setOpenConvertConfirmation(false)}>
          <DialogTitle>Confirm Conversion to AP Invoice</DialogTitle>
          <DialogContent>
            {conversionError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {conversionError}
              </Alert>
            )}
            <DialogContentText>
              Are you sure you want to convert this service order to AP Invoice?
              <br /><br />
              <strong>Service ID:</strong> {selectedOrder?.serviceId}<br />
              <strong>Invoice No:</strong> {apInvoiceNo}<br />
              <strong>Invoice Date:</strong> {apInvoiceDate ? format(new Date(apInvoiceDate), 'dd-MM-yyyy') : ''}<br />
              <strong>Round Off:</strong> ₹ {apRoundOff || '0.00'}
              <br /><br />
              This action <strong>cannot be undone</strong>.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setOpenConvertConfirmation(false)}
              disabled={conversionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmConvertToAP}
              variant="contained"
              color="success"
              disabled={conversionLoading}
              startIcon={conversionLoading ? <CircularProgress size={20} /> : null}
            >
              {conversionLoading ? 'Converting...' : 'Yes, Convert to AP'}
            </Button>
          </DialogActions>
        </Dialog>
        {/* Final Confirmation Dialog
        <Dialog open={openConvertConfirmation} onClose={() => setOpenConvertConfirmation(false)}>
          <DialogTitle>Confirm Convert to AP</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to convert Service Order <strong>{selectedOrder?.serviceId}</strong> to AP Invoice?
              <br /><br />
              This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenConvertConfirmation(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmConvertToAP}
              variant="contained"
              color="success"
              disabled={conversionLoading}
            >
              Yes, Convert
            </Button>
          </DialogActions>
        </Dialog> */}

        {/* MOVE TO PENDING DIALOG */}
        <Dialog open={openMovePendingDialog} onClose={handleCloseMovePendingDialog}>
          <DialogTitle>Confirm Move to Pending</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to move this service order back to Pending?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseMovePendingDialog} color="primary">
              Cancel
            </Button>
            <Button onClick={handleConfirmMovePending} color="primary">
              Confirm
            </Button>
          </DialogActions>
        </Dialog>

        {/* VENDORWISE EXPORT DIALOG */}
        <Dialog open={dialogDownloadOpen} onClose={() => setDialogDownloadOpen(false)}>
          <DialogTitle>Select Export Format</DialogTitle>
          <DialogContent>
            Choose whether you want to download the report as a CSV file or generate a PDF.
          </DialogContent>
          <DialogActions>
            <Button onClick={handleExportCSV} variant="contained" color="primary" startIcon={<DescriptionIcon />}>
              Download CSV
            </Button>
            <Button onClick={generatePDF} variant="contained" color="secondary" startIcon={<PictureAsPdfIcon />}>
              Generate PDF
            </Button>
            <Button onClick={() => setDialogDownloadOpen(false)} variant="outlined">Cancel</Button>
          </DialogActions>
        </Dialog>
        {/* <FreightSelectionDialog
          open={openFreightDialog}
          onClose={() => setOpenFreightDialog(false)}
          onAddFreights={(newFreights: FreightData[]) => {
            setFreights(newFreights);
            setOpenFreightDialog(false);
          }}
          existingFreights={freights}
        /> */}
        {/* DESCRIPTIONWISE EXPORT DIALOG */}
        <Dialog open={dialogSummaryOpen} onClose={() => setDialogSummaryOpen(false)}>
          <DialogTitle>Export Options</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Please choose whether you want to export the data as a CSV or generate a PDF.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={generateSummaryCSV} variant="contained" color="secondary" startIcon={<DescriptionIcon />}>
              Export CSV
            </Button>
            <Button onClick={generateSummaryPDF} variant="contained" color="primary" startIcon={<PictureAsPdfIcon />}>
              Generate PDF
            </Button>
            <Button variant="outlined" onClick={() => setDialogSummaryOpen(false)}>Cancel</Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbarOpen}
          message={snackbarMessage}
          autoHideDuration={3000}
          onClose={handleCloseSnackbar}
        />
      </Box>
    </Box>
  );
};

export default React.memo(ApprovedService);