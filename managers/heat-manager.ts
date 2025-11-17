import { HeatData, HeatMetrics, HeatLevel, EmberSettings } from '../types';

/**
 * HeatManager
 *
 * Core manager responsible for:
 * - Storing heat data for all tracked files
 * - Calculating heat scores from metrics
 * - Determining heat levels
 * - Managing heat increases and decreases
 * - Handling manual boosts for favorites
 */
export class HeatManager {
	private heatMap: Map<string, HeatData>;
	private settings: EmberSettings;

	constructor(settings: EmberSettings) {
		this.heatMap = new Map();
		this.settings = settings;
	}

	/**
	 * Initialize or retrieve heat data for a file
	 */
	private getOrCreateHeatData(filePath: string): HeatData {
		if (!this.heatMap.has(filePath)) {
			const now = Date.now();
			const initialMetrics: HeatMetrics = {
				accessCount: 0,
				lastAccessed: now,
				successionCount: 0,
				successionTimestamp: 0,
				totalDuration: 0,
				sessionStart: null,
				editCount: 0,
				lastEdited: 0,
				isFavorite: false,
				favoriteBoost: 0
			};

			const heatData: HeatData = {
				path: filePath,
				heatScore: 0,
				metrics: initialMetrics,
				firstTracked: now,
				lastUpdated: now
			};

			this.heatMap.set(filePath, heatData);
		}

		return this.heatMap.get(filePath)!;
	}

	/**
	 * Increase heat for a file
	 * @param filePath - Path to the file
	 * @param amount - Amount of heat to add
	 * @param updateMetrics - Optional callback to update metrics
	 */
	increaseHeat(
		filePath: string,
		amount: number,
		updateMetrics?: (metrics: HeatMetrics) => void
	): void {
		const heatData = this.getOrCreateHeatData(filePath);

		// Update metrics if callback provided
		if (updateMetrics) {
			updateMetrics(heatData.metrics);
		}

		// Add base heat amount
		heatData.heatScore += amount;

		// Add manual boost if favorited
		if (heatData.metrics.isFavorite) {
			heatData.heatScore += heatData.metrics.favoriteBoost;
		}

		// Normalize to 0-100 scale
		heatData.heatScore = this.normalizeHeat(heatData.heatScore);

		// Update timestamp
		heatData.lastUpdated = Date.now();

		// Update in map
		this.heatMap.set(filePath, heatData);
	}

	/**
	 * Decrease heat for a file (used for decay)
	 * @param filePath - Path to the file
	 * @param percentage - Percentage of heat to remove (0-100)
	 */
	decreaseHeat(filePath: string, percentage: number): void {
		const heatData = this.heatMap.get(filePath);
		if (!heatData) return;

		// Skip decay for favorites if setting enabled
		if (
			heatData.metrics.isFavorite &&
			this.settings.pauseDecayForFavorites
		) {
			return;
		}

		// Calculate decay amount
		const decayAmount = (heatData.heatScore * percentage) / 100;

		// Apply differential decay for high heat if enabled
		let finalDecayAmount = decayAmount;
		if (this.settings.differentialDecay && heatData.heatScore > 70) {
			finalDecayAmount *= this.settings.differentialMultiplier;
		}

		// Apply decay
		heatData.heatScore = Math.max(0, heatData.heatScore - finalDecayAmount);

		// Update timestamp
		heatData.lastUpdated = Date.now();

		// Update in map
		this.heatMap.set(filePath, heatData);
	}

	/**
	 * Get heat level category for a given heat score
	 * @param heatScore - Normalized heat score (0-100)
	 * @returns HeatLevel enum value
	 */
	getHeatLevel(heatScore: number): HeatLevel {
		if (heatScore >= 90) return HeatLevel.BLAZING;
		if (heatScore >= 75) return HeatLevel.CRITICAL;
		if (heatScore >= 60) return HeatLevel.HOT;
		if (heatScore >= 40) return HeatLevel.WARM;
		if (heatScore >= 20) return HeatLevel.COOL;
		return HeatLevel.COLD;
	}

