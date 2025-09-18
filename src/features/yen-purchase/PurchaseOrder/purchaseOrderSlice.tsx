<<<<<<< HEAD
import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '@/redux/store'; // Adjust the import path accordingly
<<<<<<< HEAD
import { Item, PurchaseItemSearchAdd, PurchaseOrderData, PurchaseOrderState, Vendor } from '../../../Models/purchaseModel'
=======
import { createSlice, PayloadAction, createAsyncThunk, createAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '@/redux/store'; // Adjust the import path accordingly
import { Item, ItemInput, OverallDiscountResponse, PurchaseItemSearchAdd, PurchaseOrderData, PurchaseOrderState, Vendor } from '../../../Models/purchaseModel'
>>>>>>> recover-branch
=======
import { Item, ItemInput, OverallDiscountResponse, PurchaseItemSearchAdd, PurchaseOrderData, PurchaseOrderState, Vendor } from '../../../Models/purchaseModel'
>>>>>>> d185c94 (Overall disocunt amount)

export interface PurchaseItemSearch {
  purchaseitemId: string;
  itemName: string;
}

export const initialState: PurchaseOrderState = {
  purchaseOrderData: {
    purchaseOrderId: '',
    vendorName: '',
    vendorContact: '',
    orderDate: null,
    invoiceDate: null,
    invoiceNo: '',
    expectedDeliveryDate: null,
    poStatus: '',
    items: [],
    creditLimit: 0,
    totalOrderAmount: 0,
    totalDiscount: 0,
    totalTax: 0,
    discountPrice: 0,
    paymentTerms: '',
    shippingAddress: '',
    billingAddress: '',
    comments: '',
    randomId: '',
    address: '',
    country: '',
    state: '',
    city: '',
    postalCode: 0,
    gstNumber: '',
    contactpersonEmail: '',
    termsandConditions: [''],
    itemStatus: '',
    pendingOrderAmount: 0,
    pendingDiscountAmount: 0,
    pendingTaxAmount: 0,
    approvedDate: null,
    rejectedDate: null,
    poCreatedPerson: '',
    poApprovedPerson: '',
<<<<<<< HEAD
    poRejectedPerson: ''
  },
  newItem: {
    itemId: '', itemName: '', itemCode: '', quantity: 0, taxType: 'cgst_sgst', count: 0, eachQuantity: 0, pendingAfTaxDiscountAmount: 0, pendingBefTaxDiscountAmount: 0, pendingCgst: 0, pendingFinalPrice: 0, pendingIgst: 0, pendingSgst: 0, pendingTaxAmount: 0, pendingTotalPrice: 0, existingPrice: 0, newPrice: 0, sgst: 0, cgst: 0, barcode: '', afTaxDiscount: 0, befTaxDiscount: 0, afTaxDiscountAmount: 0, befTaxDiscountAmount: 0, uom: '', taxPercentage: 0, igst: 0, totalPrice: 0,
=======
    poRejectedPerson: '',
    discountMode: 'percentage',
    roundOffValue: 0,
    overallDiscountValue: 0
  },
  newItem: {
    itemId: '',
    itemName: '',
    itemCode: '',
    quantity: 0,
    taxType: 'cgst_sgst',
    count: 0,
    eachQuantity: 0,
    pendingAfTaxDiscountAmount: 0,
    pendingBefTaxDiscountAmount: 0,
    pendingCgst: 0,
    pendingFinalPrice: 0,
    pendingIgst: 0,
    pendingSgst: 0,
    pendingTaxAmount: 0,
    pendingTotalPrice: 0,
    existingPrice: 0,
    newPrice: 0,
    sgst: 0,
    cgst: 0,
    barcode: '',
    afTaxDiscount: 0,
    befTaxDiscount: 0,
    afTaxDiscountAmount: 0,
    befTaxDiscountAmount: 0,
    uom: '',
    taxPercentage: 0,
    igst: 0,
    totalPrice: 0,
>>>>>>> recover-branch
    receivedQuantity: 0,
    damagedQuantity: 0,
    discountAmount: 0,
    taxAmount: 0,
    finalPrice: 0,
    purchasecategoryName: '',
    purchasesubcategoryName: undefined,
    hsnCode: '',
    status: '',
    pendingCount: 0,
    pendingQuantity: 0,
    pendingTotalQuantity: 0,
    pendingDiscountAmount: 0,
    poQuantity: 0,
    expiryDate: null,
<<<<<<< HEAD
    priceVariance: 0
=======
    priceVariance: 0,
    befTaxDiscountType: 'percentage',
    afTaxDiscountType: 'percentage',
>>>>>>> recover-branch
  },
  purchaseorderitems: [],
  vendors: [],
  purchaseitems: [],
  loading: false,
  error: null,
  successMessage: '',
  searchQuery: '',
  snackbarMessage: '',
  snackbarOpen: false,
<<<<<<< HEAD
  totalPrice: 0, // Initialize totalPrice
  totalDiscount: 0, // Initialize totalDiscount
  totalTax: 0, // Initialize totalTax
=======
  totalPrice: 0,
  totalDiscount: 0,
  totalTax: 0,
>>>>>>> recover-branch
  total: 0,
  skip: 0,
  limit: 50,
  importDuplicates: [],
  importErrors: [],
  importDialogOpen: false,
  importWarnings: [],
  importSuccessMessages: [],
<<<<<<< HEAD
  importUpdatedItems: []
=======
  importUpdatedItems: [],
  discountMode: 'percentage',
>>>>>>> recover-branch
};

let purchaseItemsCache: Map<string, { data: PurchaseItemSearchAdd[], timestamp: number }> = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

<<<<<<< HEAD
const BASE_URL = 'http://192.168.1.122:8000';
=======
const BASE_URL = 'https://yenerp.com/purchaseapi';
>>>>>>> recover-branch

export const fetchPurchaseOrders = createAsyncThunk(
  'purchaseOrder/fetchPurchaseOrders',
  async () => {
    const response = await axios.get<PurchaseOrderData[]>(`${BASE_URL}/purchaseorders/`);
    return response.data;
  }
);
export const fetchVendorByName = createAsyncThunk<Vendor | undefined, string>(
  'vendors/fetchByName',
  async (vendorName: string) => {
    try {
      const response = await axios.get<Vendor[]>('https://yenerp.com/purchaseapi/purchaseorders/vendors/');
      const vendor = response.data.find(v => v.vendorName === vendorName);
      return vendor; // Return the vendor if found, otherwise undefined
    } catch (error) {
      console.error('Failed to fetch vendor by name:', error);
      return undefined; // Return undefined in case of an error
    }
  }
);
export const fetchAllVendors = createAsyncThunk(
  'vendors/fetch',
  async (_, { getState }) => {
    const localData = localStorage.getItem('vendors');

    // If data exists in localStorage, return it
    if (localData) {
      const cachedVendors = JSON.parse(localData);
      return cachedVendors;
    }

    // If not, make the API request to fetch vendors
    const response = await axios.get<Vendor[]>(`https://yenerp.com/purchaseapi/vendors/`);

    // Store the fetched vendors in localStorage for future use
    localStorage.setItem('vendors', JSON.stringify(response.data));

    return response.data;
  }
);

// Add a new function to invalidate cache when there are updates
export const invalidatePurchaseItemsCache = () => {
  purchaseItemsCache.clear();
<<<<<<< HEAD
  console.log('Purchase items cache invalidated'); 
=======
  console.log('Purchase items cache invalidated');
>>>>>>> recover-branch
};

export const updatePurchaseItem = createAsyncThunk<PurchaseItemSearchAdd, { id: string; data: Partial<PurchaseItemSearch> }>(
  'purchaseOrder/updatePurchaseItem',
  async ({ id, data }) => {
    const response = await axios.patch<PurchaseItemSearchAdd>(`${BASE_URL}/purchaseitems/${id}`, data);
    return response.data;
  }
);
export const calculateItemTotals = createAsyncThunk(
  'purchaseOrder/calculateItemTotals',
  async (
<<<<<<< HEAD
    { pendingTotalQuantity, poQuantity, newPrice, befTaxDiscount, afTaxDiscount, taxPercentage, taxType }:
      {
        pendingTotalQuantity: number;
        poQuantity: number;
        newPrice: number;
        befTaxDiscount?: number; // Optional parameter
        afTaxDiscount?: number;  // Optional parameter
        taxPercentage: number;
        taxType: 'cgst_sgst' | 'igst'; // Tax type can be either "cgst_sgst" or "igst"
      },
    { rejectWithValue }
  ) => {
    try {
      // Only include discounts if they are defined and greater than 0
      const params = {
=======
    {
      pendingTotalQuantity,
      poQuantity,
      newPrice,
      befTaxDiscount,
      befTaxDiscountAmount,
      afTaxDiscount,
      afTaxDiscountAmount,
      taxPercentage,
      taxType,
    
    }: {
      pendingTotalQuantity: number;
      poQuantity: number;
      newPrice: number;
      befTaxDiscount?: number;
      befTaxDiscountAmount?: number;
      afTaxDiscount?: number;
      afTaxDiscountAmount?: number;
      taxPercentage: number;
      taxType: 'cgst_sgst' | 'igst';
      // Remove these from parameters
      // befTaxDiscountType?: 'percentage' | 'amount';
      // afTaxDiscountType?: 'percentage' | 'amount';
    },
    { getState, rejectWithValue }
  ) => {
    try {
      const state = getState() as { purchaseOrder: PurchaseOrderState };
      const { discountMode } = state.purchaseOrder;

      const params: any = {
>>>>>>> recover-branch
        pendingTotalQuantity,
        poQuantity,
        newPrice,
        taxPercentage,
<<<<<<< HEAD
        taxType, // Add taxType to the parameters
        ...(befTaxDiscount !== undefined && befTaxDiscount > 0 ? { befTaxDiscount } : {}),
        ...(afTaxDiscount !== undefined && afTaxDiscount > 0 ? { afTaxDiscount } : {})
      };

=======
        taxType,
        befTaxDiscountType: discountMode, // Use state discount mode
        afTaxDiscountType: discountMode,  // Use state discount mode
      };

      // Handle before-tax discount based on mode
      if (discountMode === 'percentage' && befTaxDiscount !== undefined && befTaxDiscount > 0) {
        params.befTaxDiscount = befTaxDiscount;
      } else if (discountMode === 'amount' && befTaxDiscountAmount !== undefined && befTaxDiscountAmount > 0) {
        params.befTaxDiscountAmount = befTaxDiscountAmount;
      }

      // Handle after-tax discount based on mode
      if (discountMode === 'percentage' && afTaxDiscount !== undefined && afTaxDiscount > 0) {
        params.afTaxDiscount = afTaxDiscount;
      } else if (discountMode === 'amount' && afTaxDiscountAmount !== undefined && afTaxDiscountAmount > 0) {
        params.afTaxDiscountAmount = afTaxDiscountAmount;
      }

>>>>>>> recover-branch
      const response = await axios.get<{
        pendingTotalPrice: number;
        pendingBefTaxDiscountAmount: number;
        pendingAfTaxDiscountAmount: number;
        pendingDiscountAmount: number;
        pendingTaxAmount: number;
        pendingSgst: number;
        pendingCgst: number;
        pendingIgst: number;
        pendingFinalPrice: number;
<<<<<<< HEAD
      }>(
        `${BASE_URL}/purchaseorders/items/totals`,
        { params }
      );
=======
        befTaxDiscount: number;
        afTaxDiscount: number;
        poQuantity: number;
        quantity: number;
      }>(`${BASE_URL}/purchaseorders/items/totals`, { params });
>>>>>>> recover-branch

      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'An unknown error occurred'
      );
    }
  }
);
<<<<<<< HEAD
<<<<<<< HEAD
=======
=======
>>>>>>> d185c94 (Overall disocunt amount)
export const calculateOverallDiscountForAllItems = createAsyncThunk(
  'purchaseOrder/calculateOverallDiscountForAllItems',
  async (payload: {
    items: ItemInput[];
    overallDiscountValue: number;
    overallDiscountMode: 'percentage' | 'amount';
    applyOverallDiscount: boolean;
  }): Promise<OverallDiscountResponse> => {
    try {
      const requestBody = {
        items: payload.items.map(item => ({
          id: item.id || '',
          pendingTotalQuantity: item.pendingTotalQuantity,
          poQuantity: item.poQuantity,
          newPrice: item.newPrice,
          befTaxDiscount: item.befTaxDiscount || 0,
          afTaxDiscount: item.afTaxDiscount || 0,
          befTaxDiscountAmount: item.befTaxDiscountAmount || 0,
          afTaxDiscountAmount: item.afTaxDiscountAmount || 0,
          befTaxDiscountType: item.befTaxDiscountType || 'percentage',
          afTaxDiscountType: item.afTaxDiscountType || 'percentage',
          taxPercentage: item.taxPercentage || 0,
          taxType: item.taxType || 'cgst_sgst'
        })),
        overallDiscount: payload.overallDiscountMode === 'percentage' ? payload.overallDiscountValue : 0,
        overallDiscountAmount: payload.overallDiscountMode === 'amount' ? payload.overallDiscountValue : 0,
        overallDiscountType: payload.overallDiscountMode,
        applyOverallDiscount: payload.applyOverallDiscount
      };

      const response = await fetch(`${BASE_URL}/purchaseorders/items/calculate-overall-discount`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error calculating overall discount:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        items: [],
        summary: {
          totalSubtotal: 0,
          overallDiscountTotalAmount: 0,
          overallDiscountPercentage: 0,
          totalFinalAmount: 0,
          totalTaxAmount: 0,
          totalDiscountAmount: 0,
          totalItems: 0,
        }
      };
    }
  }
);


