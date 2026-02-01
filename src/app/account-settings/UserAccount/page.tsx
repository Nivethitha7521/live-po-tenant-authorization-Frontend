"use client";

import React, { useState,useEffect } from "react";
import { Pencil, Trash2, RotateCcw, Plus, Search } from "lucide-react";
import { useDispatch } from 'react-redux'; // ✅ ADD THIS
import { addUserLocally, updateUserStatusLocally } from '@/features/account-setting/userSlice'; // ✅ ADD THIS
import { Snackbar, Alert } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

// ✅ ADD THIS AT TOP (outside component)
const PREDEFINED_ROLES = [
  "Admin",
  "Purchase Manager",
  "Purchase Assistant",
  "Store Incharge",
  "Accounts Assistant",
  "Finance Assistant",
];
// 🔥 ADD BELOW PREDEFINED_ROLES

const PURCHASE_SUBMODULES = [
  "purchasecategory",
  "purchasesubcategory",
  "purchaseuom",
  "itemgroup",
  "purchasetax",
  "storagelocation",
  "freight",
  "itemtype",
  "vendortype",
  "vendors",
  "purchaseitem",
  "purchaseorders_pending",
  "purchaseorders_approved",
  "purchaseorders_rejected",
  "grns",
  "grns_return",
  "apinvoices",
];

const BOOK_SUBMODULES = [
  "outgoingpayment",
  "advancepayment",
  "partialpayment",
  "paymentdone",
  "ledger",
  "purchasereturn",
];

export default function UserAccounts() {
  const dispatch = useDispatch();
  const [users, setUsers] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]); // ✅ ADD THIS STATE FOR ROLES
    // ✅ role -> apps map
const [roleAppsMap, setRoleAppsMap] = useState<Record<string, string[]>>({});

// ✅ Snackbar state
const [snackbar, setSnackbar] = useState({
  open: false,
  message: "",
  severity: "success" as "success" | "error",
});

  const [showActive, setShowActive] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [userModal, setUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formUser, setFormUser] = useState({
    id: "",
    username: "",
    password: "",
    confirmPassword: "",
    role: "",
    active: true,
  });
  const [showPassword, setShowPassword] = useState(false);
const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // ✅ ADD THIS FUNCTION TO FETCH ROLES FROM BACKEND
  const fetchRolesFromBackend = async () => {
    try {
      console.log("Fetching roles from backend...");
      const response = await fetch('http://127.0.0.1:8000/purchasetestapi/roles');
      
      if (response.ok) {
        const rolesFromBackend = await response.json();
        console.log("Roles from backend:", rolesFromBackend);
        
        if (Array.isArray(rolesFromBackend)) {
          // Filter only active roles and transform for dropdown
          const activeRoles = rolesFromBackend
            .filter((role: any) => role.active === true)
           .map((role: any) => {
  const roleName = role.name;

  return {
    id: role._id || role.id,
    name: roleName,
    role_type: PREDEFINED_ROLES.includes(roleName)
      ? "Predefined"
      : "Custom"
  };
});

          
          setRoles(activeRoles);
          console.log("Active roles for dropdown:", activeRoles);
        } else {
          console.error('Unexpected response format for roles:', rolesFromBackend);
          setRoles([]);
        }
      } else {
        console.error('Failed to fetch roles from backend. Status:', response.status);
        setRoles([]);
      }
    } catch (error) {
      console.error('Error fetching roles from backend:', error);
      setRoles([]);
    }
  };


  // ✅ Fetch permissions and create role -> apps mapping
