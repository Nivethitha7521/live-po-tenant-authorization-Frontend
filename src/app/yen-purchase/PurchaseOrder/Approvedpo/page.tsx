"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Box,
  TextField,
  Button,
  Typography,
  Grid,
  Paper,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton,
  Snackbar,
  Menu,
  MenuItem,
  Tooltip,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  Switch,
} from "@mui/material";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import ClearIcon from "@mui/icons-material/Clear";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DownloadIcon from "@mui/icons-material/Download";
import DescriptionIcon from "@mui/icons-material/Description";
import VisibilityIcon from "@mui/icons-material/Visibility";
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import InfoIcon from '@mui/icons-material/Info';
import { ChevronLeft, ChevronRight } from "@mui/icons-material";
import Link from "next/link";
import { format, startOfDay } from "date-fns";
import jsPDF from "jspdf";
import "jspdf-autotable";
import Papa from "papaparse";
import moment from "moment";
import {
  selectPurchaseListState,
  updateReceivedDamagedQuantities,
  updatePurchaseOrderStatusToPending,
  fetchPurchaseOrders,
  clearSnackbarMessage,
  setSearchQueryItem,
  selectCurrentPage,
  selectPageSize,
  selectTotalItems,
  setPagination,
  fetchInvoiceNumbers,
  fetchAllImages,
  calculateOverallDiscount, // New thunk import
} from "../../../../features/yen-purchase/PurchaseOrder/purchaseListSlice";
import { AppDispatch } from "@/redux/store";
import YenPurchasePage from "../../page";
import {
  fetchBusinesses,
  fetchPhoto,
  selectBusinesses,
} from "@/features/account-setting/businessSlice";
import { PurchaseItemSearch } from "@/features/yen-purchase/PurchaseOrder/purchaseOrderSlice";
import { toWords } from "number-to-words";
import DateRangeDialog from "@/components/dateRange";
import VendorSearchAutocomplete from "../../../../components/vendorsearchautocomplete";
import PurchaseOrderRandomIdSearch from "../../../../components/yen-purchase/pendingpo/infiniteScroll";
import { PurchaseOrderData, Item, TaxDetails } from "@/Models/purchaseModel";
import { POsearchPurchaseItems } from "@/features/yen-purchase/PurchaseMaster/purchaseItemSlice";
import { VendorSearch } from "@/Models/vendor";
import ConfirmationDialog from "@/components/confirmationDialog";
import { isValid } from "date-fns";
import SaveIcon from '@mui/icons-material/Save';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { ExportProps, ItemWithCalculations, OverallDiscountResponse, OverallDiscountResponseItem, PurchaseOrderWithItems } from "../Models/Itemcalculation";
const parseLocalDate = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr) return null;
  const localStr = dateStr.split('T')[0];
  const date = new Date(localStr + 'T00:00:00');
  return isNaN(date.getTime()) ? null : date;
};
const customRound = (value: number): number => Math.round(value);
const customRoundDigit = (value: number): number => Math.round(value * 100) / 100;
const TableRowMemo = React.memo(
  ({
    item,
    index,
    touched,
    errors,
    handleQuantityChange,
    handlePriceChange,
    handleDiscountChange,
    handleExpiryDateChange,
    handleQuantityBlur,
    discountType, // Pass discountType to disable fields
    applyingDiscount, // Pass to disable during apply
  }: {
    item: ItemWithCalculations;
    index: number;
    touched: Record<number, Record<string, boolean>>;
    errors: Record<number, Record<string, string>>;
    handleQuantityChange: (
      itemId: string,
      field: "receivedQuantity",
      value: string | number
    ) => void;
    handlePriceChange: (itemId: string, value: string) => void;
    handleDiscountChange: (
      itemId: string,
      field: "befTaxDiscount" | "afTaxDiscount",
      value: string
    ) => void;
    handleExpiryDateChange: (itemId: string, value: Date | null) => void;
    handleQuantityBlur: (
      itemId: string,
      field: "receivedQuantity",
      value: string | number
    ) => void;
    discountType: 'before' | 'after';
    applyingDiscount: boolean;
  }) => (
    <TableRow>
      <TableCell className='table-number-right'>{index + 1}</TableCell>
      <TableCell>{item.itemName}</TableCell>
      <TableCell>{item.uom}</TableCell>
      <TableCell className='table-number-right'>{item.pendingTotalQuantity}</TableCell>
      <TableCell className='table-number-right'>{item.poQuantity}</TableCell>
      <TableCell className='table-number-right'>
        <TextField
          type="number"
          autoComplete="off"
          value={item.receivedQuantity ?? ""}
          onChange={(e) => handleQuantityChange(item.itemId, "receivedQuantity", e.target.value)}
          onBlur={(e) => handleQuantityBlur(item.itemId, "receivedQuantity", e.target.value)}
          inputProps={{ step: "0.01" }}
          sx={{ width: "80px" }}
          disabled={item.pendingTotalQuantity === 0 || item.status === "Received"}
          error={touched[index]?.receivedQuantity && !!errors[index]?.receivedQuantity}
          helperText={touched[index]?.receivedQuantity && errors[index]?.receivedQuantity}
        />
      </TableCell>
      <TableCell className='table-number-right'>
        <TextField
          type="number"
          autoComplete="off"
          value={item.grnPrice !== undefined ? item.grnPrice : item.newPrice}
          onChange={(e) => handlePriceChange(item.itemId, e.target.value)}
          inputProps={{ step: "0.01" }}
          sx={{ width: "80px" }}
          error={touched[index]?.grnPrice && !!errors[index]?.grnPrice}
          helperText={touched[index]?.grnPrice && errors[index]?.grnPrice}
        />
      </TableCell>
      <TableCell className='table-number-right'>{(item.perUnit || 0).toFixed(2)}</TableCell>
      <TableCell className='table-number-right'>
        <TextField
          autoComplete="off"
          type="number"
          value={item.befTaxDiscount === 0 || item.befTaxDiscount === undefined ? "" : item.befTaxDiscount}
          onChange={(e) => handleDiscountChange(item.itemId, "befTaxDiscount", e.target.value)}
          error={touched[index]?.befTaxDiscount && !!errors[index]?.befTaxDiscount}
          helperText={touched[index]?.befTaxDiscount && errors[index]?.befTaxDiscount}
          inputProps={{ step: "0.01" }}
          sx={{ width: "80px" }}
          disabled={discountType === 'after' || applyingDiscount} // Disable if 'after' selected or applying
          label={discountType === 'after' ? "Disabled (After Selected)" : undefined}
        />
      </TableCell>
      <TableCell className='table-number-right'>
        <TextField
          autoComplete="off"
          type="number"
          value={item.afTaxDiscount === 0 || item.afTaxDiscount === undefined ? "" : item.afTaxDiscount}
          onChange={(e) => handleDiscountChange(item.itemId, "afTaxDiscount", e.target.value)}
          error={touched[index]?.afTaxDiscount && !!errors[index]?.afTaxDiscount}
          helperText={touched[index]?.afTaxDiscount && errors[index]?.afTaxDiscount}
          inputProps={{ step: "0.01" }}
          sx={{ width: "80px" }}
          disabled={discountType === 'before' || applyingDiscount} // Disable if 'before' selected or applying
          label={discountType === 'before' ? "Disabled (Before Selected)" : undefined}
        />
      </TableCell>
      <TableCell className='table-number-right'>{item.taxPercentage}%</TableCell>
      <TableCell>
        <TextField
          label="Expiry Date"
          type="date"
          value={
            item.expiryDate && isValid(item.expiryDate)
              ? format(item.expiryDate, 'yyyy-MM-dd')
              : ''
          }
          onChange={(e) =>
            handleExpiryDateChange(
              item.itemId,
              e.target.value ? new Date(e.target.value) : null
            )
          }
          InputLabelProps={{ shrink: true }}
          inputProps={{
            min: format(new Date(), 'yyyy-MM-dd'),
          }}
          error={touched[index]?.expiryDate && !!errors[index]?.expiryDate}
          helperText={touched[index]?.expiryDate && errors[index]?.expiryDate}
        />
      </TableCell>
      {/* UPDATED: Now shows Item Total (final price after all discounts and tax) */}
      <TableCell className='table-number-right'>{(item.calculatedTotalPrice || 0).toFixed(2)}</TableCell>
    </TableRow>
  )
);
TableRowMemo.displayName = "TableRowMemo";
interface OrderDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  selectedOrder: PurchaseOrderWithItems | null;
  updatedItems: ItemWithCalculations[];
  setUpdatedItems: React.Dispatch<React.SetStateAction<ItemWithCalculations[]>>;
  invoiceNumber: string;
  setInvoiceNumber: React.Dispatch<React.SetStateAction<string>>;
  invoiceDate: Date | null;
  setInvoiceDate: React.Dispatch<React.SetStateAction<Date | null>>;
  grnDate: Date | null;
  setGrnDate: React.Dispatch<React.SetStateAction<Date | null>>;
  isInvoiceDuplicate: boolean;
  isTouched: boolean;
  setIsTouched: React.Dispatch<React.SetStateAction<boolean>>;
  taxDetails: TaxDetails;
  totalOrderAmount: number;
  totalDiscountAmount: number;
  handleSaveChanges: () => void;
  handleOpenRevertDialog: () => void;
  isProcessing: boolean;
  isReceivedQuantityValid: () => boolean;
  touched: Record<number, Record<string, boolean>>;
  setTouched: React.Dispatch<React.SetStateAction<Record<number, Record<string, boolean>>>>;
  errors: Record<number, Record<string, string>> & { roundOff?: string };
  setErrors: React.Dispatch<React.SetStateAction<Record<number, Record<string, string>> & { roundOff?: string }>>;
  handleQuantityChange: (itemId: string, field: "receivedQuantity", value: string | number) => void;
  handlePriceChange: (itemId: string, value: string) => void;
  handleDiscountChange: (itemId: string, field: "befTaxDiscount" | "afTaxDiscount", value: string) => void;
  handleExpiryDateChange: (itemId: string, value: Date | null) => void;
  calculatedItems: ItemWithCalculations[];
  roundOffAmount: number;
  setRoundOffAmount: React.Dispatch<React.SetStateAction<number>>;
  overallDiscountAmount: number;
  setOverallDiscountAmount: React.Dispatch<React.SetStateAction<number>>;
  discountType: 'before' | 'after';
  setDiscountType: React.Dispatch<React.SetStateAction<'before' | 'after'>>;
  originalItemDiscounts: Record<string, { befTaxDiscount: number; afTaxDiscount: number }>;
  setOriginalItemDiscounts: React.Dispatch<React.SetStateAction<Record<string, { befTaxDiscount: number; afTaxDiscount: number }>>>;
  handleApplyDiscount: () => void;
  removeOverallDiscount: () => void;
  applyingDiscount: boolean;
}
const OrderDetailsDialog: React.FC<OrderDetailsDialogProps> = ({
  open,
  onClose,
  selectedOrder,
  updatedItems,
  setUpdatedItems,
  invoiceNumber,
  setInvoiceNumber,
  invoiceDate,
  setInvoiceDate,
  grnDate,
  setGrnDate,
  isInvoiceDuplicate,
  isTouched,
  setIsTouched,
  taxDetails,
  totalOrderAmount,
  totalDiscountAmount,
  handleSaveChanges,
  handleOpenRevertDialog,
  isProcessing,
  isReceivedQuantityValid,
  touched,
  setTouched,
  errors,
  setErrors,
  handleQuantityChange,
  handlePriceChange,
  handleDiscountChange,
  handleExpiryDateChange,
  calculatedItems,
  roundOffAmount,
  setRoundOffAmount,
  overallDiscountAmount,
  setOverallDiscountAmount,
  discountType,
  setDiscountType,
  originalItemDiscounts,
  setOriginalItemDiscounts,
  handleApplyDiscount,
  removeOverallDiscount,
  applyingDiscount,
}) => {
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };
  const handleQuantityBlur = useCallback(
    (itemId: string, field: "receivedQuantity", value: string | number) => {
      const index = updatedItems.findIndex((item) => item.itemId === itemId);
      const originalItem = selectedOrder?.items.find((original) => original.itemId === itemId);
      const originalPendingTotalQuantity = originalItem?.pendingTotalQuantity || 0;
      if (value === "") {
        setErrors((prev) => ({
          ...prev,
          [index]: { ...prev[index], [field]: "" },
        }));
        return;
      }
      if (!/^\d*\.?\d*$/.test(String(value))) {
        setErrors((prev) => ({
          ...prev,
          [index]: { ...prev[index], [field]: "Invalid number" },
        }));
        return;
      }
      const received = Number(value);
      if (received < 0) {
        setErrors((prev) => ({
          ...prev,
          [index]: { ...prev[index], [field]: "Received quantity cannot be negative" },
        }));
        return;
      }
      if (originalPendingTotalQuantity === 0) {
        setErrors((prev) => ({
          ...prev,
          [index]: { ...prev[index], [field]: "Item is already fully received" },
        }));
        return;
      }
      if (received > originalPendingTotalQuantity) {
        setErrors((prev) => ({
          ...prev,
          [index]: { ...prev[index], [field]: `Cannot exceed pending quantity of ${originalPendingTotalQuantity}` },
        }));
        return;
      }
      setErrors((prev) => ({
        ...prev,
        [index]: { ...prev[index], [field]: "" },
      }));
    },
    [updatedItems, selectedOrder, setErrors]
  );
  const handleOpenConfirmDialog = () => {
    const finalTotal = totalOrderAmount + roundOffAmount;
    if (finalTotal < 0) {
      setErrors((prev) => ({
        ...prev,
        roundOff: "Round off amount cannot make total negative"
      }));
      return;
    }
    setOpenConfirmDialog(true);
  };
  const handleCloseConfirmDialog = () => {
    setOpenConfirmDialog(false);
  };
  const handleConfirmSave = () => {
    setOpenConfirmDialog(false);
    handleSaveChanges();
  };
  const getCurrentDate = () => {
    return format(new Date(), 'yyyy-MM-dd');
  };
  const getOrderDateMin = () => {
    return selectedOrder?.orderDate ? format(startOfDay(new Date(selectedOrder.orderDate)), 'yyyy-MM-dd') : getCurrentDate();
  };
