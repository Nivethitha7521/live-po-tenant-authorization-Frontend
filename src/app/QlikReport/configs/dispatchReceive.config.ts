// ============================================================
// configs/dispatchReceive.config.ts
// DISPATCH RECEIVE report — Standardized Config
// ============================================================

import { ReportConfig } from '../engine/types';

export interface DispatchReceiveReport {
    DocNo?: string;
    DespatchNo?: string;
    LineID?: number;
    ItemCode?: string;
    ItemName?: string;
    Group?: string;
    "Sub-Group"?: string;
    UOM?: string;
    HSN?: string;
    ReceivedQty?: number;
    Price?: number;
    Total?: number;
    TaxCode?: string | null;
    TaxAmt?: string | number | null;
    LoginID?: string;
    LoginName?: string;
    "Loc.ID"?: string;
    Location?: string;
    VehicleNo?: string;
    DriverCode?: string;
    DriverName?: string;
    Date?: string;
    "Receive.Time"?: string;
}

export const dispatchReceiveConfig: ReportConfig<DispatchReceiveReport> = {
    key: 'dispatchReceive', // Unique key for Redux
    title: 'Dispatch Receive Report',
    apiBase: 'https://yenerp.com/reportsapi/dispatch/locationreceive', // Adjust API base as needed

    // NOTE: Update these endpoints to match your actual backend routes for Dispatch Receive
    dateEndpoint: 'https://yenerp.com/reportsapi/dispatch/receive/date-dropdown',

    // Reusing the global dropdowns from Production Entry (as per previous setup)
    globalDropdownEndpoint: 'https://yenerp.com/reportsapi/productionEntry/global-dropdowns',

    exportFilename: 'Dispatch_Receive_Report',
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
        { displayKey: "DespatchNo", dataKey: "DespatchNo", label: "Dispatch No" },
        { displayKey: "LineID", dataKey: "LineID", label: "Line ID" },
        { displayKey: "ItemCode", dataKey: "ItemCode", label: "Item Code" },
        { displayKey: "ItemName", dataKey: "ItemName", label: "Item Name" },
        { displayKey: "Group", dataKey: "Group", label: "Category" },
        { displayKey: "Sub-Group", dataKey: "Sub-Group", label: "Sub Category" },
        { displayKey: "UOM", dataKey: "UOM", label: "Unit of Measure" },
        { displayKey: "HSN", dataKey: "HSN", label: "HSN Code" },
        { displayKey: "ReceivedQty", dataKey: "ReceivedQty", label: "Quantity", align: 'right' },
        { displayKey: "Price", dataKey: "Price", label: "Price", align: 'right' },
        { displayKey: "Total", dataKey: "Total", label: "Amount", align: 'right' },
        { displayKey: "TaxCode", dataKey: "TaxCode", label: "Tax Code" },
        { displayKey: "TaxAmt", dataKey: "TaxAmt", label: "Tax Amount", align: 'right' },
        { displayKey: "LoginID", dataKey: "LoginID", label: "Login ID" },
        { displayKey: "LoginName", dataKey: "LoginName", label: "Login Name" },
        { displayKey: "Loc.ID", dataKey: "Loc.ID", label: "Location ID" },
        { displayKey: "Location", dataKey: "Location", label: "Branch Name" },
        { displayKey: "VehicleNo", dataKey: "VehicleNo", label: "Vehicle Number" },
        { displayKey: "DriverCode", dataKey: "DriverCode", label: "Driver Code" },
        { displayKey: "DriverName", dataKey: "DriverName", label: "Driver Name" },
        { displayKey: "Date", dataKey: "Date", label: "Date" },
        { displayKey: "Receive.Time", dataKey: "Receive.Time", label: "Receive Time" }
    ],
};