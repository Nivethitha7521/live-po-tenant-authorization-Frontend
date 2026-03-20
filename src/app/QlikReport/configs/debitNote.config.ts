// ============================================================
// configs/debitNote.config.ts
// DEBIT NOTE ITEMWISE report — Standardized Config
// ============================================================

import { ReportConfig } from '../engine/types';

export interface DebitNoteReport {
  NOTE_NO?: string;
  VENDOR_NAME?: string;
  ITEM_NAME?: string;
  QTY?: number;
  UNIT_PRICE?: number;
  TOTAL_PRICE?: number;
  TAX_AMOUNT?: number;
  FINAL_PRICE?: number;
  SGST?: number;
  CGST?: number;
  REASON?: string;
  CREATED_DATE?: string;
}

export const debitNoteConfig: ReportConfig<DebitNoteReport> = {
  key: 'debitNote', // Unique key for Redux
  title: 'Debit Note Itemwise Report',
  
  // TODO: Update this API base URL to match your actual backend route
  apiBase: 'https://yenerp.com/reportsapi/debitnote/item-wise',

  // TODO: Update these endpoints to match your actual backend routes
  dateEndpoint: 'https://yenerp.com/reportsapi/debitnote/date-dropdown',
  
  // Reusing the global dropdowns from Production Entry
  globalDropdownEndpoint: 'https://yenerp.com/reportsapi/purchaseOrders/global-dropdowns',

  exportFilename: 'Debit_Note_Report',
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

    // Global Filters
  
  ],

  columns: [
    { displayKey: "NOTE_NO", dataKey: "NOTE_NO", label: "Note No" },
    { displayKey: "CREATED_DATE", dataKey: "CREATED_DATE", label: "Debit Date" },
    { displayKey: "VENDOR_NAME", dataKey: "VENDOR_NAME", label: "Vendor Name" },
    { displayKey: "ITEM_NAME", dataKey: "ITEM_NAME", label: "Item Name" },
    { displayKey: "QTY", dataKey: "QTY", label: "Quantity", align: 'right' },
    { displayKey: "UNIT_PRICE", dataKey: "UNIT_PRICE", label: "Unit Price", align: 'right' },
    { displayKey: "TOTAL_PRICE", dataKey: "TOTAL_PRICE", label: "Total Price", align: 'right' },
    { displayKey: "TAX_AMOUNT", dataKey: "TAX_AMOUNT", label: "Tax Amount", align: 'right' },
    { displayKey: "FINAL_PRICE", dataKey: "FINAL_PRICE", label: "Final Price", align: 'right' },
    // Uncomment if needed in the future
    // { displayKey: "SGST", dataKey: "SGST", label: "SGST", align: 'right' },
    // { displayKey: "CGST", dataKey: "CGST", label: "CGST", align: 'right' },
    { displayKey: "REASON", dataKey: "REASON", label: "Reason" },
  ],
};