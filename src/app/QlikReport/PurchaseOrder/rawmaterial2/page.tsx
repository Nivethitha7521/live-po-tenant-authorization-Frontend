'use client';

import { StoreDispatchReport } from '@/redux/reportRegistry';
import { RootState } from '@/redux/store';
import ReportPage from '@/app/QlikReport/engine/ReportPage';
import { storeDispatchConfig } from '../../configs/storeDispatch.config';

// Select 'storeDispatch' (the key defined in your config)
const selector = (s: RootState) => s.storeDispatch;

export default function StoreDispatchPage() {
  return (
    <ReportPage
      config={storeDispatchConfig}
      thunks={StoreDispatchReport.thunks}
      actions={StoreDispatchReport.slice.actions}
      selector={selector}
    />
  );
}