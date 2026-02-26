"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSelector, useDispatch } from 'react-redux';
import { fetchRoles, addRoleLocally, updateRoleLocally, deleteRoleLocally } from '@/features/account-setting/roleSlice';
import { Plus, Pencil, Trash2, RotateCcw, Search, Eye, X, Check, Shield } from "lucide-react";
import { Snackbar, Alert } from "@mui/material";

// Types
type ActionKeys = "add" | "edit" | "delete" | "read" | "approve" | "hide";
type Submodule = { id: string; name: string; actions: Record<ActionKeys, boolean> };
type ModuleItem = { id: string; name: string; submodules: Submodule[] };
type AppPermissions = { appName: string; modules: ModuleItem[] };
type RoleRecord = { 
  id: string; 
  _id?: string; 
  roleName: string; 
  permissions: AppPermissions[]; 
  active: boolean; 
  roleType?: string; 
  
};


const getPermissionSummary = (
  permissions: AppPermissions[],
  action: "add" | "edit" | "delete" | "read" | "approve"
) => {
  let total = 0;
  let enabled = 0;

  permissions.forEach(app => {
    app.modules.forEach(module => {
  module.submodules.forEach(sub => {
  // 🔥 IMPORTANT: consider only active/visible submodules
  const hasAnyPermission =
    sub.actions.read ||
    sub.actions.add ||
    sub.actions.edit ||
    sub.actions.delete ||
    sub.actions.approve;

  if (!hasAnyPermission) return; // ⛔ ignore untouched submodules

  total++;
  if (sub.actions[action]) enabled++;
});

    });
  });

  if (enabled === 0) {
    return { hasAccess: false, status: "None" };
  }

  if (enabled === total) {
    return { hasAccess: true, status: "Complete" };
  }

  return { hasAccess: true, status: "Partial" };
};


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

const ROLE_OPTIONS = [
  "Admin",
  "Purchase Manager",
  "Purchase Assistant",
  "Store Incharge",
  "Accounts Assistant",
  "Finance Assistant"
];


