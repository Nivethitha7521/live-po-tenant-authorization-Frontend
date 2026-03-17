import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { API_BASE_URL } from "./OuletePhysicalStockSlice";
import purchaseApi from '@/utils/api';
// ================== Interfaces ==================
export interface UpdateResponse {
  varianceName: string;
  branchAlias: string;
  updatedPhysicalStock: number;
  updatedSystemStock: number;
  error: string | null;
}

export interface FilterOption {
  id: string;
  name: string;
}

export interface UpdateStockPayload {
  varianceNames: string[];
  branchAliases: string[];
  newPhysicalStocks: number[];
}

export interface Branch {
  locationId: string;
  locationName: string;
  aliasName: string;
}

export interface ApproveItemParams {
  itemId?: string;
  branch: string;
  queryDate?: string;
  approvedBy?: string;
  description?: string;
  varianceName?: string;
  itemName?: string;
  currentSystemQty?: string;
  physicalClosingQty?: string;
  reason?: string;
}

export interface SearchFilters {
  page: number;
  limit: number;
  categoryPage?: number;
  categoryLimit?: number;
  subCategoryPage?: number;
  subCategoryLimit?: number;
  itemNamePage?: number;
  itemNameLimit?: number;
  varianceNamePage?: number;
  varianceNameLimit?: number;
  includeSalesReturn: boolean;
  includeWastageReturn: boolean;
  includeStockTransfer: boolean;
  locationId?: string;
  itemName?: string[];
  varianceName?: string[];
  category?: string[];
  subCategory?: string[];
  queryDate?: string;
  categorySearch?: string;
  subCategorySearch?: string;
  itemNameSearch?: string;
  varianceNameSearch?: string;
  include_filter_options?: boolean;
  only_filter_options?: boolean; // ← NEW: when true, only fetch filter options (no table data)
}

export interface Branchitem {
  id: string;
  category: string;
  subCategory: string;
  itemName: string;
  varianceName: string;
  itemCode: string;
  closingStockQty: string;
  openingStockQty: string;
  stockStatus: "available" | "out_of_stock" | "unknown";
  received: string;
  dispatchedQty: string;
  salesQty: string;
  salesReturn: string;
  wastageReturnQty: string;
  warehouseReturnQty: string;
  stockTransferInQty: string;
  stockTransferOutQty: string;
  currentSystemQty: string;
  stockVariance: string;
  approvalStatus: "Approved" | "Pending" | "Not Available";
  physicalVariance: string;
  updatedCurrentSystemQty: string;
  physicalClosingQty: string;
  adjustedDate?: string;
  adjustedTime?: string;
  approvedBy?: string;
  description?: string;
  approveButton?: string | number | undefined;
  receivedQty?: string | number;
  salesReturnQty?: string | number;
  [key: string]: string | number | undefined;
}

interface Change {
  itemName: string;
  varianceName: string;
  locationName: string;
  field: string;
  newValue: string;
}

export interface EditableRow {
  isEditing?: boolean;
  physicalClosingQty?: string;
  [key: string]: boolean | string | undefined;
}

interface FilterFieldState {
  values: FilterOption[];
  page: number;
  total: number;
  loading: boolean;
  searchFilter?: string;
  search?: string
  hasMore?: boolean;
}

export interface FilterOptionsState {
  location: string[];
  category: FilterFieldState;
  subCategory: FilterFieldState;
  itemName: FilterFieldState;
  varianceName: FilterFieldState;

}

export interface StockAdjustment {
  _id: number;
  itemId: string;
  itemName: string;
  varianceName: string;
  category: string;
  subCategory: string;
  currentSystemQty: string;
  physicalClosingQty: string;
  updatedCurrentSystemQty: string;
  stockVariance: string;
  approvalStatus: string;
  description: string | null;
  adjustedDate: string;
  adjustedTime: string;
  approvedBy: string;
  branch: string;
  date: string;
}

export interface SearchParams {
  itemName: string[];
  varianceName: string[];
  category: string[];
  subCategory: string[];
  location?: string[];
  queryDate?: string;
}

export interface FetchParams {
  page?: number;
  limit?: number;
  locationId: string;
  category?: string[];
  subCategory?: string[];
  itemName?: string[];
  varianceName?: string[];
  queryDate?: string;
  include_filter_options?: boolean;
  only_filter_options?: boolean; // ← NEW: skips table fetch, only returns filterOptions
  categoryPage?: number;
  subCategoryPage?: number;
  itemNamePage?: number;
  varianceNamePage?: number;
  categoryLimit?: number;
  subCategoryLimit?: number;
  itemNameLimit?: number;
  varianceNameLimit?: number;
  categorySearch?: string;
  subCategorySearch?: string;
  itemNameSearch?: string;
  varianceNameSearch?: string;
  currentCategory?: string[];
  currentSubCategory?: string[];
  currentItemName?: string[];
  currentVarianceName?: string[];
  resetFilterOptions?: boolean;
}

