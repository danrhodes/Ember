import { Plugin } from 'obsidian';
import { EmberSettings, HeatData } from '../types';
import { HeatManager } from '../managers/heat-manager';

/**
 * Snapshot data structure
 */
export interface HeatSnapshot {
	timestamp: number;
	fileCount: number;
	averageHeat: number;
	data: Map<string, HeatData>;
}

/**
 * Snapshot metadata (for compressed storage)
 */
export interface SnapshotMetadata {
	timestamp: number;
	fileCount: number;
	averageHeat: number;
	compressed: boolean;
}

/**
 * ArchivalManager
 *
 * Responsible for:
 * - Creating periodic snapshots of heat data
 * - Managing snapshot retention period
 * - Automatic cleanup of old snapshots
 * - Compressed storage for efficiency
 * - Loading historical snapshots for timeline features
 *
 * Snapshots enable:
 * - Timeline scrubbing (view heat over time)
 * - Historical analysis
 * - Trend detection
 * - Data recovery
 */
export class ArchivalManager {
	private plugin: Plugin;
	private settings: EmberSettings;
	private heatManager: HeatManager;
	private snapshotInterval: number | null = null;
	private snapshots: HeatSnapshot[] = [];
	private readonly SNAPSHOTS_FILE = 'heat-snapshots.json';

	constructor(plugin: Plugin, settings: EmberSettings, heatManager: HeatManager) {
		this.plugin = plugin;
		this.settings = settings;
		this.heatManager = heatManager;
	}

	/**
	 * Start the archival system
	 */
	async start(): Promise<void> {
		// Load existing snapshots
		await this.loadSnapshots();

		// Schedule periodic snapshots if enabled
		if (this.settings.archival.enabled) {
			this.scheduleSnapshots();
		}
	}

	/**
	 * Stop the archival system
	 */
	stop(): void {
		if (this.snapshotInterval !== null) {
			window.clearInterval(this.snapshotInterval);
			this.snapshotInterval = null;
		}
	}

	/**
	 * Schedule periodic snapshots
	 */
	private scheduleSnapshots(): void {
		// Clear existing interval
		if (this.snapshotInterval !== null) {
			window.clearInterval(this.snapshotInterval);
		}

		// Calculate interval in milliseconds
		const intervalMs = this.getSnapshotIntervalMs();

		// Create initial snapshot if none exist
		if (this.snapshots.length === 0) {
			this.createSnapshot();
		}

		// Schedule periodic snapshots
		this.snapshotInterval = window.setInterval(() => {
			this.createSnapshot();
		}, intervalMs);
	}

	/**
	 * Get snapshot interval in milliseconds
	 */
	private getSnapshotIntervalMs(): number {
		switch (this.settings.archival.snapshotFrequency) {
			case 'hourly':
				return 60 * 60 * 1000; // 1 hour
			case 'daily':
				return 24 * 60 * 60 * 1000; // 1 day
			case 'weekly':
				return 7 * 24 * 60 * 60 * 1000; // 1 week
			default:
				return 24 * 60 * 60 * 1000; // Default: daily
		}
	}

	/**
	 * Create a snapshot of current heat data
	 */
	async createSnapshot(): Promise<void> {
		const allHeatData = this.heatManager.getAllHeatData();
		const heatArray = Array.from(allHeatData.values());

		// Calculate average heat
		const avgHeat = heatArray.length > 0
			? heatArray.reduce((sum, d) => sum + d.heatScore, 0) / heatArray.length
			: 0;

		// Create snapshot
		const snapshot: HeatSnapshot = {
			timestamp: Date.now(),
			fileCount: allHeatData.size,
			averageHeat: avgHeat,
			data: new Map(allHeatData)
		};

		// Add to snapshots array
		this.snapshots.push(snapshot);

		// Cleanup old snapshots
		await this.cleanupOldSnapshots();

		// Save snapshots
		await this.saveSnapshots();

		if (this.settings.debugLogging) {
			console.debug(`Ember: Created heat snapshot (${snapshot.fileCount} files, avg heat: ${avgHeat.toFixed(1)})`);
		}
	}

	/**
	 * Cleanup old snapshots based on retention settings
	 */
	private async cleanupOldSnapshots(): Promise<void> {
		const retentionMs = this.settings.archival.retentionDays * 24 * 60 * 60 * 1000;
		const cutoffTime = Date.now() - retentionMs;

		const beforeCount = this.snapshots.length;

		// Remove snapshots older than retention period
		this.snapshots = this.snapshots.filter(s => s.timestamp > cutoffTime);

		// Also enforce max snapshots limit
		if (this.snapshots.length > this.settings.archival.maxSnapshots) {
			// Keep most recent snapshots
			this.snapshots = this.snapshots.slice(-this.settings.archival.maxSnapshots);
		}

		const afterCount = this.snapshots.length;
		const removedCount = beforeCount - afterCount;

		if (removedCount > 0 && this.settings.debugLogging) {
			console.debug(`Ember: Cleaned up ${removedCount} old snapshots`);
		}
	}

