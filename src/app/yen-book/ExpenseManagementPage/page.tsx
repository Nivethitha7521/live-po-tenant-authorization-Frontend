"use client";
import React, { useMemo, useEffect } from 'react'; // ✅ useMemo, useEffect add
import Link from 'next/link';
import { Button, Box } from '@mui/material';
import YenBookPage from '../page';
import { usePermissions } from '@/hooks/usePermissions';
import { usePathname, useRouter } from 'next/navigation'; // ✅ add

const subItems = [
  { label: 'Expense Category', path: '/yen-book/ExpenseManagementPage/ExpenseCategoryPage', module: 'expensecategory' },
  { label: 'Expense Subcategory', path: '/yen-book/ExpenseManagementPage/ExpenseSubcategoryPage', module: 'expensesubcategory' },
  { label: 'Expense Name', path: '/yen-book/ExpenseManagementPage/ExpenseNamePage', module: 'expensename' },
];

const ExpenseManagementPage = () => {
  const { isModuleVisible } = usePermissions();
  const pathname = usePathname(); // ✅ add
  const router = useRouter();     // ✅ add

  // ✅ First visible sub-item கண்டுபிடி
  const visibleSubItems = useMemo(() =>
    subItems.filter((item) => isModuleVisible('yenerp', item.module)),
    [isModuleVisible]
  );

  // ✅ Exact ExpenseManagementPage-ல் இருந்தா first visible-க்கு redirect
  useEffect(() => {
    const isExact =
      pathname === '/yen-book/ExpenseManagementPage' ||
      pathname === '/yen-book/ExpenseManagementPage/';

    if (isExact && visibleSubItems.length > 0) {
      router.replace(visibleSubItems[0].path);
    }
  }, [pathname, visibleSubItems, router]);

  return (
    <Box>
      <YenBookPage />
      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, marginBottom: 1, marginTop: 1, marginLeft: 2 }}>
        {visibleSubItems.map((item) => ( // ✅ visibleSubItems use பண்ணு
          <Link key={item.label} href={item.path} passHref>
            <Button variant="contained" component="a">
              {item.label}
            </Button>
          </Link>
        ))}
      </Box>
    </Box>
  );
};

export default ExpenseManagementPage;