export interface PurchaseSubcategory {
  purchasesubcategoryId: string;
  purchasesubcategoryName: string;
  status: string; // Ensure type safety for status
  randomId: string;
}

export interface ImportResult {
  inserted_count: number;
  updated_count: number;
  successful: Array<{ row: number; data: Record<string, string> }>;
  updated: Array<{ row: number; data: Record<string, string>; error?: string }>;
  failed: Array<{ row: number; data: Record<string, string>; error: string; missingFields?: string[] }>;
  errorCount: number;
  message?: string; // Keep optional, as it may not always be present
  error?: boolean; // Keep optional
  detail?: any; // Keep optional for error cases
}

export interface PurchaseSubcategoryState {
  items: PurchaseSubcategory[];
  deactivatedSubcategories: PurchaseSubcategory[];
  loading: boolean;
  successMessage: string | null;
  error: string | null;
  searchQuery: string;
  snackbarOpen: boolean;
  snackbarMessage: string;
  purchaseSubcategoryData: PurchaseSubcategory;
  editIndex: number | null;
  dialogOpen: 'none' | 'edit' | 'deactivated';
  showDeactivated: boolean;
  importStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  exportStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  importError: string | null;
  exportError: string | null;
  importDialogOpen: boolean;
  importResult: ImportResult | null;
  showImportResultDialog: boolean;
}

export const initialPurchaseSubcategoryState: PurchaseSubcategory = {
  purchasesubcategoryId: '',
  purchasesubcategoryName: '',
  status: 'active', // Default status to 'active'
  randomId: '',
};

export const initialState: PurchaseSubcategoryState = {
  items: [],
  deactivatedSubcategories: [],
  loading: false,
  successMessage: null,
  error: null,
  searchQuery: '',
  purchaseSubcategoryData: initialPurchaseSubcategoryState,
  editIndex: null,
  dialogOpen: 'none',
  snackbarOpen: false,
  snackbarMessage: '',
  showDeactivated: false,
  importStatus: 'idle',
  exportStatus: 'idle',
  importError: null,
  exportError: null,
  importDialogOpen: false,
  importResult: null,
  showImportResultDialog: false,
};