const lenientRegex = /^-?\d*\.?\d{0,2}$/; // e.g., "2", "2.", "2.0", "2.01", "-1.99"

// UPDATED: Strict regex removed - no longer needed since we round & cap on blur.
// Validation is now based on post-rounded value being within ±2.0 in 0.1 steps.
// UPDATED: handleRoundOffChange - allows any value within ±2.0 with 2 decimals during typing
const handleRoundOffChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
  
  if (value === '') {
    setRoundOffAmount(0);
    setErrors((prev) => ({ ...prev, roundOff: "" }));
    return;
  }
  
  // Allow numbers with up to 2 decimals, including negative
  if (/^-?\d*\.?\d{0,2}$/.test(value)) {
    const parsedValue = parseFloat(value) || 0;
    
    // Live validation: check if within ±2.0 range
    if (Math.abs(parsedValue) > 2) {
      setErrors((prev) => ({
        ...prev,
        roundOff: "Value must be between -2.00 and +2.00",
      }));
    } else {
      setErrors((prev) => ({ ...prev, roundOff: "" }));
    }
    
    setRoundOffAmount(parsedValue);
  } else {
    setErrors((prev) => ({
      ...prev,
      roundOff: "Enter a number between -2.00 and +2.00 with up to 2 decimals",
    }));
  }
};

