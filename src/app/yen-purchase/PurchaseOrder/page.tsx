"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '@/redux/store';
import { toWords } from 'number-to-words'; // Import the library
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description'; // CSV icon
import Image from 'next/image'; // Import the next/image component
import { Add as AddIcon, GetApp as GetAppIcon, Upload as UploadIcon } from '@mui/icons-material';
import FilterAltIcon from '@mui/icons-material/FilterAlt'; // Import the filter icon
import ClearIcon from "@mui/icons-material/Clear"; // Clear icon
import { usePermissions } from "@/hooks/usePermissions";
import {
  selectPurchaseListState, fetchImageByIndex,
  updateMultipleItemQuantities, approvePurchaseOrder, uploadPurchaseOrderPhotos, editPhotoByIndex,
  rejectPurchaseOrder, fetchPendingPurchaseOrders, clearSnackbarMessage, setPagination,
  selectCurrentPage,
  selectPageSize,
  selectTotalItems,
  resetPurchaseOrderState,
  fetchPurchaseOrderRandomIds,
  fetchAllImages,
  setOrderImageUrls
} from '../../../features/yen-purchase/PurchaseOrder/purchaseListSlice';
import {
  Box, Button, Typography, Table, TableContainer, TableHead, TableRow, TableCell, TableBody,
  TextField, Paper, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Tooltip,
  Input,
  Grid,
  Snackbar,
  Alert,
  DialogContentText,
  Menu,
  MenuItem,
  Popover,
  Chip,
  Autocomplete
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit'; // Added Edit icon
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import '../../../components/common.css';
import { Item, PurchaseRandomId, TaxDetails, Vendor } from '@/Models/purchaseModel';
import { ChevronLeft, ChevronRight, PhotoCamera } from '@mui/icons-material';
import YenPurchasePage from '../page';
import jsPDF from "jspdf";
import "jspdf-autotable"; // Ensure this is imported
import { PurchaseItemSearch, setSnackbarMessage, setSnackbarOpen } from '@/features/yen-purchase/PurchaseOrder/purchaseOrderSlice';
import { fetchBusinesses, fetchPhoto, selectBusinesses } from '@/features/account-setting/businessSlice';
import { format } from 'date-fns';
import Papa from 'papaparse';
import 'react-date-range/dist/styles.css'; // main style file
import 'react-date-range/dist/theme/default.css'; // theme css file
import DateRangeDialog from '@/components/dateRange';
import moment from 'moment';
import { POsearchPurchaseItems } from '@/features/yen-purchase/PurchaseMaster/purchaseItemSlice';
import VendorSearchAutocomplete from '../../../components/vendorsearchautocomplete';
import PurchaseOrderRandomIdSearch from '../../../components/yen-purchase/pendingpo/infiniteScroll';
import PhotoDisplay from '../../../components/yen-purchase/pendingpo/photoDisplay';
import { VendorSearch } from '@/Models/vendor';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import ItemSearchAutocomplete from './Component/ItemSearch';
// Add the TypeScript declaration for autoTable (if necessary)
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
const customRound = (value: number): number => {
  return Math.round(value); // Rounds to the nearest integer (e.g., 45.45 -> 45, 45.67 -> 46)
};
const customRounddigit = (value: number): number => {
  return Math.round(value * 2) / 2;
};
const Polist: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { hasPermission, permissions } = usePermissions();
  
  const isPendingModuleVisible =
    permissions?.yenerp?.purchaseorders_pending &&
    !(
      permissions?.yenerp?.purchaseorders_pending?.hide === true ||
      permissions?.yenerp?.purchaseorders_pending?.hide === 1
    );

  // READ hide values for PO modules
  const hidePending =
    permissions?.yenerp?.purchaseorders_pending?.hide === true;

  // CHECK PERMISSIONS
  const canAdd = hasPermission("yenerp", "purchaseorders_pending", "add");
  const canEdit = hasPermission("yenerp", "purchaseorders_pending", "edit");
  const canApprove = hasPermission(
    "yenerp",
    "purchaseorders_pending",
    "approve",
  );
  const canRead = hasPermission("yenerp", "purchaseorders_pending", "read");
  const canDelete = hasPermission("yenerp", "purchaseorders_pending", "delete");

  console.log("🔍 Purchase Order Permissions:", {
    canAdd,
    canEdit,
    canApprove,
    canRead,
    canDelete,
  });
  const { purchaseList,pendingPurchaseList, loading, error, randomIds, poRandomIds, snackbarMessage, snackbarOpen } = useSelector(selectPurchaseListState);
  const { businesses } = useSelector(selectBusinesses);
  const [selectedOrder, setSelectedOrderState] = useState<any | null>(null);
  const [updatedItems, setUpdatedItems] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [randomIdFilter, setRandomIdFilter] = useState('');
  const [files, setFiles] = useState<File[]>([]); // Use an array to store multiple files
  const [pendingOrderAmount, setPendingOrderAmount] = useState(selectedOrder ? selectedOrder.
    pendingOrderAmount : '');
  const [pendingDiscountAmount, setPendingDiscountAmount] = useState<number>(
    selectedOrder ? selectedOrder.pendingDiscountAmount || 0 : 0
  );
  const [pendingTaxAmount, setPendingTaxAmount] = useState<number>(0); // New state for total tax
  const [taxDetails, setTaxDetails] = useState<TaxDetails>({});
  const [openPhotoDialog, setOpenPhotoDialog] = useState(false); // State to control dialog
  const [openImageDialog, setOpenImageDialog] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [fetchedBusinessIds, setFetchedBusinessIds] = useState(new Set());
  const [statusFilter, setStatusFilter] = useState(['Pending for Approve', 'CreditLimit for Approve']);
  // const [file, setFile] = useState<File | null>(null);
  const [fetchedPurchaseOrderIds, setFetchedPurchaseOrderIds] = useState<Set<string>>(new Set());
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
  const [selectedVendor, setSelectedVendor] = useState<VendorSearch | null>(null);
  const [selectedVendorName, setSelectedVendorName] = useState('');
  const [selectedRandomId, setSelectedRandomId] = useState('');
  const [open, setOpen] = useState(false);
  const fromDate = moment().utc().startOf('day').toDate(); // Start of the day (in UTC)
  const toDate = moment().utc().endOf('day').toDate(); // End of the day (in UTC)
  const [newItem, setNewItem] = useState<PurchaseItemSearch | null>(null);
  const [newItemId, setNewItemId] = useState<string>('');
  const [searchQueryItem, setSearchQueryItem] = useState<string>('');
  const [skip, setSkip] = useState<number>(0);
  const [limit, setLimit] = useState<number>(50);
  const [allItems, setAllItems] = useState<PurchaseItemSearch[]>([]);
  const [selectedPORandomId, setSelectedPORandomId] = useState<PurchaseRandomId | null>(null);
  const { imageUrls } = useSelector(selectPurchaseListState);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);
  const [shouldFetch, setShouldFetch] = useState(true);
  const [touched, setTouched] = useState<Record<number, Record<string, boolean>>>({}); // Tracks touched fields by item index and field name
  const [errors, setErrors] = useState<Record<number, Record<string, string>>>({}); // Tracks errors by item index and field name
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [overallDiscount, setOverallDiscount] = useState<number>(0); // New state for overall discount
  // Add this after your useSelector line
