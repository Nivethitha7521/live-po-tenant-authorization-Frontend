// src/features/yen-purchase/PurchaseOrder/Utils/purchaseOrderHelpers.ts

import { PurchaseOrderData, Item, Freight } from '../../../../Models/purchaseModel';
import { roundPrice } from './validation';

export const calculateTotals = (
  items: Item[],
  freights: Freight[],
  overallDiscountMode: 'percentage' | 'amount',
  overallDiscountValue: number,
  roundOffValue: number
) => {
  let subTotal = 0;
  let itemDiscountAmount = 0;
  let taxAmount = 0;

  items.forEach((item) => {
    subTotal += item.pendingTotalPrice || 0;
    itemDiscountAmount += item.pendingDiscountAmount || 0;
    taxAmount += item.pendingTaxAmount || 0;
  });

  let freightAmountTotal = 0;
  let freightTaxTotal = 0;
  freights.forEach((freight) => {
    freightAmountTotal += freight.amt || 0;
    freightTaxTotal += freight.tAmt || 0;
  });

  const overallDiscountAmount = overallDiscountMode === 'percentage'
    ? subTotal * (overallDiscountValue / 100)
    : overallDiscountValue;

  const totalDiscount = itemDiscountAmount + overallDiscountAmount;
  const afterDiscount = Math.max(0, subTotal - totalDiscount);
  const finalAmount = afterDiscount + taxAmount + freightAmountTotal + freightTaxTotal + roundOffValue;
  const totalTax = taxAmount + freightTaxTotal;

  return {
    subTotal: roundPrice(subTotal),
    freightAmountTotal: roundPrice(freightAmountTotal),
    freightTaxTotal: roundPrice(freightTaxTotal),
    roundedTotalOrderAmount: roundPrice(finalAmount),
    roundedTotalDiscount: roundPrice(totalDiscount),
    roundedTotalTax: roundPrice(totalTax),
    overallDiscountAmount: roundPrice(overallDiscountAmount),
    itemDiscountAmount: roundPrice(itemDiscountAmount),
    taxAmount: roundPrice(taxAmount),
    afterDiscount: roundPrice(afterDiscount),
  };
};

export const calculateTaxDetails = (items: Item[]) => {
  const taxDetails: { [key: string]: { pendingSgst: number; pendingCgst: number; pendingIgst: number; percentage: number } } = {};
  
  items.forEach((item) => {
    const taxPercentage = item.taxPercentage || 0;
    if (!taxDetails[taxPercentage]) {
      taxDetails[taxPercentage] = {
        pendingSgst: 0,
        pendingCgst: 0,
        pendingIgst: 0,
        percentage: taxPercentage,
      };
    }
    if (item.taxType === 'igst') {
      taxDetails[taxPercentage].pendingIgst += item.pendingIgst || 0;
    } else {
      taxDetails[taxPercentage].pendingSgst += item.pendingSgst || 0;
      taxDetails[taxPercentage].pendingCgst += item.pendingCgst || 0;
    }
  });
  
  return taxDetails;
};

export const createEmptyPurchaseOrder = (): PurchaseOrderData => {
  const now = new Date().toISOString();
  
  return {
    purchaseOrderId: '',
    vendorName: '',
    vendorContact: '',
    orderDate: now,
    poStatus: '',
    items: [],
    pendingOrderAmount: 0,
    creditLimit: 0,
    paymentTerms: '',
    shippingAddress: '',
    billingAddress: '',
    locationName: '',
    locationId: '',
    comments: '',
    termsandConditions: [''],
    contactpersonEmail: '',
    address: '',
    country: '',
    state: '',
    city: '',
    postalCode: 0,
    gstNumber: '',
    freights: [],
    vendorId: '',
    randomId: '',
    overallDiscountValue: 0,
    roundOffValue: 0,
    // REMOVED: isHoldOrder (does not exist in interface)
    pendingDiscountAmount: 0,
    pendingTaxAmount: 0,
    totalTax: 0,
    discountPrice: 0,
    totalDiscount: 0,
    vendorCode: '',
    approvedDate: null,
    rejectedDate: null,
    poCreatedPerson: '',
    poApprovedPerson: '',
    poRejectedPerson: '',
    discountMode: 'percentage',
    totalFreightAmount: 0,
    totalFreightTaxAmount: 0,
    totalOrderAmount: 0,
    invoiceDate: null,
    invoiceNo: '',
    itemStatus: '',
    imageUrl: '',
    expectedDeliveryDate: null,
    // Add optional GRN fields
    poQuantitypendingTotalPrice: 0,
    poQuantitypendingFinalPrice: 0,
    poQuantityDiscountAmount: 0,
    poQuantityTaxAmount: 0,
    poQuantitysgst: 0,
    poQuantitycgst: 0,
    poQuantityigst: 0,
  };
};

export const createEmptyNewItem = (discountMode: string): Partial<Item> => ({
  itemId: '',
  itemName: '',
  itemCode: '',
  quantity: 0,
  poQuantity: 0,
  count: 0,
  eachQuantity: 0,
  existingPrice: 0,
  newPrice: 0,
  taxPercentage: 0,
  totalPrice: 0,
  befTaxDiscount: 0,
  afTaxDiscount: 0,
  befTaxDiscountAmount: 0,
  afTaxDiscountAmount: 0,
  uom: '',
  pendingCount: 0,
  pendingQuantity: 0,
  pendingTotalQuantity: 0,
  purchasecategoryName: '',
  purchasesubcategoryName: '',
  hsnCode: '',
  taxType: 'cgst_sgst' as 'cgst_sgst' | 'igst',
  pendingTotalPrice: 0,
  befTaxDiscountType: discountMode as 'percentage' | 'amount',
  afTaxDiscountType: discountMode as 'percentage' | 'amount',
  poQuantityTaxAmount: 0,
  poQuantityDiscountAmount: 0,
  poQuantitypendingTotalPrice: 0,
  poQuantitypendingFinalPrice: 0,
  poQuantitysgst: 0,
  poQuantitycgst: 0,
  poQuantityigst: 0,
  availableStock: 0,
  locationId: '',
  randomId: '',
  pendingFinalPrice: 0,
  pendingTaxAmount: 0,
  pendingDiscountAmount: 0,
  pendingAfTaxDiscountAmount: 0,
  pendingSgst: 0,
  pendingCgst: 0,
  pendingIgst: 0,
  priceVariance: 0,
  expiryDate: null,
  receivedQuantity: 0,
  damagedQuantity: 0,
  discountAmount: 0,
  taxAmount: 0,
  finalPrice: 0,
  status: '',
  barcode: '',
  sgst: 0,
  cgst: 0,
  igst: 0,
});