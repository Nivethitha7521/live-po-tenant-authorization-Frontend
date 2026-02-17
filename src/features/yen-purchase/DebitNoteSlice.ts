// src/features/yen-purchase/debitCreditNoteSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '@/redux/store';
import purchaseApi from "@/utils/api";

const BASE_URL = 'http://127.0.0.1:8000/purchasetestapi';

interface DebitCreditNote {
  _id: string;
  noteId: string;
  randomId: string;
  documentId: string;
  documentType: string;
  vendorName: string;
  itemDetails?: any[];
  totalAmount?: number;
  debitAmount?: number;
  finalAmount?: number;
  reason?: string;
  createdDate: string;
  createdBy: string;
  status: string;
  noteType: string;
  isAmountOnly?: boolean;
  remainingPayableAmount?: number;
  totalTax?: number;
  totalDiscount?: number;
  returnDate?: string;
  sourceDocument?: any;
  [key: string]: any;
}

interface DebitCreditNoteState {
  debitCreditNotes: DebitCreditNote[];
  documentId: string;
  documentType: string;
  dialogOpen: boolean;
  loading: boolean;
  error: string | null;
  snackbarMessage: string;
  snackbarOpen: boolean;
  totalDebitAmount: number;
  totalCount: number;
}

const initialState: DebitCreditNoteState = {
  debitCreditNotes: [],
  documentId: '',
  documentType: '',
  dialogOpen: false,
  loading: false,
  error: null,
  snackbarMessage: '',
  snackbarOpen: false,
  totalDebitAmount: 0,
  totalCount: 0,
};

export const fetchDebitCreditNotesByDocument = createAsyncThunk(
  'debitCreditNote/fetchDebitCreditNotesByDocument',
  async (
    { documentId, page, size }: { documentId: string; page: number; size: number },
    { rejectWithValue }
  ) => {
    try {
      console.log('Fetching debit notes for documentId:', documentId);
      
      // Use /by-document endpoint which returns detailed notes with itemDetails
      const response = await purchaseApi.get(
        `${BASE_URL}/debitnote/returnprocess/DebitCreditNote/by-document/${documentId}`,
        {
          params: { skip: (page - 1) * size, limit: size },
        }
      );
      
      console.log('API Response:', response.data);
      
      // Ensure the response is an array
      if (Array.isArray(response.data)) {
        return response.data;
      } else if (response.data && typeof response.data === 'object') {
        // Handle different response formats
        if (response.data.history) {
          return response.data.history;
        } else if (response.data.debits) {
          return response.data.debits;
        } else {
          return [response.data];
        }
      }
      return [];
    } catch (error: any) {
      console.error('Failed to fetch Debit/Credit Notes:', error);
      return rejectWithValue(error.response?.data?.detail || error.response?.data || 'Failed to fetch Debit/Credit Notes');
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
    setDebitCreditDocumentType: (state, action: PayloadAction<string>) => {
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
      state.documentType = '';
      state.dialogOpen = false;
      state.totalDebitAmount = 0;
      state.totalCount = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDebitCreditNotesByDocument.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.snackbarOpen = false;
      })
      .addCase(fetchDebitCreditNotesByDocument.fulfilled, (state, action) => {
        state.loading = false;
        
        // Ensure we have an array
        const notes = Array.isArray(action.payload) ? action.payload : [];
        
        // Process and normalize the notes
        state.debitCreditNotes = notes.map(note => {
          // Determine note type
          const isAmountOnly = 
            note.isAmountOnly || 
            note.noteType === 'amount_only' ||
            (!note.itemDetails || note.itemDetails.length === 0) && 
            (note.totalAmount > 0 || note.debitAmount > 0);
          
          // Ensure itemDetails is an array for item-wise notes
          if (!isAmountOnly && (!note.itemDetails || !Array.isArray(note.itemDetails))) {
            note.itemDetails = [];
          }
          
          return {
            ...note,
            isAmountOnly,
            noteId: note.noteId || note._id,
            totalAmount: note.totalAmount || note.debitAmount || 0,
            finalAmount: note.finalAmount || note.totalAmount || note.debitAmount || 0,
          };
        });
        
        // Calculate total amount
        state.totalDebitAmount = state.debitCreditNotes.reduce((sum, note) => {
          return sum + (note.finalAmount || 0);
        }, 0);
        
        state.totalCount = state.debitCreditNotes.length;
        
        console.log('Processed debit notes:', {
          count: state.totalCount,
          totalAmount: state.totalDebitAmount,
          notes: state.debitCreditNotes,
        });
      })
      .addCase(fetchDebitCreditNotesByDocument.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to fetch notes';
        state.snackbarMessage = state.error;
        state.snackbarOpen = true;
        state.debitCreditNotes = [];
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