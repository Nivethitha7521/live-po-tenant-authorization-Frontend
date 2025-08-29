// Interface for Personal item
export interface Personal {
    personalId: string;
    personName: string;
    phoneNo: string;
    email: string;
    createdDate: Date | null;
    lastupdatedDate: Date | null;
    status: string;
    randomId: string;
  }
  
  // Interface for Personal slice state
 export interface PersonalState {
    personalitems: Personal[];
    loading: boolean;
    snackbarOpen: boolean;
    snackbarMessage: string;
    searchQuery: string;
    editIndex: number | null;
    dialogOpen: 'none' | 'edit';
    personalData: Personal;
  }
  
  // Initial state for Personal slice
  export const initialState: PersonalState = {
    personalitems: [],
    loading: false,
    snackbarOpen: false,
    snackbarMessage: '',
    searchQuery: '',
    editIndex: null,
    dialogOpen: 'none',
    personalData: {
      personalId: '',
      personName: '',
      phoneNo: '',
      email: '',
      createdDate: null,
      lastupdatedDate: null,
      status: 'active',
      randomId: '',
    },
  };
  
  