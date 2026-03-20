'use client';

import { DispatchReport } from '@/redux/reportRegistry';
import { RootState } from '@/redux/store';
import ReportPage from '@/app/QlikReport/engine/ReportPage';
import { dispatchConfig } from '../../configs/dispatch.config';

// FIX: Select 'productionEntry' (the key defined in your config)
// This matches the state created by reportReducers in store.ts
const selector = (s: RootState) => s.dispatch;

export default function DispatchPage() {
  return (
    <ReportPage
      config={dispatchConfig}
      thunks={DispatchReport.thunks}
      actions={DispatchReport.slice.actions}
      selector={selector}
    />
  );
}