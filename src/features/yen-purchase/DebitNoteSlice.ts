// src/features/yen-purchase/debitCreditNoteSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import purchaseApi from "@/utils/api";
import { RootState } from '@/redux/store';

const BASE_URL = 'https://yenerp.com';

// ============================================
// INTERFACES (Updated for comprehensive API)
// ============================================

export interface DebitNoteViewItem {
  itemId: string;
  itemName: string;
  noteType: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  finalPrice: number;
  reason?: string;
  isAmountOnly: boolean;
}

export interface DebitNotePaymentHistory {
  date: string | Date;
  outgoingPaymentId?: string;
  clearedBy?: string;
  amount: number;
}

export interface ComprehensiveDebitNoteView {
  noteId: string;
  noteNumber: string;
  randomId:string;
  mongoId: string;
  documentId: string;
  documentType: string;
  vendorName: string;
  status: string;
  noteType: string;
  isAmountOnly: boolean;
  totalAmount: number;
  finalAmount: number;
  pendingAmount: number;
  remainingPayableAmount?: number;
  createdDate: string | Date;
  createdBy: string;
  createdDateFormatted: string;
  agingDays: number;
  clearedAgainstOutgoing?: string;
  clearedBy?: string;
  clearedDate?: string | Date;
  items: DebitNoteViewItem[];
  paymentHistory: DebitNotePaymentHistory[];
  sourceDocumentRef?: string;
  sourceDocumentDetails?: any;
  reason?: string;
  comments?: string;
}

export interface DebitNotesSummary {
  documentId: string;
  documentType: string;
  vendorName: string;
  totalActiveDebitNotes: number;
  totalClearedDebitNotes: number;
  totalAmount: number;
  totalPendingAmount: number;
  totalClearedAmount: number;
  availableForNewDebit?: number;
}

export interface ComprehensiveDebitNotesResponse {
  documentId: string;
  totalNotes: number;
  itemWiseNotes: number;
  amountOnlyNotes: number;
  activeNotes: number;
  clearedNotes: number;
  totalAmount: number;
  pendingAmount: number;
  clearedAmount: number;
  availableForNewDebit: number;
  notes: ComprehensiveDebitNoteView[];
  summary: DebitNotesSummary;
}

// For backward compatibility
export interface DebitCreditNote {
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
  createdDate: string | Date;
  createdBy: string;
  status: string;
  noteType: string;
  isAmountOnly?: boolean;
  remainingPayableAmount?: number;
  pendingAmount?: number;
  clearedAgainstOutgoing?: string;
  clearedBy?: string;
  clearedDate?: string | Date;
  paymentHistory?: any[];
  sourceDocument?: any;
  [key: string]: any;
}

interface DebitCreditNoteState {
  // Comprehensive view data
  comprehensiveData: ComprehensiveDebitNotesResponse | null;
  
  // Individual collections
  allDebitNotes: ComprehensiveDebitNoteView[];
  activeNotes: ComprehensiveDebitNoteView[];
  clearedNotes: ComprehensiveDebitNoteView[];
  itemWiseNotes: ComprehensiveDebitNoteView[];
  amountOnlyNotes: ComprehensiveDebitNoteView[];
  
  // Current document info
  documentId: string;
  documentType: string;
  
  // UI state
  dialogOpen: boolean;
  loading: boolean;
  error: string | null;
  snackbarMessage: string;
  snackbarOpen: boolean;
  
  // For backward compatibility
  debitCreditNotes: DebitCreditNote[];
}

const initialState: DebitCreditNoteState = {
  comprehensiveData: null,
  allDebitNotes: [],
  activeNotes: [],
  clearedNotes: [],
  itemWiseNotes: [],
  amountOnlyNotes: [],
  documentId: '',
  documentType: '',
  dialogOpen: false,
  loading: false,
  error: null,
  snackbarMessage: '',
  snackbarOpen: false,
  debitCreditNotes: [],
};

