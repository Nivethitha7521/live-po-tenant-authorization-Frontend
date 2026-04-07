// ============================================================
// configs/overallSales.config.ts
// OVERALL SALES report — Standardized Config
// ============================================================

import { ReportConfig } from '../engine/types';

export interface OverallSalesReport {
  dayClosingDateTime?: string | null;
  randomId?: string;
  branchName?: string;
  systemCashSales?: number;
  systemCardSales?: number;
  systemUpiSales?: number;
  systemOtherSales?: number;
  totalSystemSales?: number;
  totalKotSales?: number;
  totalTakeAwaySales?: number;
  totalSaleOrderSales?: number;
}

export const overallSalesConfig: ReportConfig<OverallSalesReport> = {
  key: 'overallSales', // Unique key for Redux
  title: 'Overall Sales Report',
  
  // TODO: Update this API base URL to match your actual backend route
  apiBase: 'https://yenerp.com/reportsapi/dayend/overallsales',

  // TODO: Update these endpoints to match your actual backend routes
  dateEndpoint: 'https://yenerp.com/reportsapi/dayend/date-dropdown',
  
  // Reusing the global dropdowns from Production Entry (or change if Sales has its own)
  globalDropdownEndpoint: 'https://yenerp.com/reportsapi/productionEntry/global-dropdowns',

  exportFilename: 'Overall_Sales_Report',
  defaultPageSize: 30,

  filters: [
    { type: 'year', label: 'Fiscal Year', apiParam: 'fiscalYear' },
    { type: 'month', label: 'Fiscal Month', apiParam: 'fiscalMonth' },
    { type: 'day', label: 'Day', apiParam: 'day' },

    // Global Filters
    {
      type: 'locations',
      label: 'Branch',
      apiParam: 'branchName',
      searchable: true,
      paginated: true
    },
  ],

  columns: [
    { displayKey: "dayClosingDateTime", dataKey: "dayClosingDateTime", label: "Sales Date" },
    { displayKey: "randomId", dataKey: "randomId", label: "Code" },
    { displayKey: "branchName", dataKey: "branchName", label: "Location" },
    { displayKey: "systemCardSales", dataKey: "systemCardSales", label: "Card Sales", align: 'right' },
    { displayKey: "systemCashSales", dataKey: "systemCashSales", label: "Cash Sales", align: 'right' },
    { displayKey: "systemUpiSales", dataKey: "systemUpiSales", label: "UPI Sales", align: 'right' },
    { displayKey: "systemOtherSales", dataKey: "systemOtherSales", label: "Other Sales", align: 'right' },
    { displayKey: "totalSystemSales", dataKey: "totalSystemSales", label: "Total System Sales", align: 'right' },
    { displayKey: "totalKotSales", dataKey: "totalKotSales", label: "Total KOT Sales", align: 'right' },
    { displayKey: "totalTakeAwaySales", dataKey: "totalTakeAwaySales", label: "Total TakeAway Sales", align: 'right' },
    { displayKey: "totalSaleOrderSales", dataKey: "totalSaleOrderSales", label: "Total SaleOrder Sales", align: 'right' },
  ],
};