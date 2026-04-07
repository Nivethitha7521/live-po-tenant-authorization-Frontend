'use client';

import { PettyCashExpenseReport } from '@/redux/reportRegistry';
import { RootState } from '@/redux/store';
import ReportPage from '@/app/QlikReport/engine/ReportPage';
import { pettyCashExpenseConfig } from '../../configs/pettyCashExpense.config';

// Select 'pettyCashExpense' (the key defined in your config)
const selector = (s: RootState) => s.pettyCashExpense;

export default function PettyCashExpensePage() {
  return (
    <ReportPage
      config={pettyCashExpenseConfig}
      thunks={PettyCashExpenseReport.thunks}
      actions={PettyCashExpenseReport.slice.actions}
      selector={selector}
    />
  );
}