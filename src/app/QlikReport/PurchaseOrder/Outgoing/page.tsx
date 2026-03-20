'use client';

import { OutgoingReport } from '@/redux/reportRegistry';
import { RootState } from '@/redux/store';
import ReportPage from '@/app/QlikReport/engine/ReportPage';
import { outgoingConfig } from '../../configs/outgoing.config'; // Adjust path if needed

// This selector uses the 'key' from your config (key: 'outgoing')
const selector = (s: RootState) => s.outgoing;

export default function OutgoingPage() {
  return (
    <ReportPage
      config={outgoingConfig}
      thunks={OutgoingReport.thunks}
      actions={OutgoingReport.slice.actions}
      selector={selector}
    />
  );
}