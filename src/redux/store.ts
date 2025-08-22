import { configureStore } from '@reduxjs/toolkit';
import onlinePartnersReducer from '../features/onlinePartnersSlice';
import billReceiptsReducer from '../features/billReceiptsSlice';
import purchaseOrderReducer from '../features/yen-purchase/PurchaseOrder/purchaseOrderSlice';
import grnReducer from '../features/yen-purchase/GRN/grnSlice';
import apInvoiceReducer from '../features/yen-purchase/AP/apInvoiceSlice';
import outgoingPaymentReducer from '../features/yen-purchase/Outgoing/outgoingPaymentSlice';
import vendorReducer from '../features/yen-purchase/PurchaseMaster/vendorSlice';
import purchaseItemReducer from '../features/yen-purchase/PurchaseMaster/purchaseItemSlice';
import purchaseRequisitionReducer from '../features/purchaseRequisitionSlice';
import budgetReducer from '../features/budgetSlice';
import barcodeReducer from '../features/barcodeSlice';
import customerReducer from '../features/customerSlice';
import feedbackReducer from '../features/feedbackSlice';
import employeeReducer from '../features/employeeSlice';
import pfesiReducer from '../features/pfesiSlice';
import salaryReducer from '../features/salarySlice';
import shiftReducer from '../features/shiftSlice';
import timingRuleReducer from '../features/timingRuleSlice';
import hrmReducer from '../features/hrmSlice';
import attendanceReducer from '../features/attendanceSlice';
import dailyAttendanceReducer from '../features/dailyAttendanceSlice';
import monthlyAttendanceReducer from '../features/monthlyAttendanceSlice';
import payrollReducer from '../features/payrollSlice';
import leaveManagementReducer from '../features/leaveManagementSlice';
import depositReducer from '../features/depositSlice';
import employeemasterReducer from '../features/employeemasterSlice';
import designationReducer from '../features/designationSlice';
import departmentReducer from '../features/departmentSlice';
import cashReducer from '../features/cashSlice';
import openingCashReducer from '../features/openingCashSlice';
import outletsInventoryReducer from '../features/outletsInventorySlice';
import warehouseInventoryReducer from '../features/wharehouseInventorySlice';
import outletPhysicalStockReducer from '../features/outletPhysicalStockSlice';
import warehouseStoreStockReducer from '../features/warehouseStoreStockSlice';
import barcodeItemsReducer from '../features/barcodeItemsSlice';
import printUniqueBarcodesReducer from '../features/printUniqueBarcodesSlice';
import paymentReducer from '../features/paymentSlice';
import purchaseMasterItemReducer from '../features/yen-purchase/purchaseMasterSlice';
import PurchaseCategoryReducer  from '../features/yen-purchase/PurchaseMaster/PurchaseCategorySlice';
import purchaseSubcategoryReducer from '../features/yen-purchase/PurchaseMaster/PurchaseSubcategorySlice'; // Adjust import path
import groupMasterReducer from '../features/yen-purchase/PurchaseMaster/GroupMasterSlice';
import VendorTypeReducer from '../features/yen-purchase/PurchaseMaster/VendorTypeSlice';
import PurchaseUomReducer from '../features/yen-purchase/PurchaseMaster/PurchaseUomSlice'
import purchaseTaxReducer from '../features/yen-purchase/PurchaseMaster/purchaseTaxSlice';
import StorageLocationReducer from '../features/yen-purchase/PurchaseMaster/StorageLocationSlice';
import itemTypeReducer from '../features/yen-purchase/PurchaseMaster/itemTypeSlice';
import purchaselistReducer from '../features/yen-purchase/PurchaseOrder/purchaseListSlice';
import businessReducer from '@/features/account-setting/businessSlice';
import personalReducer from '@/features/account-setting/personalSlice';
// import locationReducer from '../features/masterAdminSlice/locationSlice';
// import subcategoryReducer from '../features/masterAdminSlice/subcategorySlice';
// import inventoryTypeReducer from '../features/masterAdminSlice/inventoryTypeSlice';
// import warehouseReducer from '../features/masterAdminSlice/warehouseSlice';
// import freetypeReducer from '@/features/yen-crm/freetypeSlice';

// import categoryReducer from '../features/masterAdminSlice/categorySlice';
import uomReducer from '../features/uomSlice';
import vendorMasterReducer from '../features/yen-purchase/PurchaseMaster/vendorMaster';
import poitemRedcuer from '../features/yen-purchase/PurchaseOrder/poitemSlice';
import csvOperationsReducer from '../features/yen-purchase/PurchaseMaster/csvOperationSlice';
import photoDocumentReducer from '../features/yen-purchase/PurchaseOrder/photoSlice';
// import itemgroupReducer from '../features/masterAdminSlice/itemgroupSlice';
// import addOnReducer from '../features/masterAdminSlice/addOnSlice';
// import variantReducer from '../features/masterAdminSlice/variantsSlice';

