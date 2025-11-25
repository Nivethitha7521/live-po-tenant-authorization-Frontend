import { PurchaseOrderData, Item, TaxDetails, Freight } from "@/Models/purchaseModel";

export interface GRNItemPatch {
  itemId: string;
  receivedQuantity: number;
  damagedQuantity?: number;
  befTaxDiscount?: number;
  afTaxDiscount?: number;
  expiryDate?: string;
  grnPrice?: number;
}
export interface GRNPatchData {
  grnDate?: string;
  invoiceDate?: string;
  invoiceNo?: string;
  discountPrice?: number;
  items: GRNItemPatch[];
  grnRoundOffAmount?: number;
}
export interface ExportProps {
  filteredOrders: PurchaseOrderData[];
  businesses: any[];
  setSnackbarInvoiceMessage: (message: string) => void;
  setSnackbarInvoiceOpen: (open: boolean) => void;
}
export interface ItemWithCalculations {
  itemId: string;
  itemName: string;
  uom: string;
  poQuantity: number;
  pendingCount?: number;
  pendingQuantity?: number;
  pendingTotalQuantity: number;
  newPrice: number;
  grnPrice?: number;
  taxPercentage: number;
  taxType: string;
  hsnCode?: string;
  status?: string;
  pendingTotalPrice?: number;
  totalDiscount?: number;
  receivedQuantity?: number | string | undefined;
  befTaxDiscount?: number;
  afTaxDiscount?: number;
  expiryDate?: Date | null;
  calculatedPendingCount?: number;
  calculatedPendingQuantity?: number;
  calculatedTotalPrice?: number;
  calculatedTaxableAmount?: number;
  calculatedTaxAmount?: number;
  calculatedSubtotal?: number;
  calculatedFinalPrice?: number;
  perUnit?:number;
}
export interface PurchaseOrderWithItems {
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
  freights:Freight[];
}

// NEW: Request types for overall discount API
export interface OverallDiscountItemRequest {
  itemId: string;
  poQuantity: number;
  pendingTotalQuantity: number;  // Use receivedQuantity mapped here
  newPrice: number;  // Or grnPrice if overridden
  befTaxDiscount: number;  // Existing individual % (will be updated with overall)
  afTaxDiscount: number;   // Existing individual %
  taxPercentage: number;
  taxType: string;  // e.g., 'igst', 'cgst_sgst'
  befTaxDiscountType: 'percentage';  // Fixed as percentage
  afTaxDiscountType: 'percentage';   // Fixed as percentage
}

export interface OverallDiscountRequest {
  items: OverallDiscountItemRequest[];  // Array of items to discount
  applyOverallDiscount: boolean;        // Flag to apply
  overallDiscountAmount: number;        // Total amount to distribute
  discount_type: 'before' | 'after';    // Before/after tax
}

// Response types (as you provided, but exported for consistency)
export interface OverallDiscountResponseItem {
  itemId: string;
  pendingTotalPrice: number;
  pendingBefTaxDiscountAmount: number;
  pendingAfTaxDiscountAmount: number;
  afTaxDiscountAmount: number;
  pendingDiscountAmount: number;
  pendingTaxAmount: number;
  pendingSgst: number;
  pendingCgst: number;
  pendingIgst: number;
  pendingFinalPrice: number;
  pendingOrderAmount: number;
  befTaxDiscount: number;  // Updated total % (individual + overall)
  afTaxDiscount: number;   // Updated total %
  itemOverallDiscountAmount: number;  // Share of overall discount for this item
  proportion: number;
  subtotalBeforeOverallDiscount: number;
  poQuantity: number;
  quantity: number;
  receivedQuantity: number;
  discount_type_applied: 'before' | 'after';
}

export interface OverallDiscountResponseSummary {
  totalSubtotal: number;
  overallDiscountTotalAmount: number;
  overallDiscountType: 'before' | 'after';
  totalFinalAmount: number;
  totalTaxAmount: number;
  totalDiscountAmount: number;
  totalItems: number;
}

export interface OverallDiscountResponse {
  success: boolean;
  items: OverallDiscountResponseItem[];
  summary: OverallDiscountResponseSummary;
  error?: string;
}