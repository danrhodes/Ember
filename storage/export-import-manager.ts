import { Plugin, Notice } from 'obsidian';
import { EmberSettings, HeatData, ExportData } from '../types';
import { HeatManager } from '../managers/heat-manager';

/**
 * ExportImportManager
 *
 * Responsible for:
 * - Exporting heat data to JSON format with metadata
 * - Exporting heat data to CSV format for spreadsheet analysis
 * - Importing heat data from JSON with validation
 * - Merge strategies (replace, merge, skip duplicates)
 * - Backup creation before import
 */
export class ExportImportManager {
	private plugin: Plugin;
	private settings: EmberSettings;
	private heatManager: HeatManager;

	constructor(plugin: Plugin, settings: EmberSettings, heatManager: HeatManager) {
		this.plugin = plugin;
		this.settings = settings;
		this.heatManager = heatManager;
	}

	/**
	 * Export heat data to JSON format
	 * Creates a comprehensive export with metadata
	 * @returns JSON string ready for download
	 */
	exportToJSON(): string {
		const allHeatData = this.heatManager.getAllHeatData();

		const exportData: ExportData = {
			metadata: {
				exportDate: Date.now(),
				version: '1.0.0',
				vaultName: this.plugin.app.vault.getName(),
				fileCount: allHeatData.size
			},
			data: {
				version: '1.0.0',
				lastSaved: Date.now(),
				files: this.convertMapToRecord(allHeatData)
			}
		};

		return JSON.stringify(exportData, null, 2);
	}

	/**
	 * Export heat data to CSV format
	 * Suitable for spreadsheet analysis
	 * @returns CSV string ready for download
	 */
	exportToCSV(): string {
		const allHeatData = this.heatManager.getAllHeatData();

		// CSV Header
		const headers = [
			'File Path',
			'Heat Score',
			'Access Count',
			'Last Accessed',
			'Edit Count',
			'Last Edited',
			'Total Duration (min)',
			'Succession Count',
			'Is Favorite',
			'First Tracked',
			'Last Updated'
		];

		const rows: string[] = [headers.join(',')];

		// CSV Data
		for (const [path, data] of allHeatData) {
			const row = [
				this.escapeCSV(path),
				data.heatScore.toFixed(2),
				data.metrics.accessCount,
				this.formatDateForCSV(data.metrics.lastAccessed),
				data.metrics.editCount,
				this.formatDateForCSV(data.metrics.lastEdited),
				(data.metrics.totalDuration / 60000).toFixed(2), // Convert ms to minutes
				data.metrics.successionCount,
				data.metrics.isFavorite ? 'Yes' : 'No',
				this.formatDateForCSV(data.firstTracked),
				this.formatDateForCSV(data.lastUpdated)
			];
			rows.push(row.join(','));
		}

		return rows.join('\n');
	}

	/**
	 * Import heat data from JSON
	 * @param jsonString - JSON string to import
	 * @param strategy - How to handle existing data ('replace', 'merge', 'skip')
	 * @param createBackup - Whether to create backup before import
	 * @returns Result object with success status and statistics
	 */
	async importFromJSON(
		jsonString: string,
		strategy: 'replace' | 'merge' | 'skip' = 'merge',
		createBackup = true
	): Promise<{
		success: boolean;
		message: string;
		stats?: {
			imported: number;
			skipped: number;
			updated: number;
		};
	}> {
		try {
			// Parse and validate JSON
			const importData = JSON.parse(jsonString);
			const validationResult = this.validateImportData(importData);

			if (!validationResult.valid) {
				return {
					success: false,
					message: `Invalid import data: ${validationResult.error}`
				};
			}

			// Create backup if requested
			if (createBackup) {
				await this.createBackup();
			}

			// Import based on strategy
			const stats = await this.applyImportStrategy(importData.data, strategy);

			return {
				success: true,
				message: `Import completed successfully. ${stats.imported} files imported, ${stats.updated} updated, ${stats.skipped} skipped.`,
				stats
			};

		} catch (error) {
			return {
				success: false,
				message: `Import failed: ${error.message}`
			};
		}
	}

	/**
	 * Validate import data structure
	 * @param data - Data to validate
	 * @returns Validation result
	 */
	private validateImportData(data: unknown): { valid: boolean; error?: string } {
		// Check if data exists
		if (!data || typeof data !== 'object') {
			return { valid: false, error: 'No data provided' };
		}

		const record = data as Record<string, unknown>;
		// Check for metadata
		if (!record.metadata || !record.data) {
			return { valid: false, error: 'Missing metadata or data section' };
		}

		const metadata = record.metadata as Record<string, unknown>;
		// Check metadata structure
		if (!metadata.exportDate || !metadata.version) {
			return { valid: false, error: 'Invalid metadata structure' };
		}

		const dataSection = record.data as Record<string, unknown>;
		// Check data structure
		if (!dataSection.files || typeof dataSection.files !== 'object') {
			return { valid: false, error: 'Invalid data structure' };
		}

		// Validate at least one file entry
		const fileEntries = Object.values(dataSection.files as Record<string, unknown>);
		if (fileEntries.length > 0) {
			const firstEntry = fileEntries[0] as Record<string, unknown>;
			if (firstEntry.heatScore === undefined && firstEntry.heatScore !== 0) {
				return { valid: false, error: 'Invalid file entry structure' };
			}
		}

		return { valid: true };
	}

