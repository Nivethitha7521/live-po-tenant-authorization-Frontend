// @/Models/storagelocation.ts
export interface StorageLocationItem {
  storageLocationId: string;
  locationName: string;
  status: string;
  randomId: string;
  createdDate: Date | null;
  lastUpdatedDate: Date | null;
}

export interface ImportResult {
  message?: string;
  inserted_count?: number;
  updated_count?: number;
  successful?: Array<{ row: number; data: Record<string, string>; assignedId?: string }>;
  updated?: Array<{ row: number; data: Record<string, string>; message?: string }>;
  failed?: Array<{ row: number; data: Record<string, string>; error: string; missingFields?: string[] }>;
  errorCount?: number;
  detail?: string | { message: string; missing?: string[]; required?: string[] };
}

export interface StorageLocationState {
  items: StorageLocationItem[];
  deactivatedItems: StorageLocationItem[];
  importing: boolean;
  exporting: boolean;
  loading: boolean;
  snackbarOpen: boolean;
  snackbarMessage: string;
  searchQuery: string;
  editIndex: string | null;
  dialogOpen: 'none' | 'edit' | 'deactivated';
  showDeactivated: boolean;
  storageLocationData: StorageLocationItem;
  locationNameTouched: boolean;
  importStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  exportStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  importError: string | null;
  exportError: string | null;
  importResult: ImportResult | null;
  showImportResultDialog: boolean;
}

export const initialState: StorageLocationState = {
  items: [],
  deactivatedItems: [],
  loading: false,
  snackbarOpen: false,
  snackbarMessage: '',
  searchQuery: '',
  editIndex: null,
  dialogOpen: 'none',
  showDeactivated: false,
  storageLocationData: {
    storageLocationId: '',
    locationName: '',
    status: 'active',
    randomId: '',
    createdDate: null,
    lastUpdatedDate: null,
  },
  locationNameTouched: false,
  importStatus: 'idle',
  exportStatus: 'idle',
  importError: null,
  exportError: null,
  importResult: null,
  showImportResultDialog: false,
  importing: false,
  exporting: false,
};