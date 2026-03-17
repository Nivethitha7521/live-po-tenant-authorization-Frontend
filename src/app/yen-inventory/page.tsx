"use client";
import React, { useMemo } from "react";
import { Button } from "@mui/material";
import { usePathname, useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/usePermissions"; // ✅ Import hook

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

  // ✅ usePermissions hook use பண்றோம் - local function இல்ல
  const { isModuleVisible } = usePermissions();

  const isAnyModuleVisible = (keys: string[]) =>
    keys.some((k) => isModuleVisible("yenerp", k)); // ✅ "yenerp" pass பண்றோம்

  const visibleModules = useMemo(() => {
    return modules.filter((module) => {
      if (module.path.includes("Outlets"))
        return isAnyModuleVisible(outletKeys);
      if (module.path.includes("Warehouse"))
        return isAnyModuleVisible(warehouseKeys);
      return false;
    });
  }, [isModuleVisible]); // ✅ dependency சரியா இருக்கு

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

const handleMenuClick = React.useCallback(
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
                onClick={() => handleMenuClick(item)}
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