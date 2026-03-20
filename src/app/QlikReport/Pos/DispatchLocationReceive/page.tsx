'use client';

import { DispatchLocationReceiveReport } from '@/redux/reportRegistry';
import { RootState } from '@/redux/store';
import ReportPage from '@/app/QlikReport/engine/ReportPage';
import { dispatchLocationReceiveConfig } from '../../configs/dispatchLocationReceive.config';

// Select 'dispatchLocationReceive' (the key defined in your config)
const selector = (s: RootState) => s.dispatchLocationReceive;

export default function DispatchLocationReceivePage() {
  return (
    <ReportPage
      config={dispatchLocationReceiveConfig}
      thunks={DispatchLocationReceiveReport.thunks}
      actions={DispatchLocationReceiveReport.slice.actions}
      selector={selector}
    />
  );
}