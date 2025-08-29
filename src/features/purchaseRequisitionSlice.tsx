import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Item {
  itemId: string;
  itemName: string;
  quantity: string;
  uom: string;
  description: string;
}

interface PurchaseRequisitionState {
  requisitionId: string;
  requesterName: string;
  department: string;
  requisitionDate: string;
  itemsRequired: Item[];
  requiredByDate: string;
  priority: string;
  justification: string;
  estimatedCost: string;
  budgetCode: string;
  suggestedSupplier: string;
  approvalStatus: string;
  approvalDate: string;
  approverName: string;
  notes: string;
  attachments: File | null;
  deliveryLocation: string;
  projectCode: string;
  createdDate: string;
  lastUpdatedDate: string;
}

const initialState: PurchaseRequisitionState[] = [];

const purchaseRequisitionSlice = createSlice({
  name: 'purchaseRequisitions',
  initialState,
  reducers: {
    addPurchaseRequisition(state, action: PayloadAction<PurchaseRequisitionState>) {
      state.push(action.payload);
    },
    updatePurchaseRequisition(state, action: PayloadAction<PurchaseRequisitionState>) {
      const index = state.findIndex(pr => pr.requisitionId === action.payload.requisitionId);
      if (index !== -1) {
        state[index] = action.payload;
      }
    },
    deletePurchaseRequisition(state, action: PayloadAction<string>) {
      return state.filter(pr => pr.requisitionId !== action.payload);
    },
  },
});

export const { addPurchaseRequisition, updatePurchaseRequisition, deletePurchaseRequisition } = purchaseRequisitionSlice.actions;

export default purchaseRequisitionSlice.reducer;
