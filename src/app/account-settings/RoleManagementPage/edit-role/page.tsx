"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDispatch } from 'react-redux';
import { updateRoleLocally } from '@/features/account-setting/roleSlice';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Slide from '@mui/material/Slide';

import Tooltip from "@mui/material/Tooltip";

// Types
type ActionKeys = "read" | "add" | "edit" | "delete" | "hide" | "approve";
type Submodule = { id: string; name: string; actions: Record<ActionKeys, boolean> };
type ModuleItem = { id: string; name: string; submodules: Submodule[] };
type AppPermissions = { appName: string; modules: ModuleItem[] };

const HARD_MODULES: AppPermissions[] = [
  {
    appName: "YEN_PURCHASE",
    modules: [
      {
        id: "pm",
        name: "Purchase Master",
        submodules: [
          { id: "pm_pc", name: "Purchase Category", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
          { id: "pm_ps", name: "Purchase Subcategory", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
          { id: "pm_pu", name: "Purchase UOM", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
          { id: "pm_gi", name: "Group Item", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
          { id: "pm_pt", name: "Purchase Tax", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
          { id: "pm_sl", name: "Storage Location", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
          { id: "pm_it", name: "Item Type", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
           { id: "pm_fr", name: "Freight", actions: { read:false, add:false, edit:false, delete:false, hide:false, approve:false } },
           { 
  id: "pm_service", 
  name: "Service", 
  actions: { read:false, add:false, edit:false, delete:false, hide:false, approve:false } 
},
        ]
      },
      {
        id: "vendor",
        name: "Vendor",
        submodules: [
          { id: "vt", name: "Vendor Type", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
          { id: "v", name: "Vendors", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } }
        ]
      },
      {
        id: "pi",
        name: "Purchase Item",
        submodules: [
          { id: "pi_default", name: "Default", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } }
        ]
      },
      {
        id: "po",
        name: "Purchase Order",
        submodules: [
          { id: "po_pending", name: "Pending", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
          { id: "po_approved", name: "Approved", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
          { id: "po_rejected", name: "Rejected", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } }
        ]
      },
      {
  id: "so",
  name: "Service Order",
  submodules: [
    {
      id: "so_pending",
      name: "Pending",
      actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false }
    },
    {
      id: "so_approved",
      name: "Approved",
      actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false }
    },
    {
      id: "so_rejected",
      name: "Rejected",
      actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false }
    }
  ]
},

      {
        id: "grn",
        name: "GRN Note",
        submodules: [
          { id: "grn_list", name: "GRN List", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
          { id: "grn_return", name: "Return GRN", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } }
        ]
      },
      {
        id: "ap",
        name: "AP Invoice",
        submodules: [
          { id: "ap_list", name: "AP List", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
        ]
      }
    ]
  },
  {
    appName: "YEN_BOOK",
    modules: [
      {
        id: "out",
        name: "Outgoing Payment",
        submodules: [
          { id: "op_outgoing", name: "Outgoing Payment", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
          { id: "op_advance", name: "Advance Payment", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
          { id: "op_partial", name: "Partial Payment", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
          { id: "op_done", name: "Payment Done", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
           { 
      id: "op_history", 
      name: "Payment History", 
      actions: { read:false, add:false, edit:false, delete:false, hide:false, approve:false } 
    },
          { id: "op_ledger", name: "Ledger", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
          { id: "op_return", name: "Purchase Return", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } }
        ]
      }
    ]
  },
  {
  appName: "YEN_OUTLET_MANAGER",
  modules: [
    {
      id: "outlet_manager",
      name: "Outlet Manager",
      submodules: [
        {
          id: "om_so",
          name: "Sale Order",
          actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false }
        },
        {
          id: "om_lst",
          name: "Location Stock Transfer",
          actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false }
        },
        {
          id: "om_sfg",
          name: "SFG to FG",
          actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false }
        }
      ]
    }
  ]
},
{
  appName: "YEN_POS",
  modules: [
    {
      id: "pos",
      name: "POS",
      submodules: [
        { id: "pos_order_mgmt", name: "Order Management", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
        { id: "pos_sales_return", name: "Sales Return", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
        { id: "pos_payment_settings", name: "Payment Settings", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
        { id: "pos_bill_sale_order", name: "Bill Settings Sale Order", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
        { id: "pos_bill_takeaway", name: "Bill Settings Takeaway", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
        { id: "pos_gst_settings", name: "GST Settings", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
        { id: "pos_credit_customer", name: "Credit Customer", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
        { id: "pos_device_config", name: "Device Configurations", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
        { id: "pos_customer_mgmt", name: "Customer Management", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } },
      ]
    }
  ]
},


];
// ✅ AUTO DEFAULT: If no permission selected => Hide must be true
const applyDefaultHide = (apps: AppPermissions[]): AppPermissions[] => {
  const cloned = JSON.parse(JSON.stringify(apps));

  cloned.forEach((app: AppPermissions) => {
    app.modules.forEach((module: ModuleItem) => {
      module.submodules.forEach((sub: Submodule) => {
        const actions = sub.actions;

        const anyPermission =
          actions.read ||
          actions.add ||
          actions.edit ||
          actions.delete ||
          actions.approve;

        // ✅ if all unchecked => auto hide true
        if (!anyPermission) {
          actions.hide = true;
        }

        // ✅ safety: if hide true => others false
        if (actions.hide) {
          actions.read = false;
          actions.add = false;
          actions.edit = false;
          actions.delete = false;
          actions.approve = false;
        }
      });
    });
  });

  return cloned;
};

const ROLE_OPTIONS = [
  "Admin",
  "Purchase Manager",
  "Purchase Assistant",
  "Store Incharge",
  "Accounts Assistant",
  "Finance Assistant",
  "Biller"
];
const PERMISSION_INFO = {
  read: "Read: Allows users to view records only (no changes permitted).",
  add: "Add: Allows users to create and save new records.",
  edit: "Edit: Allows users to update or modify existing records.",
  delete: "Delete: Allows users to deactivate or remove records.",
  hide: "Hide: Restricts the module from being visible in the menu and screens.",
  approve: "Approve: Allows users to approve the order and move it to the next stage.",
};
const SUBMODULE_INFO: Record<string, React.ReactNode> = {
  pm_pc: (
    <div>
      <div className="font-semibold mb-1">Purchase Category</div>
      <ul className="list-disc pl-4 space-y-1">
        <li>Used to create and manage purchase categories.</li>
        <li>
          <b>Dependency:</b> Purchase Subcategory permissions are required for subcategory actions under a category.
        </li>
      </ul>
    </div>
  ),

  v: (
    <div>
      <div className="font-semibold mb-1">Vendors</div>
      <ul className="list-disc pl-4 space-y-1">
        <li>Used to create and manage vendor records.</li>
        <li>
          <b>Dependency:</b> Vendor Type permission is required to create/maintain vendors.
        </li>
      </ul>
    </div>
  ),

  pi_default: (
    <div>
      <div className="font-semibold mb-1">Purchase Item</div>
      <ul className="list-disc pl-4 space-y-1">
        <li>Used to create and manage purchase item records.</li>
        <li><b>Required Permissions:</b></li>
        <li>Purchase Category</li>
        <li>Purchase Subcategory</li>
        <li>Purchase UOM</li>
        <li>Group Item</li>
        <li>Purchase Tax</li>
        <li>Storage Location</li>
        <li>Freight</li>
        <li>Item Type</li>
      </ul>
    </div>
  ),

  po_pending: (
    <div>
      <div className="font-semibold mb-1">Purchase Order - Pending</div>
      <ul className="list-disc pl-4 space-y-1">
        <li>Used to view and manage pending purchase orders.</li>
        <li>
          <b>Approve permission controls:</b> Approve (✓) and Reject (✗).
        </li>
        <li><b>Required for PO creation:</b></li>
        <li>Vendor module permission</li>
        <li>Purchase Item permission</li>
        <li>Storage Location (Purchase Master) permission</li>
      </ul>
    </div>
  ),

  po_approved: (
    <div>
      <div className="font-semibold mb-1">Purchase Order - Approved</div>
      <ul className="list-disc pl-4 space-y-1">
        <li>Used to view approved purchase orders.</li>
        <li>
          <b>Edit permission controls:</b> Revert PO and Convert to GRN actions.
        </li>
      </ul>
    </div>
  ),

  po_rejected: (
    <div>
      <div className="font-semibold mb-1">Purchase Order - Rejected</div>
      <ul className="list-disc pl-4 space-y-1">
        <li>Used to view rejected purchase orders.</li>
        <li>
          <b>Edit permission controls:</b> Move to Pending action.
        </li>
        <li>
          <b>Delete permission controls:</b> Delete Permanently action.
        </li>
      </ul>
    </div>
  ),
so_pending: (
  <div>
    <div className="font-semibold mb-1">Service Order - Pending</div>
    <ul className="list-disc pl-4 space-y-1">
      <li>Used to view and manage pending service orders.</li>
      <li><b>Add permission controls:</b> Create Service action.</li>
      <li><b>Approve permission controls:</b> Approve and Reject actions.</li>
      <li><b>Required for Service creation:</b></li>
      <li>Vendor permission</li>
       <li>Service (Purchase Master) permission</li>
      <li>Purchase Tax (Purchase Master) permission</li>
    </ul>
  </div>
),
so_approved: (
  <div>
    <div className="font-semibold mb-1">Service Order - Approved</div>
    <ul className="list-disc pl-4 space-y-1">
      <li>Used to view approved service orders.</li>
      <li><b>Edit permission controls:</b> Convert to AP and Move to Pending actions.</li>
    </ul>
  </div>
),
so_rejected: (
  <div>
    <div className="font-semibold mb-1">Service Order - Rejected</div>
    <ul className="list-disc pl-4 space-y-1">
      <li>Used to view rejected service orders.</li>
      <li><b>Edit permission controls:</b> Move to Pending.</li>
      <li><b>Delete permission controls:</b> Delete Permanently.</li>
    </ul>
  </div>
),

  grn_list: (
    <div>
      <div className="font-semibold mb-1">GRN List</div>
      <ul className="list-disc pl-4 space-y-1">
        <li>Used to view and manage Goods Received Notes (GRN).</li>
        <li>
          <b>Required:</b> Purchase Order permissions must be enabled to access this module.
        </li>
        <li>
          <b>Edit permission controls:</b> Return GRN and Convert to AP actions.
        </li>
      </ul>
    </div>
  ),
   op_advance: (
    <div>
      <div className="font-semibold mb-1">Advance Payment</div>
      <ul className="list-disc pl-4 space-y-1">
        <li>Used to manage vendor advance payments.</li>
        <li>
          <b>Add permission controls:</b> Add Vendor button
        </li>
      </ul>
    </div>
  ),
  // ✅ POS Submodule Tooltips
pos_order_mgmt: (
<div>
  <div className="font-semibold mb-1">Order Management</div>
  <ul className="list-disc pl-4 space-y-1">
    <li><b>This screen is used to create and manage Sale Orders in POS.</b></li>
    <li><b>Read permission:</b> Full access to Order Management screen.</li>
    <li><b>Edit permission controls:</b> Cancel Order & Modify Order buttons.</li>
    <li><b>Hide permission:</b> Completely hides Order Management screen.</li>
  </ul>
</div>
),

pos_sales_return: (
  <div>
    <div className="font-semibold mb-1">Sales Return</div>
    <ul className="list-disc pl-4 space-y-1">
      <li>This is a <b>Transaction module button</b> inside POS.</li>
      <li><b>Read permission:</b> Sales Return button works and accessible.</li>
      <li><b>Hide permission:</b> Sales Return button will be hidden.</li>
    </ul>
  </div>
),

pos_payment_settings: (
  <div>
    <div className="font-semibold mb-1">Payment Settings</div>
    <ul className="list-disc pl-4 space-y-1">
      <li>Available in <b>More → System Settings</b>.</li>
      <li><b>Read permission:</b> Payment Settings screen visible.</li>
      <li><b>Add permission controls:</b> Toggle access inside Payment Settings.</li>
      <li><b>Hide permission:</b> Payment Settings screen will not appear.</li>
    </ul>
  </div>
),

pos_bill_sale_order: (
  <div>
    <div className="font-semibold mb-1">Bill Settings - Sale Order</div>
    <ul className="list-disc pl-4 space-y-1">
      <li>Available in <b>More → System Settings → Bill Settings</b>.</li>
      <li><b>Read permission:</b> Bill Settings Sale Order screen visible.</li>
      <li><b>Add permission controls:</b> Toggle access inside this screen.</li>
      <li><b>Hide permission:</b> Screen will be completely hidden.</li>
    </ul>
  </div>
),

pos_bill_takeaway: (
  <div>
    <div className="font-semibold mb-1">Bill Settings - Takeaway</div>
    <ul className="list-disc pl-4 space-y-1">
      <li>Available in <b>More → System Settings → Bill Settings</b>.</li>
      <li><b>Read permission:</b> Bill Settings Takeaway screen visible.</li>
      <li><b>Add permission controls:</b> Toggle access inside this screen.</li>
      <li><b>Hide permission:</b> Screen will be completely hidden.</li>
    </ul>
  </div>
),

pos_gst_settings: (
  <div>
    <div className="font-semibold mb-1">GST Settings</div>
    <ul className="list-disc pl-4 space-y-1">
      <li>Available in <b>More → System Settings</b>.</li>
      <li><b>Read permission:</b> GST Settings screen visible.</li>
      <li><b>Add permission controls:</b> Toggle access inside GST Settings.</li>
      <li><b>Hide permission:</b> GST Settings screen will not appear.</li>
    </ul>
  </div>
),

pos_credit_customer: (
  <div>
    <div className="font-semibold mb-1">Credit Customer</div>
    <ul className="list-disc pl-4 space-y-1">
      <li>Available as a screen inside <b>Settings</b>.</li>
      <li><b>Read permission:</b> Full access to Credit Customer screen.</li>
      <li><b>Hide permission:</b> Completely hides Credit Customer screen.</li>
    </ul>
  </div>
),

pos_device_config: (
  <div>
    <div className="font-semibold mb-1">Device Configurations</div>
    <ul className="list-disc pl-4 space-y-1">
      <li>Available in <b>More</b> section.</li>
      <li><b>Read permission:</b> Full access to Device Configuration screen.</li>
      <li><b>Hide permission:</b> Completely hides the screen.</li>
    </ul>
  </div>
),

pos_customer_mgmt: (
  <div>
    <div className="font-semibold mb-1">Customer Management</div>
    <ul className="list-disc pl-4 space-y-1">
      <li>Available in <b>More</b> section.</li>
      <li><b>Read permission:</b> Full access to Customer Management screen.</li>
      <li><b>Hide permission:</b> Completely hides the screen.</li>
    </ul>
  </div>
),

};

const MODULE_INFO: Record<string, React.ReactNode> = {
  out: (
    <div>
      <div className="font-semibold mb-1">Outgoing Payment</div>
      <ul className="list-disc pl-4 space-y-1">
        <li>Used to manage outgoing payments for vendor purchases.</li>
        <li><b>Required Permissions:</b></li>
        <li>Purchase Order</li>
        <li>GRN Note</li>
        <li>AP Invoice</li>
      </ul>
    </div>
  ),
   outlet_manager: (   // ✅ ADD THIS
    <div>
      <div className="font-semibold mb-1">Outlet Manager</div>
      <ul className="list-disc pl-4 space-y-1">
        <li>Used to access Outlet Manager operational screens.</li>
        <li>
          <b>Read permission:</b> Enables full access to Sale Order, Location Stock Transfer, and SFG to FG screens.
        </li>
        <li>
          <b>Hide permission:</b> Completely hides Outlet Manager from menus and screens.
        </li>
      </ul>
    </div>
  ),
};

const HeaderWithHelp = ({ label, info }: { label: string; info: string }) => (
  <div className="flex justify-center items-center gap-1">
    <span className="text-sm font-bold text-black">{label}</span>

    <Tooltip title={info} arrow placement="top">
      <span className="w-4 h-4 flex items-center justify-center rounded-full border border-gray-400 text-gray-600 cursor-pointer hover:bg-gray-200 text-[10px] font-bold">
        ?
      </span>
    </Tooltip>
  </div>
);
const SubmoduleInfoIcon = ({ info }: { info: React.ReactNode }) => (
  <Tooltip
    title={
      <div className="max-w-[320px] text-sm leading-5">
        {info}
      </div>
    }
    arrow
    placement="top-start"
  >
    <span className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-400 text-gray-600 cursor-pointer hover:bg-gray-200 text-[10px] font-bold">
      i
    </span>
  </Tooltip>
);


// Snackbar interface
interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
}

function SlideTransition(props: any) {
  return <Slide {...props} direction="up" />;
}

export default function EditRolePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
  // Confirmation dialog state
const [confirmDialog, setConfirmDialog] = useState<{
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}>({
  open: false,
  title: "",
  message: "",
  onConfirm: () => {},
});

  const roleName = searchParams?.get('name') || '';
  const [selectedPredefinedRole, setSelectedPredefinedRole] = useState("");
  const [customRoleName, setCustomRoleName] = useState("");
  const [formPermissions, setFormPermissions] = useState<AppPermissions[]>(
  () => applyDefaultHide(JSON.parse(JSON.stringify(HARD_MODULES)))
);

  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [moduleCheckboxes, setModuleCheckboxes] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const formRoleName = selectedPredefinedRole || customRoleName;
  
  // Snackbar state
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'info'
  });

  // Show snackbar
  const showSnackbar = (message: string, severity: SnackbarState['severity'] = 'info') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  // Close snackbar
  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Helper: Map frontend submodule ID to backend key (same as before)
  const getBackendSubmoduleKey = useCallback((submoduleId: string, submoduleName: string): string => {
  const idMap: Record<string, string> = {
    'pm_pc': 'purchasecategory',
    'pm_ps': 'purchasesubcategory',
    'pm_pu': 'purchaseuom',
    'pm_gi': 'itemgroup',
    'pm_pt': 'purchasetax',
    'pm_sl': 'storagelocation',
    'pm_it': 'itemtype',
    'pm_fr': 'freight',
    'pm_service': 'service',
    'vt': 'vendortype',
    'v': 'vendors',
    'pi_default': 'purchaseitem',
    'po_pending': 'purchaseorders_pending',
    'po_approved': 'purchaseorders_approved',
    'po_rejected': 'purchaseorders_rejected',
     // SERVICE ORDER
    'so_pending': 'serviceorders_pending',
    'so_approved': 'serviceorders_approved',
    'so_rejected': 'serviceorders_rejected',

    'grn_list': 'grns',
    'grn_return': 'grns_return',
    'ap_list': 'apinvoices',
    
    'op_outgoing': 'outgoingpayment',
    'op_advance': 'advancepayment',
    'op_partial': 'partialpayment',
    'op_done': 'paymentdone',
     'op_history': 'paymenthistory',
    'op_ledger': 'ledger',
    'op_return': 'purchasereturn',
    'om_so': 'sale_order',
    'om_lst': 'location_stock_transfer',
    'om_sfg': 'sfg_to_fg',

    // POS submodules
'pos_order_mgmt': 'order_management',
'pos_sales_return': 'sales_return',
'pos_payment_settings': 'payment_settings',
'pos_bill_sale_order': 'bill_settings_sale_order',
'pos_bill_takeaway': 'bill_settings_takeaway',
'pos_gst_settings': 'gst_settings',
'pos_credit_customer': 'credit_customer',
'pos_device_config': 'device_configurations',
'pos_customer_mgmt': 'customer_management',

  };
  return idMap[submoduleId] || submoduleName.toLowerCase().replace(/\s+/g, '');
}, []); // Empty dependency array - it doesn't depend on component state

  // Convert backend permissions → frontend format (same as before)
const convertBackendToFrontend = useCallback((backendPermissions: any): AppPermissions[] => {
  const frontend = JSON.parse(JSON.stringify(HARD_MODULES));

  if (!backendPermissions || typeof backendPermissions !== "object") {
    return applyDefaultHide(frontend);
  }

  const yenerpData = backendPermissions.YENERP || backendPermissions.yenerp || backendPermissions;
  const outletData = backendPermissions.outlet_manager;
  const posData = backendPermissions.pos;

  frontend.forEach((app: AppPermissions) => {
    if (
      app.appName !== "YEN_PURCHASE" &&
      app.appName !== "YEN_BOOK" &&
      app.appName !== "YEN_OUTLET_MANAGER" &&
      app.appName !== "YEN_POS"
    ) return;

    const permissionSource =
      app.appName === "YEN_OUTLET_MANAGER"
        ? outletData
        : app.appName === "YEN_POS"
        ? posData
        : yenerpData;

    if (!permissionSource) return;

    app.modules.forEach((module: ModuleItem) => {
      module.submodules.forEach((sub: Submodule) => {
        const key = getBackendSubmoduleKey(sub.id, sub.name);

        let permissionData = permissionSource[key];
        if (!permissionData) {
          Object.keys(permissionSource).forEach(k => {
            if (k.toLowerCase() === key.toLowerCase()) {
              permissionData = permissionSource[k];
            }
          });
        }

        if (permissionData) {
          sub.actions = {
            read: Boolean(permissionData.read),
            add: Boolean(permissionData.add),
            edit: Boolean(permissionData.edit),
            delete: Boolean(permissionData.delete),
            hide: Boolean(permissionData.hide),
            approve: Boolean(permissionData.approve || false),
          };
        }
      });
    });
  });

  // ✅ finally apply default hide logic
  return applyDefaultHide(frontend);
}, [getBackendSubmoduleKey]);


  // Load role + permissions from MongoDB (updated with snackbar)
  useEffect(() => {
    if (!roleName) {
      showSnackbar("Role name not provided!", "error");
      router.push("/account-settings");
      return;
    }

    const loadRoleData = async () => {
      setIsLoading(true);
      setSelectedPredefinedRole("");
      setCustomRoleName("");
setFormPermissions(applyDefaultHide(JSON.parse(JSON.stringify(HARD_MODULES))));

      try {
        // Fetch role
        const roleRes = await fetch(`https://yenerp.com/purchasetestapi/roles?name=${encodeURIComponent(roleName)}`);
        if (roleRes.ok) {
          const rolesData = await roleRes.json();
          const roleData = Array.isArray(rolesData) ? rolesData.find((r: any) => r.name === roleName) : rolesData;
          if (roleData) {
            const name = roleData.name;
            if (ROLE_OPTIONS.includes(name)) {
              setSelectedPredefinedRole(name);
            } else {
              setCustomRoleName(name);
            }
          }
        }

        // Fetch permissions
        const permRes = await fetch(`https://yenerp.com/purchasetestapi/permissions?role_name=${encodeURIComponent(roleName)}`);
        if (permRes.ok) {
          const permData = await permRes.json();
          
          if (permData && permData.length > 0) {
            let backendPerms = null;
            
            if (Array.isArray(permData)) {
              const rolePerm = permData.find((p: any) => p.role_name === roleName);
              backendPerms = rolePerm ? rolePerm.permissions : null;
            } else if (permData.permissions) {
              backendPerms = permData.permissions;
            } else {
              backendPerms = permData;
            }
            
            if (backendPerms) {
              const converted = convertBackendToFrontend(backendPerms);
            setFormPermissions(applyDefaultHide(converted));

            }
          }
        }
      } catch (err) {
        console.error("Error loading role:", err);
        showSnackbar("Error loading role data", "error");
      } finally {
        setIsLoading(false);
      }
    };

    loadRoleData();
  }, [roleName, router, convertBackendToFrontend]);

  // Initialize expanded & checkboxes (same as before)
  useEffect(() => {
    if (isLoading) return;

    const allExpanded: Record<string, boolean> = {};
    const initialCheckboxes: Record<string, boolean> = {};

    formPermissions.forEach((app: AppPermissions) => {
      app.modules.forEach((module: ModuleItem) => {
        allExpanded[module.id] = true;
        const hasPermission = module.submodules.some((sub: Submodule) =>
          sub.actions.read || sub.actions.add || sub.actions.edit || sub.actions.delete || sub.actions.approve
        );
        initialCheckboxes[module.id] = hasPermission;
      });
    });

    setExpandedModules(allExpanded);
    setModuleCheckboxes(initialCheckboxes);
  }, [formPermissions, isLoading]);

  // Update checkboxes when permissions change (same as before)
  useEffect(() => {
    const updated: Record<string, boolean> = {};
    formPermissions.forEach((app: AppPermissions) => {
      app.modules.forEach((module: ModuleItem) => {
        updated[module.id] = module.submodules.some((sub: Submodule) =>
          sub.actions.read || sub.actions.add || sub.actions.edit || sub.actions.delete || sub.actions.approve
        );
      });
    });
    setModuleCheckboxes(updated);
  }, [formPermissions]);

  const toggleExpand = (moduleId: string) => {
    setExpandedModules(prev => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

const toggleAction = (ai: number, mi: number, si: number, act: ActionKeys) => {
  setFormPermissions(prev => {
    const c = JSON.parse(JSON.stringify(prev));
    const actions = c[ai].modules[mi].submodules[si].actions;

    const currentValue = actions[act];
    actions[act] = !currentValue;

    // ✅ 1) If HIDE checked -> turn off all others
    if (act === "hide" && actions.hide === true) {
      actions.read = false;
      actions.add = false;
      actions.edit = false;
      actions.delete = false;
      actions.approve = false;
      return c;
    }

    // ✅ 2) If any visible permission checked -> hide must be false
    if (act !== "hide" && actions[act] === true && actions.hide) {
      actions.hide = false;
    }

    // ✅ 3) If ADD/EDIT/DELETE/APPROVE checked -> auto enable READ
    if (act !== "read" && act !== "hide" && actions[act] === true) {
      actions.read = true;
    }

    // ✅ 4) If READ unchecked -> uncheck dependent permissions
    if (act === "read" && actions.read === false) {
      actions.add = false;
      actions.edit = false;
      actions.delete = false;
      actions.approve = false;

      // ✅ MAIN REQUIREMENT:
      // Read off na screen access illa -> so Hide should turn ON automatically
      actions.hide = true;
    }

    // ✅ 5) EXTRA: If all permissions become false -> auto hide ON
    const anyPermission =
      actions.read || actions.add || actions.edit || actions.delete || actions.approve;

    if (!anyPermission) {
      actions.hide = true;
    }

    // ✅ 6) If hide is true -> enforce others false (safety)
    if (actions.hide === true) {
      actions.read = false;
      actions.add = false;
      actions.edit = false;
      actions.delete = false;
      actions.approve = false;
    }

    return c;
  });
};



 const toggleAllSubmodules = (ai: number, mi: number, moduleId: string) => {
  setFormPermissions(prev => {
    const c = JSON.parse(JSON.stringify(prev));
    const currentlyChecked = moduleCheckboxes[moduleId];

    c[ai].modules[mi].submodules.forEach((sub: Submodule) => {
      if (currentlyChecked) {
        // Unselect all actions (set all to false)
        Object.keys(sub.actions).forEach(k => sub.actions[k as ActionKeys] = false);

        // ✅ if all false -> hide true
        sub.actions.hide = true;
      } else {
        // Select all actions
        sub.actions.read = true;
        sub.actions.add = true;
        sub.actions.edit = true;
        sub.actions.delete = true;
        sub.actions.approve = true;

        // ✅ if selected permissions -> hide should be false
        sub.actions.hide = false;
      }
    });

    return c;
  });
};


  // UPDATED TRANSFORM FUNCTION: Ensure ALL modules are sent to backend
  const transformPermissionsForBackend = (frontendPermissions: AppPermissions[]): any => {
    const backend: any = {};
frontendPermissions.forEach((app: AppPermissions) => {
    let appName: string;

    if (app.appName === "YEN_PURCHASE" || app.appName === "YEN_BOOK") {
      appName = "yenerp";
    } else if (app.appName === "YEN_OUTLET_MANAGER") {
      appName = "outlet_manager"; // ✅ IMPORTANT
      } else if (app.appName === "YEN_POS") {
  appName = "pos";
    } else {
      appName = app.appName.toLowerCase();
    }
      if (!backend[appName]) backend[appName] = {};

      app.modules.forEach((module: ModuleItem) => {
        module.submodules.forEach((sub: Submodule) => {
          const key = getBackendSubmoduleKey(sub.id, sub.name);
          
          // IMPORTANT: Always send ALL submodules to backend, even if all permissions are false
          // This ensures database gets updated with false values for unselected modules
          backend[appName][key] = {
            read: sub.actions.read,
            add: sub.actions.add,
            edit: sub.actions.edit,
            delete: sub.actions.delete,
            hide: sub.actions.hide,
            approve: sub.actions.approve || false,
          };
        });
      });
    });
    return backend;
  };

  // UPDATED UPDATE ROLE FUNCTION (with snackbar)
  const updateRole = async () => {
    if (!formRoleName.trim()) {
      showSnackbar("Please enter a role name", "warning");
      return;
    }

    console.log("Starting update for role:", roleName, "->", formRoleName);
    
    try {
      // 1. Transform permissions to backend format (including false values)
    // ✅ Before saving, make sure unchecked modules auto-hide ON
const sanitizedPermissions = applyDefaultHide(formPermissions);

// ✅ Now transform this corrected permissions for backend
const backendPerms = transformPermissionsForBackend(sanitizedPermissions);

      console.log("Permissions to update (with all modules):", backendPerms);

      // 2. Update role name if changed
      if (formRoleName !== roleName) {
        try {
          const roleRes = await fetch(`https://yenerp.com/purchasetestapi/roles?name=${encodeURIComponent(roleName)}`);
          const roleData = await roleRes.json();
          
          let roleToUpdate = null;
          if (Array.isArray(roleData)) {
            roleToUpdate = roleData.find((r: any) => r.name === roleName);
          } else if (roleData && roleData.name === roleName) {
            roleToUpdate = roleData;
          }
          
          if (roleToUpdate && roleToUpdate._id) {
            await fetch(`https://yenerp.com/purchasetestapi/roles/${roleToUpdate._id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                name: formRoleName,
                description: `Permissions for ${formRoleName}`
              })
            });
          }
        } catch (roleErr) {
          console.error("Error updating role name:", roleErr);
        }
      }

      // 3. Update permissions - KEY FIX: Send ALL modules including unselected ones
      const payload = {
        permissions: backendPerms
      };
      
      console.log("Sending permissions update with ALL modules...");
      
      // First try to update existing permissions
      let response = await fetch(`https://yenerp.com/purchasetestapi/permissions/${encodeURIComponent(roleName)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (response.status === 404) {
        // If not found, try POST to create new
        console.log("Permissions not found, creating new...");
        const postPayload = {
          role_name: formRoleName,
          permissions: backendPerms
        };
        
        response = await fetch("https://yenerp.com/purchasetestapi/permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(postPayload)
        });
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update permissions: ${response.status} - ${errorText}`);
      }

      console.log("✅ Permissions updated successfully with all modules");

      // 4. If role name changed, also update permissions document's role_name
      if (formRoleName !== roleName) {
        try {
          // Try to find permissions with old name
          const checkResponse = await fetch(`https://yenerp.com/purchasetestapi/permissions?role_name=${encodeURIComponent(formRoleName)}`);
          const checkData = await checkResponse.json();
          
          if (!checkData || (Array.isArray(checkData) && checkData.length === 0)) {
            // Create new permissions with updated role name
            const createPayload = {
              role_name: formRoleName,
              permissions: backendPerms
            };
            
            await fetch("https://yenerp.com/purchasetestapi/permissions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(createPayload)
            });
            
            // Delete old permissions
            await fetch(`https://yenerp.com/purchasetestapi/permissions/${encodeURIComponent(roleName)}`, {
              method: "DELETE"
            });
          }
        } catch (checkErr) {
          console.warn("Error handling role name change in permissions:", checkErr);
        }
      }

      // 5. Update local storage
      const stored = JSON.parse(localStorage.getItem('roles') || '[]');
      const updatedRoles = stored.filter((r: any) => r.roleName !== roleName);
      
      const updatedRole = {
        id: Date.now().toString(),
        roleName: formRoleName,
        active: true,
       permissions: sanitizedPermissions
      };
      
      updatedRoles.push(updatedRole);
      localStorage.setItem('roles', JSON.stringify(updatedRoles));
      
      // 6. Update Redux store
      dispatch(updateRoleLocally(updatedRole));

      // 7. Show success snackbar and redirect
      showSnackbar("Role updated successfully! All modules updated in database.", "success");
      
      setTimeout(() => {
        router.push("/account-settings");
      }, 1500);
      
    } catch (err: any) {
      console.error("❌ Error updating role:", err);
      showSnackbar(`Error: ${err.message || "Failed to update role. Please check console for details."}`, "error");
    }
  };

  const resetAllPermissions = () => {
  setConfirmDialog({
    open: true,
    title: "Reset All Permissions",
    message:
      "Are you sure you want to unselect ALL modules and set all permissions to false?",
    onConfirm: () => {
      // 🔥 actual reset logic
      setFormPermissions(prev => {
        const updated = JSON.parse(JSON.stringify(prev));
        updated.forEach((app: AppPermissions) => {
          app.modules.forEach((module: ModuleItem) => {
            module.submodules.forEach((sub: Submodule) => {
              sub.actions.read = false;
              sub.actions.add = false;
              sub.actions.edit = false;
              sub.actions.delete = false;
              sub.actions.hide = false;
              sub.actions.approve = false;
            });
          });
        });
        return updated;
      });

      const cleared: Record<string, boolean> = {};
      Object.keys(moduleCheckboxes).forEach(k => (cleared[k] = false));
      setModuleCheckboxes(cleared);

      // ✅ ONLY result snackbar
      showSnackbar(
        "All permissions reset. Click Update Role to save changes.",
        "info"
      );
    },
  });
};


  // Custom Confirmation Dialog Component
  const ConfirmationDialog = () => {
    const [open, setOpen] = useState(false);
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-sm">
          <h3 className="text-lg font-semibold mb-4">Confirm Reset</h3>
          <p className="mb-6">Are you sure you want to unselect ALL modules and set all permissions to false?</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setOpen(false);
                // Reset logic here
              }}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Reset All
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading role data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Snackbar component */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={snackbar.severity === 'success' ? 3000 : 5000}
        onClose={handleCloseSnackbar}
        TransitionComponent={SlideTransition}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
{confirmDialog.open && (
  <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">
        {confirmDialog.title}
      </h3>
      <p className="text-gray-600 mb-6 text-sm">
        {confirmDialog.message}
      </p>
      <div className="flex justify-end gap-3">
        <button
          onClick={() =>
            setConfirmDialog({ open: false, title: "", message: "", onConfirm: () => {} })
          }
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-sm"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            confirmDialog.onConfirm();
            setConfirmDialog({ open: false, title: "", message: "", onConfirm: () => {} });
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
)}

      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {/* Header with Reset All button */}
        <div className="flex justify-between items-center px-6 py-2 border-b border-gray-200">
          <button onClick={() => router.push("/account-settings")} className="flex items-center gap-2 px-5 py-2 bg-white text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-all text-sm font-semibold shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h2 className="text-xl font-bold text-black text-center absolute left-1/2 transform -translate-x-1/2">Edit Role</h2>
          <button 
            onClick={resetAllPermissions}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-semibold shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Reset All
          </button>
        </div>

        {/* Role Name section */}
        <div className="px-6 py-3">
          <div className="flex gap-3">
            <div className="w-1/2">
              <label className="block text-sm font-bold text-black mb-2">Select Predefined Roles</label>
              <select value={selectedPredefinedRole} onChange={(e) => setSelectedPredefinedRole(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm">
                <option value="">-- Select role --</option>
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="w-1/2">
              <label className="block text-sm font-bold text-black mb-2">Custom Role Name</label>
              <input value={customRoleName} onChange={(e) => setCustomRoleName(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm" placeholder="Enter custom name..." />
            </div>
          </div>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-[2fr_repeat(6,1fr)] items-center gap-2 px-6 py-2 font-bold text-black text-sm bg-gray-50">
          <div>Modules / Submodules</div>
          <div className="text-center">Read</div>
          <div className="text-center">Add</div>
          <div className="text-center">Edit</div>
          <div className="text-center">Delete</div>
          <div className="text-center">Hide</div>
          <div className="text-center">Approve</div>
        </div>

        {/* Permissions section */}
        <div className="flex-1 overflow-y-auto px-6">
          <div className="space-y-2 py-2">
            {formPermissions.map((app, ai) => (
              <div key={app.appName} className="mb-3">
                <div className="text-sm font-bold text-blue-600 bg-blue-50 p-2 rounded">{app.appName}</div>
                <div className="space-y-2">
                  {app.modules.map((m, mi) => (
                    <div key={m.id} className="border border-gray-200 rounded bg-white">
<div
  onClick={() => toggleExpand(m.id)}
  className="font-bold text-black p-2 flex items-center justify-between cursor-pointer select-none hover:bg-gray-50 text-sm"
>
                        <div className="flex items-center">
                          <button onClick={(e) => { e.stopPropagation(); toggleAllSubmodules(ai, mi, m.id); }} className={`w-5 h-5 rounded border-2 mr-3 flex items-center justify-center ${moduleCheckboxes[m.id] ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-300"}`}>
                            {moduleCheckboxes[m.id] && "✓"}
                          </button>
                          <span className="flex items-center">
  {m.name}

  {MODULE_INFO[m.id] && (
    <SubmoduleInfoIcon info={MODULE_INFO[m.id]} />
  )}
</span>

                        </div>
<button
  onClick={(e) => {
    e.stopPropagation();   // 🔥 important
    toggleExpand(m.id);
  }}
>
                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${expandedModules[m.id] ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>

                      {expandedModules[m.id] && (
                        <div className="border-t border-gray-100">
                          {m.submodules.map((s, si) => (
                            <div key={s.id} className="grid grid-cols-[2fr_repeat(6,1fr)] items-center gap-2 p-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 text-sm">
<div className="text-black font-medium pl-8 text-sm flex items-center">
  <span>{s.name}</span>

  {SUBMODULE_INFO[s.id] && (
    <SubmoduleInfoIcon info={SUBMODULE_INFO[s.id]} />
  )}
</div>

                              {(Object.keys(s.actions) as ActionKeys[]).map(a => (
                                <div key={a} className="text-center">
                                  <button onClick={() => toggleAction(ai, mi, si, a)} className={`w-6 h-5 rounded text-xs ${s.actions[a] ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"}`}>
                                    {s.actions[a] ? "✓" : "✗"}
                                  </button>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="h-6"></div>
          </div>
        </div>

        {/* Footer */}
       {/* Footer */}
{!confirmDialog.open && (
  <div className="fixed bottom-0 left-0 right-0 border-t bg-white px-6 py-4 shadow-lg z-40">
    <div className="flex justify-end gap-3 max-w-7xl mx-auto">
      <button
        onClick={() => router.push("/account-settings")}
        className="px-5 py-2 border-2 border-gray-400 rounded-lg hover:bg-gray-100 text-sm font-semibold text-gray-700"
      >
        Cancel
      </button>

      <button
        onClick={() =>
          setConfirmDialog({
            open: true,
            title: "Update Role",
            message: "Are you sure you want to update this role and save permissions?",
            onConfirm: () => {
              updateRole();
            },
          })
        }
        className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
      >
        Update Role
      </button>
    </div>
  </div>
)}

        <div className="pb-20"></div>
      </div>
    </div>
  );
}