// ============================================
// ASYNC THUNKS
// ============================================
export const fetchAllDebitNotesForDocument = createAsyncThunk(
  'debitCreditNote/fetchAllDebitNotesForDocument',
  async (
    { 
      documentId, 
      documentType,  // ADD THIS REQUIRED PARAMETER
      includeCleared = true, 
      includeActive = true 
    }: { 
      documentId: string; 
      documentType: string;  // Add this
      includeCleared?: boolean; 
      includeActive?: boolean;
    },
    { rejectWithValue }
  ) => {
    try {
      console.log('📋 Fetching debit notes for document:', documentId, 'type:', documentType);
      
      const response = await purchaseApi.get<ComprehensiveDebitNotesResponse>(
        `/debitnote/returnprocess/debitnotes/comprehensive/${documentId}`,
        {
          params: {
            document_type: documentType,  // Add this parameter
            include_cleared: includeCleared,
            include_active: includeActive,
          },
        }
      );
      
      const data = response.data;
      console.log('✅ Debit notes loaded successfully');
      return data;
      
    } catch (error: any) {
      console.error('❌ Failed to fetch debit notes:', error);
      return rejectWithValue(
        error.response?.data?.detail || 
        error.response?.data?.message || 
        'Failed to fetch debit notes'
      );
    }
  }
);
// In DebitNoteSlice.ts - Fix the thunk
export const fetchAllDebitNotesComprehensive = createAsyncThunk(
  'debitCreditNote/fetchAllDebitNotesComprehensive',
  async (
    { 
      documentId, 
      documentType,  // This is now required
      includeCleared = true, 
      includeActive = true 
    }: { 
      documentId: string; 
      documentType: string;  // Required
      includeCleared?: boolean; 
      includeActive?: boolean;
    },
    { rejectWithValue }
  ) => {
    try {
      console.log('📋 Making API request:', {
        documentId,
        documentType,
        includeCleared,
        includeActive
      });
      
      const response = await purchaseApi.get<ComprehensiveDebitNotesResponse>(
        `/debitnote/returnprocess/debitnotes/comprehensive/${documentId}`,
        {
          params: {
            document_type: documentType,  // Make sure this matches backend
            include_cleared: includeCleared,
            include_active: includeActive,
          },
        }
      );
      
      console.log('✅ API response received:', response.status);
      return response.data;
      
    } catch (error: any) {
      console.error('❌ API request failed:', error);
      
      // Get detailed error info
      let errorDetails = 'Unknown error';
      if (error.response) {
        console.log('Response data:', error.response.data);
        console.log('Response status:', error.response.status);
        console.log('Response headers:', error.response.headers);
        
        errorDetails = error.response.data?.detail || 
                      error.response.data?.message || 
                      `Server error: ${error.response.status}`;
      } else if (error.request) {
        console.log('No response received:', error.request);
        errorDetails = 'No response from server';
      } else {
        console.log('Error setting up request:', error.message);
        errorDetails = error.message;
      }
      
      return rejectWithValue(errorDetails);
    }
  }
);
// Create amount-only debit note
export const createAmountDebitNote = createAsyncThunk(
  'debitCreditNote/createAmountDebitNote',
  async (
    data: {
      documentId: string;
      documentType: 'grn' | 'ap_invoice' | 'outgoing_payment';
      totalAmount: number;
      reason: string;
      createdBy: string;
      comments?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await purchaseApi.post(
        `/debitnote/returnprocess/AmountDebitNote/create`,
        data
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.detail || 
        'Failed to create amount-only debit note'
      );
    }
  }
);

