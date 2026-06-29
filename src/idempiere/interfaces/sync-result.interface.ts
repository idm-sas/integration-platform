export interface SyncResult {
  entity: string;
  strategy: 'full' | 'incremental';
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  durationMs: number;
  syncedAt: Date;
  error?: string;
}

export interface SyncStatus {
  lastFullSync: Date | null;
  lastIncrementalSync: Date | null;
  lastSyncResult: SyncResult | null;
  isRunning: boolean;
}
