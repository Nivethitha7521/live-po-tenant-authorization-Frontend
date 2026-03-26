// ============================================================
// configs/outgoing.config.ts
// OUTGOING PAYMENT report — Standardized Config
// ============================================================

import { ReportConfig } from '../engine/types';

export interface OutgoingReport {
  internalNo?: string;
  postingDate?: string | null;
  createDate?: string | null;
  paymentNum?: string | number;
  invoiceNo?: string;
  invoiceDate?: string | null;
  vendorCode?: number;
  vendorName?: string;
  invoiceAmount?: number;
  paymentDate?: string | null;
  paymentAmount?: number;
  paymentRef1?: string;
  modeofPayment?: string;
  chequeNo?: string | number;
  poDate?: string | null;
  paymentType?: string;
  totalPayableAmount?: number;
  documentType?: string;
  invoiceRef?: string | number;
  randomId?: string;
  paymentRef2?: string;
  status?: string;
  // Mapped fields
  s_no?: number;
  create_date?: string | null;
  posting_date?: string | null;
  invoice_date?: string | null;
  payment_date?: string | null;
  invoice_ref?: string;
  vendor_name?: string;
  invoice_no?: string;
  document_type?: string;
  invoice_amount?: number;
  vendor_code?: number;
  mode_of_payment?: string;
  cheque_no?: string;
  payment_ref_2?: string;
  payment_num?: string;
  payment_amount?: number;
}

export const outgoingConfig: ReportConfig<OutgoingReport> = {
  key: 'outgoing', // Unique key for Redux
  title: 'Outgoing Payment Report',

  // TODO: Update this API base URL to match your actual backend route
  apiBase: 'http://127.0.0.1:8000/reportsapi/outgoingPayment',

  // TODO: Update these endpoints to match your actual backend routes
  dateEndpoint: 'http://127.0.0.1:8000/reportsapi/outgoingPayment/date-dropdown',

  // Reusing the global dropdowns from Production Entry
  globalDropdownEndpoint: 'http://127.0.0.1:8000/reportsapi/purchaseOrders/global-dropdowns',

  exportFilename: 'Outgoing_Payment_Report',
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
    { displayKey: "internalNo", dataKey: "internalNo", label: "Internal No" },
    { displayKey: "postingDate", dataKey: "postingDate", label: "Posting Date" },
    { displayKey: "createDate", dataKey: "createDate", label: "Create Date" },
    { displayKey: "paymentNum", dataKey: "paymentNum", label: "Payment Num" },
    { displayKey: "documentType", dataKey: "documentType", label: "Document Type" },
    { displayKey: "invoiceNo", dataKey: "invoiceNo", label: "Cus/Sup Invoice No" },
    { displayKey: "invoiceDate", dataKey: "invoiceDate", label: "Cus/Sup Invoice Date" },
    { displayKey: "vendorCode", dataKey: "vendorCode", label: "Cus/Sup Code" },
    { displayKey: "vendorName", dataKey: "vendorName", label: "Cus/Sup Name" },
    { displayKey: "invoiceAmount", dataKey: "invoiceAmount", label: "Cus/Sup Invoice Amount", align: 'right' },
    { displayKey: "paymentRef1", dataKey: "paymentRef1", label: "Payment Ref" },
    { displayKey: "paymentDate", dataKey: "paymentDate", label: "Payment Date" },
    { displayKey: "paymentAmount", dataKey: "paymentAmount", label: "Payment Amount", align: 'right' },
    { displayKey: "modeofPayment", dataKey: "modeofPayment", label: "Mode Of Payment" },
    { displayKey: "paymentRef2", dataKey: "paymentRef2", label: "Payment Ref 2" },
    { displayKey: "invoiceRef", dataKey: "invoiceRef", label: "Cus/Sup Invoice Ref" },
    { displayKey: "chequeNo", dataKey: "chequeNo", label: "Check No" },
  ],
};