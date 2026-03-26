// ============================================================
// configs/apInvoice.config.ts
// AP INVOICE ITEM report — Standardized Config
// ============================================================

import { ReportConfig } from '../engine/types';

export interface ApInvoiceReport {
  s_no?: number;
  createdDate?: string | null;
  invoiceNo?: string | null;
  invoiceDate?: string | null;
  vendorName?: string | null;
  poRandomId?: string | null;
  grnRandomId?: string;
  itemCode?: string | null;
  itemName?: string | null;
  locationName?: string | null;
  unitPrice?: number | null;
  purchasecategoryName?: string | null;
  purchasesubcategoryName?: string | null;
  quantity?: number | null;
  sgst?: number | null;
  cgst?: number | null;
  igst?: number | null;
  totalPrice?: number | null;
  befTaxDiscount?: number | null;
  befTaxDiscountAmount?: number | null;
  debitAfterSgstAmount?: number | null;
  debitAfterCgstAmount?: number | null;
  debitAfterIgstAmount?: number | null;
  taxAmount?: number | null;
  finalPrice?: number;
  vendorId?: string | null;
  internalNo?: string;
  hsnCode?: string;
  VendorRefNo?: string | null;
  LineDiscount?: number | null;
  lineDiscountValue?: number | null;
  totalGst?: number | null;
  totalGstAmount?: number | null;
  freightName?: string | null;
  total?: number | null;
  FrCgstPercent?: number | null;
  debitAfterFrCgstAmount?: number | null;
  FrSgstPercent?: number | null;
  debitAfterFrSgstAmount?: number | null;
  FrIgstPercent?: number | null;
  debitAfterFrIgstAmount?: number | null;
  FrTaxAmount?: number | null;
  apInvoice_id?: string;
  randomId?: string;
  discount_value?: number;
  sapVendorCode?: number;
}

export const apInvoiceConfig: ReportConfig<ApInvoiceReport> = {
  key: 'apInvoiceReport', // Unique key for Redux
  title: 'AP Invoice Item Report',

  // TODO: Update this API base URL to match your actual backend route
  apiBase: 'http://127.0.0.1:8000/reportsapi/apinvoices',

  // TODO: Update these endpoints to match your actual backend routes
  dateEndpoint: 'http://127.0.0.1:8000/reportsapi/apinvoices/date-dropdown',

  // Reusing the global dropdowns from Production Entry
  globalDropdownEndpoint: 'http://127.0.0.1:8000/reportsapi/purchaseOrders/global-dropdowns',

  exportFilename: 'AP_Invoice_Report',
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
    { displayKey: "apInvoice_id", dataKey: "apInvoice_id", label: "Internal No" },
    { displayKey: "createdDate", dataKey: "createdDate", label: "Posting Date" },
    { displayKey: "randomId", dataKey: "randomId", label: "Invoice No" },
    { displayKey: "invoiceDate", dataKey: "invoiceDate", label: "Invoice Date" },
    { displayKey: "invoiceNo", dataKey: "invoiceNo", label: "Vendor Ref. No" },
    { displayKey: "grnRandomId", dataKey: "grnRandomId", label: "GRN No" },
    { displayKey: "sapVendorCode", dataKey: "sapVendorCode", label: "Customer/Vendor Code" },
    { displayKey: "vendorName", dataKey: "vendorName", label: "Customer/Vendor Name" },
    { displayKey: "itemCode", dataKey: "itemCode", label: "Item No." },
    { displayKey: "hsnCode", dataKey: "hsnCode", label: "HSN" },
    { displayKey: "itemName", dataKey: "itemName", label: "Item/Service Description" },
    { displayKey: "locationName", dataKey: "locationName", label: "Name" },
    { displayKey: "unitPrice", dataKey: "unitPrice", label: "Price", align: 'right' },
    { displayKey: "LineDiscount", dataKey: "LineDiscount", label: "Line Discount %", align: 'right' },
    { displayKey: "befTaxDiscountAmount", dataKey: "befTaxDiscountAmount", label: "Price Before Discount", align: 'right' },
    { displayKey: "lineDiscountValue", dataKey: "lineDiscountValue", label: "Line Discount Value", align: 'right' },
    { displayKey: "purchasecategoryName", dataKey: "purchasecategoryName", label: "Category" },
    { displayKey: "purchasesubcategoryName", dataKey: "purchasesubcategoryName", label: "Sub Category" },
    { displayKey: "quantity", dataKey: "quantity", label: "Quantity", align: 'right' },
    { displayKey: "totalGst", dataKey: "totalGst", label: "GST %", align: 'right' },
    { displayKey: "cgst", dataKey: "cgst", label: "CGST%", align: 'right' },
    { displayKey: "debitAfterCgstAmount", dataKey: "debitAfterCgstAmount", label: "CGST", align: 'right' },
    { displayKey: "sgst", dataKey: "sgst", label: "SGST%", align: 'right' },
    { displayKey: "debitAfterSgstAmount", dataKey: "debitAfterSgstAmount", label: "SGST", align: 'right' },
    { displayKey: "igst", dataKey: "igst", label: "IGST%", align: 'right' },
    { displayKey: "debitAfterIgstAmount", dataKey: "debitAfterIgstAmount", label: "IGST", align: 'right' },
    { displayKey: "totalGstAmount", dataKey: "totalGstAmount", label: "Tax Amount", align: 'right' },
    { displayKey: "freightName", dataKey: "freightName", label: "Freight Name" },
    { displayKey: "total", dataKey: "total", label: "Total", align: 'right' },
    { displayKey: "totalPrice", dataKey: "totalPrice", label: "Basic Value", align: 'right' },
    { displayKey: "befTaxDiscount", dataKey: "befTaxDiscount", label: "Doc Discount %", align: 'right' },
    { displayKey: "discount_value", dataKey: "discount_value", label: "Doc Discount Value", align: 'right' },
    { displayKey: "finalPrice", dataKey: "finalPrice", label: "Total value", align: 'right' },
  ],
};