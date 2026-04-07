'use client';

import { CancelOrderReport } from '@/redux/reportRegistry';
import { RootState } from '@/redux/store';
import ReportPage from '@/app/QlikReport/engine/ReportPage';
import { cancelOrderConfig } from '../../configs/cancelOrder.config';

// Select 'cancelOrder' (the key defined in your config)
const selector = (s: RootState) => s.cancelOrder;

export default function CancelOrderPage() {
  return (
    <ReportPage
      config={cancelOrderConfig}
      thunks={CancelOrderReport.thunks}
      actions={CancelOrderReport.slice.actions}
      selector={selector}
    />
  );
}