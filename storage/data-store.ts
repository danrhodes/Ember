import { Plugin, Notice } from 'obsidian';
import { HeatData, HeatDataStore, BackupMetadata, EmberSettings } from '../types';
import { HeatManager } from '../managers/heat-manager';

/**
 * DataStore
 *
 * Responsible for:
 * - Persisting heat data to JSON file
 * - Loading heat data from JSON file
 * - Creating and managing backups
 * - Data validation and error handling
 * - Incremental saves to minimize I/O
 */
export class DataStore {
	private plugin: Plugin;
	private settings: EmberSettings;
	private heatManager: HeatManager;
	private dataFilePath: string;
	private isDirty = false;
	private saveTimeout: number | null = null;
	private readonly SAVE_DEBOUNCE_MS = 5000; // 5 seconds
	private readonly DATA_VERSION = '1.0.0';

	constructor(plugin: Plugin, settings: EmberSettings, heatManager: HeatManager) {
		this.plugin = plugin;
		this.settings = settings;
		this.heatManager = heatManager;
		this.dataFilePath = 'heat-data.json';
	}

	/**
	 * Load heat data from JSON file
	 * @returns True if loaded successfully, false otherwise
	 */
	async load(): Promise<boolean> {
		try {
			const data = await this.plugin.loadData();

			if (!data || !data.heatData) {
				if (this.settings.debugLogging) {
					console.debug('Ember: no existing heat data found, starting fresh');
				}
				return false;
			}

			// Validate data structure
			if (!this.validateData(data.heatData)) {
				console.error('Ember: invalid heat data format, starting fresh');
				// Create backup of corrupted data for debugging
				await this.createCorruptedDataBackup(data);
				return false;
			}

			// Convert plain objects back to Map
			const heatMap = new Map<string, HeatData>();
			const store: HeatDataStore = data.heatData;

			for (const [path, heatData] of Object.entries(store.files)) {
				heatMap.set(path, heatData);
			}

			// Load into heat manager
			this.heatManager.loadData(heatMap);

			if (this.settings.debugLogging) {
				console.debug(`Ember: loaded ${heatMap.size} files from storage`);
			}
			return true;

		} catch (error) {
			console.error('Ember: error loading heat data:', error);
			new Notice('Ember: error loading heat data');
			return false;
		}
	}

	/**
	 * Save heat data to JSON file
	 * Uses debouncing to avoid excessive writes
	 * @param immediate - If true, save immediately without debouncing
	 */
	async save(immediate = false): Promise<void> {
		this.isDirty = true;

		if (immediate) {
			await this.performSave();
		} else {
			// Debounce saves
			if (this.saveTimeout !== null) {
				window.clearTimeout(this.saveTimeout);
			}

			this.saveTimeout = window.setTimeout(() => {
				void this.performSave().then(() => {
					this.saveTimeout = null;
				});
			}, this.SAVE_DEBOUNCE_MS);
		}
	}

	/**
	 * Actually perform the save operation
	 */
	private async performSave(): Promise<void> {
		if (!this.isDirty) return;

		try {
			// Create backup before saving
			await this.createBackup();

			// Convert Map to plain object for JSON serialization
			const heatMap = this.heatManager.getAllHeatData();
			const filesObject: Record<string, HeatData> = {};

			for (const [path, heatData] of heatMap) {
				filesObject[path] = heatData;
			}

			const store: HeatDataStore = {
				version: this.DATA_VERSION,
				lastSaved: Date.now(),
				files: filesObject
			};

			// Save to file using Obsidian's data API
			await this.plugin.saveData({ heatData: store });

			this.isDirty = false;
			if (this.settings.debugLogging) {
				console.debug(`Ember: saved ${heatMap.size} files to storage`);
			}

		} catch (error) {
			console.error('Ember: error saving heat data:', error);
			new Notice('Ember: error saving heat data');
		}
	}

	/**
	 * Create a backup of current data
	 */
	private async createBackup(): Promise<void> {
		try {
			const adapter = this.plugin.app.vault.adapter;
			const pluginDir = `${this.plugin.manifest.dir}`;
			const backupDir = `${pluginDir}/backups`;

			// Ensure backup directory exists
			try {
				await adapter.stat(backupDir);
			} catch {
				await adapter.mkdir(backupDir);
			}

			// Get existing heat data
			const currentData = await this.plugin.loadData();
			if (!currentData || !currentData.heatData) return;

			// Create backup filename with timestamp
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const backupPath = `${backupDir}/heat-data-${timestamp}.json`;

			// Create backup metadata
			const metadata: BackupMetadata = {
				timestamp: Date.now(),
				fileCount: Object.keys(currentData.heatData.files || {}).length,
				version: this.DATA_VERSION
			};

			const backupData = {
				metadata,
				data: currentData.heatData
			};

			// Save backup
			await adapter.write(backupPath, JSON.stringify(backupData, null, 2));

			// Clean up old backups (keep last N)
			await this.cleanupOldBackups(backupDir);

		} catch (error) {
			console.error('Ember: error creating backup:', error);
			// Don't throw - backups shouldn't block saves
		}
	}

