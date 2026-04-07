// hooks/useGrnCreditNotes.ts
import { RootState } from '@/redux/store';
import { useSelector } from 'react-redux';

interface CreditNoteStatus {
  tooltipTitle: string;
  isDisabled: boolean;
}

export const useGrnCreditNotes = (grnIds: string[]): Record<string, CreditNoteStatus> => {
  const hasDebitCreditNotes = useSelector((state: RootState) => state.grn.hasDebitCreditNotes || {});

  return grnIds.reduce((acc, grnId) => {
    const hasNotes = hasDebitCreditNotes[grnId] ?? false;
    acc[grnId] = {
      tooltipTitle: hasNotes ? 'View Debit/Credit Notes' : 'No Debit/Credit Notes Available',
      isDisabled: !hasNotes,
    };
    return acc;
  }, {} as Record<string, CreditNoteStatus>);
};