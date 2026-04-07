import { ImportResult } from "./importResult";

// Interface for Subcategory
export interface Subcategory {
  purchasesubcategoryName: string;
  purchasesubcategoryId: string;
}

// Interface for Category
export interface Category {
  purchasecategoryId: string;
  purchasecategoryName: string;
  status: string;
  randomId: string;
  subcategories: string[];
}
// Interface for Category slice state
export interface CategoryState {
  categories: Category[];
  deactivatedItems: Category[];
  subcategories: Subcategory[];
  loading: boolean;
  error: string | null;
  categoryData: Category;
  editIndex: string | null;
  importedData: Category[]; // <-- New state for holding parsed data
  dialogOpen: 'none' | 'edit' | 'deactivated' | 'add';
  snackbarOpen: boolean;
  snackbarMessage: string;
  searchQuery: string;
  showDeactivated: boolean;
  importStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  exportStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  importError: string | null;
  exportError: string | null;
  importDialogOpen: boolean;
  importResult: ImportResult | null;
  showImportResultDialog: boolean;
}

// Initial state for Category slice
export const initialCategoryState: Category = {
  purchasecategoryId: '',
  purchasecategoryName: '',
  status: 'active',
  randomId: '',
  subcategories: [],
};

export const initialState: CategoryState = {
  categories: [],
  subcategories: [],
  deactivatedItems: [],
  loading: false,
  error: null,
  categoryData: initialCategoryState,
  editIndex: null,
  importedData: [],
  dialogOpen: 'none',
  snackbarOpen: false,
  snackbarMessage: '',
  searchQuery: '',
  showDeactivated: false,
  importStatus: 'idle',
  exportStatus: 'idle',
  importError: null,
  exportError: null,
  importDialogOpen: false,
  importResult: null,
  showImportResultDialog: false,
};
