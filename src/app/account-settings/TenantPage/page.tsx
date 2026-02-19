"use client";

import React, { useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import axios from "axios";
import { RotateCcw } from "lucide-react";

import { Snackbar, Alert } from "@mui/material";

interface Tenant {
  _id: string;
  tenantId: string;
  tenantName: string;
  status: string;
}

export default function TenantPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showActive, setShowActive] = useState(true);
  const [tenantModal, setTenantModal] = useState(false);
  const [tenantName, setTenantName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [restoreId, setRestoreId] = useState<string | null>(null);
const [editingTenantId, setEditingTenantId] = useState<string | null>(null);

const [snackbar, setSnackbar] = useState({
  open: false,
  message: "",
  severity: "success" as "success" | "error" | "warning",
});


  const API = "http://127.0.0.1:8000/purchasetestapi";

  // ✅ Fetch tenants
 const fetchTenants = async () => {
  try {
    const res = await axios.get(`${API}/tenants/`, {
      params: { status: showActive ? "active" : "inactive" },
    });
    setTenants(res.data);
  } catch (err) {
    console.error(err);
  }
};


  useEffect(() => {
    fetchTenants();
  }, [showActive]);

  const filteredTenants = tenants.filter((t) =>
    t.tenantName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ✅ Create tenant
  const handleCreateTenant = async () => {
    try {
      await axios.post(`${API}/tenants/`, {
        tenantName,
        description: "",
        status: "active",
        createDefaultCollections: true,
      });

      setSnackbar({
        open: true,
        message: "Tenant created successfully",
        severity: "success",
      });

      setTenantModal(false);
      setTenantName("");
      fetchTenants();
    } catch (err) {
      setSnackbar({
        open: true,
        message: "Failed to create tenant",
        severity: "error",
      });
    }
  };
const handleUpdateTenant = async () => {
  if (!editingTenantId) return;
 if (!tenantName.trim()) {
    setSnackbar({
      open: true,
      message: "Tenant name cannot be empty",
      severity: "error",
    });
    return;
  }
  try {
    const res = await axios.put(`${API}/tenants/${editingTenantId}`, {
      tenantName: tenantName,   // ✅ explicit key
      description: "",          // ✅ send optional fields
    });

    setSnackbar({
      open: true,
      message: "Tenant updated successfully",
      severity: "success",
    });

    setTenantModal(false);
    setTenantName("");
    setEditingTenantId(null);

    fetchTenants();
  } catch (err: any) {
    console.error("UPDATE ERROR 👉", err?.response?.data);

    setSnackbar({
      open: true,
      message: err?.response?.data?.detail || "Failed to update tenant",
      severity: "error",
    });
  }
};


  // ✅ Delete tenant
  const handleDeleteTenant = async () => {
    if (!deleteId) return;

    try {
      await axios.delete(`${API}/tenants/${deleteId}`);
      setSnackbar({
        open: true,
        message: "Tenant deactivated",
        severity: "success",
      });
      setDeleteId(null);
      fetchTenants();
    } catch (err) {
      console.error(err);
    }
  };
const handleActivateTenant = async () => {
  if (!restoreId) return;

  try {
    await axios.patch(`${API}/tenants/${restoreId}/restore`);

    setSnackbar({
      open: true,
      message: "Tenant restored successfully",
      severity: "success",
    });

    setRestoreId(null);
    fetchTenants();
  } catch (err) {
    setSnackbar({
      open: true,
      message: "Failed to restore tenant",
      severity: "error",
    });
  }
};


  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-4 mx-auto max-w-[1150px] w-full">

      {/* 🔍 HEADER */}
      <div className="flex justify-between items-center mb-6">

        <div className="w-80 relative">
          <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
          <input
            placeholder="Search tenant..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setTenantModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
          >
            <Plus size={16} /> Create Tenant
          </button>

          {/* Toggle */}
          <div className="flex items-center gap-2">
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

    {/* 📋 TABLE CONTAINER */}
<div className="max-h-[calc(100vh-260px)] overflow-y-auto bg-white">
  
  {/* Header */}
<div className="grid grid-cols-5 bg-white text-xs font-semibold border-b sticky top-0 z-0">

  <div className="px-4 py-3">S.NO</div>
  <div className="px-4 py-3">TENANT ID</div>
  <div className="px-4 py-3">TENANT NAME</div>
  <div className="px-4 py-3 text-center">STATUS</div>
  <div className="px-4 py-3 text-center">ACTIONS</div>
</div>

{filteredTenants.length === 0 ? (
  <div className="p-10 text-center text-gray-500">
    No tenants found
  </div>
) : (
  filteredTenants.map((t, i) => (
    <div
      key={t._id}
      className="grid grid-cols-5 border-b hover:bg-gray-50 text-sm"
    >
      <div className="px-4 py-3">{i + 1}</div>
      <div className="px-4 py-3">{t.tenantId}</div>
      <div className="px-4 py-3">{t.tenantName}</div>

      <div className="px-4 py-3 flex justify-center">
        <span
          className={`px-4 py-1 rounded-full text-xs font-medium ${
            t.status === "active"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {t.status === "active" ? "Active" : "Inactive"}
        </span>
      </div>

     <div className="px-4 py-3 flex justify-center gap-3">
  {showActive ? (
    <>
     <button
  onClick={() => {
    setEditingTenantId(t._id);
    setTenantName(t.tenantName);
    setTenantModal(true);
  }}
  className="p-2 border rounded-lg text-blue-600"
>
  <Pencil size={16} />
</button>

      <button
        onClick={() => setDeleteId(t._id)}
        className="p-2 border rounded-lg text-red-600"
      >
        <Trash2 size={16} />
      </button>
    </>
  ) : (
   <button
  onClick={() => setRestoreId(t._id)}
  className="p-2 border rounded-lg text-green-600 hover:bg-green-50"
>
  <RotateCcw size={16} />
</button>

  )}
</div>
 
    </div>
  ))
)}
</div>



      {/* 🧾 CREATE MODAL */}
     {tenantModal && (
  <div
    className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50"
    onClick={() => {
      setTenantModal(false);
      setEditingTenantId(null);
      setTenantName("");
    }}
  >
    <div
      className="bg-white rounded-xl p-6 w-96 space-y-4"
      onClick={(e) => e.stopPropagation()}
    >

           <h3 className="text-lg font-semibold">
  {editingTenantId ? "Edit Tenant" : "Create Tenant"}
</h3>

            <input
              placeholder="Tenant name"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
            className="w-full border border-gray-300 p-2 rounded-lg 
focus:outline-none 
focus:ring-2 
focus:ring-blue-600 
focus:border-blue-600"

            />
            <div className="flex justify-end gap-3">
             <button
  onClick={() => {
    setTenantModal(false);
    setEditingTenantId(null);
    setTenantName("");
  }}
>
  Cancel
</button>

              <button
              onClick={editingTenantId ? handleUpdateTenant : handleCreateTenant}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🗑 CONFIRM DELETE */}
   {/* 🗑 DEACTIVATE MODAL — NEW DESIGN */}
{deleteId && (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
    <div className="bg-white rounded-2xl shadow-lg w-[420px] p-6 text-center">

      {/* Title */}
      <h2 className="text-lg font-semibold text-gray-800 mb-2">
        Deactivate Tenant
      </h2>

      {/* Description */}
  <p className="text-sm text-gray-500 mb-6">
  {`Are you sure you want to deactivate "${tenants.find(t => t._id === deleteId)?.tenantName}"?`}
</p>



      {/* Buttons */}
      <div className="flex justify-center gap-4">
        <button
          onClick={() => setDeleteId(null)}
          className="px-5 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
        >
          Cancel
        </button>

        <button
          onClick={handleDeleteTenant}
          className="px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
)}

{/* 🔄 RESTORE MODAL */}
{restoreId && (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
    <div className="bg-white rounded-2xl shadow-lg w-[420px] p-6 text-center">

      {/* Title */}
      <h2 className="text-lg font-semibold text-gray-800 mb-2">
        Restore Tenant
      </h2>

      {/* Description */}
    <p className="text-sm text-gray-500 mb-6">
  {`Are you sure you want to restore "${tenants.find(t => t._id === restoreId)?.tenantName}"?`}
</p>


      {/* Buttons */}
      <div className="flex justify-center gap-4">
        <button
          onClick={() => setRestoreId(null)}
          className="px-5 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
        >
          Cancel
        </button>

        <button
          onClick={handleActivateTenant}
          className="px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
)}

      {/* 🔔 SNACKBAR */}
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
      color: "#ffffff",

      ...(snackbar.severity === "success" && {
        backgroundColor: "#2e7d32",
      }),

      ...(snackbar.severity === "warning" && {
        backgroundColor: "#ed6c02",
      }),

      ...(snackbar.severity === "error" && {
        backgroundColor: "#d32f2f",
      }),

      "& .MuiAlert-icon": {
        color: "#ffffff",
      },
    }}
  >
    {snackbar.message}
  </Alert>
</Snackbar>


    </div>
  );
}