// UPDATED: handleRoundOffBlur - final validation and rounding to 2 decimals
const handleRoundOffBlur = () => {
  let currentValue = roundOffAmount;
  
  // Round to 2 decimal places for final value
  currentValue = Math.round(currentValue * 100) / 100;
  
  let errorMsg = "";
  
  // Final range check
  if (currentValue > 2) {
    currentValue = 2;
    errorMsg = "Capped at +2.00";
  } else if (currentValue < -2) {
    currentValue = -2;
    errorMsg = "Capped at -2.00";
  }
  
  // Validate final total doesn't go negative
  const finalTotal = totalOrderAmount + currentValue;
  if (finalTotal < 0) {
    setErrors((prev) => ({
      ...prev,
      roundOff: `Cannot make total negative (would be ${finalTotal.toFixed(2)}). Reset to 0.`,
    }));
    setRoundOffAmount(0);
    return;
  }
  
  // Set error if capped
  if (errorMsg) {
    setErrors((prev) => ({ ...prev, roundOff: errorMsg }));
  } else {
    setErrors((prev) => ({ ...prev, roundOff: "" }));
  }
  
  setRoundOffAmount(currentValue);
};

  // Auto-suggest for round-off placeholder (to nearest whole number)
  const roundOffSuggestion = useMemo(() => {
    const fractional = totalOrderAmount % 1;
    if (fractional !== 0) {
      return (Math.round(totalOrderAmount) - totalOrderAmount).toFixed(2);
    }
    return '0.00';
  }, [totalOrderAmount]);
  const finalTotalAmount = totalOrderAmount + roundOffAmount;
  const handleOverallDiscountBlur = useCallback(() => {
    const num = Number(overallDiscountAmount);
    if (num > 0 && num <= totalOrderAmount && isReceivedQuantityValid()) {
      handleApplyDiscount();
    } else if (num > totalOrderAmount) {
      setOverallDiscountAmount(0);
    }
  }, [overallDiscountAmount, totalOrderAmount, isReceivedQuantityValid, handleApplyDiscount, setOverallDiscountAmount]);
  return (
    <>
      <Dialog
        open={open}
        onClose={isProcessing ? undefined : onClose}
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
          <span>Approved Order Details {selectedOrder?.randomId || ''}</span>
          <span>Vendor Name: {selectedOrder?.vendorName || 'Unknown Vendor'}</span>
          <IconButton onClick={toggleFullScreen} color="primary" edge="end">
            {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{
          padding: isFullScreen ? '0 24px 24px' : '24px',
          display: 'flex',
          flexDirection: 'column',
          height: isFullScreen ? 'calc(100vh - 64px)' : 'auto',
          overflow: 'hidden'
        }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexShrink: 0 }}>
            <Box display="flex" gap={2} mt={1} mb={2}>
              <TextField
                label="Invoice Number"
                autoComplete="off"
                value={invoiceNumber}
                onChange={(e) => {
                  setInvoiceNumber(e.target.value);
                  setIsTouched(true);
                }}
                error={isTouched && (isInvoiceDuplicate || !invoiceNumber)}
                helperText={
                  isTouched && !invoiceNumber
                    ? 'Invoice number is required!'
                    : isTouched && isInvoiceDuplicate
                      ? 'Invoice number already exists!'
                      : ''
                }
              />
              <TextField
                label="Invoice Date"
                type="date"
                value={invoiceDate ? format(invoiceDate, 'yyyy-MM-dd') : getCurrentDate()}
                onChange={(e) => setInvoiceDate(e.target.value ? new Date(e.target.value) : new Date())}
                disabled={!selectedOrder?.orderDate}
                inputProps={{
                  min: getOrderDateMin(),
                  max: getCurrentDate(),
                }}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="GRN Date"
                type="date"
                value={grnDate ? format(grnDate, 'yyyy-MM-dd') : getCurrentDate()}
                onChange={(e) => setGrnDate(e.target.value ? new Date(e.target.value) : new Date())}
                disabled={true}
                inputProps={{
                  min: getOrderDateMin(),
                  max: getCurrentDate(),
                }}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          </Box>
          <TableContainer component={Paper} sx={{ flex: 1, overflow: 'auto' }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell className='table-number-right'>S.No</TableCell>
                  <TableCell>Item Name</TableCell>
                  <TableCell>Uom</TableCell>
                  <TableCell className='table-number-right'>Pending Qty</TableCell>
                  <TableCell className='table-number-right'>Total Qty</TableCell>
                  <TableCell className='table-number-right'>Received Qty</TableCell>
                  <TableCell className='table-number-right'>Price</TableCell>
                  {/* NEW: Taxable and Subtotal columns after Price */}
                  <TableCell className='table-number-right'>Taxable Amt</TableCell>
                  <TableCell className='table-number-right'>BefTax Discount</TableCell>
                  <TableCell className='table-number-right'>AfTax Discount</TableCell>
                  <TableCell className='table-number-right'>Tax</TableCell>
                  <TableCell>Expiry Date</TableCell>
                  {/* UPDATED: Label changed to Item Total */}
                  <TableCell className='table-number-right'>Item Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {calculatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} align="center">
                      No items available
                    </TableCell>
                  </TableRow>
                ) : (
                  calculatedItems
                    .filter((item) => item.status !== "Received")
                    .map((item: ItemWithCalculations, index: number) => (
                      <TableRowMemo
                        key={item.itemId}
                        item={item}
                        index={index}
                        touched={touched}
                        errors={errors}
                        handleQuantityChange={handleQuantityChange}
                        handlePriceChange={handlePriceChange}
                        handleDiscountChange={handleDiscountChange}
                        handleExpiryDateChange={handleExpiryDateChange}
                        handleQuantityBlur={handleQuantityBlur}
                        discountType={discountType} // Pass to TableRowMemo
                        applyingDiscount={applyingDiscount} // Pass to disable during apply
                      />
                    ))
                )}
                {/* UPDATED: Subtotal now sums taxable amounts (without tax) for all items */}
{/* Subtotal - Sum of taxable amounts (without tax) for non-received items */}
{calculatedItems.length > 0 && calculatedItems.some(item => item.status !== "Received" && (item.pendingTotalQuantity || 0) > 0) && (
  <TableRow sx={{ fontWeight: 'bold', backgroundColor: '#e8f5e8' }}>
    <TableCell colSpan={11} />
    <TableCell><strong>Sub Total :</strong></TableCell>
    <TableCell className='table-number-right'>
      {customRoundDigit(
        calculatedItems
          .filter(item => item.status !== "Received" && (item.pendingTotalQuantity || 0) > 0)
          .reduce((sum, item) => sum + (item.calculatedTaxableAmount || 0), 0) // Use taxableAmount for subtotal
      ).toFixed(2)}
    </TableCell>
  </TableRow>
)}

                {/* NEW: Added empty row for space after subtotal */}
                {calculatedItems.length > 0 && calculatedItems.some(item => item.status !== "Received") && (
                  <TableRow>
                    <TableCell colSpan={13} />
                  </TableRow>
                )}
                {/* Tax Details - UPDATED colSpan to 11 */}
                {Object.entries(taxDetails).map(([key, tax]: [string, { amount: number; percentage: number; type: string }]) => (
                  <TableRow key={key}>
                    <TableCell colSpan={11} />
                    <TableCell>
                      <strong>{tax.type} ({tax.percentage.toFixed(2)}%):</strong>
                    </TableCell>
                    <TableCell className='table-number-right'>{tax.amount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {/* UPDATED: Moved Overall Discount after tax details for better flow */}
                <TableRow sx={{ fontWeight: 'bold' }}>
                  <TableCell colSpan={11} />
                  <TableCell>
                    <strong>Discount:</strong>
                  </TableCell>
                  <TableCell className='table-number-right'>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <TextField
                        autoComplete='off'
                        value={overallDiscountAmount === 0 ? '' : overallDiscountAmount}
                        onChange={(e) => setOverallDiscountAmount(Number(e.target.value) || 0)}
                        onBlur={handleOverallDiscountBlur}
                        size="small"
                        type="number"
                        label="₹"
                        inputProps={{
                          min: '0',
                          max: totalOrderAmount.toString(),
                          step: '0.01',
                        }}
                        sx={{ width: 150 }}
                        error={overallDiscountAmount > totalOrderAmount}
                        helperText={overallDiscountAmount > totalOrderAmount ? 'Cannot exceed total' : ''}
                        disabled={!isReceivedQuantityValid() || applyingDiscount}
                      />
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ fontSize: '0.60rem', textAlign: 'center' }}>
                          {discountType === 'before' ? 'Before' : 'After'} Tax
                        </Typography>
                        <Switch
                          checked={discountType === 'after'}
                          onChange={(e) => {
                            const newDiscountType = e.target.checked ? 'after' : 'before';
                            if (newDiscountType === 'before' && discountType === 'after') {
                              setUpdatedItems(prev => prev.map(item => ({ ...item, afTaxDiscount: 0 })));
                            } else if (newDiscountType === 'after' && discountType === 'before') {
                              setUpdatedItems(prev => prev.map(item => ({ ...item, befTaxDiscount: 0 })));
                            }
                            setOverallDiscountAmount(0);
                            setDiscountType(newDiscountType);
                          }}
                          disabled={!isReceivedQuantityValid()}
                          size="small"
                        />
                      </Box>

                      <Tooltip title="Apply Overall Discount">
                        <IconButton
                          onClick={handleApplyDiscount}
                          size="small"
                          disabled={applyingDiscount || overallDiscountAmount <= 0 || !isReceivedQuantityValid()}
                          sx={{ color: 'success.main' }}
                        >
                          {applyingDiscount ? <CircularProgress size={20} /> : <SaveIcon />}
                        </IconButton>
                      </Tooltip>

                      {overallDiscountAmount > 0 && (
                        <IconButton
                          onClick={removeOverallDiscount}
                          size="small"
                          color="error"
                        >
                          <ClearIcon />
                        </IconButton>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
                {/* UPDATED: Renamed to "Total Amount" for clarity (includes taxes and discounts) - colSpan to 11 */}
                <TableRow>
                  <TableCell colSpan={11} />
                  <TableCell>
                    <strong>Before RoundOff:</strong>
                  </TableCell>
                  <TableCell className='table-number-right'>{totalOrderAmount.toFixed(2)}</TableCell>
                </TableRow>
                {/* Round Off Row - colSpan to 11; UPDATED: Wider input (150px) for easier typing, restricted min/max to -2/+2 */}
                <TableRow sx={{ fontWeight: 'bold' }}>
                  <TableCell colSpan={11} />
                  <TableCell>
                    <strong>Round Off Amount:</strong>
                  </TableCell>
                  <TableCell className='table-number-right'>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TextField
  autoComplete='off'
  value={roundOffAmount === 0 ? '' : roundOffAmount}
  onChange={handleRoundOffChange}
  onBlur={handleRoundOffBlur}
  size="small"
  type="number" // Changed to "number" for better input handling
  label="₹"
  inputProps={{
    min: '-2',
    max: '2',
    step: '0.01', // Allows 0.01 increments
  }}
  placeholder={roundOffSuggestion}
  sx={{ width: 150 }}
  error={!!errors.roundOff}
  helperText={errors.roundOff}
/>
                    </Box>
                  </TableCell>
                </TableRow>
                {/* UPDATED: Moved Tax Amount row before final total, but since taxes are already in totalOrderAmount, kept for reference; added space if needed - colSpan to 11 */}
                <TableRow sx={{
                  backgroundColor: '#f5f5f5',
                  '& td': {
                    fontWeight: 'bold',
                    fontSize: '1.1em'
                  }
                }}>
                  <TableCell colSpan={11} />
                  <TableCell>
                    <strong>Tax Amount:</strong>
                  </TableCell>
                  <TableCell className='table-number-right'>
                    {Object.values(taxDetails).reduce((sum, tax) => sum + tax.amount, 0).toFixed(2)}
                  </TableCell>
                </TableRow>
                {/* Final Total - colSpan to 11 */}
                <TableRow sx={{
                  backgroundColor: '#f5f5f5',
                  '& td': {
                    fontWeight: 'bold',
                    fontSize: '1.1em'
                  }
                }}>
                  <TableCell colSpan={11} />
                  <TableCell>
                    <strong>Final Amount:</strong>
                  </TableCell>
                  <TableCell className='table-number-right'
                    sx={{
                      color: finalTotalAmount < 0 ? 'error.main' : 'inherit'
                    }}>
                    {finalTotalAmount.toFixed(2)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Box display="flex" justifyContent="flex-end" mt={2}>
            <Button variant="contained" onClick={handleOpenRevertDialog} disabled={isProcessing} sx={{ mr: 2 }}>
              Revert PO
            </Button>
            <Tooltip
              title={
                isReceivedQuantityValid() && finalTotalAmount >= 0
                  ? "Convert this purchase order to a Goods Received Note (GRN)"
                  : !isReceivedQuantityValid()
                    ? "Cannot convert to GRN: All items are fully received or no valid received quantities are provided."
                    : "Cannot convert to GRN: Round off amount makes total negative."
              }
            >
              <span>
                <Button
                  variant="contained"
                  color="success"
                  onClick={handleOpenConfirmDialog}
                  disabled={
                    isProcessing ||
                    !isReceivedQuantityValid() ||
                    isInvoiceDuplicate ||
                    !invoiceNumber ||
                    finalTotalAmount < 0
                  }
                >
                  Convert to GRN
                </Button>
              </span>
            </Tooltip>
          </Box>
        </DialogActions>
      </Dialog>
      <ConfirmationDialog
        open={openConfirmDialog}
        onClose={handleCloseConfirmDialog}
        onConfirm={handleConfirmSave}
        title="Confirm Conversion to GRN"
        description={
          <Box>
            <Typography>Are you sure you want to convert this purchase order to a Goods Received Note (GRN)?</Typography>
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                <strong>Total Before Round Off:</strong> {totalOrderAmount.toFixed(2)}
              </Typography>
              <Typography variant="body2">
                <strong>Round Off Amount:</strong> {roundOffAmount.toFixed(2)}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                <strong>Final Total:</strong> {finalTotalAmount.toFixed(2)}
              </Typography>
            </Box>
          </Box>
        }
        confirmText="Convert to GRN"
        cancelText="Cancel"
      />
    </>
  );
};
const CreatePurchase: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { purchaseList, purchaseinvoice, error, snackbarOpen, snackbarMessage, searchQueryItem, randomIdSearch } = useSelector(selectPurchaseListState);
  const { businesses } = useSelector(selectBusinesses);
  const currentPage = useSelector(selectCurrentPage);
  const pageSize = useSelector(selectPageSize);
  const totalItems = useSelector(selectTotalItems);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrderWithItems | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openRevertDialog, setOpenRevertDialog] = useState(false);
  const [updatedItems, setUpdatedItems] = useState<ItemWithCalculations[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [isInvoiceDuplicate, setIsInvoiceDuplicate] = useState(false);
  const [isTouched, setIsTouched] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState<Date | null>(null);
  const [grnDate, setGrnDate] = useState<Date | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [roundOffAmount, setRoundOffAmount] = useState(0);
  const [overallDiscountAmount, setOverallDiscountAmount] = useState(0);
  const [discountType, setDiscountType] = useState<'before' | 'after'>('after');
  const [originalItemDiscounts, setOriginalItemDiscounts] = useState<Record<string, { befTaxDiscount: number; afTaxDiscount: number }>>({});
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectionRange, setSelectionRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    key: "selection",
  });
  const [selectedVendor, setSelectedVendor] = useState<VendorSearch | null>(null);
  const [selectedRandomId, setSelectedRandomId] = useState("");
  const [dialogDownloadOpen, setDialogDownloadOpen] = useState(false);
  const [dialogSummaryOpen, setDialogSummaryOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [snackbarInvoiceOpen, setSnackbarInvoiceOpen] = useState(false);
  const [snackbarInvoiceMessage, setSnackbarInvoiceMessage] = useState("");
  const [fetchedPurchaseOrderIds, setFetchedPurchaseOrderIds] = useState<Set<string>>(new Set());
  const [dialogExcessOpen, setExcessDialogOpen] = useState(false);
  const [dialogExcessMessage, setExcessDialogMessage] = useState("");
  const [touched, setTouched] = useState<Record<number, Record<string, boolean>>>({});
  const [errors, setErrors] = useState<Record<number, Record<string, string>> & { roundOff?: string }>({});
  const [allItems, setAllItems] = useState<PurchaseItemSearch[]>([]);
  const [newItem, setNewItem] = useState<PurchaseItemSearch | null>(null);
  const [open, setOpen] = useState(false);
  const [skip, setSkip] = useState(0);
  const [limit] = useState(50);
  const [isFetchingItems, setIsFetchingItems] = useState(false);
  const { imageUrls } = useSelector(selectPurchaseListState);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [fetchedBusinessIds, setFetchedBusinessIds] = useState(new Set());
  const handleCloseDialogs = useCallback(() => {
    setOpenDialog(false);
    setOpenEditDialog(false);
    setOpenRevertDialog(false);
    setDialogDownloadOpen(false);
    setDialogSummaryOpen(false);
    setExcessDialogOpen(false);
    setSelectedOrder(null);
    setUpdatedItems([]);
    setInvoiceNumber("");
    setInvoiceDate(null);
    setGrnDate(null);
    setIsTouched(false);
    setIsInvoiceDuplicate(false);
    setTouched({});
    setErrors({});
    setRoundOffAmount(0);
    setOverallDiscountAmount(0);
    setDiscountType('after'); // Always reset to 'after' on close
    setOriginalItemDiscounts({});
    console.log("Dialogs closed, states reset");
  }, []);
const calculatedItems = useMemo(() => {
  if (!selectedOrder || updatedItems.length === 0) return [];
  
  return updatedItems.map((item) => {
    const originalItem = selectedOrder.items.find((orig) => orig.itemId === item.itemId);
    if (!originalItem) return item;
    
    const receivedQuantity = Number(item.receivedQuantity) || 0;
    const pendingTotalQuantity = item.pendingTotalQuantity;
    const grnPrice = item.grnPrice !== undefined ? item.grnPrice : (item.newPrice || 0);
    const taxPercentage = item.taxPercentage || 0;
    const befTaxDiscount = Number(item.befTaxDiscount) || 0;
    const afTaxDiscount = Number(item.afTaxDiscount) || 0;

    // Skip calculation if item is fully received or has no received quantity
    if (pendingTotalQuantity === 0 || receivedQuantity === 0) {
      return {
        ...item,
        calculatedTaxableAmount: 0, // This is the subtotal (without tax)
        calculatedTotalPrice: 0,
        calculatedTaxAmount: 0,
        calculatedFinalPrice: 0,
        calculatedSubtotal: 0, // Same as taxable amount
        status: pendingTotalQuantity === 0 ? "Received" : item.status || "Pending",
      };
    }

    // CORRECT CALCULATION FLOW:
    // 1. Base amount (before any discounts)
    const baseAmount = receivedQuantity * grnPrice;
    
    // 2. Before-tax discount
    const discountAmountBeforeTax = customRoundDigit(baseAmount * (befTaxDiscount / 100));
    
    // 3. Taxable amount (SUBTOTAL - without tax)
    const taxableAmount = customRoundDigit(baseAmount - discountAmountBeforeTax);
    
    // 4. Tax amount
    const taxAmount = customRoundDigit(taxableAmount * (taxPercentage / 100));
    
    // 5. Amount after tax (before after-tax discount)
    const afterTaxAmount = customRoundDigit(taxableAmount + taxAmount);
    
    // 6. After-tax discount
    const discountAmountAfterTax = customRoundDigit(afterTaxAmount * (afTaxDiscount / 100));
    
    // 7. Final price (item total)
    const finalPrice = customRoundDigit(afterTaxAmount - discountAmountAfterTax);
    const perUnitPrice = grnPrice; // Already per-unit
      const perUnitDiscountBeforeTax = befTaxDiscount / 100; // Percentage is per-unit
      const perUnitTaxableAmount = customRoundDigit(perUnitPrice * (1 - perUnitDiscountBeforeTax)); // Per-unit taxable
      const perUnitTaxAmount = customRoundDigit(perUnitTaxableAmount * (taxPercentage / 100)); // Per-unit tax
      const perUnitTaxAmountprice = perUnitTaxableAmount + perUnitTaxAmount
    return {
      ...item,
      perUnit:perUnitTaxAmountprice,
      calculatedTaxableAmount: taxableAmount, // This is SUBTOTAL (without tax)
      calculatedTotalPrice: baseAmount, // Original amount before discounts
      calculatedTaxAmount: taxAmount,
      calculatedFinalPrice: finalPrice, // Final item total after all discounts and tax
      calculatedSubtotal: taxableAmount, // Same as taxable amount (subtotal without tax)
      status: pendingTotalQuantity === 0 ? "Received" : item.status || "Pending",
    };
  });
}, [updatedItems, selectedOrder]);
  const taxDetails = useMemo(() => {
    const details: Record<string, { amount: number; percentage: number; type: string }> = {};
    calculatedItems.forEach((item) => {
      const taxAmount = item.calculatedTaxAmount || 0;
      const taxPercentage = item.taxPercentage || 0;
      const taxType = item.taxType;
      if (taxType === "igst") {
        const igstKey = `igst-${taxPercentage}`;
        if (details[igstKey]) {
          details[igstKey].amount += taxAmount;
        } else {
          details[igstKey] = { amount: taxAmount, percentage: taxPercentage, type: "IGST" };
        }
      } else if (taxType === "cgst_sgst") {
        const sgst = taxAmount / 2;
        const cgst = taxAmount / 2;
        const sgstKey = `sgst-${taxPercentage / 2}`;
        if (details[sgstKey]) {
          details[sgstKey].amount += sgst;
        } else {
          details[sgstKey] = { amount: sgst, percentage: taxPercentage / 2, type: "SGST" };
        }
        const cgstKey = `cgst-${taxPercentage / 2}`;
        if (details[cgstKey]) {
          details[cgstKey].amount += cgst;
        } else {
          details[cgstKey] = { amount: cgst, percentage: taxPercentage / 2, type: "CGST" };
        }
      }
    });
    return details;
  }, [calculatedItems]);
  const totalOrderAmount = useMemo(
    () => customRoundDigit(calculatedItems.reduce((sum, item) => sum + (item.calculatedFinalPrice || 0), 0)),
    [calculatedItems]
  );
  const totalTaxAmount = useMemo(
    () => customRoundDigit(Object.values(taxDetails).reduce((acc, tax) => acc + tax.amount, 0)),
    [taxDetails]
  );
  const totalDiscountAmount = useMemo(
    () =>
      customRoundDigit(
        calculatedItems.reduce(
          (sum, item) => {
            const price = item.grnPrice !== undefined ? item.grnPrice : item.newPrice || 0;
            const totalPrice = (Number(item.receivedQuantity) || 0) * price;
            return sum +
              (totalPrice * (Number(item.befTaxDiscount) / 100) || 0) +
              ((item.calculatedFinalPrice || 0) * (Number(item.afTaxDiscount) / 100) || 0);
          },
          0
        )
      ),
    [calculatedItems]
  );
  useEffect(() => {
    if (selectedOrder) {
      setInvoiceNumber(selectedOrder.invoiceNo || "");
      const currentDate = new Date();
      setInvoiceDate(currentDate);
      setGrnDate(currentDate);
      const initializedItems = selectedOrder.items.map((item) => {
        const pendingTotalQuantity = item.pendingTotalQuantity || item.poQuantity || 0;
        const expiryDate = item.expiryDate ? new Date(item.expiryDate) : null;
        return {
          ...item,
          receivedQuantity: pendingTotalQuantity,
          grnPrice: undefined,
          befTaxDiscount: item.befTaxDiscount || 0,
          afTaxDiscount: item.afTaxDiscount || 0,
          expiryDate: item.expiryDate ? new Date(item.expiryDate + 'T00:00:00Z') : null,
          status: pendingTotalQuantity === 0 ? "Received" : item.status || "Pending",
        };
      });
      setUpdatedItems(initializedItems);
      // Set original discounts
      setOriginalItemDiscounts(
        initializedItems.reduce((acc, item) => ({
          ...acc,
          [item.itemId]: { befTaxDiscount: item.befTaxDiscount || 0, afTaxDiscount: item.afTaxDiscount || 0 }
        }), {})
      );
      const initialTouched = initializedItems.reduce(
        (acc, _, index) => ({
          ...acc,
          [index]: { receivedQuantity: false, grnPrice: false, befTaxDiscount: false, afTaxDiscount: false, expiryDate: false },
        }),
        {}
      );
      const initialErrorsObj = initializedItems.reduce(
        (acc, _, index) => ({
          ...acc,
          [index]: { receivedQuantity: "", grnPrice: "", befTaxDiscount: "", afTaxDiscount: "", expiryDate: "" },
        }),
        {}
      );
      const initialErrors = {
        ...initialErrorsObj,
        roundOff: ""
      };
      setTouched(initialTouched);
      setErrors(initialErrors);
      setRoundOffAmount(0);
      setOverallDiscountAmount(0);
      setDiscountType('after'); // Always default to 'after'
    }
  }, [selectedOrder]);
  useEffect(() => {
    if (businesses.length > 0 && businesses[0].businessId && !fetchedBusinessIds.has(businesses[0].businessId)) {
      dispatch(fetchPhoto(businesses[0].businessId));
      setFetchedBusinessIds((prev) => new Set(prev).add(businesses[0].businessId));
    }
  }, [businesses, dispatch, fetchedBusinessIds]);
  useEffect(() => {
    dispatch(fetchBusinesses());
    dispatch(fetchInvoiceNumbers());
    dispatch(
      fetchPurchaseOrders({
        page: currentPage,
        size: pageSize,
        dateField: "approvedDate",
      })
    );
  }, [dispatch, currentPage, pageSize]);
  useEffect(() => {
    if (invoiceNumber && selectedOrder?.vendorName) {
      const isDuplicate = purchaseinvoice.some(
        (order) =>
          order.invoiceNo === invoiceNumber &&
          order.purchaseOrderId !== selectedOrder.purchaseOrderId &&
          order.vendorName === selectedOrder.vendorName
      );
      setIsInvoiceDuplicate(isDuplicate);
    } else {
      setIsInvoiceDuplicate(false);
    }
  }, [invoiceNumber, purchaseinvoice, selectedOrder]);
  const handleQuantityChange = useCallback(
    (itemId: string, field: "receivedQuantity", value: string | number) => {
      console.log("Quantity Change:", { itemId, field, value });
      const index = updatedItems.findIndex((item) => item.itemId === itemId);
      const originalItem = selectedOrder?.items.find((original) => original.itemId === itemId);
      const originalPendingTotalQuantity = originalItem?.pendingTotalQuantity || 0;
      setTouched((prev) => ({
        ...prev,
        [index]: { ...prev[index], [field]: true },
      }));
      const received = Number(value) || 0;
      if (!/^\d*\.?\d*$/.test(String(value))) {
        setErrors((prev) => ({
          ...prev,
          [index]: { ...prev[index], [field]: "Invalid number" },
        }));
        return;
      }
      if (received < 0) {
        setErrors((prev) => ({
          ...prev,
          [index]: { ...prev[index], [field]: "Received quantity cannot be negative" },
        }));
        return;
      }
      if (originalPendingTotalQuantity === 0) {
        setErrors((prev) => ({
          ...prev,
          [index]: { ...prev[index], [field]: "Item is already fully received" },
        }));
        setExcessDialogMessage(
          `Item "${updatedItems[index].itemName}" is already fully received (pending total quantity = 0).`
        );
        setExcessDialogOpen(true);
        return;
      }
      if (received > originalPendingTotalQuantity) {
        setErrors((prev) => ({
          ...prev,
          [index]: { ...prev[index], [field]: `Cannot exceed pending quantity of ${originalPendingTotalQuantity}` },
        }));
        setExcessDialogMessage(
          `Received quantity for item "${updatedItems[index].itemName}" (${received}) exceeds the pending total quantity (${originalPendingTotalQuantity}).`
        );
        setExcessDialogOpen(true);
        return;
      }
      setUpdatedItems((prevItems) =>
        prevItems.map((item) =>
          item.itemId === itemId ? { ...item, receivedQuantity: received } : item
        )
      );
      setErrors((prev) => ({
        ...prev,
        [index]: { ...prev[index], [field]: "" },
      }));
    },
    [updatedItems, selectedOrder, setExcessDialogMessage, setExcessDialogOpen]
  );
  const handlePriceChange = useCallback(
    (itemId: string, value: string) => {
      const index = updatedItems.findIndex((item) => item.itemId === itemId);
      setTouched((prev) => ({
        ...prev,
        [index]: { ...prev[index], grnPrice: true },
      }));
      if (value === "" || /^\d*\.?\d*$/.test(value)) {
        const priceValue = value === "" ? undefined : Number(value);
        setUpdatedItems((prevItems) =>
          prevItems.map((item) =>
            item.itemId === itemId ? { ...item, grnPrice: priceValue } : item
          )
        );
        setErrors((prev) => ({
          ...prev,
          [index]: { ...prev[index], grnPrice: "" },
        }));
      } else {
        setErrors((prev) => ({
          ...prev,
          [index]: { ...prev[index], grnPrice: "Invalid number" },
        }));
      }
    },
    [updatedItems]
  );
  const handleDiscountChange = useCallback(
    (itemId: string, field: "befTaxDiscount" | "afTaxDiscount", value: string) => {
      const index = updatedItems.findIndex((item) => item.itemId === itemId);
      setTouched((prev) => ({
        ...prev,
        [index]: { ...prev[index], [field]: true },
      }));
      if (value === "" || /^\d*\.?\d*$/.test(value)) {
        setUpdatedItems((prevItems) =>
          prevItems.map((item) =>
            item.itemId === itemId ? { ...item, [field]: value === "" ? 0 : Number(value) } : item
          )
        );
        setErrors((prev) => ({
          ...prev,
          [index]: { ...prev[index], [field]: "" },
        }));
      } else {
        setErrors((prev) => ({
          ...prev,
          [index]: { ...prev[index], [field]: "Invalid number" },
        }));
      }
    },
    [updatedItems]
  );
  const handleExpiryDateChange = useCallback(
    (itemId: string, value: Date | null) => {
      const index = updatedItems.findIndex((item) => item.itemId === itemId);
      setTouched((prev) => ({
        ...prev,
        [index]: { ...prev[index], expiryDate: true },
      }));
      setErrors((prev) => ({
        ...prev,
        [index]: { ...prev[index], expiryDate: "" },
      }));
      if (value) {
        const utcDate = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
        setUpdatedItems((prevItems) =>
          prevItems.map((item) =>
            item.itemId === itemId
              ? {
                ...item,
                expiryDate: utcDate
              }
              : item
          )
        );
      } else {
        setUpdatedItems((prevItems) =>
          prevItems.map((item) =>
            item.itemId === itemId
              ? { ...item, expiryDate: null }
              : item
          )
        );
      }
    },
    [updatedItems]
  );
  // Other handlers like handleExportAllVendorsPDF, etc. - keep as is or abbreviate for brevity
  const handleSaveChanges = useCallback(async () => {
    console.log("Saving Changes:", { updatedItems, invoiceNumber, invoiceDate, roundOffAmount });
    if (!selectedOrder?.purchaseOrderId) {
      setSnackbarInvoiceMessage("Please select a valid order with a purchase order ID.");
      setSnackbarInvoiceOpen(true);
      return;
    }
    if (!invoiceNumber.trim()) {
      setSnackbarInvoiceMessage("Invoice number is required.");
      setSnackbarInvoiceOpen(true);
      setIsTouched(true);
      return;
    }
    const finalInvoiceDate = invoiceDate || new Date();
    if (!finalInvoiceDate) {
      setSnackbarInvoiceMessage("Invoice date is required.");
      setSnackbarInvoiceOpen(true);
      return;
    }
    if (isInvoiceDuplicate) {
      setSnackbarInvoiceMessage("Duplicate invoice number detected. Please enter a unique invoice number.");
      setSnackbarInvoiceOpen(true);
      return;
    }
    // Validate round off doesn't make total negative
    const finalTotal = totalOrderAmount + roundOffAmount;
    if (finalTotal < 0) {
      setSnackbarInvoiceMessage(`Round off amount cannot make total negative. Current total: ${totalOrderAmount.toFixed(2)}`);
      setSnackbarInvoiceOpen(true);
      return;
    }
    const hasErrors = Object.values(errors).some((errorObj) =>
      Object.values(errorObj).some((error) => error)
    );
    if (hasErrors) {
      setSnackbarInvoiceMessage("Please fix all validation errors before saving.");
      setSnackbarInvoiceOpen(true);
      return;
    }
    const validItems = updatedItems.filter((item) => {
      const originalItem = selectedOrder.items.find((orig) => orig.itemId === item.itemId);
      const pendingTotalQuantity = originalItem?.pendingTotalQuantity || 0;
      const receivedQuantity = Number(item.receivedQuantity) || 0;
      const befTaxDiscount = Number(item.befTaxDiscount) || 0;
      const afTaxDiscount = Number(item.afTaxDiscount) || 0;
      const grnPrice = item.grnPrice !== undefined ? item.grnPrice : undefined;
      if (befTaxDiscount < 0 || befTaxDiscount > 100) {
        setSnackbarInvoiceMessage(`Before-tax discount for item "${item.itemName}" must be between 0 and 100%.`);
        setSnackbarInvoiceOpen(true);
        return false;
      }
      if (afTaxDiscount < 0) {
        setSnackbarInvoiceMessage(`After-tax discount for item "${item.itemName}" cannot be negative.`);
        setSnackbarInvoiceOpen(true);
        return false;
      }
      if (grnPrice !== undefined && (grnPrice < 0)) {
        setSnackbarInvoiceMessage(`GRN price for item "${item.itemName}" cannot be negative.`);
        setSnackbarInvoiceOpen(true);
        return false;
      }
      return receivedQuantity > 0 && pendingTotalQuantity > 0;
    });
    if (validItems.length === 0) {
      const hasPendingItems = updatedItems.some((item) => {
        const originalItem = selectedOrder.items.find((orig) => orig.itemId === item.itemId);
        return (originalItem?.pendingTotalQuantity || 0) > 0;
      });
      if (!hasPendingItems) {
        setSnackbarInvoiceMessage("All items in this purchase order have already been fully received.");
        setSnackbarInvoiceOpen(true);
      } else {
        setSnackbarInvoiceMessage("At least one item must have a valid received quantity greater than 0.");
        setSnackbarInvoiceOpen(true);
      }
      return;
    }
    const hasExcessQuantity = validItems.some((item) => {
      const originalItem = selectedOrder.items.find((original) => original.itemId === item.itemId);
      const backendPendingTotalQuantity = originalItem?.pendingTotalQuantity || 0;
      const receivedQuantity = Number(item.receivedQuantity);
      if (receivedQuantity > backendPendingTotalQuantity) {
        setExcessDialogMessage(
          `Received quantity for item "${item.itemName}" (${receivedQuantity}) exceeds the pending total quantity (${backendPendingTotalQuantity}).`
        );
        setExcessDialogOpen(true);
        return true;
      }
      return false;
    });
    if (hasExcessQuantity) return;
    const items = validItems.map((item) => {
      const receivedQuantity = Number(item.receivedQuantity);
      const befTaxDiscount = Math.max(0, Math.min(100, Number(item.befTaxDiscount) || 0));
      const afTaxDiscount = Math.max(0, Number(item.afTaxDiscount) || 0);
      const grnPrice = item.grnPrice !== undefined ? item.grnPrice : undefined;
      return {
        itemId: item.itemId,
        receivedQuantity: receivedQuantity,
        grnPrice: grnPrice,
        befTaxDiscount: befTaxDiscount,
        afTaxDiscount: afTaxDiscount,
        expiryDate: item.expiryDate ? item.expiryDate : null,
      };
    });
    console.log("Items being sent to backend:", items);
    console.log("Round off amount:", roundOffAmount);
    try {
      setIsProcessing(true);
      const updateResult = await dispatch(
        updateReceivedDamagedQuantities({
          purchaseOrderId: selectedOrder.purchaseOrderId,
          items,
          invoiceNo: invoiceNumber.trim(),
          invoiceDate: finalInvoiceDate,
          grnDate: grnDate || new Date(),
          discountPrice: 0,
          grnRoundOffAmount: roundOffAmount, // Updated parameter name
        })
      ).unwrap();
      console.log("Update Result:", updateResult);
      // Reset round off amount after successful save
      setRoundOffAmount(0);
      const updatedOrderItems = selectedOrder.items.map((originalItem) => {
        const updatedItem = items.find((item) => item.itemId === originalItem.itemId);
        if (updatedItem) {
          const newPendingTotalQuantity = Math.max(
            0,
            (originalItem.pendingTotalQuantity || 0) - updatedItem.receivedQuantity
          );
          const newPendingCount = newPendingTotalQuantity > 0 ? originalItem.pendingCount || 1 : 0;
          const newPendingQuantity = newPendingTotalQuantity;
          const grnPrice = updatedItem.grnPrice !== undefined ? updatedItem.grnPrice : originalItem.newPrice;
          return {
            ...originalItem,
            pendingTotalQuantity: newPendingTotalQuantity,
            pendingCount: newPendingCount,
            pendingQuantity: newPendingQuantity,
            status: newPendingTotalQuantity === 0 ? "Received" : originalItem.status || "Pending",
            receivedQuantity: Number(originalItem.receivedQuantity || 0) + updatedItem.receivedQuantity,
            totalReceivedQuantity: Number(originalItem.receivedQuantity || 0) + updatedItem.receivedQuantity,
            grnPrice: grnPrice,
            befTaxDiscount: updatedItem.befTaxDiscount,
            afTaxDiscount: updatedItem.afTaxDiscount,
            expiryDate: updatedItem.expiryDate ? new Date(updatedItem.expiryDate) : null,
          };
        }
        return originalItem;
      });
      setSelectedOrder((prev) =>
        prev
          ? {
            ...prev,
            items: updatedOrderItems,
            pendingOrderAmount: updateResult.pendingOrderAmount || 0,
            totalOrderAmount: updateResult.totalOrderAmount || 0,
            invoiceNo: updateResult.invoiceNo,
            invoiceDate: updateResult.invoiceDate ? parseLocalDate(updateResult.invoiceDate) : null,
          }
          : null
      );
      setUpdatedItems(
        updatedOrderItems.map((item) => ({
          ...item,
          receivedQuantity: item.pendingTotalQuantity || 0,
          grnPrice: undefined,
          befTaxDiscount: item.befTaxDiscount || 0,
          afTaxDiscount: item.afTaxDiscount || 0,
          expiryDate: item.expiryDate && !isNaN(new Date(item.expiryDate).getTime())
            ? new Date(item.expiryDate)
            : null,
        }))
      );
      setTouched(
        updatedOrderItems.reduce(
          (acc, _, index) => ({
            ...acc,
            [index]: { receivedQuantity: false, grnPrice: false, befTaxDiscount: false, afTaxDiscount: false },
          }),
          {}
        )
      );
      setErrors(
        updatedOrderItems.reduce(
          (acc, _, index) => ({
            ...acc,
            [index]: { receivedQuantity: "", grnPrice: "", befTaxDiscount: "", afTaxDiscount: "" },
          }),
          {}
        )
      );
      await dispatch(
        fetchPurchaseOrders({
          page: currentPage,
          size: pageSize,
          dateField: "approvedDate",
        })
      ).unwrap();
      setSnackbarInvoiceMessage('Changes saved successfully!');
      setSnackbarInvoiceOpen(true);
      handleCloseDialogs();
    } catch (error: any) {
      console.error("Save Error:", error);
      let errorMessage = "Failed to save changes. ";
      if (error.message) {
        errorMessage += error.message;
      } else if (typeof error === 'string') {
        errorMessage += error;
      } else {
        errorMessage += "Please check your inputs and try again.";
      }
      setSnackbarInvoiceMessage(errorMessage);
      setSnackbarInvoiceOpen(true);
      if (selectedOrder) {
        setUpdatedItems(
          selectedOrder.items.map((item) => ({
            ...item,
            receivedQuantity: item.pendingTotalQuantity || 0,
            grnPrice: undefined,
            befTaxDiscount: item.befTaxDiscount || 0,
            afTaxDiscount: item.afTaxDiscount || 0,
            expiryDate: item.expiryDate && !isNaN(new Date(item.expiryDate).getTime())
              ? new Date(item.expiryDate)
              : null,
          }))
        );
        setTouched(
          selectedOrder.items.reduce(
            (acc, _, index) => ({
              ...acc,
              [index]: { receivedQuantity: false, grnPrice: false, befTaxDiscount: false, afTaxDiscount: false },
            }),
            {}
          )
        );
        setErrors(
          selectedOrder.items.reduce(
            (acc, _, index) => ({
              ...acc,
              [index]: { receivedQuantity: "", grnPrice: "", befTaxDiscount: "", afTaxDiscount: "" },
            }),
            {}
          )
        );
      }
    } finally {
      setIsProcessing(false);
    }
  }, [
    selectedOrder,
    invoiceNumber,
    isInvoiceDuplicate,
    updatedItems,
    invoiceDate,
    grnDate,
    roundOffAmount,
    totalOrderAmount, // Add this dependency
    errors,
    dispatch,
    currentPage,
    pageSize,
    handleCloseDialogs,
    setExcessDialogMessage,
    setExcessDialogOpen,
    setSnackbarInvoiceMessage,
    setSnackbarInvoiceOpen,
    setIsTouched,
  ]);
  const filteredOrders = useMemo(() => purchaseList.filter((order) => order.poStatus === "Approved" || order.poStatus === "PartiallyReceived"), [purchaseList]);
  console.log(filteredOrders);
  const handleViewDetailsClick = (orderId: string) => {
    const rawOrder = purchaseList.find((order) => order.purchaseOrderId === orderId);
    if (rawOrder) {
      const transformedItems = rawOrder.items.map((item: Item) => ({
        ...item,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
      })) as ItemWithCalculations[];
      const transformedOrder: PurchaseOrderWithItems = {
        ...rawOrder,
        orderDate: rawOrder.orderDate ? new Date(rawOrder.orderDate) : null,
        expectedDeliveryDate: rawOrder.expectedDeliveryDate ? new Date(rawOrder.expectedDeliveryDate) : null,
        invoiceDate: rawOrder.invoiceDate ? parseLocalDate(rawOrder.invoiceDate) : null,
        grnDate: null,
        items: transformedItems,
      };
      setSelectedOrder(transformedOrder);
      const currentDate = new Date();
      setInvoiceDate(currentDate);
      setGrnDate(currentDate);
      const initializedItems = transformedItems.map((item: ItemWithCalculations) => {
        const pendingTotalQuantity = item.pendingTotalQuantity || 0;
        const pendingCount = item.pendingCount || 1;
        const pendingQuantity = item.pendingQuantity;
        const calculatedPendingCount = pendingTotalQuantity > 0 ? pendingCount : 0;
        const calculatedPendingQuantity = pendingQuantity;
        const expiryDate = item.expiryDate instanceof Date ? item.expiryDate : null;
        return {
          ...item,
          receivedQuantity: pendingTotalQuantity,
          grnPrice: undefined,
          befTaxDiscount: item.befTaxDiscount || 0,
          afTaxDiscount: item.afTaxDiscount || 0,
          expiryDate: expiryDate && !isNaN(expiryDate.getTime()) ? expiryDate : null,
          calculatedPendingCount,
          calculatedPendingQuantity,
          calculatedTotalPrice: 0,
          calculatedTaxAmount: 0,
          calculatedFinalPrice: 0,
          status: pendingTotalQuantity === 0 ? "Received" : item.status || "Pending",
        };
      });
      setUpdatedItems(initializedItems);
      const initialTouched = initializedItems.reduce(
        (acc, _, index) => ({
          ...acc,
          [index]: {
            receivedQuantity: false,
            grnPrice: false,
            befTaxDiscount: false,
            afTaxDiscount: false,
          },
        }),
        {}
      );
      const initialErrors = initializedItems.reduce(
        (acc, _, index) => ({
          ...acc,
          [index]: {
            receivedQuantity: "",
            grnPrice: "",
            befTaxDiscount: "",
            afTaxDiscount: "",
          },
        }),
        {}
      );
      setTouched(initialTouched);
      setErrors(initialErrors);
      setRoundOffAmount(0);
      setOpenDialog(true);
    }
  };
  // ... rest of the code remains the same for handleDownload, handleExportAllVendorsPDF, handleExportAllVendorsCSV, etc.
  const handleDownload = useCallback(
    async (poid: string) => {
      const purchaseOrder = purchaseList.find((order) => order.purchaseOrderId === poid);
      if (!purchaseOrder) {
        console.error('Purchase Order not found for ID:', poid);
        return;
      }
      const business = businesses[0];
      if (!business) {
        console.error('Business information not found!');
        return;
      }
      const doc = new jsPDF();
      let yOffset = 50; // Start after header height (reserved space at top)
      let totalPages = 1;
      const headerHeight = 50; // Approximate height reserved for header (adjust if needed based on content)

      // Helper function to draw the header (logo, title, business details)
      const drawHeader = (currentDoc: jsPDF) => {
        let headerYOffset = 10;
        // Header with logo
        if (business.imageUrl) {
          currentDoc.addImage(business.imageUrl, 'JPEG', 35, headerYOffset, 25, 25);
        }
        currentDoc.setFontSize(14);
        currentDoc.setFont('helvetica', 'bold');
        currentDoc.setTextColor(0, 0, 128); // Blue color
        const title = 'Purchase Order';
        const pageWidth = currentDoc.internal.pageSize.width;
        currentDoc.text(title, 90, headerYOffset + 5); // Centered title
        currentDoc.setFontSize(12);
        currentDoc.setTextColor(0, 0, 0); // Black color
        currentDoc.text(business.companyName, 90, headerYOffset + 10);
        currentDoc.setFontSize(8);
        currentDoc.text(business.address1, 90, headerYOffset + 15);
        currentDoc.text(`Tel.No: ${business.phoneNo}`, 90, headerYOffset + 20);
        currentDoc.text(`E-Mail: ${business.emailId}`, 90, headerYOffset + 25);
        currentDoc.text(`GSTIN: ${business.gstIn}`, 90, headerYOffset + 30);
      };

      // Helper function to add page numbers to all pages
      function addPageNumbers() {
        for (let i = 1; i <= doc.getNumberOfPages(); i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(0, 0, 0);
          doc.text(`Page ${i} of ${doc.getNumberOfPages()}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
        }
      }
      // Helper function to check if yOffset exceeds page height
      function checkPageOverflow(currentYOffset: number, additionalHeight: number): number {
        if (currentYOffset + additionalHeight > doc.internal.pageSize.height - 20) {
          doc.addPage();
          totalPages++;
          return headerHeight; // Reset yOffset to after header on new page
        }
        return currentYOffset;
      }
      // Vendor Details Table
      const columnWidth = 60.6;
      const tableHeader = [['Vendor Details', 'Shipping Address', 'PO Details']];
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
        margin: { top: headerHeight, bottom: 15 }, // Reserve top space for header on all pages
        styles: {
          fontSize: 9,
          cellPadding: 4,
          halign: 'left',
          valign: 'top',
          overflow: 'linebreak',
          lineWidth: 0.1,
          lineColor: [0, 0, 0],
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
          lineColor: [0, 0, 0],
          minCellHeight: 25,
        },
        didDrawPage: () => {
          totalPages = doc.getNumberOfPages();
        },
      });
      yOffset = doc.autoTable.previous.finalY;
      // Items Table
      const itemHeader = ['S No', 'Description', 'HsnCode', 'No of Packing', 'Qty', 'Po Qty', 'Unit Price', 'Tax', 'Amount'];
      const tableRows = purchaseOrder.items
        .filter((item) => item.status !== 'Received')
        .map((item, index) => {
          const unitPrice = item.grnPrice !== undefined ? item.grnPrice : (item.newPrice || 0); // Use grnPrice if available
          const quantity = item.pendingTotalQuantity || 0;
          const totalAmount = unitPrice * quantity;
          return [
            `${index + 1}`,
            item.itemName || 'Item Description',
            item.hsnCode || '',
            item.pendingCount || '',
            `${item.pendingQuantity} ${item.uom}` || '',
            `${quantity} ${item.uom}`,
            unitPrice.toFixed(2),
            `${item.taxPercentage || 0}%`,
            totalAmount.toFixed(2),
          ];
        });
      // Items Table - Simple approach to remove horizontal lines
      doc.autoTable({
        head: [itemHeader],
        body: tableRows,
        startY: yOffset,
        theme: 'grid',
        margin: { top: headerHeight, bottom: 15 }, // Reserve top space for header on all pages
        styles: {
          fontSize: 8,
          halign: 'center',
          cellPadding: 2,
          lineWidth: 0.1,
          lineColor: [0, 0, 0],
        },
        headStyles: {
          fillColor: [0, 0, 128],
          textColor: [255, 255, 255],
          lineWidth: 0.1,
          lineColor: [0, 0, 0],
        },
        // Set all body cell borders to have 0 width for top and bottom (removing horizontal lines)
        bodyStyles: {
          lineColor: [0, 0, 0],
          lineWidth: { top: 0, right: 0.1, bottom: 0, left: 0.1 }, // No top/bottom, only left/right
        },
        // Keep header with full borders
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
        didDrawPage: () => {
          totalPages = doc.getNumberOfPages();
        },
      });
      yOffset = doc.autoTable.previous.finalY;
      // Tax and Summary Calculations
      const taxRates = {
        CGST: new Map<number, number>(),
        SGST: new Map<number, number>(),
        IGST: new Map<number, number>(),
      };
      purchaseOrder.items.forEach((item) => {
        const unitPrice = item.grnPrice !== undefined ? item.grnPrice : (item.newPrice || 0);
        const taxableAmount = unitPrice * (item.pendingTotalQuantity || 0);
        if (item.taxType === 'cgst_sgst') {
          const cgstRate = (item.taxPercentage || 0) / 2;
          const sgstRate = (item.taxPercentage || 0) / 2;
          const cgstAmount = (cgstRate / 100) * taxableAmount;
          const sgstAmount = (sgstRate / 100) * taxableAmount;
          taxRates.CGST.set(cgstRate, (taxRates.CGST.get(cgstRate) || 0) + cgstAmount);
          taxRates.SGST.set(sgstRate, (taxRates.SGST.get(sgstRate) || 0) + sgstAmount);
        } else if (item.taxType === 'igst') {
          const igstAmount = ((item.taxPercentage || 0) / 100) * taxableAmount;
          taxRates.IGST.set(item.taxPercentage || 0, (taxRates.IGST.get(item.taxPercentage || 0) || 0) + igstAmount);
        }
      });
      const totalWithoutTax = purchaseOrder.items.reduce((sum, item) => {
        const unitPrice = item.grnPrice !== undefined ? item.grnPrice : (item.newPrice || 0);
        return sum + ((item.pendingTotalQuantity || 0) * unitPrice);
      }, 0);
      const taxSummary: [string, string][] = [
        [`Total Amount`, totalWithoutTax.toFixed(2)],
        [`Total Discount`, (purchaseOrder.totalDiscount || 0).toFixed(2)],
      ];
      taxRates.CGST.forEach((amount, rate) => taxSummary.push([`CGST @${rate}%`, amount.toFixed(2)]));
      taxRates.SGST.forEach((amount, rate) => taxSummary.push([`SGST @${rate}%`, amount.toFixed(2)]));
      taxRates.IGST.forEach((amount, rate) => taxSummary.push([`IGST @${rate}%`, amount.toFixed(2)]));
      const totalWithTax = purchaseOrder.pendingOrderAmount || 0;
      const roundedTotalWithTax = Math.round(totalWithTax);
      const roundOffAmount = roundedTotalWithTax - totalWithTax;
      taxSummary.push([`Round Off Amount`, purchaseOrder.roundOffValue.toFixed(2)]);
      taxSummary.push([`Amount In Words: ${toWords(roundedTotalWithTax)} only`, `Total [Including Tax]: ${roundedTotalWithTax.toFixed(2)}`]);
      doc.autoTable({
        body: taxSummary,
        startY: yOffset,
        theme: 'grid',
        margin: { top: headerHeight, bottom: 15 }, // Reserve top space for header on all pages
        styles: { fontSize: 8, halign: 'right', cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, fontStyle: 'bold' },
        didDrawPage: () => {
          totalPages = doc.getNumberOfPages();
        },
      });
      yOffset = doc.autoTable.previous.finalY + 10;
      // Terms and Conditions
      yOffset = checkPageOverflow(yOffset, 15);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Terms & Conditions', 10, yOffset);
      yOffset += 5;
      const staticTerms = [
        '1. Please quote our Purchase Order No. in your Delivery Note.',
        '2. Defective and excess quantity will not be accepted.',
        '3. Subject to Ramanathapuram Jurisdiction Only',
      ];
      const maxWidth = 90;
      const lineHeight = 5;
      staticTerms.forEach((term) => {
        const lines = doc.splitTextToSize(term, maxWidth);
        lines.forEach((line: string) => {
          yOffset = checkPageOverflow(yOffset, lineHeight);
          doc.setFont('helvetica', 'normal');
          doc.text(line, 10, yOffset);
          yOffset += lineHeight;
        });
      });
      const customTerms = Array.isArray(purchaseOrder.termsandConditions)
        ? purchaseOrder.termsandConditions.filter((term) => typeof term === 'string' && term.trim().length > 0)
        : [];
      if (customTerms.length > 0) {
        yOffset = checkPageOverflow(yOffset, 2);
        yOffset += 2;
        customTerms.forEach((term, index) => {
          const termNumber = staticTerms.length + index + 1;
          const customTermWithNumber = `${termNumber}. ${term.trim()}`;
          const termsLines = doc.splitTextToSize(customTermWithNumber, maxWidth);
          termsLines.forEach((line: string) => {
            yOffset = checkPageOverflow(yOffset, lineHeight);
            doc.setFont('helvetica', 'normal');
            doc.text(line, 10, yOffset);
            yOffset += lineHeight;
          });
        });
      }
      // Declaration and Signature
      const declarationText = 'We declare that this invoice shows the actual price of the described items and that all particulars are true and correct.';
      const declarationLines = doc.splitTextToSize(declarationText, 180);
      const totalDeclarationHeight = (declarationLines.length * lineHeight) + 15;
      yOffset = checkPageOverflow(yOffset, totalDeclarationHeight);
      doc.setFont('helvetica', 'bold');
      doc.text('Declaration:', 10, yOffset);
      yOffset += 5;
      declarationLines.forEach((line: string) => {
        doc.setFont('helvetica', 'normal');
        doc.text(line, 10, yOffset);
        yOffset += lineHeight;
      });
      yOffset += 10;
      doc.setFont('helvetica', 'bold');
      doc.text('Authorized Signatory', 130, yOffset);

      // Draw headers on ALL pages now that all content is added (no overlap issues)
      for (let i = 1; i <= doc.getNumberOfPages(); i++) {
        doc.setPage(i);
        drawHeader(doc);
      }

      // Add "This is computer generated" note at the bottom of every page, centered
      const computerGeneratedText = "This is computer generated";
      for (let i = 1; i <= doc.getNumberOfPages(); i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica');
        doc.setTextColor(0, 0, 0); // Black color for the note
        doc.text(computerGeneratedText, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 20, { align: 'center' });
      }
      // Add page numbers
      addPageNumbers();
      doc.save(`${purchaseOrder.vendorName} ${purchaseOrder.randomId}.pdf`);
    },
    [purchaseList, businesses]
  );
  const handleExportAllVendorsPDF = useCallback(
    ({ filteredOrders, businesses, setSnackbarInvoiceMessage, setSnackbarInvoiceOpen }: ExportProps) => {
      const doc = new jsPDF();
      let yOffset = 7;
      let pageCount = 1;
      const business = businesses && businesses.length > 0 ? businesses[0] : null;
      if (!business) {
        setSnackbarInvoiceMessage("Business information not found!");
        setSnackbarInvoiceOpen(true);
        return;
      }
      const filtered: PurchaseOrderData[] = filteredOrders.filter((order) => order.poStatus === "Approved");
      if (filtered.length === 0) {
        setSnackbarInvoiceMessage("No approved orders found.");
        setSnackbarInvoiceOpen(true);
        return;
      }
      const addPageFooter = (currentPage: number, totalPages: number) => {
        const pageWidth = doc.internal.pageSize.width;
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
      };
      if (business.imageUrl) {
        try {
          doc.addImage(business.imageUrl, "JPEG", 14, yOffset, 20, 20);
        } catch (e) {
          console.error("Failed to load business logo:", e);
          setSnackbarInvoiceMessage("Failed to load business logo.");
          setSnackbarInvoiceOpen(true);
        }
      }
      yOffset += 7;
      doc.setFontSize(12);
      const title = "Purchase Order Summary for All Vendors";
      const pageWidth = doc.internal.pageSize.width;
      const fontSize = doc.getFontSize();
      const titleWidth = doc.getStringUnitWidth(title) * fontSize / doc.internal.scaleFactor;
      const titleX = (pageWidth - titleWidth) / 2;
      doc.text(title, titleX, yOffset);
      doc.line(titleX, yOffset + 2, titleX + titleWidth, yOffset + 2);
      yOffset += 13;
      const totalOrderedAmount = filtered.reduce((sum, order) => {
        const pendingOrderAmount = order.pendingOrderAmount || 0;
        return sum + pendingOrderAmount;
      }, 0);
      const today = new Date();
      const currentDate = `${today.getDate().toString().padStart(2, "0")}/${(today.getMonth() + 1).toString().padStart(2, "0")
        }/${today.getFullYear()}`;
      doc.setFontSize(10);
      const totalText = `Total Ordered Amount: ${totalOrderedAmount.toFixed(2)}`;
      const dateText = `Date: ${currentDate}`;
      const totalWidth = doc.getStringUnitWidth(totalText) * 10 / doc.internal.scaleFactor;
      const dateWidth = doc.getStringUnitWidth(dateText) * 10 / doc.internal.scaleFactor;
      doc.text(totalText, 14, yOffset);
      doc.text(dateText, pageWidth - dateWidth - 14, yOffset);
      yOffset += 5;
      const headers = [["S.No", "PoId", "Vendor Name", "Total Items", "Ordered Date", "Total Order Amount"]];
      const rows = filtered
        .map((order, index) => {
          const totalItemsQuantity =
            Array.isArray(order.items) && order.items.length > 0
              ? order.items.reduce((sum, item) => sum + (item.pendingTotalQuantity || 0), 0)
              : 0;
          const pendingOrderAmount = order.pendingOrderAmount || 0;
          const pendingDiscountAmount = order.totalDiscount || 0;
          const finalAmount = pendingOrderAmount - pendingDiscountAmount;
          if (!order.randomId || !order.vendorName || !order.orderDate || pendingOrderAmount <= 0) {
            return null;
          }
          return [
            (index + 1).toString(),
            order.randomId.toString(),
            order.vendorName.toString(),
            totalItemsQuantity.toString(),
            order.orderDate ? format(new Date(order.orderDate), "dd-MM-yyyy") : "",
            finalAmount.toFixed(2).toString(),
          ];
        })
        .filter((row): row is string[] => row !== null);
      doc.autoTable({
        head: headers,
        body: rows,
        startY: yOffset,
        styles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [0, 0, 128],
          textColor: [255, 255, 255],
          fontSize: 8,
          halign: "center",
        },
        bodyStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
        },
        columnStyles: {
          0: { cellWidth: 17, halign: "center" },
          1: { cellWidth: 28, halign: "center" },
          2: { cellWidth: 46, halign: "center" },
          3: { cellWidth: 28, halign: "right" },
          4: { cellWidth: 28, halign: "center" },
          5: { cellWidth: 35, halign: "right" },
        },
        margin: { left: 14, right: 14 },
        tableWidth: 182,
        didDrawPage: (data: { pageCount: number }) => {
          addPageFooter(pageCount++, doc.getNumberOfPages());
        },
      });
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addPageFooter(i, totalPages);
        // Add "This is computer generated" note at the bottom of every page, centered
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0); // Black color for the note
        const computerGeneratedText = "This is computer generated";
        doc.text(computerGeneratedText, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 25, { align: 'center' });
      }
      const pdfFilename = `ApprovedPOVendors.pdf`;
      doc.save(pdfFilename);
    },
    [filteredOrders, businesses, setSnackbarInvoiceMessage, setSnackbarInvoiceOpen]
  );
  const handleExportAllVendorsCSV = useCallback(
    ({ filteredOrders, setSnackbarInvoiceMessage, setSnackbarInvoiceOpen }: ExportProps) => {
      const filtered: PurchaseOrderData[] = filteredOrders.filter((order) => order.poStatus === "Approved");
      if (filtered.length === 0) {
        setSnackbarInvoiceMessage("No approved orders found.");
        setSnackbarInvoiceOpen(true);
        return;
      }
      const headers = ["S.No", "PoId", "Vendor Name", "Total Items", "Ordered Date", "Total Order Amount"];
      const rows = filtered
        .map((order, index) => {
          const totalItemsQuantity =
            Array.isArray(order.items) && order.items.length > 0
              ? order.items.reduce((sum, item) => sum + (item.pendingTotalQuantity || 0), 0)
              : 0;
          const pendingOrderAmount = order.pendingOrderAmount || 0;
          const pendingDiscountAmount = order.totalDiscount || 0;
          const finalAmount = pendingOrderAmount - pendingDiscountAmount;
          if (!order.randomId || !order.vendorName || !order.orderDate || pendingOrderAmount <= 0) {
            return null;
          }
          return [
            index + 1,
            order.randomId,
            order.vendorName,
            totalItemsQuantity,
            order.orderDate ? format(new Date(order.orderDate), "dd-MM-yyyy") : "",
            finalAmount.toFixed(2),
          ];
        })
        .filter((row): row is (string | number)[] => row !== null);
      const csvData = [headers, ...rows];
      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", `ApprovedPOVendors.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    [filteredOrders, setSnackbarInvoiceMessage, setSnackbarInvoiceOpen]
  );
  useEffect(() => {
    filteredOrders.forEach(order => {
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
  }, [filteredOrders, dispatch, fetchedPurchaseOrderIds]);
  const handleExportItemwisePDF = useCallback(() => {
    const doc = new jsPDF();
    let yOffset = 5;
    let totalPages = 1;
    const business = businesses[0];
    if (business?.imageUrl) {
      doc.addImage(business.imageUrl, "JPEG", 14, yOffset, 20, 20);
    }
    yOffset += 7;
    doc.setFontSize(12);
    const title = "Approved Purchase Order Detailed Summary";
    const pageWidth = doc.internal.pageSize.width;
    const titleWidth = doc.getStringUnitWidth(title) * 12 / doc.internal.scaleFactor;
    doc.text(title, (pageWidth - titleWidth) / 2, yOffset);
    doc.line((pageWidth - titleWidth) / 2, yOffset + 2, (pageWidth + titleWidth) / 2, yOffset + 2);
    yOffset += 15;
    const totalOrderedAmount = filteredOrders.reduce((sum, order) => sum + (order.pendingOrderAmount || 0), 0);
    const today = new Date();
    const currentDate = `${today.getDate().toString().padStart(2, "0")}/${(today.getMonth() + 1).toString().padStart(2, "0")}/${today.getFullYear()}`;
    doc.setFontSize(10);
    doc.text(`Total Ordered Amount: ${totalOrderedAmount.toFixed(2)}`, 14, yOffset);
    doc.text(`Date: ${currentDate}`, pageWidth - 50, yOffset);
    yOffset += 10;
    const headers = [
      ["S.No", "Purchase Order No", "Vendor Name", "Item Name", "Quantity", "Price", "Tax", "Discount", "Final Price"],
    ];
    const rows = filteredOrders
      .map((order, index) =>
        order.items
          .filter((item) => item.status !== "Received")
          .map((item) => {
            const unitPrice = item.grnPrice !== undefined ? item.grnPrice : (item.newPrice || 0);
            const totalPrice = (item.pendingTotalQuantity || 0) * unitPrice;
            const discountAmount = item.totalDiscount || 0;
            const taxAmount = ((item.taxPercentage || 0) / 100) * (totalPrice - discountAmount);
            const finalPrice = totalPrice - discountAmount + taxAmount;
            return [
              (index + 1).toString(),
              order.randomId || "",
              order.vendorName || "",
              item.itemName || "",
              (item.pendingTotalQuantity || 0).toString(),
              unitPrice.toFixed(2),
              `${item.taxPercentage || 0}%`,
              discountAmount.toFixed(2),
              finalPrice.toFixed(2),
            ];
          })
      )
      .flat();
    doc.autoTable({
      head: headers,
      body: rows,
      startY: yOffset,
      theme: "grid",
      styles: { fontSize: 8, halign: "center", cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 },
      headStyles: { fillColor: [0, 0, 128], textColor: [255, 255, 255], fontStyle: "bold" },
      bodyStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0] },
      columnStyles: {
        0: { halign: "center" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right" },
        8: { halign: "right" },
      },
      margin: { bottom: 15 },
      didDrawPage: (data: { pageCount: number }) => {
        totalPages = data.pageCount;
        doc.setPage(data.pageCount);
        doc.setFontSize(8);
        doc.text(
          `Page ${data.pageCount} of ${totalPages}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: "center" }
        );
        // Add "This is computer generated" note at the bottom of every page, centered
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0); // Black color for the note
        const computerGeneratedText = "This is computer generated";
        doc.text(computerGeneratedText, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 25, { align: 'center' });
      },
    });
    doc.save("ApprovedPOItemwise.pdf");
    setDialogSummaryOpen(false);
  }, [businesses, filteredOrders]);
  const handleExportItemwiseCSV = useCallback(() => {
    const headers = [
      "S.No",
      "Purchase Order No",
      "Vendor Name",
      "Item Name",
      "Quantity",
      "Price",
      "Tax",
      "Discount",
      "Final Price",
    ];
    const rows = filteredOrders
      .map((order, index) =>
        order.items
          .filter((item) => item.status !== "Received")
          .map((item) => {
            const unitPrice = item.grnPrice !== undefined ? item.grnPrice : (item.newPrice || 0);
            const totalPrice = (item.pendingTotalQuantity || 0) * unitPrice;
            const discountAmount = item.totalDiscount || 0;
            const taxAmount = ((item.taxPercentage || 0) / 100) * (totalPrice - discountAmount);
            const finalPrice = totalPrice - discountAmount + taxAmount;
            return [
              index + 1,
              order.randomId || "",
              order.vendorName || "",
              item.itemName || "",
              item.pendingTotalQuantity || 0,
              unitPrice.toFixed(2),
              `${item.taxPercentage || 0}%`,
              discountAmount.toFixed(2),
              finalPrice.toFixed(2),
            ];
          })
      )
      .flat();
    const csvData = [headers, ...rows];
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "ApprovedPOItemwise.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDialogSummaryOpen(false);
  }, [filteredOrders]);
  const handleVendorChange = useCallback((vendor: VendorSearch | null) => {
    setSelectedVendor(vendor);
    dispatch(fetchPurchaseOrders({
      page: 1,
      size: pageSize,
      dateField: "approvedDate",
      vendorName: vendor ? vendor.vendorName : "",
      status: "Approved",
      itemName: searchQueryItem,
      randomId: selectedRandomId,
    }));
  }, [dispatch, pageSize, selectionRange, searchQueryItem, selectedRandomId]);
  const handleRandomIdChange = useCallback((randomId: string) => {
    setSelectedRandomId(randomId);
    dispatch(fetchPurchaseOrders({
      page: 1,
      size: pageSize,
      dateField: "approvedDate",
      vendorName: selectedVendor ? selectedVendor.vendorName : "",
      status: "Approved",
      itemName: searchQueryItem,
      randomId,
    }));
  }, [dispatch, pageSize, selectionRange, selectedVendor, searchQueryItem]);
  const handleInvoiceNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInvoiceNumber(e.target.value);
    if (setIsTouched) {
      setIsTouched(true);
    }
  };
  const handleItemSelect = useCallback((item: PurchaseItemSearch | null) => {
    setNewItem(item);
    dispatch(fetchPurchaseOrders({
      page: 1,
      size: pageSize,
      dateField: "approvedDate",
      vendorName: selectedVendor ? selectedVendor.vendorName : "",
      status: "Approved",
      itemName: item ? item.itemName : "",
      randomId: selectedRandomId,
    }));
  }, [dispatch, pageSize, selectionRange, selectedVendor, selectedRandomId]);
  const handleFilterClick = useCallback(() => {
    dispatch(setPagination({ page: 1, size: pageSize }));
    dispatch(fetchPurchaseOrders({
      page: 1,
      size: pageSize,
      dateField: "approvedDate",
      fromDate: moment(selectionRange.startDate).startOf("day").toDate(),
      toDate: moment(selectionRange.endDate).endOf("day").toDate(),
      vendorName: selectedVendor ? selectedVendor.vendorName : "",
      status: "Approved",
      itemName: newItem ? newItem.itemName : "",
      randomId: selectedRandomId,
    }));
  }, [dispatch, pageSize, selectionRange, selectedVendor, newItem, selectedRandomId]);
  const handleFilterClose = useCallback(() => {
    setSelectionRange({ startDate: new Date(), endDate: new Date(), key: "selection" });
    setSelectedVendor(null);
    setNewItem(null);
    setSelectedRandomId("");
    dispatch(fetchPurchaseOrders({
      page: 1,
      size: pageSize,
      dateField: "approvedDate",
      fromDate: moment().utc().startOf("day").toDate(),
      toDate: moment().utc().endOf("day").toDate(),
      status: "Approved",
    }));
  }, [dispatch, pageSize]);
  const isReceivedQuantityValid = useCallback(() => {
    const hasPendingItems = updatedItems.some((item) => {
      const originalItem = selectedOrder?.items.find((orig) => orig.itemId === item.itemId);
      const pendingTotalQuantity = originalItem?.pendingTotalQuantity || 0;
      return pendingTotalQuantity > 0;
    });
    if (!hasPendingItems) {
      return false;
    }
    return updatedItems.some((item) => {
      const originalItem = selectedOrder?.items.find((orig) => orig.itemId === item.itemId);
      const pendingTotalQuantity = originalItem?.pendingTotalQuantity || 0;
      const receivedQuantity = Number(item.receivedQuantity) || 0;
      return receivedQuantity > 0 && pendingTotalQuantity > 0;
    });
  }, [updatedItems, selectedOrder]);
  const handleApplyDiscount = useCallback(async () => {
    if (overallDiscountAmount <= 0 || !isReceivedQuantityValid()) {
      setSnackbarInvoiceMessage('Invalid discount amount or no valid items.');
      setSnackbarInvoiceOpen(true);
      return;
    }
    setApplyingDiscount(true);
    try {
      const requestItems = updatedItems
        .filter((item) => (Number(item.receivedQuantity) || 0) > 0)
        .map((item) => ({
          itemId: item.itemId,
          poQuantity: item.poQuantity || 0,
          pendingTotalQuantity: Number(item.receivedQuantity) || 0,
          newPrice: item.grnPrice !== undefined ? item.grnPrice : item.newPrice || 0,
          befTaxDiscount: item.befTaxDiscount || 0,
          afTaxDiscount: item.afTaxDiscount || 0,
          taxPercentage: item.taxPercentage || 0,
          taxType: item.taxType || 'igst',
          befTaxDiscountType: 'percentage' as const,
          afTaxDiscountType: 'percentage' as const,
        }));
      const request = {
        items: requestItems,
        applyOverallDiscount: true,
        overallDiscountAmount,
        discount_type: discountType,
      };
      // Assuming calculateOverallDiscount thunk returns Promise<OverallDiscountResponse>
      const result: OverallDiscountResponse = await dispatch(calculateOverallDiscount(request)).unwrap();
      console.log('Discount Response:', result); // Debug: Remove in prod
      if (result.success) {
        const newItems = updatedItems.map((item) => {
          // Now typed: r is OverallDiscountResponseItem
          const updatedItem = result.items.find((r: OverallDiscountResponseItem) => r.itemId === item.itemId);
          if (updatedItem) {
            return {
              ...item,
              befTaxDiscount: updatedItem.befTaxDiscount, // Updated total %
              afTaxDiscount: updatedItem.afTaxDiscount, // Updated total %
            };
          }
          // Fallback: Unchanged if no match (edge case)
          console.warn(`No discount update for item ${item.itemId}`);
          return item;
        });
        setUpdatedItems(newItems);
        // Recalculate totals (triggers useMemo for totalOrderAmount, etc.)
        setSnackbarInvoiceMessage(
          `Overall discount of ₹${overallDiscountAmount.toFixed(2)} applied as ${discountType} tax. New total: ₹${result.summary.totalFinalAmount.toFixed(2)}`
        );
        setSnackbarInvoiceOpen(true);
      } else {
        setSnackbarInvoiceMessage(result.error || 'Failed to apply discount.');
        setSnackbarInvoiceOpen(true);
      }
    } catch (error: any) {
      console.error('Apply Discount Error:', error);
      setSnackbarInvoiceMessage(error.message || 'Failed to apply discount.');
      setSnackbarInvoiceOpen(true);
    } finally {
      setApplyingDiscount(false);
    }
  }, [
    overallDiscountAmount,
    discountType,
    updatedItems,
    dispatch,
    isReceivedQuantityValid,
    setSnackbarInvoiceMessage,
    setSnackbarInvoiceOpen,
  ]);
  const removeOverallDiscount = useCallback(() => {
    setUpdatedItems((prev) =>
      prev.map((item) => ({
        ...item,
        befTaxDiscount: originalItemDiscounts[item.itemId]?.befTaxDiscount || 0,
        afTaxDiscount: originalItemDiscounts[item.itemId]?.afTaxDiscount || 0,
        itemOverallDiscountAmount: 0, // Reset overall discount amount
      }))
    );
    setOverallDiscountAmount(0);
    setDiscountType('after'); // Always reset to 'after' when clearing
    setSnackbarInvoiceMessage("Overall discount removed.");
    setSnackbarInvoiceOpen(true);
  }, [originalItemDiscounts]);
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress color="primary" />
      </Box>
    );
  }
  if (error) return <Typography>Error: {error}</Typography>;
  return (
    <Box sx={{ pl: 0, py: 1 }}>
      <YenPurchasePage />
      <Box sx={{ display: "flex", flexDirection: "column", px: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 1 }}>
          <Link href="/yen-purchase/PurchaseOrder" passHref>
            <Button variant="contained" color="primary">Pending</Button>
          </Link>
          <Link href="/yen-purchase/PurchaseOrder/Approvedpo" passHref>
            <Button variant="contained" sx={{ backgroundColor: "white", color: "black", "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.8)" } }}>
              Approved
            </Button>
          </Link>
          <Link href="/yen-purchase/PurchaseOrder/RejectedPo" passHref>
            <Button variant="contained" color="primary">Rejected</Button>
          </Link>
        </Box>
        {/* Filter and search UI - keep as is */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "nowrap", width: "100%", mb: 1 }}>
          <Grid container spacing={1} alignItems="center" wrap="nowrap" sx={{ width: "auto", flexGrow: 1 }}>
            <Grid item>
              <DateRangeDialog selectionRange={selectionRange} setSelectionRange={setSelectionRange} onApply={handleFilterClick} />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <VendorSearchAutocomplete value={selectedVendor} onChange={handleVendorChange} label="All Vendors" />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Autocomplete
                fullWidth
                options={allItems}
                getOptionLabel={(option: PurchaseItemSearch) => option.itemName || ""}
                isOptionEqualToValue={(option: PurchaseItemSearch, value: PurchaseItemSearch | null) =>
                  option.purchaseitemId === value?.purchaseitemId
                }
                value={newItem}
                onInputChange={(event, newInputValue) => {
                  if (event && event.type !== "click") {
                    setIsFetchingItems(true);
                    dispatch(POsearchPurchaseItems({ searchQuery: newInputValue, skip: 0, limit }))
                      .unwrap()
                      .then((newItems) => {
                        setAllItems(newItems);
                        setSkip(limit);
                      })
                      .finally(() => setIsFetchingItems(false));
                  }
                }}
                onChange={(_, value) => handleItemSelect(value)}
                open={open}
                onOpen={() => {
                  setOpen(true);
                  if (allItems.length === 0 && !isFetchingItems) {
                    setIsFetchingItems(true);
                    dispatch(POsearchPurchaseItems({ searchQuery: searchQueryItem || "", skip: 0, limit }))
                      .unwrap()
                      .then((newItems) => {
                        setAllItems(newItems);
                        setSkip(limit);
                      })
                      .finally(() => setIsFetchingItems(false));
                  }
                }}
                onClose={() => setOpen(false)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="All Items"
                    variant="outlined"
                    size="small"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {isFetchingItems ? <CircularProgress size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props} key={option.purchaseitemId}>{option.itemName}</li>
                )}
                ListboxProps={{
                  onScroll: (event: React.UIEvent<HTMLUListElement>) => {
                    const target = event.currentTarget;
                    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 10) {
                      if (!isFetchingItems) {
                        setIsFetchingItems(true);
                        dispatch(POsearchPurchaseItems({ searchQuery: searchQueryItem, skip, limit }))
                          .unwrap()
                          .then((newItems) => {
                            if (newItems.length > 0) {
                              setAllItems((prevItems) => [...prevItems, ...newItems]);
                              setSkip((prevSkip) => prevSkip + limit);
                            }
                          })
                          .finally(() => setIsFetchingItems(false));
                      }
                    }
                  },
                }}
              />
            </Grid>
            <Grid item xs={6} sm={4} md={1}>
              <PurchaseOrderRandomIdSearch value={selectedRandomId} onChange={handleRandomIdChange} label="PO ID" />
            </Grid>
            <Grid item>
              <IconButton className="icon-button-outline" onClick={handleFilterClick} color="primary" size="small" sx={{ p: 0.3 }}>
                <FilterAltIcon fontSize="small" />
              </IconButton>
              <Typography variant="caption" align="center" sx={{ maxWidth: 60, wordBreak: "break-word", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.1, mt: 0.2 }}>
                Filter
              </Typography>
            </Grid>
            <Grid item>
              <IconButton className="icon-button-outline" onClick={handleFilterClose} color="primary" size="small" sx={{ p: 0.3 }}>
                <ClearIcon fontSize="small" />
              </IconButton>
              <Typography variant="caption" align="center" sx={{ maxWidth: 60, wordBreak: "break-word", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.1, mt: 0.2 }}>
                Clear
              </Typography>
            </Grid>
            <Grid item sx={{ flexGrow: 1 }} />
            <Grid item xs="auto">
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <IconButton
                  onClick={(e) => setAnchorEl(e.currentTarget)}
                  color="primary"
                  size="small"
                  sx={{ p: 0.3 }}
                  className="icon-button-outline"
                  disabled={!filteredOrders || filteredOrders.length === 0}
                >
                  {loading ? <CircularProgress size={16} /> : <DownloadIcon fontSize="small" />}
                </IconButton>
                <Typography variant="caption" align="center" sx={{ maxWidth: 60, wordBreak: "break-word", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.1, mt: 0.2 }}>
                  Download
                </Typography>
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={() => setAnchorEl(null)}
                  anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                  transformOrigin={{ vertical: "top", horizontal: "right" }}
                >
                  <MenuItem onClick={() => setDialogDownloadOpen(true)}>Vendorwise</MenuItem>
                  <MenuItem onClick={() => setDialogSummaryOpen(true)}>Itemwise</MenuItem>
                </Menu>
              </Box>
            </Grid>
          </Grid>
        </Box>

        <TableContainer component={Paper} sx={{ maxHeight: "calc(100vh - 250px)", overflowY: "auto", width: "100%", marginLeft: 2 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell className='table-number-right'>S.No</TableCell>
                <TableCell>Order ID</TableCell>
                <TableCell>Vendor Name</TableCell>
                <TableCell>Order Date</TableCell>
                <TableCell>Approved Date</TableCell>
                <TableCell className='table-number-right'>Total PO Items</TableCell>
                <TableCell className='table-number-right'>Total Price</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>View</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">No Approved Orders</TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order, index) => (
                  <TableRow key={order.purchaseOrderId}>
                    <TableCell className='table-number-right'>{index + 1}</TableCell>
                    <TableCell>{order.randomId}</TableCell>
                    <TableCell>{order.vendorName}</TableCell>
                    <TableCell>{order.orderDate ? format(new Date(order.orderDate), "dd-MM-yyyy") : ""}</TableCell>
                    <TableCell>{order.approvedDate ? format(new Date(order.approvedDate), "dd-MM-yyyy") : ""}</TableCell>
                    <TableCell className='table-number-right'>{order.items.reduce((acc, item) => acc + (item.pendingTotalQuantity || 0), 0)}</TableCell>
                    <TableCell className='table-number-right'>{(order.pendingOrderAmount || 0).toFixed(2)}</TableCell>
                    <TableCell>{order.poStatus}</TableCell>
                    <TableCell>
                      <Tooltip title="View Details">
                        <IconButton onClick={() => handleViewDetailsClick(order.purchaseOrderId)} color="primary" sx={{ mr: 1 }}>
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Download">
                        <IconButton color="primary" onClick={() => handleDownload(order.purchaseOrderId)}>
                          <PictureAsPdfIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {/* Pagination - keep as is */}
        <OrderDetailsDialog
          open={openDialog}
          onClose={handleCloseDialogs}
          selectedOrder={selectedOrder}
          updatedItems={updatedItems}
          setUpdatedItems={setUpdatedItems}
          invoiceNumber={invoiceNumber}
          setInvoiceNumber={setInvoiceNumber}
          invoiceDate={invoiceDate}
          setInvoiceDate={setInvoiceDate}
          grnDate={grnDate}
          setGrnDate={setGrnDate}
          isInvoiceDuplicate={isInvoiceDuplicate}
          isTouched={isTouched}
          setIsTouched={setIsTouched}
          taxDetails={taxDetails}
          totalOrderAmount={totalOrderAmount}
          totalDiscountAmount={totalDiscountAmount}
          handleSaveChanges={handleSaveChanges}
          handleOpenRevertDialog={() => setOpenRevertDialog(true)}
          isProcessing={isProcessing}
          isReceivedQuantityValid={isReceivedQuantityValid}
          touched={touched}
          setTouched={setTouched}
          errors={errors}
          setErrors={setErrors}
          handleQuantityChange={handleQuantityChange}
          handlePriceChange={handlePriceChange}
          handleDiscountChange={handleDiscountChange}
          handleExpiryDateChange={handleExpiryDateChange}
          calculatedItems={calculatedItems}
          roundOffAmount={roundOffAmount}
          setRoundOffAmount={setRoundOffAmount}
          overallDiscountAmount={overallDiscountAmount}
          setOverallDiscountAmount={setOverallDiscountAmount}
          discountType={discountType}
          setDiscountType={setDiscountType}
          originalItemDiscounts={originalItemDiscounts}
          setOriginalItemDiscounts={setOriginalItemDiscounts}
          handleApplyDiscount={handleApplyDiscount}
          removeOverallDiscount={removeOverallDiscount}
          applyingDiscount={applyingDiscount}
        />
        <Dialog open={openEditDialog} onClose={handleCloseDialogs}>
          <DialogTitle>Confirm Submission</DialogTitle>
          <DialogContent>
            <DialogContentText>Are you sure you want to submit this item?</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialogs} color="primary">Cancel</Button>
            <Button onClick={handleSaveChanges} color="primary">Confirm</Button>
          </DialogActions>
        </Dialog>
        <Dialog open={openRevertDialog} onClose={handleCloseDialogs}>
          <DialogTitle>Confirm Reversion</DialogTitle>
          <DialogContent>
            <DialogContentText>Are you sure you want to revert this PO?</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialogs} color="primary">Cancel</Button>
            <Button
              onClick={() => {
                if (selectedOrder) {
                  dispatch(updatePurchaseOrderStatusToPending(selectedOrder.purchaseOrderId))
                    .then(() => {
                      dispatch(
                        fetchPurchaseOrders({
                          page: currentPage,
                          size: pageSize,
                          dateField: "approvedDate",
                          vendorName: selectedVendor ? selectedVendor.vendorName : "",
                          status: "Approved",
                          itemName: newItem ? newItem.itemName : "",
                          randomId: selectedRandomId,
                        })
                      );
                      setSnackbarInvoiceMessage("Purchase Order reverted successfully!");
                      setSnackbarInvoiceOpen(true);
                      handleCloseDialogs();
                    })
                    .catch((error) => {
                      console.error("Revert Error:", error);
                      setSnackbarInvoiceMessage("Failed to revert Purchase Order.");
                      setSnackbarInvoiceOpen(true);
                    });
                }
              }}
              color="primary"
              disabled={isProcessing}
            >
              Confirm
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
              onClick={() => {
                setLoading(true);
                handleExportAllVendorsCSV({
                  filteredOrders,
                  businesses, // Added businesses to satisfy ExportProps
                  setSnackbarInvoiceMessage,
                  setSnackbarInvoiceOpen,
                });
                setLoading(false);
              }}
              variant="contained"
              color="primary"
              startIcon={<DescriptionIcon />}
              disabled={loading}
            >
              Download CSV
            </Button>
            <Button
              onClick={() => {
                setLoading(true);
                handleExportAllVendorsPDF({
                  filteredOrders,
                  businesses,
                  setSnackbarInvoiceMessage,
                  setSnackbarInvoiceOpen,
                });
                setLoading(false);
              }}
              variant="contained"
              color="secondary"
              startIcon={<PictureAsPdfIcon />}
              disabled={loading}
            >
              Generate PDF
            </Button>
            <Button
              onClick={() => setDialogDownloadOpen(false)}
              variant="outlined"
              disabled={loading}
            >
              Cancel
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={dialogSummaryOpen} onClose={() => setDialogSummaryOpen(false)}>
          <DialogTitle>Download Item-wise Report</DialogTitle>
          <DialogContent>
            <DialogContentText>Select the format for the item-wise report:</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleExportItemwiseCSV} color="primary" variant="contained">
              DOWNLAOD CSV
            </Button>
            <Button onClick={handleExportItemwisePDF} color="secondary" variant="contained">
              GENERATE PDF
            </Button>
            <Button onClick={() => setDialogSummaryOpen(false)} color="primary">
              Cancel
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={dialogExcessOpen} onClose={() => setExcessDialogOpen(false)}>
          <DialogTitle>Excess Quantity Detected</DialogTitle>
          <DialogContent>
            <DialogContentText>{dialogExcessMessage}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setExcessDialogOpen(false)} color="primary">
              OK
            </Button>
          </DialogActions>
        </Dialog>
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={() => dispatch(clearSnackbarMessage())}
          message={snackbarMessage}
        />
        <Snackbar
          open={snackbarInvoiceOpen}
          autoHideDuration={6000}
          onClose={() => setSnackbarInvoiceOpen(false)}
          message={snackbarInvoiceMessage}
        />
      </Box>
    </Box>
  );
};
export default CreatePurchase;