'use client';

import { PaymodeReport } from '@/redux/reportRegistry';
import { RootState } from '@/redux/store';
import ReportPage from '@/app/QlikReport/engine/ReportPage';
import { paymodeConfig } from '../../configs/paymode.config';

// Select 'paymode' (the key defined in your config)
const selector = (s: RootState) => s.paymode;

export default function PaymodePage() {
  return (
    <ReportPage
      config={paymodeConfig}
      thunks={PaymodeReport.thunks}
      actions={PaymodeReport.slice.actions}
      selector={selector}
    />
  );
}