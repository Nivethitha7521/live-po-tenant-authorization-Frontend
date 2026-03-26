// ============================================================
// configs/itemwiseSales.config.ts
// ITEMWISE SALES report — Standardized Config
// ============================================================

import { ReportConfig } from '../engine/types';

export interface ItemwiseSalesReport {
  screenID?: string;
  rowNo?: number;
  billDate?: string;
  billTime?: string;
  billNo?: string;
  itemCode?: string;
  itemName?: string;
  uom?: string;
  hsn?: string;
  categoryName?: string;
  subGroup?: string;
  itemPrice?: number;
  qty?: number;
  tax?: string;
  netValue?: number;
  taxValue?: number;
  lineTotal?: number;
  loginID?: string;
  loginName?: string;
  lastName?: string;
  branchName?: string;
  customerNo?: string;
  saleOrderNo?: string;
  salesPerson?: string;
  initial?: string;
  s_no?: number; // Frontend only
}

export const itemwiseSalesConfig: ReportConfig<ItemwiseSalesReport> = {
  key: 'itemwiseSales', // Unique key for Redux
  title: 'Itemwise Sales Report',
  apiBase: 'http://127.0.0.1:8000/reportsapi/itemwiseSales',

  // TODO: Update these endpoints if your backend routes differ from the standard pattern
  dateEndpoint: 'http://127.0.0.1:8000/reportsapi/itemwiseSales/date-dropdown',

  // Assuming global dropdowns might be shared or have a specific endpoint
  // If this report has specific dropdowns, change this URL. 
  // Otherwise, keep it consistent with other reports or remove to use apiBase.
  globalDropdownEndpoint: 'http://127.0.0.1:8000/reportsapi/productionEntry/global-dropdowns',

  exportFilename: 'Itemwise_Sales_Report',
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
    { displayKey: "screenID", dataKey: "screenID", label: "Screen ID" },
    { displayKey: "rowNo", dataKey: "rowNo", label: "Row No" },
    { displayKey: "billDate", dataKey: "billDate", label: "Bill Date" },
    { displayKey: "billTime", dataKey: "billTime", label: "Bill Time" },
    { displayKey: "billNo", dataKey: "billNo", label: "Bill No" },
    { displayKey: "itemCode", dataKey: "itemCode", label: "Item Code" },
    { displayKey: "itemName", dataKey: "itemName", label: "Item Name" },
    { displayKey: "uom", dataKey: "uom", label: "UOM" },
    { displayKey: "hsn", dataKey: "hsn", label: "HSN" },
    { displayKey: "categoryName", dataKey: "categoryName", label: "Category Name" },
    { displayKey: "subGroup", dataKey: "subGroup", label: "Sub-Group" },
    { displayKey: "itemPrice", dataKey: "itemPrice", label: "Item Price", align: 'right' },
    { displayKey: "qty", dataKey: "qty", label: "Qty", align: 'right' },
    { displayKey: "tax", dataKey: "tax", label: "Tax" },
    { displayKey: "netValue", dataKey: "netValue", label: "Net Value", align: 'right' },
    { displayKey: "taxValue", dataKey: "taxValue", label: "Tax Value", align: 'right' },
    { displayKey: "lineTotal", dataKey: "lineTotal", label: "Line Total", align: 'right' },
    { displayKey: "loginID", dataKey: "loginID", label: "Login ID" },
    { displayKey: "loginName", dataKey: "loginName", label: "Login Name" },
    { displayKey: "lastName", dataKey: "lastName", label: "Last Name" },
    { displayKey: "branchName", dataKey: "branchName", label: "Branch Name" },
    { displayKey: "customerNo", dataKey: "customerNo", label: "Customer No" },
    { displayKey: "saleOrderNo", dataKey: "saleOrderNo", label: "Sale Order No" },
    { displayKey: "salesPerson", dataKey: "salesPerson", label: "Sales Person" },
    { displayKey: "initial", dataKey: "initial", label: "Initial" },
  ],
};