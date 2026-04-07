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
// In your storagelocation.ts models file
export interface Location {
  locationId: string;   // "LOC015"
  branchName: string;   // "ECR 2"
  status: string;       // "active"
  aliasName?: string;   // "ECR2" - Add this if you want to display it
  branchId?: string;    // "69b2baaa1775a4429f8cad7e"
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
// Then the conversion function becomes simpler:
export const convertToLocation = (item: StorageLocationItem): Location => {
  return {
    locationId: item.branchId || item.storageLocationId,
    branchName: item.branchName || item.locationName,
    status: item.status,
    branchId: item.branchId,
  };
};
// Helper function to convert array of StorageLocationItem to Location[]
export const convertToLocations = (items: StorageLocationItem[]): Location[] => {
  return items.map(convertToLocation);
};