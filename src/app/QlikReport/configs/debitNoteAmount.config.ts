// ============================================================
// configs/debitNoteAmount.config.ts
// DEBIT NOTE AMOUNT WISE report — Standardized Config
// ============================================================

import { ReportConfig } from '../engine/types';

export interface DebitNoteAmountReport {
    NOTE_NO?: string;
    NOTE_ID?: string;
    NOTE_TYPE?: string;
    VENDOR_NAME?: string;
    TOTAL_AMOUNT?: number;
    TAX_AMOUNT?: number;
    FINAL_AMOUNT?: number;
    STATUS?: string;
    CREATED_DATE?: string;
    RETURN_DATE?: string;
}

export const debitNoteAmountConfig: ReportConfig<DebitNoteAmountReport> = {
    key: 'debitNoteAmount', // Unique key for Redux
    title: 'Debit Note Amount Wise Report',

    // TODO: Update this API base URL to match your actual backend route
    apiBase: 'http://127.0.0.1:8000/reportsapi/debitnote/amount-wise',

    // TODO: Update these endpoints to match your actual backend routes
    dateEndpoint: 'http://127.0.0.1:8000/reportsapi/debitnote/date-dropdown',

    // Reusing the global dropdowns from Production Entry
    globalDropdownEndpoint: 'http://127.0.0.1:8000/reportsapi/purchaseOrders/global-dropdowns',

    exportFilename: 'Debit_Note_Amount_Report',
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
        { displayKey: "NOTE_ID", dataKey: "NOTE_ID", label: "Note Id" },
        { displayKey: "NOTE_NO", dataKey: "NOTE_NO", label: "Note No" },
        { displayKey: "NOTE_TYPE", dataKey: "NOTE_TYPE", label: "Note Type" },
        { displayKey: "VENDOR_NAME", dataKey: "VENDOR_NAME", label: "Vendor Name" },
        { displayKey: "TOTAL_AMOUNT", dataKey: "TOTAL_AMOUNT", label: "Total Amount", align: 'right' },
        { displayKey: "TAX_AMOUNT", dataKey: "TAX_AMOUNT", label: "Tax Amount", align: 'right' },
        { displayKey: "FINAL_AMOUNT", dataKey: "FINAL_AMOUNT", label: "Final Amount", align: 'right' },
        { displayKey: "STATUS", dataKey: "STATUS", label: "Status" },
        { displayKey: "RETURN_DATE", dataKey: "RETURN_DATE", label: "Return Date" },
    ],
};