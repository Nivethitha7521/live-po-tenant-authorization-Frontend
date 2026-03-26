"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
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
  FormControl,
  InputLabel,
  Select,
  Chip,Alert
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';
import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from '@mui/icons-material/Search';
import { AppDispatch, RootState } from '@/redux/store';
import {
  returnServiceInvoice,
  selectReturnServiceLoading,
  selectReturnServiceError,
  clearReturnServiceState,
} from '../ServiceOrder/Features/servicelist';
import {
  fetchApInvoices,
  selectApinvoice,
  convertToGrnFromApReturned,
  updateApdiscountInvoice,
  setPagination,
  setSnackbarMessage,
  setSnackbarOpen,
  clearSnackbarMessage,
  setSearchQuery,
  selectTotalItems,
  selectCurrentPage,
  selectPageSize,
  fetchApStatuses,
  selectStatuses,
  selectStatusesLoading,
  selectHasMoreStatuses,
  resetStatuses,
  setSelectedStatus,
  clearStatus,
  setStatusSearch,
  loadMoreStatuses,
  resetAll,
  setCurrentPage,
} from '../../../features/yen-purchase/AP/apInvoiceSlice';
import YenPurchasePage from '../page';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import Link from 'next/link';
import { ApInvoice } from '@/Models/apModel';
import DateRangeFilter from '@/components/agingFilter';
import jsPDF from 'jspdf';
import "jspdf-autotable";
import { fetchBusinesses, fetchPhoto, selectBusinesses } from '@/features/account-setting/businessSlice';
import { addDays, format, parse } from 'date-fns';
import Papa from 'papaparse';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import DateRangeDialog from '@/components/dateRange';
import { Vendor } from '@/Models/purchaseModel';
import { fetchAllVendors, selectPurchaseOrderState } from '@/features/yen-purchase/PurchaseOrder/purchaseOrderSlice';
import moment from 'moment';
import VendorSearchAutocomplete from '@/components/vendorsearchautocomplete';
import { VendorSearch } from '@/Models/vendor';
import { fetchAllDebitNotesForDocument, selectDebitCreditNote, setDebitCreditDialogOpen, setDebitCreditDocumentId, setDebitCreditDocumentType } from '@/features/yen-purchase/DebitNoteSlice';
import DebitCreditNoteDialog from '@/components/yen-purchase/DebitNoteDialog';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { debounce } from 'lodash';
import { usePathname } from "next/navigation";
import { GrnResponse, ItemDetail, ItemDetailResponse } from '@/Models/grnModel';
import { fetchGrnById, selectGrn } from '@/features/yen-purchase/GRN/grnSlice';
import { fetchPoById, selectPurchaseListState, setPoDialogOpen, setSelectedPo } from '@/features/yen-purchase/PurchaseOrder/purchaseListSlice';
import { ItemDetailResponsePO, PoResponse } from '@/Models/purchaseModel';
import { fetchServiceById } from '@/app/yen-purchase/ServiceOrder/Features/servicelist';
import { ServiceData } from '@/app/yen-purchase/ServiceOrder/Models/servicepo';
import GrnDialog from '@/components/yen-purchase/OutgoingComponent/GRNDialog';
import PODialog from '@/components/yen-purchase/OutgoingComponent/PODialog';
import ServiceDialog from '@/app/yen-purchase/ServiceOrder/Components/ServiceDialog';

interface TaxAmounts {
  sgst: { [key: string]: number };
  cgst: { [key: string]: number };
  igst: { [key: string]: number };
}



const VerifiedApInvoicePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const pathname = usePathname() ?? "";
  const isApListActive =
    pathname.startsWith("/yen-purchase/ApInvoicePage") &&
    !pathname.startsWith("/yen-purchase/ApInvoicePage/ReturnAp");

  const isReturnApActive = pathname.startsWith(
    "/yen-purchase/ApInvoicePage/ReturnAp",
  );
  const apPermission = useSelector(
    (state: RootState) => state.auth.permissions?.yenerp?.apinvoices,
  );
  const returnPermission = useSelector(
    (state: RootState) => state.auth.permissions?.yenerp?.apinvoices_return,
  );

  const canReturnRead = returnPermission?.read ?? false;
  const isReturnHidden = returnPermission?.hide ?? false;
  const canRead = apPermission?.read ?? false;
  const canEdit = apPermission?.edit ?? false;
  const isModuleHidden =
    !apPermission ||
    apPermission.hide === true ||
    apPermission.hide === 1 ||
    (!apPermission.read &&
      !apPermission.add &&
      !apPermission.edit &&
      !apPermission.delete &&
      !apPermission.approve);
  // State from Redux
  const {
    apInvoices,
    loading,
    error,
    snackbarOpen,
    snackbarMessage,
    selectedStatus,
    statusSearch
  } = useSelector(selectApinvoice);

  const { businesses } = useSelector(selectBusinesses);
  const statuses = useSelector(selectStatuses);
  const statusesLoading = useSelector(selectStatusesLoading);
  const hasMoreStatuses = useSelector(selectHasMoreStatuses);
  const currentPage = useSelector(selectCurrentPage);
  const pageSize = useSelector(selectPageSize);
  const totalItems = useSelector(selectTotalItems);

  // Local state
  const [selectedInvoice, setSelectedInvoice] = useState<ApInvoice | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [outgoingDialogOpen, setOutgoingDialogOpen] = useState(false);
  const [loadingCenter, setLoading] = useState(false);
  const returnServiceLoading = useSelector(selectReturnServiceLoading);