<<<<<<< HEAD
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
export const downloadCsvTemplate = createAsyncThunk(
  'purchaseOrder/downloadCsvTemplate',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${BASE_URL}/poimport/download-csv-template`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'item_import_template.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      return 'CSV template downloaded successfully';
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to download CSV template');
    }
  }
);
// Updated importCsvItems thunk
export const importCsvItems = createAsyncThunk(
  'purchaseOrder/importCsvItems',
  async (file: File, { dispatch, rejectWithValue, getState }) => {
    try {
      const state = getState() as { purchaseOrder: PurchaseOrderState };
      const currentPurchaseOrderData = state.purchaseOrder.purchaseOrderData;

      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post(`https://yenerp.com/purchaseapi/poimport/import-items-csv`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { success, message, imported_items, duplicates_merged, errors, updated_items, warnings, success_messages } = response.data;

      if (success && imported_items.length > 0) {
        const mappedItems: Item[] = imported_items.map((item: any) => ({
          itemId: item.itemId || '',
          itemCode: item.itemCode || '',
          itemName: item.itemName || 'N/A',
          quantity: 0,
<<<<<<< HEAD
          uom:item.uom,
=======
          uom: item.uom,
>>>>>>> recover-branch
          poQuantity: item.pendingTotalQuantity || 0,
          count: item.pendingCount || 0,
          eachQuantity: item.pendingQuantity || 0,
          pendingCount: item.pendingCount || 0,
          pendingQuantity: item.pendingQuantity || 0,
          pendingTotalQuantity: item.pendingTotalQuantity || 0,
          existingPrice: item.existingPrice || 0,
          newPrice: item.newPrice || 0,
          priceVariance: item.priceVariance || 0,
          taxPercentage: Number(item.taxPercentage) || 0,
          taxType: item.taxType || 'cgst_sgst',
          befTaxDiscount: item.befTaxDiscount || 0,
          afTaxDiscount: item.afTaxDiscount || 0,
          pendingTotalPrice: item.pendingTotalPrice || 0,
          pendingTaxAmount: item.pendingTaxAmount || 0,
          pendingBefTaxDiscountAmount: item.pendingBefTaxDiscountAmount || 0,
          pendingAfTaxDiscountAmount: item.pendingAfTaxDiscountAmount || 0,
          pendingCgst: item.pendingCgst || 0,
          pendingSgst: item.pendingSgst || 0,
          pendingIgst: item.pendingIgst || 0,
          pendingFinalPrice: item.pendingFinalPrice || 0,
          pendingDiscountAmount: (item.pendingBefTaxDiscountAmount || 0) + (item.pendingAfTaxDiscountAmount || 0),
          purchasecategoryName: item.purchasecategoryName || '',
          purchasesubcategoryName: item.purchasesubcategoryName || '',
          hsnCode: item.hsnCode || '',
          status: '',
          receivedQuantity: 0,
          damagedQuantity: 0,
          discountAmount: 0,
          taxAmount: item.pendingTaxAmount || 0,
          cgst: item.pendingCgst || 0,
          sgst: item.pendingSgst || 0,
          igst: item.pendingIgst || 0,
          barcode: '',
          expiryDate: null,
        }));

        dispatch(setPurchaseOrderData({
          ...currentPurchaseOrderData,
          items: mappedItems,
          pendingOrderAmount: response.data.total_pending_order_amount || 0,
          pendingTaxAmount: response.data.totalTax || 0,
          pendingDiscountAmount: response.data.totalDiscount || 0,
        }));
      }

      return {
        success,
        message,
        duplicates: duplicates_merged,
        errors,
        updatedItems: updated_items,
        warnings,
        successMessages: success_messages, // Added success_messages
      };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to import CSV file');
    }
  }
);

