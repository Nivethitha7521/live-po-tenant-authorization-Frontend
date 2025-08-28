"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Link from 'next/link';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Box,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  Snackbar,
  InputAdornment,
  CircularProgress,
  Tooltip,
  SelectChangeEvent,
  IconButton,
  Autocomplete,
  AutocompleteChangeReason,
  AutocompleteChangeDetails,
  List,
  FormControlLabel,
  ListItem,
} from '@mui/material';
import YenBookPage from '../page';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';  // CSV icon
import DownloadIcon from '@mui/icons-material/Download';
import FilterAltIcon from '@mui/icons-material/FilterAlt'; // Import the filter icon
import PaymentsIcon from '@mui/icons-material/Payments';
import PaymentIcon from '@mui/icons-material/Payment';
import {
  fetchOutgoings,
  selectOutgoings, fetchVendorDetails,
  processPayment, fetchBank,
  setSnackbarMessage, clearSnackbarMessage, setSnackbarOpen,
  selectCurrentPage,
  selectPageSize,
  selectTotalItems,
  setPagination,
  processBulkPayment,
  fetchActiveDebitsVendor,
} from '../../../features/yen-purchase/Outgoing/outgoingPaymentSlice';
import { fetchGrnById, fetchItemwiseGrns, selectGrn } from '@/features/yen-purchase/GRN/grnSlice';
import { AppDispatch, RootState } from '@/redux/store';
import { Outgoing, VendorDetail } from '@/Models/outgoingModel';
import { GrnResponse, ItemDetail, ItemDetailResponse } from '@/Models/grnModel';
import jsPDF from 'jspdf';
import "jspdf-autotable"; // Ensure this plugin is available for autoTable functionality
import { fetchBusinesses, fetchPhoto, selectBusinesses } from '@/features/account-setting/businessSlice';
import { format } from 'date-fns';
import Papa from 'papaparse';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import DateRangeDialog from '@/components/dateRange';
import 'react-date-range/dist/styles.css'; // main style file
import 'react-date-range/dist/theme/default.css'; // theme css file
import { ClearIcon } from '@mui/x-date-pickers/icons';
import moment from 'moment';
import { fetchItemwiseAps, fetchRandomIDApInvoices, selectApinvoice, setApDialogOpen, setSelectedinvoiceId } from '@/features/yen-purchase/AP/apInvoiceSlice';
import { fetchDebitCreditNotesByDocument, selectDebitCreditNote, setDebitCreditDialogOpen, setDebitCreditDocumentId, setDebitCreditDocumentType } from '@/features/yen-purchase/DebitNoteSlice';
import DebitCreditNoteDialog from '@/components/yen-purchase/DebitNoteDialog';
import GrnDialog from '@/components/yen-purchase/OutgoingComponent/GRNDialog';
import ApInvoiceDialog from '@/components/yen-purchase/OutgoingComponent/APDialog';
import { fetchPoById, selectPurchaseListState, setPoDialogOpen, setSelectedPo } from '@/features/yen-purchase/PurchaseOrder/purchaseListSlice';
import { ItemDetailResponsePO, PoResponse } from '@/Models/purchaseModel';
import PODialog from '@/components/yen-purchase/OutgoingComponent/PODialog';
import ConfirmationDialog from '@/components/confirmationDialog';

const OutgoingPaymentComponent = React.memo(() => {
  const dispatch = useDispatch<AppDispatch>();
  const { outgoings, snackbarMessage, snackbarOpen, banks, outgoingvendor } = useSelector(selectOutgoings);
  const { itemwise } = useSelector(selectGrn);
  const { randomIdap, apDialogOpen, selectedinvoiceId, itemwiseap } = useSelector(selectApinvoice);
  const { businesses } = useSelector(selectBusinesses);
  const { selectedPo, poDialogOpen, loading } = useSelector(selectPurchaseListState);
  const [selectedOutgoing, setSelectedOutgoing] = useState<any>(null);
  const [openDetailsDialog, setOpenDetailsDialog] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<{
    paymentMethod: string;
    neftNo: string;
    cashVoucherNo: string;
    amount: string;
    bankName: string;
    paymentType: 'full' | 'partial' | 'advance';
    rtgsNo: string;
    paymentMode: 'Cash' | 'Bank';
    pettyCashAmount: number;
    hoCash: number;
    upi: string;
    impsNo: string;
    selectedDebitNotes: string[]; // Changed to array
  }>({
    paymentMethod: '',
    neftNo: '',
    cashVoucherNo: '',
    amount: '',
    bankName: '',
    paymentType: 'advance',
    rtgsNo: '',
    paymentMode: 'Cash',
    pettyCashAmount: 0,
    hoCash: 0,
    upi: '',
    impsNo: '',
    selectedDebitNotes: [], // Initialize as empty array
  });
  const [activeDebits, setActiveDebits] = useState<any[]>([]); // Added state for active debit notes

  const [selectedVendorName, setSelectedVendorName] = useState<VendorDetail | null>(null); // Default is null
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOutgoings, setSelectedOutgoings] = useState<Outgoing[]>([]);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false); // Controls the second dialog
  const [viewItemsDialogOpen, setViewItemsDialogOpen] = useState(false);
  const [selectedGrn, setSelectedGrn] = useState<GrnResponse | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [paymentDetailsToSend, setPaymentDetailsToSend] = useState<any>(null);
  const [confirmMultipleDialogOpen, setConfirmMultipleDialogOpen] = useState(false);
  const [paymentTypeMultiple, setPaymentTypeMultiple] = useState<{ [outgoingId: string]: 'full' | 'partial' }>({});
  const [partialAmount, setPartialAmount] = useState<{ [outgoingId: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false); // To track loading state
  const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'succeeded' | 'failed'>('idle');
  const [fetchedBusinessIds, setFetchedBusinessIds] = useState(new Set());
  const [status, setStatus] = useState(''); // Default status filter is "Pending"
  const [filteredOutgoing, setFilteredOutgoing] = useState<Outgoing[]>([]); // Explicit type declaration
  const [paymentTerms, setPaymentTerms] = useState("");
  const [openDialog, setOpenDialog] = useState(false);  // Control dialog visibility
  // State for the selected filter (number or empty string for all data)
  const [selectedDays, setSelectedDays] = useState<string | number>('');
  // Sort the outgoings data in descending order by 'dueDays' field
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null); // Default: no sorting
  const [sortColumn, setSortColumn] = useState<string | null>(null); // Default: no column sorted
  const currentPage = useSelector(selectCurrentPage);
  const pageSize = useSelector(selectPageSize);
  const totalItems = useSelector(selectTotalItems);
  const newPage = useSelector(selectCurrentPage);
  const [selectionRange, setSelectionRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    key: 'selection',
  });
  const dateField = 'invoiceDate';
  const fromDate = moment().utc().startOf('day').toDate(); // Start of the day (in UTC)
  const toDate = moment().utc().endOf('day').toDate(); // End of the day (in UTC)
  const [error, setError] = useState<string>('');
  const [errors, setErrors] = useState<{ [outgoingId: string]: string }>({});
  // Add this to your component's state
  const [totalAmount, setTotalAmount] = useState<number>(
    selectedOutgoing?.totalPayableAmount || 0
  );
  const [isFilterActive, setIsFilterActive] = useState(false);
const [confirmDialogProps, setConfirmDialogProps] = useState<{
    title: string;
    description: string | JSX.Element;
    onConfirm: () => void;
  }>({
    title: '',
    description: '',
    onConfirm: () => {},
  });
  const [isSinglePaymentLoading, setIsSinglePaymentLoading] = useState(false);
  const [isMultiplePaymentLoading, setIsMultiplePaymentLoading] = useState(false);
  const debitCreditNotes = useSelector((state: RootState) => selectDebitCreditNote(state).debitCreditNotes);
  // Compute selectedApInvoice from itemwise and selectedinvoiceId
  const selectedApInvoice = useMemo(() => {
    if (!selectedinvoiceId) return null;
    return itemwiseap.find(ap => ap.invoiceId === selectedinvoiceId) || null;
  }, [selectedinvoiceId, itemwiseap]);

  useEffect(() => {
    if (loadingState === 'idle') {
      // Fetch data only if newPage and pageSize change
      dispatch(fetchOutgoings({
        page: newPage,
        size: pageSize,
        filterByAmount: true,
      }));
    }
  }, [dispatch, loadingState, dateField, newPage, pageSize]); // Depend on loading, newPage, pageSize, currentDate
useEffect(() => {
  if (selectedOutgoing && openDetailsDialog && selectedOutgoing.vendorName) {
    const fetchActiveDebits = async () => {
      try {
        const response = await dispatch(
          fetchActiveDebitsVendor(selectedOutgoing.vendorName)
        ).unwrap();
        // Filter for active debit notes (assuming status is part of the response)
        const active = response.filter((note: any) => note.status === 'Active' || note.status === 'Partially Cleared');
        setActiveDebits(active);
      } catch (err) {
        dispatch(setSnackbarMessage('Failed to load active debit notes'));
        dispatch(setSnackbarOpen(true));
        console.error('Error fetching debit notes:', err);
      }
    };
    fetchActiveDebits();
  }
}, [selectedOutgoing, openDetailsDialog, dispatch]);
  useEffect(() => {
    if (loadingState === 'idle') {
      dispatch(fetchItemwiseGrns());
      dispatch(fetchRandomIDApInvoices());
      dispatch(fetchItemwiseAps()); // Ensure itemwise is fetched
      dispatch(fetchVendorDetails({ filterByAmount: true }));
    }
  }, [loadingState, dispatch]);

  const filteredPayments = useMemo(() => {
    const filteredOutgoings = [...outgoings].map(payment => {
      // Calculate the totalPaid and total for each payment
      const totalPaid =
        (payment.advanceAmount || 0) +
        (payment.partialAmount || 0) +
        (payment.fullPaymentAmount || 0);

      const total =
        (payment.advanceAmount || 0) +
        (payment.partialAmount || 0) +
        (payment.fullPaymentAmount || 0);

      return {
        ...payment,  // Spread the original payment object
        totalPaid,   // Add the calculated totalPaid
        total,       // Add the calculated total
      };
    });

    return [...filteredOutgoings].sort((a, b) => {
      const aDueDays = Number(a.intimationDays) || 0;
      const bDueDays = Number(b.intimationDays) || 0;

      const aPaymentTerms = parseInt(a.paymentTerms) || 0;
      const bPaymentTerms = parseInt(b.paymentTerms) || 0;

      // Independent sorting for 'dueDays'
      if (sortColumn === 'dueDays') {
        if (aDueDays === bDueDays) {
          return 0;
        }
        return sortOrder === 'asc' ? aDueDays - bDueDays : bDueDays - aDueDays;
      }

      // Independent sorting for 'paymentTerms'
      if (sortColumn === 'paymentTerms') {
        if (aPaymentTerms === bPaymentTerms) {
          return 0;
        }
        return sortOrder === 'asc' ? aPaymentTerms - bPaymentTerms : bPaymentTerms - aPaymentTerms;
      }

      return 0; // Default return value if no sorting happens
    });
  }, [outgoings, sortOrder, sortColumn]);
  const totalDebitAmount = useMemo(() => {
    return paymentDetails.selectedDebitNotes.reduce((sum, debitId) => {
      const debit = activeDebits.find((d) => d.randomId === debitId);
      return sum + (debit ? parseFloat(debit.finalAmount || '0') : 0);
    }, 0);
  }, [paymentDetails.selectedDebitNotes, activeDebits]);
