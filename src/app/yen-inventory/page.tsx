"use client";
import dynamic from 'next/dynamic';
import React, { useMemo, useCallback } from "react";
import { Button } from "@mui/material";
import { usePathname, useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/usePermissions";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";

const SideMenu = dynamic(() => import('../../components/SideMenu'), {
  ssr: false,
});

const modules = [
  { label: "Outlets Inventory Management", path: "/yen-inventory/OutletsInventoryManagement" },
  { label: "Warehouse Inventory Management", path: "/yen-inventory/WarehouseInventoryManagement" },
];

const outletKeys = [
  "physicalstockmodification",
  "physicalstockvariancemodification",
  "stockledger",
];

const warehouseKeys = [
  "warehousephysicalstockmodification",
  "warehousephysicalstockvariancemodification",
  "warehousestockledger",
];

const YenInventoryPage = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { isModuleVisible } = usePermissions();

  // ✅ Redux permissions for SideMenu props calculation
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

  const isAnyModuleVisible = (keys: string[]) =>
    keys.some((k) => isModuleVisible("yenerp", k));

  // ✅ SideMenu visibility props
  const yenBookKeys = ["outgoingpayment", "advancepayment", "partialpayment", "paymentdone", "paymenthistory", "ledger", "purchasereturn", "expensecategory", "expensesubcategory", "expensename",];
  const purchaseMasterKeys = ["purchasecategory", "purchasesubcategory", "itemgroup", "purchaseuom", "purchasetax", "storagelocation", "freight", "itemtype", "service"];
  const vendorKeys = ["vendors", "vendortype"];
  const purchaseitemKeys = ["purchaseitem"];
  const purchaseOrderKeys = ["purchaseorders_pending", "purchaseorders_approved", "purchaseorders_rejected", "purchaseorders_grn_converted"];
  const serviceOrderKeys = ["serviceorders_pending", "serviceorders_approved", "serviceorders_rejected"];
  const grnKeys = ["grns", "grns_return"];
  const apInvoiceKeys = ["apinvoices"];

  const purchaseKeys = [...purchaseMasterKeys, ...vendorKeys, ...purchaseitemKeys, ...purchaseOrderKeys, ...serviceOrderKeys, ...grnKeys, ...apInvoiceKeys];

  const showBookMenu = yenBookKeys.some((k) => isModuleVisibleLocal(k));
  const showPurchaseMenu = purchaseKeys.some((k) => isModuleVisibleLocal(k));
  const showInventoryMenu = [...outletKeys, ...warehouseKeys].some((k) => isModuleVisibleLocal(k));
  const showReportsMenu = isModuleVisibleLocal("posreport") || isModuleVisibleLocal("purchaseorderreport");

  const visibleModules = useMemo(() => {
    return modules.filter((module) => {
      if (module.path.includes("Outlets")) return isAnyModuleVisible(outletKeys);
      if (module.path.includes("Warehouse")) return isAnyModuleVisible(warehouseKeys);
      return false;
    });
  }, [isModuleVisible]);

  const getWarehouseRedirect = () => {
    if (isModuleVisible("yenerp", "warehousephysicalstockmodification"))
      return "/yen-inventory/WarehouseInventoryManagement/stockModification";
    if (isModuleVisible("yenerp", "warehousephysicalstockvariancemodification"))
      return "/yen-inventory/WarehouseInventoryManagement/storeStockModification";
    if (isModuleVisible("yenerp", "warehousestockledger"))
      return "/yen-inventory/WarehouseInventoryManagement/ledger";
    return "/yen-inventory/WarehouseInventoryManagement/stockModification";
  };

  const getOutletRedirect = () => {
    if (isModuleVisible("yenerp", "physicalstockmodification"))
      return "/yen-inventory/OutletsInventoryManagement/OutletPhysicalStockModification";
    if (isModuleVisible("yenerp", "physicalstockvariancemodification"))
      return "/yen-inventory/OutletsInventoryManagement/OutletPhysicalStockVarianceModification";
    if (isModuleVisible("yenerp", "stockledger"))
      return "/yen-inventory/OutletsInventoryManagement/ledger";
    return "/yen-inventory/OutletsInventoryManagement/OutletPhysicalStockModification";
  };

  const handleMenuClick = useCallback(
    (menuItem: { path: string }) => {
      router.push(menuItem.path);
    },
    [router]
  );

  const handleModuleClick = React.useCallback(
    (moduleItem: { path: string }) => {
      let target: string;
      if (moduleItem.path.includes("Warehouse")) {
        target = getWarehouseRedirect();
      } else if (moduleItem.path.includes("Outlets")) {
        target = getOutletRedirect();
      } else {
        target = moduleItem.path;
      }
      router.push(target);
    },
    [router, isModuleVisible]
  );

  const isActiveRoute = (itemPath: string) => pathname?.startsWith(itemPath);

  return (
    <div>
      {/* ✅ SideMenu with correct props - same as YenPurchasePage */}
      <SideMenu
        onMenuClick={handleMenuClick}
        activePath={pathname || "/"}
        showPurchaseMenu={showPurchaseMenu}
        showBookMenu={showBookMenu}
        showInventoryMenu={showInventoryMenu}
        showReportsMenu={showReportsMenu}
      />
      <div className="flex flex-wrap gap-2 mt-4 ml-4 items-center justify-start">
        {visibleModules.length === 0 ? (
          <div className="text-gray-500 mt-6 ml-2">
            No inventory modules available for this role.
          </div>
        ) : (
          visibleModules.map((item) => {
            const isActive = isActiveRoute(item.path);
            return (
              <Button
                key={item.label}
                variant={isActive ? "contained" : "outlined"}
                color="primary"
                size="medium"
                sx={{
                  mt: -2,
                  textTransform: "none",
                  fontWeight: isActive ? "bold" : "normal",
                  fontSize: "14px",
                  borderRadius: "4px",
                  padding: "8px 16px",
                  height: "36px",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  transition: "all 0.2s ease",
                }}
                onClick={() => handleModuleClick(item)}
              >
                {item.label}
              </Button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default YenInventoryPage;