'use client';

import { OutstandingReport } from '@/redux/reportRegistry';
import { RootState } from '@/redux/store';
import ReportPage from '@/app/QlikReport/engine/ReportPage';
import { outstandingConfig } from '../../configs/outstanding.config';

// Select 'outstanding' (the key defined in your config)
const selector = (s: RootState) => s.outstanding;

export default function OutstandingPage() {
  return (
    <ReportPage
      config={outstandingConfig}
      thunks={OutstandingReport.thunks}
      actions={OutstandingReport.slice.actions}
      selector={selector}
    />
  );
}