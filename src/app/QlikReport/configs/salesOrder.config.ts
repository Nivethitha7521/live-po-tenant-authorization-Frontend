// ============================================================
// configs/salesOrder.config.ts
// SALES ORDER report — Standardized Config
// ============================================================

import { ReportConfig } from '../engine/types';

export interface SalesOrderReport {
    billDate?: string | null;
    billTime?: string | null;
    cashReciveDate?: string | null;
    cashReciveTime?: string | null;
    deliveryDate?: string | null;
    billNo?: string | null;
    headerDocNo?: string | null;
    netAmount?: number | null;
    discount?: number | null;
    billTax?: number | null;
    billTotalAmount?: number | null;
    locationName?: string | null;
    customerNo?: string | null;
    customerName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    empID?: string | null;
    SalesPerson?: string | null;
    type?: string | null;
    type1?: string | null;
    advanceAmount?: number | null;
}

export const salesOrderConfig: ReportConfig<SalesOrderReport> = {
    key: 'salesOrder', // Unique key for Redux
    title: 'Sales Order Report',

    // TODO: Update this API base URL to match your actual backend route
    apiBase: 'https://yenerp.com/reportsapi/Salesorder',

    // TODO: Update these endpoints to match your actual backend routes
    dateEndpoint: 'https://yenerp.com/reportsapi/Salesorder/date-dropdown',

    // Reusing the global dropdowns from Production Entry (or change if Sales has its own)
    globalDropdownEndpoint: 'https://yenerp.com/reportsapi/productionEntry/global-dropdowns',

    exportFilename: 'Sales_Order_Report',
    defaultPageSize: 30,

    filters: [
        { type: 'year', label: 'Fiscal Year', apiParam: 'fiscalYear' },
        { type: 'month', label: 'Fiscal Month', apiParam: 'fiscalMonth' },
        { type: 'day', label: 'Day', apiParam: 'day' },

        // Global Filters (Example filters, adjust types/apiParams as needed for Sales)
        {
            type: 'locations',
            label: 'Branch',
            apiParam: 'branchName',
            searchable: true,
            paginated: true
        },

    ],

    columns: [
        { displayKey: "billDate", dataKey: "billDate", label: "Bill Date" },
        { displayKey: "billTime", dataKey: "billTime", label: "Bill Time" },
        { displayKey: "cashReciveDate", dataKey: "cashReciveDate", label: "Cash Receive Date" },
        { displayKey: "cashReciveTime", dataKey: "cashReciveTime", label: "Cash Receive Time" },
        { displayKey: "deliveryDate", dataKey: "deliveryDate", label: "Delivery Date" },
        { displayKey: "billNo", dataKey: "billNo", label: "Bill No" },
        { displayKey: "headerDocNo", dataKey: "headerDocNo", label: "Header Doc No" },
        { displayKey: "netAmount", dataKey: "netAmount", label: "Net Amount", align: 'right' },
        { displayKey: "discount", dataKey: "discount", label: "Discount", align: 'right' },
        { displayKey: "billTax", dataKey: "billTax", label: "Tax", align: 'right' },
        { displayKey: "billTotalAmount", dataKey: "billTotalAmount", label: "Total Amount", align: 'right' },
        { displayKey: "locationName", dataKey: "locationName", label: "Location" },
        { displayKey: "customerNo", dataKey: "customerNo", label: "Customer No" },
        { displayKey: "customerName", dataKey: "customerName", label: "Customer Name" },
        { displayKey: "firstName", dataKey: "firstName", label: "First Name" },
        { displayKey: "lastName", dataKey: "lastName", label: "Last Name" },
        { displayKey: "empID", dataKey: "empID", label: "Employee ID" },
        { displayKey: "SalesPerson", dataKey: "SalesPerson", label: "Sales Person" },
        { displayKey: "type", dataKey: "type", label: "Type" },
        { displayKey: "type1", dataKey: "type1", label: "Type 1" },
        { displayKey: "advanceAmount", dataKey: "advanceAmount", label: "Advance Amount", align: 'right' },
    ],
};