const fetchRoleAppsFromPermissions = async () => {
  try {
    console.log("Fetching permissions to map role -> apps...");
    const res = await fetch("http://127.0.0.1:8000/purchasetestapi/permissions");

    if (!res.ok) return;

    const data = await res.json();

    const map: Record<string, string[]> = {};

    // ✅ Helper: check if any permission is true except hide
    const hasAnyCheckedPermissionExceptHide = (obj: any) => {
      if (!obj || typeof obj !== "object") return false;

      return Object.entries(obj).some(([key, value]) => {
        if (key === "hide") return false;
        return value === true;
      });
    };

 

    if (Array.isArray(data)) {
      data.forEach((item: any) => {
        const roleName = item.role_name;
        const perms = item.permissions || {};

        const apps: string[] = [];

        // perms = { yenerp: {...}, outlet_manager: {...}, pos: {...} }
        Object.keys(perms).forEach((appKey) => {
          const appPermObj = perms[appKey];

          // ✅ appPermObj = { purchasecategory:{...}, apinvoices:{...} ... }
         // 🔥 SPECIAL HANDLING FOR yenerp
if (appKey === "yenerp") {
  let hasPurchase = false;
  let hasBook = false;

  Object.entries(appPermObj || {}).forEach(([subKey, actions]: any) => {
    const hasPermission = Object.entries(actions).some(
      ([k, v]) => k !== "hide" && v === true
    );

    if (!hasPermission) return;

    if (PURCHASE_SUBMODULES.includes(subKey)) {
      hasPurchase = true;
    }

    if (BOOK_SUBMODULES.includes(subKey)) {
      hasBook = true;
    }
  });

  if (hasPurchase) apps.push("YEN_PURCHASE");
  if (hasBook) apps.push("YEN_BOOK");

  return; // 🔴 VERY IMPORTANT – stop here for yenerp
}

// 🔹 OTHER APPS (NORMAL)
const submodules = Object.values(appPermObj || {});
const appHasPermission = submodules.some((sub: any) =>
  hasAnyCheckedPermissionExceptHide(sub)
);

if (appHasPermission) {
  if (appKey === "outlet_manager") apps.push("YEN_OUTLET_MANAGER");
  else if (appKey === "pos") apps.push("YEN_POS");
}

        });

        map[roleName] = apps;
      });
    }

    setRoleAppsMap(map);
    console.log("✅ roleAppsMap NEW:", map);
  } catch (err) {
    console.error("Error mapping apps:", err);
  }
};



 // ✅ ADD THIS: Fetch users when component mounts
  useEffect(() => {
    fetchUsersFromBackend();
  }, []);
  // ✅ ALSO FETCH USERS WHEN showActive CHANGES (to ensure proper filtering)
  useEffect(() => {
    fetchUsersFromBackend();
  }, [showActive]);
  // ✅ CALL THIS WHEN COMPONENT MOUNTS AND WHEN USER MODAL OPENS
  useEffect(() => {
    fetchRolesFromBackend();
  }, []);

  // ✅ ALSO FETCH ROLES WHEN USER MODAL OPENS TO GET LATEST ROLES
  useEffect(() => {
    if (userModal) {
      fetchRolesFromBackend();
    }
  }, [userModal]);
  useEffect(() => {
  fetchRoleAppsFromPermissions();
}, []);

  const filteredUsers = users
    .filter((u) => (showActive ? Boolean(u.active) : !Boolean(u.active)))
    .filter((u) => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        u.username?.toLowerCase().includes(search) ||
        u.employeeId?.toLowerCase().includes(search) ||
        u.role?.toLowerCase().includes(search)
      );
    });

  // UserAccounts/page.tsx - UPDATE handleSaveUser function