// import orderTypeReducer from '../features/masterAdminSlice/orderTypeSlice';
// import vehicleReducer from '../features/masterAdminSlice/vehicleSlice';
// import promotionalOfferReducer from '../features/yen-crm/promotionalOfferSlice';
// import roleReducer from '../features/roleSlice';
import userAccountReducer from '../features/userAccountSlice';
// import taxReducer from '../features/masterAdminSlice/taxSlice';
// import discountReducer from '../features/masterAdminSlice/discountSlice';
// import currencyReducer from '../features/masterAdminSlice/currencySlice';

import locationAreaReducer from '../features/locationAreaSlice';

// import tableReducer from '../features/yen-pos/tableSlice';
// import assetReducer from '../features/yen-pos/assetSlice';

// import mixboxReducer from '../features/masterAdminSlice/mixBoxSlice';

// import posDeviceReducer from '../features/yen-pos/posDeviceSlice';
import authReducer from '../features/authSlice';
// import posDeviceReducer from '../features/yen-pos/posDeviceSlice';
import assetReducer from '../features/assetSlice';
import debitCreditNoteReducer from '../features/yen-purchase/DebitNoteSlice'

const store = configureStore({
  reducer: {
    // locations: locationAreaReducer,
   
    onlinePartners: onlinePartnersReducer,
    billReceipts: billReceiptsReducer,
    purchaseOrder: purchaseOrderReducer,
    grn: grnReducer,
    apInvoice: apInvoiceReducer,
    outgoingPayment: outgoingPaymentReducer,
    vendor: vendorReducer,
    purchaseItems: purchaseItemReducer,
    masterPurchase:purchaseMasterItemReducer,
    purchaseRequisition: purchaseRequisitionReducer,
    budget: budgetReducer,
    barcode: barcodeReducer,
    customer: customerReducer,
    feedback: feedbackReducer,
    employee: employeeReducer,
    pfesi: pfesiReducer,
    salary: salaryReducer,
    shift: shiftReducer,
    timingRules: timingRuleReducer,
    hrm: hrmReducer,
    attendance: attendanceReducer,
    dailyAttendance: dailyAttendanceReducer,
    monthlyAttendance: monthlyAttendanceReducer,
    locationAreas: locationAreaReducer,
    payroll: payrollReducer,
    leaveManagement: leaveManagementReducer,
    assets: assetReducer,
    deposit: depositReducer,
    // warehouseData: warehouseReducer,
    employeemaster: employeemasterReducer,
    designation: designationReducer,
    department: departmentReducer,
    // table: tableReducer,
    cash: cashReducer,
    openingCash: openingCashReducer,
    outletsInventory: outletsInventoryReducer,
    warehouseInventory: warehouseInventoryReducer,
    outletPhysicalStock: outletPhysicalStockReducer,
    warehouseStoreStock: warehouseStoreStockReducer,
    barcodeItems: barcodeItemsReducer,
    printUniqueBarcodes: printUniqueBarcodesReducer,
    payment: paymentReducer,
    // role: roleReducer,
    userAccount: userAccountReducer,
    auth: authReducer,
    purchaseSubcategory: purchaseSubcategoryReducer,
    purchaseCategory:PurchaseCategoryReducer,
    groupItems: groupMasterReducer,
    vendorType:VendorTypeReducer,
    purchaseUom:PurchaseUomReducer,
    purchaseTax:purchaseTaxReducer,
    storageLocations:StorageLocationReducer,
    itemtype:itemTypeReducer,
    purchaseList:purchaselistReducer,
    business:businessReducer,
    personal:personalReducer,
    photos:photoDocumentReducer,
    // subCategory: subcategoryReducer,
    // Category: categoryReducer,
    uoms: uomReducer,
    vendorMaster:vendorMasterReducer,
    purchaseOrderItems:poitemRedcuer,
    csvOperations:csvOperationsReducer,
    debitCreditNote:debitCreditNoteReducer
    // addOns: addOnReducer,    
    // variants: variantReducer,

    // orderTypes: orderTypeReducer,
    // vehicles: vehicleReducer,
    // mixBox: mixboxReducer,
    // // assets: assetReducer,
    // warehouses: warehouseReducer,
    // currency: currencyReducer,

    // inventoryType: inventoryTypeReducer,
   
    // itemGroup:itemgroupReducer,
    // taxes: taxReducer,
    // discounts: discountReducer,
    
    // locationAreas: locationAreaReducer,
    
    //  promotionalOffers: promotionalOfferReducer,
    // freetype: freetypeReducer,
    // locations: locationReducer,
    // posDevice: posDeviceReducer,
  },
});

// Define the RootState type based on the store's state
export type RootState = ReturnType<typeof store.getState>;

// Define the AppDispatch type based on the store's dispatch
export type AppDispatch = typeof store.dispatch;

export default store;


