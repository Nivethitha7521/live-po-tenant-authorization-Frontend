'use client';

import { GrnAgainstReport } from '@/redux/reportRegistry';
import { RootState } from '@/redux/store';
import ReportPage from '@/app/QlikReport/engine/ReportPage';
import { grnAgainstConfig } from '../../configs/grnAgainst.config';

// Select 'grnAgainst' (the key defined in your config)
const selector = (s: RootState) => s.grnAgainst;

export default function GrnAgainstPage() {
  return (
    <ReportPage
      config={grnAgainstConfig}
      thunks={GrnAgainstReport.thunks}
      actions={GrnAgainstReport.slice.actions}
      selector={selector}
    />
  );
}