	/**
	 * Load snapshots from storage
	 */
	private async loadSnapshots(): Promise<void> {
		try {
			const dataPath = `${this.plugin.manifest.dir}/${this.SNAPSHOTS_FILE}`;
			const data = await this.plugin.app.vault.adapter.read(dataPath);
			const parsed = JSON.parse(data);

			// Convert plain objects back to Maps
			this.snapshots = parsed.map((s: unknown) => {
				const snapshot = s as Record<string, unknown>;
				return {
					timestamp: snapshot.timestamp as number,
					fileCount: snapshot.fileCount as number,
					averageHeat: snapshot.averageHeat as number,
					data: new Map(Object.entries(snapshot.data as Record<string, HeatData>))
				};
			});

			if (this.settings.debugLogging) {
				console.debug(`Ember: Loaded ${this.snapshots.length} snapshots`);
			}
		} catch (error) {
			// File doesn't exist or is corrupted - start fresh
			this.snapshots = [];
			if (this.settings.debugLogging) {
				console.debug('Ember: No existing snapshots found, starting fresh');
			}
		}
	}

	/**
	 * Save snapshots to storage
	 */
	private async saveSnapshots(): Promise<void> {
		try {
			const dataPath = `${this.plugin.manifest.dir}/${this.SNAPSHOTS_FILE}`;

			// Convert Maps to plain objects for JSON serialization
			const serializable = this.snapshots.map(s => ({
				timestamp: s.timestamp,
				fileCount: s.fileCount,
				averageHeat: s.averageHeat,
				data: Object.fromEntries(s.data)
			}));

			const json = JSON.stringify(serializable, null, 2);
			await this.plugin.app.vault.adapter.write(dataPath, json);
		} catch (error) {
			console.error('Ember: Failed to save snapshots:', error);
		}
	}

	/**
	 * Get all snapshots
	 */
	getSnapshots(): HeatSnapshot[] {
		return [...this.snapshots];
	}

	/**
	 * Get snapshot count
	 */
	getSnapshotCount(): number {
		return this.snapshots.length;
	}

	/**
	 * Get oldest snapshot timestamp
	 */
	getOldestSnapshotTime(): number | null {
		if (this.snapshots.length === 0) return null;
		return this.snapshots[0].timestamp;
	}

	/**
	 * Get latest snapshot timestamp
	 */
	getLatestSnapshotTime(): number | null {
		if (this.snapshots.length === 0) return null;
		return this.snapshots[this.snapshots.length - 1].timestamp;
	}

	/**
	 * Get snapshot closest to a specific timestamp
	 */
	getSnapshotAt(timestamp: number): HeatSnapshot | null {
		if (this.snapshots.length === 0) return null;

		// Binary search for closest snapshot
		let closest = this.snapshots[0];
		let minDiff = Math.abs(timestamp - closest.timestamp);

		for (const snapshot of this.snapshots) {
			const diff = Math.abs(timestamp - snapshot.timestamp);
			if (diff < minDiff) {
				minDiff = diff;
				closest = snapshot;
			}
		}

		return closest;
	}

	/**
	 * Get snapshots in a time range
	 */
	getSnapshotsInRange(startTime: number, endTime: number): HeatSnapshot[] {
		return this.snapshots.filter(
			s => s.timestamp >= startTime && s.timestamp <= endTime
		);
	}

	/**
	 * Get heat history for a specific file
	 */
	getFileHeatHistory(filePath: string): Array<{ timestamp: number; heatScore: number }> {
		const history: Array<{ timestamp: number; heatScore: number }> = [];

		for (const snapshot of this.snapshots) {
			const heatData = snapshot.data.get(filePath);
			if (heatData) {
				history.push({
					timestamp: snapshot.timestamp,
					heatScore: heatData.heatScore
				});
			}
		}

		return history;
	}

	/**
	 * Get average heat over time
	 */
	getAverageHeatHistory(): Array<{ timestamp: number; averageHeat: number }> {
		return this.snapshots.map(s => ({
			timestamp: s.timestamp,
			averageHeat: s.averageHeat
		}));
	}

