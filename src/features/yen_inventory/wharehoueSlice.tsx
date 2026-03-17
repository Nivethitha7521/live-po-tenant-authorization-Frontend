
import axios, { AxiosError } from "axios";
import { RootState } from "@/redux/store";
import {
  createSlice,
  createAsyncThunk,
  PayloadAction,
} from "@reduxjs/toolkit";

import purchaseApi from "@/utils/api";
/* ---------- HELPERS ---------- */


interface FilterOption {
  values: string[];
  total: number;
  page: number;
  limit: number;
  count: number;
  searchFilter: string | null;
  hasMore: boolean;
  loading: boolean;
}

export interface Warehouse {
  locationId: string;
  locationName: string;
  aliasName: string;
}

export interface RawMaterial {
  randomId: string;
  category: string;
  subcategory: string;
  itemName: string;
  varianceName?: string;
  itemCode?: string;
  stockQuantity: number;
  systemStockSo: number;
  physicalStock: number;
  previousSystemStock: number;
}

interface FilterOptionsResponse {
  categories: FilterOption;
  subcategories: FilterOption;
  itemNames: FilterOption;
  varianceNames: FilterOption;
}

interface SearchRawMaterialsResponse {
  results: RawMaterial[];
  total: number;
  page: number;
  limit: number;
  dropdown_values: FilterOptionsResponse;
}

export interface UpdateStockRequestPayload {
  randomId: string;
  warehouseId: string;
  physicalStock: number;
  updatedBy: string;
  description: string;
}

interface ImportStockResponse {
  message: string;
  locationId: string;
  totalRows: number;
  updated: number;
  skipped: number;
}

/* ---------- STATE ---------- */
export interface RawMaterialsState {
  filterOptions: FilterOptionsResponse;
  filteredRawMaterials: {
    total: number;
    page: number;
    limit: number;
    count: number;
    items: RawMaterial[];
    hasMore: boolean;
  } | null;
  accumulatedRawMaterials: RawMaterial[];
  warehouses: Warehouse[];
  warehousesLoading: boolean;
  loading: boolean;
  error: string | null;
  filters: {
    page: number;
    limit: number;
    locationId: string;
    aliasName: string;
    purchasecategoryName?: string | string[];
    purchasesubcategoryName?: string | string[];
    itemName?: string | string[];
    varianceName?: string | string[];
    createdDate?: string;
    categorySearch?: string;
    subCategorySearch?: string;
    itemNameSearch?: string;
    varianceNameSearch?: string;
    categoryPage: number;
    categoryLimit: number;
    subCategoryPage: number;
    subCategoryLimit: number;
    itemNamePage: number;
    itemNameLimit: number;
    varianceNamePage: number;
    varianceNameLimit: number;
    includeDropdowns: boolean;
  };
  lastFetchParams: string;
  openSnackbar: boolean;
  openDownloadDialog: boolean;
  editMessage: string;
  openDialog: boolean;
  openModal: boolean;
  updatedStocks: {
    itemName: string;
    newValue: number;
    varianceName?: string;
    randomId: string;
    systemStock: number;
    locationId: string;
  }[];
  changes: {
    itemName: string;
    newValue: number;
    varianceName: string;
    randomId: string;
    systemStock: number;
    locationId: string;
  }[];
  changedRows: Record<string, boolean>;
}

/* ---------- INITIAL STATE ---------- */
const initialFilterOption: FilterOption = {
  values: [],
  total: 0,
  page: 1,
  limit: 50,
  count: 0,
  searchFilter: null,
  hasMore: true,
  loading: false,
};