const handleSaveUser = async () => {
  try {
    // Validate passwords match
    if (!editingUserId && formUser.password !== formUser.confirmPassword) {
      throw new Error("Passwords do not match");
    }

    if (!formUser.role) {
      throw new Error("Please select a role");
    }

    if (editingUserId) {
      // ✅ UPDATE EXISTING USER
      console.log("🔄 Updating user...", editingUserId);
      
      const updateData: any = {
        username: formUser.username,
        role_name: formUser.role
      };
      
      // Only include password if it's changed (not masked)
      if (formUser.password && formUser.password !== '••••••••') {
        if (formUser.password !== formUser.confirmPassword) {
          throw new Error("Passwords do not match");
        }
        updateData.password = formUser.password;
      }
      
      const response = await fetch(`http://127.0.0.1:8000/purchasetestapi/users/${editingUserId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'User update failed');
      }

      const result = await response.json();
      console.log("✅ User updated successfully:", result);
      
     setUsers(users.map(user => 
  user.id === editingUserId ? { 
    ...user, 
    username: formUser.username,
    role: formUser.role
  } : user
));

setSnackbar({
  open: true,
  message: "User updated successfully!",
  severity: "success",
});

      
    } else {
      // ✅ CREATE NEW USER (your existing code)
      console.log("🔄 Creating user in role management system...");

      const response = await fetch('http://127.0.0.1:8000/purchasetestapi/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formUser.username,
          password: formUser.password,
          role_name: formUser.role,
          is_active: true
        }),
      });

     if (!response.ok) {
  const errorText = await response.text();

  // 👇 Username already exists case (409 / duplicate)
  if (
    response.status === 409 ||
    errorText.toLowerCase().includes("exists") ||
    errorText.toLowerCase().includes("already")
  ) {
    setSnackbar({
      open: true,
      message: "Username already exists",
      severity: "error",
    });
    return; // ❗ STOP further execution
  }

  throw new Error(errorText || "User creation failed");
}


      const result = await response.json();
      console.log("✅ User created successfully:", result);
      
      // ✅ ADD USER TO REDUX STORE FOR IMMEDIATE UI UPDATE
      const newUser = {
        id: result._id || result.id,
        username: formUser.username,
        password: '••••••••',
        confirmPassword: '••••••••',
        role: formUser.role,
        active: true
      };
      
     dispatch(addUserLocally(newUser));
setUsers([...users, newUser]);

setSnackbar({
  open: true,
  message: "User created successfully!",
  severity: "success",
});

    }
    
    // Refresh users list and close modal
    await fetchUsersFromBackend();
    await fetchRoleAppsFromPermissions();

    setUserModal(false);
    resetForm();
    
 } catch (error: any) {
  console.error("❌ Error:", error);

  setSnackbar({
    open: true,
    message: error.message || "Something went wrong",
    severity: "error",
  });
}

};
 const handleDeactivateUser = async (userId: string) => {
  try {
    // 🔥 1. Update backend
    await fetch(`http://127.0.0.1:8000/purchasetestapi/users/${userId}/deactivate`, {
      method: "PATCH",
    });

    // 🔥 2. Update frontend
    dispatch(updateUserStatusLocally({ id: userId, active: false }));
    setUsers(prev =>
      prev.map(user =>
        user.id === userId ? { ...user, active: false } : user
      )
    );

    setSnackbar({
      open: true,
      message: "User deactivated successfully",
      severity: "success",
    });
  } catch (err) {
    console.error("Deactivate failed", err);
  }
};


 const handleRestoreUser = async (userId: string) => {
  try {
    await fetch(`http://127.0.0.1:8000/purchasetestapi/users/${userId}/activate`, {
      method: "PATCH",
    });

    dispatch(updateUserStatusLocally({ id: userId, active: true }));
    setUsers(prev =>
      prev.map(user =>
        user.id === userId ? { ...user, active: true } : user
      )
    );

    setSnackbar({
      open: true,
      message: "User restored successfully",
      severity: "success",
    });
  } catch (err) {
    console.error("Restore failed", err);
  }
};

  const resetForm = () => {
    setFormUser({
      id: "",
      username: "",
      password: "",
      confirmPassword: "",
      role: "",
      active: true,
    });
    setEditingUserId(null);
  };
 // ✅ ADD THIS useEffect TO FETCH USERS FROM BACKEND