	/**
	 * Normalize heat value to 0-100 scale
	 * Uses soft cap to prevent extreme values while allowing growth
	 * @param heat - Raw heat value
	 * @returns Normalized value (0-100)
	 */
	normalizeHeat(heat: number): number {
		if (heat <= 0) return 0;
		if (heat >= 100) {
			// Soft cap: use logarithmic scaling above 100
			// This allows values to exceed 100 but compresses them
			return Math.min(100, 90 + Math.log10(heat - 100 + 1) * 10);
		}
		return heat;
	}

	/**
	 * Mark a file as favorite and add permanent boost
	 * @param filePath - Path to the file
	 * @param isFavorite - Whether file should be favorited
	 */
	setFavorite(filePath: string, isFavorite: boolean): void {
		const heatData = this.getOrCreateHeatData(filePath);

		heatData.metrics.isFavorite = isFavorite;
		heatData.metrics.favoriteBoost = isFavorite
			? this.settings.manualBoostValue
			: 0;

		// If favoriting, immediately add boost
		if (isFavorite) {
			heatData.heatScore = this.normalizeHeat(
				heatData.heatScore + this.settings.manualBoostValue
			);
		}

		heatData.lastUpdated = Date.now();
		this.heatMap.set(filePath, heatData);
	}

	/**
	 * Get heat data for a specific file
	 * @param filePath - Path to the file
	 * @returns HeatData or undefined if not tracked
	 */
	getHeatData(filePath: string): HeatData | undefined {
		return this.heatMap.get(filePath);
	}

	/**
	 * Get all heat data
	 * @returns Map of all heat data
	 */
	getAllHeatData(): Map<string, HeatData> {
		return new Map(this.heatMap);
	}

	/**
	 * Get sorted list of files by heat score
	 * @param limit - Maximum number of files to return
	 * @returns Array of HeatData sorted by heat (descending)
	 */
	getHottestFiles(limit?: number): HeatData[] {
		const sorted = Array.from(this.heatMap.values())
			.sort((a, b) => b.heatScore - a.heatScore);

		return limit ? sorted.slice(0, limit) : sorted;
	}

	/**
	 * Get sorted list of files by access frequency
	 * @param limit - Maximum number of files to return
	 * @returns Array of HeatData sorted by access count (descending)
	 */
	getMostPopularFiles(limit?: number): HeatData[] {
		const sorted = Array.from(this.heatMap.values())
			.sort((a, b) => b.metrics.accessCount - a.metrics.accessCount);

		return limit ? sorted.slice(0, limit) : sorted;
	}

	/**
	 * Get files with recent activity (within time window)
	 * @param timeWindowMs - Time window in milliseconds
	 * @param limit - Maximum number of files to return
	 * @returns Array of HeatData sorted by last accessed (descending)
	 */
	getRecentlyActiveFiles(timeWindowMs: number, limit?: number): HeatData[] {
		const now = Date.now();
		const cutoff = now - timeWindowMs;

		const filtered = Array.from(this.heatMap.values())
			.filter(data => data.metrics.lastAccessed > cutoff)
			.sort((a, b) => b.metrics.lastAccessed - a.metrics.lastAccessed);

		return limit ? filtered.slice(0, limit) : filtered;
	}

	/**
	 * Get "hot" files - files with recent activity weighted by heat
	 * Combines recency and heat to show files that are actively heating up
	 * @param timeWindowMs - Time window in milliseconds (default: 7 days)
	 * @param limit - Maximum number of files to return
	 * @returns Array of HeatData sorted by recency-weighted heat (descending)
	 */
	getHotFiles(timeWindowMs: number = 7 * 24 * 60 * 60 * 1000, limit?: number): HeatData[] {
		const now = Date.now();
		const cutoff = now - timeWindowMs;

		// Calculate recency-weighted scores
		const withScores = Array.from(this.heatMap.values())
			.filter(data => data.metrics.lastAccessed > cutoff)
			.map(data => {
				// Calculate how recent (0 to 1, where 1 is just now)
				const recencyFactor = (data.metrics.lastAccessed - cutoff) / timeWindowMs;

				// Weighted score: 70% heat, 30% recency
				// This ensures recently active files rise to the top
				const weightedScore = (data.heatScore * 0.7) + (recencyFactor * 100 * 0.3);

				return {
					data,
					weightedScore,
					recencyFactor
				};
			})
			.sort((a, b) => b.weightedScore - a.weightedScore);

		const sorted = withScores.map(item => item.data);
		return limit ? sorted.slice(0, limit) : sorted;
	}

