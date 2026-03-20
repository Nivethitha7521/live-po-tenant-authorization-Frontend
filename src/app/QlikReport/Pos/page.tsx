'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PosHome() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/QlikReport/Pos/productionEntry1');
  }, [router]);

  return null;
}