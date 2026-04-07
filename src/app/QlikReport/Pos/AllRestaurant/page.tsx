'use client';

import { AllRestaurantReport } from '@/redux/reportRegistry';
import { RootState } from '@/redux/store';
import ReportPage from '@/app/QlikReport/engine/ReportPage';
import { allRestaurantConfig } from '../../configs/allRestaurant.config';

// Select 'allRestaurant' (the key defined in your config)
const selector = (s: RootState) => s.allRestaurant;

export default function AllRestaurantPage() {
  return (
    <ReportPage
      config={allRestaurantConfig}
      thunks={AllRestaurantReport.thunks}
      actions={AllRestaurantReport.slice.actions}
      selector={selector}
    />
  );
}