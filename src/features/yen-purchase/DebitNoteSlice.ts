// src/features/yen-purchase/debitCreditNoteSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '@/redux/store';
import { DebitCreditNote } from '@/Models/DebitCreditNote';

const BASE_URL = 'http://192.168.29.117:8000/purchaseapi';

interface DebitCreditNoteState {
  debitCreditNotes: DebitCreditNote[];
  documentId: string;
  documentType: 'GRN' | 'AP Invoice' | 'Outgoing Payment' | null;
  dialogOpen: boolean;
  loading: boolean;
  error: string | null;
  snackbarMessage: string;
  snackbarOpen: boolean;
}

const initialState: DebitCreditNoteState = {
  debitCreditNotes: [],
  documentId: '',
  documentType: null,
  dialogOpen: false,
  loading: false,
  error: null,
  snackbarMessage: '',
  snackbarOpen: false,
};

export const fetchDebitCreditNotesByDocument = createAsyncThunk(
  'debitCreditNote/fetchDebitCreditNotesByDocument',
  async (
    { documentId, page, size }: { documentId: string; page: number; size: number },
    { rejectWithValue }
  ) => {
    try {
      const response = await axios.get(
        `${BASE_URL}/debitnote/returnprocess/DebitCreditNote/by-document/${documentId}`,
        {
          params: { skip: (page - 1) * size, limit: size },
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch Debit/Credit Notes:', error);
      return rejectWithValue(error.response?.data || 'Failed to fetch Debit/Credit Notes');
    }
  }
);

const debitCreditNoteSlice = createSlice({
  name: 'debitCreditNote',
  initialState,
  reducers: {
    setDebitCreditDocumentId: (state, action: PayloadAction<string>) => {
      state.documentId = action.payload;
    },
    setDebitCreditDocumentType: (
      state,
      action: PayloadAction<'GRN' | 'AP Invoice' | 'Outgoing Payment'>
    ) => {
      state.documentType = action.payload;
    },
    setDebitCreditDialogOpen: (state, action: PayloadAction<boolean>) => {
      state.dialogOpen = action.payload;
    },
    setSnackbarMessage: (state, action: PayloadAction<string>) => {
      state.snackbarMessage = action.payload;
      state.snackbarOpen = true;
    },
    clearSnackbar: (state) => {
      state.snackbarMessage = '';
      state.snackbarOpen = false;
    },
    clearDebitCreditNotes: (state) => {
      state.debitCreditNotes = [];
      state.documentId = '';
      state.documentType = null;
      state.dialogOpen = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDebitCreditNotesByDocument.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDebitCreditNotesByDocument.fulfilled, (state, action) => {
        state.loading = false;
        state.debitCreditNotes = action.payload;
      })
      .addCase(fetchDebitCreditNotesByDocument.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.snackbarMessage = action.payload as string;
        state.snackbarOpen = true;
      });
  },
});

export const {
  setDebitCreditDocumentId,
  setDebitCreditDocumentType,
  setDebitCreditDialogOpen,
  setSnackbarMessage,
  clearSnackbar,
  clearDebitCreditNotes,
} = debitCreditNoteSlice.actions;

export const selectDebitCreditNote = (state: RootState) => state.debitCreditNote;

export default debitCreditNoteSlice.reducer;