const initialState: RawMaterialsState = {
  filterOptions: {
    categories: initialFilterOption,
    subcategories: initialFilterOption,
    itemNames: initialFilterOption,
    varianceNames: initialFilterOption,
  },
  filteredRawMaterials: null,
  accumulatedRawMaterials: [],
  warehouses: [],
  warehousesLoading: false,
  loading: false,
  error: null,
  filters: {
    page: 1,
    limit: 30,
    locationId: "",
    aliasName: '',
    createdDate: '',
    categoryPage: 1,
    categoryLimit: 50,
    subCategoryPage: 1,
    subCategoryLimit: 50,
    itemNamePage: 1,
    itemNameLimit: 50,
    varianceNamePage: 1,
    varianceNameLimit: 50,
    includeDropdowns: true,
  },
  lastFetchParams: "",
  openSnackbar: false,
  openDownloadDialog: false,
  editMessage: "",
  openDialog: false,
  openModal: false,
  updatedStocks: [],
  changes: [],
  changedRows: {},
};

interface AxiosErrorResponseData {
  detail?: string | Array<{ type: string; loc: string[]; msg: string; input: unknown }>;
  message?: string;
  [key: string]: unknown;
}

interface AxiosErrorPayload {
  message: string;
  status: number | null;
  raw?: unknown;
}

export const parseAxiosError = (err: AxiosError): AxiosErrorPayload => {
  const data = err.response?.data as AxiosErrorResponseData | undefined;
  let message: string;
  if (data && typeof data === "object") {
    if (Array.isArray(data.detail)) {
      message = data.detail
        .map((e) => `${e.loc.join(".")}: ${e.msg}`)
        .join("; ");
    } else if (typeof data.detail === "string") {
      message = data.detail;
    } else if (data.message) {
      message = data.message;
    } else {
      message = err.message ?? "Unknown error";
    }
  } else {
    message = err.message ?? "Unknown error";
  }
  return { message, status: err.response?.status ?? null, raw: data ?? null };
};

/* ---------- HELPER: Validate and convert to valid integer ---------- */
const toValidInteger = (value: unknown, defaultValue: number): number => {
  if (value === null || value === undefined || value === "") {
    return defaultValue;
  }

  const num = Number(value);

  // Check if it's NaN or not a finite number
  if (isNaN(num) || !isFinite(num)) {
    return defaultValue;
  }

  // Return integer
  return Math.floor(num);
};

/* ---------- THUNKS ---------- */
export const fetchWarehouses = createAsyncThunk<
  Warehouse[],
  { page?: number; limit?: number; search?: string },
  { rejectValue: AxiosErrorPayload }
>("rawMaterials/fetchWarehouses", async ({ page = 1, limit = 30, search }, { rejectWithValue }) => {
  try {
    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("limit", limit.toString());
    if (search) params.append("search", search);

    const { data } = await purchaseApi.get<Warehouse[]>(`/outletinventory/locations/all`, {
      params,
      timeout: 15000,
    });
    return data;
  } catch (e) {
    const err = e as AxiosError;
    if (err.code === "ECONNABORTED")
      return rejectWithValue({ message: "Request timeout", status: 408 });
    return rejectWithValue(parseAxiosError(err));
  }
});

export interface FetchRawMaterialsArg {
  params?: Partial<RawMaterialsState["filters"]>;
  field?: keyof FilterOptionsResponse;
  append?: boolean;
  page?: number;
  skipCache?: boolean;
  isFilterRequest?: boolean;
}

export const fetchRawMaterials = createAsyncThunk<
  {
    data: SearchRawMaterialsResponse;
    field?: keyof FilterOptionsResponse;
    append?: boolean;
    params: string;
    isFilterRequest?: boolean;
  },
  FetchRawMaterialsArg,
  { state: RootState; rejectValue: AxiosErrorPayload }
