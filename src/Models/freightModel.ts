// @Models/freight.ts
export interface Freight {
  freightId: string;
  randomId: string;
  freightName: string;
  status: string;
}

export interface ImportResult {
  message?: string;
  inserted_count?: number;
  updated_count?: number;
  inserted_freight_count?: number;
  updated_freight_count?: number;
  successful?: Array<{ row: number; data: Record<string, string> }>;
  updated?: Array<{ row: number; data: Record<string, string>; error?: string }>;
  successful_freights?: Array<{ row: string; data: Record<string, string> }>;
  updated_freights?: Array<{ row: string; data: Record<string, string> }>;
  failed?: Array<{ row: number | string; data: Record<string, string>; error: string; missingFields?: string[] }>;
  errorCount?: number;
  detail?: { message: string; missing?: string[]; required?: string[] };
}

export interface FreightState {
  items: Freight[];
  deactivatedItems: Freight[];
  loading: boolean;
  importing: boolean;
  exporting: boolean;
  importSuccess: boolean;
  exportSuccess: boolean;
  importError: string | null;
  exportError: string | null;
  importResult: ImportResult | null;
  snackbarOpen: boolean;
  snackbarMessage: string;
  searchQuery: string;
  editIndex: number | null;
  dialogOpen: 'none' | 'edit' | 'deactivated';
  showDeactivated: boolean;
  showImportResultDialog: boolean;
  freightData: Freight;
}

export const initialState: FreightState = {
  items: [],
  deactivatedItems: [],
  loading: false,
  importing: false,
  exporting: false,
  importSuccess: false,
  exportSuccess: false,
  importError: null,
  exportError: null,
  importResult: null,
  snackbarOpen: false,
  snackbarMessage: '',
  searchQuery: '',
  editIndex: null,
  dialogOpen: 'none',
  showDeactivated: false,
  showImportResultDialog: false,
  freightData: {
    freightId: '',
    freightName: '',
    status: 'active',
    randomId: '',
  },
};