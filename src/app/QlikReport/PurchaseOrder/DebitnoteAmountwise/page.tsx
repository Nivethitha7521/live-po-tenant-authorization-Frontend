'use client';

import { DebitNoteAmountReport } from '@/redux/reportRegistry';
import { RootState } from '@/redux/store';
import ReportPage from '@/app/QlikReport/engine/ReportPage';
import { debitNoteAmountConfig } from '../../configs/debitNoteAmount.config';

// Select 'debitNoteAmount' (the key defined in your config)
const selector = (s: RootState) => s.debitNoteAmount;

export default function DebitNoteAmountPage() {
  return (
    <ReportPage
      config={debitNoteAmountConfig}
      thunks={DebitNoteAmountReport.thunks}
      actions={DebitNoteAmountReport.slice.actions}
      selector={selector}
    />
  );
}