import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import axios, { AxiosError } from 'axios';
import { RootState } from '@/redux/store';
import { Business, initialState, ShippingAddress } from '@/Models/businessModel';
 
// Async thunk to fetch all Business items
export const fetchBusinesses = createAsyncThunk('businesses/fetchBusinesses', async () => {
  const response = await axios.get('https://yenerp.com/purchasetestapi/pobusiness/'); // Adjust API endpoint as needed
  return response.data;
});
 
// Async thunk to add a new Business item
export const addBusiness = createAsyncThunk<Business, Business>('businesses/addBusiness', async (businessData) => {
  const response = await axios.post('https://yenerp.com/purchasetestapi/pobusiness/', businessData); // Adjust API endpoint as needed
  return response.data;
});
 
// Async thunk to update an existing Business item
export const updateBusiness = createAsyncThunk<Business, Business>('businesses/updateBusiness', async (businessData) => {
  const response = await axios.patch(`https://yenerp.com/purchasetestapi/pobusiness/${businessData.businessId}`, businessData); // Adjust API endpoint as needed
  return response.data;
});
 
export const uploadBusinessPhoto = createAsyncThunk<
  { filename: string; id: string },  // The expected response shape
  { businessId: string; file: File }  // The input params: business ID and the file
>(
  'business/uploadPhoto',
  async ({ businessId, file }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
 
 
      const response = await axios.post(
        `https://yenerp.com/purchasetestapi/pobusiness/upload?custom_id=${businessId}`, // Use the business ID in the URL
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',  // Ensure it's sent as multipart
          },
        }
      );
 
 
      return response.data; // Return the response (filename, id, or URL)
    }
    // catch (error: any) {
    //   console.error('Upload error:', error.response || error.message); // Log any error
    //   return rejectWithValue(error.response?.data || 'Failed to upload the photo');  // Reject with the error message
    // }
 
    catch (error: unknown) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || 'Error adding addOn');
    }
  }
);
// Action to fetch the photo by ID  
export const fetchPhoto = createAsyncThunk(
  'photos/fetchPhoto',
  async (businessId: string, { rejectWithValue }) => {
    try {
      const response = await axios.get(`https://yenerp.com/purchasetestapi/pobusiness/view/${businessId}`, { responseType: 'blob' });
      const imageUrl = URL.createObjectURL(response.data); // Convert blob to object URL
      return { imageUrl, businessId };
    }
    // catch (error: any) {
    //   return rejectWithValue(error.response?.data || 'Error fetching photo');
    // }
 
    catch (error: unknown) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || 'Error adding addOn');
    }
  }
);
 
// Async thunk to fetch all Business items
export const fetchShipping = createAsyncThunk('shipping/fetchShipping', async () => {
  const response = await axios.get('https://yenerp.com/purchasetestapi/poshippingaddress/'); // Adjust API endpoint as needed
  return response.data;
});
 
// Async thunk to add a new Business item
export const addShipping = createAsyncThunk<ShippingAddress, ShippingAddress>('shipping/addShipping', async (shippingaddress) => {
  const response = await axios.post('https://yenerp.com/fastapi/poshippingaddress/', shippingaddress); // Adjust API endpoint as needed
  return response.data;
});
 
// Async thunk to update an existing Business item
export const updateShipping = createAsyncThunk<ShippingAddress, ShippingAddress>('shipping/updateBusiness', async (shippingaddress) => {
  const response = await axios.patch(`https://yenerp.com/fastapi/poshippingaddress/${shippingaddress.shippingId}`, shippingaddress); // Adjust API endpoint as needed
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
        state.businesses = action.payload;
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
      // .addCase(uploadBusinessPhoto.fulfilled, (state, action: PayloadAction<{ filename: string; id: string }>) => {
      //   state.uploadStatus = 'succeeded';
      //   state.uploadError = null;
      //   // Optionally handle the uploaded file details
      // })
 
 
      .addCase(uploadBusinessPhoto.fulfilled, (state) => {
        state.uploadStatus = 'succeeded';
        state.uploadError = null;
        // Optionally handle the uploaded file details
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