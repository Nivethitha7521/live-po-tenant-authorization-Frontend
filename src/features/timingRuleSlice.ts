// src/store/timingRuleSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import dayjs, { Dayjs } from 'dayjs';

export interface TimingRule {
  ruleId: string;
  ruleName: string;
  action: string;
  hours: string;
  salaryDeducted: string;
  countDays: string;
}

interface EditPayload {
  index: number;
  rule: TimingRule;
}

const timingRuleSlice = createSlice({
  name: 'timingRules',
  initialState: [] as TimingRule[],
  reducers: {
    addRule: (state, action: PayloadAction<TimingRule>) => {
      state.push(action.payload);
    },
    editRule: (state, action: PayloadAction<EditPayload>) => {
      state[action.payload.index] = action.payload.rule;
    },
    deleteRule: (state, action: PayloadAction<number>) => {
      state.splice(action.payload, 1);
    },
  },
});

export const { addRule, editRule, deleteRule } = timingRuleSlice.actions;

export default timingRuleSlice.reducer;
