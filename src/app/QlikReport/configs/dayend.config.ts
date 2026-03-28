// ============================================================
// configs/dayend.config.ts
// DAYEND report — Standardized Config
// ============================================================

import { ReportConfig } from '../engine/types';

export interface DayendReport {
  date?: string;
  time?: string;
  branch?: string;
  type?: "Take Away" | "Dine In" | "Sale Order" | "BD Cake" | string;
  cash?: number;
  card?: number;
  upi?: number;
  others?: number;
  total?: number;
}

export const dayendConfig: ReportConfig<DayendReport> = {
  key: 'dayend', // Unique key for Redux
  title: 'Dayend Report',

  // TODO: Update this API base URL to match your actual backend route
  apiBase: 'https://yenerp.com/reportsapi/dayend',

  // TODO: Update these endpoints to match your actual backend routes
  dateEndpoint: 'https://yenerp.com/reportsapi/dayend/date-dropdown',

  // Reusing the global dropdowns from Production Entry
  globalDropdownEndpoint: 'https://yenerp.com/reportsapi/productionEntry/global-dropdowns',

  exportFilename: 'Dayend_Report',
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
    { displayKey: "date", dataKey: "date", label: "Date" },
    { displayKey: "time", dataKey: "time", label: "Time" },
    { displayKey: "branch", dataKey: "branch", label: "Branch" },
    { displayKey: "type", dataKey: "type", label: "Type" },
    { displayKey: "cash", dataKey: "cash", label: "Cash", align: 'right' },
    { displayKey: "card", dataKey: "card", label: "Card", align: 'right' },
    { displayKey: "upi", dataKey: "upi", label: "UPI", align: 'right' },
    { displayKey: "others", dataKey: "others", label: "Others / Online", align: 'right' },
    { displayKey: "total", dataKey: "total", label: "Total Amount", align: 'right' },
  ],
};