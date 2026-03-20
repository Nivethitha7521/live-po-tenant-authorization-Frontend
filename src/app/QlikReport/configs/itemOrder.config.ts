// ============================================================
// configs/itemOrder.config.ts
// ITEM ORDER report — Standardized Config
// ============================================================

import { ReportConfig } from '../engine/types';

export interface ItemOrderReport {
  billDate?: string | null;
  billTime?: string;
  billNo?: string;
  netAmount?: string;
  discount?: string;
  billTax?: string;
  billTotalAmount?: string;
  locationName?: string;
  customerNo?: string;
  firstName?: string;
  lastName?: string;
  empId?: string;
  salesPersonName?: string;
  types?: string;
}

export const itemOrderConfig: ReportConfig<ItemOrderReport> = {
  key: 'itemOrder', // Unique key for Redux
  title: 'Item Order Report',

  // TODO: Update this API base URL to match your actual backend route
  apiBase: 'https://yenerp.com/reportsapi/itemOrder',

  // TODO: Update these endpoints to match your actual backend routes
  dateEndpoint: 'https://yenerp.com/reportsapi/itemOrder/date-dropdown',

  // Reusing the global dropdowns from Production Entry (or change if Item Order has its own)
  globalDropdownEndpoint: 'https://yenerp.com/reportsapi/productionEntry/global-dropdowns',

  exportFilename: 'Item_Order_Report',
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
    { displayKey: "billDate", dataKey: "billDate", label: "Bill Date" },
    { displayKey: "billTime", dataKey: "billTime", label: "Bill Time" },
    { displayKey: "billNo", dataKey: "billNo", label: "Bill No" },
    { displayKey: "netAmount", dataKey: "netAmount", label: "Net Amount", align: 'right' },
    { displayKey: "discount", dataKey: "discount", label: "Discount", align: 'right' },
    { displayKey: "billTax", dataKey: "billTax", label: "Bill Tax", align: 'right' },
    { displayKey: "billTotalAmount", dataKey: "billTotalAmount", label: "Total Amount", align: 'right' },
    { displayKey: "locationName", dataKey: "locationName", label: "Location" },
    { displayKey: "customerNo", dataKey: "customerNo", label: "Customer No" },
    { displayKey: "firstName", dataKey: "firstName", label: "First Name" },
    { displayKey: "lastName", dataKey: "lastName", label: "Last Name" },
    { displayKey: "empId", dataKey: "empId", label: "Employee ID" },
    { displayKey: "salesPersonName", dataKey: "salesPersonName", label: "Sales Person" },
    { displayKey: "types", dataKey: "types", label: "Type" },
  ],
};