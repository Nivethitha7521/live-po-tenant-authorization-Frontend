import { ImportResult } from "./importResult";

// Interface for Storage Location item
export interface StorageLocationItem {
  storageLocationId: string;
  locationName: string;  // This is the primary name
  branchId?: string;     // Optional
  branchName?: string;   // Optional alias for locationName
  status: string;
  randomId: string;
  createdDate: Date | null;
  lastUpdatedDate: Date | null;
}



export interface Location {
  storageLocationId: string;  // Changed from optional to required
  branchId: string;
  branchName: string;
  locationName?: string;  // Optional for backward compatibility
  status: string;
  randomId?: string;
  createdDate?: Date | null;
  lastUpdatedDate?: Date | null;
  [key: string]: any;  // Allow additional properties
}
// Interface for Storage Location slice state
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
  location:Location[];
  importSuccess: boolean; // Replaced importStatus
  exportSuccess: boolean; // Replaced exportStatus
  importError: string | null;
  exportError: string | null;
  importResult: ImportResult | null;
  showImportResultDialog: boolean;
}

// Initial state for Storage Location slice
export const initialState: StorageLocationState = {
  items: [],
  deactivatedItems: [],
  location:[],
  loading: false,
  importing: false,
  exporting: false,
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
  importSuccess: false, // Replaced importStatus: 'idle'
  exportSuccess: false, // Replaced exportStatus: 'idle'
  importError: null,
  exportError: null,
  importResult: null,
  showImportResultDialog: false,
};


export const convertToLocation = (item: StorageLocationItem): Location => {
  return {
    ...item,
    branchName: item.locationName,  // Map locationName to branchName
    branchId: item.branchId || item.storageLocationId, // Use branchId if exists, otherwise use storageLocationId
  };
};

// Helper function to convert array of StorageLocationItem to Location[]
export const convertToLocations = (items: StorageLocationItem[]): Location[] => {
  return items.map(convertToLocation);
};