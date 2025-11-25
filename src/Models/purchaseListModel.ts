import { List } from "postcss/lib/list";
import { Freight } from "./purchaseModel";
// Define the structure of an individual purchase item
export interface Item {
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  uom: string;
  existingPrice: number;
  newPrice: number;
  count: number;
  sgst: number;
  cgst: number;
  igst: number;
  hsnCode: string;
  eachQuantity: number;
  receivedQuantity: number;
  pendingCount: number;
  pendingQuantity: number;
  poQuantity: number;
  pendingTotalQuantity: number;
  poQuantityTaxAmount: number;
  poQuantityDiscountAmount: number;
  poQuantitypendingTotalPrice: number;
  poQuantitypendingFinalPrice: number;
  poQuantitysgst: number;
  poQuantitycgst: number;
  poQuantityigst: number;
  purchasecategoryName: string;
  purchasesubcategoryName: any;
  damagedQuantity: number;
  befTaxDiscount: number;
  afTaxDiscount: number;
  befTaxDiscountAmount: number;
  afTaxDiscountAmount: number;
  taxPercentage: number;
  taxAmount: number;
  discountAmount: number;
  totalPrice: number;
  finalPrice: number;
  taxType: 'cgst_sgst' | 'igst';
  pendingTaxAmount?: number;
  pendingSgst?: number;
  pendingCgst?: number;
  pendingIgst?: number;
  pendingTotalPrice?: number;
  pendingFinalPrice?: number;
  pendingBefTaxDiscountAmount?: number;
  pendingAfTaxDiscountAmount?: number;
  pendingDiscountAmount: number;
  status: string;
  expiryDate?: Date | null;
}

export interface PurchaseOrderData {
  photoData: any;
  purchaseOrderId: string;
  vendorName: string;
  vendorContact: string;
  orderDate: Date | null;
  approvedDate: Date | null;
  rejectedDate: Date | null;
  expectedDeliveryDate: Date | null;
  invoiceDate: Date | null;
  invoiceNo: string;
  poStatus: string;
  items: Item[];
  totalOrderAmount: number;
  paymentTerms: string;
  shippingAddress: string;
  billingAddress: string;
  comments: string;
  randomId: string;
  totalDiscount: number;
  discountPrice: number;
  totalTax: number;
  uploadedPhotoUrl?: string; // Add this line for the uploaded photo URL
  photoUrls: string[];  // Add imageUrl here to hold the URL of the fetched photo
  address: string;
  country: string;
  state: string;
  city: string;
  termsandConditions: string[];
  postalCode: number;
  gstNumber: string;
  contactpersonEmail: string;
  pendingCount: number;
  pendingQuantity: number;
  pendingTotalQuantity: number;
  imageUrl: string;
  itemStatus: string;
  pendingOrderAmount: number;
  pendingDiscountAmount: number;
  pendingTaxAmount: number;
  poCreatedPerson: string;
  poApprovedPerson: string;
  poRejectedPerson: string;
  locationName: string;
}
export interface Photo {
  filename: string;
  id: string;
  pho: string;
}
export interface ItemDetail {
  nos: number;
  eachQuantity: number;
  itemName: string;
  quantity: number;
  unitPrice: number;
  befTaxDiscount: number;
  afTaxDiscount: number;
  hsnCode: string;
  befTaxDiscountAmount: number;
  purchasecategoryName: string;
  purchasesubcategoryName: any;
  afTaxDiscountAmount: number;
  receivedQuantity: number;
  damagedQuantity: number;
  purchasetaxName: number;
  taxAmount: number;
  taxType: 'cgst_sgst' | 'igst';
  igst: number;
  cgst: number;
  sgst: number;
  discountAmount: number;
  totalPrice: number;
  finalPrice: number;
}

export interface GrnData {
  grnId: string;
  purchaseOrderId: string;
  poRandomID: string;
  vendorName: string;
  grnDate: Date | null;
  grnVerifiedDate: Date | null;
  grnReturnedDate: Date | null;
  poDate: Date | null;
  receivingLocation: string;
  totalDiscount: number;
  totalTax: number;
  agingDay: number;
  discountPrice: number;
  invoiceDate: Date | null;
  invoiceNo: string;
  shippingAddress: string;
  billingAddress: string;
  itemDetails: ItemDetail[];
  inspectionStatus: string;
  receivedBy: string;
  totalReceivedAmount: number;
  comments: string;
  attachments: string | null;
  createdDate: Date | null;
  lastUpdatedDate: Date | null;
  status: string;
  randomId: string;
  address: string;
  country: string;
  state: string;
  city: string;
  postalCode: number;
  gstNumber: string;
  paymentTerms: string;
  contactpersonEmail: string;
  grnPerson: string;
  grnVerifiedPerson: string;
  grnReturnedPerson: string;
  freights:Freight[];
  totalFreightAmount:number;
totalFreightTaxAmount:number;
}


