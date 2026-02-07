"use client";
import React, { ChangeEvent, useEffect, MouseEvent, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Link from 'next/link';
import {
  Box, TextField, Button, Grid, Paper,
  TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Typography, Checkbox, Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, CircularProgress,
  IconButton,
  Popover,
  FormControlLabel,
  DialogContentText,
  Tooltip,
  Menu,
  MenuItem,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description'; // CSV icon
import EditIcon from '@mui/icons-material/Edit'; // CSV icon
import FilterAltIcon from '@mui/icons-material/FilterAlt'; // Import the filter icon
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import ClearIcon from "@mui/icons-material/Clear"; // Clear icon
import { RootState, AppDispatch } from '../../../redux/store';
import {
  updateItemDetails, fetchGrns, setSelectedGrnId, fetchRandomNumbers, selectGrn,
  clearSnackbarMessage, setSnackbarMessageGRN, setSnackbarOpenGRN,
  updateInvoiceDetails, selectCurrentPage, selectPageSize, selectTotalItems, setPagination,
  setLoading,
  setSelectedHeaders,
  ItemUpdate,
  revertGrnToPO,
} from '../../../features/yen-purchase/GRN/grnSlice';
import { ArrowDownward, ArrowUpward, ChevronLeft, ChevronRight, FilterList as FilterListIcon } from '@mui/icons-material';
import '../../../components/common.css';
import { FetchGrnsPayload, GrnData, ItemDetail } from '@/Models/grnModel';
import { addDays, format, parse, startOfDay } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable'; // This is needed to use autoTable with jsPDF
import { fetchBusinesses, fetchPhoto, selectBusinesses } from '@/features/account-setting/businessSlice';
import YenPurchasePage from '../page';
import Papa from 'papaparse';
import 'react-date-range/dist/styles.css'; // main style file
import 'react-date-range/dist/theme/default.css'; // theme css file
import DateRangeDialog from '@/components/dateRange';
import { fetchAllVendors } from '@/features/yen-purchase/PurchaseOrder/purchaseOrderSlice';
import moment from 'moment';
import VendorSearchAutocomplete from '@/components/vendorsearchautocomplete';
import GrnReturnDialog from '../../../components/yen-purchase/grncomponent/grnReturnDialog';
import { VendorSearch } from '@/Models/vendor';
import { fetchDebitCreditNotesByDocument, selectDebitCreditNote, setDebitCreditDialogOpen, setDebitCreditDocumentId, setDebitCreditDocumentType } from '@/features/yen-purchase/DebitNoteSlice';
import DebitCreditNoteDialog from '@/components/yen-purchase/DebitNoteDialog';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import SmartDatePicker from '@/components/SmartDatePicker';
import ConfirmationDialog from '@/components/confirmationDialog';
const customRound = (amount: number) => {
  const roundedAmount = Math.round(amount);
  if (roundedAmount - amount < 0.03) {
    return Math.floor(amount);
  } else if (roundedAmount - amount > 0.05) {
    return Math.ceil(amount);
  }
  return roundedAmount;
};
const allHeaders = [
  'itemName', 'nos', 'eachQuantity', 'receivedQuantity',
  'returnedQuantity', 'totalQuantity', 'uom', 'unitPrice', 'purchasetaxName', 'befTaxDiscount', 'afTaxDiscount',
  'expiryDate', 'totalPrice', 'finalPrice'
];
// Define preferred header order for table rendering
const preferredHeaderOrder = [
  'itemName', 'nos', 'eachQuantity', 'receivedQuantity',
  'returnedQuantity', 'totalQuantity', 'uom', 'unitPrice', 'purchasetaxName', 'befTaxDiscount', 'afTaxDiscount',
  'expiryDate', 'totalPrice', 'finalPrice'
];
// Map header keys to user-friendly display names
const headerDisplayNames: { [key: string]: string } = {
  itemName: 'Item Name',
  uom: 'UOM',
  befTaxDiscount: 'Before Tax Discount (%)',
  afTaxDiscount: 'After Tax Discount (%)',
  purchasetaxName: 'Tax (%)',
  nos: 'Pkt Count',
  eachQuantity: 'Each Quantity',
  receivedQuantity: 'Received Quantity',
  returnedQuantity: 'Returned Quantity',
  totalQuantity: 'Total Quantity',
  unitPrice: 'Unit Price',
  expiryDate: 'Expiry Date',
  totalPrice: 'Total Price',
  finalPrice: 'Final Price',
};
const GrnPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { purchaseorders, loading, error, snackbarMessageGRN, snackbarOpenGRN, selectedHeaders } = useSelector(selectGrn);
  const { businesses } = useSelector(selectBusinesses);
  const [dialogueviewOpen, setDialogueViewOpen] = React.useState(false);
  const grns = useSelector((state: RootState) => state.grn.grns);
  const selectedGrnId = useSelector((state: RootState) => state.grn.selectedGrnId);
  const [editedItems, setEditedItems] = useState<{
    [key: string]: {
      nos: number; igst: number; eachQuantity: number; hsnCode: string; quantity: number; receivedQuantity: number, returnedQuantity: number, taxType: 'cgst_sgst' | 'igst'; damagedQuantity: number, expiryDate: Date | string | null; unitPrice: number, discount: number, totalPrice: number, purchasetaxName: number, sgst: number, cgst: number, discountAmount: number; taxAmount: number; finalPrice: number, befTaxDiscount: number; afTaxDiscount: number; befTaxDiscountAmount: number; afTaxDiscountAmount: number; purchasecategoryName: string; purchasesubcategoryName: any; returnReason?: string; // Add return reason
    }
  }>({});
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogSaveOpen, setDialogSaveOpen] = useState(false);
  const [apInvoiceDate, setApInvoiceDate] = useState<Date | null>(new Date());
  const [outgoingDate, setOutgoingDate] = useState<Date | null>(new Date());
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [discountPrice, setDiscountPrice] = useState<number>(0);
  const [enteredDiscount, setEnteredDiscount] = useState<number>(0); // Current user input
  const [totalReceivedAmount, setTotalReceivedAmount] = useState<number>(0);
  const [totalDiscount, setTotalDiscount] = useState<number>(0);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [anchorElDownload, setAnchorElDownload] = useState<null | HTMLElement>(null); // Allow anchorEl to be null or an HTMLElement
  const openHeaderSelect = Boolean(anchorEl);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [fetchedBusinessIds, setFetchedBusinessIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendorName, setSelectedVendorName] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<VendorSearch | null>(null);
  const [filteredGrn, setFilteredGrn] = useState<GrnData[]>([]); // Explicit type declaration
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState<Date | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [dialogDownloadOpen, setDialogDownloadOpen] = useState(false);
  const [dialogSummaryOpen, setDialogSummaryOpen] = useState(false);
  const currentPage = useSelector(selectCurrentPage);
  const pageSize = useSelector(selectPageSize);
  const totalItems = useSelector(selectTotalItems);
  const newPage = useSelector(selectCurrentPage);
  const [selectionRange, setSelectionRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    key: 'selection',
  });
  const fromDate = moment().utc().startOf('day').toDate(); // Start of the day (in UTC)
  const toDate = moment().utc().endOf('day').toDate(); // End of the day (in UTC)
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedGrnItems, setSelectedGrnItems] = useState<ItemDetail[]>([]);
  const [shouldFetch, setShouldFetch] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const handlePopoverOpen = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handlePopoverClose = () => setAnchorEl(null);
  const debitCreditNotes = useSelector((state: RootState) => selectDebitCreditNote(state).debitCreditNotes);
  // AP ROUND OFF STATE (REPLACED discountPrice)
  const [apRoundOff, setApRoundOff] = useState<number>(0);
  const [enteredApRoundOff, setEnteredApRoundOff] = useState<string | number>(0);
  const [apRoundOffError, setApRoundOffError] = useState<string>('');
  const [apRoundOffInput, setApRoundOffInput] = useState<string>(""); // Raw input string
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false); // New: State for dialog
  // Sort selectedHeaders based on preferredHeaderOrder
  const sortedSelectedHeaders = useMemo(() => {
    // Create a copy of selectedHeaders to avoid mutating the original array
    return [...selectedHeaders].sort((a, b) => {
      const indexA = preferredHeaderOrder.indexOf(a);
      const indexB = preferredHeaderOrder.indexOf(b);
      return indexA - indexB;
    });
  }, [selectedHeaders]);
  const sortedGrns = useMemo(() => {
    return Array.isArray(grns) ? [...grns].sort((a, b) => {
      if (sortOrder === 'asc') {
        return a.agingDay - b.agingDay;
      } else {
        return b.agingDay - a.agingDay;
      }
    }) : [];
  }, [grns, sortOrder]);