	/**
	 * Remove old backups, keeping only the most recent ones
	 * @param backupDir - Directory containing backups
	 */
	private async cleanupOldBackups(backupDir: string): Promise<void> {
		try {
			const adapter = this.plugin.app.vault.adapter;
			const files = await adapter.list(backupDir);

			// Filter for heat data backups only
			const backupFiles = files.files
				.filter(f => f.includes('heat-data-'))
				.sort()
				.reverse(); // Most recent first

			// Keep only the configured number of backups
			const toDelete = backupFiles.slice(this.settings.backupCount);

			for (const file of toDelete) {
				await adapter.remove(file);
			}

		} catch (error) {
			console.error('Ember: error cleaning up backups:', error);
		}
	}

	/**
	 * Create backup of corrupted data for debugging
	 * @param corruptedData - The corrupted data to backup
	 */
	private async createCorruptedDataBackup(corruptedData: unknown): Promise<void> {
		try {
			const adapter = this.plugin.app.vault.adapter;
			const pluginDir = `${this.plugin.manifest.dir}`;
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const backupPath = `${pluginDir}/corrupted-data-${timestamp}.json`;

			await adapter.write(
				backupPath,
				JSON.stringify(corruptedData, null, 2)
			);

			if (this.settings.debugLogging) {
				console.debug(`Ember: corrupted data backed up to ${backupPath}`);
			}
		} catch (error) {
			console.error('Ember: error backing up corrupted data:', error);
		}
	}

	/**
	 * Validate heat data structure
	 * @param data - Data to validate
	 * @returns True if valid, false otherwise
	 */
	private validateData(data: unknown): boolean {
		if (!data || typeof data !== 'object') return false;

		const record = data as Record<string, unknown>;
		// Check required fields
		if (!record.version || !record.files) return false;

		// Check that files is an object
		if (typeof record.files !== 'object') return false;

		// Sample validation of a few entries
		const entries = Object.entries(record.files as Record<string, unknown>);
		const sampleSize = Math.min(5, entries.length);

		for (let i = 0; i < sampleSize; i++) {
			const [, heatData] = entries[i];

			if (typeof heatData !== 'object' || !heatData) return false;
			const heatRecord = heatData as Record<string, unknown>;

			// Validate required fields
			if (!heatRecord.path || !heatRecord.metrics) return false;

			// Validate metrics structure
			if (typeof heatRecord.metrics !== 'object' || !heatRecord.metrics) return false;
			const metrics = heatRecord.metrics as Record<string, unknown>;
			if (
				typeof metrics.accessCount !== 'number' ||
				typeof metrics.lastAccessed !== 'number' ||
				typeof metrics.isFavorite !== 'boolean'
			) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Export heat data to JSON string
	 * @returns JSON string of all heat data
	 */
	exportData(): string {
		const heatMap = this.heatManager.getAllHeatData();
		const filesObject: Record<string, HeatData> = {};

		for (const [path, heatData] of heatMap) {
			filesObject[path] = heatData;
		}

		const store: HeatDataStore = {
			version: this.DATA_VERSION,
			lastSaved: Date.now(),
			files: filesObject
		};

		return JSON.stringify(store, null, 2);
	}

	/**
	 * Import heat data from JSON string
	 * @param jsonData - JSON string to import
	 * @returns True if imported successfully
	 */
	async importData(jsonData: string): Promise<boolean> {
		try {
			const data = JSON.parse(jsonData);

			if (!this.validateData(data)) {
				new Notice('Ember: invalid import data format');
				return false;
			}

			// Create backup before import
			await this.createBackup();

			// Convert to Map
			const heatMap = new Map<string, HeatData>();
			for (const [path, heatData] of Object.entries(data.files)) {
				heatMap.set(path, heatData as HeatData);
			}

			// Load into heat manager
			this.heatManager.loadData(heatMap);

			// Save immediately
			await this.save(true);

			new Notice(`Ember: imported ${heatMap.size} files`);
			return true;

		} catch (error) {
			console.error('Ember: error importing data:', error);
			new Notice('Ember: error importing data');
			return false;
		}
	}

	/**
	 * Force immediate save (useful on plugin unload)
	 */
	async forceSave(): Promise<void> {
		if (this.saveTimeout !== null) {
			window.clearTimeout(this.saveTimeout);
			this.saveTimeout = null;
		}
		await this.performSave();
	}

	/**
	 * Clear all heat data and save
	 */
	async clearAll(): Promise<void> {
		// Create backup before clearing
		await this.createBackup();

		// Clear heat manager
		this.heatManager.clear();

		// Save immediately
		await this.save(true);

		new Notice('Ember: all heat data cleared');
	}

	/**
	 * Update settings
	 * @param settings - New settings object
	 */
	updateSettings(settings: EmberSettings): void {
		this.settings = settings;
	}
}