export interface ApprovedItem {
  _id: string;
  itemCode: string;
  itemName: string;
  locationId: string;
  systemStockBefore: number;
  physicalClosing: number;
  actualVariance: number;
  systemStockAfter: number;
  approvedBy: string;
  description: string;
  approvedAt: string;
  [key: string]: string | number | undefined;
}

export interface ApprovedItemsResponse {
  data: ApprovedItem[];
  page: number;
  limit: number;
  total: number;
  isLoadMore: boolean;
}

interface DataState {
  branches: Branch[];
  branchwise: Branchitem[];
  updatedStocks: UpdateResponse[];
  stockAdjustments: StockAdjustment[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  limit: number;
  selectedLocation: string;
  editableRows: Record<string, EditableRow>;
  changes: Change[];
  filterOptions: FilterOptionsState;
  visibleColumns: Record<string, boolean>;
  totalCurrentSystemQty: number;
  sortField?: string;
  sortOrder?: "asc" | "desc";
  adjustmentHistory: StockAdjustment[];
  openFirstDialog: boolean;
  openAdjustmentDialog: boolean;
  openApproveDialog: boolean;
  selectedItem: Branchitem | null;
  selectedApproveItem: Branchitem | null;
  adjustmentReason: string;
  adjustedPhysicalStock: string;
  approveDescription: string;
  openSnackbar: boolean;
  snackbarMessage: string;
  currentPage: number;
  hasMoreData: boolean;
  allItems: Branchitem[];
  totalItems: number;
  totalPages: number;
  isLoadingMore: boolean;
  isFullScreen: boolean;
  tableView: "Stock" | "Approved";
  searchParams: SearchParams;
  approvedItems: {
    items: ApprovedItem[];
    page: number;
    limit: number;
    total: number;
    loading: boolean;
    error: string | null;
    filters: { branch: string; date: string };
    hasMore: boolean;
    isLoadingMore: boolean;
  };
}

export interface FetchError {
  message: string;
  status?: number;
  raw?: unknown;
}

// ================== Initial State ==================
const initialFilterField: FilterFieldState = {
  values: [],
  page: 1,
  total: 0,
  loading: false,
  searchFilter: undefined,
  hasMore: true,
};

export const initialState: DataState = {
  branches: [],
  branchwise: [],
  updatedStocks: [],
  stockAdjustments: [],
  loading: false,
  error: null,
  total: 0,
  page: 1,
  limit: 30,
  selectedLocation: "",
  editableRows: {},
  changes: [],
  filterOptions: {
    location: [],
    category: { ...initialFilterField },
    subCategory: { ...initialFilterField },
    itemName: { ...initialFilterField },
    varianceName: { ...initialFilterField },
  },
  visibleColumns: {
    "S.No": true,
    "Item Name": false,
    "Variance Name": true,
    itemCode: true,
    Category: false,
    Subcategory: false,
    "Sales Return": false,
    Wastages: true,
    "Warehouse Return": false,
    "Opening-Stock": true,
    "Receiving-Stock": true,
    "Stock IN": true,
    "Stock OUT": true,
    Sales: true,
    "Calc System": true,
    "System Stock": true,
    "Physical Stock": true,
    Action: true,
    Variance: true,
    "Status": false,
  },

  totalCurrentSystemQty: 0,
  sortField: undefined,
  sortOrder: undefined,
  adjustmentHistory: [],
  openFirstDialog: false,
  openAdjustmentDialog: false,
  openApproveDialog: false,
  selectedItem: null,
  selectedApproveItem: null,
  adjustmentReason: "",
  adjustedPhysicalStock: "",
  approveDescription: "",
  openSnackbar: false,
  snackbarMessage: "",
  currentPage: 1,
  hasMoreData: true,
  allItems: [],
  totalItems: 0,
  totalPages: 1,
  isLoadingMore: false,
  isFullScreen: false,
  tableView: "Stock",
  searchParams: {
    itemName: [],
    varianceName: [],
    category: [],
    subCategory: [],
    queryDate: "",
  },
  approvedItems: {
    items: [],
    page: 1,
    limit: 30,
    total: 0,
    loading: false,
    error: null,
    filters: { branch: "", date: "" },
    hasMore: true,
    isLoadingMore: false,
  },
};

// ================== Async Thunks ==================
export const fetchBranches = createAsyncThunk<Branch[], void, { rejectValue: FetchError }>(
  "data/fetchBranches",
  async (_, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.get(`/outletinventory/locations`);
      const data = response.data;

      return data.map(({ locationId, locationName, aliasName }: any) => ({
        locationId,
        locationName,
        aliasName: aliasName || locationName,
      }));
    } catch (error: any) {
      return rejectWithValue({ message: error?.response?.data?.detail || "Failed to fetch branches" });
    }
  }
);

