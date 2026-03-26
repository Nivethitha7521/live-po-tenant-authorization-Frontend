// ============================================================
// configs/allRestaurant.config.ts
// ALL RESTAURANT report — Standardized Config
// ============================================================

import { ReportConfig } from '../engine/types';

export interface AllRestaurantReport {
  branchName?: string;
  invoiceDate?: string;
  invoiceNo?: string;
  total_no_of_bills?: number;
  pax?: number;
  totalAmount?: number;
  discountAmount?: number;
  netAmount?: number;
  deliveryCharge?: number;
  containerCharge?: number;
  serviceCharge?: number;
  additionalCharge?: number;
  totalTax?: number;
  roundOff?: number;
  waivedoff?: number;
  onlineTaxCalculated?: number;
  gstPaidByMerchant?: number;
  gstPaidByEcommerce?: number;
  cash?: number;
  card?: number;
  upi?: number;
  wallet?: number;
  online?: number;
  others?: number;
  duePayment?: number;
  [key: string]: string | number | boolean | null | undefined;
}

export const allRestaurantConfig: ReportConfig<AllRestaurantReport> = {
  key: 'allRestaurant', // Unique key for Redux
  title: 'All Restaurant Report',

  // TODO: Update this API base URL to match your actual backend route
  apiBase: 'http://127.0.0.1:8000/reportsapi/allrestaurants',

  // TODO: Update these endpoints to match your actual backend routes
  dateEndpoint: 'http://127.0.0.1:8000/reportsapi/allrestaurants/date-dropdown',

  // Reusing the global dropdowns from Production Entry
  globalDropdownEndpoint: 'http://127.0.0.1:8000/reportsapi/productionEntry/global-dropdowns',

  exportFilename: 'All_Restaurant_Report',
  defaultPageSize: 30,

  filters: [
    { type: 'year', label: 'Fiscal Year', apiParam: 'fiscalYear' },
    { type: 'month', label: 'Fiscal Month', apiParam: 'fiscalMonth' },
    { type: 'day', label: 'Day', apiParam: 'day' },

    // Global Filters
    {
      type: 'locations',
      label: 'branchName',
      apiParam: 'branchName',
      searchable: true,
      paginated: true
    },
  ],

  columns: [
    { displayKey: "branchName", dataKey: "branchName", label: "Restaurant" },
    { displayKey: "invoiceDate", dataKey: "invoiceDate", label: "Data Synced" },
    { displayKey: "invoiceNo", dataKey: "invoiceNo", label: "Invoice No" },
    { displayKey: "total_no_of_bills", dataKey: "total_no_of_bills", label: "Total no. of bills", align: 'right' },
    { displayKey: "totalAmount", dataKey: "totalAmount", label: "My Amount", align: 'right' },
    { displayKey: "discountAmount", dataKey: "discountAmount", label: "Total Discount", align: 'right' },
    { displayKey: "netAmount", dataKey: "netAmount", label: "Net Sales(M.A - T.D)", align: 'right' },
    { displayKey: "deliveryCharge", dataKey: "deliveryCharge", label: "Delivery Charge", align: 'right' },
    { displayKey: "containerCharge", dataKey: "containerCharge", label: "Container Charge", align: 'right' },
    { displayKey: "serviceCharge", dataKey: "serviceCharge", label: "Service Charge", align: 'right' },
    { displayKey: "additionalCharge", dataKey: "additionalCharge", label: "Additional Charge", align: 'right' },
    { displayKey: "totalTax", dataKey: "totalTax", label: "Total Tax", align: 'right' },
    { displayKey: "roundOff", dataKey: "roundOff", label: "Round Off", align: 'right' },
    { displayKey: "waivedoff", dataKey: "waivedoff", label: "Waived Off", align: 'right' },
    { displayKey: "onlineTaxCalculated", dataKey: "onlineTaxCalculated", label: "Online Tax", align: 'right' },
    { displayKey: "gstPaidByMerchant", dataKey: "gstPaidByMerchant", label: "GST Paid By Merchant", align: 'right' },
    { displayKey: "gstPaidByEcommerce", dataKey: "gstPaidByEcommerce", label: "GST Paid By Ecommerce", align: 'right' },
    { displayKey: "cash", dataKey: "cash", label: "Cash", align: 'right' },
    { displayKey: "card", dataKey: "card", label: "Card", align: 'right' },
    { displayKey: "upi", dataKey: "upi", label: "UPI", align: 'right' },
    { displayKey: "wallet", dataKey: "wallet", label: "Wallet", align: 'right' },
    { displayKey: "online", dataKey: "online", label: "Online", align: 'right' },
    { displayKey: "others", dataKey: "others", label: "Others", align: 'right' },
    { displayKey: "duePayment", dataKey: "duePayment", label: "Due Payment", align: 'right' },
    { displayKey: "pax", dataKey: "pax", label: "Pax", align: 'right' },
  ],
};