// ✅ UPDATE THIS FUNCTION TO FETCH FROM ROLE MANAGEMENT
const fetchUsersFromBackend = async () => {
  try {
    console.log("Fetching users from backend...");
    const response = await fetch('http://127.0.0.1:8000/purchasetestapi/users');
    
    if (response.ok) {
      const usersFromBackend = await response.json();
      console.log("Users from backend:", usersFromBackend);
      
      if (Array.isArray(usersFromBackend)) {
        const transformedUsers = usersFromBackend.map((user: any) => ({
          id: user._id || user.id,
          username: user.username,
          password: '••••••••',
          confirmPassword: '••••••••',
          role: user.role_name || user.role,
          active: user.is_active !== false
        }));
        
        setUsers(transformedUsers);
        console.log("Transformed users:", transformedUsers);
      } else {
        console.error('Unexpected response format from backend:', usersFromBackend);
        setUsers([]);
      }
    } else {
      console.error('Failed to fetch users from backend. Status:', response.status);
      setUsers([]);
    }
  } catch (error) {
    console.error('Error fetching users from backend:', error);
    setUsers([]);
  }
};
    return (
   <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-4 mx-auto max-w-[1150px] w-full">

      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        {/* Search */}
        <div className="w-80">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
        </div>
{/* ✅ Snackbar */}
<Snackbar
  open={snackbar.open}
  autoHideDuration={3000}
  onClose={() => setSnackbar({ ...snackbar, open: false })}
 anchorOrigin={{ vertical: "bottom", horizontal: "left" }}

>
  <Alert
    onClose={() => setSnackbar({ ...snackbar, open: false })}
    severity={snackbar.severity}
    sx={{  width: "100%",
    backgroundColor: "#2e7d32", // ✅ dark green
    color: "#ffffff",          // white text
    "& .MuiAlert-icon": {
      color: "#ffffff",        // white icon
    }, }}
  >
    {snackbar.message}
  </Alert>
</Snackbar>

        {/* Add + Toggle */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              resetForm();
              setUserModal(true);
            }}
            className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-all duration-200 flex items-center justify-center gap-2 px-4 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>

          {/* Active/Inactive Toggle - Updated */}
          <div className="flex items-center gap-2">
            {/* ✅ Toggle text changes based on state */}
            <span className="text-sm text-gray-600">
              {showActive ? "Show Active" : "Show Inactive"}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showActive}
                onChange={(e) => setShowActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
              <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transform peer-checked:translate-x-5 transition"></div>
            </label>
          </div>
        </div>
      </div>

      {/* CSS GRID TABLE */}
<div className="max-h-[calc(100vh-260px)] overflow-y-auto">        {/* Table Header */}
      <div className="grid grid-cols-[70px_160px_120px_170px_240px_110px_120px]


     bg-gray-50 border-b border-gray-200 text-xs font-semibold sticky top-0 z-10">
          <div className="p-4 text-left text-gray-700 uppercase">S.NO</div>
          <div className="p-4 text-left text-gray-700 uppercase">USERNAME</div>
          <div className="p-4 text-left text-gray-700 uppercase">PASSWORD</div>
          <div className="p-4 text-left text-gray-700 uppercase">ROLE</div>
            <div className="p-4 text-left text-gray-700 uppercase">APP</div>

          <div className="p-4 text-center text-gray-700 uppercase">STATUS</div>
          <div className="p-4 text-center text-gray-700 uppercase">ACTIONS</div>
        </div>

        {/* Table Body - Updated Empty State */}
        <div className="min-h-[200px] bg-white">
          {filteredUsers.length === 0 ? (
            <div className="flex justify-center items-center p-12 text-gray-500 text-sm w-full border-b">
              No {showActive ? "active" : "inactive"} users found.
            </div>
          ) : (
            filteredUsers.map((user, index) => (

              <div 
                key={user.id} 
             className="grid grid-cols-[70px_160px_120px_170px_240px_110px_120px]
 border-b border-gray-200 hover:bg-gray-50 text-sm transition-colors"
              >
                {/* S.NO */}
                <div className="px-3 py-2 flex items-center text-gray-700 font-medium text-sm">
                  {index + 1}
                </div>

                {/* USERNAME */}
              <div className="px-3 py-2 flex items-center text-gray-800 text-sm truncate">
                  {user.username}
                </div>
                
                {/* PASSWORD */}
              <div className="px-3 py-2 flex items-center text-gray-600 text-sm">
                  ••••••••
                </div>
                
                {/* ROLE */}
                <div className="px-3 py-2 flex items-center">
                 <span className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-xs font-medium whitespace-nowrap inline-flex">
  {user.role}
</span>

                </div>
                {/* ✅ APP */}
<div className="px-3 py-2 flex items-center">
  {roleAppsMap[user.role]?.length ? (
    <div className="flex flex-wrap gap-2">
      {roleAppsMap[user.role].map((appName: string) => (
        <span
          key={appName}
          className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium whitespace-nowrap"
        >
          {appName}
        </span>
      ))}
    </div>
  ) : (
    <span className="text-xs text-gray-400">—</span>
  )}
</div>

                {/* STATUS */}
                <div className="px-3 py-2 flex items-center justify-center">
                  <span className={`px-4 py-2 rounded-full text-xs font-medium ${
                    user.active 
                      ? "bg-green-100 text-green-800" 
                      : "bg-red-100 text-red-800"
                  }`}>
                    {user.active ? "Active" : "Inactive"}
                  </span>
                </div>
                
                {/* ACTIONS */}
                <div className="px-3 py-2 flex items-center justify-center">
                  <div className="flex justify-center gap-4">
                    {user.active ? (
                      <>
                        <button
  onClick={() => {
    setEditingUserId(user.id);
    setFormUser({
      id: user.id,
      username: user.username,
      password: '••••••••', // Masked password
      confirmPassword: '••••••••', // Masked confirm password
      role: user.role,
      active: user.active,
    });
    setUserModal(true);
  }}
  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors"
  title="Edit User"
>
  <Pencil className="w-4 h-4" />
</button>
                        <button
                          onClick={() => {
                            setConfirmDialog({
                              open: true,
                              title: "Deactivate User",
                              message: `Are you sure you want to deactivate "${user.username}"?`,
                              onConfirm: () => {
                                handleDeactivateUser(user.id);
                                setConfirmDialog({ open: false, title: "", message: "", onConfirm: () => {} });
                              },
                            });
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors"
                          title="Deactivate User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setConfirmDialog({
                            open: true,
                            title: "Restore User",
                            message: `Are you sure you want to restore "${user.username}"?`,
                            onConfirm: () => {
                              handleRestoreUser(user.id);
                              setConfirmDialog({ open: false, title: "", message: "", onConfirm: () => {} });
                            },
                          });
                        }}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg border border-green-200 transition-colors"
                        title="Restore User"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* User Modal */}
      {userModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50 backdrop-blur-sm">
        <div className="bg-white p-6 rounded-xl w-[400px] max-h-[90vh] overflow-hidden">


            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                {editingUserId ? "Edit User" : "Create User"}
              </h3>
              <button 
                onClick={() => setUserModal(false)} 
                className="text-gray-500 hover:text-gray-700 text-lg p-1 rounded-full hover:bg-gray-100"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                <input
                  placeholder="Enter username"
                  value={formUser.username}
                  onChange={(e) => setFormUser({ ...formUser, username: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            <div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Password
  </label>

  <div className="relative">
    <input
      type={showPassword ? "text" : "password"}
      placeholder="Enter password"
      value={formUser.password}
      onChange={(e) =>
        setFormUser({ ...formUser, password: e.target.value })
      }
      className="w-full border border-gray-300 rounded-lg p-3 pr-10
                 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    />

    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      className="absolute right-3 top-1/2 -translate-y-1/2
                 text-gray-500 hover:text-gray-700"
      tabIndex={-1}
    >
      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
    </button>
  </div>
</div>

             <div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Confirm Password
  </label>

  <div className="relative">
    <input
      type={showConfirmPassword ? "text" : "password"}
      placeholder="Confirm password"
      value={formUser.confirmPassword}
      onChange={(e) =>
        setFormUser({ ...formUser, confirmPassword: e.target.value })
      }
      className="w-full border border-gray-300 rounded-lg p-3 pr-10
                 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    />

    <button
      type="button"
      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
      className="absolute right-3 top-1/2 -translate-y-1/2
                 text-gray-500 hover:text-gray-700"
      tabIndex={-1}
    >
      {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
    </button>
  </div>
</div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                {/* ✅ UPDATED ROLE DROPDOWN - SHOWS ROLES FROM BACKEND */}
               <select
            value={formUser.role}
            onChange={(e) => setFormUser({ ...formUser, role: e.target.value })}
            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">-- Select Role --</option>
            {roles.map((role) => (
              <option key={role.id} value={role.name}>
                {role.name} ({role.role_type})
              </option>
            ))}
          </select>
          {/* Show message if no roles available */}
          {roles.length === 0 && (
            <p className="text-xs text-red-500 mt-1">
              No roles available. Please create roles first in Role Management.
            </p>
          )}
        </div>
      </div>


            <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => setUserModal(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
             <button
  onClick={() => {
    // 🟡 Create user → direct save
    if (!editingUserId) {
      handleSaveUser();
      return;
    }

    // 🔴 Edit user → confirmation dialog
    setConfirmDialog({
      open: true,
      title: "Update User",
      message: `Are you sure you want to update user "${formUser.username}"?`,
      onConfirm: () => {
        handleSaveUser();
        setConfirmDialog({
          open: false,
          title: "",
          message: "",
          onConfirm: () => {},
        });
      },
    });
  }}
  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
>
  {editingUserId ? "Update User" : "Create User"}
</button>

            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog.open && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm text-center">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">{confirmDialog.title}</h3>
            <p className="text-gray-600 mb-6">{confirmDialog.message}</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setConfirmDialog({ open: false, title: "", message: "", onConfirm: () => {} })}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDialog.onConfirm()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
