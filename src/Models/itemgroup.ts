// @Models/itemgroup.ts
export interface PurchaseGroupItem {
  itemgroupId: string;
  randomId: string;
  itemgroupName: string;
  status: string;
}

export interface ImportResult {
  message?: string;
  inserted_count?: number;
  updated_count?: number;
  inserted_itemgroup_count?: number;
  updated_itemgroup_count?: number;
  successful?: Array<{ row: number; data: Record<string, string> }>;
  updated?: Array<{ row: number; data: Record<string, string>; error?: string }>;
  successful_itemgroups?: Array<{ row: string; data: Record<string, string> }>;
  updated_itemgroups?: Array<{ row: string; data: Record<string, string> }>;
  failed?: Array<{ row: number | string; data: Record<string, string>; error: string; missingFields?: string[] }>;
  errorCount?: number;
  detail?: { message: string; missing?: string[]; required?: string[] };
}

export interface PurchaseGroupItemState {
  items: PurchaseGroupItem[];
  deactivatedItems: PurchaseGroupItem[];
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
  purchaseGroupItemData: PurchaseGroupItem;
}

export const initialState: PurchaseGroupItemState = {
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
  purchaseGroupItemData: {
    itemgroupId: '',
    itemgroupName: '',
    status: 'active',
    randomId: '',
  },
};