	/**
	 * Apply import strategy to data
	 * @param dataStore - Import data store
	 * @param strategy - Import strategy
	 * @returns Statistics about the import
	 */
	private async applyImportStrategy(
		dataStore: { files: Record<string, HeatData> },
		strategy: 'replace' | 'merge' | 'skip'
	): Promise<{ imported: number; skipped: number; updated: number }> {
		const stats = { imported: 0, skipped: 0, updated: 0 };
		const currentData = this.heatManager.getAllHeatData();

		if (strategy === 'replace') {
			// Replace all data
			this.heatManager.clear();

			for (const [path, heatData] of Object.entries(dataStore.files)) {
				this.heatManager.importHeatData(path, heatData);
				stats.imported++;
			}
		} else if (strategy === 'merge') {
			// Merge: Update existing, add new
			for (const [path, heatData] of Object.entries(dataStore.files)) {
				if (currentData.has(path)) {
					// File exists - merge by taking higher heat score
					const existing = currentData.get(path);
					if (!existing) continue;

					if (heatData.heatScore > existing.heatScore) {
						this.heatManager.importHeatData(path, heatData);
						stats.updated++;
					} else {
						stats.skipped++;
					}
				} else {
					// New file - import
					this.heatManager.importHeatData(path, heatData);
					stats.imported++;
				}
			}
		} else if (strategy === 'skip') {
			// Skip: Only add new files, don't update existing
			for (const [path, heatData] of Object.entries(dataStore.files)) {
				if (currentData.has(path)) {
					stats.skipped++;
				} else {
					this.heatManager.importHeatData(path, heatData);
					stats.imported++;
				}
			}
		}

		return stats;
	}

	/**
	 * Create backup of current heat data
	 * @returns Path to backup file
	 */
	async createBackup(): Promise<string> {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const backupFileName = `heat-data-backup-${timestamp}.json`;
		const backupPath = `.obsidian/plugins/ember/${backupFileName}`;

		const exportData = this.exportToJSON();

		try {
			await this.plugin.app.vault.adapter.write(backupPath, exportData);
			return backupPath;
		} catch (error) {
			console.error('Ember: Failed to create backup:', error);
			throw new Error('Failed to create backup');
		}
	}

	/**
	 * Download file to user's system
	 * Creates a download link and triggers download
	 * @param content - File content
	 * @param filename - Filename for download
	 * @param mimeType - MIME type of file
	 */
	downloadFile(content: string, filename: string, mimeType = 'application/json'): void {
		const blob = new Blob([content], { type: mimeType });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		link.click();
		URL.revokeObjectURL(url);
	}

	/**
	 * Export and download JSON
	 */
	exportJSONToFile(): void {
		const json = this.exportToJSON();
		const timestamp = new Date().toISOString().split('T')[0];
		const filename = `ember-heat-data-${timestamp}.json`;
		this.downloadFile(json, filename, 'application/json');
		new Notice('Heat data exported to JSON');
	}

	/**
	 * Export and download CSV
	 */
	exportCSVToFile(): void {
		const csv = this.exportToCSV();
		const timestamp = new Date().toISOString().split('T')[0];
		const filename = `ember-heat-data-${timestamp}.csv`;
		this.downloadFile(csv, filename, 'text/csv');
		new Notice('Heat data exported to CSV');
	}

	/**
	 * Convert Map to Record for JSON serialization
	 */
	private convertMapToRecord(map: Map<string, HeatData>): Record<string, HeatData> {
		const record: Record<string, HeatData> = {};
		for (const [key, value] of map) {
			record[key] = value;
		}
		return record;
	}

	/**
	 * Escape CSV field
	 */
	private escapeCSV(field: string): string {
		if (field.includes(',') || field.includes('"') || field.includes('\n')) {
			return `"${field.replace(/"/g, '""')}"`;
		}
		return field;
	}

	/**
	 * Format date for CSV
	 */
	private formatDateForCSV(timestamp: number): string {
		if (!timestamp || timestamp === 0) return '';
		return new Date(timestamp).toISOString();
	}

	/**
	 * Update settings
	 * @param settings - New settings object
	 */
	updateSettings(settings: EmberSettings): void {
		this.settings = settings;
	}
}
