
export interface VendorTypeItem {
  vendortypeId: string;
  vendorType: string;
  status: string; // Ensure type safety for status
  randomId: string;
}
export interface VendorTypeItemState {
  vendoritems: VendorTypeItem[];
  deactivatedItems: VendorTypeItem[];
  loading: boolean;
  successMessage: string | null;
  error: string | null;
  searchQuery: string;
  snackbarOpen: boolean;
  snackbarMessage: string;
  vendorTypeData: VendorTypeItem;
  editVendorTypeId: null, // Storing the vendorTypeId for edit
  editIndex: number | null;
  dialogOpen: 'none' | 'edit' | 'deactivated' |'add';
  showDeactivated: boolean;
}

export const initialVendorTypeState: VendorTypeItem = {
  vendortypeId: '',
  vendorType: '',
  status: 'active', // Default status to 'active'
  randomId: '',
};

export const initialState: VendorTypeItemState = {
  vendoritems: [],
  deactivatedItems: [],
  loading: false,
  successMessage: null,
  error: null,
  searchQuery: '',
  vendorTypeData: initialVendorTypeState,
  editIndex: null,
  dialogOpen: 'none',
  editVendorTypeId:null,
  snackbarOpen: false,
  snackbarMessage: '',
  showDeactivated: false,
};
