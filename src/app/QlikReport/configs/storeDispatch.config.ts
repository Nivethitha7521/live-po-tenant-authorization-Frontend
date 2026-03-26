// ============================================================
// configs/storeDispatch.config.ts
// STORE DISPATCH report — Standardized Config
// ============================================================

import { ReportConfig } from '../engine/types';

export interface StoreDispatchReport {
  dispatchNumber?: number | null;
  docInternalId?: string;
  docDate?: string | null;
  postingDate?: string | null;
  totalAmount?: number;
  fromWhsCode?: string | null;
  toWhsCode?: string | null;
  location?: string | null;
  section?: string | null;
  createdBy?: string;
  status?: string;
  // Item-specific fields
  itemCode?: string;
  itemName?: string;
  uom?: string;
  qty?: number;
  price?: number;
  amount?: number;
  category?: string;
  subcategory?: string;
  hsn?: string;
}

export const storeDispatchConfig: ReportConfig<StoreDispatchReport> = {
  key: 'storeDispatch', // Unique key for Redux
  title: 'Store Dispatch Report',
  
  // TODO: Update this API base URL to match your actual backend route
  apiBase: 'http://127.0.0.1:8000/reportsapi/rawmaterial',

  // TODO: Update these endpoints to match your actual backend routes
  dateEndpoint: 'http://127.0.0.1:8000/reportsapi/rawmaterial/date-dropdown',
  
  // Reusing the global dropdowns from Production Entry
  globalDropdownEndpoint: 'http://127.0.0.1:8000/reportsapi/productionEntry/global-dropdowns',

  exportFilename: 'Store_Dispatch_Report',
  defaultPageSize: 30,

  filters: [
    { type: 'year', label: 'Fiscal Year', apiParam: 'fiscalYear' },
    { type: 'month', label: 'Fiscal Month', apiParam: 'fiscalMonth' },
    { type: 'day', label: 'Day', apiParam: 'day' },

    // Global Filters
    {
      type: 'locations',
      label: 'Location',
      apiParam: 'location',
      searchable: true,
      paginated: true
    },
   
  ],

  columns: [
    // Note: ALL_COLUMNS mapped 's_no' displayKey to 'dispatchNumber' dataKey
    { displayKey: "dispatchNumber", dataKey: "dispatchNumber", label: "Dispatch No" },
    { displayKey: "docInternalId", dataKey: "docInternalId", label: "Doc Internal ID" },
    { displayKey: "docDate", dataKey: "docDate", label: "Doc Date" },
    { displayKey: "postingDate", dataKey: "postingDate", label: "Posting Date" },
    { displayKey: "itemCode", dataKey: "itemCode", label: "Item Code" },
    { displayKey: "itemName", dataKey: "itemName", label: "Item Name" },
    { displayKey: "uom", dataKey: "uom", label: "UOM" },
    { displayKey: "qty", dataKey: "qty", label: "Quantity", align: 'right' },
    { displayKey: "price", dataKey: "price", label: "Price", align: 'right' },
    { displayKey: "amount", dataKey: "amount", label: "Amount", align: 'right' },
    { displayKey: "totalAmount", dataKey: "totalAmount", label: "Total Amount", align: 'right' },
    { displayKey: "fromWhsCode", dataKey: "fromWhsCode", label: "From Warehouse" },
    { displayKey: "toWhsCode", dataKey: "toWhsCode", label: "To Warehouse" },
    { displayKey: "location", dataKey: "location", label: "Location" },
    { displayKey: "section", dataKey: "section", label: "Section" },
    { displayKey: "createdBy", dataKey: "createdBy", label: "Created By" },
    { displayKey: "status", dataKey: "status", label: "Status" },
    { displayKey: "category", dataKey: "category", label: "Category" },
    { displayKey: "subcategory", dataKey: "subcategory", label: "Subcategory" },
    { displayKey: "hsn", dataKey: "hsn", label: "HSN" },
  ],
};