const grnsPermission = useSelector(
    (state: RootState) => state.auth.permissions?.yenerp?.grns,
  );

  const grnsReturnPermission = useSelector(
    (state: RootState) => state.auth.permissions?.yenerp?.grns_return,
  );

  const canRead = grnsPermission?.read ?? false;
  const canEdit = grnsPermission?.edit ?? false;

  const canReturnRead = grnsReturnPermission?.read ?? false;
  const canReturnEdit = grnsReturnPermission?.edit ?? false;
  const isHidden = grnsPermission?.hide ?? false;


  const grnIds = useMemo(() => sortedGrns.map((grn) => grn.grnId), [sortedGrns]);
  const [isConvertedToAP, setIsConvertedToAP] = useState(false);
  const isValidJSON = (data: string): boolean => {
    try {
      JSON.parse(data);
      return true;
    } catch {
      return false;
    }
  };
  useEffect(() => {
    const loadBusinesses = async () => {
      try {
        const storedBusinesses = localStorage.getItem("businesses");
        if (storedBusinesses && isValidJSON(storedBusinesses)) {
          const parsedBusinesses = JSON.parse(storedBusinesses);
          console.log("Loaded businesses from localStorage:", parsedBusinesses);
        } else {
          await dispatch(fetchBusinesses()).unwrap(); // Wait for the dispatch to complete
        }
      } catch (error) {
        console.error("Error loading businesses:", error);
      }
    };
    loadBusinesses();
  }, [dispatch]);
  useEffect(() => {
    dispatch(fetchAllVendors());
    dispatch(fetchRandomNumbers());
  }, [dispatch]);
  // Optional: Clear localStorage when app is closed (handled by the browser on unload)
  useEffect(() => {
    const handleBeforeUnload = () => {
      localStorage.removeItem("businesses"); // Clear stored data when app is closed/reloaded
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);
   useEffect(() => {
    if (!canRead) return; // 🔥 IMPORTANT LINE (STEP 3)

    if (shouldFetch && !loading) {
      dispatch(
        fetchGrns({
          page: newPage,
          size: pageSize,
        }),
      );
      setShouldFetch(false);
    }
  }, [
    canRead, // 🔥 add
    dispatch,
    newPage,
    pageSize,
    loading,
    shouldFetch,
  ]);
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > Math.ceil(totalItems / pageSize)) {
      // Optionally handle out-of-bounds page number
      return;
    }
    const appliedFromDate = selectionRange?.startDate instanceof Date ? moment(selectionRange.startDate).startOf('day').toDate() : fromDate;
    const appliedToDate = selectionRange?.endDate instanceof Date ? moment(selectionRange.endDate).endOf('day').toDate() : toDate; +-
      dispatch(setPagination({ page: newPage, size: pageSize }));
    dispatch(fetchGrns({ page: newPage, size: pageSize, status, vendorName: selectedVendorName || '' }));
  };
const handleApRoundOffInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
  // Update the input string
  setApRoundOffInput(value);
  // If empty, clear errors and reset value
  if (value === '') {
    setApRoundOff(0);
    setApRoundOffError('');
    return;
  }
  // Allow single minus, decimal, or minus with decimal
  if (value === '-' || value === '.' || value === '-.') {
    setApRoundOff(0);
    setApRoundOffError('');
    return;
  }
  // Remove spaces from input for validation
  const cleanValue = value.replace(/\s/g, '');
  // Allow decimal numbers with up to 2 decimal places
  const decimalRegex = /^-?\d*\.?\d{0,2}$/;
  // Check for proper format
  if (decimalRegex.test(cleanValue)) {
    const parsedValue = parseFloat(cleanValue);
    // Check if it's a valid number
    if (isNaN(parsedValue)) {
      setApRoundOffError("Please enter a valid number");
      setApRoundOff(0);
      return;
    }
    // STRICT LIMITS: Only allow between -2 and +2
    if (parsedValue > 2) {
      setApRoundOffError("Maximum allowed is +2.00");
      setApRoundOff(2);
      setApRoundOffInput('2.00');
    } else if (parsedValue < -2) {
      setApRoundOffError("Minimum allowed is -2.00");
      setApRoundOff(-2);
      setApRoundOffInput('-2.00');
    } else {
      setApRoundOffError("");
      setApRoundOff(parsedValue);
    }
    // Keep the input as typed (no auto-appending)
    setApRoundOffInput(value);
  } else {
    setApRoundOffError("Enter numbers only between -2.00 and +2.00");
    setApRoundOff(0);
  }
}; // FIXED: handleApRoundOffBlur - properly handle and format on blur
const handleApRoundOffBlur = () => {
  // If input is empty or just special characters, set to 0
  if (apRoundOffInput === '' || apRoundOffInput === '-' || apRoundOffInput === '.' || apRoundOffInput === '-.') {
    setApRoundOffInput('0');
    setApRoundOff(0);
    setApRoundOffError('');
    return;
  }
  const parsedValue = parseFloat(apRoundOffInput);
  // If not a valid number, reset
  if (isNaN(parsedValue)) {
    setApRoundOffInput('0');
    setApRoundOff(0);
    setApRoundOffError('Invalid number');
    return;
  }
  // Validate within range
  let currentValue = parsedValue;
  if (currentValue > 2) {
    currentValue = 2;
    setApRoundOffError("Capped at +2.00");
  } else if (currentValue < -2) {
    currentValue = -2;
    setApRoundOffError("Capped at -2.00");
  } else {
    setApRoundOffError("");
  }
  // Calculate the total with freight (if freight is applied in GRN)
  const totalReceivedAmount = selectedGrn?.grnAmount || 0;
  const totalFreight = selectedGrn?.totalFreightAmount || 0;
  const totalFreightTax = selectedGrn?.totalFreightTaxAmount || 0;
  // Total before AP round off (GRN amount + freight + freight tax)
  const totalBeforeRoundOff = totalReceivedAmount + totalFreight + totalFreightTax;
  // Calculate final total with AP round off
  const finalTotal = totalBeforeRoundOff + currentValue;
  // Check if final total would be negative
  if (finalTotal < 0) {
    setApRoundOffError(`Cannot make total negative. Maximum allowed: -${Math.min(totalBeforeRoundOff, 2).toFixed(2)}`);
    const maxNegativeAllowed = -Math.min(totalBeforeRoundOff, 2);
    setApRoundOffInput(maxNegativeAllowed.toString());
    setApRoundOff(maxNegativeAllowed);
    return;
  }
  // Keep the input as typed (no formatting to 2 decimals)
  setApRoundOffInput(apRoundOffInput);
  setApRoundOff(currentValue);
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
  // Precompute isDisabled and tooltipTitle based on hasDebitCreditNotes
  const grnCreditNoteStatus = useMemo(() => {
    const statusMap: { [key: string]: { isDisabled: boolean; tooltipTitle: string } } = {};
    grns.forEach((grn) => {
      const hasDebitCreditNotes = grn.hasDebitCreditNotes ?? debitCreditNotes.some((note) => note.documentId === grn.grnId);
      statusMap[grn.grnId] = {
        isDisabled: !hasDebitCreditNotes,
        tooltipTitle: hasDebitCreditNotes ? 'View Debit/Credit Notes' : 'No Debit/Credit Notes Available',
      };
    });
    return statusMap;
  }, [grns, debitCreditNotes]);
  const handleViewCreditNotes = (grnId: string) => {
    console.log('Opening DebitCreditNoteDialog for grnId:', grnId);
    dispatch(setDebitCreditDocumentId(grnId)); // Set documentId
    dispatch(setDebitCreditDocumentType('GRN')); // Set documentType
    dispatch(setDebitCreditDialogOpen(true)); // Open dialog
    dispatch(fetchDebitCreditNotesByDocument({ documentId: grnId, page: 1, size: 50 }));
  };
  const toggleSortOrder = () => {
    setSortOrder(prevOrder => (prevOrder === 'asc' ? 'desc' : 'asc'));
  };
  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };
  const selectedGrn = Array.isArray(grns) ? grns.find(grn => grn.grnId === selectedGrnId) : null;
  useEffect(() => {
    // Assuming 'poData' is your purchase order data object
    if (selectedGrn) {
      setDiscountPrice(selectedGrn.discountPrice || 0);
      setTotalDiscount(selectedGrn.totalDiscount || 0);
      setTotalReceivedAmount(selectedGrn.grnAmount);
      // Set default dates to current date if not set
      if (!apInvoiceDate) {
        setApInvoiceDate(new Date());
      }
      if (!outgoingDate) {
        setOutgoingDate(new Date());
      }
    }
  }, [selectedGrn]);
  // Function to handle opening the invoice edit dialog
  const handleEditInvoice = (grnId: string) => {
    console.log(`GRN ID Clicked for Editing Invoice: ${grnId}`);
    const selectedGrn = grns.find(grn => grn.grnId === grnId); // Assume grns is available in scope
    if (selectedGrn) {
      // Set invoice details from selected GRN
      setInvoiceNo(selectedGrn.invoiceNo || ''); // Set Invoice No
      setInvoiceDate(selectedGrn.invoiceDate ? new Date(selectedGrn.invoiceDate) : null); // Ensure proper Date object handling
      setSelectedGrnId(grnId); // Store selected GRN ID
      setInvoiceOpen(true); // Open the dialog
      dispatch(setSelectedGrnId(grnId)); // Optionally dispatch to the store if needed
    } else {
      console.error(`GRN with ID ${grnId} not found`);
    }
  };
  const handleReturnClick = (grnId: string) => {
    const grn = grns.find((g) => g.grnId === grnId);
    if (grn && grn.itemDetails) {
      setSelectedGrnItems(grn.itemDetails); // Set items for the dialog
      setReturnDialogOpen(true); // Open the dialog
      dispatch(setSelectedGrnId(grnId)); // Set the selected GRN ID
    }
  };
  const handleReturnComplete = () => {
    setReturnDialogOpen(false); // Close dialog
    setSelectedGrnItems([]); // Clear selected items
    dispatch(setSelectedGrnId(null)); // Clear selected GRN ID
    dispatch(fetchGrns({ page: currentPage, size: pageSize })); // Refresh GRN list
  };
  const handleReturnCancel = () => {
    setReturnDialogOpen(false); // Close dialog without clearing selectedGrnId
  };
  const calculateAPAmounts = () => {
    const grnTotal = selectedGrn?.grnAmount || 0;
    const apTotal = grnTotal + apRoundOff; // This should now work with actual amounts
    return {
      grnTotal: customRound(grnTotal),
      apTotal: customRound(apTotal),
      roundOff: apRoundOff
    };
  };
  const apAmounts = calculateAPAmounts();
  const handleSaveInvoice = () => {
    if (!invoiceNo || !invoiceDate || !selectedGrnId) {
      console.error('Invoice No, Invoice Date, or GRN ID is missing');
      return; // Prevent saving if required fields are empty
    }
    const grnId = selectedGrnId;
    if (grnId === null) {
      console.error('GRN ID cannot be null');
      return;
    }
    // Prepare the payload for the API request
    const updatedInvoiceDetails = {
      grnId: grnId, // Ensure grnId is always a string
      invoiceNo,
      invoiceDate: invoiceDate.toISOString(), // Ensure invoiceDate is a string
    };
    // Dispatch the thunk to update the invoice details
    dispatch(updateInvoiceDetails(updatedInvoiceDetails))
      .unwrap() // unwrap the result to directly get the response data or error
      .then(() => {
        console.log('Invoice updated successfully');
        // Fetch the most recent GRNs after successful update
        dispatch(fetchGrns({ page: newPage, size: pageSize, status }))
          .then(() => {
            console.log('Recent GRNs fetched successfully');
            setInvoiceOpen(false); // Close the dialog after saving
          })
          .catch((fetchError) => {
            console.error('Error fetching recent GRNs:', fetchError);
          });
      })
      .catch((error) => {
        console.error('Error updating invoice:', error);
      });
  };
  const handleEnteredDiscountChange = (newDiscount: number) => {
    setEnteredDiscount(newDiscount);
    const newTotalDiscount = (selectedGrn?.discountPrice || 0) + newDiscount;
    setDiscountPrice(newTotalDiscount);
    const newTotalDiscountAmount = (selectedGrn?.totalDiscount || 0) + newDiscount;
    setTotalDiscount(newTotalDiscountAmount);
    // Calculate the adjusted total received amount
    const updatedTotalReceivedAmount = (selectedGrn?.grnAmount || 0) - newTotalDiscount;
    setTotalReceivedAmount(updatedTotalReceivedAmount);
  };
  const handleHeaderSelectChange = (header: string) => {
    // Toggle header selection and dispatch to Redux
    const newSelectedHeaders = selectedHeaders.includes(header)
      ? selectedHeaders.filter((h) => h !== header)
      : [...selectedHeaders, header];
    dispatch(setSelectedHeaders(newSelectedHeaders));
  };
  useEffect(() => {
    businesses.forEach((business) => {
      if (!fetchedBusinessIds.has(business.businessId)) {
        dispatch(fetchPhoto(business.businessId));
        dispatch(fetchBusinesses());
        setFetchedBusinessIds(prevSet => new Set(prevSet).add(business.businessId));
      }
    });
  }, [businesses, fetchedBusinessIds, dispatch]);
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
  const handleVendorChange = (vendor: VendorSearch | null) => {
    setSelectedVendor(vendor);
    setSelectedVendorName(vendor ? vendor.vendorName : '');
  };
  const handleDownload = async (grnId: string) => {
    const grncheck = grns.find((grn) => grn.grnId === grnId);
    if (!grncheck) {
      console.error('GRN not found!');
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
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 128);
    doc.text('Goods Receipt Note', 90, yOffset + 5);
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
    // Calculate Due Date
    const invoiceDate = grncheck.invoiceDate ? new Date(grncheck.invoiceDate) : new Date('2025-06-30'); // Fallback to 30/06/2025
    const paymentTermsDays = grncheck.paymentTerms ? parseInt(grncheck.paymentTerms, 10) : 15; // Fallback to 15 days
    const dueDate = addDays(invoiceDate, paymentTermsDays); // Add payment terms days to created date
    // Table header with the three sections
    const tableHeader = [['Vendor Details', 'Shipping Address', 'GRN Details']];
    // Vendor Details rows with correct line breaks
    const vendorDetailsRows = [
      [
        `${grncheck.vendorName || ' '}\n` +
        `GSTIN: ${grncheck.gstNumber || ''}\n` +
        `Address: ${grncheck.address || ''}\n` +
        `City: ${grncheck.city || ''}\n` +
        `State: ${grncheck.state || ''}\n` +
        `Country: ${grncheck.country || ''}\n` +
        `Email: ${grncheck.contactpersonEmail || ''}`,
        `Shipping Address: ${grncheck.shippingAddress || ''}`,
        `PO No: ${grncheck.poRandomID || ''}\n` +
        `GRN No: ${grncheck.randomId || ''}\n` +
        `GRN Date: ${grncheck.createdDate ? format(new Date(grncheck.createdDate), 'dd-MM-yyyy') : 'Not Provided'}\n` +
        `Payment Terms: ${grncheck.paymentTerms || ''}\n` +
        `Due Date: ${dueDate ? format(new Date(dueDate), 'dd-MM-yyyy') : 'Not Provided'}\n` +
        `Currency: INR`,
      ],
    ];
    // Vendor Details Table
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
        0: { cellWidth: 60.6, valign: 'top' },
        1: { cellWidth: 60.6, valign: 'top' },
        2: { cellWidth: 60.6, valign: 'top' },
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
      tableLineColor: [0, 0, 0],
      tableLineWidth: 0.1,
    });
    yOffset += 45;
    // Items Table Section
    const itemHeader = ['SI No', 'Description', 'HsnCode', 'Pkt Count', 'Qty', 'Po Qty', 'Unit Price', 'Received Qty', 'Tax', 'Amount'];
    const tableRows = grncheck.itemDetails.map((item, index) => {
      const unitPrice = item.unitPrice || 0;
      const quantity = item.totalQuantity || 0;
      const totalAmount = unitPrice * quantity;
      return [
        `${index + 1}`,
        item.itemName || 'Item Description',
        item.hsnCode || '',
        item.nos || '',
        item.eachQuantity || '',
        `${item.quantity || 0} ${item.uom || 'Kgs'}`,
        `${unitPrice.toFixed(2)}`,
        `${item.totalQuantity || 0} ${item.uom || 'Kgs'}`,
        `${item.purchasetaxName || 0}%`,
        `${totalAmount.toFixed(2)}`,
      ];
    });
    // Items Table
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
        9: { halign: 'right' },
      },
    });
    yOffset = doc.autoTable.previous.finalY;
    // Calculate individual tax amounts
    const taxRates = {
      CGST: new Map<number, number>(),
      SGST: new Map<number, number>(),
      IGST: new Map<number, number>(),
    };
    grncheck.itemDetails.forEach(item => {
      const taxableAmount = item.unitPrice * (item.totalQuantity || 0);
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
    // Calculate total without tax
    const totalWithoutTax = grncheck.itemDetails.reduce((sum, item) => {
      return sum + (item.unitPrice * (item.totalQuantity || 0));
    }, 0);
    // Tax summary - UPDATED to include grnRoundOffAmount
    const taxSummary: [string, string][] = [
      [`Total Amount`, totalWithoutTax.toFixed(2) || '0'],
      [`Total Discount`, grncheck.totalDiscount?.toFixed(2) || '0'],
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
    // Add grnRoundOffAmount above Total Including Tax
    if (grncheck.grnRoundOffAmount !== undefined && grncheck.grnRoundOffAmount !== 0) {
      taxSummary.push([`Round Off Amount`, grncheck.grnRoundOffAmount.toFixed(2)]);
    }
    taxSummary.push([`Total [Including Tax]`, grncheck.grnAmount?.toFixed(2) || '0']);
    // Tax Summary Table
    doc.autoTable({
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
      margin: { bottom: 15 },
    });
    // Declarations and Authorized Signatory
    yOffset = doc.autoTable.previous.finalY;
    doc.text("Declaration:", 10, yOffset + 35);
    doc.text("We declare that this invoice shows the actual price of the described items and that all particulars are true and correct.", 10, yOffset + 40);
    doc.text("Authorized Signatory:", 120, yOffset + 48);
    doc.text("_____________________", 120, yOffset + 60);
    const imageUrl = '/images/pending.jpeg';
    doc.addImage(imageUrl, 'JPEG', 150, yOffset + 5, 30, 25);
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
    // Save the PDF
    doc.save(`${grncheck.vendorName} ${grncheck.randomId}.pdf`);
  };
  const handleDialogClose = () => {
    setDialogueViewOpen(false);
    dispatch(setSelectedGrnId(null));
    setApInvoiceDate(new Date()); // Reset to current date
    setOutgoingDate(new Date()); // Reset to current date
  };
  const handleSearchChange = (event: React.ChangeEvent<{}>, newValue: string) => {
    setSearchQuery(newValue); // Update the search query
  };
  const getRandomId = (purchaseOrderId: string): string | undefined => {
    const order = purchaseorders.find(po => po.purchaseOrderId === purchaseOrderId);
    return order?.randomId;
  };
  const handleOpen = () => {
    setDialogSummaryOpen(true);
  };
  const handleClose = () => {
    setDialogSummaryOpen(false);
  };
  const handleEditChange = (
    itemId: string,
    field: 'befTaxDiscount' | 'afTaxDiscount' | 'expiryDate',
    value: number | string
  ) => {
    setEditedItems((prev) => {
      const item = prev[itemId] || {};
      let updatedItem = { ...item };
      if (field === 'expiryDate') {
        updatedItem[field] = value ? new Date(value).toISOString() : null;
      } else {
        updatedItem[field] = Number(value) || 0;
      }
      return {
        ...prev,
        [itemId]: updatedItem,
      };
    });
  };
  const handleSaveAll = async () => {
  if (!selectedGrnId) {
    setErrorMessage('No GRN selected to save.');
    setLoading(false);
    return;
  }
  // Validate AP Round Off before saving
  if (apRoundOffError) {
    setSnackbarMessage('Please fix AP Round Off errors before saving.');
    setSnackbarOpen(true);
    return;
  }
  // Additional validation
  if (apRoundOff < -2 || apRoundOff > 2) {
    setSnackbarMessage('AP Round Off must be between -2.00 and +2.00');
    setSnackbarOpen(true);
    return;
  }
  const itemUpdates: ItemUpdate[] = Object.entries(editedItems).map(([itemId, itemData]) => ({
    itemId,
    befTaxDiscount: itemData.befTaxDiscount,
    afTaxDiscount: itemData.afTaxDiscount,
    expiryDate: itemData.expiryDate ? new Date(itemData.expiryDate) : null,
  }));
  const apInvoiceDateValue = apInvoiceDate ? apInvoiceDate.toISOString() : new Date().toISOString();
  const outgoingDateValue = outgoingDate ? outgoingDate.toISOString() : new Date().toISOString();
  // Use the parsed number directly without toFixed (passes exact value as typed, parsed to float)
  const payload = {
    grnId: selectedGrnId,
    apRoundOff: apRoundOff, // Exact parsed value (e.g., 0.3 if typed 0.3)
    itemUpdates,
    apInvoiceDate: apInvoiceDateValue,
    outgoingDate: outgoingDateValue,
  };
  console.log('Payload for save (AP Round Off):', payload.apRoundOff);
  try {
    setLoading(true);
    const resultAction = await dispatch(updateItemDetails(payload));
    if (updateItemDetails.fulfilled.match(resultAction)) {
      setErrorMessage(null);
      setDialogueViewOpen(false);
      setIsConvertedToAP(true);
      setSnackbarMessage('GRN successfully converted to AP and Outgoing.');
      setSnackbarOpen(true);
      dispatch(
        fetchGrns({
          page: newPage,
          size: pageSize,
        })
      );
      // Reset AP round off input after successful save
      setApRoundOffInput('');
      setApRoundOff(0);
    } else {
      const errorMessage = resultAction.payload || 'Please try again.';
      setErrorMessage('Error converting GRN: ' + errorMessage);
      setSnackbarMessage('Failed to convert GRN: ' + errorMessage);
      setSnackbarOpen(true);
    }
  } catch (error) {
    setErrorMessage('Error converting GRN. Please try again.');
    setSnackbarMessage('Failed to convert GRN. Please try again.');
    setSnackbarOpen(true);
  } finally {
    setLoading(false);
  }
};
  const handleRevertToPO = async (grnId: string) => {
    if (!grnId) {
      setSnackbarMessage('No GRN selected for reversion.');
      setSnackbarOpen(true);
      return;
    }
    try {
      const result = await dispatch(revertGrnToPO(grnId)).unwrap();
      // Fixed: result is an object, not a string. Assume always 'updated' (or check result.poAction if backend adds it)
      let message = `GRN successfully reverted to PO`;
      // If backend adds poAction: if (result.poAction === 'created') { message = `... (New PO created: ${result.purchaseOrderId})`; }
      setSnackbarMessage(message);
      setSnackbarOpen(true);
      // Refresh the GRN list
      dispatch(fetchGrns({ page: currentPage, size: pageSize }));
      // ADD THESE LINES: Close the main view dialog ONLY on success
      dispatch(setSelectedGrnId(null));
      setDialogueViewOpen(false);
      console.log('Reversion successful:', result);
    } catch (error: any) {
      console.error('Reversion failed:', error);
      setSnackbarMessage(error || 'Failed to revert GRN to PO');
      setSnackbarOpen(true);
      // NO CLOSING HERE: Keep the main dialog open on failure so user can retry
    }
  };
  // New: Handler for button click - opens dialog
  const handleOpenConfirmDialog = () => {
    if (!selectedGrnId) {
      setSnackbarMessage('No GRN selected.');
      setSnackbarOpen(true);
      return;
    }
    setConfirmDialogOpen(true);
  };
  // New: Handler for confirm - closes dialog and calls reversion
  const handleConfirmRevert = () => {
    setConfirmDialogOpen(false);
    handleRevertToPO(selectedGrnId || '');
  };
  // New: Handler for cancel - just closes dialog
  const handleCancelRevert = () => {
    setConfirmDialogOpen(false);
  };
  const handleGrnSelect = (grnId: string) => {
    dispatch(setSelectedGrnId(grnId));
    const selectedGrn = grns.find((grn) => grn.grnId === grnId);
    if (selectedGrn && selectedGrn.itemDetails) {
      // Initialize editedItems with all items from the selected GRN
      const initialEditedItems = selectedGrn.itemDetails.reduce(
        (acc, item) => ({
          ...acc,
          [item.itemId]: {
            nos: item.nos || 0,
            eachQuantity: item.eachQuantity || 0,
            receivedQuantity: item.receivedQuantity || 0,
            damagedQuantity: item.damagedQuantity || 0,
            returnedQuantity: item.returnedQuantity || 0,
            unitPrice: item.unitPrice || 0,
            befTaxDiscount: item.befTaxDiscount || 0,
            afTaxDiscount: item.afTaxDiscount || 0,
            purchasetaxName: item.purchasetaxName || 0,
            expiryDate: item.expiryDate || null,
            taxType: item.taxType || 'cgst_sgst',
            sgst: item.sgst || 0,
            cgst: item.cgst || 0,
            igst: item.igst || 0,
            hsnCode: item.hsnCode || '',
            discount: item.discount || 0,
            totalPrice: item.totalPrice || 0,
            finalPrice: item.finalPrice || 0,
            befTaxDiscountAmount: item.befTaxDiscountAmount || 0,
            afTaxDiscountAmount: item.afTaxDiscountAmount || 0,
            purchasecategoryName: item.purchasecategoryName || '',
            purchasesubcategoryName: item.purchasesubcategoryName || '',
            taxAmount: item.taxAmount || 0,
          },
        }),
        {}
      );
      setEditedItems(initialEditedItems);
      // Set apInvoiceDate and outgoingDate to current date if not set
      setApInvoiceDate(new Date()); // Current date for AP Invoice
      setOutgoingDate(new Date());
    }
    setDialogueViewOpen(true);
  };
  const handleVerify = () => {
    setLoading(true);
    if (!apInvoiceDate || !outgoingDate) {
      setSnackbarMessage('Please select both AP Invoice Date and Outgoing Date before verifying.');
      setSnackbarOpen(true);
      setLoading(false);
      return; // Prevent proceeding; user must cancel/close and select dates
    }
    // Check for expiry date in each edited item
    const missingExpiryDates = Object.entries(editedItems).filter(
      ([itemId, item]) => !item.expiryDate
    );
    if (missingExpiryDates.length > 0) {
      setLoading(false); // Reset loading if validation fails
      setSnackbarMessage('Please fill in the expiry date for all items before verifying.');
      setSnackbarOpen(true);
      return;
    }
    setLoading(false); // Reset loading before opening dialog
    setDialogSaveOpen(true); // Open confirmation dialog
  };
  const handleStartDateChange = (value: Date | null) => {
    setStartDate(value); // Update the startDate state with Date or null
  };
  // Handler for end date change
  const handleEndDateChange = (value: Date | null) => {
    setEndDate(value); // Update the endDate state with Date or null
  };
  const generatePDF = () => {
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
    const title = "GRN Order Summary";
    const pageWidth = doc.internal.pageSize.width; // Get page width directly
    const fontSize = (doc.internal as any).getFontSize(); // Access font size
    const titleWidth = doc.getStringUnitWidth(title) * fontSize / doc.internal.scaleFactor;
    const titleX = (pageWidth - titleWidth) / 2;
    doc.text(title, titleX, yOffset); // Centered title
    doc.setLineWidth(0.1); // Set line width for the underline
    doc.line(titleX, yOffset + 2, titleX + titleWidth, yOffset + 2); // Draw the underline
    yOffset += 15; // Move yOffset down after the title
    // Format the current date
    const today = new Date();
    const currentDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
    // Calculate the total ordered amount before generating the table
    const totalReceivedAmount = (filteredGrns || []).reduce((sum, order) => {
      const totalOrderAmount = order.grnAmount || 0; // Ensure it's a number
      return sum + totalOrderAmount;
    }, 0);
    doc.setFontSize(10); // Smaller font size for these details
    const dateX = 10; // Left-aligned start for the date
    const totalReceivedX = pageWidth - 10 - doc.getStringUnitWidth(`Total Received: ${totalReceivedAmount.toFixed(2)}`) * 10 / doc.internal.scaleFactor;
    // Place "Current Date" and "Total Received Amount" on the same row
    doc.text(`Date: ${currentDate}`, dateX, yOffset); // Date on the left
    doc.text(`Total Received: ${totalReceivedAmount.toFixed(2)}`, totalReceivedX, yOffset); // Total on the right
    yOffset += 5; // Add space before the table for better readability
    // Table headers for summary data
    const headers = [
      ["S.No", "GrnId", "Vendor Name", "Total Items", "GRN Date", "Total Order Amount", "Final Amount"],
    ];
    // Prepare rows for purchase order summary (filter only the valid orders)
    const rows = (grns || []).map((grn, index) => {
      const totalItemsQuantity = Array.isArray(grn.itemDetails) && grn.itemDetails.length > 0
        ? grn.itemDetails.reduce((sum, item) => sum + (item.quantity || 0), 0)
        : 0;
      const totalOrderAmount = grn.grnAmount || 0;
      const totalDiscount = grn.totalDiscount || 0;
      const finalAmount = totalOrderAmount - totalDiscount;
      if (!grn.randomId || !grn.vendorName || !grn.grnDate || totalOrderAmount <= 0) {
        return null;
      }
      return [
        `${index + 1}`,
        grn.randomId.toString(),
        grn.vendorName.toString(),
        totalItemsQuantity.toString(),
        grn.grnDate ? format(new Date(grn.grnDate), 'dd-MM-yyyy') : '', // Format grn.grnDate
        totalOrderAmount.toFixed(2).toString(),
        finalAmount.toFixed(2).toString(),
      ];
    }).filter(row => row !== null);
    // Add the table to the PDF with custom styles
    doc.autoTable({
      head: headers,
      body: rows,
      startY: yOffset, // Start the table below the "Total Received Amount"
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
    // Save the PDF with a dynamic name based on purchase order ID
    const pdfFilename = 'GRNVendorwise.pdf';
    doc.save(pdfFilename);
    setDialogDownloadOpen(false);
  };
  const generateSummaryPDF = () => {
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
    const title = "GRN Detailed Summary";
    const pageWidth = doc.internal.pageSize.width; // Get page width directly
    const fontSize = (doc.internal as any).getFontSize(); // Access font size
    const titleWidth = doc.getStringUnitWidth(title) * fontSize / doc.internal.scaleFactor;
    const titleX = (pageWidth - titleWidth) / 2;
    doc.text(title, titleX, yOffset); // Centered title
    doc.setLineWidth(0.1); // Set line width for the underline
    doc.line(titleX, yOffset + 2, titleX + titleWidth, yOffset + 2); // Draw the underline
    yOffset += 15; // Move yOffset down after the title
    // Format the current date
    const today = new Date();
    const currentDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1)
      .toString()
      .padStart(2, '0')}/${today.getFullYear()}`;
    // Calculate the total ordered amount before generating the table
    const totalReceivedAmount = (filteredGrns || []).reduce((sum, order) => {
      const totalOrderAmount = order.grnAmount || 0; // Ensure it's a number
      return sum + totalOrderAmount;
    }, 0);
    doc.setFontSize(10); // Smaller font size for these details
    const dateX = 10; // Left-aligned start for the date
    const totalReceivedX = pageWidth - 10 - doc.getStringUnitWidth(`Total Received: ${totalReceivedAmount.toFixed(2)}`) * 10 / doc.internal.scaleFactor;
    // Place "Current Date" and "Total Received Amount" on the same row
    doc.text(`Date: ${currentDate}`, dateX, yOffset); // Date on the left
    doc.text(`Total Received: ${totalReceivedAmount.toFixed(2)}`, totalReceivedX, yOffset); // Total on the right
    yOffset += 5; // Add space before the table for better readability
    const headers = [
      ["S.No", "Purchase Order No", "Vendor Name", "Item Name", "Quantity", "Price", "Tax", "Discount", "Final Price"],
    ];
    // Safely handle purchaseList being null or undefined
    const rows = (grns || []).map((grn, index) => {
      // Ensure that order.items is an array
      return (grn.itemDetails || []).map((item: ItemDetail) => [
        `${index + 1}`,
        grn.randomId, // Assuming purchase order number is a property of the order
        grn.vendorName, // Vendor name from the order
        item.itemName, // Item name from the order items
        item.quantity, // Quantity from the order item
        item.totalPrice, // Price of the item
        `${item.purchasetaxName}%`, // Tax percentage
        item.discountAmount, // Discount on the item
        item.finalPrice, // Final price after tax and discount
      ]);
    }).flat(); // Flatten the array to a single-level array of rows
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
    // Save the PDF with a dynamic name
    const pdfFilename = `GRNItemwise.pdf`;
    doc.save(pdfFilename);
    handleClose();
  };
  const generateSummaryCSV = () => {
    // Define the headers for the CSV
    const headers = [
      "S.No",
      "GRN No",
      "Vendor Name",
      "Item Name",
      "Quantity",
      "Price",
      "Tax",
      "Discount",
      "Final Price"
    ];
    // Map the GRN data into the CSV rows
    const rows = (filteredGrns || []).map((grn, index) => {
      // For each GRN, we loop through the items (itemDetails)
      return (grn.itemDetails || []).map((item) => [
        `${index + 1}`,
        grn.randomId, // Purchase Order Number
        grn.vendorName, // Vendor Name
        item.itemName, // Item Name
        item.quantity, // Quantity
        item.totalPrice, // Price
        `${item.purchasetaxName}%`, // Tax
        item.discountAmount, // Discount
        item.finalPrice, // Final Price
      ]);
    }).flat(); // Flatten the rows array to a single level
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
    link.setAttribute("download", "GRNItemwise.csv");
    // Trigger the download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    handleClose(); // Close or clean up any UI elements (if needed)
  };
  const handleExportCSV = () => {
    // Define the headers for the CSV
    const headers = [
      "S.No",
      "GRN No",
      "Vendor Name",
      "Total Items",
      "GRN Date",
      "Total Order Amount",
      "Final Amount"
    ];
    // Map the GRN data into the CSV rows
    const rows = (filteredGrns || []).map((grn, index) => {
      const totalItemsQuantity = Array.isArray(grn.itemDetails) && grn.itemDetails.length > 0
        ? grn.itemDetails.reduce((sum, item) => sum + (item.quantity || 0), 0)
        : 0;
      const totalOrderAmount = grn.grnAmount || 0;
      const totalDiscount = grn.totalDiscount || 0;
      const finalAmount = totalOrderAmount - totalDiscount;
      if (!grn.randomId || !grn.vendorName || !grn.grnDate || totalOrderAmount <= 0) {
        return null;
      }
      return [
        `${index + 1}`,
        grn.randomId.toString(),
        grn.vendorName.toString(),
        totalItemsQuantity.toString(),
        grn.grnDate ? format(new Date(grn.grnDate), 'dd-MM-yyyy') : '', // Format grn.grnDate
        totalOrderAmount.toFixed(2).toString(),
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
    link.setAttribute("download", "GRNVendorwise.csv");
    // Trigger the download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDialogDownloadOpen(false);
  };
  const handleVerifyConfirm = async (selectedGrnId: string) => {
    if (!selectedGrnId) {
      setErrorMessage('No GRN selected for submission.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true); // Set loading true at the start
      await handleSaveAll(); // Call handleSaveAll and wait for completion
      setIsSubmitted(true);
      setDialogSaveOpen(false);
      setDialogOpen(false);
    } catch (error) {
      console.error('Error during verification:', error);
      setErrorMessage('Failed to submit GRN. Please try again.');
      setSnackbarMessage('Failed to submit GRN. Please try again.');
      setSnackbarOpen(true);
    } finally {
      setLoading(false); // Reset loading in finally block
    }
  };
  const handleCancel = () => {
    setDialogSaveOpen(false);
  };
  const filteredGrns = sortedGrns.filter(grn => grn.status === 'active');
  // utils/calculations.ts
  const calculateItemTotal = (receivedQuantity: number, damagedQuantity: number, returnedQuantity: number, unitPrice: number): number => {
    const netQuantity = receivedQuantity - damagedQuantity;
    const Quantity = netQuantity - returnedQuantity;
    return Quantity * unitPrice;
  };
  const applyDiscount = (totalPrice: number, discount: number): number => {
    const discountAmount = (discount / 100) * totalPrice;
    return totalPrice - discountAmount;
  };
  const calculateFinalTotalAmount = () => {
    if (!selectedGrn || !selectedGrn.itemDetails) return 0; // Guard clause for both selectedGrn and itemDetails
    let totalAmount = 0;
    // Add safe iteration with optional chaining
    selectedGrn.itemDetails?.forEach(item => {
      const totalPrice = calculateItemTotal(
        item.receivedQuantity || 0,
        item.damagedQuantity || 0,
        item.returnedQuantity || 0,
        item.unitPrice || 0
      );
      const priceAfterDiscount = applyDiscount(totalPrice, item.discount || 0);
      const taxAmount = ((item.purchasetaxName || 0) / 100) * priceAfterDiscount;
      totalAmount += priceAfterDiscount + taxAmount;
    });
    return totalAmount;
  };
  const calculateTaxDetails = () => {
    // Initialize taxDetails object
    let taxDetails: { [key: string]: { sgstAmount: number; cgstAmount: number; igstAmount: number } } = {};
    // Add null check for selectedGrn and itemDetails
    if (!selectedGrn || !selectedGrn.itemDetails) {
      return taxDetails;
    }
    // Loop through each item in the selected GRN's item details
    selectedGrn.itemDetails.forEach(item => {
      // Add default values for all properties
      const receivedQuantity = item.receivedQuantity || 0;
      const damagedQuantity = item.damagedQuantity || 0;
      const returnedQuantity = item.returnedQuantity || 0;
      const unitPrice = item.unitPrice || 0;
      const befTaxDiscountAmount = item.befTaxDiscountAmount || 0;
      const afTaxDiscountAmount = item.afTaxDiscountAmount || 0;
      const purchasetaxName = item.purchasetaxName || 0;
      const taxType = item.taxType || '';
      // Calculate the total price based on received and damaged quantity
      const totalPrice = calculateItemTotal(receivedQuantity, damagedQuantity, returnedQuantity, unitPrice);
      // Apply befTaxDiscount before calculating the tax
      let priceAfterBefTaxDiscount = totalPrice;
      if (befTaxDiscountAmount) {
        priceAfterBefTaxDiscount -= befTaxDiscountAmount;
      }
      // Calculate tax amount based on price after befTaxDiscount
      const taxAmount = (purchasetaxName / 100) * priceAfterBefTaxDiscount;
      // Initialize the taxDetails object for this rate if it doesn't exist
      if (!taxDetails[purchasetaxName]) {
        taxDetails[purchasetaxName] = { sgstAmount: 0, cgstAmount: 0, igstAmount: 0 };
      }
      // Apply tax calculation logic based on taxType
      if (taxType === 'cgst_sgst') {
        taxDetails[purchasetaxName].sgstAmount += taxAmount / 2;
        taxDetails[purchasetaxName].cgstAmount += taxAmount / 2;
      } else if (taxType === 'igst') {
        taxDetails[purchasetaxName].igstAmount += taxAmount;
      }
      // Apply afTaxDiscount after tax is calculated
      if (afTaxDiscountAmount) {
        if (taxType === 'cgst_sgst') {
          taxDetails[purchasetaxName].sgstAmount -= afTaxDiscountAmount / 2;
          taxDetails[purchasetaxName].cgstAmount -= afTaxDiscountAmount / 2;
        } else if (taxType === 'igst') {
          taxDetails[purchasetaxName].igstAmount -= afTaxDiscountAmount;
        }
      }
    });
    return taxDetails;
  }; // Use tax details in the component
  // Use tax details in the component with safe access
  const finalTotalAmount = calculateFinalTotalAmount();
  const taxDetails = calculateTaxDetails();
  // Add safe calculation for roundedFinalTotalAmount
  const roundedFinalTotalAmount = customRound(
    finalTotalAmount +
    Object.values(taxDetails).reduce(
      (acc, { sgstAmount = 0, cgstAmount = 0, igstAmount = 0 }) =>
        acc + sgstAmount + cgstAmount + igstAmount,
      0
    )
  );
  const safeSelectedGrnId = selectedGrnId || 'default-id';
  const filteredItems = selectedGrn?.itemDetails;
  if (isHidden) {
  return <Typography>You do not have permission to access GRN</Typography>;
}

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }
  const handleFilterClick = () => {
    let filtered: GrnData[] = grns;
    const formattedStartDate = selectionRange?.startDate instanceof Date
      ? moment(selectionRange.startDate).startOf('day').toDate()
      : fromDate;
    const formattedEndDate = selectionRange?.endDate instanceof Date
      ? moment(selectionRange.endDate).endOf('day').toDate()
      : toDate;
    // Filter based on selected vendor name
    if (selectedVendorName) {
      filtered = filtered.filter(grn =>
        grn.vendorName?.toLowerCase().includes(selectedVendorName.toLowerCase())
      );
    }
    // Filter based on start date
    if (formattedStartDate) {
      filtered = filtered.filter(grn => {
        const grnDateParsed = grn.grnDate ? new Date(grn.grnDate) : null;
        return grnDateParsed && grnDateParsed >= formattedStartDate;
      });
    }
    // Filter based on end date
    if (formattedEndDate) {
      filtered = filtered.filter(grn => {
        const grnDateParsed = grn.grnDate ? new Date(grn.grnDate) : null;
        return grnDateParsed && grnDateParsed <= formattedEndDate;
      });
    }
    // Filter based on status
    if (status) {
      filtered = filtered.filter(grn => grn.status === status);
    }
    console.log('Filtered GRN (Frontend):', filtered);
    // Send filters to the backend
    dispatch(fetchGrns({
      page: newPage,
      size: pageSize,
      fromDate: formattedStartDate instanceof Date ? formattedStartDate : undefined,
      toDate: formattedEndDate instanceof Date ? formattedEndDate : undefined,
      vendorName: selectedVendorName || '',
      status: status || '',
    }))
      .unwrap() // Unwrap the thunk result
      .then((payload: FetchGrnsPayload) => {
        const data = payload.grns || [];
        if (data.length === 0) {
          console.log('No matching GRN found.');
          setSnackbarMessageGRN('No matching GRN found.');
          setSnackbarOpenGRN(true);
        } else {
          setFilteredGrn(data);
        }
      })
      .catch((error: { message?: string }) => {
        console.error('Error fetching GRN:', error);
        setSnackbarMessageGRN(error.message || 'Error fetching GRN');
        setSnackbarOpenGRN(true);
      });
  };
  const handleFilterClose = () => {
    // Reset filter states (except for the date)
    setSelectionRange({
      startDate: new Date(), // Set to current date
      endDate: new Date(), // Set to current date
      key: 'selection', // Retain the key
    });
    setSelectedVendor(null); // Clear vendor selection
    dispatch(fetchGrns({ page: 1, size: pageSize, status }));
  }
  if (error) {
    return <Typography>Error: {error}</Typography>;
  }
  console.log(filteredGrns);
  return (
    <Box >
      <YenPurchasePage />
      <Box sx={{ px: 1, backgroundColor: 'white' }}>
        <Box display="flex" flexDirection="column" mb={1} mt={1}>
          {/* First Row - GRN List, Verified GRN, Return GRN buttons, and Typography */}
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1} ml={1}>
            {/* Buttons */}
            <Box display="flex" alignItems="center">
               {canRead && (
              <Link href="/yen-purchase/GrnPage" passHref>
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
                  GRN List
                </Button>
              </Link>
               )}
              {canReturnRead && (
              <Link href="/yen-purchase/GrnPage/GrnReturn" passHref>
                <Button variant="contained" color="primary" sx={{ mr: 2 }}>
                  Return GRN
                </Button>
              </Link>
              )}
            </Box>
            {/*
            <Typography
              sx={{
                pl: 2,
                pr: 2,
                boxShadow: 3, // Adds a subtle shadow
                borderRadius: 1, // Optional: adds rounded corners to the box
                padding: '8px', // Adds padding for better spacing
                textAlign: 'left',
                maxWidth: '370px',
                fontWeight: 'bold',
                flexGrow: 1, // Ensures typography takes available space
                ml: 2, // Adds margin to separate from buttons
              }}
            >
              Description:<br />
              Pending GRN. You can verify them, and once verified, they will be moved to the
              Verified GRN status. If you need to update or edit the invoice details,
              you may do so on this page. Additionally, you can process Returns here as
              well.
            </Typography> */}
          </Box>
          <Grid container alignItems="center" spacing={0.5} wrap="nowrap" ml={0.5}>
            {/* Date Range Filter */}
            <Grid item >
              <DateRangeDialog
                selectionRange={selectionRange}
                setSelectionRange={setSelectionRange}
                onApply={handleFilterClick}
              />
            </Grid>
            {/* All Vendors Autocomplete */}
            <Grid item xs={2}>
              <VendorSearchAutocomplete
                value={selectedVendor}
                onChange={handleVendorChange}
                label="Vendor Name"
              />
            </Grid>
            {/* Filter Button with Icon and Text */}
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
            {/* Clear Filter Button with Icon and Text */}
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
            {/* Download Icon */}
            <Grid item>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <IconButton
                  onClick={handleClick}
                  color="primary"
                  className="icon-button-outline"
                  disabled={!grns || grns.length === 0 || loading}
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
        <TableContainer
          component={Paper}
          sx={{
            maxHeight: 'calc(100vh - 250px)', // Dynamic height based on viewport
            overflowY: 'auto',
            width: '100%',
            ml: 1
          }}
        >
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell className='table-number-right'>S.No</TableCell>
                <TableCell>GRN Id</TableCell>
                <TableCell>Po Id</TableCell>
                <TableCell>Vendor Name</TableCell>
                <TableCell>Invoice No</TableCell>
                <TableCell>Invoice Date</TableCell>
                <TableCell>GRN Date</TableCell>
                <TableCell className='table-number-right'>
                  Aging Days
                  <IconButton onClick={toggleSortOrder}>
                    {sortOrder === 'asc' ? <ArrowUpward /> : <ArrowDownward />}
                  </IconButton>
                </TableCell>
                <TableCell className='table-number-right'>Total Received Amount</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedGrns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    No GRN data available
                  </TableCell>
                </TableRow>
              ) : (
                sortedGrns.map((grn, index) => {
                  const { tooltipTitle, isDisabled } = grnCreditNoteStatus[grn.grnId] || {
                    tooltipTitle: 'No Debit/Credit Notes Available',
                    isDisabled: true,
                  };
                  return (
                    <TableRow key={grn.grnId}>
                      <TableCell className='table-number-right'>{index + 1}</TableCell>
                      <TableCell>{grn.randomId}</TableCell>
                      <TableCell>{grn.poRandomID}</TableCell>
                      <TableCell>{grn.vendorName}</TableCell>
                      <TableCell>{grn.invoiceNo}</TableCell>
                      <TableCell>{grn.invoiceDate ? format(grn.invoiceDate, 'dd-MM-yyyy') : ''}</TableCell>
                      <TableCell>{grn.grnDate ? format(grn.grnDate, 'dd-MM-yyyy') : ''}</TableCell>
                      <TableCell className='table-number-right'>{grn.agingDay}</TableCell>
                      <TableCell className='table-number-right'>{customRound(grn.grnAmount)}</TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          {/* View Button with Eye Icon */}
                         <Tooltip title="View Detail">
                              <span>
                                <IconButton
                                  color="primary"
                                  onClick={() => handleGrnSelect(grn.grnId)}
                                  disabled={!canRead}
                                >
                                  <VisibilityIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                          {/* Debit/Credit Note Button */}
                          <Tooltip title={tooltipTitle}>
                            <span>
                              <IconButton
                                color="primary"
                                onClick={() => handleViewCreditNotes(grn.grnId)}
                                disabled={isDisabled} >
                                <DescriptionIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                           <Tooltip title="Return GRN">
                              <span>
                                <IconButton
                                  color="primary"
                                  onClick={() => handleReturnClick(grn.grnId)}
                                  disabled={!canEdit}
                                >
                                  <ExitToAppIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                          {/* Download PDF Button */}
                          <Tooltip title="Download PDF">
                            <IconButton color="primary" onClick={() => handleDownload(grn.grnId)}>
                              <PictureAsPdfIcon />
                            </IconButton>
                          </Tooltip>
                          {/* Edit Invoice Button */}
                            <Tooltip title="Edit">
                              <span>
                                <IconButton
                                  color="primary"
                                  onClick={() => handleEditInvoice(grn.grnId)}
                                  disabled={!canEdit}
                                >
                                  <EditIcon />
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
        <Dialog
          open={dialogueviewOpen}
          onClose={handleDialogClose}
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
          }}>View Item Details
            <IconButton onClick={toggleFullScreen} color="primary" edge="end">
              {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton></DialogTitle>
          <DialogContent sx={{
            padding: isFullScreen ? '0 24px' : '20px',
            height: isFullScreen ? 'calc(100vh - 120px)' : 'auto',
            overflow: 'auto'
          }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
              GRN Details
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ pl: 0, width: '100%' }}>
                    <Box sx={{ pl: 0, width: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>PO NO:</Typography>
                        <Typography variant="h6">{selectedGrn?.poRandomID || 'PO0001'}</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{'-->'}</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>GRN NO:</Typography>
                        <Typography variant="h6">{selectedGrn?.randomId || 'GN0001'}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Vendorname:</Typography>
                        <Typography variant="h6">{selectedGrn?.vendorName || 'KK MOTORS'}</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Invoice No:</Typography>
                        <Typography variant="h6">{selectedGrn?.invoiceNo}</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Invoice Date:</Typography>
                        <Typography variant="h6">
                          {selectedGrn?.invoiceDate ? format(new Date(selectedGrn.invoiceDate), 'dd-MM-yyyy') : 'N/A'}
                        </Typography>
                      </Box>
                    </Box>
                    {/* GRN Date, AP Invoice Date and Outgoing Date in the same row */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', mb: 1 }}>
                      <Grid container spacing={2} alignItems="center" justifyContent="flex-start">
                        {/* GRN Date Display */}
                        <Grid item xs={12} md={2}>
                          <Box sx={{
                            display: 'flex',
                            justifyContent: 'start',
                            alignItems: 'center',
                            height: '14px', // Match the height of date pickers
                            padding: '16px 14px', // Match date picker padding
                          }}>
                            <Typography variant="body1" sx={{ whiteSpace: 'nowrap', fontSize: '0.875rem' }}>
                              GRN Date: {selectedGrn?.grnDate ? format(new Date(selectedGrn.grnDate), 'dd-MM-yyyy') : 'N/A'}
                            </Typography>
                          </Box>
                        </Grid>
                        {/* AP Invoice Date Picker */}
                        <Grid item xs={12} md={2}>
                          <SmartDatePicker
                            label="AP Invoice Date"
                            value={apInvoiceDate}
                            onChange={setApInvoiceDate}
                            maxDate={new Date()}
                            disabled={true} // This will disable the field
                          />
                        </Grid>
                        {/* Outgoing Date Picker */}
                        {/* <Grid item xs={12} md={2}>
                          <SmartDatePicker
                            label="Outgoing Date"
                            value={outgoingDate}
                            onChange={setOutgoingDate}
                            maxDate={new Date()}
                          />
                        </Grid> */}
                      </Grid>
                    </Box>
                    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                      <IconButton onClick={handlePopoverOpen} sx={{ p: 0.5 }}>
                        <FilterListIcon />
                      </IconButton>
                    </Box>
                  </Box>
                </Box>
                <Popover
                  open={openHeaderSelect}
                  anchorEl={anchorEl}
                  onClose={handlePopoverClose}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                  }}
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                  }}
                  slotProps={{
                    paper: {
                      sx: { minWidth: 200, m: 0, p: 0.5, boxShadow: 3 }
                    }
                  }}
                >
                  <Box sx={{ p: 1, display: 'flex', flexDirection: 'column' }}>
                    {allHeaders.map((header) => (
                      <FormControlLabel
                        key={header}
                        control={
                          <Checkbox
                            checked={selectedHeaders.includes(header)}
                            onChange={() => handleHeaderSelectChange(header)}
                            size="small"
                          />
                        }
                        label={headerDisplayNames[header] || header}
                        sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: '0.9rem' } }}
                      />
                    ))}
                  </Box>
                </Popover>
              </Grid>
              {/* Rest of your table code remains the same */}
              <Grid item xs={12}>
                <TableContainer component={Paper}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell className='table-number-right'>S.No</TableCell>
                        {sortedSelectedHeaders
                          .filter((header) => header !== 'totalPrice' && header !== 'finalPrice')
                          .map((header) => (
                            <TableCell key={header}>
                              {headerDisplayNames[header] || header}
                            </TableCell>
                          ))}
                        {sortedSelectedHeaders.includes('totalPrice') && <TableCell className='table-number-right'>Total Price</TableCell>}
                        {sortedSelectedHeaders.includes('finalPrice') && <TableCell className='table-number-right'>Final Price</TableCell>}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedGrn?.itemDetails?.map((item, index) => ( // Add ?. for safe access
                        <TableRow key={item.itemId}>
                          <TableCell>{index + 1}</TableCell>
                          {sortedSelectedHeaders
                            .filter((header) => header !== 'totalPrice' && header !== 'finalPrice')
                            .map((header) => (
                              <TableCell key={header}>
                                {header === 'itemName' && (item.itemName || '')}
                                {header === 'nos' && (item.nos || 0)}
                                {header === 'eachQuantity' && (item.eachQuantity || 0)}
                                {header === 'receivedQuantity' && (item.receivedQuantity || 0)}
                                {header === 'returnedQuantity' && (item.returnedQuantity || 0)}
                                {header === 'totalQuantity' && (
                                  typeof item.totalQuantity === 'number' && item.totalQuantity !== 0
                                    ? item.totalQuantity
                                    : (item.receivedQuantity || 0)
                                )}
                                {header === 'uom' && (item.uom || '')}
                                {header === 'unitPrice' && (item.unitPrice || 0).toFixed(2)}
                                {header === 'purchasetaxName' && (item.purchasetaxName || 0)}
                                {header === 'befTaxDiscount' && (
                                  <TextField
                                    type="number"
                                    value={editedItems[item.itemId]?.befTaxDiscount ?? item.befTaxDiscount}
                                    onChange={(e) =>
                                      handleEditChange(item.itemId, 'befTaxDiscount', Number(e.target.value))
                                    }
                                  />
                                )}
                                {header === 'afTaxDiscount' && (
                                  <TextField
                                    type="number"
                                    value={editedItems[item.itemId]?.afTaxDiscount ?? item.afTaxDiscount}
                                    onChange={(e) =>
                                      handleEditChange(item.itemId, 'afTaxDiscount', Number(e.target.value))
                                    }
                                  />
                                )}
                                {header === 'expiryDate' && (
                                  <TextField
                                    type="date"
                                    value={
                                      editedItems[item.itemId]?.expiryDate
                                        ? new Date(editedItems[item.itemId]!.expiryDate as string).toLocaleDateString('en-CA')
                                        : item.expiryDate
                                          ? new Date(item.expiryDate).toLocaleDateString('en-CA')
                                          : ''
                                    }
                                    onChange={(e) => handleEditChange(item.itemId, 'expiryDate', e.target.value)}
                                    inputProps={{
                                      min: new Date().toISOString().split('T')[0],
                                    }}
                                    disabled
                                  />
                                )}
                              </TableCell>
                            ))}
                          {sortedSelectedHeaders.includes('totalPrice') && (
                            <TableCell>{item.totalPrice.toFixed(2)}</TableCell>
                          )}
                          {sortedSelectedHeaders.includes('finalPrice') && (
                            <TableCell>{(editedItems[item.itemId]?.finalPrice || item.finalPrice).toFixed(2)}</TableCell>
                          )}
                        </TableRow>
                      ))}
                      {/* AP Round Off Input */}
                      <TableRow>
                        <TableCell colSpan={sortedSelectedHeaders.length} align="right">
                          <strong>AP Round Off:</strong>
                        </TableCell>
                        <TableCell>
                          <TextField
                            autoComplete="off"
                            type="text"
                            value={apRoundOffInput}
                            onChange={handleApRoundOffInputChange}
                            onBlur={handleApRoundOffBlur}
                            placeholder="0.00"
                            style={{ width: '120px' }}
                            inputProps={{
                              step: 0.01,
                              min: -2,
                              max: 2
                            }}
                            error={!!apRoundOffError}
                            helperText={apRoundOffError || ''} // NEW: Shows error message below (red text)
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                        <TableCell colSpan={sortedSelectedHeaders.length - 1} />
                        <TableCell>
                          <strong>AP Round Off Applied:</strong>
                        </TableCell>
                        <TableCell
                          sx={{
                            color: apRoundOff > 0 ? 'green' : apRoundOff < 0 ? 'red' : 'black',
                            fontWeight: 'bold'
                          }}
                        >
                          {apRoundOff > 0 ? `+${apRoundOff}` : apRoundOff.toString()}
                        </TableCell>
                      </TableRow>
                      <TableRow sx={{ backgroundColor: '#e8f5e8', borderTop: '2px solid #000' }}>
                        <TableCell colSpan={sortedSelectedHeaders.length - 1} />
                        <TableCell>
                          <strong>New AP Total:</strong>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 'bold', fontSize: '1.1em' }}>
                          {((selectedGrn?.grnAmount || 0) + apRoundOff).toFixed(2)}
                        </TableCell>
                      </TableRow>
                      {/* Rest of your existing tax and summary rows */}
                      <TableRow>
                        <TableCell colSpan={sortedSelectedHeaders.length - 1} />
                        <TableCell>RoundOff Amount:</TableCell>
                        <TableCell>{selectedGrn?.grnRoundOffAmount?.toFixed(2) || '0.00'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={sortedSelectedHeaders.length - 1} />
                        <TableCell>Freight Tax:</TableCell>
                        <TableCell>{selectedGrn?.totalFreightTaxAmount?.toFixed(2) || '0.00'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={sortedSelectedHeaders.length - 1} />
                        <TableCell>Freight:</TableCell>
                        <TableCell>{selectedGrn?.totalFreightAmount?.toFixed(2) || '0.00'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={sortedSelectedHeaders.length - 1} />
                        <TableCell>
                          <strong>Discount Amount:</strong>
                        </TableCell>
                        <TableCell>{totalDiscount.toFixed(2)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={sortedSelectedHeaders.length - 1} />
                        <TableCell>
                          <strong>Tax Amount:</strong>
                        </TableCell>
                        <TableCell>{selectedGrn?.totalTax?.toFixed(2) || '0.00'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={sortedSelectedHeaders.length - 1} />
                        <TableCell>
                          <strong>Final Total Amount:</strong>
                        </TableCell>
                        <TableCell>{selectedGrn?.grnAmount?.toFixed(2) || '0.00'}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              color="primary"
              onClick={handleVerify}
              disabled={!canEdit}
            >
              Convert to AP
            </Button>
            <Button
              variant="contained"
              color="warning"
              onClick={handleOpenConfirmDialog} // Changed: Open dialog instead of direct call
              disabled={loading || !selectedGrnId || !canEdit}
            >
              Revert to PO
            </Button>
            <Button onClick={handleDialogClose}>Close</Button>
          </DialogActions>
        </Dialog>
        <Dialog open={invoiceOpen} onClose={() => setInvoiceOpen(false)}>
          <DialogTitle>Edit Invoice Details</DialogTitle>
          <DialogContent>
            <TextField
              label="Invoice No"
              type="text"
              sx={{ marginTop: '10px' }}
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              fullWidth
            />
            <TextField
  label="Invoice Date"
  type="date"
  value={invoiceDate ? invoiceDate.toLocaleDateString('en-CA') : new Date().toLocaleDateString('en-CA')}
  onChange={(e) => {
    const selectedDate = e.target.value;
    setInvoiceDate(selectedDate ? new Date(selectedDate) : null);
  }}
  inputProps={{
    max: new Date().toLocaleDateString('en-CA') // Disable future dates
  }}
  fullWidth
  sx={{ marginTop: 2 }}
  // Don't add disabled prop here - let user select past dates
/>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setInvoiceOpen(false)} variant='contained' color="primary">Cancel</Button>
            <Button onClick={handleSaveInvoice} variant='contained' color="primary">Save</Button>
          </DialogActions>
        </Dialog>
        <Dialog open={dialogSaveOpen} onClose={handleCancel}>
          <DialogTitle>Confirm Submission</DialogTitle>
          <DialogContent>
            <Typography>
              &quot;Are you sure you want to submit these details? Once submitted, you will not be able to edit them.&quot;
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCancel} color="primary" >
              Cancel
            </Button>
            <Button onClick={() => handleVerifyConfirm(selectedGrnId || '')} disabled={loading} color="primary">Confirm</Button>
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
          onClose={() => setSnackbarOpen(false)} // Automatically close the Snackbar
        />
        <Snackbar
          open={snackbarOpenGRN}
          message={snackbarMessageGRN}
          autoHideDuration={3000}
          onClose={() => dispatch(clearSnackbarMessage())}
        />
     {returnDialogOpen && (
          <GrnReturnDialog
            dialogItems={selectedGrnItems}
            selectedGrnId={selectedGrnId}
            currentPage={currentPage}
            pageSize={pageSize}
            status={status}
            fromDate={fromDate ? format(fromDate, 'yyyy-MM-dd') : undefined}
            toDate={toDate ? format(toDate, 'yyyy-MM-dd') : undefined}
            onReturnComplete={handleReturnComplete}
            onCancel={handleReturnCancel}
          />
        )}
        <DebitCreditNoteDialog />
        <ConfirmationDialog
          open={confirmDialogOpen}
          onClose={handleCancelRevert} // Closes dialog without action
          onConfirm={handleConfirmRevert} // Closes and reverts
          title="Confirm Revert to PO"
          description="Are you sure you want to revert the selected GRN to PO?"
          confirmText="Revert to PO" // Custom text
          cancelText="Cancel"
        />
      </Box>
    </Box>
  );
};
export default React.memo(GrnPage);