// ============================================================
// configs/grnAgainst.config.ts
// GRN AGAINST report — Standardized Config
// ============================================================

import { ReportConfig } from '../engine/types';

export interface GrnAgainstReport {
    s_no?: number;
    apRandomId?: string;
    grnDate?: string | null;
    apcreatedDate?: string | null;
    invoiceNo?: string;
    createdDate?: string | null;
    vendorName?: string;
    billingAddress?: string;
    gstNumber?: string;
    randomId?: string;
    grnAmount?: number;
    totalTax?: number;
    netAmount?: number;
    gst_bos?: string;
    item_service?: string;
    role?: string;
    grpo_Remarks?: string;
    ap_Remarks?: string;
    status?: string; // Changed from String to string for consistency
}

export const grnAgainstConfig: ReportConfig<GrnAgainstReport> = {
    key: 'grnAgainst', // Unique key for Redux
    title: 'GRN Against Report',

    // TODO: Update this API base URL to match your actual backend route
    apiBase: 'https://yenerp.com/reportsapi/grnagainst',

    // TODO: Update these endpoints to match your actual backend routes
    dateEndpoint: 'https://yenerp.com/reportsapi/grnagainst/date-dropdown',

    // Reusing the global dropdowns from Production Entry
    globalDropdownEndpoint: 'https://yenerp.com/reportsapi/purchaseOrders/global-dropdowns',

    exportFilename: 'GRN_Against_Report',
    defaultPageSize: 30,

    filters: [
        { type: 'year', label: 'Fiscal Year', apiParam: 'fiscalYear' },
        { type: 'month', label: 'Fiscal Month', apiParam: 'fiscalMonth' },
        { type: 'day', label: 'Day', apiParam: 'day' },

        // Global Filters
        {
            type: 'vendor',
            label: 'Vendor Name',
            apiParam: 'vendorName',
            searchable: true,
            paginated: true
        },

    ],

    columns: [
        { displayKey: "randomId", dataKey: "randomId", label: "GRPO No" },
        { displayKey: "grnDate", dataKey: "grnDate", label: "GRPO Date" },
        { displayKey: "apcreatedDate", dataKey: "apcreatedDate", label: "A/P Invoice Date" },
        { displayKey: "apRandomId", dataKey: "apRandomId", label: "A/P Invoice No" },
        { displayKey: "gst_bos", dataKey: "gst_bos", label: "GST/BOS" },
        { displayKey: "item_service", dataKey: "item_service", label: "Item/Service" },
        { displayKey: "role", dataKey: "role", label: "User Name" },
        { displayKey: "invoiceNo", dataKey: "invoiceNo", label: "Vendor Ref. No" },
        { displayKey: "status", dataKey: "status", label: "Status" },
        { displayKey: "vendorName", dataKey: "vendorName", label: "Vendor Name" },
        { displayKey: "billingAddress", dataKey: "billingAddress", label: "Bill to" },
        { displayKey: "gstNumber", dataKey: "gstNumber", label: "GST No" },
        { displayKey: "netAmount", dataKey: "netAmount", label: "Net Amount", align: 'right' },
        { displayKey: "totalTax", dataKey: "totalTax", label: "Tax Amount", align: 'right' },
        { displayKey: "grnAmount", dataKey: "grnAmount", label: "Gross Amount", align: 'right' },
        { displayKey: "grpo_Remarks", dataKey: "grpo_Remarks", label: "GRPO Remarks" },
        { displayKey: "ap_Remarks", dataKey: "ap_Remarks", label: "A/P Remarks" },
    ],
};