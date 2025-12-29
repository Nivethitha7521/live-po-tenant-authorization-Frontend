import { list } from "postcss";

export interface Service {
  serviceId?: string | null;
  serviceName?: string | null;
  saccode?: number | null;
  status?: 'active' | 'deactivated' | null;
  mongoId?: string | null;
  createdDate?: Date | string | null; // ISO string or Date object
  lastUpdatedDate?: Date | string | null; // ISO string or Date object
}

export interface ServiceSummary{
  mongoId:string;
  serviceId:string;
  saccode:number;
  serviceName:string;
}
export interface PaginatedServiceSummary { 
    data: ServiceSummary[]
    total: number
    page: number
    limit: number
    total_pages: number
}
export interface ImportResult {
  message: string;
  inserted_count: number;
  updated_count: number;
  successful: Array<{
    row: number;
    data: {
      serviceName: string;
      serviceId?: string;
      ID?: string;
      SNo?: string;
      Status?: string;
      SACCode?: string;
      CreatedDate?: string;
      UpdatedDate?: string;
    };
    action: 'inserted' | 'updated';
  }>;
  failed: Array<{
    row: number;
    data: {
     serviceName: string;
      ID?: string;
      SNo?: string;
      Status?: string;
      SACCode?: string;
      CreatedDate?: string;
      UpdatedDate?: string;
    };
    error: string;
  }>;
  errorCount: number;
  detail?: {
    message: string;
    missing?: string[];
    required?: string[];
  };
}

export interface PaginatedServiceResponse {
  data: Service[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}
export interface ServiceSummaryResponse {
  data: ServiceSummary[];
  total?: number;      // Optional for autocomplete
  page?: number;       // Optional for autocomplete
  limit?: number;      // Optional for autocomplete
  total_pages?: number; // Optional for autocomplete
}

export interface ServiceState {
  displayItems: Service[];
  deactivatedItems: Service[]; // Keep for legacy or separate fetch if needed
  loading: boolean;
  importing: boolean;
  exporting: boolean;
  importSuccess: boolean;
  importError: string | null;
  importResult: ImportResult | null;
  exportSuccess: boolean;
  exportError: string | null;
  searchQuery: string;
  dialogOpen: 'none' | 'edit' | 'deactivated';
  serviceData: Service | null;
  editIndex: number | null;
  currentViewStatus: 'active' | 'deactivated';
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  showImportResultDialog: boolean;
  snackbarOpen: boolean;
  snackbarMessage: string;

   // Summary view states
  summaryItems: ServiceSummary[];
  summaryLoading: boolean;
  summaryCurrentPage: number;
  summaryTotalPages: number;
  summaryTotalItems: number;
  summaryPageSize: number;
  summarySearchQuery: string;
  summaryStatusFilter: 'active' ;

}

export const initialState: ServiceState = {
  displayItems: [],
  deactivatedItems: [],
  loading: false,
  importing: false,
  exporting: false,
  importSuccess: false,
  importError: null,
  importResult: null,
  exportSuccess: false,
  exportError: null,
  searchQuery: '',
  dialogOpen: 'none',
  serviceData: null,
  editIndex: null,
  currentViewStatus: 'active',
  currentPage: 1,
  totalPages: 0,
  totalItems: 0,
  pageSize: 50,
  showImportResultDialog: false,
  snackbarOpen: false,
  snackbarMessage: '',
  // Summary view initial states
  summaryItems: [],
  summaryLoading: false,
  summaryCurrentPage: 1,
  summaryTotalPages: 0,
  summaryTotalItems: 0,
  summaryPageSize: 5, // Default to 5 as per backend endpoint
  summarySearchQuery: '',
  summaryStatusFilter: 'active',
};