const returnServiceError = useSelector(selectReturnServiceError);
const [returnRemarks, setReturnRemarks] = useState('');
  const [fetchedBusinessIds, setFetchedBusinessIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendorName, setSelectedVendorName] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<VendorSearch | null>(null);
  const [filteredAp, setFilteredAp] = useState<ApInvoice[]>([]); // Explicit type declaration
  const { selectedPo, poDialogOpen } = useSelector(selectPurchaseListState);
  const [selectedService, setSelectedService] = useState<ServiceData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDownloadOpen, setDialogDownloadOpen] = useState(false);
  const [dialogSummaryOpen, setDialogSummaryOpen] = useState(false);
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<string>('all');
  const [anchorElDownload, setAnchorElDownload] = useState<null | HTMLElement>(null);
  const [selectionRange, setSelectionRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    key: 'selection',
  });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [selectedGrn, setSelectedGrn] = useState<GrnResponse | null>(null);
  const [viewItemsDialogOpen, setViewItemsDialogOpen] = useState(false);

  const debitCreditNotes = useSelector((state: RootState) => selectDebitCreditNote(state).debitCreditNotes);
  const dateField = 'apinvoiceDate';
  const appliedFromDate = useMemo(() =>
    selectionRange?.startDate instanceof Date && selectionRange.startDate
      ? moment(selectionRange.startDate).startOf('day').toISOString()
      : undefined,
    [selectionRange]
  );

  const appliedToDate = useMemo(() =>
    selectionRange?.endDate instanceof Date && selectionRange.endDate
      ? moment(selectionRange.endDate).endOf('day').toISOString()
      : undefined,
    [selectionRange]
  );
  const totalPages = useMemo(() => {
    if (totalItems === 0) return 1;
    return Math.ceil(totalItems / pageSize);
  }, [totalItems, pageSize]);
  // Debounced search for statuses
  const debouncedStatusSearch = useMemo(
    () =>
      debounce((searchTerm: string) => {
        dispatch(resetStatuses());
        dispatch(fetchApStatuses({ search: searchTerm, page: 1 }));
      }, 300),
    [dispatch]
  );
  const initialSelectionRange = useMemo(() => ({
    startDate: new Date(),
    endDate: new Date(),
    key: 'selection',
  }), []);


  const isDateFilterActive = useMemo(() => {
    // If you have initial/default dates, compare with them
    const defaultStartDate = new Date();
    const defaultEndDate = new Date();

    const isStartDifferent = selectionRange.startDate.getTime() !== defaultStartDate.getTime();
    const isEndDifferent = selectionRange.endDate.getTime() !== defaultEndDate.getTime();

    return isStartDifferent || isEndDifferent;
  }, [selectionRange]);
  // Update the initial fetch in the useEffect
  useEffect(() => {
    const initializeData = async () => {
      dispatch(fetchBusinesses());
      dispatch(fetchAllVendors());
      dispatch(fetchApStatuses({ page: 1 }));

      // Fetch initial AP invoices WITHOUT date filters
      dispatch(fetchApInvoices({
        page: 1,
        limit: pageSize,
        // Don't include date filters initially
      }));

      setIsInitialLoad(false);
    };

    initializeData();

   return () => {
  dispatch(resetStatuses());
  dispatch(clearReturnServiceState());
};
  }, [dispatch, pageSize]); // Add pageSize dependency
  useEffect(() => {
    // Don't fetch on initial load
    if (isInitialLoad) return;

    // Debounce the fetch to avoid too many requests
    const timer = setTimeout(() => {
      refetchWithFilters();
    }, 300);

    return () => clearTimeout(timer);
  }, [selectedStatus, dispatch]); // Watch for status changes
  // Handle return service success
  useEffect(() => {
    if (!returnServiceLoading && returnServiceError === null && returnDialogOpen) {
      // Success - close dialogs and refresh
      setReturnDialogOpen(false);
      setDetailsDialogOpen(false);
      dispatch(setSnackbarMessage('Service invoice returned successfully'));
      dispatch(setSnackbarOpen(true));
      refetchWithFilters();
      setReturnRemarks('');
    }
  }, [returnServiceLoading, returnServiceError, dispatch, returnDialogOpen]);

  // Handle return service error
  useEffect(() => {
    if (returnServiceError) {
      dispatch(setSnackbarMessage(returnServiceError));
      dispatch(setSnackbarOpen(true));
    }
  }, [returnServiceError, dispatch]);
  // Fetch business photos
  useEffect(() => {
    businesses.forEach((business) => {
      if (!fetchedBusinessIds.has(business.businessId)) {
        dispatch(fetchPhoto(business.businessId));
        setFetchedBusinessIds(prevSet => new Set(prevSet).add(business.businessId));
      }
    });
  }, [businesses, fetchedBusinessIds, dispatch]);
  // Sync pagination when filters change
  useEffect(() => {
    if (totalItems > 0) {
      const calculatedTotalPages = Math.ceil(totalItems / pageSize);

      // If current page is greater than total pages, reset to page 1
      if (currentPage > calculatedTotalPages) {
        console.log(`Resetting page from ${currentPage} to 1 because total pages is ${calculatedTotalPages}`);
        dispatch(setCurrentPage(1));

        // Refetch data for page 1
        dispatch(fetchApInvoices({
          page: 1,
          limit: pageSize,
          date_filter_field: dateField,
          fromDate: appliedFromDate,
          toDate: appliedToDate,
          vendorName: selectedVendorName || '',
          invoiceType: invoiceTypeFilter === 'all' ? undefined : invoiceTypeFilter,
          status: selectedStatus || '',
        }));
      }
    }
  }, [totalItems, currentPage, pageSize, dispatch, dateField, appliedFromDate, appliedToDate, selectedVendorName, invoiceTypeFilter, selectedStatus]);
  // View Details handler
  // View Details handler
  const handleViewDetails = (invoice: ApInvoice) => {
    setSelectedInvoice(invoice);
    setDetailsDialogOpen(true);
    setReturnRemarks('');
  };
  const refetchWithFilters = useCallback((

    page: number = currentPage,
    fromDateOverride?: string,
    toDateOverride?: string
  ) => {
    const filters: any = {
      page,
      limit: pageSize,
    };

    // Use override if provided (from date picker), else use current selection
    const fromDate = fromDateOverride
      ?? (selectionRange.startDate ? moment(selectionRange.startDate).startOf('day').toISOString() : undefined);
    const toDate = toDateOverride
      ?? (selectionRange.endDate ? moment(selectionRange.endDate).endOf('day').toISOString() : undefined);

    // Only add date filters if both dates exist
    if (fromDate && toDate) {
      filters.date_filter_field = dateField;
      filters.fromDate = fromDate;
      filters.toDate = toDate;
    }

    if (selectedVendorName) filters.vendorName = selectedVendorName;
    if (invoiceTypeFilter !== 'all') filters.invoiceType = invoiceTypeFilter;
    if (selectedStatus && selectedStatus.trim() !== '') filters.status = selectedStatus;

    dispatch(setCurrentPage(page));
    dispatch(fetchApInvoices(filters));
  }, [
    dispatch, pageSize, currentPage,
    selectionRange, selectedVendorName, invoiceTypeFilter, selectedStatus
  ]);

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage < 1 || newPage > totalPages || loading) return;

    const filters: any = {
      page: newPage,
      limit: pageSize,
    };

    {
      !(moment(selectionRange.startDate).isSame(moment(), 'day') &&
        moment(selectionRange.endDate).isSame(moment(), 'day')) && (
          <Chip label="Date Filtered" color="primary" size="small" />
        )
    }

    // Add other filters
    if (selectedVendorName) filters.vendorName = selectedVendorName;
    if (invoiceTypeFilter !== 'all') filters.invoiceType = invoiceTypeFilter;
    if (selectedStatus && selectedStatus.trim() !== '') filters.status = selectedStatus;

    console.log('Page change with filters:', filters);

    dispatch(setCurrentPage(newPage));
    dispatch(fetchApInvoices(filters));
  }, [dispatch, pageSize, totalPages, loading, selectionRange, selectedVendorName, invoiceTypeFilter, selectedStatus]);
  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, handlePageChange]);

  const handlePreviousPage = useCallback(() => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  }, [currentPage, handlePageChange]);


  // View Credit Notes handler
  const handleViewCreditNotes = async (invoiceId: string) => {
    console.log('Opening DebitCreditNoteDialog for AP Invoice ID:', invoiceId);

    try {
      const invoice = apInvoices.find(inv => inv.invoiceId === invoiceId);
      if (!invoice) {
        console.error('Invoice not found:', invoiceId);
        return;
      }

      // Set document details
      dispatch(setDebitCreditDocumentId(invoiceId));
      dispatch(setDebitCreditDocumentType('ap_invoice'));

      // Open the dialog
      dispatch(setDebitCreditDialogOpen(true));

      // Fetch data with the required document_type parameter
      dispatch(fetchAllDebitNotesForDocument({
        documentId: invoiceId,
        documentType: 'ap_invoice',
        includeCleared: true,
        includeActive: true
      })).then((result) => {
        if (fetchAllDebitNotesForDocument.fulfilled.match(result)) {
          console.log('✅ Debit notes loaded successfully');
        } else {
          console.error('❌ Failed to load debit notes');
        }
      });

    } catch (error) {
      console.error('Error in handleViewCreditNotes:', error);
    }
  };

  const handleCloseDetailsDialog = () => {
    setDetailsDialogOpen(false);
    setSelectedInvoice(null);
    setReturnRemarks('');
  };

  const handleOpen = () => {
    setDialogSummaryOpen(true);
  };

  const handleClose = () => {
    setDialogSummaryOpen(false);
  };

  // Credit note status calculation
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
  const handleStatusChange = (event: React.SyntheticEvent, newValue: string | null) => {
    console.log('Status changed:', newValue);

    if (newValue === null) {
      dispatch(clearStatus());
      // Wait a bit before refetching to ensure state is cleared
      setTimeout(() => {
        refetchWithFilters();
      }, 100);
    } else {
      dispatch(setSelectedStatus(newValue));
      // Immediately refetch with new status
      setTimeout(() => {
        refetchWithFilters();
      }, 100);
    }
  };

  // Vendor change handler
  const handleVendorChange = (vendor: VendorSearch | null) => {
    setSelectedVendor(vendor);
    setSelectedVendorName(vendor ? vendor.vendorName : '');
  };

  // Invoice Type filter change handler
  const handleInvoiceTypeChange = (value: string) => {
    setInvoiceTypeFilter(value);
  };
  const handleFilterClick = () => {
    if (!canRead) return;
    dispatch(setCurrentPage(1));

    const fromDate = selectionRange.startDate
      ? moment(selectionRange.startDate).startOf('day').toISOString()
      : undefined;
    const toDate = selectionRange.endDate
      ? moment(selectionRange.endDate).endOf('day').toISOString()
      : undefined;

    refetchWithFilters(1, fromDate, toDate);
  };
  const handleFilterClose = () => {
    const today = new Date();
    setSelectionRange({
      startDate: today,
      endDate: today,
      key: 'selection',
    });

    setSelectedVendor(null);
    setSelectedVendorName('');
    setInvoiceTypeFilter('all');
    dispatch(clearStatus());

    dispatch(setCurrentPage(1));

    // Explicitly refetch WITHOUT date filters
    dispatch(fetchApInvoices({
      page: 1,
      limit: pageSize,
      vendorName: undefined,
      invoiceType: undefined,
      status: undefined,
      // No date_filter_field, fromDate, toDate → backend ignores date filter
    }));
  };  // Download handlers
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
    handleOpen();
    handleCloseAnchor();
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
        `Billing Address: ${apinvoice.shippingAddress}`,
        `PO No: ${apinvoice.poRandomId}\n` +
        `GRN No: ${apinvoice.grnRandomId}\n` +
        `AP No: ${apinvoice.randomId}\n` +
        `Invoice No: ${apinvoice.invoiceNo}\n` +
        `Invoice Date: ${apinvoice.invoiceDate ? format(new Date(apinvoice.invoiceDate), 'dd-MM-yyyy') : ''}\n` +
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
      lineWidth: { top: 0, right: 0.1, bottom: 0, left: 0.1 },
    });

    yOffset += 45;

    if (apinvoice.invoiceType === 'service') {
      const serviceHeaders = ['SI No', 'Description', 'SAC Code', 'From Date', 'To Date', 'Quantity', 'Amount', 'Tax', 'Total'];

      const serviceRows = apinvoice.descriptions.map((desc, index) => {
        return [
          `${index + 1}`,
          desc || 'Service Description',
          apinvoice.sacCode[index] || '',
          apinvoice.from_dates[index] ? format(new Date(apinvoice.from_dates[index]), 'dd-MM-yyyy') : '',
          apinvoice.to_dates[index] ? format(new Date(apinvoice.to_dates[index]), 'dd-MM-yyyy') : '',
          (apinvoice.quantity[index] || 1).toString(),
          (apinvoice.fees[index] || 0).toFixed(2),
          (apinvoice.desc_tax_amounts[index] || 0).toFixed(2),
          (apinvoice.desc_totals[index] || 0).toFixed(2),
        ];
      });

      doc.autoTable({
        head: [serviceHeaders],
        body: serviceRows,
        startY: yOffset,
        theme: 'grid',
        styles: {
          fontSize: 8,
          halign: 'left', // Default left alignment
          cellPadding: 2,
        },
        columnStyles: {
          0: { halign: 'center' }, // SI No - center
          1: { halign: 'left' }, // Description - left
          2: { halign: 'center' }, // SAC Code - center
          3: { halign: 'center' }, // From Date - center
          4: { halign: 'center' }, // To Date - center
          5: { halign: 'right' }, // Quantity - RIGHT ALIGNED
          6: { halign: 'right' }, // Amount - RIGHT ALIGNED
          7: { halign: 'right' }, // Tax - RIGHT ALIGNED
          8: { halign: 'right' }, // Total - RIGHT ALIGNED
        },
        headStyles: {
          fillColor: [0, 0, 128],
          textColor: [255, 255, 255],
        },
        bodyStyles: {
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
        },
      });
    } else {
      const itemHeader = ['SI No', 'Description', 'HsnCode', 'Pkt Count', 'Qty', 'Stock Qty', 'Unit Price', 'Tax', 'Amount'];

      const tableRows = apinvoice.itemDetails.map((item, index) => {
        const unitPrice = item.unitPrice || 0;
        const quantity = item.quantity || 0;
        const totalAmount = unitPrice * quantity;

        return [
          `${index + 1}`,
          item.itemName || 'Item Description',
          item.hsnCode,
          (item.nos || '').toString(),
          `${item.eachQuantity || 0} ${item.uom || 'Kgs'}`,
          `${item.stockQuantity} ${item.uom || 'Kgs'}`,
          unitPrice.toFixed(2),
          `${item.purchasetaxName}%`,
          totalAmount.toFixed(2),
        ];
      });

      doc.autoTable({
        head: [itemHeader],
        body: tableRows,
        startY: yOffset,
        theme: 'grid',
        styles: {
          fontSize: 8,
          halign: 'left', // Default left alignment
          cellPadding: 2,
        },
        columnStyles: {
          0: { halign: 'center' }, // SI No - center
          1: { halign: 'left' }, // Description - left
          2: { halign: 'center' }, // HsnCode - center
          3: { halign: 'center' }, // Pkt Count - center
          4: { halign: 'left' }, // Qty - left (with UOM)
          5: { halign: 'right' }, // Stock Qty - RIGHT ALIGNED
          6: { halign: 'right' }, // Unit Price - RIGHT ALIGNED
          7: { halign: 'center' }, // Tax - center
          8: { halign: 'right' }, // Amount - RIGHT ALIGNED
        },
        headStyles: {
          fillColor: [0, 0, 128],
          textColor: [255, 255, 255],
        },
        bodyStyles: {
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
        },
      });
    }

    yOffset = doc.autoTable.previous.finalY;

    const taxRates = {
      CGST: new Map<number, number>(),
      SGST: new Map<number, number>(),
      IGST: new Map<number, number>(),
    };

    if (apinvoice.invoiceType === 'service') {
      apinvoice.descriptions.forEach((_, index) => {
        const taxableAmount = apinvoice.fees[index] || 0;
        const taxType = apinvoice.desc_tax_types[index];
        const taxPercentage = apinvoice.desc_tax_pers[index] || 0;

        if (taxType === 'cgst_sgst') {
          const cgstRate = taxPercentage / 2;
          const sgstRate = taxPercentage / 2;
          const cgstAmount = (cgstRate / 100) * taxableAmount;
          const sgstAmount = (sgstRate / 100) * taxableAmount;
          taxRates.CGST.set(cgstRate, (taxRates.CGST.get(cgstRate) || 0) + cgstAmount);
          taxRates.SGST.set(sgstRate, (taxRates.SGST.get(sgstRate) || 0) + sgstAmount);
        } else if (taxType === 'igst') {
          const igstAmount = (taxPercentage / 100) * taxableAmount;
          taxRates.IGST.set(taxPercentage, (taxRates.IGST.get(taxPercentage) || 0) + igstAmount);
        }
      });
    } else {
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
    }

    const totalWithoutTax = apinvoice.invoiceType === 'service'
      ? (apinvoice.totalServiceFees || 0)
      : apinvoice.itemDetails.reduce((sum, item) => sum + item.unitPrice * item.stockQuantity, 0);

    const taxSummary: [string, string][] = [
      [`Total Amount`, totalWithoutTax.toFixed(2) || '0'],
      [`Total Discount`, apinvoice.discountDetails?.toFixed(2) || '0'],
    ];

    // Add item taxes
    taxRates.CGST.forEach((amount, rate) => {
      taxSummary.push([`CGST @${rate}%`, amount.toFixed(2)]);
    });

    taxRates.SGST.forEach((amount, rate) => {
      taxSummary.push([`SGST @${rate}%`, amount.toFixed(2)]);
    });

    taxRates.IGST.forEach((amount, rate) => {
      taxSummary.push([`IGST @${rate}%`, amount.toFixed(2)]);
    });

    // Calculate subtotal (items total with tax)
    const itemsTotalWithTax = totalWithoutTax +
      Array.from(taxRates.CGST.values()).reduce((sum, amount) => sum + amount, 0) +
      Array.from(taxRates.SGST.values()).reduce((sum, amount) => sum + amount, 0) +
      Array.from(taxRates.IGST.values()).reduce((sum, amount) => sum + amount, 0);

    // Add freight charges
    const totalFreightAmount = apinvoice.totalFreightAmount || 0;
    if (totalFreightAmount > 0) {
      taxSummary.push([`Freight Charges`, totalFreightAmount.toFixed(2)]);
    }

    // Add freight tax
    const totalFreightTaxAmount = apinvoice.totalFreightTaxAmount || 0;
    if (totalFreightTaxAmount > 0) {
      taxSummary.push([`Freight Tax`, totalFreightTaxAmount.toFixed(2)]);
    }

    // Calculate total with tax including freight
    const subtotalWithFreight = itemsTotalWithTax + totalFreightAmount + totalFreightTaxAmount;

    // Add round off
    taxSummary.push([`Round off Amount`, apinvoice.apRoundOff?.toFixed(2) || '0']);

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
      columnStyles: {
        0: { halign: 'left' }, // Description - left aligned
        1: { halign: 'right' }, // Amount - RIGHT ALIGNED
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
      },
    });

    yOffset = doc.autoTable.previous.finalY;
    doc.text("Declaration:", 10, yOffset + 35);
    doc.text("We declare that this invoice shows the actual price of the described items and that all particulars are true and correct.", 10, yOffset + 40);
    doc.text("Authorized Signatory:", 120, yOffset + 48);
    doc.text("_____________________", 120, yOffset + 60);

    const totalPages = doc.getNumberOfPages();
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const footerY = pageHeight - 20;
    const computerGeneratedY = pageHeight - 10;

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      const pageText = `Page ${i} of ${totalPages}`;
      const pageTextWidth = doc.getStringUnitWidth(pageText) * doc.getFontSize() / doc.internal.scaleFactor;
      const pageX = (pageWidth - pageTextWidth) / 2;
      doc.text(pageText, pageX, footerY, { align: 'center' });

      const compText = "This is computer generated";
      const compTextWidth = doc.getStringUnitWidth(compText) * doc.getFontSize() / doc.internal.scaleFactor;
      const compX = (pageWidth - compTextWidth) / 2;
      doc.text(compText, compX, computerGeneratedY);
    }

    const typeLabel = apinvoice.invoiceType === 'service' ? 'Service' : '';
    doc.save(`${apinvoice.vendorName} ${apinvoice.randomId}${typeLabel ? ' ' + typeLabel : ''}.pdf`);
  };
  
  const handleExportCSV = () => {
    let filteredInvoices = apInvoices;
    if (invoiceTypeFilter !== 'all') {
      filteredInvoices = filteredInvoices.filter(ap => ap.invoiceType === invoiceTypeFilter);
    }

    const headers = invoiceTypeFilter === 'service'
      ? ["AP No", "Vendor Name", "Service Description", "Invoice Date", "Total Invoice Amount"]
      : ["AP No", "Vendor Name", "Total Items", "Invoice Date", "Total Invoice Amount"];

    const rows = filteredInvoices.map((ap) => {
      if (ap.invoiceType === 'service') {
        return [
          ap.randomId.toString(),
          ap.vendorName.toString(),
          ap.descriptions.length > 0 ? ap.descriptions[0] : 'Service',
          ap.apinvoiceDate ? format(new Date(ap.apinvoiceDate), 'dd-MM-yyyy') : '',
          ap.invoiceAmount.toFixed(2).toString(),
        ];
      } else {
        const totalItemsQuantity = Array.isArray(ap.itemDetails) && ap.itemDetails.length > 0
          ? ap.itemDetails.reduce((sum, item) => sum + (item.quantity || 0), 0)
          : 0;

        return [
          ap.randomId.toString(),
          ap.vendorName.toString(),
          totalItemsQuantity.toString(),
          ap.apinvoiceDate ? format(new Date(ap.apinvoiceDate), 'dd-MM-yyyy') : '',
          ap.invoiceAmount.toFixed(2).toString(),
        ];
      }
    });

    const csv = Papa.unparse([headers, ...rows]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);

    const typeLabel = invoiceTypeFilter === 'all' ? '' : invoiceTypeFilter === 'goods' ? 'Goods' : 'Service';
    link.setAttribute("download", `VerifiedApVendorwise${typeLabel ? '_' + typeLabel : ''}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDialogDownloadOpen(false);
  };

  const generatePendingInvoiceSummaryPDF = () => {
    const doc = new jsPDF();
    const yOffset = 10;
    const business = businesses.length > 0 ? businesses[0] : null;

    if (business && business.imageUrl) {
      try {
        doc.addImage(business.imageUrl, 'JPEG', 14, yOffset, 20, 20);
      } catch (e) {
        console.error("Image failed to load:", e);
      }
    }

    let currentYOffset = yOffset + 10;

    const title = invoiceTypeFilter === 'service'
      ? "Verified Service AP Invoice Summary"
      : "Verified Goods AP Invoice Itemwise Summary";

    doc.setFontSize(12);
    const pageWidth = doc.internal.pageSize.width;
    const titleWidth = doc.getStringUnitWidth(title) * doc.getFontSize() / doc.internal.scaleFactor;
    const titleX = (pageWidth - titleWidth) / 2;
    doc.text(title, titleX, currentYOffset);

    doc.setLineWidth(0.1);
    doc.line(titleX, yOffset + 2, titleX + titleWidth, yOffset + 2);
    currentYOffset += 15;

    let verifiedInvoices = (apInvoices || []);
    if (invoiceTypeFilter !== 'all') {
      verifiedInvoices = verifiedInvoices.filter(invoice => invoice.invoiceType === invoiceTypeFilter);
    }

    let totalAmount = 0;
    if (invoiceTypeFilter === 'service') {
      totalAmount = verifiedInvoices.reduce((sum, invoice) => sum + (invoice.totalServiceFees || 0), 0);
    } else {
      totalAmount = verifiedInvoices.reduce((sum, invoice) => {
const total = (Array.isArray(invoice.itemDetails) ? invoice.itemDetails : [])
  .reduce((totalItem, item) =>
    totalItem + ((item?.stockQuantity || 0) * (item?.unitPrice || 0)), 0);        return sum + total;
      }, 0);
    }

    const today = new Date();
    const currentDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

    doc.setFontSize(10);
    doc.text(`Total Invoice Amount: ${totalAmount.toFixed(2)}`, 14, currentYOffset);
    doc.text(`Date: ${currentDate}`, pageWidth - 50, currentYOffset);
    currentYOffset += 5;

    if (invoiceTypeFilter === 'service') {
      const headers = [["S.No", "AP.No", "Vendor Name", "Service Description", "SAC Code", "From Date", "To Date", "Amount", "Tax", "Total"]];

     const rows = verifiedInvoices.map((invoice, index) => {
  const descList = Array.isArray(invoice.descriptions) ? invoice.descriptions : [];

  return descList.map((desc, descIndex) => [
          (index + 1).toString(),
          invoice.randomId.toString(),
          invoice.vendorName,
          desc || 'Service',
          invoice.sacCode[descIndex] || '',
          invoice.from_dates[descIndex] ? format(new Date(invoice.from_dates[descIndex]), 'dd-MM-yyyy') : '',
          invoice.to_dates[descIndex] ? format(new Date(invoice.to_dates[descIndex]), 'dd-MM-yyyy') : '',
          (invoice.fees[descIndex] || 0).toFixed(2),
          (invoice.desc_tax_amounts[descIndex] || 0).toFixed(2),
          (invoice.desc_totals[descIndex] || 0).toFixed(2),
        ]);
      }).flat();

      doc.autoTable({
        head: headers,
        body: rows,
        startY: currentYOffset,
        styles: {
          fillColor: [30, 144, 255],
          textColor: [255, 255, 255],
          lineColor: [0, 0, 0],
          fontSize: 8,
          halign: 'left',
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
          0: { halign: 'center' }, // S.No - center
          1: { halign: 'center' }, // AP.No - center
          2: { halign: 'left' }, // Vendor Name - left
          3: { halign: 'left' }, // Service Description - left
          4: { halign: 'center' }, // SAC Code - center
          5: { halign: 'center' }, // From Date - center
          6: { halign: 'center' }, // To Date - center
          7: { halign: 'right' }, // Amount - RIGHT ALIGNED
          8: { halign: 'right' }, // Tax - RIGHT ALIGNED
          9: { halign: 'right' }, // Total - RIGHT ALIGNED
        }
      });
    } else {
      const headers = [["S.No", "AP.No", "Vendor Name", "Item Name", "Quantity", "Price", "Tax", "Discount", "Total"]];

      const rows = verifiedInvoices.map((invoice, index) => {
      const items = Array.isArray(invoice.itemDetails) ? invoice.itemDetails : [];

return items.map((item) => [
  (index + 1).toString(),
  invoice.randomId?.toString() || "",
  invoice.vendorName || "",
  item?.itemName || "",
  (item?.stockQuantity || 0).toString(),
  Number(item?.unitPrice || 0).toFixed(2),
  `${item?.purchasetaxName || 0}%`,
  Number(item?.discountAmount || 0).toFixed(2),
  Number(item?.totalPrice || 0).toFixed(2),
]);
      }).flat();

      doc.autoTable({
        head: headers,
        body: rows,
        startY: currentYOffset,
        styles: {
          fillColor: [30, 144, 255],
          textColor: [255, 255, 255],
          lineColor: [0, 0, 0],
          fontSize: 8,
          halign: 'left',
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
          0: { halign: 'center' }, // S.No - center
          1: { halign: 'center' }, // AP.No - center
          2: { halign: 'left' }, // Vendor Name - left
          3: { halign: 'left' }, // Item Name - left
          4: { halign: 'right' }, // Quantity - RIGHT ALIGNED
          5: { halign: 'right' }, // Price - RIGHT ALIGNED
          6: { halign: 'center' }, // Tax - center
          7: { halign: 'right' }, // Discount - RIGHT ALIGNED
          8: { halign: 'right' }, // Total - RIGHT ALIGNED
        }
      });
    }

    const totalPages = doc.getNumberOfPages();
    const pageHeight = doc.internal.pageSize.height;
    const footerY = pageHeight - 20;
    const computerGeneratedY = pageHeight - 10;

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      const pageText = `Page ${i} of ${totalPages}`;
      const pageTextWidth = doc.getStringUnitWidth(pageText) * doc.getFontSize() / doc.internal.scaleFactor;
      const pageX = (pageWidth - pageTextWidth) / 2;
      doc.text(pageText, pageX, footerY, { align: 'center' });

      const compText = "This is computer generated";
      const compTextWidth = doc.getStringUnitWidth(compText) * doc.getFontSize() / doc.internal.scaleFactor;
      const compX = (pageWidth - compTextWidth) / 2;
      doc.text(compText, compX, computerGeneratedY);
    }

    const typeLabel = invoiceTypeFilter === 'service' ? 'Service' : 'Itemwise';
    const pdfFilename = `VerifiedAp${typeLabel}.pdf`;
    doc.save(pdfFilename);
    handleClose();
  };

  const generatePendingInvoiceSummaryCSV = () => {
    let verifiedInvoices = (apInvoices || []);
    if (invoiceTypeFilter !== 'all') {
      verifiedInvoices = verifiedInvoices.filter(invoice => invoice.invoiceType === invoiceTypeFilter);
    }

    let headers, rows;

    if (invoiceTypeFilter === 'service') {
      headers = ["S.No", "AP.No", "Vendor Name", "Service Description", "SAC Code", "From Date", "To Date", "Amount", "Tax", "Total"];

      rows = verifiedInvoices.map((invoice, index) => {
      const descList = Array.isArray(invoice.descriptions) ? invoice.descriptions : [];

return descList.map((desc, descIndex) => [
          (index + 1).toString(),
          invoice.randomId.toString(),
          invoice.vendorName,
          desc || 'Service',
          invoice.sacCode[descIndex] || '',
          invoice.from_dates[descIndex] ? format(new Date(invoice.from_dates[descIndex]), 'dd-MM-yyyy') : '',
          invoice.to_dates[descIndex] ? format(new Date(invoice.to_dates[descIndex]), 'dd-MM-yyyy') : '',
          (invoice.fees[descIndex] || 0).toFixed(2),
          (invoice.desc_tax_amounts[descIndex] || 0).toFixed(2),
          (invoice.desc_totals[descIndex] || 0).toFixed(2),
        ]);
      }).flat();
    } else {
      headers = ["S.No", "AP.No", "Vendor Name", "Item Name", "Quantity", "Price", "Tax", "Discount", "Total"];

      rows = verifiedInvoices.map((invoice, index) => {
      const items = Array.isArray(invoice.itemDetails) ? invoice.itemDetails : [];

return items.map((item) => [
          (index + 1).toString(),
          invoice.randomId.toString(),
          invoice.vendorName,
          item.itemName,
          item.stockQuantity.toString(),
          item.unitPrice.toFixed(2),
          `${item.purchasetaxName}%`,
          (item.discountAmount || 0).toFixed(2),
          item.totalPrice.toFixed(2),
        ]);
      }).flat();
    }

    const csvData = [headers, ...rows];
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);

    const typeLabel = invoiceTypeFilter === 'service' ? 'Service' : 'Itemwise';
    link.setAttribute("download", `VerifiedAp${typeLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    handleClose();
  };
  
  const generateInvoicePDF = () => {
    const doc = new jsPDF();
    let yOffset = 7;
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

    yOffset += 10;

    const title = invoiceTypeFilter === 'all'
      ? "Verified AP Invoice Vendorwise Summary"
      : invoiceTypeFilter === 'goods'
        ? "Verified Goods AP Invoice Vendorwise Summary"
        : "Verified Service AP Invoice Vendorwise Summary";
    const pageWidth = doc.internal.pageSize.width;
    const fontSize = doc.getFontSize();
    const titleWidth = doc.getStringUnitWidth(title) * fontSize / doc.internal.scaleFactor;
    const titleX = (pageWidth - titleWidth) / 2;
    doc.text(title, titleX, yOffset);

    const underlineOffset = 3;
    doc.setLineWidth(0.1);
    doc.line(titleX, yOffset + underlineOffset, titleX + titleWidth, yOffset + underlineOffset);
    yOffset += 15;

    const today = new Date();
    const currentDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

    let filteredInvoices = apInvoices;
    if (invoiceTypeFilter !== 'all') {
      filteredInvoices = filteredInvoices.filter(ap => ap.invoiceType === invoiceTypeFilter);
    }

    const totalInvoiceAmount = filteredInvoices.reduce((sum, order) => {
      const orderInvoiceAmount = order.invoiceAmount || 0;
      return sum + orderInvoiceAmount;
    }, 0);

    doc.setFontSize(10);
    doc.text(`Total Invoice Amount: ${totalInvoiceAmount.toFixed(2)}`, 14, yOffset);
    const totalWidth = doc.getStringUnitWidth(`Total Invoice Amount: ${totalInvoiceAmount.toFixed(2)}`) * fontSize / doc.internal.scaleFactor;
    const dateX = pageWidth - totalWidth - 14;
    doc.text(`Date: ${currentDate}`, dateX, yOffset);
    yOffset += 5;

    const headers = invoiceTypeFilter === 'service'
      ? [["S.No", "AP.No", "Invoice Date", "InvoiceNo", "Vendor Name", "Service Type", "Total Amount"]]
      : [["S.No", "AP.No", "Invoice Date", "InvoiceNo", "Vendor Name", "TotalItems", "Total Amount"]];

    const rows = filteredInvoices.map((ap, index) => {
      if (ap.invoiceType === 'service') {
        return [
          (index + 1).toString(),
          ap.randomId.toString(),
          ap.invoiceDate ? format(new Date(ap.invoiceDate), 'dd-MM-yyyy') : '',
          ap.invoiceNo,
          ap.vendorName.toString(),
          ap.descriptions.length > 0 ? ap.descriptions[0] : 'Service',
          ap.invoiceAmount.toFixed(2),
        ];
      } else {
        const totalItemsQuantity = Array.isArray(ap.itemDetails) && ap.itemDetails.length > 0
          ? ap.itemDetails.reduce((sum, item) => sum + (item.quantity || 0), 0)
          : 0;

        return [
          (index + 1).toString(),
          ap.randomId.toString(),
          ap.invoiceDate ? format(new Date(ap.invoiceDate), 'dd-MM-yyyy') : '',
          ap.invoiceNo,
          ap.vendorName.toString(),
          totalItemsQuantity.toString(),
          ap.invoiceAmount.toFixed(2),
        ];
      }
    });

    doc.autoTable({
      head: headers,
      body: rows,
      startY: yOffset,
      styles: {
        fillColor: [30, 144, 255],
        textColor: [255, 255, 255],
        lineColor: [0, 0, 0],
        fontSize: 8,
        halign: 'left',
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
        0: { halign: 'center' }, // S.No - center
        1: { halign: 'center' }, // AP.No - center
        2: { halign: 'left' }, // Invoice Date - left
        3: { halign: 'left' }, // InvoiceNo - left
        4: { halign: 'left' }, // Vendor Name - left
        5: { halign: invoiceTypeFilter === 'service' ? 'left' : 'right' }, // Service Type (left) or TotalItems (right)
        6: { halign: 'right' }, // Total Amount - RIGHT ALIGNED
      }
    });

    const totalPages = doc.getNumberOfPages();
    const pageHeight = doc.internal.pageSize.height;
    const footerY = pageHeight - 20;
    const computerGeneratedY = pageHeight - 10;

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      const pageText = `Page ${i} of ${totalPages}`;
      const pageTextWidth = doc.getStringUnitWidth(pageText) * doc.getFontSize() / doc.internal.scaleFactor;
      const pageX = (pageWidth - pageTextWidth) / 2;
      doc.text(pageText, pageX, footerY, { align: 'center' });

      const compText = "This is computer generated";
      const compTextWidth = doc.getStringUnitWidth(compText) * doc.getFontSize() / doc.internal.scaleFactor;
      const compX = (pageWidth - compTextWidth) / 2;
      doc.text(compText, compX, computerGeneratedY);
    }

    const typeLabel = invoiceTypeFilter === 'all' ? '' : invoiceTypeFilter === 'goods' ? 'Goods' : 'Service';
    const pdfFilename = `VerifiedApVendorwise${typeLabel ? '_' + typeLabel : ''}.pdf`;
    doc.save(pdfFilename);
    setDialogDownloadOpen(false);
  };
  const handleGrnClick = async (grnId: string) => {
    try {
      const result = await dispatch(fetchGrnById(grnId)).unwrap();
      if (result) {
        const transformedGrn: GrnResponse = {
          grnId: result.grnId,
          randomId: result.randomId,
          vendorName: result.vendorName,
          grnDate: typeof result.grnDate === 'string' ? new Date(result.grnDate) : result.grnDate,
          itemDetails: result.itemDetails.map((item: ItemDetail) => ({
            itemId: item.itemId,
            itemName: item.itemName ?? 'Unknown',
            receivedQuantity: Number(item.receivedQuantity) || 0,
            returnedQuantity: Number(item.returnedQuantity) || 0,
            quantity: Number(item.quantity) || 0,
            unitPrice: Number(item.unitPrice) || 0,
            totalPrice: Number(item.totalPrice) || 0,
            purchasetaxName: item.purchasetaxName || 'N/A',
            discountAmount: Number(item.discountAmount) || 0,
            finalPrice: Number(item.finalPrice) || 0,
          })) as ItemDetailResponse[],
        };
        setSelectedGrn(transformedGrn);
        setViewItemsDialogOpen(true);
      } else {
        dispatch(setSnackbarMessage('GRN not found.'));
        dispatch(setSnackbarOpen(true));
      }
    } catch (error) {
      dispatch(setSnackbarMessage('Failed to fetch GRN details.'));
      dispatch(setSnackbarOpen(true));
      console.error('Failed to fetch GRN details:', error);
    }
  };

  const handlePoClick = async (poId: string) => {
    try {
      const result = await dispatch(fetchPoById(poId)).unwrap();
      if (result) {
        const transformedPo: PoResponse = {
          purchaseOrderId: result.purchaseOrderId,
          randomId: result.randomId,
          vendorName: result.vendorName,
          orderDate: typeof result.orderDate === 'string' ? result.orderDate : result.orderDate?.toISOString() || null,
          itemDetails: result.itemDetails.map((item: ItemDetailResponsePO) => ({
            itemId: item.itemId ?? 'N/A',
            itemName: item.itemName ?? 'Unknown',
            receivedQuantity: Number(item.receivedQuantity) || 0,
            poQuantity: Number(item.poQuantity) || 0,
            newPrice: Number(item.newPrice) || 0,
            totalPrice: Number(item.totalPrice) || 0,
            purchasetaxName: Number(item.purchasetaxName) || 0,
            taxPercentage: Number(item.taxPercentage) || 0,
            taxAmount: Number(item.taxAmount) || 0,
            discountAmount: Number(item.discountAmount) || 0,
            finalPrice: Number(item.finalPrice) || 0,
          })) as ItemDetailResponsePO[],
        };
        dispatch(setSelectedPo(transformedPo));
        setPoDialogOpen(true);
      } else {
        dispatch(setSnackbarMessage('Purchase Order not found.'));
        dispatch(setSnackbarOpen(true));
      }
    } catch (error) {
      dispatch(setSnackbarMessage('Failed to fetch PO details.'));
      dispatch(setSnackbarOpen(true));
      console.error('Failed to fetch PO details:', error);
    }
  };
  const handleServiceClick = async (serviceId: string) => {
    if (!serviceId) {
      dispatch(setSnackbarMessage('Invalid Service ID'));
      dispatch(setSnackbarOpen(true));
      return;
    }

    try {
      const result = await dispatch(fetchServiceById(serviceId)).unwrap();
      setSelectedService(result);
      setDialogOpen(true);
    } catch (error) {
      dispatch(setSnackbarMessage('Failed to load service details'));
      dispatch(setSnackbarOpen(true));
      console.error('Service fetch error:', error);
    }
  };
  // Return AP handler
  const handleReturnClick = () => {
    if (!selectedInvoice) return;

    if (selectedInvoice.invoiceType === 'service') {
      // For service invoices, open return dialog with remarks
      setReturnDialogOpen(true);
    } else {
      // For goods invoices, open GRN return dialog
      setReturnDialogOpen(true);
    }
  };
  const handleConfirmReturn = async () => {
    if (!selectedInvoice) return;

    setLoading(true);
    try {
      if (selectedInvoice.invoiceType === 'service') {
        // Use serOId which contains the service MongoDB ObjectId
        const serviceObjectId = selectedInvoice.serOId;

        if (!serviceObjectId) {
          throw new Error('Service ID not found in invoice data');
        }

        console.log('Using service ObjectId:', serviceObjectId);

        await dispatch(returnServiceInvoice({
          serviceId: serviceObjectId,
          remarks: returnRemarks
        })).unwrap();

        // Success - close dialogs and refresh
        setReturnDialogOpen(false);
        setDetailsDialogOpen(false);
        dispatch(setSnackbarMessage('Service returned to Pending successfully'));
        dispatch(setSnackbarOpen(true));
        refetchWithFilters();
        setReturnRemarks('');

      } else {
        // For goods invoices - call GRN return API
        await dispatch(convertToGrnFromApReturned(selectedInvoice.invoiceId)).unwrap();

        setReturnDialogOpen(false);
        setDetailsDialogOpen(false);
        dispatch(setSnackbarMessage('Goods invoice returned to GRN successfully'));
        dispatch(setSnackbarOpen(true));
        refetchWithFilters();
      }
    } catch (err: any) {
      console.error('Error returning invoice:', err);
      dispatch(setSnackbarMessage(err?.message || err || 'Failed to return invoice'));
      dispatch(setSnackbarOpen(true));
    } finally {
      setLoading(false);
    }
  };

  // Fullscreen toggle
  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };
  // Filter for Verified status only (non-returned) and by invoice type
  const verifiedApInvoices = useMemo(() => {
    let filtered = apInvoices;

    if (invoiceTypeFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.invoiceType === invoiceTypeFilter);
    }

    if (selectedStatus) {
      filtered = filtered.filter(invoice => invoice.status === selectedStatus);
    }

    console.log('Filtered invoices count:', filtered.length, 'from total:', apInvoices.length);

    return filtered;
  }, [apInvoices, invoiceTypeFilter, selectedStatus]);
  // Add this useEffect to debug filter state
  useEffect(() => {
    console.log('Filter state:', {
      currentPage,
      appliedFromDate: appliedFromDate ? new Date(appliedFromDate).toLocaleDateString() : 'undefined',
      appliedToDate: appliedToDate ? new Date(appliedToDate).toLocaleDateString() : 'undefined',
      selectedVendorName,
      invoiceTypeFilter,
      selectedStatus,
      isDateFilterActive,
      selectionRange: {
        start: selectionRange.startDate.toLocaleDateString(),
        end: selectionRange.endDate.toLocaleDateString()
      }
    });
  }, [currentPage, appliedFromDate, appliedToDate, selectedVendorName, invoiceTypeFilter, selectedStatus, isDateFilterActive, selectionRange]);
  // Tax calculations
  const taxAmounts: TaxAmounts = selectedInvoice
    ? (selectedInvoice.invoiceType === 'service'
      ? selectedInvoice.descriptions.reduce((acc: TaxAmounts, _, index) => {
        const totalPrice = selectedInvoice.desc_totals[index] || 0;
        const taxPercentage = selectedInvoice.desc_tax_pers[index] || 0;
        const taxType = selectedInvoice.desc_tax_types[index];

        if (taxType === "cgst_sgst") {
          const sgstPercentage = taxPercentage / 2;
          const cgstPercentage = taxPercentage / 2;
          const sgstAmount = (totalPrice * sgstPercentage) / 100;
          const cgstAmount = (totalPrice * cgstPercentage) / 100;

          acc.sgst[sgstPercentage] = (acc.sgst[sgstPercentage] || 0) + sgstAmount;
          acc.cgst[cgstPercentage] = (acc.cgst[cgstPercentage] || 0) + cgstAmount;
        } else if (taxType === "igst") {
          const igstAmount = (totalPrice * taxPercentage) / 100;
          acc.igst[taxPercentage] = (acc.igst[taxPercentage] || 0) + igstAmount;
        }
        return acc;
      }, { sgst: {}, cgst: {}, igst: {} })
      : selectedInvoice.itemDetails.reduce((acc: TaxAmounts, item) => {
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
      }, { sgst: {}, cgst: {}, igst: {} }))
    : { sgst: {}, cgst: {}, igst: {} };

  const uniqueRates = new Set([
    ...Object.keys(taxAmounts.sgst),
    ...Object.keys(taxAmounts.cgst),
    ...Object.keys(taxAmounts.igst),
  ]);
  const filterAp = filteredAp.length > 0 ? filteredAp : apInvoices;
  /* ================= HIDE MODULE ================= */
  if (isModuleHidden) return null;

  if (!canRead) {
    return (
      <Box p={2}>
        <Typography color="error">
          You do not have access to AP Invoice module.
        </Typography>
      </Box>
    );
  }

  /* =============================================== */

  return (
    <Box>
      <YenPurchasePage />
      <Box sx={{ p: 1, backgroundColor: 'white' }}>
        {/* First Row - AP Invoice List, Returned AP buttons, and Typography */}
        <Box display="flex" alignItems="center" mb={1} ml={1}>
          {!isModuleHidden && (
            <Link href={"/yen-purchase/ApInvoicePage"}>
              <Button
                variant="contained"
                sx={{
                  mr: 1,
                  minWidth: "100px",
                  backgroundColor: isApListActive ? "white" : "primary.main",
                  color: isApListActive ? "black" : "white",
                  "&:hover": {
                    backgroundColor: isApListActive
                      ? "#f5f5f5"
                      : "primary.dark",
                  },
                }}
              >
                AP List
              </Button>
            </Link>
          )}
        </Box>

        {/* Second Row: Search Vendor, Date Range, Invoice Type Filter, Filter, Clear, and Download Icons */}
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

          {/* Invoice Type Filter */}
          <Grid item xs={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Invoice Type</InputLabel>
              <Select
                value={invoiceTypeFilter}
                label="Invoice Type"
                onChange={(e) => handleInvoiceTypeChange(e.target.value)}
                size="small"
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="goods">Goods</MenuItem>
                <MenuItem value="service">Service</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={2}>
            <FormControl fullWidth size="small">
              <Autocomplete
                options={statuses}
                loading={statusesLoading}
                value={selectedStatus || null}
                inputValue={selectedStatus || ''}  // KEY FIX: Show selected value as text
                onChange={(event, newValue) => {
                  console.log('Status selected:', newValue);
                  if (newValue === null) {
                    dispatch(clearStatus());
                  } else {
                    dispatch(setSelectedStatus(newValue));
                  }
                  // Do NOT refetch here — only on Filter button
                }}
                onInputChange={(event, newInputValue, reason) => {
                  // Only update search when user types (not when selecting)
                  if (reason === 'input') {
                    dispatch(setStatusSearch(newInputValue));
                    if (newInputValue.trim() === '') {
                      dispatch(resetStatuses());
                      dispatch(fetchApStatuses({ page: 1 }));
                    } else {
                      debouncedStatusSearch(newInputValue);
                    }
                  }
                  // Ignore 'reset' or 'clear' reasons here
                }}
                onOpen={() => {
                  if (statuses.length === 0) {
                    dispatch(fetchApStatuses({ page: 1 }));
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Status"
                    size="small"
                    InputProps={{
                      ...params.InputProps,

                    }}
                  />
                )}
                // Rest of your PaperComponent, renderOption, etc.
                freeSolo={false}
                clearOnBlur={false}
                clearOnEscape={true} // Optional: allows Escape to clear
                fullWidth
              />
            </FormControl>
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

          {/* Clear Filter Icon */}
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
                disabled={!apInvoices || apInvoices.length === 0}
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
            <MenuItem onClick={handleItemwiseClick}>
              {invoiceTypeFilter === 'service' ? 'Service Details' : 'Itemwise'}
            </MenuItem>
          </Menu>
        </Grid>

        {/* Table Container */}
        <Grid container spacing={1} sx={{ pl: 2 }}>
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
                  <TableCell align="center">S.No</TableCell>
                  <TableCell align="left">POID/SOID</TableCell>
                  <TableCell align="left">GRN ID</TableCell>
                  <TableCell align="left">AP ID</TableCell>
                  <TableCell align="left">Invoice ID</TableCell>
                  <TableCell align="left">Vendor Name</TableCell>
                  <TableCell align="left">Invoice Date</TableCell>
                  <TableCell align="center">Type</TableCell>
                  <TableCell align="right">Total Amount</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center">
                      <CircularProgress size={24} />
                      <Typography variant="body2" sx={{ ml: 2 }}>
                        Loading invoices...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ color: 'error.main' }}>
                      <Typography variant="body2">
                        Error: {error}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : verifiedApInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center">
                      No data available
                    </TableCell>
                  </TableRow>
                ) : (
                  verifiedApInvoices.map((invoice, index) => {
                    const { isDisabled, tooltipTitle } = invoiceCreditNoteStatus[invoice.invoiceId] || {
                      isDisabled: true,
                      tooltipTitle: 'No Debit/Credit Notes Available',
                    };
                    return (
                      <TableRow key={invoice.randomId}>
                        <TableCell align="center">{(currentPage - 1) * pageSize + index + 1}</TableCell>
                        <TableCell align="left">
                          {invoice.invoiceType === 'service' ? (
                            invoice.serOId ? (
                              <span
                                style={{
                                  color: '#9c27b0',
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                  fontWeight: '600',
                                }}
                                onClick={() => handleServiceClick(invoice.serOId)}
                              >
                                {invoice.serviceId || invoice.poRandomId}
                              </span>
                            ) : (
                              invoice.serviceId || invoice.poRandomId || '-'
                            )
                          ) : (
                            invoice.purchaseOrderId ? (
                              <span
                                style={{ color: 'purple', cursor: 'pointer', textDecoration: 'underline' }}
                                onClick={() => handlePoClick(invoice.purchaseOrderId)}
                              >
                                {invoice.poRandomId}
                              </span>
                            ) : (
                              invoice.poRandomId || '-'
                            )
                          )}
                        </TableCell>
                        <TableCell align="left">
                          {invoice.grnId ? (
                            <span
                              style={{ color: 'blue', cursor: 'pointer', textDecoration: 'underline' }}
                              onClick={() => handleGrnClick(invoice.grnId)}
                            >
                              {invoice.grnRandomId || '-'}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell align="left">{invoice.randomId}</TableCell>
                        <TableCell align="left">{invoice.invoiceNo}</TableCell>
                        <TableCell align="left">{invoice.vendorName}</TableCell>
                        <TableCell align="left">
                          {invoice.invoiceDate ? format(new Date(invoice.invoiceDate), 'dd-MM-yyyy') : ''}
                        </TableCell>
                        <TableCell align="center">
                          {invoice.invoiceType === 'service' ? 'Service' : 'Goods'}
                        </TableCell>
                        <TableCell align="right">{invoice.invoiceAmount.toFixed(2)}</TableCell>
                        <TableCell align="center">{invoice.status}</TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center">
                            <Tooltip title="View Detail">
                              <IconButton
                                color="primary"
                                onClick={() => handleViewDetails(invoice)}
                                disabled={!canRead}
                              >
                                <VisibilityIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Download PDF">
                              <IconButton
                                color="primary"
                                onClick={() => handleDownload(invoice.invoiceId)}
                                disabled={!canRead}
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

          {/* Pagination Controls */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.1 }}>
              <Typography variant="body2">
                Showing {totalItems === 0 ? 0 : ((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} entries
                {selectedStatus && ` (Filtered by: ${selectedStatus})`}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'end', alignItems: 'center' }}>
                <IconButton
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1 || loading || totalItems === 0}
                  aria-label="Previous Page"
                >
                  <ChevronLeft />
                </IconButton>
                <Typography variant="body1" sx={{ mx: 2 }}>
                  Page {currentPage} of {totalPages}
                </Typography>
                <IconButton
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages || loading || totalItems === 0}
                  aria-label="Next Page"
                >
                  <ChevronRight />
                </IconButton>
              </Box>
            </Box>
          </Grid>
        </Grid>

        {/* Details Dialog */}
        <Dialog
          open={detailsDialogOpen}
          onClose={handleCloseDetailsDialog}
          maxWidth={false}
          fullWidth={true}
          fullScreen={isFullScreen}
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
            padding: isFullScreen ? '16px 24px' : '16px'
          }}>
            Invoice Details
            <IconButton onClick={toggleFullScreen} color="primary" edge="end">
              {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </DialogTitle>

          <DialogContent sx={{
            padding: isFullScreen ? '0 24px' : '20px',
            height: isFullScreen ? 'calc(100vh - 120px)' : 'auto',
            overflow: 'auto'
          }}>
            {selectedInvoice && (
              <Box>
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
                  <Typography variant="h6">
                    <strong>Type:</strong> {selectedInvoice.invoiceType === 'service' ? 'Service' : 'Goods'}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 3, mb: 2, alignItems: 'center' }}>
                  <Typography variant="h6">
                    <strong>Vendor:</strong> {selectedInvoice.vendorName}
                  </Typography>
                  <Typography variant="h6">
                    <strong>Invoice Date:</strong>{' '}
                    {selectedInvoice?.invoiceDate
                      ? format(new Date(selectedInvoice.invoiceDate), 'dd-MM-yyyy')
                      : ''}
                  </Typography>
                  <Typography variant="h6">
                    <strong>Total Amount:</strong> {selectedInvoice.invoiceAmount.toFixed(2)}
                  </Typography>
                </Box>

                <TableContainer component={Paper} sx={{ mt: 2 }}>
                  <Table sx={{ '& .MuiTableCell-root': { borderBottom: 'none' } }}>
                    <TableHead>
                      <TableRow>
                        {selectedInvoice.invoiceType === 'service' ? (
                          <>
                            <TableCell>S.No</TableCell>
                            <TableCell>Service Description</TableCell>
                            <TableCell>SAC Code</TableCell>
                            <TableCell>From Date</TableCell>
                            <TableCell>To Date</TableCell>
                            <TableCell>Quantity</TableCell>
                            <TableCell>Amount</TableCell>
                            <TableCell>Tax</TableCell>
                            <TableCell>Total</TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell>S.No</TableCell>
                            <TableCell>Item Name</TableCell>
                            <TableCell>Received Quantity</TableCell>
                            <TableCell>UOM</TableCell>
                            <TableCell>Returned Quantity</TableCell>
                            <TableCell>Pkt Count</TableCell>
                            <TableCell>Quantity</TableCell>
                            <TableCell>Stock Quantity</TableCell>
                            <TableCell>Bef Tax Discount(%)</TableCell>
                            <TableCell>Af Tax Discount(%)</TableCell>
                            <TableCell>Tax(%)</TableCell>
                            <TableCell>Unit Price</TableCell>
                            <TableCell>Total Price</TableCell>
                            <TableCell>Final Price</TableCell>
                          </>
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedInvoice.invoiceType === 'service' ? (
                       (Array.isArray(selectedInvoice.descriptions) ? selectedInvoice.descriptions : []).map((desc, index) => (
                          <TableRow key={index}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>{desc}</TableCell>
                            <TableCell>{selectedInvoice.sacCode[index]}</TableCell>
                            <TableCell>
                              {selectedInvoice.from_dates[index]
                                ? format(new Date(selectedInvoice.from_dates[index]), 'dd-MM-yyyy')
                                : ''}
                            </TableCell>
                            <TableCell>
                              {selectedInvoice.to_dates[index]
                                ? format(new Date(selectedInvoice.to_dates[index]), 'dd-MM-yyyy')
                                : ''}
                            </TableCell>
                            <TableCell>{selectedInvoice.quantity[index] || 1}</TableCell>
                            <TableCell>{(selectedInvoice.fees[index] || 0).toFixed(2)}</TableCell>
                            <TableCell>{(selectedInvoice.desc_tax_amounts[index] || 0).toFixed(2)}</TableCell>
                            <TableCell>{(selectedInvoice.desc_totals[index] || 0).toFixed(2)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                       (Array.isArray(selectedInvoice.itemDetails) ? selectedInvoice.itemDetails : []).map((item, index) => (
                          <TableRow key={item.itemId}>
                            <TableCell>{index + 1}</TableCell>
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
                        ))
                      )}

                      {/* Tax Breakdown */}
                      {Array.from(uniqueRates).map((rate) => (
                        <React.Fragment key={rate}>
                          {taxAmounts.sgst[rate] !== undefined && (
                            <TableRow>
                              <TableCell colSpan={selectedInvoice.invoiceType === 'service' ? 7 : 12} />
                              <TableCell>
                                <strong>{`SGST (${Number(rate)}%):`}</strong>
                              </TableCell>
                              <TableCell>{taxAmounts.sgst[rate].toFixed(2)}</TableCell>
                            </TableRow>
                          )}
                          {taxAmounts.cgst[rate] !== undefined && (
                            <TableRow>
                              <TableCell colSpan={selectedInvoice.invoiceType === 'service' ? 7 : 12} />
                              <TableCell>
                                <strong>{`CGST (${Number(rate)}%):`}</strong>
                              </TableCell>
                              <TableCell>{taxAmounts.cgst[rate].toFixed(2)}</TableCell>
                            </TableRow>
                          )}
                          {taxAmounts.igst[rate] !== undefined && (
                            <TableRow>
                              <TableCell colSpan={selectedInvoice.invoiceType === 'service' ? 7 : 12} />
                              <TableCell>
                                <strong>{`IGST (${Number(rate)}%):`}</strong>
                              </TableCell>
                              <TableCell>{taxAmounts.igst[rate].toFixed(2)}</TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}

                      <TableRow>
                        <TableCell colSpan={selectedInvoice.invoiceType === 'service' ? 8 : 13} align="right">
                          <strong>Freight Amount:</strong>
                        </TableCell>
                        <TableCell>{selectedInvoice.totalFreightAmount?.toFixed(2) ?? '0.00'}</TableCell>
                      </TableRow>

                      <TableRow>
                        <TableCell colSpan={selectedInvoice.invoiceType === 'service' ? 8 : 13} align="right">
                          <strong>Freight Tax:</strong>
                        </TableCell>
                        <TableCell>{selectedInvoice.totalFreightTaxAmount?.toFixed(2) ?? '0.00'}</TableCell>
                      </TableRow>

                      <TableRow>
                        <TableCell colSpan={selectedInvoice.invoiceType === 'service' ? 8 : 13} align="right">
                          <strong>Round off Amount:</strong>
                        </TableCell>
                        <TableCell>{selectedInvoice.apRoundOff?.toFixed(2) ?? '0.00'}</TableCell>
                      </TableRow>

                      <TableRow>
                        <TableCell colSpan={selectedInvoice.invoiceType === 'service' ? 8 : 13} align="right">
                          <strong>Total Debit Amount:</strong>
                        </TableCell>
                        <TableCell>{selectedInvoice.debitAmount?.toFixed(2) ?? '0.00'}</TableCell>
                      </TableRow>

                      <TableRow>
                        <TableCell colSpan={selectedInvoice.invoiceType === 'service' ? 8 : 13} align="right">
                          <strong>Total Invoice Amount:</strong>
                        </TableCell>
                        <TableCell>
                          {(selectedInvoice.invoiceAmount - (selectedInvoice.discountPrice || 0)).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
              {selectedInvoice?.status === 'Outgoing Posted' && (
  <Tooltip title={!canEdit ? "You don't have permission to return" : ''}>
    <span>
      <Button
        variant="contained"
        color={selectedInvoice?.invoiceType === 'service' ? 'warning' : 'primary'}
        onClick={handleReturnClick}
        sx={{ minWidth: '150px' }}
        startIcon={selectedInvoice?.invoiceType === 'service' ? <RefreshIcon /> : null}
        disabled={!canEdit}
      >
        {selectedInvoice?.invoiceType === 'service' ? 'Return Service' : 'Return GRN'}
      </Button>
    </span>
  </Tooltip>
)}
            <Button variant="contained" onClick={handleCloseDetailsDialog}>Close</Button>
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
                <Dialog open={returnDialogOpen} onClose={() => !loading && setReturnDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            {selectedInvoice?.invoiceType === 'service' ? 'Return Service Invoice' : 'Return GRN'}
          </DialogTitle>
          <DialogContent>
            {selectedInvoice?.invoiceType === 'service' ? (
              <>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">Returning Service Invoice</Typography>
                  <Typography variant="body2">
                    This will mark the service invoice as returned. You can reconvert it later.
                  </Typography>
                </Alert>

                <DialogContentText sx={{ mb: 2 }}>
                  <strong>Service ID:</strong> {selectedInvoice?.serviceId || selectedInvoice?.invoiceId}<br />
                  <strong>Vendor:</strong> {selectedInvoice?.vendorName}<br />
                  <strong>Amount:</strong> ₹{selectedInvoice?.invoiceAmount.toFixed(2)}
                </DialogContentText>

                <TextField
                  autoFocus
                  margin="dense"
                  label="Return Remarks"
                  type="text"
                  fullWidth
                  multiline
                  rows={3}
                  variant="outlined"
                  value={returnRemarks}
                  onChange={(e) => setReturnRemarks(e.target.value)}
                  placeholder="Enter reason for return..."
                />
              </>
            ) : (
              <DialogContentText>
                Are you sure you want to return this GRN?
                <br /><br />
                <strong>GRN ID:</strong> {selectedInvoice?.grnRandomId}<br />
                <strong>Vendor:</strong> {selectedInvoice?.vendorName}
              </DialogContentText>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReturnDialogOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmReturn}
              color="primary"
              variant="contained"
              disabled={loading || (selectedInvoice?.invoiceType === 'service' && !returnRemarks.trim())}
            >
              {loading ? <CircularProgress size={24} /> : 'Confirm Return'}
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
          open={loadingCenter || returnServiceLoading}
        >
          <CircularProgress color="inherit" />
        </Backdrop>

        {/* Pdf Excel Dialog */}
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

        {/* Dialog for choosing export options */}
        <Dialog open={dialogSummaryOpen} onClose={handleClose}>
          <DialogTitle>Export Options</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Please choose whether you want to export the data as a CSV or generate a PDF.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={generatePendingInvoiceSummaryCSV}
              variant="contained"
              color="secondary"
              startIcon={<DescriptionIcon />}
            >
              Export Excel
            </Button>
            <Button
              onClick={generatePendingInvoiceSummaryPDF}
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
        <GrnDialog
          open={viewItemsDialogOpen}
          onClose={() => setViewItemsDialogOpen(false)}
          grn={selectedGrn}
        />

        <PODialog
          open={poDialogOpen}
          onClose={() => {
            dispatch(setPoDialogOpen(false));
          }}
          po={selectedPo}
        />

        <ServiceDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          service={selectedService}
        />
        <DebitCreditNoteDialog />
        <Snackbar
          open={snackbarOpen}
          message={snackbarMessage}
          autoHideDuration={3000}
          onClose={() => dispatch(clearSnackbarMessage())}
        />
      </Box>
    </Box>
  );
};

export default React.memo(VerifiedApInvoicePage);