export const fetchItems = createAsyncThunk<
  {
    branchwise: Branchitem[];
    total: number;
    page: number;
    limit: number;
    totalCurrentSystemQty: number;
    filterOptions?: {
      category: FilterFieldState;
      subCategory: FilterFieldState;
      itemName: FilterFieldState;
      varianceName: FilterFieldState;
    };
    stockInfo: { date: string | null; branch: string };
    dispatchInfo: { date: string | null; branch: string };
    salesInfo: { totalSalesQty: number; branch: string };
    salesReturnInfo: { totalReturnQty: number; branch: string };
    wastageReturnInfo: { totalReturnQty: number; branch: string };
    stockTransferInfo: { totalInQty: number; totalOutQty: number; branch: string };
    isFilterOnlyFetch: boolean;
  },
  FetchParams,
  { rejectValue: FetchError }
>("data/fetchItems", async (params, { rejectWithValue }) => {
  try {
    const queryParams = new URLSearchParams();

    // Pagination
    if (!params.only_filter_options) {
      if (params.page !== undefined) {
        queryParams.set("page", String(params.page));
      }
      if (params.limit !== undefined) {
        queryParams.set("limit", String(params.limit));
      }
    }

    queryParams.set("branch", params.locationId);
    queryParams.set(
      "include_filter_options",
      String(params.include_filter_options ?? true)
    );

    if (params.only_filter_options) {
      queryParams.set("only_filter_options", "true");
    }

    // Filters
    if (params.category?.length) {
      queryParams.set("category", params.category.join(","));
    }

    if (params.subCategory?.length) {
      queryParams.set("subCategory", params.subCategory.join(","));
    }

    if (params.itemName?.length) {
      queryParams.set("itemName", params.itemName.join(","));
    }

    if (params.varianceName?.length) {
      queryParams.set("varianceName", params.varianceName.join(","));
    }

    if (params.queryDate) {
      queryParams.set("queryDate", params.queryDate);
    }

    // Filter pagination
    if (params.categoryPage !== undefined) {
      queryParams.set("categoryPage", String(params.categoryPage));
      queryParams.set("categoryLimit", String(params.categoryLimit ?? 50));

      if (params.categorySearch) {
        queryParams.set("categorySearch", params.categorySearch);
      }
    }

    if (params.subCategoryPage !== undefined) {
      queryParams.set("subCategoryPage", String(params.subCategoryPage));
      queryParams.set("subCategoryLimit", String(params.subCategoryLimit ?? 50));

      if (params.subCategorySearch) {
        queryParams.set("subCategorySearch", params.subCategorySearch);
      }
    }

    if (params.itemNamePage !== undefined) {
      queryParams.set("itemNamePage", String(params.itemNamePage));
      queryParams.set("itemNameLimit", String(params.itemNameLimit ?? 50));

      if (params.itemNameSearch) {
        queryParams.set("itemNameSearch", params.itemNameSearch);
      }
    }

    if (params.varianceNamePage !== undefined) {
      queryParams.set("varianceNamePage", String(params.varianceNamePage));
      queryParams.set("varianceNameLimit", String(params.varianceNameLimit ?? 50));

      if (params.varianceNameSearch) {
        queryParams.set("varianceNameSearch", params.varianceNameSearch);
      }
    }

    // API CALL
    const response = await purchaseApi.get(
      `/outletinventoryvariance/?${queryParams.toString()}`
    );

    const data = response.data;

    // Mapping
    const branchwise: Branchitem[] = params.only_filter_options
      ? []
      : (data.filteredItems?.items || []).map((item: any) => ({
          id: item.id || item._id,
          category:
            typeof item.category === "object"
              ? item.category?.name ?? ""
              : item.category ?? "",
          subCategory:
            typeof item.subCategory === "object"
              ? item.subCategory?.name ?? ""
              : item.subCategory ?? "",
          itemName:
            typeof item.itemName === "object"
              ? item.itemName?.name ?? ""
              : item.itemName ?? "",
          varianceName:
            typeof item.varianceName === "object"
              ? item.varianceName?.name ?? ""
              : item.varianceName ?? "",
          itemCode: item.itemCode ?? "",
          closingStockQty: String(item.closingStockQty ?? "0"),
          openingStockQty: String(item.openingStockQty ?? "0"),
          stockStatus: item.stockStatus ?? "unknown",
          received: String(item.receivedQty ?? "0"),
          dispatchedQty: String(item.dispatchedQty ?? "0"),
          salesQty: String(item.salesQty ?? "0"),
          salesReturn: String(item.salesReturnQty ?? "0"),
          wastageReturnQty: String(item.wastageReturnQty ?? "0"),
          warehouseReturnQty: String(item.warehouseReturnQty ?? "0"),
          stockTransferInQty: String(item.stockTransferInQty ?? "0"),
          stockTransferOutQty: String(item.stockTransferOutQty ?? "0"),
          currentSystemQty: String(item.currentSystemQty ?? "0"),
          stockVariance: String(item.stockVariance ?? "0"),
          approvalStatus: item.approvalStatus ?? "Pending",
          physicalVariance: String(item.physicalVariance ?? "0"),
          updatedCurrentSystemQty: String(item.updatedCurrentSystemQty ?? "0"),
          physicalClosingQty: String(item.physicalClosingQty ?? "0"),
          approveButton: item.approveButton,
        }));

    return {
      branchwise,
      total: data.filteredItems?.total || 0,
      page: data.filteredItems?.page || (params.page ?? 1),
      limit: data.filteredItems?.limit || (params.limit ?? 50),
      totalCurrentSystemQty:
        data.filteredItems?.totalCurrentSystemQty || 0,
filterOptions: data.filterOptions
    ? {
        category: {
          values: data.filterOptions.category?.values || [],
          page: params.categoryPage || 1,
          total: data.filterOptions.category?.total || 0,
          loading: false,
          hasMore: (data.filterOptions.category?.values?.length || 0) > 0,
        },
        subCategory: {
          values: data.filterOptions.subCategory?.values || [],
          page: params.subCategoryPage || 1,
          total: data.filterOptions.subCategory?.total || 0,
          loading: false,
          hasMore: (data.filterOptions.subCategory?.values?.length || 0) > 0,
        },
        itemName: {
          values: data.filterOptions.itemName?.values || [],
          page: params.itemNamePage || 1,
          total: data.filterOptions.itemName?.total || 0,
          loading: false,
          hasMore: (data.filterOptions.itemName?.values?.length || 0) > 0,
        },
        varianceName: {
          values: data.filterOptions.varianceName?.values || [],
          page: params.varianceNamePage || 1,
          total: data.filterOptions.varianceName?.total || 0,
          loading: false,
          hasMore: (data.filterOptions.varianceName?.values?.length || 0) > 0,
        },
      }
    : undefined,

      stockInfo: data.stockInfo || { date: null, branch: params.locationId },
      dispatchInfo:
        data.dispatchInfo || { date: null, branch: params.locationId },
      salesInfo: data.salesInfo || { totalSalesQty: 0, branch: params.locationId },
      salesReturnInfo:
        data.salesReturnInfo || { totalReturnQty: 0, branch: params.locationId },
      wastageReturnInfo:
        data.wastageReturnInfo || { totalReturnQty: 0, branch: params.locationId },
      stockTransferInfo:
        data.stockTransferInfo || {
          totalInQty: 0,
          totalOutQty: 0,
          branch: params.locationId,
        },
      isFilterOnlyFetch: !!params.only_filter_options,
    };
  } catch (err: any) {
    return rejectWithValue({
      message: err?.response?.data?.detail || "Failed to fetch items",
    });
  }
});
export const approveItem = createAsyncThunk<
  { message: string; item: Branchitem },
  { itemCode: string; locationId: string; approvedBy?: string; description?: string },
  { rejectValue: FetchError }
