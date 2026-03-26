import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";

// Interface for Subcategory
interface ExpenseName {
  expenseNameId: string;
  expenseName: string;
  
  categories: string;
  subcategories: string;
  status: string;
}

// Interface for Category
interface Category {
  expenseCategoryId: string;
  category: string;
  status: string;
  subcategories: string[];
}

// Interface for Category slice state
interface ExpenseNameState {
  names: ExpenseName[];
  deactivatedItems: ExpenseName[];
  categories: Category[];
  loading: boolean;
  error: string | null;
  categoryData: ExpenseName;
  editIndex: number | null;
  dialogOpen: "none" | "edit" | "deactivated" | "add";
  snackbarOpen: boolean;
  snackbarMessage: string;
  searchQuery: string;
  showDeactivated: boolean;
}

// Initial state for Category slice
const initialCategoryState: ExpenseName = {
  expenseNameId: "",
  expenseName: "",
  categories: "",
  subcategories: "",
  status: "active",
};

const initialState: ExpenseNameState = {
  names: [],
  categories: [],
  deactivatedItems: [],
  loading: false,
  error: null,
  categoryData: initialCategoryState,
  editIndex: null,
  dialogOpen: "none",
  snackbarOpen: false,
  snackbarMessage: "",
  searchQuery: "",
  showDeactivated: false,
};

// Async thunk to fetch all categories
export const fetchNames = createAsyncThunk<ExpenseName[]>(
  "expenseName/fetchNames",
  async () => {
    const response = await axios.get(
      "http://127.0.0.1:8000/masterapi/expensenames/"
    );

    // ✅ FIX HERE
    return response.data.data || response.data;
  }
);

// Async thunk to add a new category
export const addNames = createAsyncThunk<ExpenseName, ExpenseName>(
  "expenseName/addNames",
  async (category) => {
    const response = await axios.post(
      "http://127.0.0.1:8000/masterapi/expensenames/",
      category
    );
    return response.data;
  }
);

// Async thunk to update an existing category
export const updateNames = createAsyncThunk<
  ExpenseName,
  { expenseNameId: string; category: ExpenseName }
>("expenseName/updateNames", async ({ expenseNameId, category }) => {
  const response = await axios.patch(
    `http://127.0.0.1:8000/masterapi/expensenames/${expenseNameId}`,
    category
  );
  return response.data;
});

// Async thunk to deactivate a category
export const deactivateNames = createAsyncThunk<ExpenseName, string>(
  "expenseName/deactivateNames",
  async (expenseNameId) => {
    const response = await axios.patch(
      `http://127.0.0.1:8000/masterapi/expensenames/${expenseNameId}`,
      { status: "deactivated" }
    );
    return response.data;
  }
);

// Async thunk to activate a deactivated category
export const activateNames = createAsyncThunk<ExpenseName, string>(
  "expenseName/activateNames",
  async (expenseNameId) => {
    const response = await axios.patch(
      `http://127.0.0.1:8000/masterapi/expensenames/${expenseNameId}`,
      { status: "active" }
    );
    return response.data;
  }
);

// Async thunk to fetch all subcategories
export const fetchCategories = createAsyncThunk<Category[]>(
  "category/fetchCategories",
  async () => {
    const response = await axios.get(
      "http://127.0.0.1:8000/masterapi/expensecategorys/"
    );

    // ✅ FIX HERE
    return response.data.data || response.data;
  }
);

const ExpenseNameSlice = createSlice({
  name: "expenseName",
  initialState,
  reducers: {
    setCategoryData(state, action: PayloadAction<ExpenseName>) {
      state.categoryData = action.payload;
    },
    setEditIndex(state, action: PayloadAction<number | null>) {
      state.editIndex = action.payload;
    },
    setDialogOpen(
      state,
      action: PayloadAction<"none" | "edit" | "deactivated" | "add">
    ) {
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
      .addCase(fetchNames.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchNames.fulfilled,
        (state, action: PayloadAction<ExpenseName[]>) => {
          state.loading = false;
          state.names = action.payload.filter(
  (item) => item.status.toLowerCase() === "active"
);
          
state.deactivatedItems = action.payload.filter(
  (item) => item.status.toLowerCase() === "deactivated"
);
        }
      )
      .addCase(fetchNames.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch categories";
      })
      .addCase(
        addNames.fulfilled,
        (state, action: PayloadAction<ExpenseName>) => {
          state.names.push(action.payload);
        }
      )
      .addCase(
        updateNames.fulfilled,
        (state, action: PayloadAction<ExpenseName>) => {
          const index = state.names.findIndex(
            (category) =>
              category.expenseNameId === action.payload.expenseNameId
          );
          if (index !== -1) {
            state.names[index] = action.payload;
          }
        }
      )
      .addCase(
        deactivateNames.fulfilled,
        (state, action: PayloadAction<ExpenseName>) => {
          const index = state.names.findIndex(
            (category) =>
              category.expenseNameId === action.payload.expenseNameId
          );
          if (index !== -1) {
            state.names[index].status = "deactivated";
            state.deactivatedItems.push(state.names[index]);
            state.names.splice(index, 1);
          }
        }
      )
      .addCase(
        activateNames.fulfilled,
        (state, action: PayloadAction<ExpenseName>) => {
          const index = state.deactivatedItems.findIndex(
            (category) =>
              category.expenseNameId === action.payload.expenseNameId
          );
          if (index !== -1) {
            state.deactivatedItems[index].status = "active";
            state.names.push(state.deactivatedItems[index]);
            state.deactivatedItems.splice(index, 1);
          }
        }
      )
      .addCase(
        fetchCategories.fulfilled,
        (state, action: PayloadAction<Category[]>) => {
          state.categories = action.payload;
        }
      );
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
} = ExpenseNameSlice.actions;

export default ExpenseNameSlice.reducer;