const validateAmount = (amount: string, maxAllowed: number): string => {
  if (!amount) return 'Please enter an amount';
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) return 'Invalid amount format';
  if (numAmount < 0) return 'Amount cannot be negative';

  // Calculate total debit amount from selected debit notes
  const totalDebitAmount = paymentDetails.selectedDebitNotes.reduce(
    (sum, debitId) => {
      const debit = activeDebits.find((d) => d.randomId === debitId);
      return sum + (debit ? parseFloat(debit.finalAmount || '0') : 0);
    },
    0
  );

  // Check if total debit amount exceeds maxAllowed
  if (totalDebitAmount > maxAllowed) {
    return `Total debit notes (₹${totalDebitAmount.toFixed(2)}) cannot exceed total payable amount (₹${maxAllowed.toFixed(2)})`;
  }

  // Calculate remaining payable after debit notes
  const remainingPayable = maxAllowed - totalDebitAmount;

  // Check if payment amount exceeds remaining payable
  if (numAmount > remainingPayable) {
    return `Payment amount (₹${numAmount.toFixed(2)}) cannot exceed remaining payable amount (₹${remainingPayable.toFixed(2)}) after applying debit notes`;
  }

  return '';
};
  const handleApClick = (invoiceId: string | undefined) => {
    if (!invoiceId) {
      dispatch(setSnackbarMessage('Invalid AP Invoice ID'));
      dispatch(setSnackbarOpen(true));
      return;
    }

    // Set selectedinvoiceId and open dialog
    dispatch(setSelectedinvoiceId(invoiceId));
    dispatch(setApDialogOpen(true));
  };
  const handleCloseApDialog = () => {
    dispatch(setApDialogOpen(false));
    dispatch(setSelectedinvoiceId(null));
  };
  const handlePoClick = async (poId: string) => {
    try {
      const result = await dispatch(fetchPoById(poId)).unwrap();
      if (result) {
        const transformedPo: PoResponse = {
          purchaseOrderId: result.purchaseOrderId,
          randomId: result.randomId,
          vendorName: result.vendorName,
          orderDate: typeof result.orderDate === 'string' ? result.orderDate : result.orderDate?.toISOString() || null, // Ensure orderDate is a string
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
        console.log('transformedPo:', transformedPo); // Debug: Verify orderDate
        dispatch(setSelectedPo(transformedPo));
        setPoDialogOpen(true); // Open PODialog
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
  const handleViewCreditNotes = (outgoingId: string) => {
    console.log('Opening DebitCreditNoteDialog for outgoingId:', outgoingId);
    dispatch(setDebitCreditDocumentId(outgoingId)); // Set documentId
    dispatch(setDebitCreditDocumentType('Outgoing Payment')); // Set documentType
    dispatch(setDebitCreditDialogOpen(true)); // Open dialog
    dispatch(fetchDebitCreditNotesByDocument({ documentId: outgoingId, page: 1, size: 50 }));
  };

  // Precompute isDisabled and tooltipTitle based on hasDebitCreditNotes
  const outgoingCreditNoteStatus = useMemo(() => {
    const statusMap: { [key: string]: { isDisabled: boolean; tooltipTitle: string } } = {};
    outgoings.forEach((outgoingdebit) => {
      const hasDebitCreditNotes = outgoingdebit.hasDebitCreditNotes ?? debitCreditNotes.some((note) => note.documentId === outgoingdebit.outgoingId);
      statusMap[outgoingdebit.outgoingId] = {
        isDisabled: !hasDebitCreditNotes,
        tooltipTitle: hasDebitCreditNotes ? 'View Debit/Credit Notes' : 'No Debit/Credit Notes Available',
      };
    });
    return statusMap;
  }, [outgoings, debitCreditNotes]);

  useEffect(() => {
    dispatch(fetchBusinesses());
    dispatch(fetchBank());
  }, [dispatch]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > Math.ceil(totalItems / pageSize)) {
      return;
    }

    dispatch(setPagination({ page: newPage, size: pageSize }));

    if (isFilterActive) {
      // If filters are active, include all filter parameters
      const appliedFromDate = selectionRange?.startDate instanceof Date
        ? moment(selectionRange.startDate).startOf('day').toDate()
        : fromDate;

      const appliedToDate = selectionRange?.endDate instanceof Date
        ? moment(selectionRange.endDate).endOf('day').toDate()
        : toDate;

      dispatch(fetchOutgoings({
        page: newPage,
        size: pageSize,
        filterBy: dateField,
        fromDate: appliedFromDate,
        toDate: appliedToDate,
        filterByAmount: true,
        vendorName: selectedVendorName?.vendorName,
      }));
    } else {
      // If no filters are active, use basic pagination
      dispatch(fetchOutgoings({
        page: newPage,
        size: pageSize,
        filterBy: dateField,
        filterByAmount: true,
        fromDate: fromDate,
        toDate: toDate,
      }));
    }
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
    businesses.forEach((business) => {
      if (!fetchedBusinessIds.has(business.businessId)) {
        dispatch(fetchPhoto(business.businessId));
        setFetchedBusinessIds(prevSet => new Set(prevSet).add(business.businessId));
      }
    });
  }, [businesses, fetchedBusinessIds, dispatch]);
  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleViewDetails = (outgoing: any) => {
    setSelectedOutgoing(outgoing);
    setOpenDetailsDialog(true);
  };
  const handlePaymentModeChange = (e: React.ChangeEvent<{ value: unknown }>) => {
    const selectedMode = e.target.value as 'Cash' | 'Bank';
    setPaymentDetails(prevDetails => ({
      ...prevDetails,
      paymentMode: selectedMode,
      paymentMethod: '',  // Reset payment method when payment mode changes
    }));
  };
  const handlePaymentMethodChange = (e: React.ChangeEvent<{ value: unknown }>) => {
    const selectedMethod = e.target.value as string;
    setPaymentDetails(prevDetails => ({
      ...prevDetails,
      paymentMethod: selectedMethod,
    }));
  };
  const handleSort = (column: 'dueDays' | 'paymentTerms') => {
    if (sortColumn === column) {
      // Toggle sort order between 'asc' and 'desc' for the clicked column
      setSortOrder(prevOrder => (prevOrder === 'asc' ? 'desc' : 'asc'));
    } else {
      // Set to 'asc' when clicking a new column and update the sorted column
      setSortOrder('asc');  // Default to 'asc' on first click
      setSortColumn(column);
    }
  };

  // Handle payment terms change
  const handlePaymentTermsChange = (event: any) => {
    setPaymentTerms(event.target.value);
  };
  const handleDaysChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDays(Number(event.target.value));
  };
  // Handle debit note selection
const handleDebitNoteChange = (debitId: string) => {
  setPaymentDetails((prev) => {
    const newSelectedDebitNotes = prev.selectedDebitNotes.includes(debitId)
      ? prev.selectedDebitNotes.filter((id) => id !== debitId)
      : [...prev.selectedDebitNotes, debitId];

    // Calculate total debit amount
    const totalDebitAmount = newSelectedDebitNotes.reduce((sum, id) => {
      const debit = activeDebits.find((d) => d.randomId === id);
      return sum + (debit ? parseFloat(debit.finalAmount || '0') : 0);
    }, 0);

    // Calculate remaining payable amount
    const remainingPayable = selectedOutgoing?.totalPayableAmount
      ? selectedOutgoing.totalPayableAmount - totalDebitAmount
      : 0;

    // Validate total debit amount
    const validationError = totalDebitAmount > (selectedOutgoing?.totalPayableAmount || 0)
      ? `Total debit notes (₹${totalDebitAmount.toFixed(2)}) cannot exceed total payable amount (₹${selectedOutgoing?.totalPayableAmount.toFixed(2)})`
      : '';

    setError(validationError);

    // If error, revert to previous selection; else update amount to remaining
    return {
      ...prev,
      selectedDebitNotes: validationError ? prev.selectedDebitNotes : newSelectedDebitNotes,
      amount: validationError
        ? prev.amount
        : remainingPayable > 0
        ? remainingPayable.toFixed(2)
        : '0.00', // Auto-fill amount with remaining
    };
  });
};
  const handleClosePayDialog = () => {
    setOpenDetailsDialog(false);
    resetPaymentDetails();
  };

  const handleCloseMultipleDialog = () => {
    setPaymentDialogOpen(false);
    resetPaymentDetails();
  };
const handleFilterClick = () => {
  setIsFilterActive(true);

  const formattedStartDate = selectionRange?.startDate instanceof Date
    ? moment(selectionRange.startDate).startOf('day').toISOString()
    : fromDate?.toISOString();
    
  const formattedEndDate = selectionRange?.endDate instanceof Date
    ? moment(selectionRange.endDate).endOf('day').toISOString()
    : toDate?.toISOString();

  const newPage = 1;
  dispatch(setPagination({ page: newPage, size: pageSize }));

  // Prepare filter parameters - only include values that are selected
  const filterParams: any = {
    page: newPage,
    size: pageSize,
    filterByAmount: true,
  };

  // Only add dates if they are selected
  if (formattedStartDate) {
    filterParams.fromDate = new Date(formattedStartDate);
  }
  
  if (formattedEndDate) {
    filterParams.toDate = new Date(formattedEndDate);
  }

  // Only add vendor name if selected and not empty
  if (selectedVendorName?.vendorName && 
      selectedVendorName.vendorName.trim() !== '' && 
      selectedVendorName.vendorName !== 'none') {
    filterParams.vendorName = selectedVendorName.vendorName.trim();
  }

  // Only add dateField if selected and not empty
  if (dateField && dateField.trim() !== '' ) {
    filterParams.filterBy = dateField.trim();
  }

  // Only add status if selected and not empty/all
  if (status && status.trim() !== '' && status !== 'none' && status !== 'all') {
    filterParams.status = status.trim();
  }

  console.log('Applying filters:', filterParams);

  dispatch(fetchOutgoings(filterParams))
    .then((response) => {
      const data = response.payload || [];
      console.log('Filtered outgoings:', data);
      if (data.length === 0) {
        setSnackbarMessage('No matching Outgoing Payment found.');
        setSnackbarOpen(true);
      } else {
        setFilteredOutgoing(data);
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
    setIsFilterActive(false);
    setSelectionRange({
      startDate: new Date(),  // Set to current date
      endDate: new Date(),    // Set to current date
      key: 'selection',       // Retain the key
    });
    setStatus(''); // Clear status filter
    setSelectedVendorName(null); // Reset selectedVendorName to null
    dispatch(fetchOutgoings({
      page: newPage,
      size: pageSize,
      filterBy: dateField,
      filterByAmount: true,
    }));
  };

  // Close the dialog
  const handleCloseViewItemsDialog = () => {
    setViewItemsDialogOpen(false);
    setSelectedGrn(null);  // Clear the selected GRN details
  };

  const resetPaymentDetails = () => {
    setPaymentDetails({
      paymentMethod: '',
      neftNo: '',
      cashVoucherNo: '',
      amount: '',
      bankName: '',
      paymentType: 'advance', // Default value
      rtgsNo: '',
      paymentMode: 'Cash', // Default value for paymentMode
      pettyCashAmount: 0, // Default value for pettyCashAmount
      hoCash: 0, // Default value for hoCash
      upi: '', // Default value for upi
      impsNo: '', // Default value for impsNo
      selectedDebitNotes:[]
    });
  };

  const handlePaymentTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedType = e.target.value as "full" | "partial" | "advance"; // Explicitly cast to the type
    setPaymentDetails(prevDetails => ({
      ...prevDetails,
      paymentType: selectedType,
      amount: selectedType === 'full' && selectedOutgoing
        ? selectedOutgoing.totalPayableAmount?.toString() ?? ''
        : '',
    }));
    setError('');
  };
  const handleProcessPayment = () => {
    setDialogOpen(true);  // Close the first dialog
    setPaymentDialogOpen(true);  // Open the second dialog for payment method
  };
const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const { name, value } = e.target;

  if (name === 'amount') {
    // Only allow numbers and decimal point
    if (!/^\d*\.?\d*$/.test(value)) {
      return;
    }

    // Only validate if selectedOutgoing exists
    if (selectedOutgoing?.totalPayableAmount) {
      const validationError = validateAmount(value, selectedOutgoing.totalPayableAmount);
      setError(validationError);
    } else {
      setError('No payable amount available for validation');
    }
  }

  setPaymentDetails(prevDetails => ({
    ...prevDetails,
    [name]: value,
  }));
};

  const getRandomId = (grnId: string): string | undefined => {
    const grn = itemwise.find(grn => grn.grnId === grnId);
    return grn?.randomId;
  };

  const getApRandomId = (apinvoiceId: string): string | undefined => {
    const ap = randomIdap.find(ap => ap.invoiceId === apinvoiceId);
    return ap?.randomId;
  };
  const groupedOutgoingsByVendor = (outgoings: Outgoing[]): Record<string, Outgoing[]> => {
    return outgoings.reduce((acc: Record<string, Outgoing[]>, outgoing: Outgoing) => {
      const vendorName = outgoing.vendorName ?? 'Unknown Vendor'; // Handle undefined vendorName

      if (!acc[vendorName]) {
        acc[vendorName] = [];
      }

      acc[vendorName].push(outgoing);
      return acc;
    }, {});
  };
const handleConfirmPayment = async () => {
  if (!selectedOutgoing || !paymentDetails.amount) {
    dispatch(setSnackbarMessage('Please enter a valid amount'));
    dispatch(setSnackbarOpen(true));
    return;
  }
  const validationError = validateAmount(
    paymentDetails.amount,
    selectedOutgoing.totalPayableAmount
  );
  if (validationError) {
    setError(validationError);
    dispatch(setSnackbarMessage(validationError));
    dispatch(setSnackbarOpen(true));
    return;
  }
  const paymentAmount = parseFloat(paymentDetails.amount);
  const totalDebitAmount = paymentDetails.selectedDebitNotes.reduce((sum, debitId) => {
    const debit = activeDebits.find((d) => d.randomId === debitId);
    return sum + (debit ? parseFloat(debit.finalAmount || '0') : 0);
  }, 0);
  const remainingPayable = selectedOutgoing.totalPayableAmount - totalDebitAmount - paymentAmount;

  const paymentDetailsToSend = {
    outgoingId: selectedOutgoing.outgoingId,
    paymentType: paymentDetails.paymentType,
    totalPayableAmount: selectedOutgoing.totalPayableAmount || 0,
    fullPaymentAmount: paymentDetails.paymentType === 'full' ? (selectedOutgoing.totalPayableAmount - totalDebitAmount) : 0,
    partialAmount: paymentDetails.paymentType === 'partial' ? paymentAmount : 0,
    advanceAmount: paymentDetails.paymentType === 'advance' ? paymentAmount : 0,
    paymentMethod: paymentDetails.paymentMethod,
    paymentMode: paymentDetails.paymentMode,
    pettyCashAmount: paymentDetails.paymentMode === 'Cash' && paymentDetails.paymentMethod === 'pettyCash' ? paymentAmount : 0,
    hoCash: paymentDetails.paymentMode === 'Cash' && paymentDetails.paymentMethod === 'hoCash' ? paymentAmount : 0,
    upi: paymentDetails.paymentMethod === 'upi' ? paymentDetails.upi : '',
    bankName: paymentDetails.paymentMode === 'Bank' ? paymentDetails.bankName : '',
    impsNo: paymentDetails.paymentMethod === 'imps' ? paymentDetails.impsNo : '',
    neftNo: paymentDetails.paymentMethod === 'neft' ? paymentDetails.neftNo : '',
    rtgsNo: paymentDetails.paymentMethod === 'rtgs' ? paymentDetails.rtgsNo : '',
    chequeNo: '',
    selectedDebitNotes: paymentDetails.selectedDebitNotes,
  };

  const proceedWithPayment = async () => {
    try {
      setIsSinglePaymentLoading(true);
      await dispatch(processPayment(paymentDetailsToSend)).unwrap();
      resetPaymentDetails();
      setOpenDetailsDialog(false);
      dispatch(fetchOutgoings({
        page: newPage,
        size: pageSize,
        filterBy: dateField,
        filterByAmount: true,
      }));
      setConfirmDialogOpen(false);
      dispatch(setSnackbarMessage('Payment processed successfully'));
      dispatch(setSnackbarOpen(true));
    } catch (error) {
      console.error('Failed to process payment:', error);
      dispatch(setSnackbarMessage('Failed to process payment. Please try again.'));
      dispatch(setSnackbarOpen(true));
    } finally {
      setIsSinglePaymentLoading(false);
    }
  };

  // Check for existing debit notes or no debit notes selected
  const hasExistingDebitNotes = selectedOutgoing.hasDebitCreditNotes || paymentDetails.selectedDebitNotes.length > 0;

  if (hasExistingDebitNotes && paymentDetails.selectedDebitNotes.length === 0) {
    setConfirmDialogProps({
      title: 'Confirm Payment Without Debit Note',
      description: (
        <Box>
          <Typography>
            This invoice already has debit notes applied. Are you sure you want to proceed with the payment without applying additional debit notes?
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Vendor: {selectedOutgoing?.vendorName} <br />
            Invoice No: {selectedOutgoing?.invoiceNo} <br />
            Total Payable: {selectedOutgoing?.totalPayableAmount.toFixed(2)} <br />
            Debit Notes Applied: {totalDebitAmount.toFixed(2)} <br />
            Payment Amount: {paymentAmount.toFixed(2)} <br />
            Remaining Payable: {remainingPayable.toFixed(2)}
          </Typography>
        </Box>
      ),
      onConfirm: proceedWithPayment,
    });
    setConfirmDialogOpen(true);
  } else if (paymentDetails.selectedDebitNotes.length === 0 && activeDebits.length > 0) {
    setConfirmDialogProps({
      title: 'Confirm Payment Without Debit Note',
      description: (
        <Box>
          <Typography>
            There are available debit notes for this vendor. Are you sure you want to proceed with the payment without applying any debit notes?
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Vendor: {selectedOutgoing?.vendorName} <br />
            Invoice No: {selectedOutgoing?.invoiceNo} <br />
            Total Payable: {selectedOutgoing?.totalPayableAmount.toFixed(2)} <br />
            Debit Notes Applied: {totalDebitAmount.toFixed(2)} <br />
            Payment Amount: {paymentAmount.toFixed(2)} <br />
            Remaining Payable: {remainingPayable.toFixed(2)}
          </Typography>
        </Box>
      ),
      onConfirm: proceedWithPayment,
    });
    setConfirmDialogOpen(true);
  } else if (totalDebitAmount > 0 && paymentDetails.paymentType === 'full' && totalDebitAmount + paymentAmount > selectedOutgoing.totalPayableAmount) {
    setConfirmDialogProps({
      title: 'Confirm Full Payment with Debit Notes',
      description: (
        <Box>
          <Typography>
            You have selected debit notes totaling {totalDebitAmount.toFixed(2)}, and for full payment, the amount will be adjusted to { (selectedOutgoing.totalPayableAmount - totalDebitAmount).toFixed(2) }. Are you sure you want to proceed? You may not have paid the full amount yet.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Vendor: {selectedOutgoing?.vendorName} <br />
            Invoice No: {selectedOutgoing?.invoiceNo} <br />
            Total Payable: {selectedOutgoing?.totalPayableAmount.toFixed(2)} <br />
            Debit Notes Applied: {totalDebitAmount.toFixed(2)} <br />
            Adjusted Payment Amount: {(selectedOutgoing.totalPayableAmount - totalDebitAmount).toFixed(2)} <br />
            Remaining Payable: {remainingPayable.toFixed(2)}
          </Typography>
        </Box>
      ),
      onConfirm: proceedWithPayment,
    });
    setConfirmDialogOpen(true);
  } else {
    setConfirmDialogProps({
      title: 'Confirm Payment',
      description: (
        <Box>
          <Typography>
            Are you sure you want to process the payment for this outgoing?
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Vendor: {selectedOutgoing?.vendorName} <br />
            Invoice No: {selectedOutgoing?.invoiceNo} <br />
            Total Payable: {selectedOutgoing?.totalPayableAmount.toFixed(2)} <br />
            Debit Notes Applied: {totalDebitAmount.toFixed(2)} <br />
            Payment Amount: {paymentAmount.toFixed(2)} <br />
            Remaining Payable: {remainingPayable.toFixed(2)}
          </Typography>
        </Box>
      ),
      onConfirm: proceedWithPayment,
    });
    setConfirmDialogOpen(true);
  }
};
  console.log(filteredPayments);


  // Handle the selection/deselection of rows
  const handleRowSelect = (outgoingId: string) => {
    setSelectedRows((prevSelectedRows) => {
      if (prevSelectedRows.includes(outgoingId)) {
        // If already selected, deselect it
        return prevSelectedRows.filter(id => id !== outgoingId);
      } else {
        // If not selected, add to the selected rows
        return [...prevSelectedRows, outgoingId];
      }
    });
  };

  const handlePaymentTypeChangeMultiple = (outgoingId: string, value: 'full' | 'partial') => {
    if (outgoingId) {
      setPaymentTypeMultiple(prev => ({ ...prev, [outgoingId]: value }));
    }

  };

  const handlePartialAmountChangeMultiple = (outgoingId: string, value: string, totalPayableAmount: number) => {
  if (!outgoingId) return;
  // Allow empty input to clear the field without setting an error
  if (value === '') {
    setPartialAmount(prev => ({ ...prev, [outgoingId]: '' }));
    setErrors(prev => ({ ...prev, [outgoingId]: '' }));
    return;
  }
  const validationError = validateAmount(value, totalPayableAmount); // Pass totalPayableAmount
  if (validationError) {
    setErrors(prev => ({ ...prev, [outgoingId]: validationError }));
    setPartialAmount(prev => ({ ...prev, [outgoingId]: value }));
  } else {
    setErrors(prev => ({ ...prev, [outgoingId]: '' }));
    setPartialAmount(prev => ({ ...prev, [outgoingId]: value }));
  }
};

  const handlePartialAmountChange = (outgoingId: string, value: string) => {
    setPartialAmount((prev) => ({
      ...prev,
      [outgoingId]: value,
    }));
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

  const generateOutgoingInvoicePDF = () => {
    console.log(filteredPayments); // Log the filtered data to ensure it has data

    // Initialize jsPDF instance
    const doc = new jsPDF();

    // Starting yOffset for content
    let yOffset = 10;

    // Define the logo and title position
    const logoX = 14; // Position for logo
    const titleX = 80; // Position for title and summary text

    // Add business image on the left side (adjust as needed)
    const business = businesses.length > 0 ? businesses[0] : null;

    if (business && business.imageUrl) {
      try {
        doc.addImage(business.imageUrl, 'JPEG', logoX, yOffset, 20, 20); // Adjust image size and position
      } catch (e) {
        console.error("Image failed to load:", e);
      }
    }

    // Adjust the title and summary below the image
    doc.setFontSize(12); // Increase title font size
    doc.text("Outgoing Order Summary", titleX, yOffset + 10); // Title at the top next to the logo

    // Add underline below the title
    const titleWidth = doc.getTextWidth("Outgoing Order Summary"); // Get the width of the title text
    const underlineStartX = titleX; // X position for the start of the underline
    const underlineEndX = underlineStartX + titleWidth; // X position for the end of the underline
    doc.setLineWidth(0.5); // Set the thickness of the underline
    doc.line(underlineStartX, yOffset + 12, underlineEndX, yOffset + 12); // Draw the underline below the title

    // Update yOffset for next row content (Date and Amount)
    yOffset += 25; // Adjust position for the next content

    // Calculate the total ordered amount before generating the table
    const totalPayableAmount = (filteredPayments || []).reduce((sum, outgoing) => {
      const amount = outgoing.totalPayableAmount || 0; // Ensure it's a number
      return sum + amount;
    }, 0);

    const today = new Date();
    const currentDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

    // Display the "Date" on the left and "Total Payable Amount" on the right in the next row
    doc.setFontSize(10); // Adjust font size for the total row
    doc.text(`Date: ${currentDate}`, 14, yOffset); // Date on the left
    doc.text(`Total Payable Amount: ${totalPayableAmount.toFixed(2)}`, 140, yOffset); // Amount on the right

    yOffset += 5; // Adjust space before the table

    // Table headers for summary data with added PO No, GRN No, and AP No
    const headers = [
      [
        "S.No",
        "PO No",
        "GRN No",
        "AP No",
        "Outgoing ID",
        "Vendor Name",
        "Invoice No",
        "Invoice Date",
        "Total Invoice Amount",
        "Paid Amount",
        "Remaining Amount",
      ],
    ];

    // Prepare rows for purchase order summary (filter only the valid orders)
    const rows = (filteredPayments || []).map((outgoing, index) => {
      const totalPayableAmount = outgoing.totalPayableAmount || 0;
      const totalDiscount = outgoing.discountDetails || 0;
      const finalAmount = totalPayableAmount - totalDiscount;

      if (!outgoing.randomId || !outgoing.vendorName || !outgoing.invoiceDate || totalPayableAmount <= 0) {
        return null; // Skip invalid rows
      }

      return [
        `${index + 1}`,
        outgoing.poRandomId || "N/A", // Add PO Random ID
        getRandomId(outgoing.grnId) || "N/A", // Add GRN Random ID
        getApRandomId(outgoing.invoiceId) || "N/A", // Add AP Random ID
        outgoing.randomId.toString(),
        outgoing.vendorName.toString(),
        outgoing.invoiceNo || "N/A",
        outgoing.invoiceDate ? format(new Date(outgoing.invoiceDate), 'dd-MM-yyyy') : 'Not Provided',
        outgoing.payableAmount?.toFixed(2) || "0.00",
        outgoing.totalPaid?.toFixed(2) || "0.00",
        outgoing.totalPayableAmount?.toFixed(2) || "0.00",
      ];
    }).filter(row => row !== null);

    // Add the table to the PDF with custom styles
    doc.autoTable({
      head: headers,
      body: rows,
      startY: yOffset, // Start the table below the "Date" and "Total Payable Amount"
      styles: {
        fillColor: [255, 255, 255], // White background for cells
        textColor: [0, 0, 0], // Black text color
        lineColor: [0, 0, 0], // Black table borders
        fontSize: 8, // Set the font size here
      },
      headStyles: {
        fillColor: [0, 0, 128], // DodgerBlue background for the header
        textColor: [255, 255, 255], // White text color for header
      },
      bodyStyles: {
        fillColor: [255, 255, 255], // White background for rows
        textColor: [0, 0, 0], // Black text color for rows
      },
      columnStyles: {
        0: { halign: 'center' }, // S.No
        1: { halign: 'left' }, // Outgoing ID
        2: { halign: 'left' }, // Vendor Name
        3: { halign: 'left' }, // Invoice No
        4: { halign: 'left' }, // Invoice Date
        5: { halign: 'left' }, // PO No
        6: { halign: 'left' }, // GRN No
        7: { halign: 'left' }, // AP No
        8: { halign: 'right' }, // Total Invoice Amount
        9: { halign: 'right' }, // Paid Amount
        10: { halign: 'right' }, // Remaining Amount
      },
    });
const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Page ${i} of ${totalPages}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
  }
    // Save the PDF with a dynamic name based on outgoing order ID
    const pdfFilename = `PendingOutgoing.pdf`;
    doc.save(pdfFilename);
    setOpenDialog(false);
  };
  const generateOutgoingSummaryCSV = () => {
    // Define headers for the CSV
    const headers = [
      [
        "S.No",
        "PO No",
        "GRN No",
        "AP No",
        "Outgoing No",
        "Vendor Name",
        "Invoice No",
        "Invoice Date",
        "Total Amount",
        "Tax Details",
        "Discount Amount",
        "Total",
        "Paid Amount",
        "Remaining Amount",
        "Due Days",
        "Payment Terms"
      ]
    ];

    // Prepare rows for the CSV data
    const rows = (filteredPayments || []).map((outgoing, index) => {
      const totalPayableAmount = outgoing.totalPayableAmount || 0;
      const totalDiscount = outgoing.discountDetails || 0;

      if (!outgoing.randomId || !outgoing.vendorName || !outgoing.invoiceDate || totalPayableAmount <= 0) {
        return null;
      }

      return [
        `${index + 1}`,
        outgoing.poRandomId || "N/A", // PO No
        getRandomId(outgoing.grnId) || "N/A", // GRN No
        getApRandomId(outgoing.invoiceId) || "N/A", // AP No
        outgoing.randomId.toString(), // Outgoing No
        outgoing.vendorName.toString(),
        outgoing.invoiceNo || "N/A",
        outgoing.invoiceDate ? format(new Date(outgoing.invoiceDate), 'dd-MM-yyyy') : 'Not Provided',
        outgoing.totalPrice?.toFixed(2) || "0.00",
        outgoing.taxDetails || "N/A",
        outgoing.discountDetails?.toFixed(2) || "0.00",
        outgoing.payableAmount?.toFixed(2) || "0.00",
        outgoing.totalPaid?.toFixed(2) || "0.00",
        outgoing.totalPayableAmount?.toFixed(2) || "0.00",
        outgoing.intimationDays || "N/A",
        outgoing.paymentTerms || "N/A",
      ];
    }).filter(row => row !== null);

    const csvData = [headers[0], ...rows]; // Combine headers and rows

    // Use PapaParse to convert array to CSV string and trigger download
    const csv = Papa.unparse(csvData);

    // Create a Blob from the CSV string
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    // Trigger download
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "OutgoingSummary.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setOpenDialog(false);
  };

  const handlePayClick = () => {
    // Gather selected data and make sure outgoingId is defined
    const selectedData = outgoings.filter(outgoing =>
      outgoing.outgoingId !== undefined && selectedRows.includes(outgoing.outgoingId)
    );

    // Set the selected data and open the dialog
    setSelectedOutgoings(selectedData);
    setDialogOpen(true);
  };
  const handleConfirmMultiplePayment = async () => {
    try {
      setIsMultiplePaymentLoading(true);
      if (!paymentDetails.paymentMode) {
        dispatch(setSnackbarMessage('Payment mode is required.'));
        dispatch(setSnackbarOpen(true));
        return;
      }
      // Prepare payments array for processBulkPayment
      const payments = selectedOutgoings.map((outgoing) => {
        const paymentType = paymentTypeMultiple[outgoing.outgoingId as string] || 'full';
        const paymentAmount = paymentType === 'partial' ? parseFloat(partialAmount[outgoing.outgoingId as string] || '0') : outgoing.totalPayableAmount || 0;

        // Validate payment amount
        if (paymentType === 'partial' && (isNaN(paymentAmount) || paymentAmount <= 0 || paymentAmount > (outgoing.totalPayableAmount || 0))) {
          throw new Error(`Invalid partial amount for outgoing ${outgoing.outgoingId}`);
        }

        return {
          paymentMode: paymentDetails.paymentMode,
          paymentType,
          fullPaymentAmount: paymentType === 'full' ? paymentAmount : 0,
          partialAmount: paymentType === 'partial' ? paymentAmount : 0,
          paymentMethod: paymentDetails.paymentMethod || undefined,
          chequeNo: paymentDetails.paymentMethod === 'cheque' ? paymentDetails.cashVoucherNo : undefined,
          neftNo: paymentDetails.paymentMethod === 'neft' ? paymentDetails.neftNo : undefined,
          rtgsNo: paymentDetails.paymentMethod === 'rtgs' ? paymentDetails.rtgsNo : undefined,
          impsNo: paymentDetails.paymentMethod === 'imps' ? paymentDetails.impsNo : undefined,
          upi: paymentDetails.paymentMethod === 'upi' ? paymentDetails.upi : undefined,
          pettyCashAmount: paymentDetails.paymentMode === 'Cash' && paymentDetails.paymentMethod === 'pettyCash' ? paymentAmount : 0,
          hoCash: paymentDetails.paymentMode === 'Cash' && paymentDetails.paymentMethod === 'hoCash' ? paymentAmount : 0,
          bankName: paymentDetails.paymentMode === 'Bank' ? paymentDetails.bankName : undefined,
        };
      });

      // Prepare outgoingIds
      const outgoingIds = selectedOutgoings.map((outgoing) => outgoing.outgoingId as string);

      // Dispatch processBulkPayment
      await dispatch(processBulkPayment({ payments, outgoingIds })).unwrap();

      // Reset state and refresh data
      setSelectedRows([]);
      dispatch(fetchOutgoings({
        page: newPage,
        size: pageSize,
        filterBy: dateField,
        filterByAmount: true,
        fromDate,
        toDate
      }));
      setPaymentDialogOpen(false);
      setConfirmMultipleDialogOpen(false);
      setDialogOpen(false);
      resetPaymentDetails();
    } catch (error: any) {
      console.error('Error processing bulk payments:', error);
      dispatch(setSnackbarMessage(error.message || 'Failed to process bulk payments.'));
      dispatch(setSnackbarOpen(true));
    } finally {
      setIsMultiplePaymentLoading(false);
    }
  };

  const handleDownload = async (outgoingId: string) => {
    const outgoingdetail = outgoings.find((outgoing) => outgoing.outgoingId === outgoingId);

    if (!outgoingdetail) {
      console.error('Outgoing not found!');
      return;
    }

    const business = businesses.length > 0 ? businesses[0] : null;
    const doc = new jsPDF();
    let yOffset = 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 128);
    doc.text('Pending Payment', 90, yOffset + 5);

    // Add underline
    const textWidth = doc.getTextWidth('Pending Payment'); // Get the width of the text
    doc.setDrawColor(0, 0, 128); // Set underline color (same as text color)
    doc.line(90, yOffset + 7, 90 + textWidth, yOffset + 7); // Draw the underline

    yOffset += 10;

    // Add Business Logo if available
    if (business && business.imageUrl) {
      try {
        let logoX = 20; // Position for the logo horizontally
        let yOffset = 5; // Position for the content vertically
        doc.addImage(business.imageUrl, 'JPEG', logoX, yOffset, 20, 20);  // Adjust image size and position
      } catch (e) {
        console.error("Image failed to load:", e);
      }
    }

    // Filter related outgoings based on grnId
    const relatedOutgoings = outgoings.filter(outgoing => outgoing.grnId === outgoingdetail.grnId);
    if (relatedOutgoings.length === 0) {
      console.error('No related outgoing items found!');
      return;
    }

    // Payment Details Section
    const paymentMethod = outgoingdetail.paymentMethod || 'Not Provided';
    let paymentDetails = '';

    if (paymentMethod === 'cash') {
      paymentDetails = `Cash Voucher No: ${outgoingdetail.cashVoucherNo || 'Not Provided'}`;
    } else if (paymentMethod === 'neft') {
      paymentDetails = `NEFT No: ${outgoingdetail.neftNo || 'Not Provided'}`;
    } else if (paymentMethod === 'rtgs') {
      paymentDetails = `RTGS No: ${outgoingdetail.rtgsNo || 'Not Provided'}`;
    }

    // Add Payment details to the PDF
    doc.setFontSize(10);
    doc.text(`Payment Method: ${paymentMethod}`, 14, yOffset + 10);
    doc.text(paymentDetails, 14, yOffset + 20);

    yOffset += 15;
    // Vendor and Business Details
    const vendorDetailsRows = [
      [
        `Vendor Name: ${outgoingdetail.vendorName || 'Not Provided'}\n` +
        `GSTIN: ${outgoingdetail.gstNumber || 'Not Provided'}\n` +
        `Address: ${outgoingdetail.address || 'Not Provided'}\n` +
        `City: ${outgoingdetail.city || 'Not Provided'}\n` +
        `State: ${outgoingdetail.state || 'Not Provided'}\n` +
        `Country: ${outgoingdetail.country || 'Not Provided'}\n` +
        `Email: ${outgoingdetail.contactpersonEmail || 'Not Provided'}`,
        `Business Name: ${business?.companyName || ''}\n` +
        `GSTIN: ${business?.gstIn || ''}\n` +
        `Address: ${business?.address1 || ''}\n` +
        `Phone: ${business?.phoneNo || ''}\n` +
        `Email: ${business?.emailId || ''}`,
        `Outgoing No: ${outgoingdetail.randomId || 'Not Provided'}\n` +
        `PO No: ${outgoingdetail.poRandomId || 'Not Provided'}\n` +
        `GRN No: ${getRandomId(outgoingdetail.grnId) || 'Not Provided'}\n` +
        `AP No: ${outgoingdetail.apRandomId}\n` +
        `Date: ${outgoingdetail.createdDate ? format(new Date(outgoingdetail.createdDate), 'dd-MM-yyyy') : 'Not Provided'}`
      ]
    ];

    doc.autoTable({
      head: [['Vendor Details', 'Business Details', 'Outgoing Payment Details']],
      body: vendorDetailsRows,
      startY: yOffset,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4, halign: 'left', valign: 'top', overflow: 'linebreak' },
      columnStyles: { 0: { cellWidth: 60.6 }, 1: { cellWidth: 60.6 }, 2: { cellWidth: 60.6 } },
      headStyles: { fillColor: [0, 0, 128], textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { lineWidth: 0.1, lineColor: [0, 0, 0], textColor: [0, 0, 0], minCellHeight: 15 },
      tableLineColor: [0, 0, 0],
      tableLineWidth: 0.1,
    });

    yOffset = doc.autoTable.previous.finalY; // Set to finalY directly to avoid extra space

    // Items Table Header
    const itemHeader = [
      'Invoice No',
      'Invoice Date',
      'Vendor Name',
      'Item Name',
      'Tax Details',
      'Tax Amount',
      'Without Tax Value',
      'With Tax Value'
    ];

    const filteredItems = outgoingdetail.grnId
      ? itemwise.filter(grn => grn.grnId === outgoingdetail.grnId).flatMap(grn => grn.itemDetails)
      : []; // Default empty array if no matching grnId

    const tableRows = filteredItems.length > 0
      ? filteredItems.map((item) => {
        const unitPrice = item.unitPrice || 0;
        const quantity = item.quantity || 0;
        const withoutTaxValue = unitPrice * quantity;
        const taxAmount = withoutTaxValue * (item.purchasetaxName / 100);
        const withTaxValue = withoutTaxValue + taxAmount;

        return [
          outgoingdetail.invoiceNo || 'N/A',  // Invoice No
          outgoingdetail.invoiceDate ? format(new Date(outgoingdetail.invoiceDate), 'dd-MM-yyyy') : 'Not Provided',  // Invoice Date
          outgoingdetail.vendorName || 'N/A',  // Vendor Name
          item.itemName,
          `${item.purchasetaxName}%`,  // Tax Details
          taxAmount.toFixed(2),  // Tax Amount
          outgoingdetail.totalPrice?.toFixed(2),  // Without Tax Value
          outgoingdetail.payableAmount?.toFixed(2),  // With Tax Value
        ];
      })
      : [
        [
          outgoingdetail.invoiceNo || '',  // Invoice No
          outgoingdetail.invoiceDate ? format(new Date(outgoingdetail.invoiceDate), 'dd-MM-yyyy') : 'Not Provided',  // Invoice Date
          outgoingdetail.vendorName || 'N/A',  // Vendor Name
          'N/A',
          'N/A',  // Tax Details (No items, no tax)
          '0.00',  // Tax Amount
          '0.00',  // Without Tax Value
          '0.00',  // With Tax Value
        ]
      ];  // Fallback row for when there are no items

    doc.autoTable({
      head: [itemHeader],
      body: tableRows,
      startY: yOffset,
      theme: 'grid',
      styles: { fontSize: 8, halign: 'center', cellPadding: 2 },
      headStyles: { fillColor: [0, 0, 128], textColor: [255, 255, 255], lineWidth: 0.1, lineColor: [0, 0, 0] },
      bodyStyles: { lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], },
      columnStyles: {
        0: { halign: 'center' },
        1: { halign: 'left' },
        2: { halign: 'left' },
        3: { halign: 'left' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
      },
    });

    yOffset = doc.autoTable.previous.finalY; // Directly use finalY to avoid any spacing

    // Overall Total Payable Amount
    const discount = outgoingdetail.discountDetails || 0;
    const totalPayableAmount = outgoingdetail.totalPayableAmount || 0;
    const fullPaymentAmount = outgoingdetail.fullPaymentAmount || 0;
    const advanceAmount = outgoingdetail.advanceAmount || 0;
    const partialAmount = outgoingdetail.partialAmount || 0;

    let paidAmount = 0;
    let pendingAmount = 0;
    let paymentStatus = '';

    if (outgoingdetail.status === 'Fully Paid') {
      paidAmount = totalPayableAmount;
    } else if (outgoingdetail.status === 'Partially Paid') {
      paidAmount = partialAmount;
    } else if (outgoingdetail.status === 'Advance PAid') {
      paidAmount = advanceAmount;
    }

    // Now you can update the summaryTable with payment status, paid amount, and pending amount.
    const summaryTable = [
      ['Discount', discount.toFixed(2)],
      ['Paid Amount', paidAmount.toFixed(2)],
      ['Remaining Payable Amount', totalPayableAmount.toFixed(2)],

    ];

    doc.autoTable({
      head: [['Description', 'Amount']],
      body: summaryTable,
      startY: yOffset,
      theme: 'grid',
      styles: { fontSize: 8, halign: 'right', cellPadding: 2 },
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.1 },
      bodyStyles: { lineColor: [0, 0, 0], lineWidth: 0.1 },
    });

    let statusImage = '';
    let statusText = '';
    if (outgoingdetail.status === 'active') {
      statusImage = '/images/pending.jpeg'; // Path to the pending image
    } else if (outgoingdetail.status === 'Partially Paid') {
      statusImage = '/images/partial.jpg'; // Path to the partially paid image
    } else if (outgoingdetail.status === 'Advance Paid') {
      statusImage = '/images/advancecash.jpg'; // Path to the advance paid image
    }

    // If a status image exists, add it to the PDF
    if (statusImage) {
      const img = new Image();
      img.src = statusImage;

      // Wait for image to load before adding to the document
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          doc.addImage(img, 'jpg', 150, yOffset + 40, 30, 25);
          resolve();
        };
        img.onerror = reject;
      });
    }
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${totalPages}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }
    doc.save(`${outgoingdetail.randomId}.pdf`);
  };
  const getColorByDueDays = (dueDays: string) => {
    const dueDaysNumber = parseInt(dueDays, 10); // Convert string to number

    if (isNaN(dueDaysNumber)) {
      return 'black';  // Default color if dueDays is not a valid number
    }

    if (dueDaysNumber <= 0) {
      return 'red';  // Overdue (due date has passed)
    } else if (dueDaysNumber <= 5) {
      return 'orange';  // Approaching due date (within 5 days)
    } else if (dueDaysNumber <= 10) {
      return 'green';  // Approaching due date (within 10 days)
    } else {
      return 'black';  // Safe zone (more than 10 days remaining)
    }
  };

  const handleVendorChange = (
    event: React.SyntheticEvent,
    newValue: VendorDetail | null, // `newValue` is a VendorDetail or null
    reason: AutocompleteChangeReason
  ) => {
    setSelectedVendorName(newValue); // Set the selected vendor directly
  };


  const totalPayableAmount = filteredPayments.reduce((total, outgoing) => {
    // Ensure totalPayableAmount is defined before adding
    return total + (outgoing.totalPayableAmount || 0);
  }, 0);

  const totalOverallAmount = selectedOutgoings.reduce(
    (total, outgoing) => total + (outgoing.totalPayableAmount ?? 0),
    0
  );

  return (
    <Box>
      <YenBookPage />
      <Box sx={{ p: 1, backgroundColor: 'white' }}>
        <Box>
          {/* First Row - AP Invoice List, Returned AP buttons, and Typography */}
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1} ml={1}>
            {/* Buttons */}
            <Box display="flex" alignItems="center">
              <Grid item>
                <Link href="/yen-book/OutgoingPaymentPage" passHref>
                  <Button
                    variant="contained"

                    sx={{
                      backgroundColor: 'white', // White background
                      color: 'black', // Black text
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.8)', // Slightly darker on hover
                      },
                      mr: 1,
                    }}
                  >
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
                  <Button variant="contained" color="primary" sx={{ mr: 1 }} >
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
                  <Button variant="contained" color="primary" sx={{mr:1}}>Ledger</Button>
                </Link>
              </Grid>
                <Grid item>
                <Link href="/yen-book/OutgoingPaymentPage/PurchaseReturn" passHref>
                  <Button variant="contained" color="primary">Purchase Return</Button>
                </Link>
              </Grid>
            </Box>
            {/* <Grid item justifyContent={'flex-end'}>
            <Typography
    sx={{
      pl: 2,
      pr: 2,
      boxShadow: 3,
      borderRadius: 1,
      padding: '8px',
      textAlign: 'left',
      maxWidth: '450px',
      fontWeight: 'bold',
      flexGrow: 1,
      ml: 2,
    }}
>
Description:<br />
                This is the Outgoing Payments page, where you can view and process unpaid or partially paid invoices.Payments can only be processed for these invoices from this page.
              </Typography>
            </Grid> */}
          </Box>
          {/* Second Row: Filters, Date Range, Vendor Select, Filter/Download Icons */}
          <Grid container spacing={1} alignItems="center" justifyContent="flex-start" sx={{ mb: 1, mt: 1, ml: 0.1 }}>
            {/* Date Range Dialog */}
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

            {/* All Data Field */}
            <Grid item xs={6} sm={4} md={1}>
              <TextField
                fullWidth
                value="All Data"
                variant="outlined"
                size="small"
                InputProps={{
                  readOnly: true, // Makes the text field non-editable
                }}
              />
            </Grid>

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

            {/* Filter Clear Button */}
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
                  sx={{ p: 0.3 }}
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
        </Box>
        {/* Days Filter */}
        {/* <Grid item sx={{ minWidth: '150px' }}>
            <FormControl fullWidth>
              <Select
                value={selectedDays} // Ensure default value is "All Data"
                onChange={handleDaysFilterChange}
                displayEmpty
              >
                <MenuItem value="">All Data</MenuItem>
                <MenuItem value={30}>30 Days</MenuItem>
                <MenuItem value={60}>60 Days</MenuItem>
                <MenuItem value={90}>90 Days</MenuItem>
              </Select>
            </FormControl>
          </Grid> */}
        <Grid container spacing={2} alignItems="center" justifyContent='end' sx={{ mb: 1 }}>
          <Grid item xs={6} display="flex" alignItems="center" justifyContent="flex-end">
            {/* Display both text and the icon next to each other */}
            <Typography variant="h6" className='fs12' sx={{ fontWeight: 'bold', mr: 1 }}>
              Total Payable Amount: {totalPayableAmount.toFixed(2)}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <IconButton
                color='primary'
                className='icon-button-outline'
                onClick={handlePayClick} // Trigger the pay click
                size="small"
                sx={{ p: 0.3 }}
              >
                <PaymentsIcon />
              </IconButton>
              <Typography
                variant="caption"
                align="center"
                sx={{
                  maxWidth: 50,
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
                Multiple payments
              </Typography>
            </Box>
          </Grid>
        </Grid>
        <Grid container spacing={2}>
          <Grid item xs={12} ml={2}>
            <TableContainer
              component={Paper}
              sx={{
                maxHeight: 'calc(100vh - 270px)', // Dynamic height based on viewport
                overflowY: 'auto',
                width: '100%',
              }}
            >
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>No</TableCell>
                    <TableCell>MultiplePay</TableCell>
                    <TableCell>PO No</TableCell>
                    <TableCell>GRN No</TableCell>
                    <TableCell>Ap No</TableCell>
                    <TableCell>Outgoing No</TableCell>
                    <TableCell>Vendor Name</TableCell>
                    <TableCell>Invoice No</TableCell>
                    <TableCell>Invoice Date</TableCell>
                    <TableCell>Total Amount</TableCell>
                    <TableCell>Tax Details</TableCell>
                    <TableCell>Discount Amount</TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell>Paid Amount</TableCell>
                    <TableCell>Remaining Amount</TableCell>
                    <TableCell sx={{ cursor: 'pointer' }} onClick={() => handleSort('dueDays')}>
                      Due Days {sortColumn === 'dueDays' ? (sortOrder === 'asc' ? '↑' : '↓') : '↑'}
                    </TableCell>
                    <TableCell sx={{ cursor: 'pointer' }} onClick={() => handleSort('paymentTerms')}>
                      Payment Terms {sortColumn === 'paymentTerms' ? (sortOrder === 'asc' ? '↑' : '↓') : '↑'}
                    </TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={16} style={{ textAlign: 'center' }}>
                        No data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.map((payment, index) => {
                      const { isDisabled, tooltipTitle } = outgoingCreditNoteStatus[payment.outgoingId] || {
                        isDisabled: true,
                        tooltipTitle: 'No Debit/Credit Notes Available',
                      };
                      return (
                        <TableRow key={payment.outgoingId || index}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <Checkbox
                              checked={selectedRows.includes(payment.outgoingId || '')}
                              onChange={() => handleRowSelect(payment.outgoingId || '')}
                            />
                          </TableCell>
                          <TableCell>
                            {payment.purchaseOrderId ? (
                              <span
                                style={{ color: 'purple', cursor: 'pointer' }}
                                onClick={() => handlePoClick(payment.purchaseOrderId ?? '')}
                              >
                                {payment.poRandomId || 'N/A'}
                              </span>
                            ) : (
                              'N/A'
                            )}
                          </TableCell>
                          <TableCell>
                            {payment.grnId ? (
                              <span
                                style={{ color: 'blue', cursor: 'pointer' }}
                                onClick={() => handleGrnClick(payment.grnId ?? '')}
                              >
                                {payment.grnRandomId}
                              </span>
                            ) : (
                              'N/A'
                            )}
                          </TableCell>
                          <TableCell>
                            {payment.invoiceId ? (
                              <span
                                style={{ color: 'green', cursor: 'pointer' }}
                                onClick={() => handleApClick(payment.invoiceId)}
                              >
                                {payment.apRandomId}
                              </span>
                            ) : (
                              'N/A'
                            )}
                          </TableCell>
                          <TableCell>{payment.randomId}</TableCell>
                          <TableCell>{payment.vendorName}</TableCell>
                          <TableCell>{payment.invoiceNo || 'N/A'}</TableCell>
                          <TableCell>
                            {payment.invoiceDate ? format(payment.invoiceDate, 'dd-MM-yyyy') : ''}
                          </TableCell>
                          <TableCell>{payment.totalPrice?.toFixed(2)}</TableCell>
                          <TableCell>
                            <Tooltip
                              title={
                                Array.isArray(payment.itemDetails) && payment.itemDetails.length > 0 ? (
                                  <React.Fragment>
                                    {Object.entries(
                                      payment.itemDetails.reduce<
                                        Record<
                                          string,
                                          { sgst: number; cgst: number; igst: number; totalAmount: number; purchasetaxName: number }
                                        >
                                      >((acc, itemDetail) => {
                                        const key = itemDetail.purchasetaxName;
                                        if (!acc[key]) {
                                          acc[key] = {
                                            sgst: itemDetail.sgst,
                                            cgst: itemDetail.cgst,
                                            igst: itemDetail.igst,
                                            totalAmount: itemDetail.taxAmount,
                                            purchasetaxName: itemDetail.purchasetaxName,
                                          };
                                        } else {
                                          acc[key].sgst += itemDetail.sgst;
                                          acc[key].cgst += itemDetail.cgst;
                                          acc[key].igst += itemDetail.igst;
                                          acc[key].totalAmount += itemDetail.taxAmount;
                                        }
                                        return acc;
                                      }, {})
                                    ).map(([key, taxDetail], index) => {
                                      const halfTaxPercentage = taxDetail.purchasetaxName / 2;
                                      return (
                                       <div key={key} style={{ fontSize: '14px' }}>
                                          SGST ({halfTaxPercentage}%): {taxDetail.sgst.toFixed(2)} | CGST ({halfTaxPercentage}%):{' '}
                                          {taxDetail.cgst.toFixed(2)} | IGST ({taxDetail.purchasetaxName}%): {taxDetail.igst.toFixed(2)} - Total:{' '}
                                          {taxDetail.totalAmount.toFixed(2)}
                                        </div>
                                      );
                                    })}
                                  </React.Fragment>
                                ) : (
                               <span style={{ fontSize: '14px' }}>No item details available</span>
                                )
                              }
                              placement="top"
                              arrow
                            >
                              <Typography variant="body2" sx={{ cursor: 'pointer', fontSize: '12px !important' }}>
                                {payment.taxDetails || 'N/A'}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>{payment.discountDetails?.toFixed(2) || '0.00'}</TableCell>
                          <TableCell>{payment.payableAmount?.toFixed(2)}</TableCell>
                          <TableCell>{payment.totalPaid?.toFixed(2)}</TableCell>
                          <TableCell>{payment.totalPayableAmount?.toFixed(2)}</TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 'bold',
                              color: getColorByDueDays(payment.intimationDays?.toString() || '0'),
                            }}
                          >
                            {payment.intimationDays}
                          </TableCell>
                          <TableCell>{payment.paymentTerms}</TableCell>
                          <TableCell>
                            <Box display="flex" alignItems="center">
                              <Tooltip title="Pay">
                                <IconButton
                                  color="primary"
                                  onClick={() => handleViewDetails(payment)}
                                  disabled={selectedRows.length > 1}
                                >
                                  <PaymentIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Download PDF">
                                <IconButton
                                  color="primary"
                                  sx={{ ml: 0.1 }}
                                  onClick={() => handleDownload(payment.outgoingId ?? '')}
                                >
                                  <PictureAsPdfIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={tooltipTitle}>
                                <span>
                                  <IconButton
                                    color="primary"
                                    sx={{ ml: 0.1 }}
                                    onClick={() => handleViewCreditNotes(payment.outgoingId)}
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
<Dialog open={openDetailsDialog} onClose={() => setOpenDetailsDialog(false)}>
  <DialogTitle>Payment Details</DialogTitle>
  <DialogContent>
    <Typography variant="body1" gutterBottom>
      Total Amount: ₹{selectedOutgoing?.totalPayableAmount?.toFixed(2) || 'N/A'}
    </Typography>
    <Typography variant="body2" color="textSecondary">
      Total Debit Amount: ₹{totalDebitAmount.toFixed(2)}
    </Typography>
    <Typography variant="body2" color="textSecondary">
      Remaining Payable: ₹{(selectedOutgoing?.totalPayableAmount - totalDebitAmount).toFixed(2)}
    </Typography>
    <TextField
      select
      name="paymentType"
      label="Payment Type"
      value={paymentDetails.paymentType}
      onChange={handlePaymentTypeChange}
      fullWidth
      margin="normal"
    >
      <MenuItem value="full">Full Payment</MenuItem>
      <MenuItem value="partial">Partial Payment</MenuItem>
      <MenuItem value="advance">Advance Payment</MenuItem>
    </TextField>
    <TextField
      autoComplete="off"
      name="amount"
      label="Amount"
      value={paymentDetails.amount}
      onChange={handleInputChange}
      fullWidth
      margin="normal"
      required
      error={!!error}
      helperText={error}
      disabled={paymentDetails.paymentType === 'full'}
      inputProps={{ type: 'number', step: '0.01' }}
    />
    <TextField
      select
      name="paymentMode"
      label="Payment Mode"
      value={paymentDetails.paymentMode}
      onChange={handlePaymentModeChange}
      fullWidth
      margin="normal"
    >
      <MenuItem value="Cash">Cash</MenuItem>
      <MenuItem value="Bank">Bank</MenuItem>
    </TextField>
    {paymentDetails.paymentMode === 'Cash' && (
      <TextField
        select
        name="paymentMethod"
        label="Payment Method"
        value={paymentDetails.paymentMethod}
        onChange={handleInputChange}
        fullWidth
        margin="normal"
        required
      >
        <MenuItem value="pettyCash">Petty Cash</MenuItem>
        <MenuItem value="hoCash">HO Cash</MenuItem>
      </TextField>
    )}
    {paymentDetails.paymentMode === 'Bank' && (
      <>
        <TextField
          select
          name="bankName"
          label="Bank Name"
          value={paymentDetails.bankName}
          onChange={handleInputChange}
          fullWidth
          margin="normal"
        >
          {banks.map((bank) => (
            <MenuItem key={bank.bankMasterId} value={bank.bankName}>
              {bank.bankName}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          name="paymentMethod"
          label="Payment Method"
          value={paymentDetails.paymentMethod}
          onChange={handlePaymentMethodChange}
          fullWidth
          margin="normal"
        >
          <MenuItem value="neft">NEFT</MenuItem>
          <MenuItem value="rtgs">RTGS</MenuItem>
          <MenuItem value="imps">IMPS</MenuItem>
          <MenuItem value="upi">UPI</MenuItem>
        </TextField>
        {paymentDetails.paymentMethod === 'neft' && (
          <TextField
            autoComplete="off"
            name="neftNo"
            label="NEFT Number"
            value={paymentDetails.neftNo}
            onChange={handleInputChange}
            fullWidth
            margin="normal"
            required
          />
        )}
        {paymentDetails.paymentMethod === 'rtgs' && (
          <TextField
            autoComplete="off"
            name="rtgsNo"
            label="RTGS Number"
            value={paymentDetails.rtgsNo}
            onChange={handleInputChange}
            fullWidth
            margin="normal"
            required
          />
        )}
        {paymentDetails.paymentMethod === 'imps' && (
          <TextField
            autoComplete="off"
            name="impsNo"
            label="IMPS Number"
            value={paymentDetails.impsNo}
            onChange={handleInputChange}
            fullWidth
            margin="normal"
            required
          />
        )}
        {paymentDetails.paymentMethod === 'upi' && (
          <TextField
            autoComplete="off"
            name="upi"
            label="UPI ID"
            value={paymentDetails.upi}
            onChange={handleInputChange}
            fullWidth
            margin="normal"
            required
          />
        )}
      </>
    )}
    {activeDebits.length > 0 && (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle1">Apply Debit Notes</Typography>
        <List dense>
          {activeDebits.map((debit) => (
            <ListItem key={debit.randomId}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={paymentDetails.selectedDebitNotes.includes(debit.randomId)}
                    onChange={() => handleDebitNoteChange(debit.randomId)}
                  />
                }
                label={`Note No: ${debit.randomId} - Rs ${(debit.finalAmount || 0).toFixed(2)}`}
              />
            </ListItem>
          ))}
        </List>
      </Box>
    )}
  </DialogContent>
  <DialogActions>
    <Button onClick={handleClosePayDialog} color="primary">
      Cancel
    </Button>
    <Button
      onClick={handleConfirmPayment}
      color="primary"
      disabled={isSinglePaymentLoading || !!error}
    >
      {isSinglePaymentLoading ? <CircularProgress size={24} /> : 'Confirm Payment'}
    </Button>
  </DialogActions>
</Dialog>
          <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} PaperProps={{
            sx: {
              width: '700px', // Set the width of the Dialog to 700px
              maxWidth: '700px', // Optional: prevent the dialog from exceeding 700px on larger screens
            },
          }}>
            <DialogTitle>
              Confirm Payment for Selected Vendors
              {selectedOutgoings.length > 0 && (
                <Typography variant="h6" style={{ marginTop: 16 }}>
                  <strong>Overall Total Payable Amount: </strong>
                  {totalOverallAmount.toFixed(2)} {/* Display total with two decimal places */}
                </Typography>
              )}
            </DialogTitle>
            <DialogContent>
              {selectedOutgoings.length === 0 ? (
                <Typography>No Vendors selected</Typography>
              ) : (
                <>
                  {Object.entries(groupedOutgoingsByVendor(selectedOutgoings)).map(([vendorName, outgoings]) => {
                    const totalAmountForVendor = outgoings.reduce(
                      (total, outgoing) => total + (outgoing.totalPayableAmount ?? 0),
                      0
                    ).toFixed(2);

                    return (

                      <Box key={vendorName}>
                        <Typography style={{ marginBottom: 16 }}>
                          <strong>{vendorName}</strong>
                        </Typography>
                        <TableContainer component={Paper} style={{ marginBottom: 16 }}>
                          <Table>
                            <TableHead>
                              <TableRow>
                                <TableCell>Invoice No</TableCell>
                                <TableCell>Invoice Date</TableCell>
                                <TableCell>GRN No</TableCell>
                                <TableCell>Total Payable Amount</TableCell>
                                <TableCell>Payment Type</TableCell>
                                <TableCell>Partial Amount</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {outgoings.map((outgoing) => (
                                <TableRow key={outgoing.outgoingId}>
                                  <TableCell>{outgoing.invoiceNo}</TableCell>
                                  <TableCell>{outgoing.invoiceDate ? format(outgoing.invoiceDate, 'dd-MM-yyyy') : ''}</TableCell>
                                  <TableCell>{getRandomId(outgoing.grnId || '')} {/* Display the random ID */}
                                  </TableCell>
                                  <TableCell>{outgoing.totalPayableAmount?.toFixed(2)}</TableCell>
                                  <TableCell>
                                    <Select
                                      value={paymentTypeMultiple[outgoing.outgoingId as string] || 'full'}
                                      onChange={(e) => handlePaymentTypeChangeMultiple(outgoing.outgoingId as string, e.target.value as 'full' | 'partial')}
                                      fullWidth
                                    >
                                      <MenuItem value="full">Full</MenuItem>
                                      <MenuItem value="partial">Partial</MenuItem>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    {paymentTypeMultiple[outgoing.outgoingId as string] === 'partial' && (
                                      <TextField
                                        autoComplete="off"
                                        value={partialAmount[outgoing.outgoingId as string] || ''}
                                        onChange={(e) =>
                                          handlePartialAmountChangeMultiple(
                                            outgoing.outgoingId as string,
                                            e.target.value,
                                            outgoing.totalPayableAmount || 0
                                          )
                                        }
                                        label="Amount"
                                        fullWidth
                                        type="number"
                                        error={!!errors[outgoing.outgoingId as string]}
                                        helperText={errors[outgoing.outgoingId as string]}
                                        inputProps={{ min: 0, step: '0.01' }} // Prevent negative numbers and allow decimals
                                      />
                                    )}
                                  </TableCell>

                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                        <Box style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                          <Typography variant="body1" style={{ fontWeight: 'bold' }}>
                            Total Amount for {vendorName}: {totalAmountForVendor}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDialogOpen(false)} variant="contained" color="primary" >
                Cancel
              </Button>
              <Button
                onClick={handleProcessPayment}
                variant="contained"
                color="primary"
                disabled={selectedRows.length === 0 || isMultiplePaymentLoading}
              >
                {isMultiplePaymentLoading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  "Process Payment"
                )}
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog open={paymentDialogOpen} onClose={() => setOpenDetailsDialog(false)}>
            <DialogTitle>Payment Details</DialogTitle>
            <DialogContent>
              <Typography variant="body1" gutterBottom>
                Total Amount: {selectedOutgoing?.totalPayableAmount?.toFixed(2) || 'N/A'}
              </Typography>

              {/* Payment Mode Selector (Cash or Bank) */}
              <TextField
                select
                name="paymentMode"
                label="Payment Mode"
                value={paymentDetails.paymentMode}
                onChange={handlePaymentModeChange}
                fullWidth
                margin="normal"
              >
                <MenuItem value="Cash">Cash</MenuItem>
                <MenuItem value="Bank">Bank</MenuItem>
              </TextField>

              {/* Payment Method Selector (Petty Cash, HO Cash, etc.) */}
              {paymentDetails.paymentMode === 'Cash' && (
                <TextField
                  select
                  name="paymentMethod"
                  label="Payment Method"
                  value={paymentDetails.paymentMethod}
                  onChange={handleInputChange}
                  fullWidth
                  margin="normal"
                  required
                >
                  <MenuItem value="pettyCash">Petty Cash</MenuItem>
                  <MenuItem value="hoCash">HO Cash</MenuItem>
                </TextField>
              )}


              {/* Bank Payment Mode */}
              {paymentDetails.paymentMode === 'Bank' && (
                <>
                  {/* Bank Name Selector */}
                  <TextField
                    select
                    name="bankName"
                    label="Bank Name"
                    value={paymentDetails.bankName}
                    onChange={handleInputChange}
                    fullWidth
                    margin="normal"
                  >
                    {banks.map((bank) => (
                      <MenuItem key={bank.bankMasterId} value={bank.bankName}>
                        {bank.bankName}
                      </MenuItem>
                    ))}
                  </TextField>

                  {/* Payment Method (e.g., NEFT, RTGS, IMPS, UPI) */}
                  <TextField
                    select
                    name="paymentMethod"
                    label="Payment Method"
                    value={paymentDetails.paymentMethod}
                    onChange={handlePaymentMethodChange}
                    fullWidth
                    margin="normal"
                  >
                    <MenuItem value="neft">NEFT</MenuItem>
                    <MenuItem value="rtgs">RTGS</MenuItem>
                    <MenuItem value="imps">IMPS</MenuItem>
                    <MenuItem value="upi">UPI</MenuItem>
                  </TextField>

                  {/* Conditional Fields for Bank Payment Methods */}
                  {paymentDetails.paymentMethod === 'neft' && (
                    <TextField
                      autoComplete="off"
                      name="neftNo"
                      label="NEFT Number"
                      value={paymentDetails.neftNo}
                      onChange={handleInputChange}
                      fullWidth
                      margin="normal"
                      required
                    />
                  )}
                  {paymentDetails.paymentMethod === 'rtgs' && (
                    <TextField
                      autoComplete="off"
                      name="rtgsNo"
                      label="RTGS Number"
                      value={paymentDetails.rtgsNo}
                      onChange={handleInputChange}
                      fullWidth
                      margin="normal"
                      required
                    />
                  )}
                  {paymentDetails.paymentMethod === 'imps' && (
                    <TextField
                      autoComplete="off"
                      name="impsNo"
                      label="IMPS Number"
                      value={paymentDetails.impsNo}
                      onChange={handleInputChange}
                      fullWidth
                      margin="normal"
                      required
                    />
                  )}
                  {paymentDetails.paymentMethod === 'upi' && (
                    <TextField
                      autoComplete="off"
                      name="upi"
                      label="UPI ID"
                      value={paymentDetails.upi}
                      onChange={handleInputChange}
                      fullWidth
                      margin="normal"
                      required
                    />
                  )}
                </>
              )}
            </DialogContent>

            <DialogActions>
              <Button onClick={handleCloseMultipleDialog} color="primary">
                Cancel
              </Button>
              <Button
                onClick={handleConfirmMultiplePayment}
                color="primary"
                disabled={isMultiplePaymentLoading}
              >
                {isMultiplePaymentLoading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Confirm'
                )}
              </Button>
            </DialogActions>
          </Dialog>
          {/* Snackbar for feedback
      <Snackbar
        open={openSnackbar}
        autoHideDuration={6000}
        onClose={() => setOpenSnackbar(false)}
        message={snackbarMessage}
      /> */}
          <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)} >
            <DialogTitle>Confirm Payment</DialogTitle>
            <DialogContent>
              <Typography variant="body1">Are you sure you want to process the payment for this outgoing?</Typography>
              <Typography variant="body2" style={{ marginTop: 10 }}>
                Vendor: {selectedOutgoing?.vendorName} <br />
                Invoice No: {selectedOutgoing?.invoiceNo} <br />
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConfirmDialogOpen(false)} variant="contained" color="primary">Cancel</Button>
              <Button onClick={async () => {
                try {
                  setIsSinglePaymentLoading(true);
                  await dispatch(processPayment(paymentDetailsToSend)).unwrap();
                  resetPaymentDetails();
                  handleClosePayDialog();
                  dispatch(fetchOutgoings({
                    page: newPage,
                    size: pageSize,
                    filterBy: dateField,
                    filterByAmount: true,
                  }));
                  setConfirmDialogOpen(false); // Close the confirmation dialog
                  setIsSinglePaymentLoading(false);
                } catch (error) {
                  console.error('Failed to process payment:', error);
                  alert('Failed to process payment. Please try again.');
                  setConfirmDialogOpen(false); // Close the confirmation dialog if error occurs
                  setIsSinglePaymentLoading(false);
                }
              }} variant="contained" color="primary">Confirm</Button>
            </DialogActions>
          </Dialog>
          <Dialog open={confirmMultipleDialogOpen} onClose={() => setConfirmMultipleDialogOpen(false)}>
            <DialogTitle>Confirm Multiple Payments</DialogTitle>
            <DialogContent>
              {isLoading ? (
                <Box display="flex" justifyContent="center" alignItems="center" height="200px">
                  <CircularProgress size={50} color="inherit" />
                </Box>
              ) : (
                <Typography variant="body1">
                  <Tooltip
                    title={
                      <Box>
                        {selectedOutgoings.map((outgoing, index) => (
                          <Typography key={index} variant="body2">
                            {outgoing.vendorName}
                          </Typography>
                        ))}
                      </Box>
                    }
                    arrow
                    placement="top"
                  >
                    <span tabIndex={0} style={{ cursor: 'pointer' }}>
                      Are you sure you want to process payments for {selectedOutgoings.length} vendors?
                    </span>
                  </Tooltip>
                </Typography>
              )}
            </DialogContent>
            <DialogActions>
              {!isLoading && (
                <>
                  <Button onClick={() => setConfirmMultipleDialogOpen(false)} variant="contained" color="primary">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirmMultiplePayment}
                    variant="contained"
                    color="primary"
                    disabled={isLoading || !paymentDetails.paymentMode}
                  >
                    {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Confirm Payment'}
                  </Button>
                </>
              )}
            </DialogActions>
          </Dialog>
          <DebitCreditNoteDialog />
          <PODialog
            open={poDialogOpen}
            onClose={() => {
              console.log('Dispatching setPoDialogOpen(false)'); // Debug: Log dispatch
              dispatch(setPoDialogOpen(false));
            }}
            po={selectedPo}
          />
          <GrnDialog
            open={viewItemsDialogOpen}
            onClose={() => setViewItemsDialogOpen(false)}
            grn={selectedGrn}
          />
          <ApInvoiceDialog
            open={apDialogOpen}
            onClose={handleCloseApDialog}
            apInvoice={selectedApInvoice}
          />
          {/* Dialog for choosing PDF or CSV */}
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
                onClick={generateOutgoingSummaryCSV}
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
          <ConfirmationDialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        onConfirm={confirmDialogProps.onConfirm}
        title={confirmDialogProps.title}
        description={confirmDialogProps.description}
      />
        </Grid>
      </Box>
    </Box>
  );

});

OutgoingPaymentComponent.displayName = 'OutgoingPaymentComponent';

export default OutgoingPaymentComponent; 
