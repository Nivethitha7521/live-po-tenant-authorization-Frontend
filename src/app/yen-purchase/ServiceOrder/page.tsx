"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/redux/store';
import { format } from 'date-fns';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';
import { Add as AddIcon } from '@mui/icons-material';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ClearIcon from "@mui/icons-material/Clear";
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
  Divider
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ServiceData, ServiceDescription } from '../ServiceOrder/Models/servicepo';
import { VendorSearch } from '@/Models/vendor';
import YenPurchasePage from '../page';
import jsPDF from "jspdf";
import "jspdf-autotable";
import {
  fetchServices,
  selectServiceState,
  setSnackbarMessage,
  setSnackbarOpen,
  approveServiceOrder,
  rejectServiceOrder
} from '../ServiceOrder/Features/servicepo';
import { fetchBusinesses, selectBusinesses } from '@/features/account-setting/businessSlice';
import Papa from 'papaparse';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import DateRangeDialog from '@/components/dateRange';
import moment from 'moment';
import VendorSearchAutocomplete from '@/components/vendorsearchautocomplete';
import ServiceIdSearch from '../ServiceOrder/Components/ServiceIDSeacrh';
import { debounce } from 'lodash';

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
const getDescriptionsFromFlatArrays = (service: ServiceData): ServiceDescription[] => {
  const descriptions: ServiceDescription[] = [];

  const maxLength = Math.max(
    service.sacCode?.length || 0,
    service.from_dates?.length || 0,
    service.to_dates?.length || 0,
    service.fees?.length || 0,
    service.descriptions?.length || 0,
    service.quantity?.length || 0,
    service.desc_tax_pers?.length || 0,
    service.desc_tax_amounts?.length || 0
  );

  for (let i = 0; i < maxLength; i++) {
    const totalInclusive = service.fees?.[i] || 0; // This is amount INCLUDING tax
    const taxAmount = service.desc_tax_amounts?.[i] || 0;
    const taxPercent = service.desc_tax_pers?.[i] || 0;

    // Calculate base amount (excluding tax) accurately
    let baseAmount = totalInclusive;
    if (taxPercent > 0) {
      baseAmount = Number((totalInclusive * 100 / (100 + taxPercent)).toFixed(2));
    }
    // If taxAmount is available and more reliable, use subtraction (fallback)
    if (taxAmount > 0 && Math.abs(totalInclusive - taxAmount - baseAmount) > 1) {
      baseAmount = Number((totalInclusive - taxAmount).toFixed(2));
    }

    const descriptionText =
      service.descriptions?.[i] ||
      service.descriptions?.[i] ||
      service.remarks?.[i] ||
      `Service ${i + 1}`;

    descriptions.push({
      id: service.desc_ids?.[i] || `desc-${i}`,
      sacCode: service.sacCode?.[i] || '',
      description: descriptionText,
      from_date: service.from_dates?.[i],
      to_date: service.to_dates?.[i],
      fee: totalInclusive, // Final amount (incl. tax)
      tax_type: service.desc_tax_types?.[i] as 'cgst_sgst' | 'igst' || 'cgst_sgst',
      tax_per: taxPercent,
      sgst: service.desc_sgst?.[i] || 0,
      cgst: service.desc_cgst?.[i] || 0,
      igst: service.desc_igst?.[i] || 0,
      total: totalInclusive, // Same as fee (incl. tax)
      taxAmount: taxAmount,
      base_amount: baseAmount, // Base before tax ← THIS IS KEY
      discountAmount: service.desc_discount_amounts?.[i] || 0,
      remarks: service.remarks?.[i] || '',
      quantity: service.quantity?.[i] || 0,
      totalFee: 0,
      finalFee: 0
    });
  }

  return descriptions;
};
const ServiceList: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const serviceOrder = useSelector(selectServiceState);
  const { services, loading, error, snackbarMessage, snackbarOpen } = serviceOrder;
  const { businesses } = useSelector(selectBusinesses);

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [selectedMongoId, setSelectedMongoId] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectionRange, setSelectionRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    key: 'selection',
  });
  const [selectedVendor, setSelectedVendor] = useState<VendorSearch | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [dialogDownloadOpen, setDialogDownloadOpen] = useState(false);
  const [dialogSummaryOpen, setDialogSummaryOpen] = useState(false);

  // Fetch initial Pending services
  useEffect(() => {
    dispatch(fetchBusinesses());
    fetchPendingServices();
  }, [dispatch]);
  // Function to fetch services with current filters
  const fetchPendingServices = useCallback((additionalParams = {}) => {
    // Create params object
    const allParams = {
      status: 'Pending', // ALWAYS Pending for this page
      skip: 0,
      limit: 50,
      ...filters,
      ...additionalParams
    };

    // Clean empty params - TypeScript safe version
    const cleanedParams: Record<string, any> = {};

    Object.entries(allParams).forEach(([key, value]) => {
      if (value !== '' && value !== undefined) {
        cleanedParams[key] = value;
      }
    });

    dispatch(fetchServices(cleanedParams));
  }, [dispatch, filters]);

  // Debounced filter update
  const debouncedFetch = useMemo(
    () => debounce(fetchPendingServices, 500),
    [fetchPendingServices]
  );

  // Handle vendor change
  const handleVendorChange = useCallback((vendor: VendorSearch | null) => {
    setSelectedVendor(vendor);
    setFilters(prev => ({
      ...prev,
      vendorName: vendor ? vendor.vendorName : ''
    }));

    debouncedFetch({ vendorName: vendor ? vendor.vendorName : '' });
  }, [debouncedFetch]);


  // Update the handleServiceIdChange function:
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
    debouncedFetch(newFilters);
  }, [debouncedFetch]);

  // Clear all filters
  const handleFilterClose = useCallback(() => {
    setSelectionRange({
      startDate: new Date(),
      endDate: new Date(),
      key: 'selection',
    });
    setSelectedVendor(null);
    setSelectedServiceId(''); // Changed from selectedRandomId
    setFilters({
      vendorName: '',
      serviceId: '',
      fromDate: '',
      toDate: '',
      workOrderFrom: '',
      workOrderTo: ''
    });

    // Fetch only Pending without filters
    dispatch(fetchServices({ status: 'Pending', skip: 0, limit: 50 }));
  }, [dispatch]);

  // Optimized table rendering - Only show Pending
  const memoizedServices = useMemo(() => {
    // Backend already filters by Pending, but double-check
    return services.filter(service => service.status === 'Pending');
  }, [services]);

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

      // Get descriptions with proper fallback handling
      const descriptions = getDescriptionsFromFlatArrays(selected);
      setSelectedDescriptions(descriptions);

      // Log for debugging
      console.log('Selected service:', selected);
      console.log('Generated descriptions:', descriptions);

      setDialogOpen(true);
    }
  };

  const handleEditClick = (mongoId: string) => {
    router.push(`/yen-purchase/ServiceOrder/CreateService?edit=${mongoId}`);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedOrder(null);
    setSelectedDescriptions([]);
  };

  const handleClose = () => {
    setDialogSummaryOpen(false);
  };

  const handleCloseDownload = () => {
    setDialogDownloadOpen(false);
  };

  const handleCloseSnackbar = () => {
    dispatch(setSnackbarOpen(false));
  };

  const handleCreateService = () => {
    router.push('/yen-purchase/ServiceOrder/CreateService');
  };

  const handleApproveDialogOpen = (mongoId: string) => {
    setSelectedMongoId(mongoId);
    setApproveOpen(true);
  };

  const handleApproveDialogClose = () => {
    setApproveOpen(false);
    setSelectedMongoId(null);
  };

  const handleRejectDialogOpen = (mongoId: string) => {
    setSelectedMongoId(mongoId);
    setRejectOpen(true);
  };

  const handleRejectDialogClose = () => {
    setRejectOpen(false);
    setSelectedMongoId(null);
  };

  const handleApproveService = async () => {
    if (!selectedMongoId) return;

    const selectedService = services.find((s: ServiceData) => s.mongoId === selectedMongoId);
    if (selectedService) {
      try {
        setApproveOpen(false);
        await dispatch(approveServiceOrder(selectedMongoId)).unwrap();

        dispatch(setSnackbarMessage(
          `Service Order ${selectedService.serviceId} approved successfully`
        ));
        dispatch(setSnackbarOpen(true));

        // Refresh the list - only Pending services
        fetchPendingServices();
      } catch (error: any) {
        console.error('Failed to approve:', error);
        dispatch(setSnackbarMessage(
          error || 'Failed to approve service order'
        ));
        dispatch(setSnackbarOpen(true));
      }
    }
  };

  const handleRejectService = async () => {
    if (!selectedMongoId) return;

    const selectedService = services.find((s: ServiceData) => s.mongoId === selectedMongoId);
    if (selectedService) {
      try {
        setRejectOpen(false);
        await dispatch(rejectServiceOrder(selectedMongoId)).unwrap();

        dispatch(setSnackbarMessage(
          `Service Order ${selectedService.serviceId} rejected successfully`
        ));
        dispatch(setSnackbarOpen(true));

        // Refresh the list - only Pending services
        fetchPendingServices();
      } catch (error: any) {
        console.error('Failed to reject:', error);
        dispatch(setSnackbarMessage(
          error || 'Failed to reject service order'
        ));
        dispatch(setSnackbarOpen(true));
      }
    }
  };

  // Generate PDF for vendorwise report
  const generatePDF = () => {
    const doc = new jsPDF();
    let yOffset = 7;
    let pageCount = 1;
    const business = businesses[0] || null;
    if (!business) return;

    const addPageFooter = (currentPage: number, totalPages: number) => {
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      const pageText = `Page ${currentPage} of ${totalPages}`;
      const pageTextWidth = doc.getStringUnitWidth(pageText) * doc.getFontSize() / doc.internal.scaleFactor;
      const pageX = (pageWidth - pageTextWidth) / 2;
      doc.text(pageText, pageX, pageHeight - 10);
      const generatedText = 'This is computer generated';
      const generatedTextWidth = doc.getStringUnitWidth(generatedText) * doc.getFontSize() / doc.internal.scaleFactor;
      const generatedX = (pageWidth - generatedTextWidth) / 2;
      doc.text(generatedText, generatedX, pageHeight - 5);
    };

    if (business.imageUrl) {
      doc.addImage(business.imageUrl, 'JPEG', 14, yOffset, 20, 20);
    }
    yOffset += 7;

    doc.setFontSize(12);
    const title = "Pending Service Orders - Vendor Summary";
    const pageWidth = doc.internal.pageSize.width;
    const titleWidth = doc.getStringUnitWidth(title) * doc.getFontSize() / doc.internal.scaleFactor;
    const titleX = (pageWidth - titleWidth) / 2;
    doc.text(title, titleX, yOffset);
    doc.line(titleX, yOffset + 2, titleX + titleWidth, yOffset + 2);
    yOffset += 13;

    const totalOrderedAmount = memoizedServices.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const today = new Date();
    const currentDate = format(today, 'dd/MM/yyyy');

    doc.setFontSize(10);
    const totalText = `Total Pending Amount: ${totalOrderedAmount.toFixed(2)}`;
    const dateText = `Date: ${currentDate}`;
    const dateWidth = doc.getStringUnitWidth(dateText) * 10 / doc.internal.scaleFactor;
    doc.text(totalText, 14, yOffset);
    doc.text(dateText, pageWidth - dateWidth - 14, yOffset);
    yOffset += 5;

    const headers = [["S.No", "Service ID", "Vendor Name", "Total Descriptions", "Order Date", "Total Amount", "Status"]];
    const rows = memoizedServices.map((service: ServiceData, index: number) => {
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
      headStyles: { fillColor: [0, 0, 128], textColor: [255, 255, 255], fontSize: 8, halign: 'center' },
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
        addPageFooter(pageCount++, doc.getNumberOfPages());
      },
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addPageFooter(i, totalPages);
    }

    doc.save('Pending_Service_Orders_Vendorwise.pdf');
    setDialogDownloadOpen(false);
  };

  const handleExportCSV = () => {
    const headers = 'SNO,Service ID,Vendor Name,Total Descriptions,Order Date,Total Amount,Status\n';
    const rows = memoizedServices.map((service: ServiceData, index: number) => {
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
    link.setAttribute('download', 'Pending_Service_Orders_Vendorwise.csv');
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

    const addPageFooter = (currentPage: number, totalPages: number) => {
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      const pageText = `Page ${currentPage} of ${totalPages}`;
      const pageTextWidth = doc.getStringUnitWidth(pageText) * doc.getFontSize() / doc.internal.scaleFactor;
      const pageX = (pageWidth - pageTextWidth) / 2;
      doc.text(pageText, pageX, pageHeight - 10);
      const generatedText = 'This is computer generated';
      const generatedTextWidth = doc.getStringUnitWidth(generatedText) * doc.getFontSize() / doc.internal.scaleFactor;
      const generatedX = (pageWidth - generatedTextWidth) / 2;
      doc.text(generatedText, generatedX, pageHeight - 5);
    };

    if (business.imageUrl) {
      doc.addImage(business.imageUrl, 'JPEG', 14, yOffset, 20, 20);
    }
    yOffset += 10;

    doc.setFontSize(12);
    const title = "Pending Service Orders - Detailed Summary";
    const pageWidth = doc.internal.pageSize.width;
    const titleWidth = doc.getStringUnitWidth(title) * doc.getFontSize() / doc.internal.scaleFactor;
    const titleX = (pageWidth - titleWidth) / 2;
    doc.text(title, titleX, yOffset);
    doc.setLineWidth(0.1);
    doc.line(titleX, yOffset + 2, titleX + titleWidth, yOffset + 2);
    yOffset += 15;

    const totalOrderedAmount = memoizedServices.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const today = new Date();
    const currentDate = format(today, 'dd/MM/yyyy');

    doc.setFontSize(10);
    const totalText = `Total Pending Amount: ${totalOrderedAmount.toFixed(2)}`;
    const dateText = `Date: ${currentDate}`;
    const dateWidth = doc.getStringUnitWidth(dateText) * 10 / doc.internal.scaleFactor;
    doc.text(totalText, 14, yOffset);
    doc.text(dateText, pageWidth - dateWidth - 14, yOffset);
    yOffset += 5;

    const headers = [["S.No", "Service No", "Vendor Name", "Description", "From Date", "To Date", "Fee", "Tax %", "Total"]];
    const rows = memoizedServices.map((service: ServiceData, sIndex: number) => {
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
      headStyles: { fillColor: [0, 0, 128], textColor: [255, 255, 255], fontSize: 8, halign: 'center' },
      bodyStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0] },
      columnStyles: {
        6: { halign: 'right' },
        7: { halign: 'center' },
        8: { halign: 'right' },
      },
      didDrawPage: (data: AutoTableHookData) => {
        addPageFooter(pageCount++, doc.getNumberOfPages());
      },
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addPageFooter(i, totalPages);
    }

    doc.save('Pending_Service_Orders_Descriptionwise.pdf');
    handleClose();
  };

  const generateSummaryCSV = () => {
    const headers = ["S.No", "Service No", "Vendor Name", "Description", "From Date", "To Date", "Fee", "Tax %", "Total"];
    const rows = memoizedServices.map((service: ServiceData, sIndex: number) => {
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
    link.setAttribute("download", "Pending_Service_Orders_Descriptionwise.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    handleClose();
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
        <Grid container spacing={2} sx={{ mb: 1 }}>
          <Grid item xs={12} display="flex" alignItems="center">
            <Link href="/yen-purchase/ServiceOrder" passHref>
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
                Pending
              </Button>
            </Link>
            <Link href="/yen-purchase/ServiceOrder/ApprovedService" passHref>
              <Button variant="contained" sx={{ marginLeft: '10px' }} color="primary">
                Approved
              </Button>
            </Link>
            <Button
              variant="contained"
              color="primary"
              sx={{ marginLeft: '10px', marginRight: '10px' }}
              onClick={() => router.push('/yen-purchase/ServiceOrder/RejectedService')}
            >
              Rejected
            </Button>
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
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={handleCreateService}
                size="small"
                sx={{ minHeight: 40 }}
              >
                Create Service
              </Button>
            </Box>
          </Grid>

          <Grid item xs="auto">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <IconButton
                onClick={handleClick}
                color="primary"
                className="icon-button-outline"
                size="small"
                sx={{ p: 0.3 }}
                disabled={!memoizedServices.length}
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

        {/* VIEW DETAILS DIALOG - ULTRA SIMPLIFIED */}
        <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="md" fullWidth={true}>
          <DialogTitle>
            Service Order Details - {selectedOrder?.serviceId || ''}
          </DialogTitle>

          <DialogContent dividers>
            {/* Table */}
            <Typography variant="h6" gutterBottom>Service Descriptions</Typography>
            <TableContainer component={Paper} sx={{ mb: 3 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><b>S.No</b></TableCell>
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
                      <TableCell>{desc.description}</TableCell>
                      <TableCell>
                        {desc.from_date ? format(new Date(desc.from_date), 'dd-MM-yyyy') : ''}
                      </TableCell>
                      <TableCell>
                        {desc.to_date ? format(new Date(desc.to_date), 'dd-MM-yyyy') : ''}
                      </TableCell>
                      <TableCell align="right">{desc.base_amount.toFixed(2)}</TableCell>
                      <TableCell align="center">{desc.tax_per}%</TableCell>
                      <TableCell align="right">{desc.fee.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* SIMPLE SUMMARY */}
            {selectedOrder && (
              <>
                <Typography variant="h6" gutterBottom>Order Summary</Typography>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography>Total Service Fee:</Typography>
                  <Typography fontWeight="bold">
                    ₹ {selectedDescriptions.reduce((sum, desc) => sum + desc.fee, 0).toFixed(2)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography>Freight Amount:</Typography>
                  <Typography fontWeight="bold">
                    {selectedOrder.totalFreightAmount}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography>Total Tax:</Typography>
                  <Typography fontWeight="bold">
                    {selectedOrder.totalTax}
                  </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6">Grand Total:</Typography>
                  <Typography variant="h5" fontWeight="bold" color="primary">
                    ₹ {selectedOrder.totalAmount?.toFixed(2) || '0.00'}
                  </Typography>
                </Box>
              </>
            )}
          </DialogContent>

          <DialogActions>
            <Button onClick={handleDialogClose} color="primary">Close</Button>
          </DialogActions>
        </Dialog>

        {/* VENDORWISE EXPORT DIALOG */}
        <Dialog open={dialogDownloadOpen} onClose={handleCloseDownload}>
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
            <Button onClick={handleCloseDownload} variant="outlined">Cancel</Button>
          </DialogActions>
        </Dialog>

        {/* DESCRIPTIONWISE EXPORT DIALOG */}
        <Dialog open={dialogSummaryOpen} onClose={handleClose}>
          <DialogTitle>Export Options</DialogTitle>
          <DialogContent>
            <DialogContentText>Please choose whether you want to export the data as a CSV or generate a PDF.</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={generateSummaryCSV} variant="contained" color="secondary" startIcon={<DescriptionIcon />}>
              Export CSV
            </Button>
            <Button onClick={generateSummaryPDF} variant="contained" color="primary" startIcon={<PictureAsPdfIcon />}>
              Generate PDF
            </Button>
            <Button variant="outlined" onClick={handleClose}>Cancel</Button>
          </DialogActions>
        </Dialog>

        {/* APPROVE DIALOG */}
        <Dialog open={approveOpen} onClose={handleApproveDialogClose}>
          <DialogTitle>Approve Service Order</DialogTitle>
          <DialogContent>
            <Typography>Are you sure you want to approve this order?</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleApproveDialogClose} color="primary">Cancel</Button>
            <Button onClick={handleApproveService} color="primary">Approve</Button>
          </DialogActions>
        </Dialog>

        {/* REJECT DIALOG */}
        <Dialog open={rejectOpen} onClose={handleRejectDialogClose}>
          <DialogTitle>Reject Service Order</DialogTitle>
          <DialogContent>
            <Typography>Are you sure you want to reject this order?</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleRejectDialogClose} color="primary">Cancel</Button>
            <Button onClick={handleRejectService} color="primary">Reject</Button>
          </DialogActions>
        </Dialog>

        {/* MAIN TABLE */}
        <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 245px)', overflowY: 'auto', width: '100%', mt: 0.7 }}>
          <Table stickyHeader sx={{ tableLayout: 'fixed', width: '100%' }}>
            <TableHead>
              <TableRow>
                <TableCell key="sno">S.No</TableCell>
                <TableCell key="id">Service ID</TableCell>
                <TableCell key="vendor">Vendor Name</TableCell>
                <TableCell key="descriptions">Total Descriptions</TableCell>
                <TableCell key="amount">Total Amount</TableCell>
                <TableCell key="status">Status</TableCell>
                <TableCell key="actions">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {memoizedServices.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center">No pending services found.</TableCell></TableRow>
              ) : (
                memoizedServices.map((service: ServiceData, index: number) => (
                  <TableRow key={service.serviceId}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{service.serviceId}</TableCell>
                    <TableCell>{service.vendorName}</TableCell>
                    <TableCell>
                      {getDescriptionsFromFlatArrays(service).length}
                    </TableCell>
                    <TableCell align="right">{(service.totalAmount || 0).toFixed(2)}</TableCell>
                    <TableCell> {service.status} </TableCell>
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

                        <Tooltip title="Edit Order">
                          <IconButton
                            onClick={() => handleEditClick(service.mongoId)}
                            color='primary'
                            sx={{ mr: 1 }}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Approve Order">
                          <IconButton
                            onClick={() => handleApproveDialogOpen(service.mongoId)}
                            sx={{ mr: 1 }}
                            color='primary'
                          >
                            <CheckIcon />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Reject Order">
                          <IconButton
                            onClick={() => handleRejectDialogOpen(service.mongoId)}
                            sx={{ mr: 1 }}
                            color='primary'
                          >
                            <CloseIcon />
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

export default React.memo(ServiceList);