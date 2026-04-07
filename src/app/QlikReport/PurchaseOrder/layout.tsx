'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';              
import { RootState } from '@/redux/store';


const tabs = [
  { label: 'Purchase Orders', path: '/QlikReport/PurchaseOrder/Purchaseorder' },
  { label: 'Item & Date GRN', path: '/QlikReport/PurchaseOrder/Itemwisedate' },
  { label: 'GRN Against PO', path: '/QlikReport/PurchaseOrder/grn' },
  { label: 'AP Invoice (Item)', path: '/QlikReport/PurchaseOrder/Apinvoice' },
  { label: 'AP Invoice (Svc)', path: '/QlikReport/PurchaseOrder/Apinvoiceservice' },
  { label: 'Outgoing Pmts', path: '/QlikReport/PurchaseOrder/Outgoing' },
  { label: 'Outstanding Pmts', path: '/QlikReport/PurchaseOrder/Outstanding' },
  { label: 'Dispatch Reports', path: '/QlikReport/PurchaseOrder/rawmaterial2' },
  { label: 'Debit Note (Item)', path: '/QlikReport/PurchaseOrder/DebitnoteItemwise' },
  { label: 'Debit Note (Amt)', path: '/QlikReport/PurchaseOrder/DebitnoteAmountwise' },
  { label: 'Petty Cash', path: '/QlikReport/PurchaseOrder/PettycashExpense' },
];

export default function PurchaseLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter(); 

    const permissionObject = useSelector((state: RootState) => state.auth.permissions);
  const hasPurchaseReportAccess = permissionObject?.yenerp?.purchaseorderreport?.read === true;

  // ✅ add - access இல்லன்னா redirect
  useEffect(() => {
    if (!hasPurchaseReportAccess) {
      router.replace('/QlikReport');
    }
  }, [hasPurchaseReportAccess, router]);
  const normalizePath = (path: string | null | undefined) => {
    if (!path) return '';
    return path.replace(/\/+$/, '').toLowerCase();
  };

  const currentPath = normalizePath(pathname);
  if (!hasPurchaseReportAccess) return null;
  return (
    // ✅ Sidebar div நீக்கினோம், full width use பண்றோம்
    <div className="flex flex-col h-full bg-[#f8f9fa] overflow-hidden font-sans">

      {/* ERP Tab Ribbon */}
      <div className="bg-[#eeeeee] border-b border-gray-300 px-4 pt-2 shrink-0 shadow-inner">
        <div className="flex overflow-x-auto gap-[2px] no-scrollbar">
          {tabs.map((tab) => {
            const targetPath = normalizePath(tab.path);
            const isActive = currentPath === targetPath;

            return (
              <Link
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
                {isActive && (
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-black" />
                )}
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Page Content */}
      <div className="flex-1 overflow-hidden p-4 bg-white">
        <div className="h-full w-full bg-white rounded-sm border border-gray-200 overflow-auto shadow-md">
          {children}
        </div>
      </div>

    </div>
  );
}