'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux/store';

const SideMenu = dynamic(() => import('../../components/SideMenu'), { ssr: false });

const MainPage: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();

  const permissionObject = useSelector((state: RootState) => state.auth.permissions);
  const permissions = permissionObject?.yenerp || {};

  // ✅ Reusable local check (same logic as YenPurchasePage)
  const isModuleVisibleLocal = (key: string) => {
    const m = (permissions as any)?.[key];
    if (!m) return false;
    if (m.hide === true || m.hide === 1) return false;
    const noActions = !m.read && !m.add && !m.edit && !m.delete && !m.approve;
    if (noActions) return false;
    return m.read === true || m.read === 1;
  };

  // ✅ SideMenu props — same keys as YenPurchasePage
  const yenBookKeys = ["outgoingpayment", "advancepayment", "partialpayment", "paymentdone", "paymenthistory", "ledger", "purchasereturn"];
  const purchaseKeys = ["purchasecategory", "purchasesubcategory", "itemgroup", "purchaseuom", "purchasetax", "storagelocation", "freight", "itemtype", "service", "vendors", "vendortype", "purchaseitem", "purchaseorders_pending", "purchaseorders_approved", "purchaseorders_rejected", "purchaseorders_grn_converted", "serviceorders_pending", "serviceorders_approved", "serviceorders_rejected", "grns", "grns_return", "apinvoices"];
  const inventoryKeys = ["physicalstockmodification", "physicalstockvariancemodification", "stockledger", "warehousephysicalstockmodification", "warehousephysicalstockvariancemodification", "warehousestockledger"];

  const showBookMenu = yenBookKeys.some((k) => isModuleVisibleLocal(k));
  const showPurchaseMenu = purchaseKeys.some((k) => isModuleVisibleLocal(k));
  const showInventoryMenu = inventoryKeys.some((k) => isModuleVisibleLocal(k));
  const showReportsMenu = isModuleVisibleLocal("posreport") || isModuleVisibleLocal("purchaseorderreport");

  const handleMenuClick = useCallback((menuItem: { path: string }) => {
    router.push(menuItem.path);
  }, [router]);

  // ✅ Existing report tabs logic — unchanged
  const hasPurchaseReportAccess = permissionObject?.yenerp?.purchaseorderreport?.read === true;
  const hasPosReportAccess = permissionObject?.yenerp?.posreport?.read === true;

  const menuItems = useMemo(() => {
    const items = [];
    if (hasPurchaseReportAccess) items.push({ label: 'Purchase Order', path: '/QlikReport/PurchaseOrder' });
    if (hasPosReportAccess) items.push({ label: 'Sale Order', path: '/QlikReport/Pos' });
    return items;
  }, [hasPurchaseReportAccess, hasPosReportAccess]);

  const normalizePath = (path: string | null | undefined) => {
    if (!path) return '';
    return path.replace(/\/+$/, '').toLowerCase();
  };

  const currentPath = normalizePath(pathname);

  return (
    <div className="flex h-full bg-[#f8f9fa] overflow-hidden font-sans">
      {/* ✅ SideMenu add பண்ணோம் */}
      <SideMenu
        onMenuClick={handleMenuClick}
        activePath={pathname || "/"}
        showPurchaseMenu={showPurchaseMenu}
        showBookMenu={showBookMenu}
        showInventoryMenu={showInventoryMenu}
        showReportsMenu={showReportsMenu}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-[#eeeeee] border-b border-gray-300 px-4 pt-2 shrink-0 shadow-inner">
          <div className="flex overflow-x-auto gap-[2px] no-scrollbar">
            {menuItems.map((tab) => {
              const targetPath = normalizePath(tab.path);
              const isActive = currentPath.startsWith(targetPath);
              return (
                <Link
                  prefetch={false}
                  key={tab.path}
                  href={tab.path}
                  className={`
                    relative px-5 py-2 text-[11px] uppercase font-black tracking-wider 
                    whitespace-nowrap transition-all duration-150
                    border-t-2 border-x rounded-t-sm -mb-[1px]
                    ${isActive
                      ? 'bg-white text-black border-t-black border-x-gray-300 z-10 shadow-[0_-2px_5px_rgba(0,0,0,0.05)]'
                      : 'bg-[#e0e0e0] text-gray-500 border-transparent hover:bg-gray-200 hover:text-gray-700 border-b-gray-300'
                    }
                  `}
                >
                  {isActive && <div className="absolute top-0 left-0 right-0 h-[2px] bg-black" />}
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainPage;