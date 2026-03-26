// src/features/yen-purchase/debitNotesAllSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import purchaseApi from "@/utils/api";
import { RootState } from '@/redux/store';

const BASE_URL = 'https://yenerp.com/purchasetestapi';

// ============================================
// INTERFACES
// ============================================

export interface DebitNoteItem {
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

export interface DebitNotePayment {
  date: string;
  outgoingPaymentId?: string;
  clearedBy?: string;
  amount: number;
}

export interface DebitNoteAllView {
  noteId: string;
  noteNumber: string;
  mongoId: string;
  documentId: string;
  documentType: string;
  vendorName: string;
  status: string;
  noteType: 'item_wise' | 'amount_only';
  isAmountOnly: boolean;
  totalAmount: number;
  finalAmount: number;
  pendingAmount: number;
  remainingPayableAmount?: number;
  createdDate: string;
  createdBy: string;
  createdDateFormatted: string;
  agingDays: number;
  clearedAgainstOutgoing?: string;
  clearedBy?: string;
  clearedDate?: string;
  items: DebitNoteItem[];
  paymentHistory: DebitNotePayment[];
  sourceDocumentRef?: string;
  reason?: string;
  comments?: string;
}

export interface DebitNotesAllSummary {
  document_id: string;
  document_type: string;
  vendor_name: string;
  random_id: string;
  original_amount: number;
  total_notes: number;
  item_wise_count: number;
  amount_only_count: number;
  active_count: number;
  cleared_count: number;
  total_amount: number;
  pending_amount: number;
  cleared_amount: number;
  available_for_new_debit: number;
}

export interface DebitNotesAllResponse {
  success: boolean;
  message: string;
  data: {
    document_info: {
      document_id: string;
      document_type: string;
      vendor_name: string;
      random_id: string;
      original_amount: number;
    };
    summary: DebitNotesAllSummary;
    notes: {
      all_notes: DebitNoteAllView[];
      item_wise_notes: DebitNoteAllView[];
      amount_only_notes: DebitNoteAllView[];
      active_notes: DebitNoteAllView[];
      cleared_notes: DebitNoteAllView[];
    };
    breakdown: {
      by_type: Array<{
        type: string;
        count: number;
        total_amount: number;
      }>;
      by_status: Array<{
        status: string;
        count: number;
        total_amount: number;
      }>;
    };
  };
}

interface DebitNotesAllState {
  // Data
  allNotes: DebitNoteAllView[];
  itemWiseNotes: DebitNoteAllView[];
  amountOnlyNotes: DebitNoteAllView[];
  activeNotes: DebitNoteAllView[];
  clearedNotes: DebitNoteAllView[];
  
  // Document info
  documentInfo: {
    document_id: string;
    document_type: string;
    vendor_name: string;
    random_id: string;
    original_amount: number;
  } | null;
  
  // Summary
  summary: DebitNotesAllSummary | null;
  
  // UI state
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  
  // PDF download
  pdfDownloading: boolean;
  pdfError: string | null;
  
  // Dialog state
  dialogOpen: boolean;
  selectedNote: DebitNoteAllView | null;
}

const initialState: DebitNotesAllState = {
  allNotes: [],
  itemWiseNotes: [],
  amountOnlyNotes: [],
  activeNotes: [],
  clearedNotes: [],
  documentInfo: null,
  summary: null,
  loading: false,
  error: null,
  successMessage: null,
  pdfDownloading: false,
  pdfError: null,
  dialogOpen: false,
  selectedNote: null,
};

// ============================================
// ASYNC THUNKS
// ============================================

// 1. Fetch ALL debit notes for a document
export const fetchAllDebitNotes = createAsyncThunk(
  'debitNotesAll/fetchAllDebitNotes',
  async (
    { 
      documentId, 
      includeCleared = true, 
      includeActive = true 
    }: { 
      documentId: string; 
      includeCleared?: boolean; 
      includeActive?: boolean;
    },
    { rejectWithValue }
  ) => {
    try {
      console.log('📋 Fetching ALL debit notes for document:', documentId);
      
      const response = await purchaseApi.get<DebitNotesAllResponse>(
        `/debitnote/returnprocess/debitnotes/view-all/${documentId}`,
        {
          params: {
            include_cleared: includeCleared,
            include_active: includeActive,
          },
        }
      );
      
      const data = response.data;
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch debit notes');
      }
      
      console.log('✅ ALL debit notes loaded:', {
        total: data.data.summary.total_notes,
        itemWise: data.data.summary.item_wise_count,
        amountOnly: data.data.summary.amount_only_count,
        active: data.data.summary.active_count,
        cleared: data.data.summary.cleared_count,
      });
      
      return data.data;
      
    } catch (error: any) {
      console.error('❌ Failed to fetch ALL debit notes:', error);
      return rejectWithValue(
        error.response?.data?.detail || 
        error.response?.data?.message || 
        'Failed to fetch ALL debit notes'
      );
    }
  }
);

