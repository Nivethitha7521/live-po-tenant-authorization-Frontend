"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from 'react-redux';
import { addRoleLocally } from '@/features/account-setting/roleSlice';
import { Snackbar, Alert } from "@mui/material";
import Tooltip from "@mui/material/Tooltip";

const getBackendSubmoduleKey = (submoduleId: string, submoduleName: string): string => {
  const idMap: Record<string, string> = {
    // YEN_PURCHASE submodules
    'pm_pc': 'purchasecategory',
    'pm_ps': 'purchasesubcategory',
    'pm_pu': 'purchaseuom',
    'pm_gi': 'itemgroup',
    'pm_pt': 'purchasetax',
    'pm_sl': 'storagelocation',
    'pm_fr': 'freight',
    'pm_it': 'itemtype',
    'vt': 'vendortype',
    'v': 'vendors',
    'pi_default': 'purchaseitem',
    'po_pending': 'purchaseorders_pending',
    'po_approved': 'purchaseorders_approved',
    'po_rejected': 'purchaseorders_rejected',
    'grn_list': 'grns',
    'grn_return': 'grns_return',
    'ap_list': 'apinvoices',
    
    
    // YEN_BOOK submodules
    'op_outgoing': 'outgoingpayment',
    'op_advance': 'advancepayment',
    'op_partial': 'partialpayment',
    'op_done': 'paymentdone',
    'op_ledger': 'ledger',
    'op_return': 'purchasereturn',


    // OUTLET MANAGER submodules
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
'pos_customor_mgmt': 'customor_management',


  };
  
  return idMap[submoduleId] || submoduleName.toLowerCase().replace(/\s+/g, '');
};
// Types - ORDER CHANGED
type ActionKeys = "read" | "add" | "edit" | "delete" | "hide" | "approve";
type Submodule = { id: string; name: string; actions: Record<ActionKeys, boolean> };
type ModuleItem = { id: string; name: string; submodules: Submodule[] };
type AppPermissions = { appName: string; modules: ModuleItem[] };
// Add this function right after getBackendSubmoduleKey function

const transformPermissionsForBackend = (frontendPermissions: AppPermissions[]): any => {
  const backendPermissions: any = {};
  
  console.log('🔄 Starting transformation...');
  
  frontendPermissions.forEach(app => {
    // ✅ CHANGE: Map both YEN_PURCHASE and YEN_BOOK to "yenerp"
  let appName: string;

if (app.appName === "YEN_PURCHASE" || app.appName === "YEN_BOOK") {
  appName = "yenerp";
} else if (app.appName === "YEN_OUTLET_MANAGER") {
  appName = "outlet_manager"; // 🔥 THIS IS THE KEY FIX
  } else if (app.appName === "YEN_POS") {
  appName = "pos";


} else {
  appName = app.appName.toLowerCase();
}

    
    console.log(`📦 Processing app: ${app.appName} → ${appName}`);
    
    if (!backendPermissions[appName]) {
      backendPermissions[appName] = {};
    }
    
    app.modules.forEach(module => {
      console.log(`  📁 Processing module: ${module.name}`);
      
      module.submodules.forEach(submodule => {
        const submoduleKey = getBackendSubmoduleKey(submodule.id, submodule.name);
        
        console.log(`    📄 Submodule: ${submodule.name} → ${submoduleKey}`);
        console.log(`    🔧 Actions:`, submodule.actions);
        
        // Check if any permission is true (except hide)
        const hasAnyPermission = 
          submodule.actions.read || 
          submodule.actions.add || 
          submodule.actions.edit || 
          submodule.actions.delete || 
          submodule.actions.approve||
          submodule.actions.hide;
        
        console.log(`    ✅ Has any permission: ${hasAnyPermission}`);
        
       // ✅ detect completely empty row
const noPermissionSelected =
  !submodule.actions.read &&
  !submodule.actions.add &&
  !submodule.actions.edit &&
  !submodule.actions.delete &&
  !submodule.actions.approve &&
  !submodule.actions.hide;

// ✅ FINAL RULE:
// if nothing selected => force hide true
backendPermissions[appName][submoduleKey] = {
  add: submodule.actions.add,
  edit: submodule.actions.edit,
  delete: submodule.actions.delete,
  read: submodule.actions.read,
  approve: submodule.actions.approve || false,
  hide: noPermissionSelected ? true : submodule.actions.hide
};

console.log(
  `✅ Permission set for ${submoduleKey}:`,
  backendPermissions[appName][submoduleKey]
);

      });
    });
  });
  
  console.log('📤 Final Backend Permissions:', JSON.stringify(backendPermissions, null, 2));
  return backendPermissions;
};
// ✅ Full modules for both YEN_PURCHASE and YEN_BOOK - ORDER CHANGED
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
          { id: "pm_fr", name: "Freight", actions: {read: false,add: false,edit: false, delete: false, hide: false, approve: false }},
          { id: "pm_it", name: "Item Type", actions: { read: false, add: false, edit: false, delete: false, hide: false, approve: false } }
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