export const addPurchaseOrder = createAsyncThunk(
  'purchaseOrders/add',
  async (
    purchaseOrder: Omit<PurchaseOrderData, 'purchaseOrderId'> & { isHoldOrder?: boolean },
    { dispatch }
  ) => {
    const purchaseOrderToAdd = {
      ...purchaseOrder,
    };

    const response = await axios.post<PurchaseOrderData>(`${BASE_URL}/purchaseorders/`, purchaseOrderToAdd);
    dispatch(setSnackbarMessage('Purchase order processed'));
    return response.data;
  }
);

export const updatePurchaseOrder = createAsyncThunk(
  'purchaseOrders/update',
  async ({ purchaseOrderId, purchaseOrder }: { purchaseOrderId: string; purchaseOrder: Partial<PurchaseOrderData> }) => {
    const purchaseOrderToUpdate = {
      ...purchaseOrder,
    };
    const response = await axios.patch<PurchaseOrderData>(`${BASE_URL}/purchaseorders/${purchaseOrderId}`, purchaseOrderToUpdate);
    return response.data;
  }
);
<<<<<<< HEAD

=======
export const setDiscountMode = createAction<{
  mode: 'percentage' | 'amount';
  recalculate?: boolean; // Optional flag to recalculate after mode change
}>('purchaseOrder/setDiscountMode');
>>>>>>> recover-branch
const purchaseOrderSlice = createSlice({
  name: 'purchaseOrder',
  initialState,
  reducers: {
    setPurchaseOrderData(state, action: PayloadAction<Partial<PurchaseOrderData>>) {
      state.purchaseOrderData = { ...state.purchaseOrderData, ...action.payload };
    },
    setNewItemData(state, action: PayloadAction<Partial<Item>>) {
      state.newItem = { ...state.newItem, ...action.payload };
    },
    addItemToPurchaseOrder(state) {
      const existingItemIndex = state.purchaseOrderData.items.findIndex(item => item.itemId === state.newItem.itemId);
      if (existingItemIndex !== -1) {
        state.purchaseOrderData.items[existingItemIndex] = state.newItem;
      } else {
        state.purchaseOrderData.items.push(state.newItem);
      }
      state.newItem = initialState.newItem;
    },
    deleteItemFromPurchaseOrder(state, action: PayloadAction<string>) {
      state.purchaseOrderData.items = state.purchaseOrderData.items.filter(item => item.itemId !== action.payload);
    },
    setItemForEditing(state, action: PayloadAction<Item>) {
      state.newItem = {
        ...action.payload,
        itemId: action.payload.itemId,
        itemName: action.payload.itemName,
        itemCode: action.payload.itemCode,
        pendingCount: action.payload.pendingCount,
        pendingQuantity: action.payload.pendingQuantity,
        pendingTotalQuantity: action.payload.pendingTotalQuantity,
        existingPrice: action.payload.existingPrice,
        newPrice: action.payload.newPrice,
        priceVariance: action.payload.priceVariance,
        taxPercentage: action.payload.taxPercentage,
        taxType: action.payload.taxType,
        befTaxDiscount: action.payload.befTaxDiscount,
        afTaxDiscount: action.payload.afTaxDiscount,
        pendingTotalPrice: action.payload.pendingTotalPrice,
        pendingTaxAmount: action.payload.pendingTaxAmount,
        pendingBefTaxDiscountAmount: action.payload.pendingBefTaxDiscountAmount,
        pendingAfTaxDiscountAmount: action.payload.pendingAfTaxDiscountAmount,
        pendingCgst: action.payload.pendingCgst,
        pendingSgst: action.payload.pendingSgst,
        pendingIgst: action.payload.pendingIgst,
        pendingFinalPrice: action.payload.pendingFinalPrice,
        purchasecategoryName: action.payload.purchasecategoryName,
        purchasesubcategoryName: action.payload.purchasesubcategoryName,
        hsnCode: action.payload.hsnCode,
        status: action.payload.status,
        receivedQuantity: action.payload.receivedQuantity,
        damagedQuantity: action.payload.damagedQuantity,
        discountAmount: action.payload.discountAmount,
        taxAmount: action.payload.taxAmount,
        cgst: action.payload.cgst,
        sgst: action.payload.sgst,
        igst: action.payload.igst,
        barcode: action.payload.barcode,
        expiryDate: action.payload.expiryDate,
        pendingDiscountAmount: action.payload.pendingDiscountAmount,
        quantity: action.payload.quantity,
        poQuantity: action.payload.poQuantity,
        eachQuantity: action.payload.eachQuantity
      };
    },
    clearItemForEditing(state) {
      state.newItem = initialState.newItem;
    },
<<<<<<< HEAD

    // Action to set totals directly
    setReduxTotals(state, action: PayloadAction<{ pendingOrderAmount: number; pendingDiscountAmount: number; pendingTaxAmount: number }>) {
      state.purchaseOrderData.pendingOrderAmount = action.payload.pendingOrderAmount;
      state.purchaseOrderData.pendingDiscountAmount = action.payload.pendingDiscountAmount;
      state.purchaseOrderData.pendingTaxAmount = action.payload.pendingTaxAmount;
=======
    setReduxTotals: (state, action: PayloadAction<{
      pendingOrderAmount: number;
      pendingDiscountAmount: number;
      pendingTaxAmount: number;
    }>) => {
      state.purchaseOrderData.pendingOrderAmount = action.payload.pendingOrderAmount;
      state.purchaseOrderData.pendingDiscountAmount = action.payload.pendingDiscountAmount;
      state.purchaseOrderData.pendingTaxAmount = action.payload.pendingTaxAmount;
      state.totalPrice = action.payload.pendingOrderAmount;
      state.totalDiscount = action.payload.pendingDiscountAmount;
      state.totalTax = action.payload.pendingTaxAmount;
>>>>>>> recover-branch
    },
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    setSnackbarMessage(state, action: PayloadAction<string>) {
      state.snackbarMessage = action.payload;
    },
    clearSnackbarMessage(state) {
      state.snackbarMessage = '';
      state.snackbarOpen = false; // Close the snackbar when clearing the message
    },
    setSnackbarOpen(state, action: PayloadAction<boolean>) {
      state.snackbarOpen = action.payload;
    },
    clearVendors: (state) => {
      state.vendors = [];
      localStorage.removeItem('vendors');
    },
    updateSkip: (state, action) => {
      state.skip = action.payload;
    },
    setImportDialogOpen: (state, action: PayloadAction<boolean>) => {
      state.importDialogOpen = action.payload;
    },
    clearImportResults(state) {
      state.importDuplicates = [];
      state.importErrors = [];
      state.importWarnings = [];
      state.importDialogOpen = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPurchaseOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPurchaseOrders.fulfilled, (state, action: PayloadAction<PurchaseOrderData[]>) => {
        state.loading = false;
        state.purchaseorderitems = action.payload;
      })
      .addCase(fetchPurchaseOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch purchase orders';
      })
      .addCase(fetchAllVendors.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllVendors.fulfilled, (state, action: PayloadAction<Vendor[]>) => {
        state.loading = false;
        state.vendors = action.payload;
        // Store vendors in localStorage
        localStorage.setItem('vendors', JSON.stringify(action.payload));
      })
      .addCase(fetchAllVendors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch vendors';
      })
      .addCase(calculateItemTotals.pending, (state) => {
        state.loading = true;
        state.error = null; // Clear previous errors
      })
      .addCase(calculateItemTotals.fulfilled, (state, action: PayloadAction<{
<<<<<<< HEAD
        pendingTotalPrice: number; // Use 'totalPrice' instead of 'totalPriceBeforeDiscount' as per your API
=======
        pendingTotalPrice: number;
>>>>>>> recover-branch
        pendingBefTaxDiscountAmount: number;
        pendingAfTaxDiscountAmount: number;
        pendingDiscountAmount: number;
        pendingTaxAmount: number;
        pendingSgst: number;
        pendingCgst: number;
        pendingIgst: number;
        pendingFinalPrice: number;
<<<<<<< HEAD
=======
        befTaxDiscount: number;
        afTaxDiscount: number;
        poQuantity: number;
        quantity: number;
>>>>>>> recover-branch
      }>) => {
        state.loading = false;
        state.newItem = {
          ...state.newItem,
<<<<<<< HEAD
          ...action.payload
        };

        // Store the calculated totals globally
        state.totalPrice = action.payload.pendingFinalPrice; // Use finalPrice as your total price
        state.totalDiscount = action.payload.pendingDiscountAmount; // Total discount applied
        state.totalTax = action.payload.pendingTaxAmount; // Total tax applied

        console.log('Calculation Results:', action.payload);
=======
          ...action.payload,
          befTaxDiscount: action.payload.befTaxDiscount,
          afTaxDiscount: action.payload.afTaxDiscount,
          befTaxDiscountAmount: action.payload.pendingBefTaxDiscountAmount,
          afTaxDiscountAmount: action.payload.pendingAfTaxDiscountAmount,
          totalPrice: action.payload.pendingTotalPrice,
          finalPrice: action.payload.pendingFinalPrice,
          taxAmount: action.payload.pendingTaxAmount,
          discountAmount: action.payload.pendingDiscountAmount,
          sgst: action.payload.pendingSgst,
          cgst: action.payload.pendingCgst,
          igst: action.payload.pendingIgst,
          befTaxDiscountType: state.discountMode, // Use state discount mode
          afTaxDiscountType: state.discountMode,  // Use state discount mode
        };
        state.totalPrice = action.payload.pendingFinalPrice;
        state.totalDiscount = action.payload.pendingDiscountAmount;
        state.totalTax = action.payload.pendingTaxAmount;
>>>>>>> recover-branch
      })
      .addCase(calculateItemTotals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to calculate item totals';
      })
      .addCase(fetchVendorByName.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchVendorByName.fulfilled, (state, action: PayloadAction<Vendor | undefined>) => {
        state.loading = false;
      })
      .addCase(fetchVendorByName.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch vendor by name';
      })
      .addCase(addPurchaseOrder.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addPurchaseOrder.fulfilled, (state, action: PayloadAction<PurchaseOrderData>) => {
        state.loading = false;
        // Optionally, add the new purchase order to the list
        state.purchaseorderitems.push(action.payload);
        state.error = 'Purchase order added successfully'; // Or use a snackbar message
      })
      .addCase(addPurchaseOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to add purchase order';
      })
      .addCase(downloadCsvTemplate.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(downloadCsvTemplate.fulfilled, (state, action: PayloadAction<string>) => {
        state.loading = false;
        state.snackbarMessage = action.payload;
        state.snackbarOpen = true;
      })
      .addCase(downloadCsvTemplate.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to download CSV template';
        state.snackbarMessage = state.error;
        state.snackbarOpen = true;
      })
      // Updated Redux slice case for importCsvItems
      .addCase(importCsvItems.fulfilled, (state, action) => {
        state.loading = false;
        state.importDuplicates = action.payload.duplicates;
        state.importErrors = action.payload.errors;
        state.importWarnings = action.payload.warnings;
        state.importSuccessMessages = action.payload.successMessages; // Added
        state.importUpdatedItems = action.payload.updatedItems; // Added
        state.snackbarMessage = action.payload.message;
        state.snackbarOpen = true;
        state.importDialogOpen = true;
      })
      .addCase(importCsvItems.rejected, (state, action) => {
        state.loading = false;
        state.importErrors = [action.payload as string];
        state.snackbarMessage = action.payload as string;
        state.snackbarOpen = true;
        state.importDialogOpen = true;
<<<<<<< HEAD
=======
      })
      .addCase(setDiscountMode, (state, action) => {
        const { mode, recalculate = true } = action.payload;
        state.discountMode = mode;

        // Update both discount types in newItem
        state.newItem.befTaxDiscountType = mode;
        state.newItem.afTaxDiscountType = mode;

        // Optionally trigger recalculation
        if (recalculate) {
          // You might want to dispatch calculateItemTotals here
          // or handle it in the component
        }
>>>>>>> recover-branch
      });
  },
});

export const {
  setPurchaseOrderData,
  setNewItemData,
  addItemToPurchaseOrder,
  setSearchQuery,
  setSnackbarMessage,
  clearSnackbarMessage,
  setSnackbarOpen,
  deleteItemFromPurchaseOrder,
  setItemForEditing,
  clearItemForEditing,
  setReduxTotals,
  clearVendors, updateSkip, clearImportResults, setImportDialogOpen // Add this
} = purchaseOrderSlice.actions;

export const selectPurchaseOrderState = (state: RootState) => state.purchaseOrder;
export default purchaseOrderSlice.reducer;