	/**
	 * Remove heat data for a file (e.g., when file is deleted)
	 * @param filePath - Path to the file
	 */
	removeFile(filePath: string): void {
		this.heatMap.delete(filePath);
	}

	/**
	 * Rename file in heat map
	 * @param oldPath - Old file path
	 * @param newPath - New file path
	 */
	renameFile(oldPath: string, newPath: string): void {
		const heatData = this.heatMap.get(oldPath);
		if (heatData) {
			heatData.path = newPath;
			this.heatMap.delete(oldPath);
			this.heatMap.set(newPath, heatData);
		}
	}

	/**
	 * Load heat data from storage
	 * @param data - Map of file paths to HeatData
	 */
	loadData(data: Map<string, HeatData>): void {
		this.heatMap = new Map(data);
	}

	/**
	 * Reset all heat data
	 */
	clear(): void {
		this.heatMap.clear();
	}

	/**
	 * Import heat data for a specific file (used for import functionality)
	 * @param filePath - Path to the file
	 * @param data - HeatData to import
	 */
	importHeatData(filePath: string, data: HeatData): void {
		// Ensure path is updated to match key
		data.path = filePath;
		this.heatMap.set(filePath, data);
	}

	/**
	 * Reset heat for a specific file
	 * @param filePath - Path to the file
	 */
	resetFileHeat(filePath: string): void {
		const heatData = this.heatMap.get(filePath);
		if (heatData) {
			heatData.heatScore = 0;
			heatData.metrics.accessCount = 0;
			heatData.metrics.editCount = 0;
			heatData.metrics.totalDuration = 0;
			heatData.metrics.successionCount = 0;
			// Keep favorite status but reset boost effect on score
			if (!heatData.metrics.isFavorite) {
				heatData.metrics.favoriteBoost = 0;
			}
			heatData.lastUpdated = Date.now();
			this.heatMap.set(filePath, heatData);
		}
	}

	/**
	 * Clear all heat data (for timeline/snapshot loading)
	 */
	clearAllData(): void {
		this.heatMap.clear();
	}

	/**
	 * Set heat data directly (for timeline/snapshot loading)
	 */
	setHeatData(filePath: string, heatData: HeatData): void {
		this.heatMap.set(filePath, heatData);
	}

	/**
	 * Get statistics about current heat state
	 * @returns Statistics object
	 */
	getStatistics(): {
		totalFiles: number;
		averageHeat: number;
		maxHeat: number;
		minHeat: number;
		favoriteCount: number;
	} {
		const data = Array.from(this.heatMap.values());

		if (data.length === 0) {
			return {
				totalFiles: 0,
				averageHeat: 0,
				maxHeat: 0,
				minHeat: 0,
				favoriteCount: 0
			};
		}

		const heatScores = data.map(d => d.heatScore);
		const sum = heatScores.reduce((a, b) => a + b, 0);
		const favoriteCount = data.filter(d => d.metrics.isFavorite).length;

		return {
			totalFiles: data.length,
			averageHeat: sum / data.length,
			maxHeat: Math.max(...heatScores),
			minHeat: Math.min(...heatScores),
			favoriteCount
		};
	}

	/**
	 * Update settings (allows dynamic configuration changes)
	 * @param settings - New settings object
	 */
	updateSettings(settings: EmberSettings): void {
		this.settings = settings;
	}
}