// 2. Download ALL debit notes PDF
export const downloadAllDebitNotesPdf = createAsyncThunk(
  'debitNotesAll/downloadAllDebitNotesPdf',
  async (
    { documentId }: { documentId: string },
    { rejectWithValue }
  ) => {
    try {
      console.log('📄 Downloading ALL debit notes PDF for:', documentId);
      
      const response = await purchaseApi.get(
        `/debitnote/returnprocess/debitnotes/download-all-pdf/${documentId}`,
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

const debitNotesAllSlice = createSlice({
  name: 'debitNotesAll',
  initialState,
  reducers: {
    // Clear all data
    clearAllDebitNotes: (state) => {
      state.allNotes = [];
      state.itemWiseNotes = [];
      state.amountOnlyNotes = [];
      state.activeNotes = [];
      state.clearedNotes = [];
      state.documentInfo = null;
      state.summary = null;
      state.loading = false;
      state.error = null;
      state.successMessage = null;
      state.pdfDownloading = false;
      state.pdfError = null;
      state.dialogOpen = false;
      state.selectedNote = null;
    },
    
    // Set dialog open/close
    setDebitNotesDialogOpen: (state, action: PayloadAction<boolean>) => {
      state.dialogOpen = action.payload;
      if (!action.payload) {
        state.selectedNote = null;
      }
    },
    
    // Select a note for details view
    selectDebitNote: (state, action: PayloadAction<DebitNoteAllView | null>) => {
      state.selectedNote = action.payload;
    },
    
    // Clear errors
    clearErrors: (state) => {
      state.error = null;
      state.pdfError = null;
      state.successMessage = null;
    },
    
    // Set document ID for manual triggering
    setDocumentId: (state, action: PayloadAction<string>) => {
      if (state.documentInfo) {
        state.documentInfo.document_id = action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    // ============================================
    // FETCH ALL DEBIT NOTES
    // ============================================
    builder
      .addCase(fetchAllDebitNotes.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(fetchAllDebitNotes.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        
        const data = action.payload;
        
        // Store document info
        state.documentInfo = data.document_info;
        
        // Store summary
        state.summary = data.summary;
        
        // Store all notes
        state.allNotes = data.notes.all_notes || [];
        state.itemWiseNotes = data.notes.item_wise_notes || [];
        state.amountOnlyNotes = data.notes.amount_only_notes || [];
        state.activeNotes = data.notes.active_notes || [];
        state.clearedNotes = data.notes.cleared_notes || [];
        
        console.log('✅ State updated with ALL debit notes:', {
          total: state.allNotes.length,
          itemWise: state.itemWiseNotes.length,
          amountOnly: state.amountOnlyNotes.length,
        });
      })
      .addCase(fetchAllDebitNotes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to fetch debit notes';
        console.error('❌ Fetch error:', state.error);
      });

    // ============================================
    // DOWNLOAD PDF
    // ============================================
    builder
      .addCase(downloadAllDebitNotesPdf.pending, (state) => {
        state.pdfDownloading = true;
        state.pdfError = null;
      })
      .addCase(downloadAllDebitNotesPdf.fulfilled, (state, action) => {
        state.pdfDownloading = false;
        state.successMessage = action.payload.message || 'PDF downloaded successfully';
        console.log('✅ PDF download successful');
      })
      .addCase(downloadAllDebitNotesPdf.rejected, (state, action) => {
        state.pdfDownloading = false;
        state.pdfError = action.payload as string || 'Failed to download PDF';
        console.error('❌ PDF download error:', state.pdfError);
      });
  },
});

// ============================================
// SELECTORS
// ============================================

export const {
  clearAllDebitNotes,
  setDebitNotesDialogOpen,
  selectDebitNote,
  clearErrors,
  setDocumentId,
} = debitNotesAllSlice.actions;

// Main selector
export const selectDebitNotesAll = (state: RootState) => state.debitNotesAll;

// Individual selectors
export const selectAllNotes = (state: RootState) => state.debitNotesAll.allNotes;
export const selectItemWiseNotes = (state: RootState) => state.debitNotesAll.itemWiseNotes;
export const selectAmountOnlyNotes = (state: RootState) => state.debitNotesAll.amountOnlyNotes;
export const selectActiveNotes = (state: RootState) => state.debitNotesAll.activeNotes;
export const selectClearedNotes = (state: RootState) => state.debitNotesAll.clearedNotes;
export const selectDocumentInfo = (state: RootState) => state.debitNotesAll.documentInfo;
export const selectSummary = (state: RootState) => state.debitNotesAll.summary;
export const selectLoading = (state: RootState) => state.debitNotesAll.loading;
export const selectError = (state: RootState) => state.debitNotesAll.error;
export const selectPdfDownloading = (state: RootState) => state.debitNotesAll.pdfDownloading;
export const selectPdfError = (state: RootState) => state.debitNotesAll.pdfError;
export const selectDialogOpen = (state: RootState) => state.debitNotesAll.dialogOpen;
export const selectSelectedNote = (state: RootState) => state.debitNotesAll.selectedNote;

// Derived selectors
export const selectNoteStatistics = (state: RootState) => {
  const notes = state.debitNotesAll.allNotes;
  const summary = state.debitNotesAll.summary;
  
  if (!summary) {
    return {
      totalNotes: notes.length,
      itemWiseCount: notes.filter(n => n.noteType === 'item_wise').length,
      amountOnlyCount: notes.filter(n => n.noteType === 'amount_only').length,
      activeCount: notes.filter(n => n.status !== 'Cleared').length,
      clearedCount: notes.filter(n => n.status === 'Cleared').length,
      totalAmount: notes.reduce((sum, n) => sum + n.finalAmount, 0),
      pendingAmount: notes.reduce((sum, n) => sum + n.pendingAmount, 0),
    };
  }
  
  return {
    totalNotes: summary.total_notes,
    itemWiseCount: summary.item_wise_count,
    amountOnlyCount: summary.amount_only_count,
    activeCount: summary.active_count,
    clearedCount: summary.cleared_count,
    totalAmount: summary.total_amount,
    pendingAmount: summary.pending_amount,
    clearedAmount: summary.cleared_amount,
    originalAmount: summary.original_amount,
    availableForNewDebit: summary.available_for_new_debit,
  };
};

export default debitNotesAllSlice.reducer;