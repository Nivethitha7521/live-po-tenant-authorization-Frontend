// @/Models/importResult.ts
export interface ImportResult {
  message?: string;
  inserted_count?: number;
  updated_count?: number;
  inserted_itemgroup_count?: number;
  updated_itemgroup_count?: number;
  successful?: Array<{ row: number | string; data: Record<string, any> }>;
  updated?: Array<{ row: number | string; data: Record<string, any>; error?: string ;Reason?:string;}>;
  successful_itemgroups?: Array<{ row: string; data: Record<string, any> }>;
  updated_itemgroups?: Array<{ row: string; data: Record<string, any> }>;
  failed?: Array<{ row: number | string; data: Record<string, any>; error: string; missingFields?: string[] }>;
  errorCount?: number;
  detail?: { message: string; missing?: string[]; required?: string[] };
}