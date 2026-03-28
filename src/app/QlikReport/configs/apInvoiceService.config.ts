// ============================================================
// configs/apInvoiceService.config.ts
// AP INVOICE SERVICE report — Standardized Config
// ============================================================

import { ReportConfig } from '../engine/types';

export interface ApInvoiceServiceReport {
    InternalNo?: string;
    PostingDate?: string;
    InvoiceNo?: string;
    InvoiceDate?: string;
    VendorRefNo?: string;
    CustomerVendorCode?: string;
    CustomerVendorName?: string;
    ItemNo?: string;
    ItemServiceDescription?: string;
    CATEGORY?: string;
    SUB_CATEGORY?: string;
    Name?: string;
    Price?: number;
    LineDiscountPercent?: number;
    PriceBeforeDiscount?: number;
    LineDiscountValue?: number;
    Quantity?: number;
    GSTPercent?: number;
    CGSTPercent?: number;
    CGST?: number;
    SGSTPercent?: number;
    SGST?: number;
    IGSTPercent?: number;
    IGST?: number;
    TaxAmount?: number;
    FreightName?: string;
    Total?: number;
    FrCGSTPercent?: number;
    FrCGST?: number;
    FrSGSTPercent?: number;
    FrSGST?: number;
    FrIGSTPercent?: number;
    FrIGST?: number;
    FrTaxAmount?: number;
    BasicValue?: number;
    DocDiscountPercent?: number;
    DocDiscountValue?: number;
    TotalValue?: number;
}

export const apInvoiceServiceConfig: ReportConfig<ApInvoiceServiceReport> = {
    key: 'apInvoiceService', // Unique key for Redux
    title: 'AP Invoice Service Report',

    // TODO: Update this API base URL to match your actual backend route
    apiBase: '/Service',

    // TODO: Update these endpoints to match your actual backend routes
    dateEndpoint: '/Service/date-dropdown',

    // Reusing the global dropdowns from Production Entry
    globalDropdownEndpoint: '/purchaseOrders/global-dropdowns',

    exportFilename: 'AP_Invoice_Service_Report',
    defaultPageSize: 30,

    filters: [
        { type: 'year', label: 'Fiscal Year', apiParam: 'fiscalYear' },
        { type: 'month', label: 'Fiscal Month', apiParam: 'fiscalMonth' },
        { type: 'day', label: 'Day', apiParam: 'day' },

        // Global Filters
        {
            type: 'vendor',
            label: 'Vendor Name',
            apiParam: 'CustomerVendorName',
            searchable: true,
            paginated: true
        },

    ],

    columns: [
        // --- Invoice Details ---
        { displayKey: "InternalNo", dataKey: "InternalNo", label: "Internal No" },
        { displayKey: "PostingDate", dataKey: "PostingDate", label: "Posting Date" },
        { displayKey: "InvoiceNo", dataKey: "InvoiceNo", label: "Invoice No" },
        { displayKey: "InvoiceDate", dataKey: "InvoiceDate", label: "Invoice Date" },
        { displayKey: "VendorRefNo", dataKey: "VendorRefNo", label: "Vendor Ref No" },

        // --- Vendor Details ---
        { displayKey: "CustomerVendorCode", dataKey: "CustomerVendorCode", label: "Vendor Code" },
        { displayKey: "CustomerVendorName", dataKey: "CustomerVendorName", label: "Vendor Name" },

        // --- Item Details ---
        { displayKey: "ItemNo", dataKey: "ItemNo", label: "Item No" },
        { displayKey: "ItemServiceDescription", dataKey: "ItemServiceDescription", label: "Description" },
        { displayKey: "CATEGORY", dataKey: "CATEGORY", label: "Category" },
        { displayKey: "SUB_CATEGORY", dataKey: "SUB_CATEGORY", label: "Sub Category" },
        { displayKey: "Name", dataKey: "Name", label: "Item Name" },

        // --- Quantity & Price ---
        { displayKey: "Quantity", dataKey: "Quantity", label: "Quantity", align: 'right' },
        { displayKey: "Price", dataKey: "Price", label: "Price", align: 'right' },
        { displayKey: "PriceBeforeDiscount", dataKey: "PriceBeforeDiscount", label: "Price Before Discount", align: 'right' },
        { displayKey: "LineDiscountPercent", dataKey: "LineDiscountPercent", label: "Discount %", align: 'right' },
        { displayKey: "LineDiscountValue", dataKey: "LineDiscountValue", label: "Discount Amount", align: 'right' },

        // --- GST ---
        { displayKey: "CGSTPercent", dataKey: "CGSTPercent", label: "CGST %", align: 'right' },
        { displayKey: "CGST", dataKey: "CGST", label: "CGST Amount", align: 'right' },
        { displayKey: "SGSTPercent", dataKey: "SGSTPercent", label: "SGST %", align: 'right' },
        { displayKey: "SGST", dataKey: "SGST", label: "SGST Amount", align: 'right' },
        { displayKey: "IGSTPercent", dataKey: "IGSTPercent", label: "IGST %", align: 'right' },
        { displayKey: "IGST", dataKey: "IGST", label: "IGST Amount", align: 'right' },
        { displayKey: "TaxAmount", dataKey: "TaxAmount", label: "Total Tax", align: 'right' },

        // --- Freight ---
        { displayKey: "FreightName", dataKey: "FreightName", label: "Freight Type" },
        { displayKey: "FrCGST", dataKey: "FrCGST", label: "Freight CGST", align: 'right' },
        { displayKey: "FrSGST", dataKey: "FrSGST", label: "Freight SGST", align: 'right' },
        { displayKey: "FrIGST", dataKey: "FrIGST", label: "Freight IGST", align: 'right' },
        { displayKey: "FrTaxAmount", dataKey: "FrTaxAmount", label: "Freight Tax", align: 'right' },

        // --- Totals ---
        { displayKey: "BasicValue", dataKey: "BasicValue", label: "Basic Value", align: 'right' },
        { displayKey: "DocDiscountPercent", dataKey: "DocDiscountPercent", label: "Doc Discount %", align: 'right' },
        { displayKey: "DocDiscountValue", dataKey: "DocDiscountValue", label: "Doc Discount Amount", align: 'right' },
        { displayKey: "TotalValue", dataKey: "TotalValue", label: "Total Value", align: 'right' },
    ],
};