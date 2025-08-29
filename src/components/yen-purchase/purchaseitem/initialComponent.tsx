"use client";
import * as yup from 'yup';

// Validation Schema
export const validationSchema = yup.object({
  itemName: yup.string().required('Item Name is required'),
  purchasecategoryName: yup.string().required('Category is required'),
  itemgroupName: yup.string().required('Item Group is required'),
  purchasePrice: yup
    .number()
    .typeError('Purchase price must be a number')
    .required('Purchase price is required')
    .moreThan(0, 'Purchase price must be greater than 0'),
  uom: yup.string().required('UOM is required'),
  purchasetaxName: yup.number().required('Tax required'),
  purchasesubcategoryName: yup.string().required('Subcategory is required'),
  shelfLife:yup.string().required('Shelf Life is Required')
});

// Initial Purchase Item State
export const initialPurchaseState = {
  purchaseitemId: '',
  itemName: '',
  randomId: '',
  purchasecategoryName: '',
  purchasesubcategoryName: '',
  itemgroupName: '',
  uom: '',
  stockQuantity: 0,
  supplier: '',
  purchasePrice: 0,
  purchasetaxName: '',
  reorderLevel: 0,
  itemType: '',
  hsnCode: '',
  shelfLife: '',
  vendorTag: [],
  locationName: '',
  barcode: '',
  description: '',
  status: '',
  createdDate: null,
  lastUpdatedDate: null,
};