// Permission View Modal Component
// Permission View Modal Component - ONLY MODULES, NO SUBMODULES
const PermissionViewModal = ({ 
  role, 
  isOpen, 
  onClose 
}: { 
  role: RoleRecord; 
  isOpen: boolean; 
  onClose: () => void; 
}) => {
  if (!isOpen || !role) return null;

  // Filter out hide permissions and check if submodule has any visible permissions
  const hasVisiblePermissions = (actions: Record<ActionKeys, boolean>): boolean => {
    const { hide, ...visibleActions } = actions;
    return Object.values(visibleActions).some(Boolean);
  };
const normalizePermissionsForView = (
  permissions: AppPermissions[]
): AppPermissions[] => {
  const result: AppPermissions[] = [];

  permissions.forEach((app: AppPermissions) => {
    // 🔹 SPLIT ONLY PURCHASE
    if (app.appName === "YEN_PURCHASE") {
      const purchaseModules: ModuleItem[] = [];
      const bookModules: ModuleItem[] = [];

      app.modules.forEach((module: ModuleItem) => {
        const purchaseSubs: Submodule[] = [];
        const bookSubs: Submodule[] = [];

        module.submodules.forEach((sub: Submodule) => {
          const hasVisible =
            sub.actions.read ||
            sub.actions.add ||
            sub.actions.edit ||
            sub.actions.delete ||
            sub.actions.approve;

          if (!hasVisible) return;

          if (PURCHASE_SUBMODULES.includes(sub.id)) {
            purchaseSubs.push(sub);
          }

          if (BOOK_SUBMODULES.includes(sub.id)) {
            bookSubs.push(sub);
          }
        });

        if (purchaseSubs.length) {
          purchaseModules.push({ ...module, submodules: purchaseSubs });
        }

        if (bookSubs.length) {
          bookModules.push({ ...module, submodules: bookSubs });
        }
      });

      if (purchaseModules.length) {
        result.push({
          appName: "YEN_PURCHASE",
          modules: purchaseModules,
        });
      }

      if (bookModules.length) {
        result.push({
          appName: "YEN_BOOK",
          modules: bookModules,
        });
      }

      return;
    }

    // 🔹 ALL OTHER APPS
    const visibleModules = app.modules.filter(
      (module: ModuleItem) =>
        module.submodules.some(
          (sub: Submodule) =>
            sub.actions.read ||
            sub.actions.add ||
            sub.actions.edit ||
            sub.actions.delete ||
            sub.actions.approve
        )
    );

    if (visibleModules.length) {
      result.push({
        appName: app.appName,
        modules: visibleModules,
      });
    }
  });

  return result;
};


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
      {/* Reduced width and height - properly centered */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden mx-auto my-auto flex flex-col">
        {/* Modal Header - REDUCED SIZE */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 text-white flex-shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold">View Role Permissions</h3>
                <p className="text-blue-100 text-sm">Detailed view of all assigned permissions</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors duration-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          {/* Role Info - COMPACT GRID */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="bg-white/10 rounded p-2 backdrop-blur-sm">
              <div className="text-blue-100 text-xs">Role Name</div>
              <div className="text-white font-semibold text-sm">{role.roleName}</div>
            </div>
            <div className="bg-white/10 rounded p-2 backdrop-blur-sm">
              <div className="text-blue-100 text-xs">Type</div>
              <div className="text-white font-semibold text-sm">{role.roleType || "Custom"}</div>
            </div>
            <div className="bg-white/10 rounded p-2 backdrop-blur-sm">
              <div className="text-blue-100 text-xs">Status</div>
              <div className="text-white font-semibold text-sm">{role.active ? "Active" : "Inactive"}</div>
            </div>
          </div>
        </div>

        {/* Static Table Header - Fixed (No Scroll) */}
        <div className="bg-gray-50 border-b border-gray-200 flex-shrink-0">
          <div className="grid grid-cols-[2fr_repeat(5,1fr)] items-center gap-2 px-6 py-3 font-bold text-black text-sm">
            <div className="text-sm">Modules</div>
            <div className="text-center text-sm">Read</div>
            <div className="text-center text-sm">Add</div>
            <div className="text-center text-sm">Edit</div>
            <div className="text-center text-sm">Delete</div>
            <div className="text-center text-sm">Approve</div>
          </div>
        </div>

        {/* Scrollable Permission Content - Only Modules */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
{normalizePermissionsForView(role.permissions).map(
  (app: AppPermissions, appIndex: number) => {

              // Filter modules that have permissions
            const modulesWithPermissions = app.modules.filter(
  (module: ModuleItem) =>
    module.submodules.some(
      (submodule: Submodule) =>
        hasVisiblePermissions(submodule.actions)
    )
);


              if (modulesWithPermissions.length === 0) return null;

              return (
                <div key={`${app.appName}-${appIndex}`} className="mb-4">
                  {/* App Header */}
                  <div className="text-sm font-bold text-blue-600 mb-2 bg-blue-50 p-2 rounded">
                    {app.appName}
                  </div>
                  
                  {/* Modules Only - Single Row Each */}
                  <div className="space-y-2">
                    {modulesWithPermissions.map((module: ModuleItem) => (

                      <div 
                        key={`${app.appName}-${module.id}`} 
                        className="grid grid-cols-[2fr_repeat(5,1fr)] items-center gap-2 p-3 border border-gray-200 rounded bg-white hover:bg-gray-50 text-sm"
                      >
                        {/* Module Name */}
                        <div className="text-black font-medium">
                          {module.name}
                        </div>
                        
                        {/* Permission Checkboxes - Check if ANY submodule has this permission */}
                      {(['read', 'add', 'edit', 'delete', 'approve'] as ActionKeys[]).map(
  (action: ActionKeys) => {

                        const hasPermission = module.submodules.some(
  (submodule: Submodule) => submodule.actions[action]
);

                          
                          return (
                            <div 
                              key={`${module.id}-${action}`}
                              className="text-center"
                            >
                              <div className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs ${
                                hasPermission
                                  ? "bg-green-100 text-green-800 border border-green-300"
                                  : "bg-gray-100 text-gray-400 border border-gray-300"
                              }`}>
                                {hasPermission ? "✓" : "✗"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty State */}
          {!role.permissions.some(app => 
            app.modules.some(module => 
              module.submodules.some(submodule => hasVisiblePermissions(submodule.actions))
            )
          ) && (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Shield className="h-6 w-6 text-gray-400" />
              </div>
              <h4 className="text-base font-semibold text-gray-600 mb-2">No Permissions Assigned</h4>
              <p className="text-gray-500 max-w-md mx-auto text-xs">
                This role has no permissions assigned.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-3 flex-shrink-0">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium text-sm shadow-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default function RoleManagementPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  // ✅ Snackbar state
const [snackbar, setSnackbar] = useState({
  open: false,
  message: "",
  severity: "success" as "success" | "error",
});

  const { items: reduxRoles, loading } = useSelector((state: any) => state.role);
  
const [roles, setRoles] = useState<RoleRecord[]>([]);

 const [showActive, setShowActive] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });
  const [viewModal, setViewModal] = useState({
    open: false,
    role: null as RoleRecord | null,
  });
useEffect(() => {
  if (reduxRoles && reduxRoles.length > 0) {
    setRoles(reduxRoles);
  }
}, [reduxRoles]);


  useEffect(() => {
    dispatch(fetchRoles() as any);
  }, [dispatch]);

  const handleViewPermissions = (role: RoleRecord) => {
    setViewModal({
      open: true,
      role: role,
    });
  };

  const handleCreateRole = () => {
    router.push("/account-settings/RoleManagementPage/create-role");
  };
const handleEditRole = (roleName: string) => {
  console.log("📝 Editing role by name:", roleName);
  
  if (!roleName || roleName.trim() === "") {
    console.error("❌ Invalid role name received:", roleName);
   setSnackbar({
  open: true,
  message: "Cannot edit: Invalid role name",
  severity: "error",
});

    return;
  }
  
  // Find role by name
  const roleToEdit = roles.find(r => r.roleName === roleName);
  
  if (!roleToEdit) {
    console.error("❌ Role not found with name:", roleName);
  setSnackbar({
  open: true,
  message: `Role "${roleName}" not found!`,
  severity: "error",
});

    return;
  }
  
  console.log("✅ Found role to edit:", roleToEdit.roleName);
  
  // Use roleName as the identifier
  router.push(`/account-settings/RoleManagementPage/edit-role?name=${encodeURIComponent(roleName)}`);
};
const handleDeleteRole = async (roleName: string) => {
  const roleToDelete = roles.find(r => r.roleName === roleName);
  if (!roleToDelete) return;

  await fetch(
    `http://127.0.0.1:8000/purchasetestapi/roles/${roleToDelete.id}/deactivate`,
    { method: "PUT" }
  );

  dispatch(fetchRoles() as any);

  setSnackbar({
    open: true,
    message: `Role "${roleName}" deactivated successfully`,
    severity: "success",
  });
};


const handleRestoreRole = async (roleName: string) => {
  const roleToRestore = roles.find(r => r.roleName === roleName);
  if (!roleToRestore) return;

  await fetch(
    `http://127.0.0.1:8000/purchasetestapi/roles/${roleToRestore.id}/restore`,
    { method: "PUT" }
  );

  dispatch(fetchRoles() as any);

  setSnackbar({
    open: true,
    message: `Role "${roleName}" restored successfully`,
    severity: "success",
  });
};


  const filteredRoles = React.useMemo(() => {
  return roles
    .filter(role => role.active === showActive)
    .filter(role =>
      role.roleName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    // Remove duplicates by roleName
    .filter((role, index, self) =>
      index === self.findIndex(r => r.roleName === role.roleName)
    )
    // ⭐ MAIN FIX: Predefined roles first, Custom next
    .sort((a, b) => {
      // 1️⃣ Predefined always first
      if (a.roleType === "Predefined" && b.roleType !== "Predefined") return -1;
      if (a.roleType !== "Predefined" && b.roleType === "Predefined") return 1;

      // 2️⃣ Same type → sort alphabetically
      return a.roleName.localeCompare(b.roleName);
    });
}, [roles, showActive, searchTerm]);


const getDescription = (role: RoleRecord) => {
  const accessibleModuleNames: string[] = [];

  // ✅ only these actions should count for description
  const isVisiblePermissionSelected = (actions: Record<ActionKeys, boolean>) => {
    return (
      actions.read ||
      actions.add ||
      actions.edit ||
      actions.delete ||
      actions.approve
    ); // ❌ hide ignored
  };

  role.permissions.forEach(app => {
    app.modules.forEach(m => {
      const hasAccess = m.submodules.some(sub =>
        isVisiblePermissionSelected(sub.actions)
      );

      if (hasAccess) {
        accessibleModuleNames.push(m.name);
      }
    });
  });

  if (accessibleModuleNames.length === 0) {
    return "No permissions assigned";
  }

  return `Access to: ${accessibleModuleNames.join(", ")}`;
};


  return (
  <div className="min-h-screen bg-gray-50 px-6 pt-3 pb-6 text-gray-900">

      <div className="w-full">
        {/* Role Management Container */}
<div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 pt-4 pb-10 w-full">

<div className="flex justify-between items-center mb-4">
  <div className="w-80">
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
      <input
        type="text"
        placeholder="Search role..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
      />
    </div>
  </div>

  <div className="flex items-center gap-4">
    <button
      onClick={handleCreateRole}
      className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-all duration-200 flex items-center justify-center gap-2 px-4 text-sm"
    >
      <Plus className="w-4 h-4" />
      Create Role
    </button>

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
          <div className="w-full border border-gray-200 rounded-lg overflow-hidden">
            {/* Table Header - Fixed */}
            <div className="grid grid-cols-[60px_1fr_90px_60px_60px_70px_80px_70px_2fr_120px]
 bg-gray-50 border-b border-gray-200 text-xs font-semibold">
              <div className="p-4 text-left text-gray-700 uppercase">S.NO</div>
              <div className="p-4 text-left text-gray-700 uppercase">ROLE NAME</div>
            <div className="p-4 text-left text-gray-700 uppercase pl-0 -ml-3">STATUS</div>


              <div className="p-4 text-center text-gray-700 uppercase">ADD</div>
              <div className="p-4 text-center text-gray-700 uppercase">EDIT</div>
              <div className="p-4 text-center text-gray-700 uppercase">DELETE</div>
              <div className="p-4 text-center text-gray-700 uppercase">APPROVE</div>
              <div className="p-4 text-center text-gray-700 uppercase">READ</div>
              <div className="p-4 text-center text-gray-700 uppercase">DESCRIPTION</div>
              <div className="p-4 text-center text-gray-700 uppercase">ACTIONS</div>
            </div>

            {/* Table Body - Scrollable Container */}
<div className="max-h-[calc(100vh-330px)] overflow-y-auto">
  {filteredRoles.map((role, index) => {
const actionSummary = {
  add: getPermissionSummary(role.permissions, "add"),
  edit: getPermissionSummary(role.permissions, "edit"),
  delete: getPermissionSummary(role.permissions, "delete"),
  read: getPermissionSummary(role.permissions, "read"),
  approve: getPermissionSummary(role.permissions, "approve"),
};


    // ✅ ADD: Check for duplicate role names (optional debugging)
    const isDuplicate = filteredRoles.findIndex(r => r.roleName === role.roleName) !== index;
    
    return (
      <div 
        key={role.id || `role-${index}`} 
        className={`grid grid-cols-[60px_1fr_90px_60px_60px_70px_70px_60px_2fr_120px]
 border-b border-gray-200 hover:bg-gray-50 text-sm transition-colors ${
          isDuplicate ? 'bg-yellow-50' : ''
        }`}
      >
        {/* S.NO */}
        <div className="p-4 flex items-center text-gray-700 font-medium text-sm">
          {index + 1}
          {/* ✅ ADD: Show duplicate warning if needed */}
          {isDuplicate && (
            <span className="ml-2 text-xs text-red-500" title="Duplicate role name">
              ⚠
            </span>
          )}
        </div>
        
        {/* ROLE NAME */}
        <div className="p-4 flex items-center text-blue-600 font-medium text-sm">
          {role.roleName}
        </div>
                    
                    {/* STATUS */}
                <div className="p-4 flex items-center justify-start pl-0 -ml-7">


                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          role.roleType === "Predefined"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {role.roleType}
                      </span>
                    </div>
                    
                    {/* ACTION COLUMNS */}
          {/* ACTION COLUMNS - NEW CODE */}
<div className="p-4 text-center flex flex-col items-center justify-center">
  <span className={`text-sm font-bold ${
    actionSummary.add.hasAccess 
      ? actionSummary.add.status === "Complete" ? "text-green-600" : "text-green-600"
      : "text-red-500"
  }`}>
    {actionSummary.add.hasAccess ? "✓" : "✗"}
  </span>
  <span className="text-xs text-gray-500 mt-1">
    {actionSummary.add.status}
  </span>
</div>
<div className="p-4 text-center flex flex-col items-center justify-center">
  <span className={`text-sm font-bold ${
    actionSummary.edit.hasAccess 
      ? actionSummary.edit.status === "Complete" ? "text-green-600" : "text-green-600"
      : "text-red-500"
  }`}>
    {actionSummary.edit.hasAccess ? "✓" : "✗"}
  </span>
  <span className="text-xs text-gray-500 mt-1">
    {actionSummary.edit.status}
  </span>
</div>
<div className="p-4 text-center flex flex-col items-center justify-center">
  <span className={`text-sm font-bold ${
    actionSummary.delete.hasAccess 
      ? actionSummary.delete.status === "Complete" ? "text-green-600" : "text-green-600"
      : "text-red-500"
  }`}>
    {actionSummary.delete.hasAccess ? "✓" : "✗"}
  </span>
  <span className="text-xs text-gray-500 mt-1">
    {actionSummary.delete.status}
  </span>
</div>
<div className="p-4 text-center flex flex-col items-center justify-center">
  <span className={`text-sm font-bold ${
    actionSummary.approve.hasAccess
      ? "text-green-600"
      : "text-red-500"
  }`}>
    {actionSummary.approve.hasAccess ? "✓" : "✗"}
  </span>
  <span className="text-xs text-gray-500 mt-1">
    {actionSummary.approve.status}
  </span>
</div>
<div className="p-4 text-center flex flex-col items-center justify-center">
  <span className={`text-sm font-bold ${
    actionSummary.read.hasAccess 
      ? actionSummary.read.status === "Complete" ? "text-green-600" : "text-green-600"
      : "text-red-500"
  }`}>
    {actionSummary.read.hasAccess ? "✓" : "✗"}
  </span>
  <span className="text-xs text-gray-500 mt-1">
    {actionSummary.read.status}
  </span>
</div>
                    {/* DESCRIPTION */}
                    <div className="p-4 flex items-center">
                      <div 
                        className="text-gray-600 text-sm leading-tight line-clamp-2 w-full"
                        title={getDescription(role)}
                      >
                        {getDescription(role)}
                      </div>
                    </div>
                    
                    
                   

{/* ACTIONS */}
<div className="p-4 flex items-center justify-center">
  <div className="flex justify-center gap-2">
    {/* Eye Icon for Viewing Permissions - SHOW FOR ALL ROLES */}
    <button
      onClick={() => handleViewPermissions(role)}
      className="p-2 text-green-600 hover:bg-green-50 rounded-lg border border-green-200 transition-colors group"
      title="View Detailed Permissions"
    >
      <Eye className="w-4 h-4 group-hover:scale-110 transition-transform" />
    </button>

    {/* CONDITIONAL RENDERING BASED ON ROLE TYPE */}
    {role.active ? (
      <>
        {/* Only show Edit and Delete for CUSTOM roles */}
        {role.roleType === "Custom" && (
          <>
            {/* Edit Button - ONLY FOR CUSTOM ROLES */}
            <button
              onClick={() => handleEditRole(role.roleName)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors group"
              title="Edit Role"
            >
              <Pencil className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
            
            {/* Delete Button - ONLY FOR CUSTOM ROLES */}
            <button
              onClick={() => {
                setConfirmDialog({
                  open: true,
                  title: "Delete Role",
                  message: `Are you sure you want to delete "${role.roleName}"?`,
                  onConfirm: () => {
                    handleDeleteRole(role.roleName);
                    setConfirmDialog({ open: false, title: "", message: "", onConfirm: () => {} });
                  }
                });
              }}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors group"
              title="Delete Role"
            >
              <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          </>
        )}
      </>
    ) : (
      /* Restore Button - ONLY FOR CUSTOM INACTIVE ROLES */
      role.roleType === "Custom" && (
        <button
          onClick={() => {
            setConfirmDialog({
              open: true,
              title: "Restore Role",
              message: `Are you sure you want to restore "${role.roleName}"?`,
              onConfirm: () => {
                handleRestoreRole(role.roleName);
                setConfirmDialog({ open: false, title: "", message: "", onConfirm: () => {} });
              }
            });
          }}
          className="p-2 text-green-600 hover:bg-green-50 rounded-lg border border-green-200 transition-colors group"
          title="Restore Role"
        >
          <RotateCcw className="w-4 h-4 group-hover:scale-110 transition-transform" />
        </button>
      )
    )}
  </div>
</div>
                  </div>
                );
              })}
              
              {/* Empty State */}
              {filteredRoles.length === 0 && (
                <div className="grid grid-cols-[60px_1fr_100px_60px_60px_70px_60px_2fr_120px] border-b border-gray-200">
                  <div className="p-12 text-center text-gray-500 text-sm col-span-9">
                    No {showActive ? "active" : "inactive"} roles found.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Confirmation Dialog */}
        {confirmDialog.open && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm text-center animate-fadeIn">
              <p className="text-lg font-medium text-gray-800 mb-6">{confirmDialog.message}</p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setConfirmDialog({ open: false, title: "", message: "", onConfirm: () => {} })}
                  className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmDialog.onConfirm()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Permission View Modal */}
        {viewModal.open && viewModal.role && (
          <PermissionViewModal
            role={viewModal.role}
            isOpen={viewModal.open}
            onClose={() => setViewModal({ open: false, role: null })}
          />
        )}
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
    sx={{
      width: "100%",
      backgroundColor:
        snackbar.severity === "success" ? "#2e7d32" : "#d32f2f",
      color: "#fff",
      "& .MuiAlert-icon": {
        color: "#fff",
      },
    }}
  >
    {snackbar.message}
  </Alert>
</Snackbar>

      </div>
    </div>
  );
}



