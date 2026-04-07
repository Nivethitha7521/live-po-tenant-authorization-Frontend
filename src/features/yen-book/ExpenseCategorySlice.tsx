import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';

// Interface for Subcategory
interface Subcategory {
  subcategory: string;
  expenseSubcategoryId: string;
}

// Interface for Category
interface Category {
  expenseCategoryId: string;
  category: string;
  status: string;

  subcategories: string[];
}

// Interface for Category slice state
interface CategoryState {
  categories: Category[];
  deactivatedItems: Category[];
  subcategories: Subcategory[];
  loading: boolean;
  error: string | null;
  categoryData: Category;
  editIndex: number | null;
  dialogOpen: 'none' | 'edit' | 'deactivated'| 'add';
  snackbarOpen: boolean;
  snackbarMessage: string;
  searchQuery: string;
  showDeactivated: boolean;
}

// Initial state for Category slice
const initialCategoryState: Category = {
  expenseCategoryId: '',
  category: '',
  status: 'active',

  subcategories: [],
};

const initialState: CategoryState = {
  categories: [],
  subcategories: [],
  deactivatedItems: [],
  loading: false,
  error: null,
  categoryData: initialCategoryState,
  editIndex: null,
  dialogOpen: 'none',
  snackbarOpen: false,
  snackbarMessage: '',
  searchQuery: '',  
  showDeactivated: false,
};

// Async thunk to fetch all categories
export const fetchCategories = createAsyncThunk<Category[]>('category/fetchCategories', async () => {
  const response = await axios.get('https://www.yenerp.com/yenerpliveapi/expensecategorys/');
  return response.data;
});

// Async thunk to add a new category
export const addCategory = createAsyncThunk<Category, Category>('category/addCategory', async (category) => {
  const response = await axios.post('https://www.yenerp.com/yenerpliveapi/expensecategorys/', category);
  return response.data;
});

// Async thunk to update an existing category
export const updateCategory = createAsyncThunk<Category, { expenseCategoryId: string, category: Category }>(
  'category/updateCategory',
  async ({ expenseCategoryId, category }) => {
    const response = await axios.patch(`https://www.yenerp.com/yenerpliveapi/expensecategorys/${expenseCategoryId}`, category);
    return response.data;
  }
);

// Async thunk to deactivate a category
export const deactivateCategory = createAsyncThunk<Category, string>('category/deactivateCategory', async (expenseCategoryId) => {
  const response = await axios.patch(`https://www.yenerp.com/yenerpliveapi/expensecategorys/${expenseCategoryId}`, { status: 'deactivated' });
  return response.data;
});

// Async thunk to activate a deactivated category
export const activateCategory = createAsyncThunk<Category, string>('category/activateCategory', async (expenseCategoryId) => {
  const response = await axios.patch(`https://www.yenerp.com/yenerpliveapi/expensecategorys/${expenseCategoryId}`, { status: 'active' });
  return response.data;
});

// Async thunk to fetch all subcategories
export const fetchSubcategories = createAsyncThunk<Subcategory[]>('subcategory/fetchSubcategories', async () => {
  const response = await axios.get('https://www.yenerp.com/yenerpliveapi/expensesubcategorys/');
  return response.data;
});

const ExpenseCategorySlice = createSlice({
  name: 'category',
  initialState,
  reducers: {
    setCategoryData(state, action: PayloadAction<Category>) {
      state.categoryData = action.payload;
    },
    setEditIndex(state, action: PayloadAction<number | null>) {
      state.editIndex = action.payload;
    },
    setDialogOpen(state, action: PayloadAction<'none' | 'edit' | 'deactivated'| 'add'>) {
      state.dialogOpen = action.payload;
    },
    setSnackbarOpen(state, action: PayloadAction<boolean>) {
      state.snackbarOpen = action.payload;
    },
    setSnackbarMessage(state, action: PayloadAction<string>) {
      state.snackbarMessage = action.payload;
    },
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    toggleShowDeactivated(state) {
      state.showDeactivated = !state.showDeactivated;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action: PayloadAction<Category[]>) => {
        state.loading = false;
        state.categories = action.payload.filter((category) => category.status === 'active');
        state.deactivatedItems = action.payload.filter((category) => category.status === 'deactivated');
      })
      .addCase(fetchCategories.rejected, (state, action) => {
  state.error = action.error.message || "Failed to fetch categories";
})
      .addCase(addCategory.fulfilled, (state, action: PayloadAction<Category>) => {
        state.categories.push(action.payload);
      })
      .addCase(updateCategory.fulfilled, (state, action: PayloadAction<Category>) => {
        const index = state.categories.findIndex((category) => category.expenseCategoryId === action.payload.expenseCategoryId);
        if (index !== -1) {
          state.categories[index] = action.payload;
        }
      })
      .addCase(deactivateCategory.fulfilled, (state, action: PayloadAction<Category>) => {
        const index = state.categories.findIndex((category) => category.expenseCategoryId === action.payload.expenseCategoryId);
        if (index !== -1) {
          state.categories[index].status = 'deactivated';
          state.deactivatedItems.push(state.categories[index]);
          state.categories.splice(index, 1);
        }
      })
      .addCase(activateCategory.fulfilled, (state, action: PayloadAction<Category>) => {
        const index = state.deactivatedItems.findIndex((category) => category.expenseCategoryId === action.payload.expenseCategoryId);
        if (index !== -1) {
          state.deactivatedItems[index].status = 'active';
          state.categories.push(state.deactivatedItems[index]);
          state.deactivatedItems.splice(index, 1);
        }
      })
      .addCase(fetchSubcategories.fulfilled, (state, action: PayloadAction<Subcategory[]>) => {
        state.subcategories = action.payload;
      });
  },
});

export const {
  setCategoryData,
  setEditIndex,
  setDialogOpen,
  setSnackbarOpen,
  setSnackbarMessage,
  setSearchQuery,
  toggleShowDeactivated,
} = ExpenseCategorySlice.actions;

export default ExpenseCategorySlice.reducer;
