import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { RootState } from "../../redux/store";
import { Personal, initialState } from "@/Models/personalModel";

// Async thunk to fetch all Personal items
export const fetchPersonals = createAsyncThunk(
  "personals/fetchPersonals",
  async () => {
    const response = await axios.get(
      "http://127.0.0.1:8000/purchaseapi/popersonals/",
    ); // Adjust API endpoint as needed
    return response.data;
  },
);

// Async thunk to add a new Personal item
export const addPersonal = createAsyncThunk<Personal, Personal>(
  "personals/addPersonal",
  async (personalData) => {
    const response = await axios.post(
      "http://127.0.0.1:8000/purchaseapi/popersonals/",
      personalData,
    ); // Adjust API endpoint as needed
    return response.data;
  },
);

// Async thunk to update an existing Personal item
export const updatePersonal = createAsyncThunk<Personal, Personal>(
  "personals/updatePersonal",
  async (personalData) => {
    const response = await axios.patch(
      `http://127.0.0.1:8000/purchaseapi/popersonals/${personalData.personalId}`,
      personalData,
    ); // Adjust API endpoint as needed
    return response.data;
  },
);

// Create slice for Personal slice
const personalSlice = createSlice({
  name: "personals",
  initialState,
  reducers: {
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    setDialogOpen(state, action: PayloadAction<"none" | "edit">) {
      state.dialogOpen = action.payload;
    },
    setPersonalData(state, action: PayloadAction<Personal>) {
      state.personalData = action.payload;
    },
    setSnackbarOpen(state, action: PayloadAction<boolean>) {
      state.snackbarOpen = action.payload;
    },
    setSnackbarMessage(state, action: PayloadAction<string>) {
      state.snackbarMessage = action.payload;
    },
    setEditIndex(state, action: PayloadAction<number | null>) {
      state.editIndex = action.payload;
    },
    addPersonaldetail: (state, action) => {
      state.personalitems.push(action.payload); // Add new item to the list
    },
    updatePersonaldetail: (state, action) => {
      const index = state.personalitems.findIndex(
        (person) => person.personalId === action.payload.personalId,
      );
      if (index !== -1) {
        state.personalitems[index] = action.payload; // Update the existing personal data
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPersonals.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPersonals.fulfilled, (state, action) => {
        state.loading = false;
        state.personalitems = action.payload;
      })
      .addCase(fetchPersonals.rejected, (state) => {
        state.loading = false;
      })
      .addCase(addPersonal.fulfilled, (state, action) => {
        state.personalitems.push(action.payload);
      })
      .addCase(updatePersonal.fulfilled, (state, action) => {
        const index = state.personalitems.findIndex(
          (personalitems) =>
            personalitems.personalId === action.payload.personalId,
        );
        if (index !== -1) {
          state.personalitems[index] = action.payload;
        }
      });
  },
});

// Export actions from slice
export const {
  setSearchQuery,
  setDialogOpen,
  setPersonalData,
  setSnackbarOpen,
  setSnackbarMessage,
  setEditIndex,
  addPersonaldetail,
  updatePersonaldetail,
} = personalSlice.actions;

// Selector to get Personal items from state
export const selectPersonals = (state: RootState) => state.personal;

// Export reducer from slice
export default personalSlice.reducer;
