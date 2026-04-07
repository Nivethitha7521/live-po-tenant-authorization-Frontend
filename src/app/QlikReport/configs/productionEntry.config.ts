// ============================================================
// configs/productionEntry.config.ts
// PRODUCTION ENTRY report config.
// ============================================================

import { ReportConfig } from '../engine/types';

// ---- Data model (only used for TypeScript safety) ----
export interface ProductionEntryRow {
  productionEntryNumber?: string;
  lineId?: number;
  itemCode?: string;
  category?: string;
  varianceName?: string;
  subcategory?: string;
  qty?: number;
  uom?: string;
  createdBy?: string;
  date?: string;
  productionTime?: string;
  hsnCode?: number;
  LeadTime?: number;
  firstName?: string;
  lastName?: string;
  ExpDate?: string;
}

export const productionEntryConfig: ReportConfig<ProductionEntryRow> = {
  key: 'productionEntry',
  title: 'Production Entry Report',
  apiBase: 'https://yenerp.com/reportsapi/productionEntry',
  
  // NEW: Specific endpoint for Production Entry Date Filters
  dateEndpoint: 'https://yenerp.com/reportsapi/productionEntry/date-dropdown',

  exportFilename: 'ProductionEntry',
  defaultPageSize: 30,

  // ---- Filters: declare which dropdowns to show ----
  filters: [
    { type: 'year', label: 'Fiscal Year', apiParam: 'fiscalYear' },
    { type: 'month', label: 'Fiscal Month', apiParam: 'fiscalMonth' },
    { type: 'day', label: 'Fiscal Day', apiParam: 'day' },
    { type: 'variance', label: 'Variance Name', apiParam: 'varianceName', searchable: true, paginated: true },
  ],

  // ---- Columns: every column shown in the table ----
  columns: [
    { displayKey: 'productionEntryNumber', dataKey: 'productionEntryNumber', label: 'Production Entry No' },
    { displayKey: 'date', dataKey: 'date', label: 'Production Date' },
    { displayKey: 'productionTime', dataKey: 'productionTime', label: 'Production Time' },
    { displayKey: 'lineId', dataKey: 'lineId', label: 'Line ID', align: 'center' },
    { displayKey: 'itemCode', dataKey: 'itemCode', label: 'Item Code' },
    { displayKey: 'varianceName', dataKey: 'varianceName', label: 'Variance Name' },
    { displayKey: 'category', dataKey: 'category', label: 'Category' },
    { displayKey: 'subcategory', dataKey: 'subcategory', label: 'Sub Category' },
    { displayKey: 'hsnCode', dataKey: 'hsnCode', label: 'HSN Code', align: 'center' },
    { displayKey: 'uom', dataKey: 'uom', label: 'Unit of Measure' },
    { displayKey: 'qty', dataKey: 'qty', label: 'Quantity', align: 'right' },
    { displayKey: 'createdBy', dataKey: 'createdBy', label: 'Created By' },
    { displayKey: 'firstName', dataKey: 'firstName', label: 'First Name' },
    { displayKey: 'lastName', dataKey: 'lastName', label: 'Last Name' },
    { displayKey: 'LeadTime', dataKey: 'LeadTime', label: 'Lead Time', align: 'right' },
    { displayKey: 'ExpDate', dataKey: 'ExpDate', label: 'Expiry Date' },
  ],
};