>(
  "rawMaterials/fetchRawMaterials",
  async (arg, { getState, rejectWithValue }) => {
    const state = getState() as { rawMaterials: RawMaterialsState };
    let params = { ...state.rawMaterials.filters };
    let field: keyof FilterOptionsResponse | undefined;
    let append = false;
    let skipCache = false;
    let isFilterRequest = false;

    if (arg) {
      const {
        params: p,
        field: f,
        append: a,
        page,
        skipCache: sc,
        isFilterRequest: ifr,
      } = arg;
      field = f;
      append = a ?? false;
      skipCache = sc ?? false;
      isFilterRequest = ifr ?? false;
      if (p) params = { ...params, ...p };
      if (page !== undefined) params.page = page;
    }

    const paramsKey = JSON.stringify({ ...params, field });
    if (
      !isFilterRequest &&
      !skipCache &&
      state.rawMaterials.lastFetchParams === paramsKey &&
      !field
    ) {
      return rejectWithValue({ message: "Duplicate request", status: 409 });
    }


    const clean: Record<string, string | number | boolean | string[]> = {};
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null) return;

      // Handle includeDropdowns as boolean
      if (k === "includeDropdowns") {
        clean[k] = Boolean(v);
        return;
      }

      // Only join arrays for main filters
      if (
        [
          "purchasecategoryName",
          "purchasesubcategoryName",
          "itemName",
          "varianceName",
          "locationId",
          "createdDate",
        ].includes(k)
      ) {
        if (Array.isArray(v) && v.length) clean[k] = v.join(",");
        else if (typeof v === "string" && v.trim()) clean[k] = v;
      }
      // For pagination/search params, validate and ensure valid integers
      else if (
        [
          "categoryPage",
          "categoryLimit",
          "subCategoryPage",
          "subCategoryLimit",
          "itemNamePage",
          "itemNameLimit",
          "varianceNamePage",
          "varianceNameLimit",
          "page",
          "limit",
        ].includes(k)
      ) {
        const defaultValue = k.includes("Page") ? 1 : 10;
        clean[k] = toValidInteger(v, defaultValue);
      }
      // Include search parameters for dropdowns
      else if (
        [
          "categorySearch",
          "subCategorySearch",
          "itemNameSearch",
          "varianceNameSearch",
        ].includes(k)
      ) {
        if (typeof v === "string" && v.trim()) clean[k] = v.trim();
      }
      else {
        clean[k] = v;
      }
    });

    try {
      const { data } = await purchaseApi.get<SearchRawMaterialsResponse>(
        `/warehouseinventory/`,
        { params: clean, timeout: 30000 }
      );

      return { data, field, append, params: paramsKey, isFilterRequest };
    } catch (e) {
      const err = e as AxiosError;
      return rejectWithValue(parseAxiosError(err));
    }
  }
);

export const updateRawMaterialStock = createAsyncThunk<
  { randomId: string; physicalStock: number },
  UpdateStockRequestPayload,
  { state: RootState; rejectValue: AxiosErrorPayload }
>(
  "rawMaterials/updateRawMaterialStock",
  async (payload, { getState, rejectWithValue }) => {
    const { randomId, warehouseId, physicalStock, updatedBy, description } =
      payload;

    if (!randomId || typeof physicalStock !== "number" || physicalStock < 0)
      return rejectWithValue({
        message:
          "Invalid payload: randomId + non-negative physicalStock required",
        status: 400,
      });
    if (!warehouseId)
      return rejectWithValue({
        message: "warehouseId is required",
        status: 400,
      });
    try {
      await purchaseApi.patch(
        `/warehouseinventory/inventory`,
        {
          randomId,
          warehouseId: warehouseId,
          physicalStock,
        },
        {
          params: {
            updated_by: updatedBy,
            description,
          },
          timeout: 15000,
        }
      );

      return { randomId, physicalStock };
    } catch (e) {
      const err = e as AxiosError;
      return rejectWithValue(parseAxiosError(err));
    }
  }
);

interface ExportCSVPayload {
  locationId: string;
  aliasName?: string;

  purchasecategoryName?: string;
  purchasesubcategoryName?: string;
  itemName?: string;
  varianceName?: string;
}


