const STORAGE_KEY = 'wcag-crawler-scans';

export interface StoredScan {
  id: string;
  url: string;
  createdAt: string;
}

export const scanStorage = {
  getAll(): StoredScan[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  add(scan: StoredScan): void {
    const scans = this.getAll();
    // Add to beginning, remove duplicates
    const filtered = scans.filter(s => s.id !== scan.id);
    const updated = [scan, ...filtered].slice(0, 50); // Keep last 50
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  remove(id: string): void {
    const scans = this.getAll();
    const filtered = scans.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  },

  getIds(): string[] {
    return this.getAll().map(s => s.id);
  },

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};
