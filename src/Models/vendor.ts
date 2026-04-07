import { list } from "postcss";

export interface VendorSummary {
  vendorId: string;
  vendorName?: string;
  contactpersonPhone?: string;
  contactpersonEmail?: string;
  creditLimit?: number;
  address?: string;
  country?: string;
  paymentTerms?: string;
  state?: string;
  city?: string;
  postalCode?: number;
  gstNumber?: string;
}
export interface VendorSearch {
  vendorId: string;
  vendorName: string;
}

// Updated interfaces for CSV import
export interface CsvImportError {
  row: number;
  error: string;
  vendorName?: string;
  randomId?: string;
}
export interface CsvImportDuplicate {
  row: number;
  vendorName: string;
  contactpersonPhone: string;
  existingId: string;
  error: string;
}

export interface CsvImportResponse {
  message: string;
  inserted_count: number;
  updated_count: number;
  successful: Array<{ row: number; data: Record<string, any> }>;
  updated: Array<{ row: number; vendorName: string; contactpersonPhone: string; existingId: string; error: string }>;
  failed: Array<{ row: number; vendorName: string; randomId: string; error: string; missingFields: string[] }>;
  errorCount: number;
  total_processed: number;
}

export interface CsvExportResponse {
  data: string;
}
export interface VendorNameGet {
  vendorId: string;
  vendorName: string;
}

// Define Vendor interface
export interface Vendor {
  vendorId: string;
  vendorName: string;
  randomId: string;
  contactpersonName: string;
  contactpersonPhone: string;
  contactpersonEmail: string;
  address: string;
  country: string;
  state: string;
  city: string;
  postalCode: number;
  website: string;
  vendorType: string;
  gstNumber: string;
  paymentTerms: string;
  creditLimit: number;
  preferredpaymentMethod: string;
  status: string;
  notes: string;
  bankName: string;
  accountNumber: number;
  ifscCode: string;
  createdDate: Date | null;
  updatedDate: Date | null;
}

export interface VendorTypeItem {
  vendortypeId: string;
  vendorType: string;
}

// Define initial state for Vendors
export interface VendorState {
  items: Vendor[];
  deactivatedItems: Vendor[];
  vendorName: VendorNameGet[];
  loading: boolean;
  successMessage: string | null;
  status:string | null;
  error: string | null;
  searchQuery: string;
  vendorTypeItems: VendorTypeItem[];
  snackbarOpen: boolean;
  snackbarMessage: string;
  editIndex: number | null;
  dialogOpen: 'none' | 'edit' | 'deactivated'|'add';
  showDeactivated: boolean;
  vendorData: Vendor;
  itemToActivate: Vendor | null;
  deactivateDialogOpen: boolean;
  activateDialogOpen: boolean;
  itemToDeactivate: Vendor | null;
  currentPage: number; // New
  pageSize: number; // New
  totalVendors: number; // New
  insertedCount: number; // Added for import counts
  updatedCount: number;  // Added for import counts
  selectedHeaders: string[];
  exportStatus: 'idle' | 'loading' | 'succeeded' | 'failed'; // Added
  importErrors: CsvImportError[];
  importDuplicates: CsvImportDuplicate[];

  
}

// Initial state values
export const initialState: VendorState = {
  items: [],
  deactivatedItems: [],
  vendorName: [],
  loading: false,
  successMessage: null,
  vendorTypeItems: [],
  error: null,
  searchQuery: '',
  snackbarOpen: false,
  snackbarMessage: '',
  editIndex: null,
  dialogOpen: 'none',
  showDeactivated: false,
  itemToActivate: null,
  deactivateDialogOpen: false,
  activateDialogOpen: false,
  itemToDeactivate: null,
  vendorData: {
    vendorId: '',
    vendorName: '',
    randomId: '',
    contactpersonName: '',
    contactpersonPhone: '',
    contactpersonEmail: '',
    address: '',
    country: '',
    state: '',
    city: '',
    postalCode: 0,
    website: '',
    vendorType: '',
    gstNumber: '',
    paymentTerms: '',
    creditLimit: 0,
    preferredpaymentMethod: '',
    status: 'active', // Ensure this is defined
    notes: '',
    bankName: '',
    accountNumber: 0,
    ifscCode: '',
    createdDate: null,
    updatedDate: null,
  },
  currentPage: 1,
  pageSize: 50,
  totalVendors: 0,
  insertedCount: 0, // Added for import counts
  updatedCount: 0, // Added for import counts
  selectedHeaders: [
    'vendorId',
    'randomId',
    'vendorName',
    'contactpersonName',
    'contactpersonPhone',
    'city',
    'createdDate',
  ],
  exportStatus: 'idle', // Added
  importErrors: [],
  importDuplicates: [],
  status: null
};
