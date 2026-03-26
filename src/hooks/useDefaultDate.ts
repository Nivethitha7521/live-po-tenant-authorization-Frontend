// 'use client';

// import { useEffect, useState } from 'react';
// import { useDispatch } from 'react-redux';
// import {
//   setFiscalYear,
//   setFiscalMonth,
//   setDay,
// } from '../Features/slice';
// import { AppDispatch } from '@/redux/store';

// interface DefaultDate {
//   day: number;
//   month: number;
//   year: string;
// }

// let cachedDate: DefaultDate | null = null;

// export const useDefaultDate = () => {
//   const dispatch = useDispatch<AppDispatch>();
//   const [loading, setLoading] = useState(true);
//   const [date, setDate] = useState<DefaultDate | null>(null);

//   useEffect(() => {
//     const fetchDefaultDate = async () => {
//       setLoading(true);

//       if (cachedDate) {
//         setDate(cachedDate);
//         dispatch(setFiscalYear([cachedDate.year]));
//         dispatch(setFiscalMonth([cachedDate.month.toString()]));
//         dispatch(setDay([cachedDate.day]));
//         setLoading(false);
//         return;
//       }

//       try {
//         const res = await fetch('http://127.0.0.1:8000/liveapi/datetime');
//         const { current_date } = await res.json();

//         const [dd, mm, yyyy] = current_date
//           .split('-')
//           .map((v: string) => v.replace(/^0+/, ''));

//         cachedDate = {
//           day: Number(dd),
//           month: Number(mm),
//           year: yyyy,
//         };

//         setDate(cachedDate);

//         dispatch(setFiscalYear([cachedDate.year]));
//         dispatch(setFiscalMonth([cachedDate.month.toString()]));
//         dispatch(setDay([cachedDate.day]));
//       } catch (err) {
//         console.error('Failed to fetch default date', err);

//         const today = new Date();
//         cachedDate = {
//           day: today.getDate(),
//           month: today.getMonth() + 1,
//           year: today.getFullYear().toString(),
//         };

//         setDate(cachedDate);
//         dispatch(setFiscalYear([cachedDate.year]));
//         dispatch(setFiscalMonth([cachedDate.month.toString()]));
//         dispatch(setDay([cachedDate.day]));
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchDefaultDate();
//   }, [dispatch]);

//   return { date, loading };
// };
