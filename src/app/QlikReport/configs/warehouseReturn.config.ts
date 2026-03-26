// ============================================================
// configs/warehouseReturn.config.ts
// WAREHOUSE RETURN report — Standardized Config
// ============================================================

import { ReportConfig } from '../engine/types';

export interface WarehouseReturnReport {
  DocNo?: string;
  UniqueDocNo?: string;
  ItemCode?: string;
  ItemName?: string;
  Group?: string;
  Sub_Group?: string;
  UOM?: string;
  HSN?: string;
  TransferQty?: number;
  ReciveQty?: number;
  Price?: number;
  Total?: number;
  TaxCode?: string;
  TaxAmt?: number;
  Rec_ID?: string;
  Rec_Name?: string;
  lastName?: string;
  DriverCode?: string;
  VehicleNo?: string;
  Rec_Date?: string;
  Rec_Time?: string;
  Location?: string;
  ReasonName?: string;
}

export const warehouseReturnConfig: ReportConfig<WarehouseReturnReport> = {
  key: 'warehouseReturn', // Unique key for Redux
  title: 'Warehouse Return Report',

  // TODO: Update this API base URL to match your actual backend route
  apiBase: 'http://127.0.0.1:8000/reportsapi/WastageReceives',

  // TODO: Update these endpoints to match your actual backend routes
  dateEndpoint: 'http://127.0.0.1:8000/reportsapi/WastageReceives/date-dropdown',

  // Reusing the global dropdowns from Production Entry
  globalDropdownEndpoint: 'http://127.0.0.1:8000/reportsapi/productionEntry/global-dropdowns',

  exportFilename: 'Warehouse_Return_Report',
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
    { displayKey: "UniqueDocNo", dataKey: "UniqueDocNo", label: "Unique Doc No" },
    { displayKey: "ItemCode", dataKey: "ItemCode", label: "Item Code" },
    { displayKey: "ItemName", dataKey: "ItemName", label: "Item Name" },
    { displayKey: "Group", dataKey: "Group", label: "Category" },
    { displayKey: "Sub_Group", dataKey: "Sub_Group", label: "Sub Category" },
    { displayKey: "UOM", dataKey: "UOM", label: "UOM" },
    { displayKey: "HSN", dataKey: "HSN", label: "HSN Code" },
    { displayKey: "TransferQty", dataKey: "TransferQty", label: "Transfer Qty", align: 'right' },
    { displayKey: "ReciveQty", dataKey: "ReciveQty", label: "Received Qty", align: 'right' },
    { displayKey: "Price", dataKey: "Price", label: "Price", align: 'right' },
    { displayKey: "Total", dataKey: "Total", label: "Total Amount", align: 'right' },
    { displayKey: "TaxCode", dataKey: "TaxCode", label: "Tax Code" },
    { displayKey: "TaxAmt", dataKey: "TaxAmt", label: "Tax Amount", align: 'right' },
    { displayKey: "Rec_ID", dataKey: "Rec_ID", label: "Received By (ID)" },
    { displayKey: "Rec_Name", dataKey: "Rec_Name", label: "Received By (Name)" },
    { displayKey: "lastName", dataKey: "lastName", label: "Last Name" },
    { displayKey: "DriverCode", dataKey: "DriverCode", label: "Driver Code" },
    { displayKey: "VehicleNo", dataKey: "VehicleNo", label: "Vehicle No" },
    { displayKey: "Rec_Date", dataKey: "Rec_Date", label: "Receive Date" },
    { displayKey: "Rec_Time", dataKey: "Rec_Time", label: "Receive Time" },
    { displayKey: "Location", dataKey: "Location", label: "Branch / Location" },
    { displayKey: "ReasonName", dataKey: "ReasonName", label: "Reason" },
  ],
};