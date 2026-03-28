// ============================================================
// configs/pettyCashExpense.config.ts
// PETTY CASH EXPENSE report — Standardized Config
// ============================================================

import { ReportConfig } from '../engine/types';

export interface PettyCashExpenseReport {
    documentNo?: string;
    postingDate?: string;
    postingTime?: string;
    counterReference?: string;
    location?: string;
    modeOfPayment?: string;
    accountName?: string;
    remarks?: string;
    payedAmount?: number;
}

export const pettyCashExpenseConfig: ReportConfig<PettyCashExpenseReport> = {
    key: 'pettyCashExpense', // Unique key for Redux
    title: 'Petty Cash Expense Report',

    // TODO: Update this API base URL to match your actual backend route
    apiBase: 'https://yenerp.com/reportsapi/pettycashExpense',

    // TODO: Update these endpoints to match your actual backend routes
    dateEndpoint: 'https://yenerp.com/reportsapi/pettycashExpense/date-dropdown',

    // Reusing the global dropdowns from Production Entry
    globalDropdownEndpoint: 'https://yenerp.com/reportsapi/productionEntry/global-dropdowns',

    exportFilename: 'Petty_Cash_Expense_Report',
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
        { displayKey: "documentNo", dataKey: "documentNo", label: "Document No" },
        { displayKey: "postingDate", dataKey: "postingDate", label: "Posting Date" },
        { displayKey: "postingTime", dataKey: "postingTime", label: "Posting Time" },
        { displayKey: "counterReference", dataKey: "counterReference", label: "Counter Reference" },
        { displayKey: "location", dataKey: "location", label: "Location" },
        { displayKey: "modeOfPayment", dataKey: "modeOfPayment", label: "Mode of Payment" },
        { displayKey: "accountName", dataKey: "accountName", label: "Account Name" },
        { displayKey: "remarks", dataKey: "remarks", label: "Remarks" },
        { displayKey: "payedAmount", dataKey: "payedAmount", label: "Paid Amount", align: 'right' },
    ],
};