// ============================================================
// configs/purchase.config.ts
// PURCHASE report — Standardized Config
// ============================================================

import { ReportConfig } from '../engine/types';

export interface PurchaseReport {
  purchaseOrderId?: string;
  s_no?: number;
  internalNo?: string;
  orderDate?: string | null;
  createdDate?: string | null;
  poStatus?: string | null;
  itemStatus?: string | null;
  vendorName?: string | null;
  itemCode?: string | null;
  purchasecategoryName?: string | null;
  purchasesubcategoryName?: string | null;
  Dscription?: string | null;
  poQuantity?: number | null;
  pendingQuantity?: number | null;
  price?: number | null;
  sgst?: number | null;
  cgst?: number | null;
  igst?: number | null;
  pendingSgst?: number | null;
  pendingCgst?: number | null;
  pendingIgst?: number | null;
  pendingTaxAmount?: number | null;
  taxAmount?: number | null;
  finalPrice?: number | null;
  totalReceivedAmount?: number | null;
  receivedQuantity?: number | null;
  grpo_No?: string | null;
  grpoStatus?: string | null;
  apNo?: string | null;
  apStatus?: string | null;
  LineTotal?: number | null;
  randomId?: string;
  vendorId?: string;
  poRandomID?: string;
  sapVendorCode?: string | null;
  documentTotal?: number | null;
  cgstAmt?: number | null;
  sgstAmt?: number | null;
  igstAmt?: number | null;
}

export const purchaseConfig: ReportConfig<PurchaseReport> = {
  key: 'purchase', // Unique key for Redux
  title: 'Purchase Report',

  // TODO: Update this API base URL to match your actual backend route
  apiBase: 'http://127.0.0.1:8000/reportsapi/purchaseOrders',

  // TODO: Update these endpoints to match your actual backend routes
  dateEndpoint: 'http://127.0.0.1:8000/reportsapi/purchaseOrders/date-dropdown',

  // Reusing the global dropdowns from Production Entry
  globalDropdownEndpoint: 'http://127.0.0.1:8000/reportsapi/purchaseOrders/global-dropdowns',

  exportFilename: 'Purchase_Report',
  defaultPageSize: 30,

  filters: [
    { type: 'year', label: 'Fiscal Year', apiParam: 'fiscalYear' },
    { type: 'month', label: 'Fiscal Month', apiParam: 'fiscalMonth' },
    { type: 'day', label: 'Day', apiParam: 'day' },

    // Global Filters
    {
      type: 'vendor',
      label: 'Vendor Name',
      apiParam: 'vendorName',
      searchable: true,
      paginated: true
    },

  ],

  columns: [
    { displayKey: "purchaseOrderId", dataKey: "purchaseOrderId", label: "Internal No" },
    // Note: Mapped 'createdDate' to 'Posting Date' as per your ALL_COLUMNS
    { displayKey: "createdDate", dataKey: "createdDate", label: "Posting Date" },
    { displayKey: "poRandomID", dataKey: "poRandomID", label: "PO.No" },
    // Note: Mapped 'orderDate' to 'PO Date' as per your ALL_COLUMNS
    { displayKey: "orderDate", dataKey: "orderDate", label: "PO Date" },
    { displayKey: "poStatus", dataKey: "poStatus", label: "PO Status" },
    { displayKey: "itemStatus", dataKey: "itemStatus", label: "Item Status" },
    { displayKey: "grpo_No", dataKey: "grpo_No", label: "GRPO.No" },
    { displayKey: "grpoStatus", dataKey: "grpoStatus", label: "GRPO.Status" },
    { displayKey: "apNo", dataKey: "apNo", label: "A/P.No" },
    { displayKey: "apStatus", dataKey: "apStatus", label: "A/P.Status" },
    { displayKey: "sapVendorCode", dataKey: "sapVendorCode", label: "Customer/Vendor Code" },
    { displayKey: "vendorName", dataKey: "vendorName", label: "Vendor Name" },
    { displayKey: "itemCode", dataKey: "itemCode", label: "ItemCode" },
    { displayKey: "purchasecategoryName", dataKey: "purchasecategoryName", label: "Category" },
    { displayKey: "purchasesubcategoryName", dataKey: "purchasesubcategoryName", label: "Sub Category" },
    { displayKey: "Dscription", dataKey: "Dscription", label: "Description" },
    { displayKey: "poQuantity", dataKey: "poQuantity", label: "Order.Qty", align: 'right' },
    { displayKey: "pendingQuantity", dataKey: "pendingQuantity", label: "Pending Qty", align: 'right' },
    { displayKey: "price", dataKey: "price", label: "Price", align: 'right' },
    { displayKey: "sgst", dataKey: "sgst", label: "SGST%", align: 'right' },
    // Note: Mapped 'sgstAmt' to 'SGST' label as per your ALL_COLUMNS
    { displayKey: "sgstAmt", dataKey: "sgstAmt", label: "SGST", align: 'right' },
    { displayKey: "cgst", dataKey: "cgst", label: "CGST%", align: 'right' },
    // Note: Mapped 'cgstAmt' to 'CGST' label as per your ALL_COLUMNS
    { displayKey: "cgstAmt", dataKey: "cgstAmt", label: "CGST", align: 'right' },
    { displayKey: "igst", dataKey: "igst", label: "IGST%", align: 'right' },
    // Note: Mapped 'igstAmt' to 'IGST' label as per your ALL_COLUMNS
    { displayKey: "igstAmt", dataKey: "igstAmt", label: "IGST", align: 'right' },
    { displayKey: "taxAmount", dataKey: "taxAmount", label: "Tax Amount", align: 'right' },
    { displayKey: "LineTotal", dataKey: "LineTotal", label: "Line Total", align: 'right' },
    // Note: Mapped 'documentTotal' to 'Document Total' label as per your ALL_COLUMNS
    { displayKey: "documentTotal", dataKey: "documentTotal", label: "Document Total", align: 'right' },
    { displayKey: "receivedQuantity", dataKey: "receivedQuantity", label: "Receive.Qty", align: 'right' },
    { displayKey: "totalReceivedAmount", dataKey: "totalReceivedAmount", label: "Receive.Price", align: 'right' },
  ],
};