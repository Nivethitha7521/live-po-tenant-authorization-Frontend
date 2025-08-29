import { ImportResult } from "./importResult";

// Interface for Purchase Group item
export interface PurchaseItemType {
  itemtypeId: string;
  randomId: string;
  itemtypeName: string;
  status: string; // Ensure type safety for status
}
// Interface for Purchase Group slice state
export interface PurchaseItemTypeState {
  items: PurchaseItemType[];
  deactivatedItems: PurchaseItemType[];
  loading: boolean;
  snackbarOpen: boolean;
  snackbarMessage: string;
  searchQuery: string;
  editIndex: string | null;
  dialogOpen: 'none' | 'edit' | 'deactivated';
  showDeactivated: boolean;
  purchaseItemTypeData: PurchaseItemType;
  importStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  exportStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  importError: string | null;
  exportError: string | null;
  importResult: ImportResult | null;
  showImportResultDialog: boolean;
}

// Initial state for Purchase Group slice
export const initialState: PurchaseItemTypeState = {
  items: [],
  deactivatedItems: [],
  loading: false,
  snackbarOpen: false,
  snackbarMessage: '',
  searchQuery: '', // Initial search query is empty
  editIndex: null,
  dialogOpen: 'none',
  showDeactivated: false,
  purchaseItemTypeData: {
    itemtypeId: '',
    itemtypeName: '',
    status: 'active', // Default status to 'active'
    randomId: '',
  },
  importStatus: 'idle',
  exportStatus: 'idle',
  importError: null,
  exportError: null,
  importResult: null,
  showImportResultDialog: false,

};
