'use client';

import { ItemTransferReport } from '@/redux/reportRegistry';
import { RootState } from '@/redux/store';
import ReportPage from '@/app/QlikReport/engine/ReportPage';
import { itemTransferConfig } from '../../configs/itemTransfer.config';

// Select 'itemTransfer' (the key defined in your config)
const selector = (s: RootState) => s.itemTransfer;

export default function ItemTransferPage() {
  return (
    <ReportPage
      config={itemTransferConfig}
      thunks={ItemTransferReport.thunks}
      actions={ItemTransferReport.slice.actions}
      selector={selector}
    />
  );
}