console.log('Pending Purchase List:', pendingPurchaseList);
console.log('Loading:', loading);
console.log('Error:', error);
// Also check if the API call is being made
useEffect(() => {
  console.log('Fetching purchase orders...');
  if (shouldFetch && !loading) {
    const action = fetchPendingPurchaseOrders({
      page: newPage,
      size: pageSize,
    });
    dispatch(action);
    setShouldFetch(false);
  }
}, [dispatch, newPage, pageSize, shouldFetch, loading]);
  useEffect(() => {
    dispatch(fetchBusinesses());
  }, [dispatch]);
  useEffect(() => {
    dispatch(POsearchPurchaseItems({ searchQuery: searchQueryItem, skip, limit }))
  }, [dispatch, skip, limit, searchQueryItem]);
  useEffect(() => {
    if (businesses.length > 0 && businesses[0].businessId && !fetchedBusinessIds.has(businesses[0].businessId)) {
      dispatch(fetchPhoto(businesses[0].businessId));
      setFetchedBusinessIds((prev) => new Set(prev).add(businesses[0].businessId));
    }
  }, [businesses, dispatch, fetchedBusinessIds]);
  useEffect(() => {
    // Load initial data when component mounts
    dispatch(fetchPurchaseOrderRandomIds({ skip: 0, query: '' }));
    // Reset state when component unmounts
    return () => {
      dispatch(resetPurchaseOrderState());
    };
  }, [dispatch]);
  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };
  // To fetch a specific vendor by name
  useEffect(() => {
    if (selectedOrder) {
      setPendingOrderAmount(selectedOrder.pendingOrderAmount || '');
      setPendingDiscountAmount(selectedOrder.pendingDiscountAmount || '');
    }
  }, [selectedOrder]);
  useEffect(() => {
    if (updatedItems.length > 0) {
      const taxDetails: Record<string, { amount: number; percentage: number; type: string }> = {};
      let newTotalOrderAmount = 0;
      let totalDiscountBeforeTax = 0;
      let totalDiscountAfterTax = 0;
      updatedItems.forEach(item => {
        const totalPrice = (item.pendingTotalQuantity || 0) * (item.newPrice || 0);
        const discountAmountBeforeTax = (totalPrice * ((item.befTaxDiscount || 0) / 100)) || 0;
        const discountedPriceBeforeTax = totalPrice - discountAmountBeforeTax;
        const taxPercentage = item.taxPercentage || 0;
        const taxType = item.taxType || 'cgst_sgst';
        let sgst = 0, cgst = 0, igst = 0;
        if (taxType === 'igst') {
          igst = (taxPercentage / 100) * discountedPriceBeforeTax;
          igst = customRounddigit(igst);
          const igstKey = `igst-${taxPercentage}`;
          if (taxDetails[igstKey]) {
            taxDetails[igstKey].amount += igst;
          } else {
            taxDetails[igstKey] = {
              amount: igst,
              percentage: taxPercentage,
              type: 'IGST'
            };
          }
        } else if (taxType === 'cgst_sgst') {
          const totalTaxAmount = (taxPercentage / 100) * discountedPriceBeforeTax;
          sgst = totalTaxAmount / 2;
          cgst = totalTaxAmount / 2;
          sgst = customRounddigit(sgst);
          cgst = customRounddigit(cgst);
          const sgstKey = `sgst-${taxPercentage / 2}`;
          if (taxDetails[sgstKey]) {
            taxDetails[sgstKey].amount += sgst;
          } else {
            taxDetails[sgstKey] = {
              amount: sgst,
              percentage: taxPercentage / 2,
              type: 'SGST'
            };
          }
          const cgstKey = `cgst-${taxPercentage / 2}`;
          if (taxDetails[cgstKey]) {
            taxDetails[cgstKey].amount += cgst;
          } else {
            taxDetails[cgstKey] = {
              amount: cgst,
              percentage: taxPercentage / 2,
              type: 'CGST'
            };
          }
        }
        const finalPriceBeforeAfterTaxDiscount = discountedPriceBeforeTax + igst + sgst + cgst;
        const discountAmountAfterTax = (finalPriceBeforeAfterTaxDiscount * ((item.afTaxDiscount || 0) / 100)) || 0;
        const finalPriceAfterTaxDiscount = finalPriceBeforeAfterTaxDiscount - discountAmountAfterTax;
        newTotalOrderAmount += finalPriceAfterTaxDiscount;
        totalDiscountBeforeTax += discountAmountBeforeTax;
        totalDiscountAfterTax += discountAmountAfterTax;
        // Update item with calculated final price
        item.pendingFinalPrice = finalPriceAfterTaxDiscount;
      });
      // Apply overall discount
      const totalItemWiseDiscount = totalDiscountBeforeTax + totalDiscountAfterTax;
      const totalDiscount = totalItemWiseDiscount + (overallDiscount || 0);
      // ADD FREIGHT CHARGES AND TAX TO FINAL AMOUNT
      const freightCharges = selectedOrder?.totalFreightAmount || 0;
      const freightTax = selectedOrder?.totalFreightTaxAmount || 0;
      const finalOrderAmount = newTotalOrderAmount - (overallDiscount || 0) + freightCharges + freightTax;
      setPendingOrderAmount(customRound(finalOrderAmount));
      setPendingDiscountAmount(customRounddigit(totalDiscount));
      setTaxDetails(taxDetails);
      const totalTaxAmount = Object.values(taxDetails).reduce((acc, tax) => acc + (tax.amount || 0), 0);
      setPendingTaxAmount(customRounddigit(totalTaxAmount));
    } else {
      setPendingOrderAmount(0);
      setPendingDiscountAmount(0);
      setPendingTaxAmount(0);
      setOverallDiscount(0);
      setTaxDetails({});
    }
  }, [updatedItems, overallDiscount, selectedOrder]); // Added selectedOrder to dependencies
  const handleClose = () => {
    setDialogSummaryOpen(false);
  };
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget as HTMLElement); // Cast event.currentTarget to HTMLElement
  };
  const handleCloseAnchor = () => {
    setAnchorEl(null); // Close the dropdown menu
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
  const handleRandomIdChange = (randomId: string) => {
    setSelectedRandomId(randomId);
  };
  const filteredOrders = purchaseList.filter(
    (order) =>
      (order.poStatus === "CreditLimit for Approve" ||
        order.poStatus === "Pending for Approve" ||
        (order.poStatus !== "Approved" && order.poStatus !== "Rejected")) &&
      order.items.some((item) => item.pendingTotalQuantity > 0),
  );
  // Removed client-side filteredOrders since backend hardcodes pending
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > Math.ceil(totalItems / pageSize)) {
      return;
    }
    // Use either the selected range if available or default date range
    const appliedFromDate = selectionRange?.startDate instanceof Date ? moment(selectionRange.startDate).startOf('day').toDate() : fromDate;
    const appliedToDate = selectionRange?.endDate instanceof Date ? moment(selectionRange.endDate).endOf('day').toDate() : toDate;
    // Dispatch pagination with the current filters or default date range
    dispatch(setPagination({ page: newPage, size: pageSize }));
    // Fetch the purchase orders with correct date range and filters (no status or filterBy)
    dispatch(fetchPendingPurchaseOrders({
      page: newPage,
      size: pageSize,
      vendorName: selectedVendorName || '',
      itemName: searchQueryItem || '',
      randomId: randomIdFilter // This will now work correctly
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
  const handleCloseSnackbar = () => {
    dispatch(setSnackbarOpen(false)); // Close snackbar when user dismisses
  };
  useEffect(() => {
    (pendingPurchaseList || []).forEach(order => {
      const orderId = order.purchaseOrderId;
      // Only fetch if we haven't already fetched images for this order
      if (!fetchedPurchaseOrderIds.has(orderId)) {
        // Fetch all images for this purchase order
        dispatch(fetchAllImages(orderId))
          .unwrap()
          .then(() => {
            // Mark this order as fetched
            setFetchedPurchaseOrderIds(prev => new Set(prev).add(orderId));
          })
          .catch((error: any) => {
            console.error('Failed to fetch images for order:', orderId, error);
          });
      }
    });
  }, [pendingPurchaseList, dispatch, fetchedPurchaseOrderIds]);
  // Alternative: If you want to fetch images one by one with indices
  useEffect(() => {
    (pendingPurchaseList || []).forEach(order => {
      const orderId = order.purchaseOrderId;
      // Check if we've already fetched images for this order
      if (!fetchedPurchaseOrderIds.has(orderId)) {
        // Fetch up to 3 images (indices 0, 1, 2)
        [1, 2, 3].forEach(index => {
          dispatch(fetchImageByIndex({ purchaseOrderId: orderId, index }))
            .unwrap()
            .catch(error => {
              console.error(`Failed to fetch image ${index} for order ${orderId}:`, error);
            });
        });
        // Mark this order as fetched
        setFetchedPurchaseOrderIds(prev => new Set(prev).add(orderId));
      }
    });
  }, [pendingPurchaseList, dispatch, fetchedPurchaseOrderIds]);
  // In your file input change handler:
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, orderId: string, displayIndex: number) => {
    const file = e.target.files?.[0];
    if (!file || !orderId) return;
    try {
      const backendIndex = displayIndex; // 1-based for backend
      const frontendIndex = displayIndex - 1; // 0-based for frontend state
      // Prepare form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('index', backendIndex.toString());
      // Determine if we're replacing an existing image
      const isReplacing = imageUrls[orderId]?.[frontendIndex];
      let action;
      if (isReplacing) {
        action = dispatch(editPhotoByIndex({
          purchaseOrderId: orderId,
          index: backendIndex,
          file: file
        }));
      } else {
        action = dispatch(uploadPurchaseOrderPhotos({
          purchaseOrderId: orderId,
          files: [file],
          index: backendIndex
        }));
      }
      await action.unwrap();
      // Create a separate copy of the current imageUrls for this order
      const currentOrderUrls = [...(imageUrls[orderId] || [])];
      // Update only the specific index in our local state
      currentOrderUrls[frontendIndex] = URL.createObjectURL(file);
      // Update the state with the new URL array
      dispatch(setOrderImageUrls({
        orderId,
        urls: currentOrderUrls
      }));
      // Now fetch from the server to update with real URL
      dispatch(fetchImageByIndex({
        purchaseOrderId: orderId,
        index: frontendIndex // 0-based for frontend
      }));
      // Show success message
      dispatch(setSnackbarMessage('Photo uploaded successfully!'));
      dispatch(setSnackbarOpen(true));
    } catch (error) {
      console.error('Upload failed:', error);
      dispatch(setSnackbarMessage('Failed to upload photo'));
      dispatch(setSnackbarOpen(true));
    } finally {
      // Reset file input
      if (e.target) e.target.value = '';
    }
  };
  // Handle Upload function to be explicit about index conversion
  const handleUpload = async () => {
    if (!files.length || !selectedOrderId || selectedImageIndex === null) return;
    try {
      // selectedImageIndex is already 0-based from our state
      const backendIndex = selectedImageIndex + 1; // Convert to 1-based for backend
      const frontendIndex = selectedImageIndex; // Keep 0-based for frontend
      if (imageUrls[selectedOrderId]?.[frontendIndex]) {
        // Editing existing photo
        await dispatch(editPhotoByIndex({
          purchaseOrderId: selectedOrderId,
          index: backendIndex, // Pass 1-based to backend
          file: files[0]
        })).unwrap();
      } else {
        // Uploading new photo
        await dispatch(uploadPurchaseOrderPhotos({
          purchaseOrderId: selectedOrderId,
          files,
          index: backendIndex // Pass 1-based to backend
        })).unwrap();
      }
      // Create temporary local URL for immediate UI update
      const tempUrl = URL.createObjectURL(files[0]);
      // Create a copy of current URLs and update only the specific index
      const currentUrls = [...(imageUrls[selectedOrderId] || [])];
      currentUrls[frontendIndex] = tempUrl;
      // Update state with specific index only
      dispatch(setOrderImageUrls({
        orderId: selectedOrderId,
        urls: currentUrls
      }));
      // Then refresh from server
      await dispatch(fetchImageByIndex({
        purchaseOrderId: selectedOrderId,
        index: frontendIndex // Pass 0-based for frontend
      })).unwrap();
    } catch (error) {
      console.error('Upload failed', error);
    } finally {
      setFiles([]);
      setSelectedOrderId(null);
      setSelectedImageIndex(null);
      setOpenPhotoDialog(false);
    }
  };
  const handleConfirmUpload = () => {
    handleUpload(); // Call the upload function
    setOpenPhotoDialog(false); // Close the dialog
  };
  const handleViewDetailsClick = (orderId: string) => {
    const selectedOrder = (pendingPurchaseList || []).find(order => order.purchaseOrderId === orderId);
    if (selectedOrder) {
      // FIXED: Removed the filter to show ALL items, even if pendingTotalQuantity <= 0
      // This ensures items appear in the UI regardless of quantity
      const filteredItems = selectedOrder.items || []; // No filtering by quantity > 0
      console.log('Filtered Items (All):', filteredItems); // Debug log to verify items are loaded
      setSelectedOrderState({ ...selectedOrder, items: filteredItems });
      setUpdatedItems(filteredItems.map(item => ({
        ...item,
        pendingCount: item.pendingCount || 0,
        pendingQuantity: item.pendingQuantity || 0,
        pendingTotalQuantity: item.pendingTotalQuantity || 0,
        newPrice: item.newPrice || 0,
        pendingTotalPrice: item.pendingTotalPrice || 0,
        pendingFinalPrice: item.pendingFinalPrice || 0,
        befTaxDiscount: item.befTaxDiscount || 0,
        afTaxDiscount: item.afTaxDiscount || 0,
        taxPercentage: item.taxPercentage || 0,
        pendingSgst: item.pendingSgst || 0,
        pendingCgst: item.pendingCgst || 0,
        pendingIgst: item.pendingIgst || 0,
        pendingBefTaxDiscountAmount: item.pendingBefTaxDiscountAmount || 0,
        pendingAfTaxDiscountAmount: item.pendingAfTaxDiscountAmount || 0,
        pendingTaxAmount: item.pendingTaxAmount || 0,
      })));
      console.log('Updated Items:', filteredItems.map(item => ({ ...item, pendingTotalQuantity: item.pendingTotalQuantity }))); // Debug log
      setOverallDiscount(selectedOrder.discountPrice || 0); // Initialize overall discount
      const initialTouched = filteredItems.reduce((acc, _, index) => ({
        ...acc,
        [index]: { pendingCount: false, pendingQuantity: false, newPrice: false }
      }), {});
      const initialErrors = filteredItems.reduce((acc, _, index) => ({
        ...acc,
        [index]: { pendingCount: '', pendingQuantity: '', newPrice: '' }
      }), {});
      setTouched(initialTouched);
      setErrors(initialErrors);
      setDialogOpen(true);
    } else {
      console.error('Selected order not found:', orderId); // Debug if order is missing
    }
  };
  const handleEditClick = (orderId: string) => {
    router.push(`/yen-purchase/PurchaseOrder/Createpurchase?edit=${orderId}`);
  };
  const handleOpen = () => {
    setDialogSummaryOpen(true);
  };
  const handleApproveDialogOpen = () => {
    setApproveOpen(true);
  };
  const handleApproveDialogClose = () => {
    setApproveOpen(false);
    setSelectedOrderId(null);
  };
  const handleDialogClose = () => {
    setDialogOpen(false);
  };
  const handleRejectDialogOpen = () => {
    setRejectOpen(true);
  };
  const handleRejectDialogClose = () => {
    setRejectOpen(false);
    setSelectedOrderId(null);
  };
  const handleInputChange = (index: number, field: string, value: string | number) => {
    console.log(`Updating item at index ${index}: ${field} = ${value}`);
    setTouched(prev => ({
      ...prev,
      [index]: { ...prev[index], [field]: true }
    }));
    // Validate input
    let errorMessage = '';
    if (value === '') {
      errorMessage = `required`;
    } else if (!/^\d*\.?\d*$/.test(String(value))) {
      errorMessage = 'Invalid number';
    }
    setErrors(prev => ({
      ...prev,
      [index]: { ...prev[index], [field]: errorMessage }
    }));
    setUpdatedItems((prevItems) => {
      const newItems = prevItems.map((item, i) => {
        if (i === index) {
          const updatedItem = { ...item };
          // Update the specific field based on the input field
          if (field === 'pendingCount') {
            updatedItem.pendingCount = value;
          } else if (field === 'pendingQuantity') {
            updatedItem.pendingQuantity = value;
          } else if (field === 'newPrice') {
            updatedItem.newPrice = value;
          } else {
            console.warn(`Unknown field: ${field}`);
            return item;
          }
          // Convert values for calculations (empty string to 0)
          const count = updatedItem.pendingCount === '' ? 0 : Number(updatedItem.pendingCount);
          const quantity = updatedItem.pendingQuantity === '' ? 0 : Number(updatedItem.pendingQuantity);
          const price = updatedItem.newPrice === '' ? 0 : Number(updatedItem.newPrice);
          // Calculate pending total quantity
          updatedItem.pendingTotalQuantity = count * quantity;
          console.log(`Updated pendingTotalQuantity for item ${item.itemId}: ${updatedItem.pendingTotalQuantity}`);
          // Explicitly update poQuantity
          updatedItem.poQuantity = updatedItem.pendingTotalQuantity;
          console.log(`Updated poQuantity for item ${item.itemId}: ${updatedItem.poQuantity}`);
          // Calculate total price
          updatedItem.pendingTotalPrice = updatedItem.pendingTotalQuantity * price;
          // Calculate discounts and tax
          const discountBeforeTax = updatedItem.pendingTotalPrice * (updatedItem.befTaxDiscount / 100);
          const priceAfterBefTaxDiscount = updatedItem.pendingTotalPrice - discountBeforeTax;
          const taxAmount = priceAfterBefTaxDiscount * (updatedItem.taxPercentage / 100);
          const sgst = updatedItem.taxType === 'cgst_sgst' ? taxAmount / 2 : 0;
          const cgst = updatedItem.taxType === 'cgst_sgst' ? taxAmount / 2 : 0;
          const igst = updatedItem.taxType === 'igst' ? taxAmount : 0;
          const finalPriceBeforeAfterTaxDiscount = priceAfterBefTaxDiscount + taxAmount;
          const discountAfterTax = finalPriceBeforeAfterTaxDiscount * (updatedItem.afTaxDiscount / 100);
          const finalPriceAfterTaxDiscount = finalPriceBeforeAfterTaxDiscount - discountAfterTax;
          updatedItem.pendingBefTaxDiscountAmount = discountBeforeTax;
          updatedItem.pendingAfTaxDiscountAmount = discountAfterTax;
          updatedItem.pendingTaxAmount = taxAmount;
          updatedItem.pendingSgst = sgst;
          updatedItem.pendingCgst = cgst;
          updatedItem.pendingIgst = igst;
          updatedItem.pendingFinalPrice = finalPriceAfterTaxDiscount;
          console.log(`Updated item ${item.itemId}:`, updatedItem);
          return updatedItem;
        }
        return item;
      });
      console.log('New items array:', newItems);
      return newItems;
    });
  };
  const generatePDF = () => {
    const doc = new jsPDF();
    let yOffset = 7; // Starting y-offset for content
    let pageCount = 1; // Track current page for footer
    const business = businesses.length > 0 ? businesses[0] : null;
    if (!business) {
      console.error('Business info not found!');
      return;
    }
    // Function to add page number footer and computer generated text
    const addPageFooter = (currentPage: number, totalPages: number) => {
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      // Center the page number
      const pageText = `Page ${currentPage} of ${totalPages}`;
      const pageTextWidth = doc.getStringUnitWidth(pageText) * doc.getFontSize() / doc.internal.scaleFactor;
      const pageX = (pageWidth - pageTextWidth) / 2;
      doc.text(pageText, pageX, pageHeight - 10);
      // Add "This is computer generated" centered below the page number
      const generatedText = 'This is computer generated';
      const generatedTextWidth = doc.getStringUnitWidth(generatedText) * doc.getFontSize() / doc.internal.scaleFactor;
      const generatedX = (pageWidth - generatedTextWidth) / 2;
      doc.text(generatedText, generatedX, pageHeight - 5);
    };
    // Add business image on the left side
    if (business.imageUrl) {
      doc.addImage(business.imageUrl, 'JPEG', 14, yOffset, 20, 20); // Adjust image size and position
    }
    yOffset += 7; // Move down after image to create space for the title
    // Add "Purchase Order Summary" title at the top
    doc.setFontSize(12); // Title font size
    const title = "Purchase Order Summary";
    const pageWidth = doc.internal.pageSize.width; // Get page width directly
    const fontSize = doc.getFontSize(); // Access font size
    const titleWidth = doc.getStringUnitWidth(title) * fontSize / doc.internal.scaleFactor;
    const titleX = (pageWidth - titleWidth) / 2;
    doc.text(title, titleX, yOffset); // Centered title
    doc.line(titleX, yOffset + 2, titleX + titleWidth, yOffset + 2); // Draw the underline
    yOffset += 13; // Move yOffset down after the title
    // Calculate the total ordered amount
    const totalOrderedAmount = (pendingPurchaseList || []).reduce((sum, order) => {
      const pendingOrderAmount = order.pendingOrderAmount || 0;
      return sum + pendingOrderAmount;
    }, 0);
    // Format the current date
    const today = new Date();
    const currentDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
    // Display "Total Ordered Amount" and "Date" on the same row with proper alignment
    doc.setFontSize(10); // Smaller font size for these details
    const totalText = `Total Ordered Amount: ${totalOrderedAmount.toFixed(2)}`;
    const dateText = `Date: ${currentDate}`;
    // Calculate widths for proper alignment
    const totalWidth = doc.getStringUnitWidth(totalText) * 10 / doc.internal.scaleFactor;
    const dateWidth = doc.getStringUnitWidth(dateText) * 10 / doc.internal.scaleFactor;
    // Position the texts
    doc.text(totalText, 14, yOffset); // Total on the left
    doc.text(dateText, pageWidth - dateWidth - 14, yOffset); // Date on the right
    yOffset += 5; // Add space before table for better readability
    // Table headers for summary data (added S.No)
    const headers = [["S.No", "PoId", "Vendor Name", "Total Items", "Ordered Date", "Total Order Amount"]];
    // Prepare rows for purchase order summary (filter only valid orders and add S.No)
    const rows = (pendingPurchaseList || []).map((order, index) => {
      const totalItemsQuantity = Array.isArray(order.items) && order.items.length > 0
        ? order.items.reduce((sum, item) => sum + (item.pendingTotalQuantity || 0), 0)
        : 0;
      const pendingOrderAmount = order.pendingOrderAmount || 0;
      const pendingDiscountAmount = order.pendingDiscountAmount || 0;
      const finalAmount = pendingOrderAmount - pendingDiscountAmount;
      if (!order.randomId || !order.vendorName || !order.orderDate || pendingOrderAmount <= 0) {
        return null;
      }
      return [
        (index + 1).toString(), // S.No
        order.randomId.toString(),
        order.vendorName.toString(),
        totalItemsQuantity.toString(),
        order.orderDate ? format(new Date(order.orderDate), 'dd-MM-yyyy') : '',
        finalAmount.toFixed(2).toString(),
      ];
    }).filter(row => row !== null);
    // Add the table to the PDF with custom styles and proper column alignment
    doc.autoTable({
      head: headers,
      body: rows,
      startY: yOffset, // Start the table below the "Total Ordered Amount"
      styles: {
        fillColor: [255, 255, 255], // White background
        textColor: [0, 0, 0], // Black text color
        lineColor: [0, 0, 0], // Black table borders
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [0, 0, 128], // DodgerBlue background for the header
        textColor: [255, 255, 255], // White text color for header
        fontSize: 8,
        halign: 'center', // Center-align header text
      },
      bodyStyles: {
        fillColor: [255, 255, 255], // White background for rows
        textColor: [0, 0, 0], // Black text color for rows
      },
      columnStyles: {
        0: { cellWidth: 17, halign: 'center' }, // S.No - narrow and centered
        1: { cellWidth: 28, halign: 'center' }, // PoId
        2: { cellWidth: 46, halign: 'center' }, // Vendor Name
        3: { cellWidth: 28, halign: 'right' }, // Total Items - centered
        4: { cellWidth: 28, halign: 'center' }, // Ordered Date - centered
        5: { cellWidth: 35, halign: 'right' }, // Total Order Amount - right-aligned
      },
      margin: { left: 14, right: 14 },
      tableWidth: 182, // Explicitly set table width to available space (210mm - 14mm left - 14mm right)
      didDrawPage: (data: AutoTableHookData) => {
        // Add page footer after each page is drawn
        addPageFooter(pageCount++, doc.getNumberOfPages());
      },
    });
    // Update page numbers after all content is added
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addPageFooter(i, totalPages);
    }
    // Save the PDF with a dynamic name
    const pdfFilename = `PoPendingVendorwise.pdf`;
    doc.save(pdfFilename);
    setDialogDownloadOpen(false);
  };
  const handleExportCSV = (): void => {
    const csvContent = generateCSVContent();
    downloadCSV(csvContent, 'PoPendingVendorwise.csv'); // Name your CSV file
  };
  const generateCSVContent = (): string => {
    // Define the headers for the CSV
    const headers = 'SNO,PoId,Vendor Name,Total Items,Ordered Date,Total Order Amount\n';
    // Prepare the rows for purchase order summary (filter only valid orders)
    const rows = (pendingPurchaseList || []).map((order, index) => {
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
        (index + 1),
        order.randomId,
        order.vendorName,
        totalItemsQuantity,
        order.orderDate ? format(new Date(order.orderDate), 'dd-MM-yyyy') : '',
        finalAmount.toFixed(2)
      ].join(','); // Join each value with a comma to create a CSV row
    }).filter(row => row !== null).join('\n'); // Filter out null rows and join with newline
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
  const handleSaveChanges = () => {
    setConfirmDialogOpen(true); // Open confirmation dialog
  };
  const generateSummaryPDF = () => {
    const doc = new jsPDF();
    let yOffset = 10; // Starting y-offset for content
    let pageCount = 1; // Track current page for footer
    const business = businesses.length > 0 ? businesses[0] : null;
    if (!business) {
      console.error('Business info not found!');
      return;
    }
    // Function to add page number footer and computer generated text
    const addPageFooter = (currentPage: number, totalPages: number) => {
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      // Center the page number
      const pageText = `Page ${currentPage} of ${totalPages}`;
      const pageTextWidth = doc.getStringUnitWidth(pageText) * doc.getFontSize() / doc.internal.scaleFactor;
      const pageX = (pageWidth - pageTextWidth) / 2;
      doc.text(pageText, pageX, pageHeight - 10);
      // Add "This is computer generated" centered below the page number
      const generatedText = 'This is computer generated';
      const generatedTextWidth = doc.getStringUnitWidth(generatedText) * doc.getFontSize() / doc.internal.scaleFactor;
      const generatedX = (pageWidth - generatedTextWidth) / 2;
      doc.text(generatedText, generatedX, pageHeight - 5);
    };
    // Add business image on the left side
    if (business.imageUrl) {
      doc.addImage(business.imageUrl, 'JPEG', 14, yOffset, 20, 20); // Adjust image size and position
    }
    yOffset += 10; // Move down after image to create space for the title
    // Add "Purchase Order Detailed Summary" title at the top
    doc.setFontSize(12); // Title font size
    const title = "Purchase Order Detailed Summary";
    const pageWidth = doc.internal.pageSize.width; // Get page width directly
    const fontSize = doc.getFontSize(); // Access font size
    const titleWidth = doc.getStringUnitWidth(title) * fontSize / doc.internal.scaleFactor;
    const titleX = (pageWidth - titleWidth) / 2;
    doc.text(title, titleX, yOffset); // Centered title
    doc.setLineWidth(0.1); // Set line width for the underline
    doc.line(titleX, yOffset + 2, titleX + titleWidth, yOffset + 2); // Draw the underline
    yOffset += 15; // Move yOffset down after the title
    // Calculate the total ordered amount
    const totalOrderedAmount = (pendingPurchaseList || []).reduce((sum, order) => {
      const pendingOrderAmount = order.pendingOrderAmount || 0;
      return sum + pendingOrderAmount;
    }, 0);
    // Format the current date
    const today = new Date();
    const currentDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
    // Display "Total Ordered Amount" and "Date" on the same row
    doc.setFontSize(10); // Smaller font size for these details
    const totalText = `Total Ordered Amount: ${totalOrderedAmount.toFixed(2)}`;
    const dateText = `Date: ${currentDate}`;
    // Calculate widths for proper alignment
    const dateWidth = doc.getStringUnitWidth(dateText) * 10 / doc.internal.scaleFactor;
    doc.text(totalText, 14, yOffset); // Total on the left
    doc.text(dateText, pageWidth - dateWidth - 14, yOffset); // Date on the right
    yOffset += 5; // Add space before table for better readability
    // Table headers for purchase items
    const headers = [
      ["S.No", "Purchase Order No", "Vendor Name", "Item Name", "Quantity", "Price", "Tax", "Discount", "Final Price"],
    ];
    // Safely handle pendingPurchaseList being null or undefined
    const rows = (pendingPurchaseList || []).map((order, index) => {
      return (order.items || []).map((item: Item) => [
        (index + 1).toString(), // S.No
        order.randomId, // Purchase order number
        order.vendorName, // Vendor name
        item.itemName, // Item name
        item.pendingTotalQuantity, // Quantity
        item.pendingTotalPrice, // Price
        `${item.taxPercentage}%`, // Tax percentage
        item.discountAmount, // Discount
        item.pendingFinalPrice?.toFixed(2), // Final price
      ]);
    }).flat(); // Flatten the array to a single-level array of rows
    // Add the table to the PDF with custom styles
    doc.autoTable({
      head: headers,
      body: rows,
      startY: yOffset, // Start the table below the "Date"
      styles: {
        fillColor: [255, 255, 255], // White background (corrected from DodgerBlue)
        textColor: [0, 0, 0], // Black text color
        lineColor: [0, 0, 0], // Black table borders
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [0, 0, 128], // DodgerBlue background for the header
        textColor: [255, 255, 255], // White text color for header
        fontSize: 8,
        halign: 'center', // Center-align header text
      },
      bodyStyles: {
        fillColor: [255, 255, 255], // White background for rows
        textColor: [0, 0, 0], // Black text color for rows
      },
      columnStyles: {
        4: { halign: 'center' }, // Center-align "Quantity"
        5: { halign: 'center' }, // Center-align "Price"
      },
      didDrawPage: (data: AutoTableHookData) => {
        // Add page footer after each page is drawn
        addPageFooter(pageCount++, doc.getNumberOfPages());
      },
    });
    // Update page numbers after all content is added
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addPageFooter(i, totalPages);
    }
    // Save the PDF with a dynamic name
    const pdfFilename = `POPendingItemwise.pdf`;
    doc.save(pdfFilename);
    handleClose();
  };
  const generateSummaryCSV = () => {
    const headers = ["S.No", "Purchase Order No", "Vendor Name", "Item Name", "Quantity", "Price", "Tax", "Discount", "Final Price"];
    const rows = (pendingPurchaseList || []).map((order, index) => {
      return (order.items || []).map((item) => [
        (index + 1),
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
    const csvData = [headers, ...rows]; // Combine headers and rows
    // Use PapaParse to convert array to CSV string and trigger download
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "POPendingItemwise.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    handleClose();
  };
  const handleItemChange = (item: PurchaseItemSearch | null) => {
    setNewItem(item);
    setSearchQueryItem(item ? item.itemName : ''); // Update the search query with the item name
  };
  const handleConfirmSave = () => {
     if (!canEdit) return; 
    if (updatedItems.length > 0) {
      console.log('Updated Items:', updatedItems);
      if (!selectedOrder?.purchaseOrderId) {
        console.error('No purchase order selected.');
        dispatch(setSnackbarMessage('No purchase order selected.'));
        dispatch(setSnackbarOpen(true));
        return;
      }
      // Check for validation errors
      const hasErrors = updatedItems.some((item, index) =>
        errors[index]?.pendingCount || errors[index]?.pendingQuantity || errors[index]?.newPrice
      );
      if (hasErrors) {
        dispatch(setSnackbarMessage('Please fix all validation errors before saving.'));
        dispatch(setSnackbarOpen(true));
        return;
      }
      // Sanitize items by converting empty strings to 0
      const items = updatedItems.map(item => ({
        itemId: item.itemId,
        updatedItem: {
          newPrice: item.newPrice === '' ? 0 : Number(item.newPrice),
          discount: item.discount ?? null,
          pendingCount: item.pendingCount === '' ? 0 : Number(item.pendingCount),
          pendingQuantity: item.pendingQuantity === '' ? 0 : Number(item.pendingQuantity),
          pendingTotalQuantity: item.pendingTotalQuantity ?? null,
          poQuantity: item.pendingTotalQuantity, // Use pendingTotalQuantity
          taxPercentage: item.taxPercentage ?? null,
          pendingSgst: item.pendingSgst ?? null,
          pendingCgst: item.pendingCgst ?? null,
          pendingIgst: item.pendingIgst ?? null,
          befTaxDiscount: item.befTaxDiscount ?? null,
          afTaxDiscount: item.afTaxDiscount ?? null,
          pendingTotalPrice: item.pendingTotalPrice ?? null,
          pendingFinalPrice: item.pendingFinalPrice ?? null,
          pendingDiscountAmount: item.pendingDiscountAmount ?? null,
          pendingTaxAmount: item.pendingTaxAmount ?? null,
          taxType: item.taxType ?? null,
          pendingBefTaxDiscountAmount: item.pendingBefTaxDiscountAmount ?? null,
          pendingAfTaxDiscountAmount: item.pendingAfTaxDiscountAmount ?? null,
        }
      }));
      console.log('Payload:', { items });
      // Include freight amounts in the payload if needed
      const payload = {
        items,
        freightCharges: selectedOrder?.totalFreightAmount || 0,
        freightTax: selectedOrder?.totalFreightTaxAmount || 0
      };
      // Dispatch to update items
      dispatch(updateMultipleItemQuantities({
        purchaseOrderId: selectedOrder.purchaseOrderId,
        updatedItems: items
      }))
        .then(response => {
          console.log('Response:', response);
          dispatch(setSnackbarMessage('Changes saved successfully!'));
          dispatch(setSnackbarOpen(true));
          // Re-fetch the updated purchase orders to refresh the UI
          dispatch(fetchPendingPurchaseOrders({ page: newPage, size: pageSize }));
        })
        .catch(error => {
          console.error('Failed to save changes:', error);
          dispatch(setSnackbarMessage('Failed to save changes. Please try again.'));
          dispatch(setSnackbarOpen(true));
        });
    } else {
      dispatch(setSnackbarMessage('No items to save.'));
      dispatch(setSnackbarOpen(true));
    }
    setConfirmDialogOpen(false);
    setDialogOpen(false);
  };
  const handleFilterClick = () => {
    // Prepare API parameters
    const apiParams: any = {
      page: 1,
      size: pageSize,
      vendorName: selectedVendorName || '',
      itemName: searchQueryItem || '',
      randomId: selectedRandomId || '',
    };
    // Send dates as ISO string (date portion only)
    if (selectionRange?.startDate) {
      const startDate = new Date(selectionRange.startDate);
      apiParams.fromDate = startDate.toISOString().split('T')[0]; // "2025-11-12"
    }
    if (selectionRange?.endDate) {
      const endDate = new Date(selectionRange.endDate);
      apiParams.toDate = endDate.toISOString().split('T')[0]; // "2025-11-15"
    }
    console.log('API Filter Parameters:', apiParams);
    // Make single API call with all filters
    dispatch(fetchPendingPurchaseOrders(apiParams))
      .then(response => {
        const data = response.payload || [];
        if (data.length === 0) {
          console.log('No matching orders found.');
          setSnackbarMessage('No matching orders found.');
          setSnackbarOpen(true);
        }
        // Handle the filtered data from API
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
      startDate: new Date(), // Set to current date
      endDate: new Date(), // Set to current date
      key: 'selection', // Retain the key
    });
    setSelectedVendor(null); // Clear vendor selection
    setNewItem(null); // Clear item search query
    setSelectedRandomId(''); // Clear randomId
    setStatusFilter([]); // Clear all selected statuses
    dispatch(fetchPendingPurchaseOrders({
      page: 1, size: pageSize
    }));
  }
  const handleRejectOrder = async (orderId: string) => {
     if (!canApprove) return; 
    const selectedOrder = (pendingPurchaseList || []).find(order => order.purchaseOrderId === orderId);
    if (selectedOrder) {
      try {
        await dispatch(rejectPurchaseOrder(selectedOrder.purchaseOrderId));
        dispatch(fetchPendingPurchaseOrders({
          page: newPage, size: pageSize
        }));
      } catch (error) {
        console.error('Failed to update order status:', error);
      }
      setRejectOpen(false);
    }
  };
 const handleApproveOrder = async (orderId: string, sendWhatsapp: boolean) => {
   if (!canApprove) return; 
  const selectedOrder = (pendingPurchaseList || []).find(
    (order) => order.purchaseOrderId === orderId
  );

  if (!selectedOrder) return;

  try {
    console.log(
      `Approving PO: ${selectedOrder.randomId || orderId} | Send WhatsApp: ${sendWhatsapp}`
    );

    setApproveOpen(false);

    // Pass the flag to the thunk
    const result = await dispatch(
      approvePurchaseOrder({ purchaseOrderId: orderId})
    ).unwrap();

    // Success feedback
    let message = "✅ Purchase Order Approved!";

    if (sendWhatsapp) {
      if (result.whatsapp_sent) {
        message += `\n📧 WhatsApp sent to vendor\n📎 PDF: ${result.pdf_url || 'Generated'}`;
      } else if (result.pdf_url) {
        message += `\n📎 PDF generated\n⚠️ WhatsApp failed (check vendor phone)`;
      } else {
        message += `\n⚠️ WhatsApp & PDF failed`;
      }
    } else {
      if (result.pdf_url) {
        message += `\n📎 PDF generated (not sent)`;
      }
    }

    setSnackbarMessage(message);
    dispatch(fetchPendingPurchaseOrders({ page: newPage, size: pageSize }));
  } catch (error: any) {
    console.error("Failed to approve:", error);
    setSnackbarMessage(
      `❌ Error: ${error.message || "Failed to approve purchase order"}`
    );
  }
};

if (!isPendingModuleVisible) {
  return <Alert severity="error">Module Access Denied</Alert>;
}

if (!canRead) {
  return <Alert severity="error">No Read Permission</Alert>;
}

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
            <Link href="/yen-purchase/PurchaseOrder" passHref>
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
            <Link href="/yen-purchase/PurchaseOrder/Approvedpo" passHref>
              <Button variant="contained" sx={{ marginLeft: '10px' }} color="primary">
                Approved
              </Button>
            </Link>
            <Button
              variant="contained"
              color="primary"
              sx={{ marginLeft: '10px', marginRight: '10px' }}
              onClick={() => router.push('/yen-purchase/PurchaseOrder/RejectedPo')}
            >
              Rejected
            </Button>
            {/* <Grid container justifyContent="flex-end">
              <Grid item>
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
                    maxWidth: '600px', // Limit width for better message box look
                    whiteSpace: 'normal', // Allows the text to wrap into multiple lines
                    fontWeight: 'bold' // Use 'fontWeight' instead of 'fontStyle' for bold text
                  }}
                >
                  Description:<br />
                  Create PO. All the purchase orders that are currently Pending processing.
                  You can Approve or Reject them here.
                </Typography>
              </Grid>
            </Grid> */}
          </Grid>
        </Grid>
        <Grid
          container
          spacing={1}
          alignItems="center"
          justifyContent="flex-start"
          wrap="nowrap"
          sx={{
            display: 'inline-flex', // Ensure single row with intrinsic width
            minWidth: '100%', // Force content to exceed viewport on small screens
          }}
        >
          {/* Date Range Dialog */}
          <Grid item xs="auto">
            <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <DateRangeDialog
                selectionRange={selectionRange}
                setSelectionRange={setSelectionRange}
                onApply={handleFilterClick}
              />
            </Box>
          </Grid>
          {/* Vendor Search */}
          <Grid item xs={6} sm={4} md={2}>
            <VendorSearchAutocomplete
              value={selectedVendor}
              onChange={handleVendorChange}
              label="All Vendors"
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <ItemSearchAutocomplete
              value={newItem}
              onChange={handleItemChange}
              label="All Items"
              limit={50}
            />
          </Grid>
          {/* PO ID Search */}
          <Grid item xs={6} sm={4} md={1}>
            <PurchaseOrderRandomIdSearch
              value={selectedRandomId}
              onChange={handleRandomIdChange}
              label="PO ID"
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
          {/* Spacer to Push Create PO and Download to the End */}
          <Grid item xs sx={{ flexGrow: 1 }} />
          {/* Create PO Button */}
          <Grid item xs="auto">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <IconButton
                className="icon-button-outline"
                color="primary"
                size="small"
                onClick={() =>
                  canAdd &&
                  router.push("/yen-purchase/PurchaseOrder/Createpurchase")
                }
                disabled={!canAdd}
                sx={{
                  p: 0.3,
                  color: canAdd ? "primary.main" : "#6e6e6e !important",
                  opacity: 1,
                  cursor: canAdd ? "pointer" : "not-allowed",
                  "&.Mui-disabled": {
                    color: "#6e6e6e !important",
                    opacity: 1,
                  },
                }}
              >
                <AddIcon fontSize="small" />
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
                Create PO
              </Typography>
            </Box>
          </Grid>
          {/* Download Button */}
       <Grid item xs="auto">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <IconButton
                onClick={handleClick}
                color="primary"
                className="icon-button-outline"
                size="small"
                sx={{ p: 0.3 }}
                disabled={!(pendingPurchaseList || []).length}
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
        <Dialog
          open={dialogOpen}
          onClose={handleDialogClose}
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
            padding: isFullScreen ? '16px 24px' : '16px'
          }}>
            <span>Pending Order Details {selectedOrder?.randomId ? `${selectedOrder.randomId}` : ''}</span>
            <span>Vendor Name: {selectedOrder?.vendorName || 'Unknown Vendor'}</span>
            <IconButton onClick={toggleFullScreen} color="primary" edge="end">
              {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{
            padding: isFullScreen ? '0 24px' : '20px',
            height: isFullScreen ? 'calc(100vh - 120px)' : 'auto',
            overflow: 'auto'
          }}>
            <TableContainer component={Paper}>
              <Table stickyHeader sx={{ minWidth: 500, fontSize: '0.600rem' }}>
                <TableHead>
                  <TableRow>
                    <TableCell>S.No</TableCell>
                    <TableCell>Item Name</TableCell>
                    <TableCell>UOM</TableCell>
                    <TableCell>Pkt Count</TableCell>
                    <TableCell>Quantity</TableCell>
                    <TableCell>Total Quantity</TableCell>
                    <TableCell>Unit Price</TableCell>
                    <TableCell>BefTax Dis(%)</TableCell>
                    <TableCell>AfTax Dis(%)</TableCell>
                    <TableCell>Tax(%)</TableCell>
                    <TableCell>Total Price</TableCell>
                    <TableCell>Final Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {updatedItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} align="center">
                        No items found for this order. Check backend data or remove quantity filter if needed.
                      </TableCell>
                    </TableRow>
                  ) : (
                    updatedItems.map((item, index) => (
                      <TableRow key={item.itemId}>
                        <TableCell className="table-number-right">{index + 1}</TableCell>
                        <TableCell className="table-number-left">{item.itemName}</TableCell>
                        <TableCell className="table-number-left">{item.uom}</TableCell>
                        <TableCell>
                          <TextField
                            type="text"
                            value={item.pendingCount === 0 ? '' : item.pendingCount}
                            onChange={e => {
                              const value = e.target.value;
                              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                handleInputChange(index, 'pendingCount', value);
                              }
                            }}
                            onBlur={() => {
                              setTouched(prev => ({
                                ...prev,
                                [index]: { ...prev[index], pendingCount: true }
                              }));
                              if (item.pendingCount === '') {
                                setErrors(prev => ({
                                  ...prev,
                                  [index]: { ...prev[index], pendingCount: 'required' }
                                }));
                              } else if (!/^\d*\.?\d*$/.test(String(item.pendingCount))) {
                                setErrors(prev => ({
                                  ...prev,
                                  [index]: { ...prev[index], pendingCount: 'Invalid number' }
                                }));
                              } else {
                                setErrors(prev => ({
                                  ...prev,
                                  [index]: { ...prev[index], pendingCount: '' }
                                }));
                              }
                            }}
                            error={touched[index]?.pendingCount && !!errors[index]?.pendingCount}
                            helperText={touched[index]?.pendingCount && errors[index]?.pendingCount ? errors[index].pendingCount : ''}
                            inputProps={{ step: '0.01' }}
                            sx={{ width: '100px' }}
                          />
                        </TableCell>
                        <TableCell className="table-number-right">
                          <TextField
                            type="text"
                            value={item.pendingQuantity === 0 ? '' : item.pendingQuantity}
                            onChange={e => {
                              const value = e.target.value;
                              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                handleInputChange(index, 'pendingQuantity', value);
                              }
                            }}
                            onBlur={() => {
                              setTouched(prev => ({
                                ...prev,
                                [index]: { ...prev[index], pendingQuantity: true }
                              }));
                              if (item.pendingQuantity === '') {
                                setErrors(prev => ({
                                  ...prev,
                                  [index]: { ...prev[index], pendingQuantity: 'required' }
                                }));
                              } else if (!/^\d*\.?\d*$/.test(String(item.pendingQuantity))) {
                                setErrors(prev => ({
                                  ...prev,
                                  [index]: { ...prev[index], pendingQuantity: 'Invalid number' }
                                }));
                              } else {
                                setErrors(prev => ({
                                  ...prev,
                                  [index]: { ...prev[index], pendingQuantity: '' }
                                }));
                              }
                            }}
                            error={touched[index]?.pendingQuantity && !!errors[index]?.pendingQuantity}
                            helperText={touched[index]?.pendingQuantity && errors[index]?.pendingQuantity ? errors[index].pendingQuantity : ''}
                            inputProps={{ step: '0.01' }}
                            sx={{ width: '100px' }}
                          />
                        </TableCell>
                        <TableCell className="table-number-right">
                          <TextField
                            type="number"
                            value={item.pendingTotalQuantity || 0}
                            InputProps={{
                              readOnly: true,
                            }}
                            inputProps={{ min: 0 }}
                            disabled
                            sx={{ width: '100px' }}
                          />
                        </TableCell>
                        <TableCell className="table-number-right">
                          <TextField
                            type="text"
                            value={item.newPrice === 0 ? '' : item.newPrice}
                            onChange={e => {
                              const value = e.target.value;
                              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                handleInputChange(index, 'newPrice', value);
                              }
                            }}
                            onBlur={() => {
                              setTouched(prev => ({
                                ...prev,
                                [index]: { ...prev[index], newPrice: true }
                              }));
                              if (item.newPrice === '') {
                                setErrors(prev => ({
                                  ...prev,
                                  [index]: { ...prev[index], newPrice: 'required' }
                                }));
                              } else if (!/^\d*\.?\d*$/.test(String(item.newPrice))) {
                                setErrors(prev => ({
                                  ...prev,
                                  [index]: { ...prev[index], newPrice: 'Invalid number' }
                                }));
                              } else {
                                setErrors(prev => ({
                                  ...prev,
                                  [index]: { ...prev[index], newPrice: '' }
                                }));
                              }
                            }}
                            error={touched[index]?.newPrice && !!errors[index]?.newPrice}
                            helperText={touched[index]?.newPrice && errors[index]?.newPrice ? errors[index].newPrice : ''}
                            inputProps={{ step: '0.01' }}
                            sx={{ width: '100px' }}
                          />
                        </TableCell>
                        <TableCell className="table-number-right">{item.befTaxDiscount || 0}</TableCell>
                        <TableCell className="table-number-right">{item.afTaxDiscount || 0}</TableCell>
                        <TableCell className="table-number-right">{item.taxPercentage || 0}</TableCell>
                        <TableCell className="table-number-right">{(item.pendingTotalPrice || 0).toFixed(2)}</TableCell>
                        <TableCell className="table-number-right">{(item.pendingFinalPrice || 0).toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  <TableRow>
                    <TableCell colSpan={11} align="right">
                      <strong>Item-wise Discount:</strong>
                    </TableCell>
                    <TableCell className="table-number-right">{(pendingDiscountAmount - overallDiscount || 0).toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={11} align="right">
                      <strong>Freight Charges:</strong>
                    </TableCell>
                    <TableCell className="table-number-right">
                      {(selectedOrder?.totalFreightAmount || 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={11} align="right">
                      <strong>Freight Tax:</strong>
                    </TableCell>
                    <TableCell className="table-number-right">
                      {(selectedOrder?.totalFreightTaxAmount || 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={11} align="right">
                      <strong>Overall Discount:</strong>
                    </TableCell>
                    <TableCell className="table-number-right">{(overallDiscount || 0).toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={11} align="right">
                      <strong>Total Discount:</strong>
                    </TableCell>
                    <TableCell className="table-number-right">{(pendingDiscountAmount || 0).toFixed(2)}</TableCell>
                  </TableRow>
                  {Object.entries(taxDetails).map(([key, tax]) => (
                    <TableRow key={key}>
                      <TableCell colSpan={10}></TableCell>
                      <TableCell>
                        <strong>{tax.type} ({tax.percentage}%):</strong>
                      </TableCell>
                      <TableCell className="table-number-right">{(tax.amount || 0).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={10}></TableCell>
                    <TableCell><strong>Order Amount:</strong></TableCell>
                    <TableCell className="table-number-right">{(pendingOrderAmount || 0).toFixed(2)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDialogClose} color="primary">Close</Button>
             <Button
              onClick={canEdit ? handleSaveChanges : undefined}
              disabled={!canEdit}
              sx={{
                color: canEdit ? "primary.main" : "#6e6e6e !important",
                opacity: 1,
                cursor: canEdit ? "pointer" : "not-allowed",
                "&.Mui-disabled": {
                  color: "#6e6e6e !important",
                  opacity: 1,
                },
              }}
            >
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>{/* Pdf Excel */}
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
      <Dialog open={approveOpen} onClose={handleApproveDialogClose}>
  <DialogTitle>Approve Purchase Order</DialogTitle>
  <DialogContent>
    <Typography>
      Do you want to send this Purchase Order via WhatsApp to the vendor?
    </Typography>
  </DialogContent>
  <DialogActions>
    <Button onClick={handleApproveDialogClose} color="secondary">
      Cancel
    </Button>
    <Button 
      onClick={() => handleApproveOrder(selectedOrderId!, false)} 
      color="primary"
    >
      Approve
    </Button>
    {/* <Button 
      onClick={() => handleApproveOrder(selectedOrderId!, true)} 
      color="primary" 
      variant="contained"
    >
      Yes, Send via WhatsApp
    </Button> */} 
  </DialogActions>
</Dialog>
        {/* Reject Order Dialog */}
        <Dialog open={rejectOpen} onClose={handleRejectDialogClose}>
          <DialogTitle>Reject Purchase Order</DialogTitle>
          <DialogContent>
            <Typography>Are you sure you want to reject this order?</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleRejectDialogClose} color="primary">Cancel</Button>
            <Button onClick={() => handleRejectOrder(selectedOrderId!)} color="primary">Reject</Button>
          </DialogActions>
        </Dialog>
        {/* Display orders (no client-side filter needed) */}
        <TableContainer
          component={Paper}
          sx={{
            maxHeight: 'calc(100vh - 245px)', // Dynamic height based on viewport
            overflowY: 'auto',
            width: '100%',
            mt: 0.7
          }}
        >
          <Table
            stickyHeader sx={{
              tableLayout: 'fixed', // This fixes column widths
              width: '100%'
            }}>
            <TableHead>
              <TableRow>
                <TableCell className="table-number-right">S.No</TableCell>
                <TableCell className="table-text-left">Order ID</TableCell>
                <TableCell className="table-text-left">Vendor Name</TableCell>
                <TableCell className="table-text-left">Uploaded Photo</TableCell>
                <TableCell className="table-number-right">Total PO Items</TableCell>
                <TableCell className="table-number-right">Total Price</TableCell>
                <TableCell className="table-text-left">Status</TableCell>
                <TableCell className="table-text-left">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(pendingPurchaseList || []).length === 0 ? (
                // Display message when no data is found
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    No orders found.
                  </TableCell>
                </TableRow>
              ) : (
                // Display orders when data is available
                (pendingPurchaseList || []).map((order, index) => {
                  const totalQuantity = Array.isArray(order.items)
                    ? order.items.reduce((acc, item) => acc + (item.pendingTotalQuantity || 0), 0)
                    : 0;
                  return (
                    <TableRow key={order.purchaseOrderId}>
                      <TableCell className="table-number-right">{index + 1}</TableCell>
                      <TableCell className="table-text-left">{order.randomId}</TableCell>
                      <TableCell className="table-text-left">{order.vendorName}</TableCell>
                      <TableCell>
                        <PhotoDisplay
                          orderId={order.purchaseOrderId}
                          imageUrls={imageUrls[order.purchaseOrderId] || []}
                          onImageClick={(url, displayIndex) => {
                            setSelectedImage(url);
                            setSelectedImageIndex(displayIndex - 1); // Store as 0-based in state
                            setOpenImageDialog(true);
                          }}
                          onUploadClick={(orderId, backendIndex) => {
                            // Trigger file input click with 1-based index
                            document.getElementById(`file-input-${orderId}-${backendIndex}`)?.click();
                          }}
                        />
                        {[1, 2, 3].map((displayIndex) => (
                          <input
                            key={displayIndex}
                            id={`file-input-${order.purchaseOrderId}-${displayIndex}`}
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileChange(e, order.purchaseOrderId, displayIndex)}
                            style={{ display: 'none' }}
                          />
                        ))}
                      </TableCell>
                      <TableCell className="table-number-right">{totalQuantity}</TableCell>
                      <TableCell className="table-number-right">{order.pendingOrderAmount.toFixed(2)}</TableCell>
                      <TableCell className="table-text-left">{order.poStatus}</TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          {/* View Button with Eye Icon */}
                          <Tooltip title="View Details">
                            <IconButton
                              onClick={() => handleViewDetailsClick(order.purchaseOrderId)}
                              color='primary'
                              sx={{ mr: 1 }} // margin right to separate icons
                            >
                              <VisibilityIcon />
                            </IconButton>
                          </Tooltip>
                          {/* New Edit Button with Edit Icon */}
                          <Tooltip title="Edit Order">
                            <IconButton
                            onClick={() =>
                              canEdit && handleEditClick(order.purchaseOrderId)
                            }
                            disabled={!canEdit}
                            sx={{
                              color: canEdit
                                ? "primary.main"
                                : "#6e6e6e !important",
                              opacity: 1,
                              cursor: canEdit ? "pointer" : "not-allowed",
                              "&.Mui-disabled": {
                                color: "#6e6e6e !important",
                                opacity: 1,
                              },
                            }}
                          >
                            <EditIcon />
                          </IconButton>
                          </Tooltip>
                          {/* Approve Button with Check Icon */}
                          <Tooltip title="Approve Order">
                            <IconButton
                            onClick={() =>
                              canApprove &&
                              (setSelectedOrderId(order.purchaseOrderId),
                              handleApproveDialogOpen())
                            }
                            disabled={!canApprove}
                            sx={{
                              color: canApprove
                                ? "primary.main"
                                : "#6e6e6e !important",
                              opacity: 1,
                              "&.Mui-disabled": {
                                color: "#6e6e6e !important",
                                opacity: 1,
                              },
                            }}
                          >
                            <CheckIcon />
                          </IconButton>
                          </Tooltip>
                          {/* Reject Button with Close (X) Icon */}
                          <Tooltip title="Reject Order">
                             <IconButton
                            onClick={() =>
                              canApprove &&
                              (setSelectedOrderId(order.purchaseOrderId),
                              handleRejectDialogOpen())
                            }
                            disabled={!canApprove}
                            sx={{
                              color: canApprove
                                ? "primary.main"
                                : "#6e6e6e !important",
                              opacity: 1,
                              "&.Mui-disabled": {
                                color: "#6e6e6e !important",
                                opacity: 1,
                              },
                            }}
                          >
                            <CloseIcon />
                          </IconButton>
                          </Tooltip>
                          {/* Download Button with PDF Icon
                          <Tooltip title="Download PDF">
                            <IconButton
                              color="primary"
                              onClick={() => handleDownload(order.purchaseOrderId)}
                            >
                              <PictureAsPdfIcon />
                            </IconButton>
                          </Tooltip> */}
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
          <Box sx={{ display: 'flex', justifyContent: 'end', alignItems: 'center', mt: 0 }}>
            <IconButton
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              aria-label="Previous Page"
            >
              <ChevronLeft />
            </IconButton>
            <Typography variant="body1" sx={{ mx: 2, fontSize: '2.2rem' }}>
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
        {/* Confirmation dialog */}
        <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
          <DialogTitle>Confirm Changes</DialogTitle>
          <DialogContent>
            <Typography>Are you sure you want to save the changes?</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDialogOpen(false)} color="primary" >Cancel</Button>
            <Button onClick={handleConfirmSave} color="primary" >Confirm</Button>
          </DialogActions>
        </Dialog>
        <Dialog open={openPhotoDialog} onClose={() => setOpenPhotoDialog(false)}>
          <DialogTitle>Confirm Upload</DialogTitle>
          <DialogContent>
            Are you sure you want to upload this photo?
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenPhotoDialog(false)} color="primary">
              Cancel
            </Button>
            <Button onClick={handleConfirmUpload} color="primary">
              Upload
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
        <Dialog open={openImageDialog} onClose={() => setOpenImageDialog(false)} maxWidth="md">
          <DialogTitle>
            Photo {selectedImageIndex !== null ? selectedImageIndex + 1 : ''}
          </DialogTitle>
          <DialogContent>
            {selectedImage && (
              <Image
                src={selectedImage}
                alt="Full size receipt"
                width={800}
                height={600}
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            )}
          </DialogContent>
        </Dialog>
        <Dialog open={openPhotoDialog} onClose={() => setOpenPhotoDialog(false)}>
          <DialogTitle>
            {selectedImageIndex !== null && imageUrls[selectedOrderId || '']?.[selectedImageIndex]
              ? 'Replace Photo'
              : 'Upload Photo'}
          </DialogTitle>
          <DialogContent>
            {files[0] && (
              <Typography>File: {files[0].name}</Typography>
            )}
            <Typography>Are you sure you want to proceed?</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenPhotoDialog(false)}>Cancel</Button>
            <Button onClick={handleUpload} color="primary">
              Confirm
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
    </Box>
  );
};
export default React.memo(Polist);