'use client';

import { WastageEntryReport } from '@/redux/reportRegistry';
import { RootState } from '@/redux/store';
import ReportPage from '@/app/QlikReport/engine/ReportPage';
import { wastageEntryConfig } from '../../configs/wastageEntry.config';

// Select 'wastageEntry' (the key defined in your config)
const selector = (s: RootState) => s.wastageEntry;

export default function WastageEntryPage() {
  return (
    <ReportPage
      config={wastageEntryConfig}
      thunks={WastageEntryReport.thunks}
      actions={WastageEntryReport.slice.actions}
      selector={selector}
    />
  );
}