"use client";
import React from 'react';
import Link from 'next/link';
import { Button, Box, Typography } from '@mui/material';
import YenBookPage from '../page';
import { usePermissions } from '@/hooks/usePermissions'; 
const subItems = [
  { label: 'Expense Category', path: '/yen-book/ExpenseManagementPage/ExpenseCategoryPage', module: 'expensecategory' },
  { label: 'Expense Subcategory', path: '/yen-book/ExpenseManagementPage/ExpenseSubcategoryPage', module: 'expensesubcategory'  },
  { label: 'Expense Name', path: '/yen-book/ExpenseManagementPage/ExpenseNamePage', module: 'expensename'  },

  
];

const ExpenseManagementPage = () => {
     const { isModuleVisible } = usePermissions();
  return (
    <Box >
      <YenBookPage/>
      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, marginBottom: 1,marginTop:1,marginLeft:2}}>
        {subItems.map((item) => (
          isModuleVisible('yenerp', item.module) ? ( 
          <Link key={item.label} href={item.path} passHref>
            <Button variant="contained" component="a">
              {item.label}
            </Button>
          </Link>
          ) : null
        ))}
      </Box>
<></>
    </Box>
  );
};

export default ExpenseManagementPage;
