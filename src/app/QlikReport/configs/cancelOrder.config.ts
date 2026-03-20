// ============================================================
// configs/cancelOrder.config.ts
// CANCEL ORDER report — Standardized Config
// ============================================================

import { ReportConfig } from '../engine/types';

export interface CancelOrderReport {
  OrderStatus?: string;
  BranchID?: string;
  LocationName?: string;
  OrderNo?: string;
  OrderDate?: string;
  CustomerNo?: string | number;
  DeliveryDate?: string | null;
  OccCode?: string;
  OccName?: string;
  OccDate?: string;
  Message?: string;
  ShapeCode?: string;
  ShapeName?: string;
  CustCharge?: number;
  AdvanceAmount?: number;
  DelCharge?: number;
  TotQty?: number;
  TotAmount?: number;
  TaxAmount?: number;
  ReqDiscount?: number;
  BalanceDue?: number;
  OverallAmount?: number;
  ScreenName?: string;
  CreatedBy?: string;
  CreatedDate?: string;
  ShaCode?: string;
  ShaName?: string;
  BlanceAmt?: number;
  DeliveryTime?: string;
  SONo?: string;
}

export const cancelOrderConfig: ReportConfig<CancelOrderReport> = {
  key: 'cancelOrder', // Unique key for Redux
  title: 'Cancel Order Report',
  
  // TODO: Update this API base URL to match your actual backend route
  apiBase: 'https://yenerp.com/reportsapi/CancelOrder',

  // TODO: Update these endpoints to match your actual backend routes
  dateEndpoint: 'https://yenerp.com/reportsapi/CancelOrder/date-dropdown',
  
  // Reusing the global dropdowns from Production Entry (or change if Cancel Order has its own)
  globalDropdownEndpoint: 'https://yenerp.com/reportsapi/productionEntry/global-dropdowns',

  exportFilename: 'Cancel_Order_Report',
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
    { displayKey: "OrderStatus", dataKey: "OrderStatus", label: "Order Status" },
    { displayKey: "BranchID", dataKey: "BranchID", label: "Branch ID" },
    { displayKey: "LocationName", dataKey: "LocationName", label: "Location Name" },
    { displayKey: "OrderNo", dataKey: "OrderNo", label: "Order Number" },
    { displayKey: "OrderDate", dataKey: "OrderDate", label: "Order Date" },
    { displayKey: "CustomerNo", dataKey: "CustomerNo", label: "Customer Number" },
    { displayKey: "DeliveryDate", dataKey: "DeliveryDate", label: "Delivery Date" },
    { displayKey: "OccCode", dataKey: "OccCode", label: "Occasion Code" },
    { displayKey: "OccName", dataKey: "OccName", label: "Occasion Name" },
    { displayKey: "OccDate", dataKey: "OccDate", label: "Occasion Date" },
    { displayKey: "Message", dataKey: "Message", label: "Message" },
    { displayKey: "ShapeCode", dataKey: "ShapeCode", label: "Shape Code" },
    { displayKey: "ShapeName", dataKey: "ShapeName", label: "Shape Name" },
    { displayKey: "CustCharge", dataKey: "CustCharge", label: "Customer Charge", align: 'right' },
    { displayKey: "AdvanceAmount", dataKey: "AdvanceAmount", label: "Advance Amount", align: 'right' },
    { displayKey: "DelCharge", dataKey: "DelCharge", label: "Delivery Charge", align: 'right' },
    { displayKey: "TotQty", dataKey: "TotQty", label: "Total Quantity", align: 'right' },
    { displayKey: "TotAmount", dataKey: "TotAmount", label: "Total Amount", align: 'right' },
    { displayKey: "TaxAmount", dataKey: "TaxAmount", label: "Tax Amount", align: 'right' },
    { displayKey: "ReqDiscount", dataKey: "ReqDiscount", label: "Requested Discount", align: 'right' },
    { displayKey: "BalanceDue", dataKey: "BalanceDue", label: "Balance Due", align: 'right' },
    { displayKey: "OverallAmount", dataKey: "OverallAmount", label: "Overall Amount", align: 'right' },
    { displayKey: "ScreenName", dataKey: "ScreenName", label: "Screen Name" },
    { displayKey: "CreatedBy", dataKey: "CreatedBy", label: "Created By" },
    { displayKey: "CreatedDate", dataKey: "CreatedDate", label: "Created Date" },
    { displayKey: "ShaCode", dataKey: "ShaCode", label: "SHA Code" },
    { displayKey: "ShaName", dataKey: "ShaName", label: "SHA Name" },
    { displayKey: "BlanceAmt", dataKey: "BlanceAmt", label: "Balance Amount", align: 'right' },
    { displayKey: "DeliveryTime", dataKey: "DeliveryTime", label: "Delivery Time" },
    { displayKey: "SONo", dataKey: "SONo", label: "SO Number" },
  ],
};