// ============================================================
// configs/dispatchLocationReceive.config.ts
// DISPATCH LOCATION RECEIVE report — Standardized Config
// ============================================================

import { ReportConfig } from '../engine/types';

export interface DispatchLocationReceiveReport {
    DocNo?: string;
    dispatchNo?: string;
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
    TaxCode?: string;
    TaxAmt?: string | number;
    LoginID?: string;
    LoginName?: string;
    "Loc.ID"?: number | string;
    Location?: string;
    VehicleNo?: string;
    DriverCode?: string;
    DriverName?: string;
    Date?: string;
    ReceiveTime?: string;
}

export const dispatchLocationReceiveConfig: ReportConfig<DispatchLocationReceiveReport> = {
    key: 'dispatchLocationReceive', // Unique key for Redux
    title: 'Dispatch Location Receive Report',

    // TODO: Update this API base URL to match your actual backend route
    apiBase: 'http://127.0.0.1:8000/reportsapi/dispatch/locationreceive',

    // TODO: Update these endpoints to match your actual backend routes
    dateEndpoint: 'http://127.0.0.1:8000/reportsapi/dispatch/receive/date-dropdown',

    // Reusing the global dropdowns from Production Entry (as per previous setup)
    globalDropdownEndpoint: 'http://127.0.0.1:8000/reportsapi/productionEntry/global-dropdowns',

    exportFilename: 'Dispatch_Location_Receive_Report',
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

        // Note: Displaying "Qty" label for ReceivedQty data as per your ALL_COLUMNS example
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

        // Note: Displaying "Driver-ID" label for DriverCode data as per your ALL_COLUMNS example
        { displayKey: "DriverCode", dataKey: "DriverCode", label: "Driver ID" },

        { displayKey: "DriverName", dataKey: "DriverName", label: "Driver Name" },
        { displayKey: "Date", dataKey: "Date", label: "Receive Date" },
        { displayKey: "ReceiveTime", dataKey: "ReceiveTime", label: "Receive Time" }
    ],
};