export interface PurchaseTax {
  purchasetaxId: string;
  purchasetaxName: string;
  purchasetaxPercentage: number;
  status: string; // Ensure type safety for status
  randomId: string;
}

export interface PurchaseTaxState {
  items: PurchaseTax[];
  deactivatedItems: PurchaseTax[];
  loading: boolean;
  successMessage: string | null;
  error: string | null;
  searchQuery: string;
  snackbarOpen: boolean;
  snackbarMessage: string;
  taxData: PurchaseTax;
  editIndex: number | null;
  dialogOpen: 'none' | 'edit' | 'deactivated';
  showDeactivated: boolean;
  importStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  exportStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  importError: string | null;
  exportError: string | null;
  importResult: { new_count: number; updated_count: number; duplicate_in_csv_count: number } | null;
  showImportResultDialog: boolean;
}

export const initialPurchaseTaxState: PurchaseTax = {
  purchasetaxId: '',
  purchasetaxName: '',
  purchasetaxPercentage: 0,
  status: 'active', // Default status to 'active'
  randomId: '',
};

export const initialState: PurchaseTaxState = {
  items: [],
  deactivatedItems: [],
  loading: false,
  successMessage: null,
  error: null,
  searchQuery: '',
  taxData: initialPurchaseTaxState,
  editIndex: null,
  dialogOpen: 'none',
  snackbarOpen: false,
  snackbarMessage: '',
  showDeactivated: false,
  importStatus: 'idle',
  exportStatus: 'idle',
  importError: null,
  exportError: null,
  importResult: null,
  showImportResultDialog: false,

};