export const downloadExportCSV = createAsyncThunk<void, ExportCSVPayload>(
  "rawMaterials/downloadExportCSV",
  async ({ locationId, aliasName, purchasecategoryName, purchasesubcategoryName, itemName, varianceName }) => {
    const params = new URLSearchParams();
    params.append("locationId", locationId);

    if (purchasecategoryName) params.append("purchasecategoryName", purchasecategoryName);
    if (purchasesubcategoryName) params.append("purchasesubcategoryName", purchasesubcategoryName);
    if (itemName) params.append("itemName", itemName);
    if (varianceName) params.append("varianceName", varianceName);

    const url = `}/warehouseinventory/export?${params.toString()}`;
    const response = await purchaseApi.get(url, { responseType: "blob" });

    const blob = new Blob([response.data], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);

    //  NEW filename logic
    const today = new Date();
    const dateString = `${today.getDate().toString().padStart(2, "0")}-${(today.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${today.getFullYear()}`;

    const alias = aliasName || `warehouse_${locationId}`;
    let filename = `${alias}_Warehousestock_${dateString}.csv`;

    // If server sends filename, use it
    const contentDisposition = response.headers["content-disposition"];
    const match = contentDisposition?.match(/filename="(.+)"/);
    if (match?.[1]) filename = match[1];

    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
);



export const downloadSampleCSV = createAsyncThunk<void>(
  "rawMaterials/downloadSampleCSV",
  async () => {
    const url = `/warehouseinventory/export/sample`;
    const response = await purchaseApi.get(url, { responseType: "blob" });
    const blob = new Blob([response.data], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);

    // Extract filename from headers
    const contentDisposition = response.headers["content-disposition"];
    let filename = "sample_rmstock.csv";
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/);
      if (match?.[1]) filename = match[1];
    }

    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
);

export interface ImportStockPayload {
  file: File;
  locationId: string;
  updated_by?: string;
}

export const importRawMaterialStock = createAsyncThunk<
  ImportStockResponse,
  ImportStockPayload,
  { rejectValue: AxiosErrorPayload }
