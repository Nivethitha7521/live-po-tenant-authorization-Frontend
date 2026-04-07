// src/redux/hooks.ts
import { TypedUseSelectorHook, useDispatch as useDispatchBase, useSelector as useSelectorBase } from 'react-redux';
import type { RootState, AppDispatch } from '../redux/store';

// Use these typed versions throughout your application instead of the plain `useDispatch` and `useSelector`
export const useDispatch = () => useDispatchBase<AppDispatch>();
export const useSelector: TypedUseSelectorHook<RootState> = useSelectorBase;
