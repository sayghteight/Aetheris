import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface BackupSettings {
  enabled: boolean;
  folder_path: string | null;
  max_backups: number;
  incremental: boolean;
}

export interface BackupInfo {
  name: string;
  path: string;
  created_at: string;
  size_bytes: number;
}

export interface OldBackupInfo {
  name: string;
  path: string;
}

interface BackupState {
  settings: BackupSettings;
  backups: BackupInfo[];
  oldBackups: OldBackupInfo[];
  isLoading: boolean;
  error: string | null;
  hasCheckedOldBackups: boolean;

  loadSettings: () => Promise<void>;
  saveSettings: (settings: BackupSettings) => Promise<void>;
  loadBackups: (projectPath: string) => Promise<void>;
  createBackup: (projectPath: string) => Promise<BackupInfo>;
  createAutoBackup: (projectPath: string) => Promise<BackupInfo | null>;
  deleteBackup: (path: string) => Promise<void>;
  restoreBackup: (projectPath: string, backupPath: string, createCurrentBackup: boolean) => Promise<void>;
  verifyBackup: (path: string) => Promise<boolean>;
  detectOldBackups: (projectPath: string) => Promise<OldBackupInfo[]>;
  migrateOldBackups: (projectPath: string, paths: string[]) => Promise<BackupInfo[]>;
  pickFolder: () => Promise<string | null>;
  openBackupFolder: (projectPath: string) => Promise<void>;
  clearError: () => void;
}

const defaultSettings: BackupSettings = {
  enabled: true,
  folder_path: null,
  max_backups: 25,
  incremental: false,
};

export const useBackupStore = create<BackupState>((set, get) => ({
  settings: defaultSettings,
  backups: [],
  oldBackups: [],
  isLoading: false,
  error: null,
  hasCheckedOldBackups: false,

  loadSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const settings = await invoke<BackupSettings>('get_backup_settings_cmd');
      set({ settings, isLoading: false });
    } catch (e: any) {
      const errMsg = typeof e === 'string' ? e : e.message || 'Error al cargar configuración de backups';
      set({ error: errMsg, isLoading: false });
    }
  },

  saveSettings: async (settings: BackupSettings) => {
    set({ isLoading: true, error: null });
    try {
      const saved = await invoke<BackupSettings>('update_backup_settings_cmd', { settings });
      set({ settings: saved, isLoading: false });
    } catch (e: any) {
      const errMsg = typeof e === 'string' ? e : e.message || 'Error al guardar configuración de backups';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  loadBackups: async (projectPath: string) => {
    set({ isLoading: true, error: null });
    try {
      const backups = await invoke<BackupInfo[]>('get_backups_cmd', { projectPath });
      set({ backups, isLoading: false });
    } catch (e: any) {
      const errMsg = typeof e === 'string' ? e : e.message || 'Error al cargar backups';
      set({ error: errMsg, isLoading: false });
    }
  },

  createBackup: async (projectPath: string) => {
    set({ isLoading: true, error: null });
    try {
      const backup = await invoke<BackupInfo>('create_backup_cmd', { projectPath });
      // Refresh backup list
      await get().loadBackups(projectPath);
      set({ isLoading: false });
      return backup;
    } catch (e: any) {
      const errMsg = typeof e === 'string' ? e : e.message || 'Error al crear backup';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  createAutoBackup: async (projectPath: string) => {
    // Auto backup doesn't set loading state to avoid UI flicker
    try {
      const backup = await invoke<BackupInfo | null>('create_auto_backup_cmd', { projectPath });
      if (backup) {
        // Refresh backup list only if a backup was actually created
        await get().loadBackups(projectPath);
        return backup;
      }
      return null; // No backup created (incremental mode, not enough time passed)
    } catch (e: any) {
      // Silently fail for auto-backup to not interrupt user workflow
      console.warn('Auto-backup failed:', e);
      return null;
    }
  },

  deleteBackup: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      await invoke('delete_backup_cmd', { backupPath: path });
      set({ isLoading: false });
    } catch (e: any) {
      const errMsg = typeof e === 'string' ? e : e.message || 'Error al eliminar backup';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  restoreBackup: async (projectPath: string, backupPath: string, createCurrentBackup: boolean) => {
    set({ isLoading: true, error: null });
    try {
      await invoke('restore_backup_cmd', {
        projectPath,
        backupPath,
        createCurrentBackup,
      });
      set({ isLoading: false });
    } catch (e: any) {
      const errMsg = typeof e === 'string' ? e : e.message || 'Error al restaurar backup';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  verifyBackup: async (path: string) => {
    try {
      return await invoke<boolean>('verify_backup_cmd', { backupPath: path });
    } catch (e: any) {
      return false;
    }
  },

  detectOldBackups: async (projectPath: string) => {
    try {
      const oldBackups = await invoke<OldBackupInfo[]>('detect_old_backups_cmd', { projectPath });
      set({ oldBackups, hasCheckedOldBackups: true });
      return oldBackups;
    } catch (e: any) {
      return [];
    }
  },

  migrateOldBackups: async (projectPath: string, paths: string[]) => {
    set({ isLoading: true, error: null });
    try {
      const migrated = await invoke<BackupInfo[]>('migrate_old_backups_cmd', {
        projectPath,
        oldBackupPaths: paths,
      });
      // Refresh backup list
      await get().loadBackups(projectPath);
      set({ oldBackups: [], isLoading: false });
      return migrated;
    } catch (e: any) {
      const errMsg = typeof e === 'string' ? e : e.message || 'Error al migrar backups';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  pickFolder: async () => {
    try {
      return await invoke<string | null>('pick_backup_folder_cmd');
    } catch (e) {
      return null;
    }
  },

  openBackupFolder: async (projectPath: string) => {
    try {
      await invoke('open_backup_folder_cmd', { projectPath });
    } catch (e) {
      console.error('Error opening backup folder:', e);
    }
  },

  clearError: () => set({ error: null }),
}));
