import { RootState } from '@/redux/store';
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';

interface ExpenseSubcategory {
  expenseSubcategoryId: string;
  subcategory: string;
  status: string; // Ensure type safety for status

}

interface ExpenseSubcategoryState {
  items: ExpenseSubcategory[];
  deactivatedSubcategories: ExpenseSubcategory[];
  loading: boolean;
  successMessage: string | null;
  error: string | null;
  searchQuery: string;
  snackbarOpen: boolean;
  snackbarMessage: string;
  expenseSubcategoryData: ExpenseSubcategory;
  editIndex: number | null;
  dialogOpen: 'none' | 'edit' | 'deactivated';
  showDeactivated: boolean;
}

const initialExpenseSubcategoryState: ExpenseSubcategory = {
  expenseSubcategoryId: '',
  subcategory: '',
  status: 'active', // Default status to 'active'
 
};

const initialState: ExpenseSubcategoryState = {
  items: [],
  deactivatedSubcategories: [],
  loading: false,
  successMessage: null,
  error: null,
  searchQuery: '',
  expenseSubcategoryData: initialExpenseSubcategoryState,
  editIndex: null,
  dialogOpen: 'none',
  snackbarOpen: false,
  snackbarMessage: '',
  showDeactivated: false,
};

// Update fetchPurchaseSubcategories thunk
export const fetchExpenseSubcategories = createAsyncThunk<ExpenseSubcategory[]>(
  'expenseSubcategory/fetch',
  async () => {
    try {
      const response = await axios.get('https://www.yenerp.com/yenerpliveapi/expensesubcategorys/');
      return response.data;
    } catch (error: any) {
      throw Error(`Failed to fetch purchase subcategories: ${error.message}`);
    }
  }
);

// Update addPurchaseSubcategory thunk
export const addExpenseSubcategory = createAsyncThunk<ExpenseSubcategory, ExpenseSubcategory>(
  'expenseSubcategory/add',
  async (expenseSubcategory) => {
    try {
      const response = await axios.post('https://www.yenerp.com/yenerpliveapi/expensesubcategorys/', expenseSubcategory);
      return response.data;
    } catch (error: any) {
      throw Error(`Failed to add Expense subcategory: ${error.message}`);
    }
  }
);

// Update updatePurchaseSubcategory thunk
export const updateExpenseSubcategory = createAsyncThunk<ExpenseSubcategory, { expenseSubcategoryId: string;expensesubcategory: ExpenseSubcategory }>(
  'expenseSubcategory/update',
  async ({ expenseSubcategoryId, expensesubcategory }) => {
    try {
      const response = await axios.patch(`https://www.yenerp.com/yenerpliveapi/expensesubcategorys/${expenseSubcategoryId}`, expensesubcategory);
      return response.data;
    } catch (error: any) {
      throw Error(`Failed to update expense subcategory: ${error.message}`);
    }
  }
);

// Update deactivatePurchaseSubcategory thunk
export const deactivateExpenseSubcategory = createAsyncThunk<ExpenseSubcategory, string>(
  'expenseSubcategory/deactivate',
  async (expenseSubcategoryId) => {
    try {
      const response = await axios.patch(`https://www.yenerp.com/yenerpliveapi/expensesubcategorys/${expenseSubcategoryId}`, { status: 'deactivated' });
      return response.data;
    } catch (error: any) {
      throw Error(`Failed to deactivate expense subcategory: ${error.message}`);
    }
  }
);

// Update activatePurchaseSubcategory thunk
export const activateExpenseSubcategory = createAsyncThunk<ExpenseSubcategory, string>(
  'expenseSubcategory/activate',
  async (expenseSubcategoryId) => {
    try {
      const response = await axios.patch(`https://www.yenerp.com/yenerpliveapi/expensesubcategorys/${expenseSubcategoryId}`, { status: 'active' });
      return response.data;
    } catch (error: any) {
      throw Error(`Failed to activate expense subcategory: ${error.message}`);
    }
  }
);

const expenseSubcategorySlice = createSlice({
  name: 'expenseSubcategory',
  initialState,
  reducers: {
    setExpenseSubcategoryData: (state, action: PayloadAction<ExpenseSubcategory>) => {
      state.expenseSubcategoryData = action.payload;
    },
    setEditIndex: (state, action: PayloadAction<number | null>) => {
      state.editIndex = action.payload;
    },
    setDialogOpen: (state, action: PayloadAction<'none' | 'edit' | 'deactivated'>) => {
      state.dialogOpen = action.payload;
    },
    setSnackbarOpen: (state, action: PayloadAction<boolean>) => {
      state.snackbarOpen = action.payload;
    },
    setSnackbarMessage: (state, action: PayloadAction<string>) => {
      state.snackbarMessage = action.payload;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setShowDeactivated: (state, action: PayloadAction<boolean>) => {
      state.showDeactivated = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchExpenseSubcategories.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchExpenseSubcategories.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.filter((expenseSubcategory) => expenseSubcategory.status === 'active');
        state.deactivatedSubcategories = action.payload.filter((expenseSubcategory) => expenseSubcategory.status === 'deactivated');
      })
      .addCase(fetchExpenseSubcategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to fetch expense subcategories';
      })
      .addCase(addExpenseSubcategory.fulfilled, (state, action) => {
        if (action.payload.status === 'active') {
          state.items.push(action.payload);
        } else {
          state.deactivatedSubcategories.push(action.payload);
        }
      })
      .addCase(updateExpenseSubcategory.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item.expenseSubcategoryId === action.payload.expenseSubcategoryId);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(deactivateExpenseSubcategory.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item.expenseSubcategoryId === action.payload.expenseSubcategoryId);
        if (index !== -1) {
          const [deactivatedItem] = state.items.splice(index, 1);
          state.deactivatedSubcategories.push(deactivatedItem);
        }
      })
      .addCase(activateExpenseSubcategory.fulfilled, (state, action) => {
        const index = state.deactivatedSubcategories.findIndex((item) => item.expenseSubcategoryId === action.payload.expenseSubcategoryId);
        if (index !== -1) {
          const [activatedItem] = state.deactivatedSubcategories.splice(index, 1);
          state.items.push(activatedItem);
        }
      });
  },
});

export const {
  setExpenseSubcategoryData,
  setEditIndex,
  setDialogOpen,
  setSnackbarOpen,
  setSnackbarMessage,
  setSearchQuery,
  setShowDeactivated,
} = expenseSubcategorySlice.actions;

export const selectExpenseSubcategoryItems = (state: RootState) => state.expenseSubcategory;

export default expenseSubcategorySlice.reducer;