	/**
	 * Get total file count over time
	 */
	getFileCountHistory(): Array<{ timestamp: number; fileCount: number }> {
		return this.snapshots.map(s => ({
			timestamp: s.timestamp,
			fileCount: s.fileCount
		}));
	}

	/**
	 * Delete all snapshots
	 */
	async clearAllSnapshots(): Promise<void> {
		this.snapshots = [];
		await this.saveSnapshots();
		if (this.settings.debugLogging) {
			console.debug('Ember: Cleared all snapshots');
		}
	}

	/**
	 * Get list of snapshots with metadata (for timeline view)
	 */
	async getSnapshotList(): Promise<Array<{ timestamp: number; date: string }>> {
		return this.snapshots.map(s => ({
			timestamp: s.timestamp,
			date: new Date(s.timestamp).toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			})
		}));
	}

	/**
	 * Load a snapshot into the HeatManager (for timeline viewing)
	 */
	async loadSnapshot(timestamp: number): Promise<boolean> {
		const snapshot = this.getSnapshotAt(timestamp);
		if (!snapshot) {
			console.error('Ember: Snapshot not found for timestamp', timestamp);
			return false;
		}

		try {
			// Store current state before overwriting
			if (!this.currentStateBackup) {
				this.currentStateBackup = new Map(this.heatManager.getAllHeatData());
			}

			// Clear current heat data
			this.heatManager.clearAllData();

			// Load snapshot data into heat manager
			for (const [path, heatData] of snapshot.data.entries()) {
				this.heatManager.setHeatData(path, heatData);
			}

			if (this.settings.debugLogging) {
				console.debug('Ember: Loaded snapshot from', new Date(snapshot.timestamp).toLocaleString());
			}
			return true;
		} catch (error) {
			console.error('Ember: Failed to load snapshot:', error);
			return false;
		}
	}

	/**
	 * Restore the current state (return from historical viewing)
	 */
	async restoreCurrentState(): Promise<void> {
		if (!this.currentStateBackup) {
			console.warn('Ember: No backup state to restore');
			return;
		}

		try {
			// Clear current data
			this.heatManager.clearAllData();

			// Restore backed up data
			for (const [path, heatData] of this.currentStateBackup.entries()) {
				this.heatManager.setHeatData(path, heatData);
			}

			// Clear backup
			this.currentStateBackup = null;

			if (this.settings.debugLogging) {
				console.debug('Ember: Restored current state');
			}
		} catch (error) {
			console.error('Ember: Failed to restore current state:', error);
		}
	}

	// Backup storage for current state when viewing history
	private currentStateBackup: Map<string, HeatData> | null = null;

	/**
	 * Update settings and restart scheduling if needed
	 */
	async updateSettings(settings: EmberSettings): Promise<void> {
		const wasEnabled = this.settings.archival.enabled;
		const oldFrequency = this.settings.archival.snapshotFrequency;

		this.settings = settings;

		// Handle enable/disable
		if (settings.archival.enabled && !wasEnabled) {
			// Archival was enabled
			this.scheduleSnapshots();
		} else if (!settings.archival.enabled && wasEnabled) {
			// Archival was disabled
			this.stop();
		} else if (settings.archival.enabled && oldFrequency !== settings.archival.snapshotFrequency) {
			// Frequency changed, restart scheduling
			this.scheduleSnapshots();
		}

		// Cleanup if retention settings changed
		await this.cleanupOldSnapshots();
		await this.saveSnapshots();
	}

	/**
	 * Force create a snapshot now (for testing or manual backup)
	 */
	async forceSnapshot(): Promise<void> {
		await this.createSnapshot();
	}

	/**
	 * Get statistics about snapshots
	 */
	getStatistics(): {
		count: number;
		oldestDate: string | null;
		latestDate: string | null;
		totalSize: number;
		averageFileCount: number;
	} {
		const count = this.snapshots.length;
		const oldestTime = this.getOldestSnapshotTime();
		const latestTime = this.getLatestSnapshotTime();

		const totalFileCount = this.snapshots.reduce((sum, s) => sum + s.fileCount, 0);
		const averageFileCount = count > 0 ? totalFileCount / count : 0;

		// Estimate total size (rough estimate based on data structure)
		const totalSize = this.snapshots.reduce((sum, s) => sum + s.data.size * 200, 0); // ~200 bytes per entry

		return {
			count,
			oldestDate: oldestTime ? new Date(oldestTime).toLocaleString() : null,
			latestDate: latestTime ? new Date(latestTime).toLocaleString() : null,
			totalSize,
			averageFileCount
		};
	}
}