>("data/approveItem", async ({ itemCode, locationId, approvedBy, description }, { rejectWithValue }) => {
  try {
    const response = await purchaseApi.patch(
      `/outletinventoryvariance/${itemCode}/approve`,
      { approved_by: approvedBy, description },
      { params: { locationId } }
    );

    return response.data;
  } catch (err: any) {
    return rejectWithValue({ message: err?.response?.data?.detail || "Failed to approve item" });
  }
});

export const fetchApprovedItems = createAsyncThunk<
  ApprovedItemsResponse,
  { page?: number; limit?: number; branch?: string; date?: string; isLoadMore?: boolean },
  { rejectValue: FetchError }
>(
  "data/fetchApprovedItems",
  async ({ page = 1, limit = 30, branch, date, isLoadMore = false }, { rejectWithValue }) => {
    try {
      const params: any = { page, limit };

      if (branch && branch.trim() !== "") params.branch = branch;
      if (date && date.trim() !== "") params.date = date;

      const response = await purchaseApi.get(
        `/outletinventoryvariance/approved`,
        { params }
      );

      const result = response.data;

      return {
        data: result.data || [],
        page: result.page || page,
        limit: result.limit || limit,
        total: result.total || 0,
        isLoadMore,
      };

    } catch (err: any) {
      return rejectWithValue({
        message: err?.response?.data?.detail || "Failed to fetch approved items",
      });
    }
  }
);

