// ============================================================
// configs/outstanding.config.ts
// OUTSTANDING report — Standardized Config
// ============================================================

import { ReportConfig } from '../engine/types';

export interface OutstandingReport {
  grpoNo?: string;
  grpoDate?: string | null;
  apinvoiceDate?: string | null;
  apinvoiceNo?: string;
  gstBos?: string;
  itemService?: string;
  userName?: string;
  vendorRefno?: string;
  vendorCode?: number;
  VendorName?: string;
  billTo?: string;
  gstNo?: string;
  netAmount?: number;
  taxAmount?: number;
  GrossAmount?: number;
  paymentNo?: number;
  paymentDate?: string | null;
  paymentAmount?: number;
  type?: string;
  totalpaidAmount?: number;
  outstanding?: number;
}

export const outstandingConfig: ReportConfig<OutstandingReport> = {
  key: 'outstanding', // Unique key for Redux
  title: 'Outstanding Report',

  // TODO: Update this API base URL to match your actual backend route
  apiBase: '/outgoingPayment/Outstanding',

  // TODO: Update these endpoints to match your actual backend routes
  dateEndpoint: '/outgoingPayment/date-dropdown',

  // Reusing the global dropdowns from Production Entry
  globalDropdownEndpoint: '/purchaseOrders/global-dropdowns',

  exportFilename: 'Outstanding_Report',
  defaultPageSize: 30,

  filters: [
    { type: 'year', label: 'Fiscal Year', apiParam: 'fiscalYear' },
    { type: 'month', label: 'Fiscal Month', apiParam: 'fiscalMonth' },
    { type: 'day', label: 'Day', apiParam: 'day' },

    {
      type: 'vendor',
      label: 'Vendor Name',
      apiParam: 'vendorName',
      searchable: true,
      paginated: true
    },
  ],

  columns: [
    { displayKey: "grpoNo", dataKey: "grpoNo", label: "GRPO.No" },
    { displayKey: "grpoDate", dataKey: "grpoDate", label: "GRPO.Date" },
    { displayKey: "apinvoiceDate", dataKey: "apinvoiceDate", label: "Ap Invoice Date" },
    { displayKey: "apinvoiceNo", dataKey: "apinvoiceNo", label: "A/P Invoice No" },
    { displayKey: "gstBos", dataKey: "gstBos", label: "GST/BOS" },
    { displayKey: "itemService", dataKey: "itemService", label: "Item/Service" },
    { displayKey: "userName", dataKey: "userName", label: "User Name" },
    { displayKey: "vendorRefno", dataKey: "vendorRefno", label: "Vendor Ref No" },
    { displayKey: "vendorCode", dataKey: "vendorCode", label: "Vendor Code" },
    { displayKey: "VendorName", dataKey: "VendorName", label: "Vendor Name" },
    { displayKey: "billTo", dataKey: "billTo", label: "Bill to" },
    { displayKey: "gstNo", dataKey: "gstNo", label: "GST No" },
    { displayKey: "netAmount", dataKey: "netAmount", label: "Net Amount", align: 'right' },
    { displayKey: "taxAmount", dataKey: "taxAmount", label: "Tax Amount", align: 'right' },
    { displayKey: "GrossAmount", dataKey: "GrossAmount", label: "Gross Amount", align: 'right' },
    { displayKey: "paymentNo", dataKey: "paymentNo", label: "Payment No" },
    { displayKey: "paymentDate", dataKey: "paymentDate", label: "Payment Date" },
    { displayKey: "paymentAmount", dataKey: "paymentAmount", label: "Payment Amount", align: 'right' },
    { displayKey: "type", dataKey: "type", label: "Type" },
    { displayKey: "totalpaidAmount", dataKey: "totalpaidAmount", label: "Total Paid Amount", align: 'right' },
    { displayKey: "outstanding", dataKey: "outstanding", label: "Outstanding", align: 'right' },
  ],
};