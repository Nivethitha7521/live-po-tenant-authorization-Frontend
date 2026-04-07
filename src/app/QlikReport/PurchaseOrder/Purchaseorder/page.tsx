'use client';

import { PurchaseReport } from '@/redux/reportRegistry';
import { RootState } from '@/redux/store';
import ReportPage from '@/app/QlikReport/engine/ReportPage';
import { purchaseConfig } from '../../configs/purchase.config';

// Select 'purchase' (the key defined in your config)
const selector = (s: RootState) => s.purchase;

export default function PurchasePage() {
  return (
    <ReportPage
      config={purchaseConfig}
      thunks={PurchaseReport.thunks}
      actions={PurchaseReport.slice.actions}
      selector={selector}
    />
  );
}