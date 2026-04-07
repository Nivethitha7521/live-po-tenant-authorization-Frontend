'use client';

import { DispatchReceiveReport } from '@/redux/reportRegistry'; // Import from your registry file
import { RootState } from '@/redux/store';
import ReportPage from '@/app/QlikReport/engine/ReportPage';
import { dispatchReceiveConfig } from '../../configs/dispatchReceive.config'; // Import the config

// Select 'dispatchReceive' (the key defined in your config and registry)
const selector = (s: RootState) => s.dispatchReceive;

export default function DispatchReceivePage() {
  return (
    <ReportPage
      config={dispatchReceiveConfig}
      thunks={DispatchReceiveReport.thunks}
      actions={DispatchReceiveReport.slice.actions}
      selector={selector}
    />
  );
}