// ================== Slice ==================
const dataSlice = createSlice({
  name: "data",
  initialState,
  reducers: {
    resetData: (state) => {
      Object.assign(state, initialState);
      state.filterOptions.category.page = 1;
      state.filterOptions.subCategory.page = 1;
      state.filterOptions.itemName.page = 1;
      state.filterOptions.varianceName.page = 1;
      state.currentPage = 1;
      state.page = 1;
      state.totalPages = 1;
    },
    setSelectedLocation: (state, action: PayloadAction<string>) => { state.selectedLocation = action.payload; },
    setEditableRows: (state, action: PayloadAction<Record<string, EditableRow>>) => { state.editableRows = action.payload; },
    setChanges: (state, action: PayloadAction<Change[]>) => { state.changes = action.payload; },
    setVisibleColumns: (state, action: PayloadAction<Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)>) => {
      if (typeof action.payload === "function") state.visibleColumns = action.payload(state.visibleColumns);
      else state.visibleColumns = action.payload;
    },
    toggleColumn: (state, action: PayloadAction<string>) => { state.visibleColumns[action.payload] = !state.visibleColumns[action.payload]; },
    setFilterSearch: (state, action: PayloadAction<{ field: keyof FilterOptionsState; searchFilter: string }>) => {
      const { field, searchFilter } = action.payload;
      if (field !== "location") {
        state.filterOptions[field].searchFilter = searchFilter;
        state.filterOptions[field].hasMore = true;
      }
    },
    clearFilterSearch: (state, action: PayloadAction<keyof FilterOptionsState>) => {
      const field = action.payload;
      if (field !== "location") {
        state.filterOptions[field].searchFilter = undefined;
        state.filterOptions[field].hasMore = true;
      }
    },
    setSort: (state, action: PayloadAction<{ field: string; order: "asc" | "desc" }>) => {
      state.sortField = action.payload.field;
      state.sortOrder = action.payload.order;
    },
    clearSort: (state) => { state.sortField = undefined; state.sortOrder = undefined; },
    setOpenFirstDialog: (state, action: PayloadAction<boolean>) => { state.openFirstDialog = action.payload; },
    setOpenAdjustmentDialog: (state, action: PayloadAction<boolean>) => { state.openAdjustmentDialog = action.payload; },
    setOpenApproveDialog: (state, action: PayloadAction<boolean>) => { state.openApproveDialog = action.payload; },
    setSelectedItem: (state, action: PayloadAction<Branchitem | null>) => { state.selectedItem = action.payload; },
    setSelectedApproveItem: (state, action: PayloadAction<Branchitem | null>) => { state.selectedApproveItem = action.payload; },
    setAdjustmentReason: (state, action: PayloadAction<string>) => { state.adjustmentReason = action.payload; },
    setAdjustedPhysicalStock: (state, action: PayloadAction<string>) => { state.adjustedPhysicalStock = action.payload; },
    setApproveDescription: (state, action: PayloadAction<string>) => { state.approveDescription = action.payload; },
    setOpenSnackbar: (state, action: PayloadAction<boolean>) => { state.openSnackbar = action.payload; },
    setSnackbarMessage: (state, action: PayloadAction<string>) => { state.snackbarMessage = action.payload; },
    setCurrentPage: (state, action: PayloadAction<number>) => { state.currentPage = action.payload; },
    setHasMoreData: (state, action: PayloadAction<boolean>) => { state.hasMoreData = action.payload; },
    setAllItems: (state, action: PayloadAction<Branchitem[]>) => { state.allItems = action.payload; },
    setTotalItems: (state, action: PayloadAction<number>) => { state.totalItems = action.payload; },
    setTotalPages: (state, action: PayloadAction<number>) => { state.totalPages = action.payload; },
    setIsLoadingMore: (state, action: PayloadAction<boolean>) => { state.isLoadingMore = action.payload; },
    setIsFullScreen: (state, action: PayloadAction<boolean>) => { state.isFullScreen = action.payload; },
    setTableView: (state, action: PayloadAction<"Stock" | "Approved">) => { state.tableView = action.payload; },
    setSearchParams: (state, action: PayloadAction<SearchParams>) => { state.searchParams = action.payload; },
    setApprovedItemsFilters: (state, action: PayloadAction<{ branch?: string; date?: string }>) => {
      state.approvedItems.filters.branch = action.payload.branch ?? "";
      state.approvedItems.filters.date = action.payload.date ?? "";
    },
    setApprovedItemsPage: (state, action: PayloadAction<number>) => { state.approvedItems.page = action.payload; },
    resetApprovedItems: (state) => {
      state.approvedItems = { items: [], page: 1, limit: 10, total: 0, loading: false, error: null, filters: { branch: "", date: "" }, hasMore: true, isLoadingMore: false };
    },
    setApprovedItemsHasMore: (state, action: PayloadAction<boolean>) => { state.approvedItems.hasMore = action.payload; },
    setApprovedItemsIsLoadingMore: (state, action: PayloadAction<boolean>) => { state.approvedItems.isLoadingMore = action.payload; },
    appendApprovedItems: (state, action: PayloadAction<ApprovedItem[]>) => {
      state.approvedItems.items = [...state.approvedItems.items, ...action.payload];
    },
    resetApprovedItemsPagination: (state) => {
      state.approvedItems.items = [];
      state.approvedItems.page = 1;
      state.approvedItems.hasMore = true;
      state.approvedItems.isLoadingMore = false;
    },
    setDataLoading: (state, action: PayloadAction<boolean>) => { state.loading = action.payload; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBranches.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchBranches.fulfilled, (state, action) => { state.loading = false; state.branches = action.payload; })
      .addCase(fetchBranches.rejected, (state, action) => { state.loading = false; state.error = action.error.message || "Failed to fetch branches"; })

      // ─────────────────────────────────────────────────────────────
      // fetchItems.pending
      // ─────────────────────────────────────────────────────────────
      .addCase(fetchItems.pending, (state, action) => {
        const params = action.meta.arg;
        const isFilterOnly = !!params.only_filter_options;

        if (!isFilterOnly) {
          // Normal table fetch loading
          if (params.page === 1) {
            state.loading = true;
            state.error = null;
          } else if (params.page && params.page > 1) {
            state.isLoadingMore = true;
          }
        }

        // Filter-specific loading flags (always set regardless of filter-only)
        if (params.categoryPage !== undefined) state.filterOptions.category.loading = true;
        if (params.subCategoryPage !== undefined) state.filterOptions.subCategory.loading = true;
        if (params.itemNamePage !== undefined) state.filterOptions.itemName.loading = true;
        if (params.varianceNamePage !== undefined) state.filterOptions.varianceName.loading = true;
      })

      // ─────────────────────────────────────────────────────────────
      // fetchItems.fulfilled
      // ─────────────────────────────────────────────────────────────
      .addCase(fetchItems.fulfilled, (state, action) => {
        const params = action.meta.arg;
        const response = action.payload;
        const isFilterOnly = response.isFilterOnlyFetch;

        // ── 1. Handle Filter Options (always, regardless of filter-only) ──
        if (response.filterOptions) {
          const handleFilterField = (
            field: "category" | "subCategory" | "itemName" | "varianceName",
            pageParam?: number,
            searchParam?: string
          ) => {
            if (pageParam === undefined) return;
            const incoming = response.filterOptions![field];
            const isSearch = !!searchParam;
            const requestedPage = pageParam;
            const currentPage = state.filterOptions[field]?.page || 1;

            if (isSearch) {
              // Search: replace values entirely, reset page
              state.filterOptions[field] = {
                ...incoming,
                values: incoming.values,
                loading: false,
                hasMore: incoming.values.length > 0,
                page: 1,
              };
              return;
            }

            if (requestedPage > 1) {
              // Scroll load-more: append unique values
              const existingIds = new Set(
                state.filterOptions[field].values.map((v: any) => (typeof v === "object" ? v.id : v))
              );
              const newValues = incoming.values.filter((v: any) =>
                typeof v === "object" ? !existingIds.has(v.id) : !existingIds.has(v)
              );
              state.filterOptions[field] = {
                ...incoming,
                values: [...state.filterOptions[field].values, ...newValues],
                loading: false,
                page: requestedPage,
                hasMore: newValues.length > 0,
              };
            } else if (action.meta.arg.resetFilterOptions) {
              // Full reset
              state.filterOptions[field] = {
                ...incoming,
                values: incoming.values,
                loading: false,
                page: 1,
                hasMore: incoming.values.length > 0,
              };
            } else {
              // Regular page-1 refresh (search/filter changed)
              state.filterOptions[field] = {
                ...state.filterOptions[field],
                values: incoming.values,
                loading: false,
                hasMore: incoming.values.length > 0,
                page: currentPage,
              };
            }
          };

          handleFilterField("category", params.categoryPage, params.categorySearch);
          handleFilterField("subCategory", params.subCategoryPage, params.subCategorySearch);
          handleFilterField("itemName", params.itemNamePage, params.itemNameSearch);
          handleFilterField("varianceName", params.varianceNamePage, params.varianceNameSearch);
        }

        // ── 2. Handle Table Data (SKIP entirely for filter-only fetches) ──
        if (!isFilterOnly && params.page !== undefined) {
          if (params.page === 1) {
            state.branchwise = response.branchwise;
            state.allItems = response.branchwise;
          } else {
            state.branchwise = [...state.branchwise, ...response.branchwise];
            state.allItems = [...state.allItems, ...response.branchwise];
          }
          state.total = response.total;
          state.totalItems = response.total;
          state.page = response.page;
          state.currentPage = response.page;
          state.limit = response.limit;
          state.totalPages = Math.ceil(response.total / response.limit);
          state.totalCurrentSystemQty = response.totalCurrentSystemQty;
          state.hasMoreData = state.allItems.length < response.total;

          // Reset main loading flags only for table fetches
          state.loading = false;
          state.isLoadingMore = false;
        } else if (isFilterOnly) {
          // Filter-only: just clear filter loading flags
          state.filterOptions.category.loading = false;
          state.filterOptions.subCategory.loading = false;
          state.filterOptions.itemName.loading = false;
          state.filterOptions.varianceName.loading = false;
        }
      })

      // ─────────────────────────────────────────────────────────────
      // fetchItems.rejected
      // ─────────────────────────────────────────────────────────────
      .addCase(fetchItems.rejected, (state, action) => {
        const params = action.meta.arg;
        const isFilterOnly = !!params.only_filter_options;

        if (!isFilterOnly) {
          if (params.page === 1) state.loading = false;
          else if (params.page && params.page > 1) state.isLoadingMore = false;
        }

        state.error = action.error.message || "Failed to fetch items";
        state.filterOptions.category.loading = false;
        state.filterOptions.subCategory.loading = false;
        state.filterOptions.itemName.loading = false;
        state.filterOptions.varianceName.loading = false;

        if (params.categoryPage) state.filterOptions.category.hasMore = false;
        if (params.subCategoryPage) state.filterOptions.subCategory.hasMore = false;
        if (params.itemNamePage) state.filterOptions.itemName.hasMore = false;
        if (params.varianceNamePage) state.filterOptions.varianceName.hasMore = false;
      })

      .addCase(approveItem.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(approveItem.fulfilled, (state, action) => {
        state.loading = false;
        const updatedItem = action.payload.item;
        if (!updatedItem) return;
        state.allItems = state.allItems.map((item) =>
          item.itemCode === updatedItem.itemCode ? { ...item, ...updatedItem } : item
        );
      })
      .addCase(approveItem.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || "Failed to approve item";
      })
      .addCase(fetchApprovedItems.pending, (state, action) => {
        const { isLoadMore } = action.meta.arg;
        if (isLoadMore) state.approvedItems.isLoadingMore = true;
        else state.approvedItems.loading = true;
        state.approvedItems.error = null;
      })
      .addCase(fetchApprovedItems.fulfilled, (state, action) => {
        const { data, page, limit, total } = action.payload;
        const { isLoadMore } = action.meta.arg;
        if (isLoadMore) {
          state.approvedItems.items = [...state.approvedItems.items, ...data];
          state.approvedItems.isLoadingMore = false;
        } else {
          state.approvedItems.items = data;
          state.approvedItems.loading = false;
        }
        state.approvedItems.page = page;
        state.approvedItems.limit = limit;
        state.approvedItems.total = total;
        state.approvedItems.hasMore = data.length >= limit;
      })
      .addCase(fetchApprovedItems.rejected, (state, action) => {
        const { isLoadMore } = action.meta.arg;
        if (isLoadMore) state.approvedItems.isLoadingMore = false;
        else state.approvedItems.loading = false;
        state.approvedItems.error = action.payload?.message || "Failed to load approved items";
      });
  },
});