>(
  "rawMaterials/importRawMaterialStock",
  async (payload, { rejectWithValue }) => {
    const { file, locationId, updated_by = "" } = payload;
    const formData = new FormData();
    formData.append("file", file);

    try {
      const { data } = await purchaseApi.post(
        `/warehouseinventory/importstocks?locationId=${locationId}&updated_by=${encodeURIComponent(updated_by)}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 60000
        }
      );
      return data;
    } catch (e) {
      const err = e as AxiosError;
      return rejectWithValue(parseAxiosError(err));
    }
  }
);

export const createInventoryStock = createAsyncThunk<
  { randomId: string; physicalStock: number },
  UpdateStockRequestPayload,
  { rejectValue: AxiosErrorPayload }
>(
  "rawMaterials/createInventoryStock",
  async (payload, { rejectWithValue }) => {
    const { randomId, warehouseId, physicalStock, updatedBy, description } = payload;

    if (!randomId || typeof physicalStock !== "number" || physicalStock < 0)
      return rejectWithValue({
        message:
          "Invalid payload: randomId + non-negative physicalStock required",
        status: 400,
      });
    if (!warehouseId || !updatedBy)
      return rejectWithValue({
        message: "locationId and updatedBy are required",
        status: 400,
      });

    try {
      await purchaseApi.post(
        `/warehouseinventory/inventory`,
        {
          randomId,
          warehouseId,
          physicalStock,
        },
        {
          params: {
            updated_by: updatedBy,
            description: description || "Initial stock created",
          },
          timeout: 15000,
        }
      );

      return { randomId, physicalStock };
    } catch (e) {
      const err = e as AxiosError;
      return rejectWithValue(parseAxiosError(err));
    }
  }
);
export interface UpdateStockBulkPayload {
  warehouseId: string;
  updates: {
    randomId: string;
    physicalStock: number;
  }[];
}

export const updateRawMaterialsBulk = createAsyncThunk<
  { updated: number },
  UpdateStockBulkPayload,
  { rejectValue: AxiosErrorPayload }
>(
  "rawMaterials/updateRawMaterialsBulk",
  async (payload, { rejectWithValue }) => {
    const { warehouseId, updates } = payload;

    if (!warehouseId || !updates.length)
      return rejectWithValue({
        message: "locationId and updates are required",
        status: 400,
      });

    try {
      const { data } = await purchaseApi.patch(
        `/warehouseinventory/inventory/bulk`,
        {
          updates: updates.map((u) => ({
            randomId: u.randomId,
            warehouseId: warehouseId,
            physicalStock: u.physicalStock,
          })),
        },
        {
          params: {
            updated_by: "",
            description: "",
          },
          timeout: 30000,
        }
      );

      return { updated: data.updated ?? updates.length };
    } catch (e) {
      const err = e as AxiosError;
      return rejectWithValue(parseAxiosError(err));
    }
  }
);


/* ---------- SLICE ---------- */
const rawMaterialsSlice = createSlice({
  name: "rawMaterials",
  initialState,
  reducers: {
    setFilter<K extends keyof RawMaterialsState["filters"]>(
      state: RawMaterialsState,
      action: PayloadAction<{ key: K; value: RawMaterialsState["filters"][K] }>
    ) {
      const { key, value } = action.payload;

      // -----------------------
      // Update alias when location changes
      // -----------------------
      if (key === "locationId") {
        state.filters.locationId = value as string;

        const warehouse = state.warehouses.find(w => w.locationId === value);
        state.filters.aliasName = warehouse?.aliasName || "";
      }
      // Validate numeric values before setting
      if (
        [
          "page",
          "limit",
          "categoryPage",
          "categoryLimit",
          "subCategoryPage",
          "subCategoryLimit",
          "itemNamePage",
          "itemNameLimit",
          "varianceNamePage",
          "varianceNameLimit",
        ].includes(key)
      ) {
        const defaultValue = key.includes("Page") ? 1 : 10;
        const numericValue = toValidInteger(value, defaultValue);
        state.filters[key] = numericValue as RawMaterialsState["filters"][K];
      } else {
        state.filters[key] = value;
      }

      // When search changes, reset the page for that dropdown
      if (key.includes("Search")) {
        if (key === "categorySearch") {
          state.filters.categoryPage = 1;
        } else if (key === "subCategorySearch") {
          state.filters.subCategoryPage = 1;
        } else if (key === "itemNameSearch") {
          state.filters.itemNamePage = 1;
        } else if (key === "varianceNameSearch") {
          state.filters.varianceNamePage = 1;
        }
      }

      // Reset accumulation when changing main filters (not search/page/limit)
      if (
        key !== "page" &&
        !key.includes("Page") &&
        !key.includes("Search") &&
        !key.includes("Limit") &&
        key !== "includeDropdowns"
      ) {
        state.accumulatedRawMaterials = [];
        state.filteredRawMaterials = null;
        state.filters.page = 1;
        state.lastFetchParams = "";

        // Reset dropdown pages when changing selections
        state.filters.categoryPage = 1;
        state.filters.subCategoryPage = 1;
        state.filters.itemNamePage = 1;
        state.filters.varianceNamePage = 1;
      }
    },
    clearAllFilters(state) {
      // Clear main selection filters
      state.filters.purchasecategoryName = undefined;
      state.filters.purchasesubcategoryName = undefined;
      state.filters.itemName = undefined;
      state.filters.varianceName = undefined;

      // Clear dropdown searches
      state.filters.categorySearch = undefined;
      state.filters.subCategorySearch = undefined;
      state.filters.itemNameSearch = undefined;
      state.filters.varianceNameSearch = undefined;

      // Reset dropdown pagination
      state.filters.categoryPage = 1;
      state.filters.subCategoryPage = 1;
      state.filters.itemNamePage = 1;
      state.filters.varianceNamePage = 1;

      // Reset table pagination
      state.filters.page = 1;

      // Reset data
      state.accumulatedRawMaterials = [];
      state.filteredRawMaterials = null;
      state.lastFetchParams = "";
    },

    resetRawMaterials(state) {
      state.accumulatedRawMaterials = [];
      state.filteredRawMaterials = null;
      state.lastFetchParams = "";
      state.error = null;

      state.filters.page = 1;

      state.filters.categoryPage = 1;
      state.filters.subCategoryPage = 1;
      state.filters.itemNamePage = 1;
      state.filters.varianceNamePage = 1;

      // DO NOT reset warehouse or main filters
    },
    setImportMessage(state, action: PayloadAction<string>) {
      state.editMessage = action.payload;
      state.openSnackbar = true;
    },

    setOpenSnackbar(state, action: PayloadAction<boolean>) {
      state.openSnackbar = action.payload;
    },
    setOpenDownloadDialog(state, action: PayloadAction<boolean>) {
      state.openDownloadDialog = action.payload;
    },
    setEditMessage(state, action: PayloadAction<string>) {
      state.editMessage = action.payload;
    },
    setOpenDialog(state, action: PayloadAction<boolean>) {
      state.openDialog = action.payload;
    },
    setOpenModal(state, action: PayloadAction<boolean>) {
      state.openModal = action.payload;
    },
    setUpdatedStocks(
      state,
      action: PayloadAction<RawMaterialsState["updatedStocks"]>
    ) {
      state.updatedStocks = action.payload;
    },
    setChanges(state, action: PayloadAction<RawMaterialsState["changes"]>) {
      state.changes = action.payload;
    },
    setChangedRows(
      state,
      action: PayloadAction<Record<string, boolean>>
    ) {
      state.changedRows = action.payload;
    },
  },

  extraReducers: (builder) => {
    /* ----- Warehouses ----- */
    builder
      .addCase(fetchWarehouses.pending, (state) => {
        state.warehousesLoading = true;
        state.error = null;
      })
      .addCase(fetchWarehouses.fulfilled, (state, action) => {
        state.warehousesLoading = false;
        state.warehouses = Array.isArray(action.payload) ? action.payload : [];

        // Set default warehouse if none selected
        if (action.payload.length && !state.filters.locationId) {
          const first = action.payload[0];
          state.filters.locationId = first.locationId;
          state.filters.aliasName = first.aliasName || "";
        }

        // Sync aliasName if locationId already exists
        if (state.filters.locationId) {
          const selected = action.payload.find(
            (w) => w.locationId === state.filters.locationId
          );
          if (selected) {
            state.filters.aliasName = selected.aliasName || "";
          }
        }
      })

      .addCase(fetchWarehouses.rejected, (state, action) => {
        state.warehousesLoading = false;
        state.warehouses = [];
        state.error =
          (action.payload as AxiosErrorPayload)?.message ||
          "Failed to fetch warehouses";
      });

    /* ----- Raw Materials (table + bidirectional dropdowns) ----- */
    builder
      .addCase(fetchRawMaterials.pending, (state, action) => {
        const field = action.meta.arg?.field;
        if (!field) state.loading = true;
        else state.filterOptions[field].loading = true;
        state.error = null;
      })
      .addCase(fetchRawMaterials.fulfilled, (state, action) => {
        const { data, field, append } = action.payload;
        state.loading = false;
        state.lastFetchParams = action.payload.params;

        // Handle case where dropdown_values might be null
        if (!field && !data.dropdown_values && data.results) {
          // If no dropdown values but we have results, just update the table
          const newItems = Array.isArray(data.results) ? data.results : [];
          const total = data.total ?? newItems.length;

          if (append && newItems.length && state.accumulatedRawMaterials.length) {
            const existingIds = new Set(
              state.accumulatedRawMaterials.map((i) => i.randomId)
            );
            const uniques = newItems.filter(
              (i: RawMaterial) => !existingIds.has(i.randomId)
            );
            state.accumulatedRawMaterials = [
              ...state.accumulatedRawMaterials,
              ...uniques,
            ];
          } else {
            state.accumulatedRawMaterials = newItems;
          }

          const count = state.accumulatedRawMaterials.length;
          state.filteredRawMaterials = {
            total,
            page: data.page ?? state.filters.page,
            limit: data.limit ?? state.filters.limit,
            count,
            items: state.accumulatedRawMaterials,
            hasMore: count < total,
          };
          state.filters.page = data.page ?? state.filters.page;
          return;
        }

        /* ---------- SINGLE FIELD (dropdown scroll / search) ---------- */
        if (field && data.dropdown_values) {
          const fd = data.dropdown_values[field];
          const currentValues = state.filterOptions[field].values;
          const isFilterRequest = action.payload.isFilterRequest;

          // For search, replace values (don't append)
          // For scroll/pagination, merge unique values
          const newValues = append && !isFilterRequest
            ? Array.from(new Set([...currentValues, ...fd.values]))
            : fd.values;

          state.filterOptions[field] = {
            ...fd,
            values: newValues,
            loading: false,
            hasMore: fd.hasMore,
            searchFilter: fd.searchFilter,
          };
        } else if (data.dropdown_values) {
          /* ---------- MAIN TABLE FETCH (ALL dropdowns updated bidirectionally) ---------- */
          const fields: (keyof FilterOptionsResponse)[] = [
            "categories",
            "subcategories",
            "itemNames",
            "varianceNames",
          ];

          // Update ALL dropdowns with bidirectional filtered values
          fields.forEach((f) => {
            const fd = data.dropdown_values[f];
            const currentValues = state.filterOptions[f].values;

            // For initial load or non-append, replace values
            // For append (pagination), merge values
            const newValues = append && currentValues.length > 0
              ? Array.from(new Set([...currentValues, ...fd.values]))
              : fd.values;

            state.filterOptions[f] = {
              ...fd,
              values: newValues,
              loading: false,
              hasMore: fd.hasMore,
              searchFilter: fd.searchFilter || state.filterOptions[f].searchFilter,
            };
          });

          /* ---------- TABLE DATA ---------- */
          const newItems = Array.isArray(data.results) ? data.results : [];
          const total = data.total ?? newItems.length;

          if (append && newItems.length && state.accumulatedRawMaterials.length) {
            // Append mode: merge unique items
            const existingIds = new Set(
              state.accumulatedRawMaterials.map((i) => i.randomId)
            );
            const uniques = newItems.filter(
              (i: RawMaterial) => !existingIds.has(i.randomId)
            );
            state.accumulatedRawMaterials = [
              ...state.accumulatedRawMaterials,
              ...uniques,
            ];
          } else {
            // Replace mode
            state.accumulatedRawMaterials = newItems;
          }

          const count = state.accumulatedRawMaterials.length;
          state.filteredRawMaterials = {
            total,
            page: data.page ?? state.filters.page,
            limit: data.limit ?? state.filters.limit,
            count,
            items: state.accumulatedRawMaterials,
            hasMore: count < total,
          };
          state.filters.page = data.page ?? state.filters.page;
        }
      })
      .addCase(fetchRawMaterials.rejected, (state, action) => {
        state.loading = false;
        const payload = action.payload as AxiosErrorPayload;
        if (payload?.status !== 409) {
          state.error = payload?.message ?? "Failed to fetch raw materials";
        }
        const field = action.meta.arg?.field;
        if (field) state.filterOptions[field].loading = false;
        else
          (Object.keys(state.filterOptions) as (keyof FilterOptionsResponse)[]).forEach(
            (k) => (state.filterOptions[k].loading = false)
          );
      });

    /* ----- Stock Update ----- */
    builder
      .addCase(updateRawMaterialStock.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateRawMaterialStock.fulfilled, (state, action) => {
        state.loading = false;
        const { randomId, physicalStock } = action.payload;
        const idx = state.accumulatedRawMaterials.findIndex(
          (i) => i.randomId === randomId
        );
        if (idx > -1) {
          state.accumulatedRawMaterials[idx].stockQuantity = physicalStock;
          state.accumulatedRawMaterials[idx].physicalStock = physicalStock;
        }
      })
      .addCase(updateRawMaterialStock.rejected, (state, action) => {
        state.loading = false;
        const p = action.payload as AxiosErrorPayload;
        state.error = p?.message ?? "Failed to update stock";
        state.editMessage = p?.message ?? "Failed to update stock";
        state.openSnackbar = true;
      });

    /* ----- Create Inventory Stock ----- */
    builder
      .addCase(createInventoryStock.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createInventoryStock.fulfilled, (state, action) => {
        state.loading = false;
        const { randomId, physicalStock } = action.payload;
        state.editMessage = "Inventory stock created successfully";
        state.openSnackbar = true;
      })
      .addCase(createInventoryStock.rejected, (state, action) => {
        state.loading = false;
        const p = action.payload as AxiosErrorPayload;
        state.error = p?.message ?? "Failed to create inventory stock";
        state.editMessage = p?.message ?? "Failed to create inventory stock";
        state.openSnackbar = true;
      });
    builder
      .addCase(updateRawMaterialsBulk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateRawMaterialsBulk.fulfilled, (state, action) => {
        state.loading = false;
        state.editMessage = `${action.payload.updated} stock(s) updated successfully`;
        state.openSnackbar = true;
      })
      .addCase(updateRawMaterialsBulk.rejected, (state, action) => {
        state.loading = false;
        const p = action.payload as AxiosErrorPayload;
        state.error = p?.message ?? "Failed to bulk update stock";
        state.editMessage = p?.message ?? "Failed to bulk update stock";
        state.openSnackbar = true;
      });


    /* ----- Import Stock ----- */
    builder
      .addCase(importRawMaterialStock.fulfilled, (state, action) => {
        state.editMessage = action.payload.message || "Import completed successfully";
        state.openSnackbar = true;
      })
      .addCase(importRawMaterialStock.rejected, (state, action) => {
        const p = action.payload as AxiosErrorPayload;
        state.error = p?.message ?? "Failed to import stocks";
        state.editMessage = p?.message ?? "Failed to import stocks";
        state.openSnackbar = true;
      });
  },
});

/* ---------- ACTIONS ---------- */
export const {
  setFilter,
  resetRawMaterials,
  setOpenSnackbar,
  setOpenDownloadDialog,
  setEditMessage,
  clearAllFilters,
  setOpenDialog,
  setOpenModal,
  setUpdatedStocks,
  setChanges,
  setChangedRows,
  setImportMessage,
} = rawMaterialsSlice.actions;

/* ---------- SELECTORS ---------- */
export const selectRawMaterials = (state: RootState) =>
  state.rawMaterials.accumulatedRawMaterials;
export const selectRawMaterialsLoading = (state: RootState) =>
  state.rawMaterials.loading;
export const selectFilters = (state: RootState) => state.rawMaterials.filters;
export const selectFilterOptions = (state: RootState) =>
  state.rawMaterials.filterOptions;
export const selectFilteredRawMaterials = (state: RootState) =>
  state.rawMaterials.filteredRawMaterials;
export const selectError = (state: RootState) => state.rawMaterials.error;
export const selectHasMore = (state: RootState) =>
  state.rawMaterials.filteredRawMaterials?.hasMore ?? false;
export const selectWarehouses = (state: RootState) =>
  state.rawMaterials.warehouses;
export const selectWarehousesLoading = (state: RootState) =>
  state.rawMaterials.warehousesLoading;
export const selectOpenSnackbar = (state: RootState) =>
  state.rawMaterials.openSnackbar;
export const selectOpenDownloadDialog = (state: RootState) =>
  state.rawMaterials.openDownloadDialog;
export const selectEditMessage = (state: RootState) =>
  state.rawMaterials.editMessage;
export const selectOpenDialog = (state: RootState) =>
  state.rawMaterials.openDialog;
export const selectOpenModal = (state: RootState) =>
  state.rawMaterials.openModal;
export const selectUpdatedStocks = (state: RootState) =>
  state.rawMaterials.updatedStocks;
export const selectChanges = (state: RootState) => state.rawMaterials.changes;
export const selectChangedRows = (state: RootState) =>
  state.rawMaterials.changedRows;

export default rawMaterialsSlice.reducer;