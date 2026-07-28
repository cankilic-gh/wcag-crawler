import type { ScanConfig } from '../types';

export function configForRescan(config: ScanConfig): ScanConfig {
  return {
    ...config,
    authentication: null,
  };
}
