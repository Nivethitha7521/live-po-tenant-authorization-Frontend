// ============================================================
// configs/itemTransfer.config.ts
// ITEM TRANSFER report — Standardized Config
// ============================================================

import { ReportConfig } from '../engine/types';

export interface ItemTransferReport {
  DocNo?: string;
  LineID?: number;
  ItemCode?: string | null;
  ItemName?: string | null;
  Group?: string | null;
  "Sub-Group"?: string | null;
  UOM?: string | null;
  HSN?: string | null;
  ReqQty?: number;
  TransferQty?: number;
  "Recv.Variance"?: number;
  "Unit Price"?: number;
  VariancePrice?: string | null;
  "From.Loc"?: string | null;
  "To.Loc"?: string | null;
  "Tran.Date"?: string | null;
  "Tran.Time"?: string | null;
  "Recv.Date"?: string | null;
  "Recv.Time"?: string | null;
  DriverCode?: string | null;
  DriverName?: string | null;
  VehicleCode?: string | null;
  VehicleName?: string | null;
  "Trans.LogID"?: string | null;
  "Trans.Name"?: string | null;
  "Recv.LogID"?: string | null;
  "Recv.Name"?: string | null;
}

export const itemTransferConfig: ReportConfig<ItemTransferReport> = {
  key: 'itemTransfer', // Unique key for Redux
  title: 'Item Transfer Report',

  // TODO: Update this API base URL to match your actual backend route
  apiBase: 'http://127.0.0.1:8000/reportsapi/ItemTransfers',

  // TODO: Update these endpoints to match your actual backend routes
  dateEndpoint: 'http://127.0.0.1:8000/reportsapi/ItemTransfers/date-dropdown',

  // Reusing the global dropdowns from Production Entry (or change if Item Transfer has its own)
  globalDropdownEndpoint: 'http://127.0.0.1:8000/reportsapi/productionEntry/global-dropdowns',

  exportFilename: 'Item_Transfer_Report',
  defaultPageSize: 30,

  filters: [
    { type: 'year', label: 'Fiscal Year', apiParam: 'fiscalYear' },
    { type: 'month', label: 'Fiscal Month', apiParam: 'fiscalMonth' },
    { type: 'day', label: 'Day', apiParam: 'day' },

    // Global Filters
    {
      type: 'locations',
      label: 'From Branch',
      apiParam: 'frombranchName',
      searchable: true,
      paginated: true
    },
     {
      type: 'locations',
      label: 'To Branch',
      apiParam: 'tobranchName',
      searchable: true,
      paginated: true
    },

  ],

  columns: [
    { displayKey: "DocNo", dataKey: "DocNo", label: "Doc No" },
    { displayKey: "LineID", dataKey: "LineID", label: "Line ID" },
    { displayKey: "ItemCode", dataKey: "ItemCode", label: "Item Code" },
    { displayKey: "ItemName", dataKey: "ItemName", label: "Item Name" },
    { displayKey: "Group", dataKey: "Group", label: "Category" },
    { displayKey: "Sub-Group", dataKey: "Sub-Group", label: "Sub Category" },
    { displayKey: "UOM", dataKey: "UOM", label: "UOM" },
    { displayKey: "HSN", dataKey: "HSN", label: "HSN Code" },
    { displayKey: "ReqQty", dataKey: "ReqQty", label: "Requested Qty", align: 'right' },
    { displayKey: "TransferQty", dataKey: "TransferQty", label: "Transfer Qty", align: 'right' },
    { displayKey: "Recv.Variance", dataKey: "Recv.Variance", label: "Variance Qty", align: 'right' },
    { displayKey: "Unit Price", dataKey: "Unit Price", label: "Unit Price", align: 'right' },
    { displayKey: "VariancePrice", dataKey: "VariancePrice", label: "Variance Price", align: 'right' },
    { displayKey: "From.Loc", dataKey: "From.Loc", label: "From Branch" },
    { displayKey: "To.Loc", dataKey: "To.Loc", label: "To Branch" },
    { displayKey: "Tran.Date", dataKey: "Tran.Date", label: "Transfer Date" },
    { displayKey: "Tran.Time", dataKey: "Tran.Time", label: "Transfer Time" },
    { displayKey: "Recv.Date", dataKey: "Recv.Date", label: "Receive Date" },
    { displayKey: "Recv.Time", dataKey: "Recv.Time", label: "Receive Time" },
    { displayKey: "Trans.LogID", dataKey: "Trans.LogID", label: "Transferred By (ID)" },
    { displayKey: "Trans.Name", dataKey: "Trans.Name", label: "Transferred By (Name)" },
    { displayKey: "Recv.LogID", dataKey: "Recv.LogID", label: "Received By (ID)" },
    { displayKey: "Recv.Name", dataKey: "Recv.Name", label: "Received By (Name)" },
    { displayKey: "DriverCode", dataKey: "DriverCode", label: "Driver Code" },
    { displayKey: "DriverName", dataKey: "DriverName", label: "Driver Name" },
    { displayKey: "VehicleCode", dataKey: "VehicleCode", label: "Vehicle Code" },
    { displayKey: "VehicleName", dataKey: "VehicleName", label: "Vehicle Name" },
  ],
};