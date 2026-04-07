'use client';

import { DayendReport } from '@/redux/reportRegistry';
import { RootState } from '@/redux/store';
import ReportPage from '@/app/QlikReport/engine/ReportPage';
import { dayendConfig } from '../../configs/dayend.config';

// Select 'dayend' (the key defined in your config)
const selector = (s: RootState) => s.dayend;

export default function DayendPage() {
  return (
    <ReportPage
      config={dayendConfig}
      thunks={DayendReport.thunks}
      actions={DayendReport.slice.actions}
      selector={selector}
    />
  );
}