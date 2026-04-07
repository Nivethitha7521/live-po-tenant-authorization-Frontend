
// Interface for UOM (Unit of Measure) item
export interface UOMItem {
  purchaseuomId: string;
  uom: string;
  precisionValue: string;
  status: string; // Ensure type safety for status
  randomId: string; // Consider removing if not used
}

// Interface for UOM slice state
export interface PurchaseUomState {
  items: UOMItem[];
  deactivatedItems: UOMItem[];
  loading: boolean;
  snackbarOpen: boolean;
  snackbarMessage: string;
  searchQuery: string;
  editIndex: string | null;
  dialogOpen: 'none' | 'edit' | 'deactivated';
  showDeactivated: boolean;
  uomData: UOMItem;
  importStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  exportStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  importError: string | null;
  exportError: string | null;
  importResult: { new_count: number; updated_count: number; duplicate_in_csv_count: number } | null;
  showImportResultDialog: boolean;
}

// Initial state for UOM slice
export const initialState: PurchaseUomState = {
  items: [],
  deactivatedItems: [],
  loading: false,
  snackbarOpen: false,
  snackbarMessage: '',
  searchQuery: '',
  editIndex: null,
  dialogOpen: 'none',
  showDeactivated: false,
  uomData: {
    purchaseuomId: '',
    uom: '',
    precisionValue: '',
    status: 'active', // Default status to 'active'
    randomId: '', // Consider removing if not used
  },
  importStatus: 'idle',
  exportStatus: 'idle',
  importError: null,
  exportError: null,
  importResult: null,
  showImportResultDialog: false,
};
