import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import purchaseApi from "@/utils/api";
import { RootState } from '../../redux/store';
import { Business, initialState, Photo, ShippingAddress } from '@/Models/businessModel';



export const fetchBusinesses = createAsyncThunk('businesses/fetchBusinesses', async () => {
  const response = await purchaseApi.get(`/pobusiness/`);
  return response.data;
});

export const addBusiness = createAsyncThunk<Business, Business>('businesses/addBusiness', async (businessData) => {
  const response = await purchaseApi.post(`/pobusiness/`, businessData);
  return response.data;
});

export const updateBusiness = createAsyncThunk<Business, Business>('businesses/updateBusiness', async (businessData) => {
  const response = await purchaseApi.patch(`/pobusiness/${businessData.businessId}`, businessData);
  return response.data;
});

export const uploadBusinessPhoto = createAsyncThunk<
  { filename: string; id: string; imageUrl: string },  // Include imageUrl in response
  { businessId: string; file: File }
>(
  'business/uploadPhoto',
  async ({ businessId, file }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await purchaseApi.post(
        `/pobusiness/upload?custom_id=${businessId}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to upload the photo');
    }
  }
);
// Action to fetch the photo by ID
export const fetchPhoto = createAsyncThunk(
  'photos/fetchPhoto',
  async (businessId: string, { rejectWithValue }) => {
    try {
      // ✅ Check localStorage cache first
      const cached = localStorage.getItem(`business_photo_${businessId}`);
      if (cached) {
        return { imageUrl: cached, businessId };
      }

      const response = await purchaseApi.get(`/pobusiness/view/${businessId}`, {
        responseType: 'blob'
      });

      // ✅ Convert blob → base64 so it persists across navigations
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(response.data);
      });

      // ✅ Cache in localStorage
      localStorage.setItem(`business_photo_${businessId}`, base64);

      return { imageUrl: base64, businessId };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Error fetching photo');
    }
  }
);
// Async thunk to fetch all Business items
export const fetchShipping = createAsyncThunk('shipping/fetchShipping', async () => {
  const response = await purchaseApi.get(`/poshippingaddress/`); // Adjust API endpoint as needed
  return response.data;
});

// Async thunk to add a new Business item
export const addShipping = createAsyncThunk<ShippingAddress, ShippingAddress>('shipping/addShipping', async (shippingaddress) => {
  const response = await purchaseApi.post(`/poshippingaddress/`, shippingaddress); // Adjust API endpoint as needed
  return response.data;
});

// Async thunk to update an existing Business item
export const updateShipping = createAsyncThunk<ShippingAddress, ShippingAddress>('shipping/updateBusiness', async (shippingaddress) => {
  const response = await purchaseApi.patch(`/poshippingaddress/${shippingaddress.shippingId}`, shippingaddress); // Adjust API endpoint as needed
  return response.data;
});

// Create slice for Business slice
const businessSlice = createSlice({
  name: 'businesses',
  initialState,
  reducers: {
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    setDialogOpen(state, action: PayloadAction<'none' | 'edit'>) {
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
      state.businesses.push(action.payload); // Add new item to the list
    },
    updateBusinessdetail: (state, action) => {
      const index = state.businesses.findIndex(business => business.businessId === action.payload.businessId);
      if (index !== -1) {
        state.businesses[index] = action.payload; // Update the existing personal data
      }
    },
    addShippingdetail: (state, action) => {
      state.shippingaddress.push(action.payload); // Add new item to the list
    },
    updateShippingdetail: (state, action) => {
      const index = state.shippingaddress.findIndex(shipping => shipping.shippingId === action.payload.shippingId);
      if (index !== -1) {
        state.shippingaddress[index] = action.payload; // Update the existing personal data
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBusinesses.pending, (state) => {
        state.loading = true;
      })
     .addCase(fetchBusinesses.fulfilled, (state, action) => {
  state.loading = false;
  state.businesses = action.payload.map((business: Business) => {
    // ✅ Restore cached photo from localStorage
    const cached = localStorage.getItem(`business_photo_${business.businessId}`);
    return cached ? { ...business, imageUrl: cached } : business;
  });
})
      .addCase(fetchBusinesses.rejected, (state) => {
        state.loading = false;
      })
      .addCase(addBusiness.fulfilled, (state, action) => {
        state.loading = false;

        // Prevent duplicate by checking if the business already exists in the state
        const businessExists = state.businesses.some(
          (business) => business.businessId === action.payload.businessId
        );

        if (!businessExists) {
          // Add only if not already present
          state.businesses.push(action.payload);
        }
      })
      .addCase(updateBusiness.fulfilled, (state, action) => {
        const index = state.businesses.findIndex((item) => item.businessId === action.payload.businessId);
        if (index !== -1) {
          state.businesses[index] = action.payload;
        }
      })
      // Upload photo
      .addCase(uploadBusinessPhoto.pending, (state) => {
        state.uploadStatus = 'loading';
        state.uploadError = null;
      })
      // In your component, ensure the image URL is properly set after upload
      .addCase(uploadBusinessPhoto.fulfilled, (state, action: PayloadAction<{ filename: string; id: string; imageUrl: string }>) => {
        state.uploadStatus = 'succeeded';
        state.uploadError = null;

        // Update the business with the new image URL
        const { id, imageUrl } = action.payload;
        const index = state.businesses.findIndex((business) => business.businessId === id);
        if (index !== -1) {
          state.businesses[index].imageUrl = imageUrl;
        }
      })
      .addCase(uploadBusinessPhoto.rejected, (state, action) => {
        state.uploadStatus = 'failed';
        state.uploadError = action.payload as string;
      })
      .addCase(fetchPhoto.fulfilled, (state, action) => {
        const { imageUrl, businessId } = action.payload;
        const index = state.businesses.findIndex((business) => business.businessId === businessId);
        if (index !== -1) {
          state.businesses[index].imageUrl = imageUrl;
        }
      })
      .addCase(fetchShipping.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchShipping.fulfilled, (state, action) => {
        state.loading = false;
        state.shippingaddress = action.payload;
      })
      .addCase(fetchShipping.rejected, (state) => {
        state.loading = false;
      })
      .addCase(addShipping.fulfilled, (state, action) => {
        state.shippingaddress.push(action.payload);
      })
      .addCase(updateShipping.fulfilled, (state, action) => {
        const index = state.shippingaddress.findIndex((shipping) => shipping.shippingId === action.payload.shippingId);
        if (index !== -1) {
          state.shippingaddress[index] = action.payload;
        }
      });
  },
});

// Export actions from slice
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
  updateShippingdetail
} = businessSlice.actions;

// Selector to get Business items from state
export const selectBusinesses = (state: RootState) => state.business;

// Export reducer from slice
export default businessSlice.reducer;
