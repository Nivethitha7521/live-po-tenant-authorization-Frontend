'use client';

import { WarehouseReturnReport } from '@/redux/reportRegistry';
import { RootState } from '@/redux/store';
import ReportPage from '@/app/QlikReport/engine/ReportPage';
import { warehouseReturnConfig } from '../../configs/warehouseReturn.config';

// Select 'warehouseReturn' (the key defined in your config)
const selector = (s: RootState) => s.warehouseReturn;

export default function WarehouseReturnPage() {
  return (
    <ReportPage
      config={warehouseReturnConfig}
      thunks={WarehouseReturnReport.thunks}
      actions={WarehouseReturnReport.slice.actions}
      selector={selector}
    />
  );
}