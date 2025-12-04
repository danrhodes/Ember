import { Plugin, TFile, Notice } from 'obsidian';
import { EmberSettings, StorageMode } from '../types';
import { HeatManager } from '../managers/heat-manager';

/**
 * PropertyStorageManager
 *
 * Responsible for:
 * - Reading heat data from frontmatter properties
 * - Writing heat data to frontmatter properties
 * - Syncing between JSON and property storage
 * - Handling conflicts between JSON and properties
 * - Migration from JSON-only to property storage
 *
 * Enables Dataview integration by storing heat scores in frontmatter
 */
export class PropertyStorageManager {
	private plugin: Plugin;
	private settings: EmberSettings;
	private heatManager: HeatManager;

	constructor(plugin: Plugin, settings: EmberSettings, heatManager: HeatManager) {
		this.plugin = plugin;
		this.settings = settings;
		this.heatManager = heatManager;
	}

	/**
	 * Read heat data from file's frontmatter
	 * @param file - File to read from
	 * @returns Heat score or null if not found
	 */
	readFromProperty(file: TFile): number | null {
		try {
			const cache = this.plugin.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) {
				return null;
			}

			const propertyValue = cache.frontmatter[this.settings.propertyName];

			// Handle different property formats
			if (typeof propertyValue === 'number') {
				return propertyValue;
			} else if (typeof propertyValue === 'string') {
				const parsed = parseFloat(propertyValue);
				return isNaN(parsed) ? null : parsed;
			}

			return null;
		} catch (error) {
			console.error(`Ember: Error reading property from ${file.path}:`, error);
			return null;
		}
	}

	/**
	 * Write heat score to file's frontmatter
	 * @param file - File to write to
	 * @param heatScore - Heat score to write
	 */
	async writeToProperty(file: TFile, heatScore: number): Promise<boolean> {
		try {
			await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
				// Round to 2 decimal places for cleaner display
				frontmatter[this.settings.propertyName] = Math.round(heatScore * 100) / 100;
			});
			return true;
		} catch (error) {
			console.error(`Ember: Error writing property to ${file.path}:`, error);
			return false;
		}
	}

	/**
	 * Remove heat property from file's frontmatter
	 * @param file - File to remove property from
	 */
	async removeFromProperty(file: TFile): Promise<boolean> {
		try {
			await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
				delete frontmatter[this.settings.propertyName];
			});
			return true;
		} catch (error) {
			console.error(`Ember: Error removing property from ${file.path}:`, error);
			return false;
		}
	}

	/**
	 * Sync heat data to properties based on storage mode
	 * Called after heat updates
	 * @param filePath - Path to file
	 */
	async syncToProperty(filePath: string): Promise<void> {
		// Only sync if property storage is enabled
		if (this.settings.storageMode === StorageMode.JSON_ONLY) {
			return;
		}

		const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile) || file.extension !== 'md') {
			return;
		}

		const heatData = this.heatManager.getHeatData(filePath);
		if (!heatData) {
			// No heat data - remove property if it exists
			await this.removeFromProperty(file);
			return;
		}

		// Write heat score to property
		await this.writeToProperty(file, heatData.heatScore);
	}

	/**
	 * Load heat data from properties for all files
	 * Used when switching to property storage mode or on conflict resolution
	 * @returns Map of file paths to heat scores
	 */
	async loadAllFromProperties(): Promise<Map<string, number>> {
		const heatScores = new Map<string, number>();
		const markdownFiles = this.plugin.app.vault.getMarkdownFiles();

		for (const file of markdownFiles) {
			const heatScore = this.readFromProperty(file);
			if (heatScore !== null) {
				heatScores.set(file.path, heatScore);
			}
		}

		return await Promise.resolve(heatScores);
	}

	/**
	 * Write all heat data to properties
	 * Used during migration or bulk sync
	 * @param showProgress - Whether to show progress notices
	 */
	async writeAllToProperties(showProgress = false): Promise<{
		success: number;
		failed: number;
		skipped: number;
	}> {
		const stats = { success: 0, failed: 0, skipped: 0 };
		const allHeatData = this.heatManager.getAllHeatData();
		const markdownFiles = this.plugin.app.vault.getMarkdownFiles();

		if (showProgress) {
			new Notice(`Ember: Starting property migration for ${markdownFiles.length} files...`);
		}

		for (const file of markdownFiles) {
			const heatData = allHeatData.get(file.path);

			if (!heatData) {
				stats.skipped++;
				continue;
			}

			const success = await this.writeToProperty(file, heatData.heatScore);
			if (success) {
				stats.success++;
			} else {
				stats.failed++;
			}

			// Add small delay to avoid overwhelming the system
			if (markdownFiles.length > 100 && stats.success % 50 === 0) {
				await new Promise(resolve => setTimeout(resolve, 100));
			}
		}

		if (showProgress) {
			new Notice(`Ember: Migration complete. ${stats.success} success, ${stats.failed} failed, ${stats.skipped} skipped.`);
		}

		return stats;
	}

	/**
	 * Remove all heat properties from all files
	 * Used when switching away from property storage
	 * @param showProgress - Whether to show progress notices
	 */
	async removeAllProperties(showProgress = false): Promise<{
		success: number;
		failed: number;
	}> {
		const stats = { success: 0, failed: 0 };
		const markdownFiles = this.plugin.app.vault.getMarkdownFiles();

		if (showProgress) {
			new Notice(`Ember: Removing heat properties from ${markdownFiles.length} files...`);
		}

		for (const file of markdownFiles) {
			const hasProperty = this.readFromProperty(file);
			if (hasProperty === null) {
				continue; // No property to remove
			}

			const success = await this.removeFromProperty(file);
			if (success) {
				stats.success++;
			} else {
				stats.failed++;
			}

			// Add small delay to avoid overwhelming the system
			if (markdownFiles.length > 100 && stats.success % 50 === 0) {
				await new Promise(resolve => setTimeout(resolve, 100));
			}
		}

		if (showProgress) {
			new Notice(`Ember: Cleanup complete. ${stats.success} properties removed, ${stats.failed} failed.`);
		}

		return stats;
	}

	/**
	 * Resolve conflicts between JSON and property storage
	 * Uses the strategy defined in settings
	 * @param strategy - 'json-wins', 'property-wins', or 'higher-wins'
	 */
	async resolveConflicts(strategy: 'json-wins' | 'property-wins' | 'higher-wins' = 'json-wins'): Promise<{
		resolved: number;
		conflicts: number;
	}> {
		const stats = { resolved: 0, conflicts: 0 };
		const markdownFiles = this.plugin.app.vault.getMarkdownFiles();

		for (const file of markdownFiles) {
			const jsonHeatData = this.heatManager.getHeatData(file.path);
			const propertyHeat = this.readFromProperty(file);

			// No conflict if only one source has data
			if (!jsonHeatData && propertyHeat === null) continue;
			if (!jsonHeatData || propertyHeat === null) continue;

			// Both have data - potential conflict
			const jsonHeat = jsonHeatData.heatScore;
			if (Math.abs(jsonHeat - propertyHeat) < 0.01) {
				continue; // Values match, no conflict
			}

			stats.conflicts++;

			// Resolve based on strategy
			let winningHeat: number;
			switch (strategy) {
				case 'json-wins':
					winningHeat = jsonHeat;
					break;
				case 'property-wins':
					winningHeat = propertyHeat;
					// Update JSON with property value
					jsonHeatData.heatScore = propertyHeat;
					this.heatManager.importHeatData(file.path, jsonHeatData);
					break;
				case 'higher-wins':
					winningHeat = Math.max(jsonHeat, propertyHeat);
					if (propertyHeat > jsonHeat) {
						jsonHeatData.heatScore = propertyHeat;
						this.heatManager.importHeatData(file.path, jsonHeatData);
					}
					break;
			}

			// Sync to property
			await this.writeToProperty(file, winningHeat);
			stats.resolved++;
		}

		return stats;
	}

	/**
	 * Update settings
	 * @param settings - New settings object
	 */
	updateSettings(settings: EmberSettings): void {
		this.settings = settings;
	}
}
