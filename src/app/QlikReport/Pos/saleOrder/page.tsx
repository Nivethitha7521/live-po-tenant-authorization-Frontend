'use client';

import { SalesOrderReport } from '@/redux/reportRegistry';
import { RootState } from '@/redux/store';
import ReportPage from '@/app/QlikReport/engine/ReportPage';
import { salesOrderConfig } from '../../configs/salesOrder.config';

// Select 'salesOrder' (the key defined in your config)
const selector = (s: RootState) => s.salesOrder;

export default function SalesOrderPage() {
  return (
    <ReportPage
      config={salesOrderConfig}
      thunks={SalesOrderReport.thunks}
      actions={SalesOrderReport.slice.actions}
      selector={selector}
    />
  );
}