// ================== Export Actions ==================
export const {
  resetData, setSelectedLocation, setEditableRows, setChanges, setVisibleColumns, toggleColumn, setFilterSearch,
  clearFilterSearch, setSort, clearSort, setOpenFirstDialog, setOpenAdjustmentDialog, setOpenApproveDialog,
  setSelectedItem, setSelectedApproveItem, setAdjustmentReason, setAdjustedPhysicalStock, setApproveDescription,
  setOpenSnackbar, setSnackbarMessage, setCurrentPage, setHasMoreData, setAllItems, setTotalItems, setTotalPages,
  setIsLoadingMore, setIsFullScreen, setTableView, setSearchParams, setApprovedItemsFilters, setApprovedItemsPage,
  resetApprovedItems, setApprovedItemsHasMore, setApprovedItemsIsLoadingMore, appendApprovedItems, resetApprovedItemsPagination,
  setDataLoading,
} = dataSlice.actions;

// ================== Selectors ==================
export const selectBranches = (state: { data: DataState }) => state.data.branches;
export const selectItems = (state: { data: DataState }) => state.data.branchwise;
export const selectUpdatedStocks = (state: { data: DataState }) => state.data.updatedStocks;
export const selectStockAdjustments = (state: { data: DataState }) => state.data.stockAdjustments;
export const selectDataLoading = (state: { data: DataState }) => state.data.loading;
export const selectDataError = (state: { data: DataState }) => state.data.error;
export const selectEditableRows = (state: { data: DataState }) => state.data.editableRows;
export const selectChanges = (state: { data: DataState }) => state.data.changes;
export const selectSelectedLocation = (state: { data: DataState }) => state.data.selectedLocation;
export const selectFilterOptions = (state: { data: DataState }) => state.data.filterOptions;
export const selectVisibleColumns = (state: { data: DataState }) => state.data.visibleColumns;
export const selectTotalCurrentSystemQty = (state: { data: DataState }) => state.data.totalCurrentSystemQty;
export const selectSortField = (state: { data: DataState }) => state.data.sortField;
export const selectSortOrder = (state: { data: DataState }) => state.data.sortOrder;
export const selectOpenFirstDialog = (state: { data: DataState }) => state.data.openFirstDialog;
export const selectOpenAdjustmentDialog = (state: { data: DataState }) => state.data.openAdjustmentDialog;
export const selectOpenApproveDialog = (state: { data: DataState }) => state.data.openApproveDialog;
export const selectSelectedItem = (state: { data: DataState }) => state.data.selectedItem;
export const selectSelectedApproveItem = (state: { data: DataState }) => state.data.selectedApproveItem;
export const selectAdjustmentReason = (state: { data: DataState }) => state.data.adjustmentReason;
export const selectAdjustedPhysicalStock = (state: { data: DataState }) => state.data.adjustedPhysicalStock;
export const selectApproveDescription = (state: { data: DataState }) => state.data.approveDescription;
export const selectOpenSnackbar = (state: { data: DataState }) => state.data.openSnackbar;
export const selectSnackbarMessage = (state: { data: DataState }) => state.data.snackbarMessage;
export const selectCurrentPage = (state: { data: DataState }) => state.data.currentPage;
export const selectHasMoreData = (state: { data: DataState }) => state.data.hasMoreData;
export const selectAllItems = (state: { data: DataState }) => state.data.allItems;
export const selectTotalItems = (state: { data: DataState }) => state.data.totalItems;
export const selectTotalPages = (state: { data: DataState }) => state.data.totalPages;
export const selectIsLoadingMore = (state: { data: DataState }) => state.data.isLoadingMore;
export const selectIsFullScreen = (state: { data: DataState }) => state.data.isFullScreen;
export const selectTableView = (state: { data: DataState }) => state.data.tableView;
export const selectSearchParams = (state: { data: DataState }) => state.data.searchParams;
export const selectApprovedItems = (state: { data: DataState }) => state.data.approvedItems.items;
export const selectApprovedItemsPage = (state: { data: DataState }) => state.data.approvedItems.page;
export const selectApprovedItemsLimit = (state: { data: DataState }) => state.data.approvedItems.limit;
export const selectApprovedItemsTotal = (state: { data: DataState }) => state.data.approvedItems.total;
export const selectApprovedItemsLoading = (state: { data: DataState }) => state.data.approvedItems.loading;
export const selectApprovedItemsError = (state: { data: DataState }) => state.data.approvedItems.error;
export const selectApprovedItemsFilters = (state: { data: DataState }) => state.data.approvedItems.filters;
export const selectApprovedItemsHasMore = (state: { data: DataState }) => state.data.approvedItems.hasMore;
export const selectApprovedItemsIsLoadingMore = (state: { data: DataState }) => state.data.approvedItems.isLoadingMore;

export default dataSlice.reducer;