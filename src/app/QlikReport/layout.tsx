'use client';

import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux/store';

const SideMenu = dynamic(() => import('@/components/SideMenu'), { ssr: false }); // ✅ fix

export default function QlikReportLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const permissions = useSelector(
    (state: RootState) => state.auth.permissions?.yenerp || {}
  );

  const isModuleVisibleLocal = (key: string) => {
    const m = (permissions as any)?.[key];
    if (!m) return false;
    if (m.hide === true || m.hide === 1) return false;
    const noActions = !m.read && !m.add && !m.edit && !m.delete && !m.approve;
    if (noActions) return false;
    return m.read === true || m.read === 1;
  };

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

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <SideMenu
        onMenuClick={handleMenuClick}
        activePath={pathname || "/"}
        showPurchaseMenu={showPurchaseMenu}
        showBookMenu={showBookMenu}
        showInventoryMenu={showInventoryMenu}
        showReportsMenu={showReportsMenu}
      />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}