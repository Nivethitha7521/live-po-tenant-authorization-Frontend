'use client';

import { ItemOrderReport } from '@/redux/reportRegistry';
import { RootState } from '@/redux/store';
import ReportPage from '@/app/QlikReport/engine/ReportPage';
import { itemOrderConfig } from '../../configs/itemOrder.config';

// Select 'itemOrder' (the key defined in your config)
const selector = (s: RootState) => s.itemOrder;

export default function ItemOrderPage() {
  return (
    <ReportPage
      config={itemOrderConfig}
      thunks={ItemOrderReport.thunks}
      actions={ItemOrderReport.slice.actions}
      selector={selector}
    />
  );
}