export type ScanMode = "auto" | "entry" | "exit";

export type VerificationStatus = "ALLOWED" | "DENIED";

export interface AssetItem {
  type: "books" | "gadgets" | string;
  name: string;
}

export interface ScanResult {
  id: string;
  status: VerificationStatus;
  flag: string;
  mode: "entry" | "exit";
  roll?: string;
  name?: string;
  laptop?: string | null;
  extra?: AssetItem[];
  message?: string;
  timestamp: string;
  rawToken?: string;
}

export type ScannerScreenState = "IDLE" | "PROCESSING" | "RESULT";
