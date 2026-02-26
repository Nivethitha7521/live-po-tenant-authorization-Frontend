// src/app/yen-book/page.tsx
"use client";

import React, { useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import SideMenu from '../../components/SideMenu';
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";

const YenBookPage = () => {
  const pathname = usePathname();
  const router = useRouter();
const permissions = useSelector(
  (state: RootState) => state.auth.permissions?.yenerp || {}
);

const permissionsLoaded = Object.keys(permissions).length > 0;

const isModuleVisible = (key: string) => {
  const m = permissions?.[key];

  if (!m) return false;
  if (m.hide === true || m.hide === 1) return false;

  const noActions = !m.read && !m.add && !m.edit && !m.delete && !m.approve;
  if (noActions) return false;

  return m.read === true || m.read === 1;
};
// ✅ Yen Book module permission keys
const bookKeys = [
  "outgoingpayment",
  "advancepayment",
  "partialpayment",
  "paymentdone",
  "paymenthistory",
  "ledger",
  "purchasereturn"
];
const purchaseKeys = [
  "purchasecategory",
  "purchasesubcategory",
  "itemgroup",
  "purchaseuom",
  "purchasetax",
  "storagelocation",
  "freight",
  "itemtype",
  "service",
  "vendors",
  "vendortype",
  "purchaseitem",
  "purchaseorders_pending",
  "purchaseorders_approved",
  "purchaseorders_rejected",
  "serviceorders_pending",
  "serviceorders_approved",
  "serviceorders_rejected",
  "grns",
  "grns_return",
  "apinvoices",
];
const hidePurchaseMenu =
  permissionsLoaded &&
  !purchaseKeys.some((key: string) => isModuleVisible(key));

const hideBookMenu =
  permissionsLoaded &&
  !bookKeys.some((key: string) => isModuleVisible(key));

 const subItems = useMemo(
  () =>
    [
      {
        label: "Outgoing Payment",
        path: "/yen-book/OutgoingPaymentPage",
        visible: isModuleVisible("outgoingpayment"),
      },
    ].filter((item) => item.visible),
  [permissions]
);


  const isActiveRoute = (itemPath: string) => (pathname || '').startsWith(itemPath);

  const handleMenuClick = useCallback((menuItem: { path: string }) => {
    router.push(menuItem.path);
  }, [router]);

  return (
    <div>
      <SideMenu
        onMenuClick={handleMenuClick}
        activePath={pathname || '/'} // Fallback to '/' if pathname is null
        showBookMenu={!hideBookMenu}
  showPurchaseMenu={!hidePurchaseMenu}
      />

      <div className="flex flex-wrap gap-2 mt-1 ml-5 mr:1 items-center justify-start">
        {subItems.map((item) => {
          const isActive = isActiveRoute(item.path);

          return (
            <Link key={item.label} href={item.path} passHref className="no-underline-book">
              <Button
                variant={isActive ? 'contained' : 'outlined'}
                color="primary"
                size="medium"
                sx={{
                  textTransform: 'none',
                  fontWeight: isActive ? 'bold' : 'normal',
                  fontSize: isActive ? '16px' : '15px',
                  borderRadius: '4px',
                  padding: '10px 20px',
                  width: isActive ? '550px' : '15px',
                  height: isActive ? '50px' : '30px',
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

export default YenBookPage;