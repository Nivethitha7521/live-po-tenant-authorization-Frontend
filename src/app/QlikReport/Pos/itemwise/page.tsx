'use client';

import { ItemwiseSalesReport } from '@/redux/reportRegistry';
import { RootState } from '@/redux/store';
import ReportPage from '@/app/QlikReport/engine/ReportPage';
import { itemwiseSalesConfig } from '../../configs/itemwiseSales.config';

// Select 'itemwiseSales' (the key defined in your config)
const selector = (s: RootState) => s.itemwiseSales;

export default function ItemwiseSalesPage() {
  return (
    <ReportPage
      config={itemwiseSalesConfig}
      thunks={ItemwiseSalesReport.thunks}
      actions={ItemwiseSalesReport.slice.actions}
      selector={selector}
    />
  );
}