"use client";
import  dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useCallback } from 'react';
import { Button } from '@mui/material';
import React from 'react';
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";

// Dynamically import SideMenu
const SideMenu = dynamic(() => import('../../components/SideMenu'), {
  ssr: false, // Disable SSR if SideMenu is client-only
});

const YenPurchasePage = () => {
  const pathname = usePathname();
  const router = useRouter();
 const permissions = useSelector(
    (state: RootState) => state.auth.permissions?.yenerp || {},
  );
  const permissionsLoaded = Object.keys(permissions).length > 0;

const isModuleVisible = (key: string) => {
  const m = permissions?.[key];

  // if missing => hidden
  if (!m) return false;

  // hide true => hidden
  if (m.hide === true || m.hide === 1) return false;

  // if no actions selected => hidden
  const noActions = !m.read && !m.add && !m.edit && !m.delete && !m.approve;

  if (noActions) return false;

  // If at least read permission should show the menu
  return m.read === true || m.read === 1;
};

  const yenBookKeys = [
    "outgoingpayment",
    "advancepayment",
    "partialpayment",
    "paymentdone",
    "paymenthistory",
    "ledger",
    "purchasereturn",
  ];

  const hideBookMenu = !yenBookKeys.some((k) => isModuleVisible(k));

  const purchaseMasterKeys = [
    "purchasecategory",
    "purchasesubcategory",
    "itemgroup",
    "purchaseuom",
    "purchasetax",
    "storagelocation",
    "freight",
    "itemtype",
    "service",
  ];

  const vendorKeys = ["vendors", "vendortype"];
  const purchaseitemKeys = ["purchaseitem"];

  const purchaseOrderKeys = [
    "purchaseorders_pending",
    "purchaseorders_approved",
    "purchaseorders_rejected",
    "purchaseorders_grn_converted", 
  ];
const serviceOrderKeys = [
  "serviceorders_pending",
  "serviceorders_approved",
  "serviceorders_rejected",
];
  const grnKeys = ["grns", "grns_return"];

  const apInvoiceKeys = ["apinvoices"]; // need na more keys add panlaam
  const isAnyModuleVisible = (keys: string[]) => {
    return keys.some((k) => isModuleVisible(k));
  };

 const subItems = useMemo(
    () =>
      [
        {
          label: "Purchase Master",
          path: "/yen-purchase/PurchaseMaster",
          visible: isAnyModuleVisible(purchaseMasterKeys),
        },
        {
          label: "Vendor",
          path: "/yen-purchase/VendorPage",
          visible: isAnyModuleVisible(vendorKeys),
        },
        {
          label: "Purchase Item",
          path: "/yen-purchase/PurchaseItemPage",
          visible: isAnyModuleVisible(purchaseitemKeys),
        },
        {
          label: "Purchase Order",
          path: "/yen-purchase/PurchaseOrder",
          visible: isAnyModuleVisible(purchaseOrderKeys),
        },
 {
  label: "Service Order",
  path: "/yen-purchase/ServiceOrder",
  visible: isAnyModuleVisible(serviceOrderKeys),
},



        {
          label: "GRN Note",
          path: "/yen-purchase/GrnPage",
          visible: isAnyModuleVisible(grnKeys),
        },
        {
          label: "AP Invoice",
          path: "/yen-purchase/ApInvoicePage",
          visible: isAnyModuleVisible(apInvoiceKeys),
        },
      ].filter((item) => item.visible),
    [permissions],
  );
// ✅ MASTER purchase permission keys (reuse existing decoded keys)
const purchaseKeys: string[] = [
  ...purchaseMasterKeys,
  ...vendorKeys,
  ...purchaseitemKeys,
  ...purchaseOrderKeys,
  ...serviceOrderKeys,
  ...grnKeys,
  ...apInvoiceKeys,
 
];

 // ✅ ADD THIS - correct hidePurchaseMenu logic
const hidePurchaseMenu =
  permissionsLoaded &&
  !purchaseKeys.some((key:string) => isModuleVisible(key));
  React.useEffect(() => {
    if (pathname === "/yen-purchase" || pathname === "/yen-purchase/") {
      const firstVisible = subItems[0];
      if (firstVisible) router.replace(firstVisible.path);
    }
  }, [pathname, router, subItems]);



  const isActiveRoute = (itemPath: string) => (pathname || '').startsWith(itemPath);

  const handleMenuClick = useCallback((menuItem: { path: string }) => {
    router.push(menuItem.path);
  }, [router]);

 return (
    <div>
      <SideMenu
        onMenuClick={handleMenuClick}
        activePath={pathname || "/"}
        showPurchaseMenu={!hidePurchaseMenu}
  showBookMenu={!hideBookMenu}
      />
      <div className="flex flex-wrap gap-2 ml-4 items-center justify-start">
        {subItems.map((item) => {
          const isActive = isActiveRoute(item.path);
          return (
            <Link key={item.label} href={item.path} className="no-underline">
              <Button
                variant={isActive ? 'contained' : 'outlined'}
                color="primary"
                size="medium"
                sx={{
                  textTransform: 'none',
                  fontWeight: isActive ? 'bold' : 'normal',
                  fontSize: isActive ? '16px' : '15px',
                  borderRadius: '4px',
                  padding: '8px 16px',
                  width: isActive ? '200px' : '150px',
                  height: isActive ? '40px' : '30px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? '0px 0px 10px rgba(0, 0, 0, 0.1)' : 'none',
                }}
              >
                {item.label}
              </Button>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default YenPurchasePage;