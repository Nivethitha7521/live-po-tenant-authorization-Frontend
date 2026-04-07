'use client';

import { CakeAppReport } from '@/redux/reportRegistry';
import { RootState } from '@/redux/store';
import ReportPage from '@/app/QlikReport/engine/ReportPage';
import { cakeAppConfig } from '../../configs/cakeApp.config';

// Select 'cakeApp' (the key defined in your config)
const selector = (s: RootState) => s.cakeApp;

export default function CakeAppPage() {
  return (
    <ReportPage
      config={cakeAppConfig}
      thunks={CakeAppReport.thunks}
      actions={CakeAppReport.slice.actions}
      selector={selector}
    />
  );
}