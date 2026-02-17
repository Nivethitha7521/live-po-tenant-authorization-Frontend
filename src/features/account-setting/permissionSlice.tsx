// features/permissionSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

// Define proper types
interface PermissionAction {
  add: boolean;
  edit: boolean;
  delete: boolean;
  read: boolean;
  hide: boolean;
  approve?: boolean;
}

interface SubmodulePermissions {
  [submoduleName: string]: PermissionAction;
}

interface ModulePermissions {
  [moduleName: string]: SubmodulePermissions;
}

interface AppPermissions {
  [appName: string]: ModulePermissions;
}

interface PermissionRecord {
  _id?: string;
  role_name: string;
  permissions: AppPermissions;
}

interface UpdatePermissionsPayload {
  roleName: string;
  permissions: AppPermissions;
}

// API calls with proper typing
export const fetchPermissions = createAsyncThunk(
  'permissions/fetchPermissions',
  async (): Promise<PermissionRecord[]> => {
    const response = await fetch('https://yenerp.com/purchasetestapi/permissions');
    return await response.json();
  }
);

export const updatePermissions = createAsyncThunk(
  'permissions/updatePermissions',
  async ({ roleName, permissions }: UpdatePermissionsPayload): Promise<PermissionRecord> => {
    const response = await fetch(`https://yenerp.com/purchasetestapi/permissions/${roleName}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions })
    });
    return await response.json();
  }
);

interface PermissionState {
  items: PermissionRecord[];
  loading: boolean;
}

const initialState: PermissionState = {
  items: [],
  loading: false
};

const permissionSlice = createSlice({
  name: 'permissions',
  initialState,
  reducers: {
    // Add local reducers if needed
    updatePermissionLocally: (state, action: PayloadAction<UpdatePermissionsPayload>) => {
      const { roleName, permissions } = action.payload;
      const index = state.items.findIndex(p => p.role_name === roleName);
      if (index !== -1) {
        state.items[index].permissions = permissions;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPermissions.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPermissions.fulfilled, (state, action: PayloadAction<PermissionRecord[]>) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchPermissions.rejected, (state) => {
        state.loading = false;
      })
      .addCase(updatePermissions.fulfilled, (state, action) => {
        // Update local state after successful API call
        const { roleName, permissions } = action.meta.arg;
        const index = state.items.findIndex(p => p.role_name === roleName);
        if (index !== -1) {
          state.items[index].permissions = { 
            ...state.items[index].permissions, 
            ...permissions 
          };
        } else {
          // Add new permission record if it doesn't exist
          state.items.push({
            role_name: roleName,
            permissions: permissions
          });
        }
      });
  }
});

export const { updatePermissionLocally } = permissionSlice.actions;
export default permissionSlice.reducer;