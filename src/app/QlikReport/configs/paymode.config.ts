// ============================================================
// configs/paymode.config.ts
// PAYMODE report — Standardized Config
// ============================================================

import { ReportConfig } from '../engine/types';

export interface PaymodeReport {
  gst?: string;
  kotNo?: number[];
  paymentDescription?: string;
  subOrderType?: string;
  area?: string;
  virtualBranchName?: string;
  groupName?: string;
  customerName?: string;
  customerAddress?: string;
  customerLocality?: string;
  persons?: string;
  tax?: number;
  totalTax?: number;
  deliveryCharge?: number;
  customCharge?: number;
  additionalCharge?: number;
  invoiceId?: string;
  branchName?: string;
  invoiceNo?: string;
  invoiceDateTime?: string;
  paymentType?: string[];
  salesType?: string;
  status?: string;
  employeeName?: string;
  customerNumber?: number | "No Number";
  totalAmount?: number;
  discountAmount?: number;
  itemName?: string;
  InvoiceNo?: string; // Note: Mapping key based on your model
  price?: number;
  weight?: number;
  qty?: number;
  uom?: string;
  netAmount?: number;
}

export const paymodeConfig: ReportConfig<PaymodeReport> = {
  key: 'paymode', // Unique key for Redux
  title: 'Paymode Report',

  // TODO: Update this API base URL to match your actual backend route
  apiBase: 'http://127.0.0.1:8000/reportsapi/allrestaurants/Paymode',

  // TODO: Update these endpoints to match your actual backend routes
  dateEndpoint: 'http://127.0.0.1:8000/reportsapi/allrestaurants/date-dropdown',

  // Reusing the global dropdowns from Production Entry
  globalDropdownEndpoint: 'http://127.0.0.1:8000/reportsapi/productionEntry/global-dropdowns',

  exportFilename: 'Paymode_Report',
  defaultPageSize: 30,

  filters: [
    { type: 'year', label: 'Fiscal Year', apiParam: 'fiscalYear' },
    { type: 'month', label: 'Fiscal Month', apiParam: 'fiscalMonth' },
    { type: 'day', label: 'Day', apiParam: 'day' },

    // Global Filters
    {
      type: 'locations',
      label: 'BranchName',
      apiParam: 'branchName',
      searchable: true,
      paginated: true
    },

  ],

  columns: [
    { displayKey: "gst", dataKey: "gst", label: "GST" },
    // Note: Arrays like kotNo might need custom cell renderer if simple string display isn't enough
    { displayKey: "kotNo", dataKey: "kotNo", label: "KOT No" },
    { displayKey: "paymentDescription", dataKey: "paymentDescription", label: "Payment Description" },
    { displayKey: "subOrderType", dataKey: "subOrderType", label: "Sub Order Type" },
    { displayKey: "area", dataKey: "area", label: "Area" },
    { displayKey: "virtualBranchName", dataKey: "virtualBranchName", label: "Virtual Branch Name" },
    { displayKey: "groupName", dataKey: "groupName", label: "Group Name" },
    { displayKey: "customerName", dataKey: "customerName", label: "Customer Name" },
    { displayKey: "customerAddress", dataKey: "customerAddress", label: "Customer Address" },
    { displayKey: "customerLocality", dataKey: "customerLocality", label: "Customer Locality" },
    { displayKey: "persons", dataKey: "persons", label: "Persons" },
    { displayKey: "tax", dataKey: "tax", label: "Tax", align: 'right' },
    { displayKey: "totalTax", dataKey: "totalTax", label: "Total Tax", align: 'right' },
    { displayKey: "deliveryCharge", dataKey: "deliveryCharge", label: "Delivery Charge", align: 'right' },
    { displayKey: "customCharge", dataKey: "customCharge", label: "Custom Charge", align: 'right' },
    { displayKey: "additionalCharge", dataKey: "additionalCharge", label: "Additional Charge", align: 'right' },
    { displayKey: "invoiceId", dataKey: "invoiceId", label: "Invoice ID" },
    { displayKey: "branchName", dataKey: "branchName", label: "Branch Name" },
    { displayKey: "invoiceNo", dataKey: "invoiceNo", label: "Invoice No" },
    { displayKey: "invoiceDateTime", dataKey: "invoiceDateTime", label: "Invoice Date/Time" },
    // Note: Arrays like paymentType might need custom cell renderer
    { displayKey: "paymentType", dataKey: "paymentType", label: "Payment Type" },
    { displayKey: "salesType", dataKey: "salesType", label: "Sales Type" },
    { displayKey: "status", dataKey: "status", label: "Status" },
    { displayKey: "employeeName", dataKey: "employeeName", label: "Employee Name" },
    { displayKey: "customerNumber", dataKey: "customerNumber", label: "Customer Number" },
    { displayKey: "totalAmount", dataKey: "totalAmount", label: "Total Amount", align: 'right' },
    { displayKey: "discountAmount", dataKey: "discountAmount", label: "Discount Amount", align: 'right' },
    { displayKey: "itemName", dataKey: "itemName", label: "Item Name" },
    // Note: Label in ALL_COLUMNS was "Variance Name" but dataKey was "InvoiceNo"
    { displayKey: "InvoiceNo", dataKey: "InvoiceNo", label: "Variance Name" },
    { displayKey: "price", dataKey: "price", label: "Price", align: 'right' },
    { displayKey: "weight", dataKey: "weight", label: "Weight", align: 'right' },
    { displayKey: "qty", dataKey: "qty", label: "Quantity", align: 'right' },
    { displayKey: "uom", dataKey: "uom", label: "Unit of Measure" },
    { displayKey: "netAmount", dataKey: "netAmount", label: "Net Amount", align: 'right' },
  ],
};