const cloneModules = (): AppPermissions[] => JSON.parse(JSON.stringify(HARD_MODULES));

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


export default function CreateRolePage() {
  const router = useRouter();
  const dispatch = useDispatch();
  // ✅ Snackbar state
const [snackbar, setSnackbar] = useState({
  open: false,
  message: "",
  severity: "success" as "success" | "error",
});

  const [selectedPredefinedRole, setSelectedPredefinedRole] = useState("");
  const [customRoleName, setCustomRoleName] = useState("");
  const [formPermissions, setFormPermissions] = useState<AppPermissions[]>(cloneModules());
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [moduleCheckboxes, setModuleCheckboxes] = useState<Record<string, boolean>>({});
  const formRoleName = selectedPredefinedRole || customRoleName;
 const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const allExpanded: Record<string, boolean> = {};
    const initialCheckboxes: Record<string, boolean> = {};
    
    formPermissions.forEach((app: AppPermissions) => {
      app.modules.forEach((module: ModuleItem) => {
        allExpanded[module.id] = true;
        // Initialize all checkboxes as false
        initialCheckboxes[module.id] = false;
      });
    });
    setExpandedModules(allExpanded);
    setModuleCheckboxes(initialCheckboxes);
  }, [formPermissions]);

  // Update module checkboxes whenever formPermissions changes
  useEffect(() => {
    const updatedCheckboxes: Record<string, boolean> = {};
    
    formPermissions.forEach((app: AppPermissions) => {
      app.modules.forEach((module: ModuleItem) => {
        const hasNonHidePermission = module.submodules.some((sub: Submodule) => 
          sub.actions.read || sub.actions.add || sub.actions.edit || sub.actions.delete || sub.actions.approve
        );
        updatedCheckboxes[module.id] = hasNonHidePermission;
      });
    });
    
    setModuleCheckboxes(updatedCheckboxes);
  }, [formPermissions]);

  const toggleExpand = (moduleId: string) => {
    setExpandedModules(prev => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  // Check if submodule has any non-hide permission
  const hasAnyNonHidePermission = (actions: Record<ActionKeys, boolean>): boolean => {
    return actions.read || actions.add || actions.edit || actions.delete || actions.approve;
  };

  // UPDATED: Complete logic for hide and other fields
const toggleAction = (ai: number, mi: number, si: number, act: ActionKeys) => {
  setFormPermissions(prev => {
    const c = JSON.parse(JSON.stringify(prev));
    const actions = c[ai].modules[mi].submodules[si].actions;

    const currentValue = actions[act];
    actions[act] = !currentValue; // toggle

    // ✅ 1) If HIDE is checked -> turn off all others
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

    // ✅ 4) MAIN FIX: If READ is unchecked -> uncheck all dependent permissions
    if (act === "read" && actions.read === false) {
      actions.add = false;
      actions.edit = false;
      actions.delete = false;
      actions.approve = false;
      // hide stays as it is (don’t force hide)
    }

    return c;
  });
};


  // Toggle all submodules for a module
const toggleAllSubmodules = (ai: number, mi: number, moduleId: string) => {
  setFormPermissions(prev => {
    const c = JSON.parse(JSON.stringify(prev));
    const currentModule = c[ai].modules[mi]; // ✅ Changed to 'currentModule'
    const currentlyChecked = moduleCheckboxes[moduleId];
    
    currentModule.submodules.forEach((submodule: Submodule) => { // ✅ Use 'currentModule'
      if (currentlyChecked) {
        // Uncheck all actions
        Object.keys(submodule.actions).forEach((key: string) => {
          submodule.actions[key as ActionKeys] = false;
        });
      } else {
        // Check read, add, edit, delete, approve (but not hide)
        submodule.actions.read = true;
        submodule.actions.add = true;
        submodule.actions.edit = true;
        submodule.actions.delete = true;
        submodule.actions.approve = true;
        submodule.actions.hide = false;
      }
    });
    
    return c;
  });
};
// saveRole function-லேயே இதை add செய்யவும்
const saveRole = async () => {
  if (!formRoleName.trim()) {
   setSnackbar({
  open: true,
  message: "Please enter or select a role name",
  severity: "error",
});
return;

  }

  try {
    console.log("🔄 Starting role creation process...");
    
    // 1️⃣ First create ROLE entry
    const rolePayload = {
      name: formRoleName,
      description: `Permissions for ${formRoleName}`,
      active: true,
      role_type: ROLE_OPTIONS.includes(formRoleName) ? "Predefined" : "Custom"
    };

    console.log("📤 Sending role payload:", rolePayload);

    const roleResponse = await fetch("http://127.0.0.1:8000/purchasetestapi/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rolePayload)
    });

 if (!roleResponse.ok) {
  const errorData = await roleResponse.json();

  // ✅ Snackbar already irukkura pattern use pannrom
  setSnackbar({
    open: true,
    message: errorData.detail || "Failed to create role",
    severity: "error",
  });

  return; // ❗ stop execution, no throw, no console error
}




    const createdRole = await roleResponse.json();
    console.log("✅ Role created:", createdRole);

    const roleId = createdRole._id || createdRole.id;
    if (!roleId) {
      throw new Error("Role created but no ID returned from server");
    }

    // 2️⃣ Convert permission UI → backend structure
    const backendPermissions = transformPermissionsForBackend(formPermissions);
    console.log("📊 Transformed permissions:", backendPermissions);

    // Check if any permissions selected
    const hasPermissions = Object.keys(backendPermissions).length > 0;
    if (!hasPermissions) {
      console.warn("⚠️ No permissions selected, but role will still be created");
    }

    // 3️⃣ Save PERMISSIONS for that role
    const permissionPayload = {
      role_name: formRoleName,
      permissions: backendPermissions
    };

    console.log("📤 Sending permissions payload:", permissionPayload);

    const permResponse = await fetch("http://127.0.0.1:8000/purchasetestapi/permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(permissionPayload)
    });

    if (!permResponse.ok) {
      const errorText = await permResponse.text();
      console.error("❌ Permission save failed:", errorText);
      // Don't throw error - role is already created
      console.warn("⚠️ Role created but permissions may not be saved");
    } else {
      const createdPermission = await permResponse.json();
      console.log("✅ Permissions saved:", createdPermission);
    }

    // 4️⃣ Prepare frontend role object
    const frontendRole = {
      id: roleId,
      _id: roleId,
      roleName: formRoleName,
      active: true,
      roleType: ROLE_OPTIONS.includes(formRoleName) ? "Predefined" : "Custom",
      permissions: formPermissions
    };

    console.log("💾 Frontend role object:", frontendRole);

    // 5️⃣ Update Redux
    dispatch(addRoleLocally(frontendRole));

    // 6️⃣ Update localStorage
    const existingRoles = JSON.parse(localStorage.getItem('roles') || '[]');
    existingRoles.push(frontendRole);
    localStorage.setItem('roles', JSON.stringify(existingRoles));

  setSnackbar({
  open: true,
  message: "Role created successfully",
  severity: "success",
});

setTimeout(() => {
  router.push("/account-settings");
}, 800);


  } catch (err: any) {
    console.error("❌ Error:", err);
   setSnackbar({
  open: true,
  message: err.message || "Failed to create role",
  severity: "error",
});

  }
};
  return (
    <div className="h-screen bg-gray-50 flex flex-col"> 
      
      {/* Main Content - Takes full screen with NO margins */}
      <div className="flex-1 flex flex-col bg-white m-0 rounded-none overflow-hidden"> 
        
        {/* Header - With Back Button */}
        <div className="flex justify-between items-center px-6 py-2 border-b border-gray-200 flex-shrink-0">
          {/* Back Button - Left Corner - SAME COLOR AS CREATE ROLE BUTTON */}
          <button
            onClick={() => router.push("/account-settings/")}
            className="flex items-center gap-2 px-5 py-2 bg-white text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-all duration-200 text-sm font-semibold shadow-sm min-w-[110px]"
          >
            {/* Left Arrow Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          
          {/* Page Title - Centered - UPDATED: Bold and Black */}
          <h2 className="text-xl font-bold text-black text-center absolute left-1/2 transform -translate-x-1/2">
            Create Role
          </h2>
          
          {/* Empty div for spacing */}
          <div className="min-w-[110px]"></div>
        </div>

        {/* Role Name Section - Compact */}
        <div className="px-6 py-3 flex-shrink-0">
          <div className="flex gap-3">
            {/* Predefined Roles Dropdown */}
            <div className="w-1/2">
              <label className="block text-sm font-bold text-black mb-2">Select Predefined Roles</label>
              <select
                value={selectedPredefinedRole}
                onChange={(e) => setSelectedPredefinedRole(e.target.value)}
                className="border border-gray-300 rounded-md p-2 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-300 focus:outline-none transition-all duration-200 w-full text-sm"
              >
                <option value="">-- Select role --</option>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Role Input */}
            <div className="w-1/2">
              <label className="block text-sm font-bold text-black mb-2">Create a New Custom Role</label>
              <input
                value={customRoleName}
                onChange={(e) => setCustomRoleName(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-300 focus:outline-none transition-all duration-200 text-sm"
                placeholder="Enter custom role name..."
              />
            </div>
          </div>
        </div>

        {/* Table Header - ORDER CHANGED: Read, Add, Edit, Delete, Hide, Approve - UPDATED: Bold and Black */}
       <div className="grid grid-cols-[2fr_repeat(6,1fr)] items-center gap-2 px-6 py-2 text-sm flex-shrink-0 bg-gray-50">
  <div className="text-sm font-bold text-black">Modules / Submodules</div>

  <HeaderWithHelp label="Read" info={PERMISSION_INFO.read} />
  <HeaderWithHelp label="Add" info={PERMISSION_INFO.add} />
  <HeaderWithHelp label="Edit" info={PERMISSION_INFO.edit} />
  <HeaderWithHelp label="Delete" info={PERMISSION_INFO.delete} />
  <HeaderWithHelp label="Hide" info={PERMISSION_INFO.hide} />
  <HeaderWithHelp label="Approve" info={PERMISSION_INFO.approve} />
</div>


        {/* Scrollable Permission Section */}
        <div className="flex-1 overflow-y-auto px-6 min-h-0"> 
          <div className="space-y-2 py-2">
            {formPermissions.map((app, ai) => (
              <div key={app.appName} className="mb-3">
                {/* UPDATED: Only YEN_PURCHASE and YEN_BOOK in Blue */}
                <div className="text-sm font-bold text-blue-600 mb-2 bg-blue-50 p-2 rounded">
                  {app.appName}
                </div>
                <div className="space-y-2">
                  {app.modules.map((m, mi) => (
                    <div key={m.id} className="border border-gray-200 rounded bg-white">
                      {/* Module Header - UPDATED: Checkbox on left, dropdown on right - UPDATED: Bold and Black */}
<div
  onClick={() => toggleExpand(m.id)}
  className="font-bold text-black p-2 flex items-center justify-between cursor-pointer select-none hover:bg-gray-50 rounded text-sm"
>
                        <div className="flex items-center">
                          {/* Checkbox for selecting all submodules */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAllSubmodules(ai, mi, m.id);
                            }}
                            className={`w-5 h-5 rounded border-2 mr-3 flex items-center justify-center transition-all ${
                              moduleCheckboxes[m.id]
                                ? "bg-blue-600 border-blue-600 text-white"
                                : "bg-white border-gray-300 text-transparent hover:border-blue-500"
                            }`}
                          >
                            {moduleCheckboxes[m.id] && "✓"}
                          </button>
<span className="flex items-center">
  {m.name}

  {MODULE_INFO[m.id] && (
    <SubmoduleInfoIcon info={MODULE_INFO[m.id]} />
  )}
</span>

                        </div>
                        
                        {/* Dropdown symbol on right corner */}
                       <button
  onClick={(e) => {
    e.stopPropagation();   // 🔥 important
    toggleExpand(m.id);
  }}
  className="text-gray-500 hover:text-gray-700 transition-transform duration-200"
>

                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={`h-5 w-5 transform transition-transform duration-200 ${
                              expandedModules[m.id] ? "rotate-180" : ""
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>

                      {/* Submodules */}
                      {expandedModules[m.id] && (
                        <div className="border-t border-gray-100">
                          {m.submodules.map((s, si) => (
                            <div
                              key={s.id}
                              className="grid grid-cols-[2fr_repeat(6,1fr)] items-center gap-2 p-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 text-sm"
                            >
                              {/* UPDATED: Bold and Black for Submodule Names */}
                             <div className="text-black font-medium pl-8 text-sm flex items-center">
  <span>{s.name}</span>

  {/* ✅ show i-icon only for selected submodules */}
  {SUBMODULE_INFO[s.id] && (
    <SubmoduleInfoIcon info={SUBMODULE_INFO[s.id]} />
  )}
</div>

                              {(Object.keys(s.actions) as ActionKeys[]).map(a => (
                                <div key={a} className="text-center">
                                  <button
                                    onClick={() => toggleAction(ai, mi, si, a)}
                                    className={`w-6 h-5 rounded transition-all text-xs ${
                                      s.actions[a]
                                        ? "bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                                        : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                    }`}
                                  >
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
            
            {/* Footer ku munadi extra space */}
            <div className="h-6 bg-transparent"></div>
          </div>
        </div>

        {/* Fixed Footer - Always visible above taskbar */}
        <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-6 py-4 shadow-lg z-50">
          <div className="flex justify-end gap-3 max-w-7xl mx-auto">
            <button 
             onClick={() => router.push("/account-settings/")}
              className="px-5 py-2 rounded-lg border-2 border-gray-400 hover:bg-gray-100 transition-all duration-200 text-sm font-semibold text-gray-700 bg-white shadow-sm hover:shadow-md min-w-[110px]" 
            >
              Cancel
            </button>
<button 
  onClick={saveRole}
  disabled={isSaving}
  className={`px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-semibold shadow-sm hover:shadow-md min-w-[110px] ${
    isSaving ? 'opacity-50 cursor-not-allowed' : ''
  }`}
>
  {isSaving ? 'Creating...' : 'Create Role'}
</button>
          </div>
        </div>
        <div className="pb-20"></div>
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