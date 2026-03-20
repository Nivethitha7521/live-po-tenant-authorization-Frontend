// ============================================================
// configs/itemDateWise.config.ts
// ITEM DATE WISE GRN report — Standardized Config
// ============================================================

import { ReportConfig } from '../engine/types';

export interface ItemDateWiseReport {
    internalNo?: string;
    grnRandomId?: string;
    vendorId?: number;
    randomId?: string;
    s_no?: number;
    createdDate?: string | null;
    invoiceDate?: string | null;
    invoiceNo?: string;
    grnDate?: string | null;
    grnId?: string;
    poRandomID?: string;
    vendorName?: string;
    itemCode?: string;
    itemName?: string;
    purchasecategoryName?: string;
    purchasesubcategoryName?: string;
    uom?: string;
    hsnCode?: string;
    quantity?: number;
    unitPrice?: number | null;
    taxType?: "cgst_sgst" | "igst" | null;
    befTaxDiscountAmount?: number;
    sgst?: number;
    cgst?: number;
    igst?: number;
    taxAmount?: number;
    totalPrice?: number;
    finalPrice?: number;
    gstNumber?: string;
    PO_No?: string;
    purchasetaxName?: number;
    taxDisplay?: string;
    sapVendorCode?: number;
    priceInclGST?: number;
}

export const itemDateWiseConfig: ReportConfig<ItemDateWiseReport> = {
    key: 'itemDateWise', // Unique key for Redux
    title: 'Item Date Wise GRN Report',

    // TODO: Update this API base URL to match your actual backend route
    apiBase: 'https://yenerp.com/reportsapi/itemwisedate',

    // TODO: Update these endpoints to match your actual backend routes
    dateEndpoint: 'https://yenerp.com/reportsapi/itemwisedate/date-dropdown',

    // Reusing the global dropdowns from Production Entry
    globalDropdownEndpoint: 'https://yenerp.com/reportsapi/purchaseOrders/global-dropdowns',

    exportFilename: 'Item_Date_Wise_Report',
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
        { displayKey: "grnId", dataKey: "grnId", label: "Internal No" },
        { displayKey: "createdDate", dataKey: "createdDate", label: "Posting Date" },
        { displayKey: "randomId", dataKey: "randomId", label: "GRN No" },
        { displayKey: "grnDate", dataKey: "grnDate", label: "GRN Date" },
        { displayKey: "PO_No", dataKey: "PO_No", label: "PO No" },
        { displayKey: "invoiceNo", dataKey: "invoiceNo", label: "Invoice No" },
        { displayKey: "invoiceDate", dataKey: "invoiceDate", label: "Invoice Date" },
        { displayKey: "sapVendorCode", dataKey: "sapVendorCode", label: "Vendor Code" },
        { displayKey: "vendorName", dataKey: "vendorName", label: "Vendor Name" },
        { displayKey: "itemCode", dataKey: "itemCode", label: "Item Code" },
        { displayKey: "itemName", dataKey: "itemName", label: "Item Name" },
        { displayKey: "purchasecategoryName", dataKey: "purchasecategoryName", label: "Category" },
        { displayKey: "purchasesubcategoryName", dataKey: "purchasesubcategoryName", label: "Sub Category" },
        { displayKey: "uom", dataKey: "uom", label: "UOM" },
        { displayKey: "hsnCode", dataKey: "hsnCode", label: "HSN" },
        { displayKey: "quantity", dataKey: "quantity", label: "Quantity", align: 'right' },
        { displayKey: "priceInclGST", dataKey: "priceInclGST", label: "Price Incl GST", align: 'right' },
        { displayKey: "unitPrice", dataKey: "unitPrice", label: "Base Price", align: 'right' },
        { displayKey: "totalPrice", dataKey: "totalPrice", label: "Total", align: 'right' },
        { displayKey: "taxDisplay", dataKey: "taxDisplay", label: "Tax Code" },
        { displayKey: "purchasetaxName", dataKey: "purchasetaxName", label: "Tax Rate" },
        { displayKey: "cgst", dataKey: "cgst", label: "CGST", align: 'right' },
        { displayKey: "sgst", dataKey: "sgst", label: "SGST", align: 'right' },
        { displayKey: "igst", dataKey: "igst", label: "IGST", align: 'right' },
        { displayKey: "taxAmount", dataKey: "taxAmount", label: "Tax Amount", align: 'right' },
        // Note: 'totalPrice' used again for 'Total Amount' as per ALL_COLUMNS mapping
        { displayKey: "totalPrice", dataKey: "totalPrice", label: "Total Amount", align: 'right' },
        { displayKey: "finalPrice", dataKey: "finalPrice", label: "Document Total", align: 'right' },
    ],
};