// Download all PDF
export const downloadAllDebitNotesPdf = createAsyncThunk(
  'debitCreditNote/downloadAllDebitNotesPdf',
  async (
    { documentId }: { documentId: string },
    { rejectWithValue }
  ) => {
    try {
      console.log('📄 Downloading ALL debit notes PDF for:', documentId);
      
      const response = await purchaseApi.get(
        `/debitnote/returnprocess/DebitCreditNote/pdf-all/${documentId}`,
        {
          responseType: 'blob',
        }
      );
      
      // Create download link
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `All_DebitNotes_${documentId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      return {
        success: true,
        message: 'PDF downloaded successfully',
        documentId
      };
      
    } catch (error: any) {
      console.error('❌ Failed to download PDF:', error);
      return rejectWithValue(
        error.response?.data?.detail || 
        'Failed to download PDF'
      );
    }
  }
);

// ============================================
// SLICE
// ============================================

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
      state.comprehensiveData = null;
      state.allDebitNotes = [];
      state.activeNotes = [];
      state.clearedNotes = [];
      state.itemWiseNotes = [];
      state.amountOnlyNotes = [];
      state.documentId = '';
      state.documentType = '';
      state.dialogOpen = false;
      state.debitCreditNotes = [];
    },
    resetLoading: (state) => {
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Handle loading state for all thunks
    builder
      .addCase(fetchAllDebitNotesComprehensive.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.snackbarOpen = false;
      })
      .addCase(fetchAllDebitNotesComprehensive.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        
        const data = action.payload;
        
        // Store comprehensive data
        state.comprehensiveData = data;
        
        // Store all notes
        state.allDebitNotes = data.notes || [];
        
        // Categorize notes
        state.activeNotes = data.notes.filter(note => note.status === 'Active');
        state.clearedNotes = data.notes.filter(note => note.status === 'Cleared');
        state.itemWiseNotes = data.notes.filter(note => note.noteType === 'item_wise');
        state.amountOnlyNotes = data.notes.filter(note => note.noteType === 'amount_only');
        
        // Update document info
        state.documentId = data.documentId;
        state.documentType = data.summary?.documentType || '';
        
        // Convert to legacy format for backward compatibility
        state.debitCreditNotes = data.notes.map(note => {
          const legacyNote: DebitCreditNote = {
            _id: note.mongoId,
            noteId: note.noteId,
            randomId: note.noteNumber || note.noteId,
            documentId: note.documentId,
            documentType: note.documentType,
            vendorName: note.vendorName,
            itemDetails: note.items,
            totalAmount: note.totalAmount,
            debitAmount: note.totalAmount,
            finalAmount: note.finalAmount,
            reason: note.reason,
            createdDate: note.createdDate,
            createdBy: note.createdBy,
            status: note.status,
            noteType: note.noteType,
            isAmountOnly: note.isAmountOnly,
            remainingPayableAmount: note.remainingPayableAmount,
            pendingAmount: note.pendingAmount,
            clearedAgainstOutgoing: note.clearedAgainstOutgoing,
            clearedBy: note.clearedBy,
            clearedDate: note.clearedDate,
            paymentHistory: note.paymentHistory,
            sourceDocument: note.sourceDocumentDetails,
          };
          return legacyNote;
        });
        
        console.log('✅ State updated with comprehensive debit notes:', {
          total: state.allDebitNotes.length,
          active: state.activeNotes.length,
          cleared: state.clearedNotes.length,
          itemWise: state.itemWiseNotes.length,
          amountOnly: state.amountOnlyNotes.length,
        });
      })
      .addCase(fetchAllDebitNotesComprehensive.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to fetch debit notes';
        state.snackbarMessage = state.error;
        state.snackbarOpen = true;
      });

    // Create amount-only debit note
    builder
      .addCase(createAmountDebitNote.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createAmountDebitNote.fulfilled, (state) => {
        state.loading = false;
        state.snackbarMessage = 'Amount-only debit note created successfully';
        state.snackbarOpen = true;
        state.error = null;
      })
      .addCase(createAmountDebitNote.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to create amount-only debit note';
        state.snackbarMessage = state.error;
        state.snackbarOpen = true;
      });

    // Download all PDF
    builder
      .addCase(downloadAllDebitNotesPdf.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(downloadAllDebitNotesPdf.fulfilled, (state) => {
        state.loading = false;
        state.snackbarMessage = 'All debit notes PDF downloaded successfully';
        state.snackbarOpen = true;
        state.error = null;
      })
      .addCase(downloadAllDebitNotesPdf.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to download PDF';
        state.snackbarMessage = state.error;
        state.snackbarOpen = true;
      })
      .addCase(fetchAllDebitNotesForDocument.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.snackbarOpen = false;
      })
      .addCase(fetchAllDebitNotesForDocument.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        
        const data = action.payload;
        
        // Store comprehensive data
        state.comprehensiveData = data;
        
        // Store all notes
        state.allDebitNotes = data.notes || [];
        
        // Categorize notes
        state.activeNotes = data.notes.filter(note => note.status === 'Active');
        state.clearedNotes = data.notes.filter(note => note.status === 'Cleared');
        state.itemWiseNotes = data.notes.filter(note => note.noteType === 'item_wise');
        state.amountOnlyNotes = data.notes.filter(note => note.noteType === 'amount_only');
        
        // Update document info
        state.documentId = data.documentId;
        state.documentType = data.summary?.documentType || '';
        
        // Convert to legacy format for backward compatibility
        state.debitCreditNotes = data.notes.map(note => {
          const legacyNote: DebitCreditNote = {
            _id: note.mongoId,
            noteId: note.noteId,
            randomId: note.noteNumber || note.noteId,
            documentId: note.documentId,
            documentType: note.documentType,
            vendorName: note.vendorName,
            itemDetails: note.items,
            totalAmount: note.totalAmount,
            debitAmount: note.totalAmount,
            finalAmount: note.finalAmount,
            reason: note.reason,
            createdDate: note.createdDate,
            createdBy: note.createdBy,
            status: note.status,
            noteType: note.noteType,
            isAmountOnly: note.isAmountOnly,
            remainingPayableAmount: note.remainingPayableAmount,
            pendingAmount: note.pendingAmount,
            clearedAgainstOutgoing: note.clearedAgainstOutgoing,
            clearedBy: note.clearedBy,
            clearedDate: note.clearedDate,
            paymentHistory: note.paymentHistory,
            sourceDocument: note.sourceDocumentDetails,
          };
          return legacyNote;
        });
        
        console.log('✅ State updated with debit notes:', {
          total: state.allDebitNotes.length,
          active: state.activeNotes.length,
          cleared: state.clearedNotes.length,
          itemWise: state.itemWiseNotes.length,
          amountOnly: state.amountOnlyNotes.length,
        });
      })
      .addCase(fetchAllDebitNotesForDocument.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to fetch debit notes';
        state.snackbarMessage = state.error;
        state.snackbarOpen = true;
      });
  },
});

// ============================================
// SELECTORS
// ============================================

export const {
  setDebitCreditDocumentId,
  setDebitCreditDocumentType,
  setDebitCreditDialogOpen,
  setSnackbarMessage,
  clearSnackbar,
  clearDebitCreditNotes,
  resetLoading,
} = debitCreditNoteSlice.actions;

// Primary selector
export const selectDebitCreditNote = (state: RootState) => state.debitCreditNote;

// Comprehensive data
export const selectComprehensiveData = (state: RootState) => state.debitCreditNote.comprehensiveData;

// Individual collections
export const selectAllDebitNotes = (state: RootState) => state.debitCreditNote.allDebitNotes;
export const selectActiveDebitNotes = (state: RootState) => state.debitCreditNote.activeNotes;
export const selectClearedDebitNotes = (state: RootState) => state.debitCreditNote.clearedNotes;
export const selectItemWiseDebitNotes = (state: RootState) => state.debitCreditNote.itemWiseNotes;
export const selectAmountOnlyDebitNotes = (state: RootState) => state.debitCreditNote.amountOnlyNotes;

// Summary data
export const selectDebitNoteSummary = (state: RootState) => state.debitCreditNote.comprehensiveData?.summary;

// Statistics
export const selectDebitNoteStats = (state: RootState) => {
  const allNotes = state.debitCreditNote.allDebitNotes;
  return {
    totalCount: allNotes.length,
    itemWiseCount: allNotes.filter(n => n.noteType === 'item_wise').length,
    amountOnlyCount: allNotes.filter(n => n.noteType === 'amount_only').length,
    activeCount: allNotes.filter(n => n.status === 'Active').length,
    clearedCount: allNotes.filter(n => n.status === 'Cleared').length,
    totalAmount: allNotes.reduce((sum, note) => sum + note.finalAmount, 0),
    pendingAmount: allNotes.reduce((sum, note) => sum + note.pendingAmount, 0),
  };
};

// For backward compatibility
export const selectLegacyDebitNotes = (state: RootState) => state.debitCreditNote.debitCreditNotes;

export default debitCreditNoteSlice.reducer;