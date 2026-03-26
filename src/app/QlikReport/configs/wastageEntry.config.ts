// ============================================================
// configs/wastageEntry.config.ts
// WASTAGE ENTRY report — Standardized Config
// ============================================================

import { ReportConfig } from '../engine/types';

export interface WastageEntryReport {
  ItemCode?: string;
  ItemName?: string;
  Group?: string;
  Sub_Group?: string;
  UOM?: string;
  HSN?: number;
  Qty?: number;
  TaxCode?: string;
  Price?: number;
  Amount?: number;
  DocNo?: string;
  postingDate?: string;
  createdBy?: string;
  firstName?: string;
  lastName?: string;
  Location?: string;
  ReasonName?: string;
}

export const wastageEntryConfig: ReportConfig<WastageEntryReport> = {
  key: 'wastageEntry', // Unique key for Redux
  title: 'Wastage Entry Report',

  // TODO: Update this API base URL to match your actual backend route
  apiBase: 'http://127.0.0.1:8000/reportsapi/wastageEntrys',

  // TODO: Update these endpoints to match your actual backend routes
  dateEndpoint: 'http://127.0.0.1:8000/reportsapi/wastageEntrys/date-dropdown',

  // Reusing the global dropdowns from Production Entry (or change if Wastage has specific dropdowns)
  globalDropdownEndpoint: 'http://127.0.0.1:8000/reportsapi/productionEntry/global-dropdowns',

  exportFilename: 'Wastage_Entry_Report',
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
    { displayKey: "DocNo", dataKey: "DocNo", label: "Doc No" },
    { displayKey: "ItemCode", dataKey: "ItemCode", label: "Item Code" },
    { displayKey: "ItemName", dataKey: "ItemName", label: "Item Name" },
    { displayKey: "Group", dataKey: "Group", label: "Category" },
    { displayKey: "Sub_Group", dataKey: "Sub_Group", label: "Sub Category" },
    { displayKey: "UOM", dataKey: "UOM", label: "UOM" },
    { displayKey: "HSN", dataKey: "HSN", label: "HSN Code" },
    { displayKey: "Qty", dataKey: "Qty", label: "Quantity", align: 'right' },
    { displayKey: "Price", dataKey: "Price", label: "Price", align: 'right' },
    { displayKey: "Amount", dataKey: "Amount", label: "Amount", align: 'right' },
    { displayKey: "TaxCode", dataKey: "TaxCode", label: "Tax Code" },
    { displayKey: "postingDate", dataKey: "postingDate", label: "Posting Date" },
    { displayKey: "createdBy", dataKey: "createdBy", label: "Created By" },
    { displayKey: "firstName", dataKey: "firstName", label: "First Name" },
    { displayKey: "lastName", dataKey: "lastName", label: "Last Name" },
    { displayKey: "Location", dataKey: "Location", label: "Location" },
    { displayKey: "ReasonName", dataKey: "ReasonName", label: "Reason" },
  ],
};