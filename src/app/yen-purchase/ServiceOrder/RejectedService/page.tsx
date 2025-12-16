// src/app/yen-purchase/ServiceOrder/ApprovedService/page.tsx
import { redirect } from 'next/navigation';

export default function RejectedServicePage() {
  redirect('/yen-purchase/ServiceOrder');
  return null;
}