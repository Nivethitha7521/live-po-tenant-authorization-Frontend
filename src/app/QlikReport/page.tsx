'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux/store';

const MainPage: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();

  // ✅ Permission check
  const permissionObject = useSelector((state: RootState) => state.auth.permissions);
  
  const hasPurchaseReportAccess = permissionObject?.yenerp?.purchaseorderreport?.read === true;
  const hasPosReportAccess = permissionObject?.yenerp?.posreport?.read === true;

  // ✅ Permission based-ஆ tabs filter
  const menuItems = useMemo(() => {
    const items = [];
    if (hasPurchaseReportAccess) {
      items.push({ label: 'Purchase Order', path: '/QlikReport/PurchaseOrder' });
    }
    if (hasPosReportAccess) {
      items.push({ label: 'Sale Order', path: '/QlikReport/Pos' });
    }
    return items;
  }, [hasPurchaseReportAccess, hasPosReportAccess]);



  const normalizePath = (path: string | null | undefined) => {
    if (!path) return '';
    return path.replace(/\/+$/, '').toLowerCase();
  };

  const currentPath = normalizePath(pathname);

  return (
    <div className="flex h-full bg-[#f8f9fa] overflow-hidden font-sans">
      <div className="flex-1 flex flex-col min-w-0">

        {/* TOP TABS - permission based filter */}
        <div className="bg-[#eeeeee] border-b border-gray-300 px-4 pt-2 shrink-0 shadow-inner">
          <div className="flex overflow-x-auto gap-[2px] no-scrollbar">
            {menuItems.map((tab: { label: string; path: string }) => {
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
                  {isActive && (
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-black" />
                  )}
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