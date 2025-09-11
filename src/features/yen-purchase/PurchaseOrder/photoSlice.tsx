// photoSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '@/redux/store';

interface PhotoInfo {
  index: number;
  ftp_path: string;
  purchaseOrderId: string;
}

interface PhotoState {
  photosByOrder: {
    [orderId: string]: {
      photos: PhotoInfo[];
      loading: boolean;
      error: string | null;
    };
  };
  uploadStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  editStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  currentPhoto: string | null;
  imageUrls: { [key: string]: string };
  maxPhotos: number;
}

const initialState: PhotoState = {
  photosByOrder: {},
  uploadStatus: 'idle',
  editStatus: 'idle',
  currentPhoto: null,
  imageUrls: {},
  maxPhotos: 3,
};

export const fetchPhotosByOrderId = createAsyncThunk(
  'photos/fetchByOrderId',
  async (orderId: string, { rejectWithValue }) => {
    try {
      const response = await axios.get(`https://yenerp.com/purchaseapi/photos/${orderId}`);
      return { orderId, photos: response.data.photos };
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to fetch photos');
    }
  }
);

export const uploadPhotos = createAsyncThunk(
  'photos/upload',
  async ({ orderId, files }: { orderId: string; files: File[] }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      const response = await axios.post(
        `https://yenerp.com/purchaseapi/photos/upload/${orderId}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return { orderId, uploadedPhotos: response.data.uploaded_photos };
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to upload photos');
    }
  }
);

export const editPhotoByIndex = createAsyncThunk(
  'photos/edit',
  async ({ orderId, index, file }: { orderId: string; index: number; file: File }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.patch(
        `https://yenerp.com/purchaseapi/photos/edit/${orderId}/${index}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return { orderId, index, photo: response.data };
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to edit photo');
    }
  }
);

export const deletePhoto = createAsyncThunk(
  'photos/delete',
  async ({ orderId, index }: { orderId: string; index: number }, { rejectWithValue }) => {
    try {
      await axios.delete(`https://yenerp.com/purchaseapi/photos/${orderId}/${index}`);
      return { orderId, index };
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to delete photo');
    }
  }
);

const photoSlice = createSlice({
  name: 'photos',
  initialState,
  reducers: {
    resetUploadStatus: (state) => {
      state.uploadStatus = 'idle';
    },
    resetEditStatus: (state) => {
      state.editStatus = 'idle';
    },
    clearPhotoError: (state) => {
    },
    setCurrentPhoto: (state, action: PayloadAction<string | null>) => {
      state.currentPhoto = action.payload;
    },
    cacheImageUrl: (state, action: PayloadAction<{ key: string; url: string }>) => {
      state.imageUrls[action.payload.key] = action.payload.url;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Photos by Order ID
      .addCase(fetchPhotosByOrderId.pending, (state, action) => {
        const orderId = action.meta.arg;
        if (!state.photosByOrder[orderId]) {
          state.photosByOrder[orderId] = {
            photos: [],
            loading: true,
            error: null
          };
        } else {
          state.photosByOrder[orderId].loading = true;
        }
      })
      .addCase(fetchPhotosByOrderId.fulfilled, (state, action) => {
        const { orderId, photos } = action.payload;
        state.photosByOrder[orderId] = {
          photos,
          loading: false,
          error: null
        };
      })
      .addCase(fetchPhotosByOrderId.rejected, (state, action) => {
        const orderId = action.meta.arg;
        state.photosByOrder[orderId] = {
          photos: [],
          loading: false,
          error: action.payload as string
        };
      })

      // Upload Photos
      .addCase(uploadPhotos.pending, (state) => {
        state.uploadStatus = 'loading';
      })
      .addCase(uploadPhotos.fulfilled, (state, action) => {
        state.uploadStatus = 'succeeded';
        const { orderId, uploadedPhotos } = action.payload;
        
        if (!state.photosByOrder[orderId]) {
          state.photosByOrder[orderId] = {
            photos: [],
            loading: false,
            error: null
          };
        }
        
        // Merge new photos with existing ones, keeping only the last 3
        state.photosByOrder[orderId].photos = [
          ...state.photosByOrder[orderId].photos,
          ...uploadedPhotos
        ].slice(0, state.maxPhotos);
      })
      .addCase(uploadPhotos.rejected, (state, action) => {
        state.uploadStatus = 'failed';
      })

      // Edit Photo
      .addCase(editPhotoByIndex.pending, (state) => {
        state.editStatus = 'loading';
      })
      .addCase(editPhotoByIndex.fulfilled, (state, action) => {
        state.editStatus = 'succeeded';
        const { orderId, index, photo } = action.payload;
        
        if (state.photosByOrder[orderId]) {
          const photoIndex = state.photosByOrder[orderId].photos.findIndex(p => p.index === index);
          if (photoIndex !== -1) {
            state.photosByOrder[orderId].photos[photoIndex] = {
              ...state.photosByOrder[orderId].photos[photoIndex],
              ...photo
            };
          }
        }
      })
      .addCase(editPhotoByIndex.rejected, (state, action) => {
        state.editStatus = 'failed';
      })

      // Delete Photo
      .addCase(deletePhoto.fulfilled, (state, action) => {
        const { orderId, index } = action.payload;
        if (state.photosByOrder[orderId]) {
          state.photosByOrder[orderId].photos = state.photosByOrder[orderId].photos.filter(
            photo => photo.index !== index
          );
        }
      });
  },
});

export const { 
  resetUploadStatus, 
  resetEditStatus, 
  clearPhotoError, 
  setCurrentPhoto,
  cacheImageUrl 
} = photoSlice.actions;

export const selectPhotosByOrderId = (orderId: string) => (state: RootState) => 
  state.photos.photosByOrder[orderId] || { photos: [], loading: false, error: null };

export const selectUploadStatus = (state: RootState) => state.photos.uploadStatus;
export const selectEditStatus = (state: RootState) => state.photos.editStatus;
export const selectCurrentPhoto = (state: RootState) => state.photos.currentPhoto;
export const selectImageUrls = (state: RootState) => state.photos.imageUrls;
export const selectMaxPhotos = (state: RootState) => state.photos.maxPhotos;

export default photoSlice.reducer;