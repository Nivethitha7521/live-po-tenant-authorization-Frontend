'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux/store';

const tabs = [
  { label: 'Production Entry', path: '/QlikReport/Pos/productionEntry1' },
  { label: 'Dispatches', path: '/QlikReport/Pos/Dispatchall' },
  { label: 'Dispatch Receive', path: '/QlikReport/Pos/DispatchReceive' },
  { label: 'Dispatch Location Receive', path: '/QlikReport/Pos/DispatchLocationReceive' },
  { label: 'Sales Order', path: '/QlikReport/Pos/saleOrder' },
  { label: 'Overall Sales', path: '/QlikReport/Pos/SalasReport' },
  { label: 'Itemwise Sales', path: '/QlikReport/Pos/itemwise' },
  { label: 'Orderwise Sales', path: '/QlikReport/Pos/ItemOrder' },
  { label: 'Cancel Orders', path: '/QlikReport/Pos/CancelOrder' },
  { label: 'Day End Report', path: '/QlikReport/Pos/dayend' },
  { label: 'Item Transfer', path: '/QlikReport/Pos/Itemtransfer' },
  { label: 'Wastage Entry', path: '/QlikReport/Pos/wastageEntry' },
  { label: 'Wastage Receive', path: '/QlikReport/Pos/wastageReceive' },
  { label: 'Cake App', path: '/QlikReport/Pos/birthdaycakeapp' },
  { label: 'All Restaurants', path: '/QlikReport/Pos/AllRestaurant' },
  { label: 'Pay Mode', path: '/QlikReport/Pos/Paymode' },
];

export default function POSLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter(); // ✅ add

  // ✅ add - permission check
  const permissionObject = useSelector((state: RootState) => state.auth.permissions);
  const hasPosReportAccess = permissionObject?.yenerp?.posreport?.read === true;

  // ✅ add - access இல்லன்னா redirect
  useEffect(() => {
    if (!hasPosReportAccess) {
      router.replace('/QlikReport');
    }
  }, [hasPosReportAccess, router]);

  const normalizePath = (path: string | null | undefined) => {
    if (!path) return '';
    return path.replace(/\/+$/, '').toLowerCase();
  };

  const currentPath = normalizePath(pathname);

  // ✅ add - access இல்லன்னா render பண்ணாதே
  if (!hasPosReportAccess) return null;

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] overflow-hidden font-sans">
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
                {isActive && <div className="absolute top-0 left-0 right-0 h-[2px] bg-black" />}
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="flex-1 overflow-hidden p-4 bg-white">
        <div className="h-full w-full bg-white rounded-sm border border-gray-200 overflow-auto shadow-md">
          {children}
        </div>
      </div>
    </div>
  );
}