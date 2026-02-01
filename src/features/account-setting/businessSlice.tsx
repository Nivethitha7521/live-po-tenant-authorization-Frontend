import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import purchaseApi from "@/utils/api";
import { RootState } from "../../redux/store";
import {
  Business,
  initialState,
  ShippingAddress,
} from "@/Models/businessModel";

export const fetchBusinesses = createAsyncThunk(
  "businesses/fetchBusinesses",
  async (_, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.get("/pobusiness/");
      return response.data;
    } catch (error: any) {
      return rejectWithValue({
        error: error.response?.data?.message || "Failed to fetch businesses",
        details: error.response?.data,
      });
    }
  },
);

export const addBusiness = createAsyncThunk<Business, Business>(
  "businesses/addBusiness",
  async (businessData, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.post("/pobusiness/", businessData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue({
        error: error.response?.data?.message || "Failed to add business",
        details: error.response?.data,
      });
    }
  },
);

export const updateBusiness = createAsyncThunk<Business, Business>(
  "businesses/updateBusiness",
  async (businessData, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.patch(
        `/pobusiness/${businessData.businessId}/`,
        businessData,
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue({
        error: error.response?.data?.message || "Failed to update business",
        details: error.response?.data,
      });
    }
  },
);

export const uploadBusinessPhoto = createAsyncThunk<
  { filename: string; id: string; imageUrl: string },
  { businessId: string; file: File }
>("business/uploadPhoto", async ({ businessId, file }, { rejectWithValue }) => {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await purchaseApi.post(
      `/pobusiness/upload?custom_id=${businessId}`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );

    return response.data;
  } catch (error: any) {
    return rejectWithValue({
      error: error.response?.data?.message || "Failed to upload the photo",
      details: error.response?.data,
    });
  }
});

export const fetchPhoto = createAsyncThunk(
  "business/fetchPhoto",
  async (businessId: string, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.get(
        `/pobusiness/${businessId}/photo`,
        {
          responseType: "blob",
        },
      );
      return { businessId, imageUrl: URL.createObjectURL(response.data) };
    } catch (error: any) {
      let errorMessage = "Failed to fetch photo";

      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const errorData = JSON.parse(text);
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = "Photo not found or inaccessible";
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      return rejectWithValue({
        businessId,
        error: errorMessage,
        status: error.response?.status,
      });
    }
  },
);

// Async thunk to fetch all shipping addresses
export const fetchShipping = createAsyncThunk(
  "shipping/fetchShipping",
  async (_, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.get("/poshippingaddress/");
      return response.data;
    } catch (error: any) {
      console.error("Shipping fetch error:", error.response?.data);
      return rejectWithValue({
        error:
          error.response?.data?.message || "Failed to fetch shipping addresses",
        details: error.response?.data,
      });
    }
  },
);

// Async thunk to add a new shipping address
export const addShipping = createAsyncThunk<ShippingAddress, ShippingAddress>(
  "shipping/addShipping",
  async (shippingaddress, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.post(
        "/poshippingaddress/",
        shippingaddress,
      );
      return response.data;
    } catch (error: any) {
      console.error("Add shipping error:", error.response?.data);
      return rejectWithValue({
        error:
          error.response?.data?.message || "Failed to add shipping address",
        details: error.response?.data,
      });
    }
  },
);

// Async thunk to update an existing shipping address
export const updateShipping = createAsyncThunk<
  ShippingAddress,
  ShippingAddress
>("shipping/updateShipping", async (shippingaddress, { rejectWithValue }) => {
  try {
    const response = await purchaseApi.patch(
      `/poshippingaddress/${shippingaddress.shippingId}/`,
      shippingaddress,
    );
    return response.data;
  } catch (error: any) {
    console.error("Update shipping error:", error.response?.data);
    return rejectWithValue({
      error:
        error.response?.data?.message || "Failed to update shipping address",
      details: error.response?.data,
    });
  }
});

