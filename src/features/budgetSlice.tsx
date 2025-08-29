import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface BudgetAdjustment {
  adjustmentId: string;
  adjustmentDate: string;
  adjustmentAmount: string;
  reasonForAdjustment: string;
  approvedBy: string;
}

interface BudgetData {
  budgetId: string;
  department: string;
  budgetName: string;
  budgetPeriodStart: string;
  budgetPeriodEnd: string;
  totalBudgetAmount: string;
  allocatedAmount: string;
  spentAmount: string;
  remainingBudget: string;
  budgetCategory: string;
  description: string;
  responsiblePerson: string;
  approvalStatus: string;
  approvalDate: string;
  approverName: string;
  notes: string;
  attachments: string | null;
  createdDate: string;
  lastUpdatedDate: string;
  budgetAdjustments: BudgetAdjustment[];
}

interface BudgetState {
  budgets: BudgetData[];
}

const initialState: BudgetState = {
  budgets: [],
};

const budgetSlice = createSlice({
  name: 'budget',
  initialState,
  reducers: {
    addBudget: (state, action: PayloadAction<BudgetData>) => {
      state.budgets.push(action.payload);
    },
    updateBudget: (state, action: PayloadAction<{ index: number; budget: BudgetData }>) => {
      const { index, budget } = action.payload;
      state.budgets[index] = budget;
    },
    deleteBudget: (state, action: PayloadAction<number>) => {
      state.budgets.splice(action.payload, 1);
    },
  },
});

export const { addBudget, updateBudget, deleteBudget } = budgetSlice.actions;
export default budgetSlice.reducer;
