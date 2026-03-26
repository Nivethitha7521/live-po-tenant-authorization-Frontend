// features/account-setting/roleSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

// ---------- FRONTEND TYPE ----------
interface RoleRecord {
  id: string;
  roleName: string;
  active: boolean;
  roleType?: string;
  permissions: any[];
}

// ---------- BACKEND → FRONTEND TRANSFORM ----------
const convertBackendPermissions = (permObj: any) => {
  const result: any[] = [];

  for (const appName in permObj) {
    const modules = [];

    for (const subKey in permObj[appName]) {
      const p = permObj[appName][subKey];

      modules.push({
        id: subKey,
        name: subKey,
        submodules: [
          {
            id: subKey,
            name: subKey,
            actions: {
              read: p.read,
              add: p.add,
              edit: p.edit,
              delete: p.delete,
              hide: p.hide,
              approve: p.approve
            }
          }
        ]
      });
    }

    result.push({
      appName: appName === "yenerp" ? "YEN_PURCHASE" : appName,
      modules
    });
  }

  return result;
};

// ---------- FETCH ROLES ----------
export const fetchRoles = createAsyncThunk(
  'roles/fetchRoles',
  async () => {
    try {
      const [roleRes, permRes] = await Promise.all([
        fetch('http://127.0.0.1:8000/purchasetestapi/roles'),
        fetch('http://127.0.0.1:8000/purchasetestapi/permissions')
      ]);

      const roles = await roleRes.json();
      const permissions = await permRes.json();

      // Convert permissions → quick lookup
      const permMap: any = {};
      permissions.forEach((p: any) => {
        permMap[p.role_name] = p.permissions;
      });
      
      const PREDEFINED = [
        "Admin",
        "Purchase Manager",
        "Purchase Assistant",
        "Store Incharge",
        "Accounts Assistant",
        "Finance Assistant"
      ];

      // Merge permissions into roles
      return roles.map((item: any): RoleRecord => ({
        id: item._id,
        roleName: item.name,
       active: item.active,
        roleType: PREDEFINED.includes(item.name) ? "Predefined" : "Custom",
        permissions: permMap[item.name]
          ? convertBackendPermissions(permMap[item.name])
          : []
      }));
    } catch (error) {
     throw error;
    }
  }
);

// ---------- SLICE ----------
const roleSlice = createSlice({
  name: 'roles',
  initialState: {
    items: [] as RoleRecord[],
    loading: false,
    error: null as string | null
  },
  reducers: {
    // ✅ REMOVE: createRole thunk and replace with simple reducer
    addRoleLocally: (state, action: PayloadAction<RoleRecord>) => {
      // Check if role already exists
      const exists = state.items.some(role => 
        role.id === action.payload.id || 
        role.roleName === action.payload.roleName
      );
      
      if (!exists) {
        state.items.push(action.payload);
      }
    },
    
    updateRoleLocally: (state, action: PayloadAction<RoleRecord>) => {
      const index = state.items.findIndex(role => role.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },
    
    deleteRoleLocally: (state, action: PayloadAction<string>) => {
      const role = state.items.find(r => r.id === action.payload);
      if (role) {
        role.active = false;
      }
    },
    
    // ✅ Add this to refresh roles from localStorage
    refreshRolesFromStorage: (state) => {
      const storedRoles = JSON.parse(localStorage.getItem("roles") || "[]");
      state.items = storedRoles;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoles.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchRoles.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
       
      })
      .addCase(fetchRoles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch roles";
      });
  }
});

// ✅ Export all actions
export const { 
  addRoleLocally, 
  updateRoleLocally, 
  deleteRoleLocally,
  refreshRolesFromStorage 
} = roleSlice.actions;

export default roleSlice.reducer;