// Create slice for Business slice
const businessSlice = createSlice({
  name: "businesses",
  initialState,
  reducers: {
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    setDialogOpen(state, action: PayloadAction<"none" | "edit">) {
      state.dialogOpen = action.payload;
    },
    setBusinessData(state, action: PayloadAction<Business>) {
      state.businessData = action.payload;
    },
    setSnackbarOpen(state, action: PayloadAction<boolean>) {
      state.snackbarOpen = action.payload;
    },
    setSnackbarMessage(state, action: PayloadAction<string>) {
      state.snackbarMessage = action.payload;
    },
    setEditIndex(state, action: PayloadAction<number | null>) {
      state.editIndex = action.payload;
    },
    addBusinessdetail: (state, action) => {
      state.businesses.push(action.payload);
    },
    updateBusinessdetail: (state, action) => {
      const index = state.businesses.findIndex(
        (business) => business.businessId === action.payload.businessId,
      );
      if (index !== -1) {
        state.businesses[index] = action.payload;
      }
    },
    addShippingdetail: (state, action) => {
      state.shippingaddress.push(action.payload);
    },
    updateShippingdetail: (state, action) => {
      const index = state.shippingaddress.findIndex(
        (shipping) => shipping.shippingId === action.payload.shippingId,
      );
      if (index !== -1) {
        state.shippingaddress[index] = action.payload;
      }
    },
    clearError: (state) => {
      state.error = null;
    },
    clearUploadError: (state) => {
      state.uploadError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBusinesses.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBusinesses.fulfilled, (state, action) => {
        state.loading = false;
        state.businesses = action.payload;
        state.error = null;
      })
      .addCase(fetchBusinesses.rejected, (state, action) => {
        state.loading = false;
        // Handle the rejected value properly
        if (
          action.payload &&
          typeof action.payload === "object" &&
          "error" in action.payload
        ) {
          state.error = (action.payload as any).error;
        } else if (action.error.message) {
          state.error = action.error.message;
        } else {
          state.error = "Failed to fetch businesses";
        }
      })
      .addCase(addBusiness.fulfilled, (state, action) => {
        state.loading = false;
        const businessExists = state.businesses.some(
          (business) => business.businessId === action.payload.businessId,
        );

        if (!businessExists) {
          state.businesses.push(action.payload);
        }
      })
      .addCase(addBusiness.rejected, (state, action) => {
        state.loading = false;
        if (
          action.payload &&
          typeof action.payload === "object" &&
          "error" in action.payload
        ) {
          state.error = (action.payload as any).error;
        }
      })
      .addCase(updateBusiness.fulfilled, (state, action) => {
        const index = state.businesses.findIndex(
          (item) => item.businessId === action.payload.businessId,
        );
        if (index !== -1) {
          state.businesses[index] = action.payload;
        }
      })
      .addCase(updateBusiness.rejected, (state, action) => {
        if (
          action.payload &&
          typeof action.payload === "object" &&
          "error" in action.payload
        ) {
          state.error = (action.payload as any).error;
        }
      })
      .addCase(uploadBusinessPhoto.pending, (state) => {
        state.uploadStatus = "loading";
        state.uploadError = null;
      })
      .addCase(uploadBusinessPhoto.fulfilled, (state, action) => {
        state.uploadStatus = "succeeded";
        state.uploadError = null;
        const { id, imageUrl } = action.payload;
        const index = state.businesses.findIndex(
          (business) => business.businessId === id,
        );
        if (index !== -1) {
          state.businesses[index].imageUrl = imageUrl;
        }
      })
      .addCase(uploadBusinessPhoto.rejected, (state, action) => {
        state.uploadStatus = "failed";
        // Ensure we're assigning a string or null
        if (
          action.payload &&
          typeof action.payload === "object" &&
          "error" in action.payload
        ) {
          state.uploadError = (action.payload as any).error;
        } else if (action.error.message) {
          state.uploadError = action.error.message;
        } else {
          state.uploadError = "Failed to upload photo";
        }
      })
      .addCase(fetchPhoto.fulfilled, (state, action) => {
        const { imageUrl, businessId } = action.payload;
        const index = state.businesses.findIndex(
          (business) => business.businessId === businessId,
        );
        if (index !== -1) {
          state.businesses[index].imageUrl = imageUrl;
        }
      })
      .addCase(fetchPhoto.rejected, (state, action) => {
        console.warn("Failed to fetch photo:", action.payload);
      })
      .addCase(fetchShipping.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchShipping.fulfilled, (state, action) => {
        state.loading = false;
        state.shippingaddress = action.payload;
        state.error = null;
      })
      .addCase(fetchShipping.rejected, (state, action) => {
        state.loading = false;
        if (
          action.payload &&
          typeof action.payload === "object" &&
          "error" in action.payload
        ) {
          state.error = (action.payload as any).error;
        } else if (action.error.message) {
          state.error = action.error.message;
        } else {
          state.error = "Failed to fetch shipping addresses";
        }
      })
      .addCase(addShipping.fulfilled, (state, action) => {
        state.shippingaddress.push(action.payload);
      })
      .addCase(addShipping.rejected, (state, action) => {
        console.error("Failed to add shipping:", action.payload);
      })
      .addCase(updateShipping.fulfilled, (state, action) => {
        const index = state.shippingaddress.findIndex(
          (shipping) => shipping.shippingId === action.payload.shippingId,
        );
        if (index !== -1) {
          state.shippingaddress[index] = action.payload;
        }
      })
      .addCase(updateShipping.rejected, (state, action) => {
        console.error("Failed to update shipping:", action.payload);
      });
  },
});

// Export actions
export const {
  setSearchQuery,
  setDialogOpen,
  setBusinessData,
  setSnackbarOpen,
  setSnackbarMessage,
  setEditIndex,
  addBusinessdetail,
  updateBusinessdetail,
  addShippingdetail,
  updateShippingdetail,
  clearError,
  clearUploadError,
} = businessSlice.actions;

// Selector
export const selectBusinesses = (state: RootState) => state.business;

// Export reducer
export default businessSlice.reducer;
