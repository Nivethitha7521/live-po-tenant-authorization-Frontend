'use client';

import { DebitNoteReport } from '@/redux/reportRegistry';
import { RootState } from '@/redux/store';
import ReportPage from '@/app/QlikReport/engine/ReportPage';
import { debitNoteConfig } from '../../configs/debitNote.config';

// Select 'debitNote' (the key defined in your config)
const selector = (s: RootState) => s.debitNote;

export default function DebitNotePage() {
  return (
    <ReportPage
      config={debitNoteConfig}
      thunks={DebitNoteReport.thunks}
      actions={DebitNoteReport.slice.actions}
      selector={selector}
    />
  );
}