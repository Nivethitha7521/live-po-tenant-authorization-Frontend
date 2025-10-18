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
} from "@mui/material";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import ClearIcon from "@mui/icons-material/Clear";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DownloadIcon from "@mui/icons-material/Download";
import DescriptionIcon from "@mui/icons-material/Description";
import VisibilityIcon from "@mui/icons-material/Visibility";
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
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
} from "../../../../features/yen-purchase/PurchaseOrder/purchaseListSlice";
import { AppDispatch } from "@/redux/store";
import YenPurchasePage from "../../page";
import {
  fetchBusinesses,
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
interface ExportProps {
  filteredOrders: PurchaseOrderData[];
  businesses: any[]; // Adjust type based on your business model
  setSnackbarInvoiceMessage: (message: string) => void;
  setSnackbarInvoiceOpen: (open: boolean) => void;
}

interface ItemWithCalculations {
  itemId: string;
  itemName: string;
  uom: string;
  poQuantity: number;
  pendingCount?: number;
  pendingQuantity?: number;
  pendingTotalQuantity: number;
  newPrice: number;
  taxPercentage: number;
  taxType: string;
  hsnCode?: string;
  status?: string;
  pendingTotalPrice?: number;
  totalDiscount?: number;
  receivedQuantity?: number | string;
  befTaxDiscount?: number;
  afTaxDiscount?: number;
  expiryDate?: Date | null;
  calculatedPendingCount?: number;
  calculatedPendingQuantity?: number;
  calculatedTotalPrice?: number;
  calculatedTaxAmount?: number;
  calculatedFinalPrice?: number;
}

interface PurchaseOrderWithItems {
  purchaseOrderId: string;
  randomId: string;
  vendorName: string;
  orderDate: Date | null;
  expectedDeliveryDate?: Date | null;
  paymentTerms?: string;
  poStatus: string;
  pendingOrderAmount?: number;
  totalDiscount?: number;
  invoiceNo?: string;
  invoiceDate?: Date | null;
  gstNumber?: string;
  grnDate?: Date | null;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  contactpersonEmail?: string;
  vendorContact?: string;
  billingAddress?: string;
  termsandConditions?: string[];
  items: ItemWithCalculations[];
}

// Utility function for rounding
const customRound = (value: number): number => Math.round(value);
const customRoundDigit = (value: number): number => Math.round(value * 2) / 2;
const TableRowMemo = React.memo(
  ({
    item,
    index,
    touched,
    errors,
    handleQuantityChange,
    handleDiscountChange,
    handleExpiryDateChange,
    handleQuantityBlur,
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
  }) => (
    <TableRow>
      <TableCell>{index + 1}</TableCell>
      <TableCell>{item.itemName}</TableCell>
      <TableCell>{item.uom}</TableCell>
      <TableCell>{item.pendingTotalQuantity}</TableCell>
      <TableCell>{item.poQuantity}</TableCell>
      <TableCell>
        <TextField
          type="number"
          value={item.receivedQuantity === undefined || item.receivedQuantity === null ? "" : item.receivedQuantity}
          onChange={(e) => handleQuantityChange(item.itemId, "receivedQuantity", e.target.value)}
          onBlur={(e) => handleQuantityBlur(item.itemId, "receivedQuantity", e.target.value)}
          inputProps={{ step: "0.01" }}
          sx={{ width: "80px" }}
          disabled={item.pendingTotalQuantity === 0 || item.status === "Received"}
          error={touched[index]?.receivedQuantity && !!errors[index]?.receivedQuantity}
          helperText={touched[index]?.receivedQuantity && errors[index]?.receivedQuantity}
        />
      </TableCell>
      <TableCell>{item.newPrice.toFixed(2)}</TableCell>
      <TableCell>
        <TextField
          type="number"
          value={item.befTaxDiscount === 0 || item.befTaxDiscount === undefined ? "" : item.befTaxDiscount}
          onChange={(e) => handleDiscountChange(item.itemId, "befTaxDiscount", e.target.value)}
          error={touched[index]?.befTaxDiscount && !!errors[index]?.befTaxDiscount}
          helperText={touched[index]?.befTaxDiscount && errors[index]?.befTaxDiscount}
          inputProps={{ step: "0.01" }}
          sx={{ width: "80px" }}
        />
      </TableCell>
      <TableCell>
        <TextField
          type="number"
          value={item.afTaxDiscount === 0 || item.afTaxDiscount === undefined ? "" : item.afTaxDiscount}
          onChange={(e) => handleDiscountChange(item.itemId, "afTaxDiscount", e.target.value)}
          error={touched[index]?.afTaxDiscount && !!errors[index]?.afTaxDiscount}
          helperText={touched[index]?.afTaxDiscount && errors[index]?.afTaxDiscount}
          inputProps={{ step: "0.01" }}
          sx={{ width: "80px" }}
        />
      </TableCell>
      <TableCell>{item.taxPercentage}%</TableCell>
      <TableCell>
        <TextField
          label="Expiry Date"
          type="date"
          value={item.expiryDate ? new Date(item.expiryDate).toISOString().split("T")[0] : ""}
          onChange={(e) =>
            handleExpiryDateChange(
              item.itemId,
              e.target.value ? new Date(e.target.value) : null
            )
          }
          sx={{ mt: 1 }}
          InputLabelProps={{ shrink: true }}
          inputProps={{
            min: new Date().toISOString().split("T")[0],
          }}
        />
      </TableCell>
      <TableCell>{(item.calculatedTotalPrice || 0).toFixed(2)}</TableCell>
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
  errors: Record<number, Record<string, string>>;
  setErrors: React.Dispatch<React.SetStateAction<Record<number, Record<string, string>>>>;
  handleQuantityChange: (itemId: string, field: "receivedQuantity", value: string | number) => void;
  handleDiscountChange: (itemId: string, field: "befTaxDiscount" | "afTaxDiscount", value: string) => void;
  handleExpiryDateChange: (itemId: string, value: Date | null) => void;
  calculatedItems: ItemWithCalculations[]; // Added calculatedItems
}
// Define props interface
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
  errors: Record<number, Record<string, string>>;
  setErrors: React.Dispatch<React.SetStateAction<Record<number, Record<string, string>>>>;
  handleQuantityChange: (itemId: string, field: "receivedQuantity", value: string | number) => void;
  handleDiscountChange: (itemId: string, field: "befTaxDiscount" | "afTaxDiscount", value: string) => void;
  handleExpiryDateChange: (itemId: string, value: Date | null) => void;
  calculatedItems: ItemWithCalculations[];
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
  handleDiscountChange,
  handleExpiryDateChange,
  calculatedItems,
}) => {
  // State for confirmation dialog
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

      // Allow empty string
      if (value === "") {
        setErrors((prev) => ({
          ...prev,
          [index]: { ...prev[index], [field]: "" },
        }));
        return;
      }

      // Validate non-empty input
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
    [updatedItems, selectedOrder]
  );

  // Function to open the confirmation dialog
  const handleOpenConfirmDialog = () => {
    setOpenConfirmDialog(true);
  };

  // Function to close the confirmation dialog
  const handleCloseConfirmDialog = () => {
    setOpenConfirmDialog(false);
  };

  // Function to handle confirmation
  const handleConfirmSave = () => {
    setOpenConfirmDialog(false);
    handleSaveChanges(); // Proceed with save changes on confirmation
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={isProcessing ? undefined : onClose}
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
        }}>
          <span>Approved Order Details {selectedOrder?.randomId || ''}</span>
          <span>Vendor Name: {selectedOrder?.vendorName || 'Unknown Vendor'}</span>
          <IconButton onClick={toggleFullScreen} color="primary" edge="end">
            {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{
          padding: isFullScreen ? '0 24px' : '20px', // Adjust content padding
          height: isFullScreen ? 'calc(100vh - 120px)' : 'auto', // Account for header/footer height
          overflow: 'auto'
        }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
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
                value={invoiceDate ? invoiceDate.toISOString().split('T')[0] : ''}
                onChange={(e) => setInvoiceDate(e.target.value ? new Date(e.target.value) : null)}
                disabled={!selectedOrder?.orderDate}
                inputProps={{
                  max: selectedOrder?.orderDate
                    ? format(startOfDay(new Date(selectedOrder.orderDate)), 'yyyy-MM-dd')
                    : undefined,
                }}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="GRN Date"
                type="date"
                value={grnDate ? grnDate.toISOString().split("T")[0] : ""}
                onChange={(e) => setGrnDate(e.target.value ? new Date(e.target.value) : null)}
                disabled={!selectedOrder?.orderDate || isProcessing}
                inputProps={{
                  max: selectedOrder?.orderDate
                    ? format(startOfDay(new Date(selectedOrder.orderDate)), "yyyy-MM-dd")
                    : undefined,
                }}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          </Box>
          <TableContainer component={Paper} sx={{ maxHeight: '400px', overflowY: 'auto' }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Item Id</TableCell>
                  <TableCell>Item Name</TableCell>
                  <TableCell>Uom</TableCell>
                  <TableCell>Pending Qty</TableCell>
                  <TableCell>Total Qty</TableCell>
                  <TableCell>Received Qty</TableCell>
                  <TableCell>Price</TableCell>
                  <TableCell>BefTax Discount</TableCell>
                  <TableCell>AfTax Discount</TableCell>
                  <TableCell>Tax</TableCell>
                  <TableCell>Expiry Date</TableCell>
                  <TableCell>Total Price</TableCell>
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
                    .filter((item) => item.status !== "Received") // Filter out items with status "Received"
                    .map((item: ItemWithCalculations, index: number) => (
                      <TableRowMemo
                        key={item.itemId}
                        item={item}
                        index={index}
                        touched={touched}
                        errors={errors}
                        handleQuantityChange={handleQuantityChange}
                        handleDiscountChange={handleDiscountChange}
                        handleExpiryDateChange={handleExpiryDateChange}
                        handleQuantityBlur={handleQuantityBlur}
                      />
                    ))
                )}
                {Object.entries(taxDetails).map(([key, tax]: [string, { amount: number; percentage: number; type: string }]) => (
                  <TableRow key={key}>
                    <TableCell colSpan={10} />
                    <TableCell>
                      <strong>{tax.type} ({tax.percentage.toFixed(2)}%):</strong>
                    </TableCell>
                    <TableCell>{tax.amount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={10} />
                  <TableCell>
                    <strong>Total Order Amount:</strong>
                  </TableCell>
                  <TableCell>{totalOrderAmount.toFixed(2)}</TableCell>
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
                isReceivedQuantityValid()
                  ? "Convert this purchase order to a Goods Received Note (GRN)"
                  : "Cannot convert to GRN: All items are fully received or no valid received quantities are provided."
              }
            >
              <span>
                <Button
                  variant="contained"
                  color="success"
                  onClick={handleOpenConfirmDialog}
                  disabled={isProcessing || !isReceivedQuantityValid() || isInvoiceDuplicate || !invoiceNumber}
                >
                  Convert to GRN
                </Button>
              </span>
            </Tooltip>
          </Box>
        </DialogActions>
      </Dialog>
      {/* Add ConfirmationDialog */}
      <ConfirmationDialog
        open={openConfirmDialog}
        onClose={handleCloseConfirmDialog}
        onConfirm={handleConfirmSave}
        title="Confirm Conversion to GRN"
        description="Are you sure you want to convert this purchase order to a Goods Received Note (GRN)?"
        confirmText="OK"
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
  const [selectionRange, setSelectionRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    key: "selection",
  });
  const [selectedVendor, setSelectedVendor] = useState<VendorSearch | null>(null);
  const [selectedRandomId, setSelectedRandomId] = useState("");
  const [status] = useState("Approved");
  const [dialogDownloadOpen, setDialogDownloadOpen] = useState(false);
  const [dialogSummaryOpen, setDialogSummaryOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [snackbarInvoiceOpen, setSnackbarInvoiceOpen] = useState(false);
  const [snackbarInvoiceMessage, setSnackbarInvoiceMessage] = useState("");
  const [fetchedPurchaseOrderIds, setFetchedPurchaseOrderIds] = useState<Set<string>>(new Set());
  const [dialogExcessOpen, setExcessDialogOpen] = useState(false);
  const [dialogExcessMessage, setExcessDialogMessage] = useState("");
  const [touched, setTouched] = useState<Record<number, Record<string, boolean>>>({});
  const [errors, setErrors] = useState<Record<number, Record<string, string>>>({});
  const [allItems, setAllItems] = useState<PurchaseItemSearch[]>([]);
  const [newItem, setNewItem] = useState<PurchaseItemSearch | null>(null);
  const [open, setOpen] = useState(false);
  const [skip, setSkip] = useState(0);
  const [limit] = useState(50);
  const [isFetchingItems, setIsFetchingItems] = useState(false);
  const { imageUrls } = useSelector(selectPurchaseListState);
  const [loading, setLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
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
    console.log("Dialogs closed, states reset");
  }, []);
  const calculatedItems = useMemo(() => {
    if (!selectedOrder || updatedItems.length === 0) return [];
    return updatedItems.map((item) => {
      const originalItem = selectedOrder.items.find((orig) => orig.itemId === item.itemId);
      if (!originalItem) return item;
      const receivedQuantity = Number(item.receivedQuantity) || 0; // Ensure number conversion
      const poQuantity = originalItem.poQuantity || 0;
      const pendingTotalQuantity = originalItem.pendingTotalQuantity || poQuantity;
      const pendingCount = originalItem.pendingCount || 1;
      const pendingQuantity = originalItem.pendingQuantity || poQuantity;
      const newPrice = originalItem.newPrice || 0;
      const taxPercentage = originalItem.taxPercentage || 0;
      const befTaxDiscount = Number(item.befTaxDiscount) || 0;
      const afTaxDiscount = Number(item.afTaxDiscount) || 0;
      // Use receivedQuantity for calculations (now initialized to pendingTotalQuantity)
      const calculatedPendingQuantity = receivedQuantity > 0 ? receivedQuantity : pendingQuantity;
      const calculatedPendingCount = pendingTotalQuantity > 0 ? pendingCount : 0;
      const totalPrice = receivedQuantity * newPrice;
      const discountAmountBeforeTax = totalPrice * (befTaxDiscount / 100);
      const discountedPriceBeforeTax = totalPrice - discountAmountBeforeTax;
      const taxAmount = discountedPriceBeforeTax * (taxPercentage / 100);
      let finalPrice = discountedPriceBeforeTax + taxAmount;
      const discountAmountAfterTax = finalPrice * (afTaxDiscount / 100);
      finalPrice = finalPrice - discountAmountAfterTax;
      return {
        ...item,
        calculatedPendingCount,
        calculatedPendingQuantity,
        calculatedTotalPrice: totalPrice,
        calculatedTaxAmount: taxAmount,
        calculatedFinalPrice: finalPrice,
        status: pendingTotalQuantity === 0 ? "Received" : item.status || "Pending",
      };
    });
  }, [updatedItems, selectedOrder]);
  const taxDetails = useMemo(() => {
    const details: Record<string, { amount: number; percentage: number; type: string }> = {};
    calculatedItems.forEach((item) => {
      const taxPercentage = item.taxPercentage || 0;
      const taxType = item.taxType;
      const discountedPriceBeforeTax = (item.calculatedTotalPrice || 0) * (1 - (Number(item.befTaxDiscount) / 100));

      if (taxType === "igst") {
        const igst = (taxPercentage / 100) * discountedPriceBeforeTax;
        const igstKey = `igst-${taxPercentage}`;
        if (details[igstKey]) {
          details[igstKey].amount += igst;
        } else {
          details[igstKey] = { amount: igst, percentage: taxPercentage, type: "IGST" };
        }
      } else if (taxType === "cgst_sgst") {
        const totalTaxAmount = (taxPercentage / 100) * discountedPriceBeforeTax;
        const sgst = totalTaxAmount / 2;
        const cgst = totalTaxAmount / 2;

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
    () => customRound(calculatedItems.reduce((sum, item) => sum + (item.calculatedFinalPrice || 0), 0)),
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
          (sum, item) =>
            sum +
            ((item.calculatedTotalPrice || 0) * (Number(item.befTaxDiscount) / 100) || 0) +
            ((item.calculatedFinalPrice || 0) * (Number(item.afTaxDiscount) / 100) || 0),
          0
        )
      ),
    [calculatedItems]
  );
  useEffect(() => {
    if (selectedOrder) {
      setInvoiceNumber(selectedOrder.invoiceNo || "");
      setInvoiceDate(selectedOrder.invoiceDate ? new Date(selectedOrder.invoiceDate) : null);
      setGrnDate(selectedOrder.grnDate ? new Date(selectedOrder.grnDate) : new Date());
      const initializedItems = selectedOrder.items.map((item) => {
        const pendingTotalQuantity = item.pendingTotalQuantity || item.poQuantity || 0;
        const expiryDate = item.expiryDate ? new Date(item.expiryDate) : null;
        return {
          ...item,
          receivedQuantity: pendingTotalQuantity, // Initialize with pendingTotalQuantity
          befTaxDiscount: item.befTaxDiscount || 0,
          afTaxDiscount: item.afTaxDiscount || 0,
          expiryDate: expiryDate && !isNaN(expiryDate.getTime()) ? expiryDate : null,
          status: pendingTotalQuantity === 0 ? "Received" : item.status || "Pending",
        };
      });
      setUpdatedItems(initializedItems);
      const initialTouched = initializedItems.reduce(
        (acc, _, index) => ({
          ...acc,
          [index]: { receivedQuantity: false, befTaxDiscount: false, afTaxDiscount: false },
        }),
        {}
      );
      const initialErrors = initializedItems.reduce(
        (acc, _, index) => ({
          ...acc,
          [index]: { receivedQuantity: "", befTaxDiscount: "", afTaxDiscount: "" },
        }),
        {}
      );
      setTouched(initialTouched);
      setErrors(initialErrors);
    }
  }, [selectedOrder]);
  useEffect(() => {
    dispatch(fetchBusinesses());
    dispatch(fetchInvoiceNumbers());
    dispatch(
      fetchPurchaseOrders({
        page: currentPage,
        size: pageSize,
        dateField: "approvedDate",
        fromDate: moment().utc().startOf("day").toDate(),
        toDate: moment().utc().endOf("day").toDate(),
        status: "Approved",
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

  useEffect(() => {
    dispatch(fetchBusinesses());
  }, [dispatch]);

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
      // Allow empty string
      if (value === "") {
        setUpdatedItems((prevItems) =>
          prevItems.map((item) =>
            item.itemId === itemId ? { ...item, receivedQuantity: "" } : item
          )
        );
        setErrors((prev) => ({
          ...prev,
          [index]: { ...prev[index], [field]: "" },
        }));
        return;
      }
      // Validate non-empty input
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

  const handleQuantityBlur = useCallback(
    (itemId: string, field: "receivedQuantity", value: string | number) => {
      const index = updatedItems.findIndex((item) => item.itemId === itemId);
      const originalItem = selectedOrder?.items.find((original) => original.itemId === itemId);
      const originalPendingTotalQuantity = originalItem?.pendingTotalQuantity || 0;
      // Allow empty string
      if (value === "") {
        setErrors((prev) => ({
          ...prev,
          [index]: { ...prev[index], [field]: "" },
        }));
        return;
      }
      // Validate non-empty input
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
    [updatedItems, selectedOrder]
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
      setUpdatedItems((prevItems) =>
        prevItems.map((item) =>
          item.itemId === itemId
            ? { ...item, expiryDate: value && !isNaN(value.getTime()) ? value : null } // Validate Date
            : item
        )
      );
    },
    []
  );
 // Fixed handleSaveChanges function with proper validation and calculation
const handleSaveChanges = useCallback(async () => {
  console.log("Saving Changes:", { updatedItems, invoiceNumber, invoiceDate });

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

  if (!invoiceDate) {
    setSnackbarInvoiceMessage("Invoice date is required.");
    setSnackbarInvoiceOpen(true);
    return;
  }

  if (isInvoiceDuplicate) {
    setSnackbarInvoiceMessage("Duplicate invoice number detected. Please enter a unique invoice number.");
    setSnackbarInvoiceOpen(true);
    return;
  }

  // Check for validation errors
  const hasErrors = Object.values(errors).some((errorObj) =>
    Object.values(errorObj).some((error) => error)
  );
  if (hasErrors) {
    setSnackbarInvoiceMessage("Please fix all validation errors before saving.");
    setSnackbarInvoiceOpen(true);
    return;
  }

  // Filter items that have valid received quantities and pending quantities
  const validItems = updatedItems.filter((item) => {
    const originalItem = selectedOrder.items.find((orig) => orig.itemId === item.itemId);
    const pendingTotalQuantity = originalItem?.pendingTotalQuantity || 0;
    const receivedQuantity = item.receivedQuantity === "" ? 0 : Number(item.receivedQuantity);
    
    // Validate discount ranges
    const befTaxDiscount = Number(item.befTaxDiscount) || 0;
    const afTaxDiscount = Number(item.afTaxDiscount) || 0;
    
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

    return receivedQuantity > 0 && pendingTotalQuantity > 0;
  });

  // If no valid items are found, show a message and prevent GRN conversion
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

  // Check for excess quantities one more time
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

  // Prepare items for submission with validated data
  const items = validItems.map((item) => {
    // Ensure proper number conversion and validation
    const receivedQuantity = Number(item.receivedQuantity);
    const befTaxDiscount = Math.max(0, Math.min(100, Number(item.befTaxDiscount) || 0));
    const afTaxDiscount = Math.max(0, Number(item.afTaxDiscount) || 0);
    
    return {
      itemId: item.itemId,
      receivedQuantity: receivedQuantity,
      befTaxDiscount: befTaxDiscount,
      afTaxDiscount: afTaxDiscount,
      expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
    };
  });

  // Log the items being sent to backend for debugging
  console.log("Items being sent to backend:", items);

  try {
    setIsProcessing(true);
    
    const updateResult = await dispatch(
      updateReceivedDamagedQuantities({
        purchaseOrderId: selectedOrder.purchaseOrderId,
        items,
        invoiceNo: invoiceNumber.trim(),
        invoiceDate: invoiceDate,
        grnDate: grnDate || new Date(),
        discountPrice: 0, // PO-level discount, set to 0 if not used
      })
    ).unwrap();
    
    console.log("Update Result:", updateResult);

    // Update selectedOrder with new backend state
    const updatedOrderItems = selectedOrder.items.map((originalItem) => {
      const updatedItem = items.find((item) => item.itemId === originalItem.itemId);
      if (updatedItem) {
        const newPendingTotalQuantity = Math.max(
          0,
          (originalItem.pendingTotalQuantity || 0) - updatedItem.receivedQuantity
        );
        const newPendingCount = newPendingTotalQuantity > 0 ? originalItem.pendingCount || 1 : 0;
        const newPendingQuantity = newPendingTotalQuantity;
        
        return {
          ...originalItem,
          pendingTotalQuantity: newPendingTotalQuantity,
          pendingCount: newPendingCount,
          pendingQuantity: newPendingQuantity,
          status: newPendingTotalQuantity === 0 ? "Received" : originalItem.status || "Pending",
          receivedQuantity: Number(originalItem.receivedQuantity || 0) + updatedItem.receivedQuantity,
          totalReceivedQuantity: Number(originalItem.receivedQuantity || 0) + updatedItem.receivedQuantity,
          befTaxDiscount: updatedItem.befTaxDiscount,
          afTaxDiscount: updatedItem.afTaxDiscount,
          expiryDate: updatedItem.expiryDate ? new Date(updatedItem.expiryDate) : null,
        };
      }
      return originalItem;
    });

    // Update the selected order state
    setSelectedOrder((prev) =>
      prev
        ? {
            ...prev,
            items: updatedOrderItems,
            pendingOrderAmount: updateResult.pendingOrderAmount || 0,
            totalOrderAmount: updateResult.totalOrderAmount || 0,
            invoiceNo: updateResult.invoiceNo,
            invoiceDate: updateResult.invoiceDate,
          }
          : null
    );

    // Reset form state for next session
    setUpdatedItems(
      updatedOrderItems.map((item) => ({
        ...item,
        receivedQuantity: "", // Reset to empty string
        befTaxDiscount: item.befTaxDiscount || 0,
        afTaxDiscount: item.afTaxDiscount || 0,
        expiryDate: item.expiryDate && !isNaN(new Date(item.expiryDate).getTime()) 
          ? new Date(item.expiryDate) 
          : null,
      }))
    );

    // Reset validation state
    setTouched(
      updatedOrderItems.reduce(
        (acc, _, index) => ({
          ...acc,
          [index]: { receivedQuantity: false, befTaxDiscount: false, afTaxDiscount: false },
        }),
        {}
      )
    );
    
    setErrors(
      updatedOrderItems.reduce(
        (acc, _, index) => ({
          ...acc,
          [index]: { receivedQuantity: "", befTaxDiscount: "", afTaxDiscount: "" },
        }),
        {}
      )
    );

    // Refresh the purchase orders list
    await dispatch(
      fetchPurchaseOrders({
        page: currentPage,
        size: pageSize,
        dateField: "approvedDate",
        fromDate: moment().utc().startOf("day").toDate(),
        toDate: moment().utc().endOf("day").toDate(),
        status: "Approved",
      })
    ).unwrap();

    setSnackbarInvoiceMessage('Changes saved successfully!');
    setSnackbarInvoiceOpen(true);
    handleCloseDialogs();
    
  } catch (error:any) {
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
    
    // Revert updatedItems to original selectedOrder.items state on error
    if (selectedOrder) {
      setUpdatedItems(
        selectedOrder.items.map((item) => ({
          ...item,
          receivedQuantity: "", // Reset to empty string
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
            [index]: { receivedQuantity: false, befTaxDiscount: false, afTaxDiscount: false },
          }),
          {}
        )
      );
      
      setErrors(
        selectedOrder.items.reduce(
          (acc, _, index) => ({
            ...acc,
            [index]: { receivedQuantity: "", befTaxDiscount: "", afTaxDiscount: "" },
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
  const filteredOrders = useMemo(() => purchaseList.filter((order) => order.poStatus === "Approved"), [purchaseList]);
  const handleViewDetailsClick = (orderId: string) => {
    const selectedOrder = purchaseList.find((order) => order.purchaseOrderId === orderId);
    if (selectedOrder) {
      setSelectedOrder(selectedOrder);
      const initializedItems = selectedOrder.items.map((item: Item) => {
        const pendingTotalQuantity = item.pendingTotalQuantity || item.poQuantity || 0;
        const pendingCount = item.pendingCount || 1;
        const pendingQuantity = item.pendingQuantity || pendingTotalQuantity;
        const calculatedPendingCount = pendingTotalQuantity > 0 ? pendingCount : 0;
        const calculatedPendingQuantity = pendingQuantity;
        const expiryDate = item.expiryDate ? new Date(item.expiryDate) : null;

        return {
          ...item,
          receivedQuantity: 0, // Initialize to 0 for new session
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
            befTaxDiscount: "",
            afTaxDiscount: "",
          },
        }),
        {}
      );
      setTouched(initialTouched);
      setErrors(initialErrors);
      setOpenDialog(true);
    }
  };
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
      let yOffset = 10;
      let totalPages = 1;

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
          return 20; // Reset yOffset for new page
        }
        return currentYOffset;
      }

      // Helper function to convert WebP to JPEG
      async function convertWebPToJPEG(url: string): Promise<string> {
        try {
          const response = await fetch(url, {
            mode: 'cors',
            headers: {
              'Accept': 'image/webp,image/jpeg,image/png',
            },
          });
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
          }
          const blob = await response.blob();
          const img = new Image();
          const objectUrl = URL.createObjectURL(blob);
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load image for conversion'));
            img.src = objectUrl;
          });
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Canvas context not available');
          }
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(objectUrl);
          return canvas.toDataURL('image/jpeg', 0.9); // Convert to JPEG with 90% quality
        } catch (err) {
          console.error(`Failed to convert WebP image ${url}:`, err);
          throw err;
        }
      }

      // Helper function to get base64 data and handle WebP
      async function getBase64FromUrl(url: string): Promise<string> {
        try {
          if (!url || !/^https?:\/\/|^data:image\//.test(url)) {
            throw new Error(`Invalid image URL: ${url}`);
          }
          if (url.startsWith('data:image')) {
            if (url.includes('data:image/webp')) {
              const img = new Image();
              await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('Failed to load base64 WebP image'));
                img.src = url;
              });
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                throw new Error('Canvas context not available');
              }
              ctx.drawImage(img, 0, 0);
              return canvas.toDataURL('image/jpeg', 0.9);
            }
            return url; // Already base64, return as is
          }
          if (url.toLowerCase().endsWith('.webp')) {
            return await convertWebPToJPEG(url);
          }
          const res = await fetch(url, {
            mode: 'cors',
            headers: {
              'Accept': 'image/jpeg,image/png',
            },
          });
          if (!res.ok) {
            throw new Error(`Failed to fetch image: ${res.statusText}`);
          }
          const blob = await res.blob();
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (err) {
          console.error(`Failed to fetch or convert image ${url}:`, err);
          throw err;
        }
      }

      // Helper function to determine image format
      function getImageFormat(url: string): 'JPEG' | 'PNG' {
        if (url.toLowerCase().endsWith('.png') || url.includes('data:image/png')) {
          return 'PNG';
        }
        return 'JPEG'; // Default to JPEG (handles converted WebP)
      }

      // Header with logo
      try {
        if (business.imageUrl) {
          const logoData = await getBase64FromUrl(business.imageUrl);
          doc.addImage(logoData, getImageFormat(business.imageUrl), 35, yOffset, 25, 25);
        }
      } catch (e) {
        console.error('Failed to load business logo:', e);
      }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 128); // Blue color
      const title = 'Purchase Order';
      const pageWidth = doc.internal.pageSize.width;
      doc.text(title, 90, yOffset + 5); // Centered title
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0); // Black color
      doc.text(business.companyName , 90, yOffset + 10);
      doc.setFontSize(8);
      doc.text(business.address1 , 90, yOffset + 15);
      doc.text(`Tel.No: ${business.phoneNo }`, 90, yOffset + 20);
      doc.text(`E-Mail: ${business.emailId }`, 90, yOffset + 25);
      doc.text(`GSTIN: ${business.gstIn }`, 90, yOffset + 30);
      yOffset += 35;

      // Vendor Details Table
      const columnWidth = 60.6;
      const tableHeader = [['Vendor Details', 'Billing Address', 'PO Details']];
      const vendorDetailsRows = [
        [
          `${purchaseOrder.vendorName }\n` +
          `GSTIN: ${purchaseOrder.gstNumber }\n` +
          `Address: ${purchaseOrder.address }\n` +
          `City: ${purchaseOrder.city }\n` +
          `State: ${purchaseOrder.state }\n` +
          `Country: ${purchaseOrder.country }\n` +
          `Email: ${purchaseOrder.contactpersonEmail }\n` +
          `Phone: ${purchaseOrder.vendorContact }`,
          `Billing Address: ${purchaseOrder.billingAddress }`,
          `PO No: ${purchaseOrder.randomId }\n` +
          `PO Date: ${purchaseOrder.orderDate ? format(new Date(purchaseOrder.orderDate), 'dd-MM-yyyy') : 'Not Provided'}\n` +
          `Due Date: ${purchaseOrder.expectedDeliveryDate ? format(new Date(purchaseOrder.expectedDeliveryDate), 'dd-MM-yyyy') : 'Not Provided'}\n` +
          `Payment Terms: ${purchaseOrder.paymentTerms }\n` +
          `Status: ${purchaseOrder.poStatus }\n` +
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
        margin: { bottom: 15 },
        didDrawPage: () => {
          totalPages = doc.getNumberOfPages();
        },
      });

      yOffset = doc.autoTable.previous.finalY;

      // Items Table
      const itemHeader = ['SI No', 'Description', 'HsnCode', 'No of Packing', 'Qty', 'Po Qty', 'Unit Price', 'Tax', 'Amount'];
      const tableRows = purchaseOrder.items
        .filter((item) => item.status !== 'Received')
        .map((item, index) => {
          const unitPrice = item.newPrice || 0;
          const quantity = item.pendingTotalQuantity || 0;
          const totalAmount = unitPrice * quantity;
          return [
            `${index + 1}`,
            item.itemName || 'Item Description',
            item.hsnCode || 'N/A',
            item.pendingCount || 'N/A',
            item.pendingQuantity || 'N/A',
            `${quantity} ${item.uom || 'Kgs'}`,
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
        margin: { bottom: 15 },
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
        const taxableAmount = (item.newPrice || 0) * (item.pendingTotalQuantity || 0);
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

      const totalWithoutTax = purchaseOrder.items.reduce((sum, item) => sum + ((item.pendingTotalQuantity || 0) * (item.newPrice || 0)), 0);
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
        styles: { fontSize: 8, halign: 'right', cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, fontStyle: 'bold' },
        margin: { bottom: 15 },
        didDrawPage: () => {
          totalPages = doc.getNumberOfPages();
        },
      });

      yOffset = doc.autoTable.previous.finalY + 10;

      // Purchase Order Images and URLs
      const poImages = imageUrls[poid] || [];
      if (poImages.length > 0) {
        yOffset = checkPageOverflow(yOffset, 15);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Purchase Order Images:', 10, yOffset);
        yOffset += 5;

        const imageWidth = 40;
        const imageHeight = 40;
        let xPos = 10;

        const validImageIndexes = ['_1.webp', '_2.webp'];
        for (let i = 0; i < poImages.length; i++) {
          const url = poImages[i];
          if (validImageIndexes.some((index) => url.toLowerCase().endsWith(index))) {
            try {
              const imgData = await getBase64FromUrl(url);
              const format = getImageFormat(url);
              yOffset = checkPageOverflow(yOffset, imageHeight + 5);
              doc.addImage(imgData, format, xPos, yOffset, imageWidth, imageHeight);
              xPos += imageWidth + 5;
              if (xPos + imageWidth > pageWidth - 10) {
                xPos = 10;
                yOffset += imageHeight + 5;
              }
            } catch (err) {
              console.error(`Failed to add image ${i + 1}:`, err);
            }
          }
        }

        if (poImages.length > 0) {
          yOffset = checkPageOverflow(yOffset, 10);
          yOffset += 5;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 255);
          poImages.forEach((url, index) => {
            const maxUrlLength = 80;
            const displayUrl = url.length > maxUrlLength ? `${url.substring(0, maxUrlLength - 3)}...` : url;
            yOffset = checkPageOverflow(yOffset, 5);
            doc.text(displayUrl, 10, yOffset, { maxWidth: 180 });
            const textWidth = doc.getStringUnitWidth(displayUrl) * 8 / doc.internal.scaleFactor;
            doc.link(10, yOffset - 4, textWidth, 5, { url });
            yOffset += 5;
          });
          yOffset += 5;
        }
      }

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

      try {
        const imageUrl = '/images/approved.jpg';
        doc.addImage(imageUrl, 'JPEG', 130, yOffset + 10, 30, 25);
      } catch (e) {
        console.error('Failed to load approved image:', e);
      }

      // Add page numbers
      addPageNumbers();

      doc.save(`purchase_order_${purchaseOrder.randomId}.pdf`);
    },
    [purchaseList, businesses, imageUrls]
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
        doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - 30, doc.internal.pageSize.height - 10, {
          align: "right",
        });
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
            const totalPrice = (item.pendingTotalQuantity || 0) * (item.newPrice || 0);
            const discountAmount = item.totalDiscount || 0;
            const taxAmount = ((item.taxPercentage || 0) / 100) * (totalPrice - discountAmount);
            const finalPrice = totalPrice - discountAmount + taxAmount;
            return [
              (index + 1).toString(),
              order.randomId || "",
              order.vendorName || "",
              item.itemName || "",
              (item.pendingTotalQuantity || 0).toString(),
              (item.newPrice || 0).toFixed(2),
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
            const totalPrice = (item.pendingTotalQuantity || 0) * (item.newPrice || 0);
            const discountAmount = item.totalDiscount || 0;
            const taxAmount = ((item.taxPercentage || 0) / 100) * (totalPrice - discountAmount);
            const finalPrice = totalPrice - discountAmount + taxAmount;
            return [
              index + 1,
              order.randomId || "",
              order.vendorName || "",
              item.itemName || "",
              item.pendingTotalQuantity || 0,
              (item.newPrice || 0).toFixed(2),
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
      fromDate: moment(selectionRange.startDate).startOf("day").toDate(),
      toDate: moment(selectionRange.endDate).endOf("day").toDate(),
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
      fromDate: moment(selectionRange.startDate).startOf("day").toDate(),
      toDate: moment(selectionRange.endDate).endOf("day").toDate(),
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
      fromDate: moment(selectionRange.startDate).startOf("day").toDate(),
      toDate: moment(selectionRange.endDate).endOf("day").toDate(),
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
    // Check if there are any items with pendingTotalQuantity > 0
    const hasPendingItems = updatedItems.some((item) => {
      const originalItem = selectedOrder?.items.find((orig) => orig.itemId === item.itemId);
      const pendingTotalQuantity = originalItem?.pendingTotalQuantity || 0;
      return pendingTotalQuantity > 0;
    });

    // If no items have pending quantities, return false
    if (!hasPendingItems) {
      return false;
    }

    // Check if at least one item has a valid receivedQuantity > 0 and pendingTotalQuantity > 0
    return updatedItems.some((item) => {
      const originalItem = selectedOrder?.items.find((orig) => orig.itemId === item.itemId);
      const pendingTotalQuantity = originalItem?.pendingTotalQuantity || 0;
      const receivedQuantity = item.receivedQuantity === "" ? 0 : Number(item.receivedQuantity);
      return receivedQuantity > 0 && pendingTotalQuantity > 0;
    });
  }, [updatedItems, selectedOrder]);
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
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "nowrap", width: "100%", mb: 1 }}>
          <Grid container spacing={1} alignItems="center" wrap="nowrap" sx={{ width: "auto", flexGrow: 1 }}>
            <Grid item>
              <DateRangeDialog selectionRange={selectionRange} setSelectionRange={setSelectionRange} onApply={handleFilterClick}/>
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
      </Box>
      <TableContainer component={Paper} sx={{ maxHeight: "calc(100vh - 200px)", overflowY: "auto", width: "100%", marginLeft: 2 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>S.No</TableCell>
              <TableCell>Order ID</TableCell>
              <TableCell>Vendor Name</TableCell>
              <TableCell>Order Date</TableCell>
              <TableCell>Total PO Items</TableCell>
              <TableCell>Total Price</TableCell>
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
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{order.randomId}</TableCell>
                  <TableCell>{order.vendorName}</TableCell>
                  <TableCell>{order.orderDate ? format(new Date(order.orderDate), "dd-MM-yyyy") : ""}</TableCell>
                  <TableCell>{order.items.reduce((acc, item) => acc + (item.pendingTotalQuantity || 0), 0)}</TableCell>
                  <TableCell>{(order.pendingOrderAmount || 0).toFixed(2)}</TableCell>
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
      <Box sx={{ display: "flex", justifyContent: "end", alignItems: "center", mt: 2 }}>
        <IconButton onClick={() => dispatch(setPagination({ page: currentPage - 1, size: pageSize }))} disabled={currentPage === 1}>
          <ChevronLeft />
        </IconButton>
        <Typography variant="body1" sx={{ mx: 2 }}>Page {currentPage}</Typography>
        <IconButton onClick={() => dispatch(setPagination({ page: currentPage + 1, size: pageSize }))} disabled={currentPage * pageSize >= totalItems}>
          <ChevronRight />
        </IconButton>
      </Box>
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
        handleDiscountChange={handleDiscountChange}
        handleExpiryDateChange={handleExpiryDateChange}
        calculatedItems={calculatedItems}
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
                        fromDate: moment(selectionRange.startDate).startOf("day").toDate(),
                        toDate: moment(selectionRange.endDate).endOf("day").toDate(),
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
  );
};

export default CreatePurchase;