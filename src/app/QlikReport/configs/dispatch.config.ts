// ============================================================
// configs/dispatch.config.ts
// DISPATCH report — Standardized Config
// ============================================================

import { ReportConfig } from '../engine/types';

export interface DispatchesReport {
  DocNo?: string;
  dispatchNo?: string;
  LineID?: number;
  ItemCode?: string;
  ItemName?: string;
  Group?: string;
  "Sub-Group"?: string;
  UOM?: string;
  HSN?: string;
  Qty?: number;
  Price?: number;
  Total?: number;
  TaxCode?: string;
  TaxAmt?: string | number;
  LoginID?: string;
  LoginName?: string;
  LastName?: string;
  LocationId?: number | string;
  Location?: string;
  VehicleNo?: string;
  VehicleName?: string;
  "Driver-ID"?: string;
  DriverName?: string;
  Initial?: string;
  Date?: string;
  DespTime?: string;
  LeadTime?: number | string;
  ExpDate?: string;
}

export const dispatchConfig: ReportConfig<DispatchesReport> = {
  key: 'dispatch',
  title: 'Dispatch Report',
  apiBase: 'http://127.0.0.1:8000/reportsapi/dispatch',

  // Specific endpoint for Dispatch Date Filters
  dateEndpoint: 'http://127.0.0.1:8000/reportsapi/dispatch/date-dropdown',

  // NEW: Specific endpoint for Global Dropdowns (uses Production Entry API)
  globalDropdownEndpoint: 'http://127.0.0.1:8000/reportsapi/productionEntry/global-dropdowns',

  exportFilename: 'Dispatch_Report',
  defaultPageSize: 30,

  filters: [
    { type: 'year', label: 'Fiscal Year', apiParam: 'fiscalYear' },
    { type: 'month', label: 'Fiscal Month', apiParam: 'fiscalMonth' },
    { type: 'day', label: 'Day', apiParam: 'day' },

    // Global Filters
    {
      type: 'variance',
      label: 'Variance Name',
      apiParam: 'varianceName',
      searchable: true,
      paginated: true
    },
    {
      type: 'locations',
      label: 'Branch',
      apiParam: 'branchName',
      searchable: true,
      paginated: true
    },

  ],

  columns: [
    { displayKey: "DocNo", dataKey: "DocNo", label: "Doc No" },
    { displayKey: "dispatchNo", dataKey: "dispatchNo", label: "Dispatch No" },
    { displayKey: "LineID", dataKey: "LineID", label: "Line ID" },
    { displayKey: "ItemCode", dataKey: "ItemCode", label: "Item Code" },
    { displayKey: "ItemName", dataKey: "ItemName", label: "Item Name" },
    { displayKey: "Group", dataKey: "Group", label: "Category" },
    { displayKey: "Sub-Group", dataKey: "Sub-Group", label: "Sub Category" },
    { displayKey: "UOM", dataKey: "UOM", label: "Unit of Measure" },
    { displayKey: "HSN", dataKey: "HSN", label: "HSN Code" },
    { displayKey: "Qty", dataKey: "Qty", label: "Quantity", align: 'right' },
    { displayKey: "Price", dataKey: "Price", label: "Price", align: 'right' },
    { displayKey: "Total", dataKey: "Total", label: "Amount", align: 'right' },
    { displayKey: "TaxCode", dataKey: "TaxCode", label: "Tax Code" },
    { displayKey: "TaxAmt", dataKey: "TaxAmt", label: "Tax Amount", align: 'right' },
    { displayKey: "LoginID", dataKey: "LoginID", label: "Login ID" },
    { displayKey: "LoginName", dataKey: "LoginName", label: "Login Name" },
    { displayKey: "LastName", dataKey: "LastName", label: "Last Name" },
    { displayKey: "LocationId", dataKey: "LocationId", label: "Location ID" },
    { displayKey: "Location", dataKey: "Location", label: "Branch Name" },
    { displayKey: "VehicleNo", dataKey: "VehicleNo", label: "Vehicle Number" },
    { displayKey: "VehicleName", dataKey: "VehicleName", label: "Vehicle Name" },
    { displayKey: "Driver-ID", dataKey: "Driver-ID", label: "Driver ID" },
    { displayKey: "DriverName", dataKey: "DriverName", label: "Driver Name" },
    { displayKey: "Initial", dataKey: "Initial", label: "Initial" },
    { displayKey: "Date", dataKey: "Date", label: "Dispatch Date" },
    { displayKey: "DespTime", dataKey: "DespTime", label: "Dispatch Time" },
    { displayKey: "LeadTime", dataKey: "LeadTime", label: "Lead Time" },
    { displayKey: "ExpDate", dataKey: "ExpDate", label: "Expiry Date" },
  ],
};