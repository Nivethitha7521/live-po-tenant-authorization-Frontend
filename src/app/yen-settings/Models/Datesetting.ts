
// Types
export type RestrictionType = 'no_restriction' | 'current_only' | 'days_before' | 'days_after' | 'date_range';

export interface DateRestriction {
  id?: string;
  restrictionType: RestrictionType;
  daysValue: number;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface PurchaseDateSettings {
  id?: string;
  orderDateRestriction: DateRestriction;
  expectedDeliveryRestriction: DateRestriction;
  invoiceDateRestriction: DateRestriction;
  expectedDeliveryDays: number;
  invoiceDaysAfterOrder: number;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface UpdateRestrictionPayload {
  restrictionType?: RestrictionType;
  daysValue?: number;
  startDate?: string | null;
  endDate?: string | null;
  isActive?: boolean;
}

export interface SettingsState {
  settings: PurchaseDateSettings | null;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

export const initialState: SettingsState = {
  settings: null,
  loading: false,
  error: null,
  lastUpdated: null
};

export const defaultRestriction: DateRestriction = {
  restrictionType: 'no_restriction',
  daysValue: 0,
  startDate: null,
  endDate: null,
  isActive: true
};