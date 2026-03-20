'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PurchaseHome() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/QlikReport/PurchaseOrder/Purchaseorder');
  }, [router]);

  return null;
}