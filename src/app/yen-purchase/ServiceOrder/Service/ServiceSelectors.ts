import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '@/redux/store';

// Base selectors
export const selectServiceState = (state: RootState) => state.serviceOrder;
export const selectBusinesses = (state: RootState) => state.business.businesses;

// Derived selectors
export const selectPendingServices = createSelector(
  [selectServiceState],
  (serviceState) => serviceState.services.filter(service => service.status === 'Pending')
);

export const selectServiceLoading = createSelector(
  [selectServiceState],
  (serviceState) => serviceState.loading
);

export const selectServiceError = createSelector(
  [selectServiceState],
  (serviceState) => serviceState.error
);

export const selectSnackbarState = createSelector(
  [selectServiceState],
  (serviceState) => ({
    message: serviceState.snackbarMessage,
    open: serviceState.snackbarOpen
  })
);

export const selectServiceStatistics = createSelector(
  [selectPendingServices],
  (services) => ({
    totalServices: services.length,
    totalAmount: services.reduce((sum, service) => sum + (service.totalAmount || 0), 0),
    totalDescriptions: services.reduce((sum, service) => 
      sum + (service.desc_descriptions?.length || 0), 0
    )
  })
);