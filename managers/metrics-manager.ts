import { HeatMetrics, EmberSettings } from '../types';
import { HeatManager } from './heat-manager';

/**
 * MetricsManager
 *
 * Responsible for:
 * - Tracking multiple metrics (frequency, recency, succession, duration, edits)
 * - Calculating weighted composite scores
 * - Providing metric-based heat contributions
 * - Working with HeatManager to update overall heat
 */
export class MetricsManager {
	private settings: EmberSettings;
	private heatManager: HeatManager;
	private lastAccessedFile: string | null = null;

	constructor(settings: EmberSettings, heatManager: HeatManager) {
		this.settings = settings;
		this.heatManager = heatManager;
	}

	/**
	 * Handle file access event
	 * Updates frequency, recency, and succession metrics
	 * @param filePath - Path to the accessed file
	 */
	onFileAccess(filePath: string): void {
		const now = Date.now();

		this.heatManager.increaseHeat(
			filePath,
			this.settings.heatIncrements.fileOpen,
			(metrics: HeatMetrics) => {
				// Update access frequency
				metrics.accessCount++;

				// Check for succession (quick return)
				const timeSinceLastAccess = now - metrics.lastAccessed;
				if (
					this.lastAccessedFile === filePath &&
					timeSinceLastAccess < this.settings.heatIncrements.quickReturnWindow
				) {
					metrics.successionCount++;
					metrics.successionTimestamp = now;

					// Add bonus heat for quick return
					this.heatManager.increaseHeat(
						filePath,
						this.settings.heatIncrements.quickReturn
					);
				} else {
					// Reset succession if too much time passed or different file
					if (timeSinceLastAccess > this.settings.heatIncrements.quickReturnWindow) {
						metrics.successionCount = 0;
					}
				}

				// Update recency
				metrics.lastAccessed = now;

				// Start session timer if not already running
				if (metrics.sessionStart === null) {
					metrics.sessionStart = now;
				}
			}
		);

		// Track last accessed file for succession detection
		this.lastAccessedFile = filePath;
	}

	/**
	 * Handle file edit event
	 * Updates edit count and adds edit heat
	 * @param filePath - Path to the edited file
	 */
	onFileEdit(filePath: string): void {
		const now = Date.now();

		this.heatManager.increaseHeat(
			filePath,
			this.settings.heatIncrements.fileEdit,
			(metrics: HeatMetrics) => {
				metrics.editCount++;
				metrics.lastEdited = now;
				metrics.lastAccessed = now; // Editing implies access
			}
		);
	}

	/**
	 * Handle file close event
	 * Calculates session duration and updates metrics
	 * @param filePath - Path to the closed file
	 */
	onFileClose(filePath: string): void {
		const heatData = this.heatManager.getHeatData(filePath);
		if (!heatData) return;

		const metrics = heatData.metrics;
		if (metrics.sessionStart !== null) {
			const now = Date.now();
			const sessionDuration = now - metrics.sessionStart;

			// Add to total duration
			metrics.totalDuration += sessionDuration;

			// Reset session start
			metrics.sessionStart = null;

			// Calculate duration contribution to heat
			// More time spent = more heat (but with diminishing returns)
			const durationMinutes = sessionDuration / (1000 * 60);
			const durationHeat = Math.min(10, Math.log10(durationMinutes + 1) * 5);

			if (durationHeat > 0) {
				this.heatManager.increaseHeat(filePath, durationHeat);
			}
		}
	}

	/**
	 * Calculate frequency score (0-100)
	 * Based on access count relative to most accessed file
	 * @param metrics - Heat metrics for the file
	 * @param maxAccessCount - Maximum access count across all files
	 * @returns Normalized frequency score
	 */
	calculateFrequencyScore(metrics: HeatMetrics, maxAccessCount: number): number {
		if (maxAccessCount === 0) return 0;
		return (metrics.accessCount / maxAccessCount) * 100;
	}

	/**
	 * Calculate recency score (0-100)
	 * More recent access = higher score, with exponential decay
	 * @param metrics - Heat metrics for the file
	 * @returns Normalized recency score
	 */
	calculateRecencyScore(metrics: HeatMetrics): number {
		const now = Date.now();
		const timeSinceAccess = now - metrics.lastAccessed;

		// Convert to days
		const daysSinceAccess = timeSinceAccess / (1000 * 60 * 60 * 24);

		// Exponential decay: score = 100 * e^(-days/7)
		// This gives ~50% score after 5 days, ~25% after 10 days
		const score = 100 * Math.exp(-daysSinceAccess / 7);

		return Math.max(0, Math.min(100, score));
	}

	/**
	 * Calculate succession score (0-100)
	 * Based on consecutive quick returns
	 * @param metrics - Heat metrics for the file
	 * @returns Normalized succession score
	 */
	calculateSuccessionScore(metrics: HeatMetrics): number {
		// Each succession adds points, with diminishing returns
		// 1 succession = 20, 2 = 35, 3 = 47, 4 = 57, 5 = 65, etc.
		const score = 100 * (1 - Math.exp(-metrics.successionCount / 3));
		return Math.max(0, Math.min(100, score));
	}

	/**
	 * Calculate duration score (0-100)
	 * Based on total time spent in file
	 * @param metrics - Heat metrics for the file
	 * @param maxDuration - Maximum duration across all files
	 * @returns Normalized duration score
	 */
	calculateDurationScore(metrics: HeatMetrics, maxDuration: number): number {
		if (maxDuration === 0) return 0;

		// Logarithmic scaling to handle wide range of durations
		const normalizedDuration = Math.log10(metrics.totalDuration + 1);
		const normalizedMax = Math.log10(maxDuration + 1);

		return (normalizedDuration / normalizedMax) * 100;
	}

	/**
	 * Calculate edit activity score (0-100)
	 * Based on number of edits
	 * @param metrics - Heat metrics for the file
	 * @param maxEditCount - Maximum edit count across all files
	 * @returns Normalized edit score
	 */
	calculateEditScore(metrics: HeatMetrics, maxEditCount: number): number {
		if (maxEditCount === 0) return 0;
		return (metrics.editCount / maxEditCount) * 100;
	}

	/**
	 * Calculate composite heat score from all metrics
	 * Uses configured weights to combine scores
	 * @param filePath - Path to the file
	 * @returns Weighted composite score (0-100)
	 */
	calculateCompositeScore(filePath: string): number {
		const heatData = this.heatManager.getHeatData(filePath);
		if (!heatData) return 0;

		const metrics = heatData.metrics;
		const allData = this.heatManager.getAllHeatData();

		// Calculate maximums for normalization
		let maxAccessCount = 0;
		let maxDuration = 0;
		let maxEditCount = 0;

		for (const data of allData.values()) {
			maxAccessCount = Math.max(maxAccessCount, data.metrics.accessCount);
			maxDuration = Math.max(maxDuration, data.metrics.totalDuration);
			maxEditCount = Math.max(maxEditCount, data.metrics.editCount);
		}

		// Calculate individual scores
		const frequencyScore = this.calculateFrequencyScore(metrics, maxAccessCount);
		const recencyScore = this.calculateRecencyScore(metrics);
		const successionScore = this.calculateSuccessionScore(metrics);
		const durationScore = this.calculateDurationScore(metrics, maxDuration);
		const editScore = this.calculateEditScore(metrics, maxEditCount);

		// Get weights from settings (should sum to 100)
		const weights = this.settings.metricWeights;

		// Calculate weighted composite
		const composite = (
			(frequencyScore * weights.frequency) +
			(recencyScore * weights.recency) +
			(successionScore * weights.succession) +
			(durationScore * weights.duration) +
			(editScore * weights.edits)
		) / 100; // Divide by 100 since weights sum to 100

		return Math.max(0, Math.min(100, composite));
	}

	/**
	 * Recalculate heat scores for all files based on metrics
	 * Useful after settings changes or for periodic recalculation
	 */
	recalculateAllHeat(): void {
		const allData = this.heatManager.getAllHeatData();

		for (const [filePath, heatData] of allData) {
			const compositeScore = this.calculateCompositeScore(filePath);

			// Update heat score directly
			heatData.heatScore = compositeScore;

			// Add favorite boost if applicable
			if (heatData.metrics.isFavorite) {
				heatData.heatScore += heatData.metrics.favoriteBoost;
			}

			// Normalize
			heatData.heatScore = this.heatManager.normalizeHeat(heatData.heatScore);
			heatData.lastUpdated = Date.now();
		}
	}

	/**
	 * Get detailed metric breakdown for a file
	 * Useful for debugging and analytics
	 * @param filePath - Path to the file
	 * @returns Object with individual and composite scores
	 */
	getMetricBreakdown(filePath: string): {
		frequency: number;
		recency: number;
		succession: number;
		duration: number;
		edits: number;
		composite: number;
		weights: typeof this.settings.metricWeights;
	} | null {
		const heatData = this.heatManager.getHeatData(filePath);
		if (!heatData) return null;

		const allData = this.heatManager.getAllHeatData();
		let maxAccessCount = 0;
		let maxDuration = 0;
		let maxEditCount = 0;

		for (const data of allData.values()) {
			maxAccessCount = Math.max(maxAccessCount, data.metrics.accessCount);
			maxDuration = Math.max(maxDuration, data.metrics.totalDuration);
			maxEditCount = Math.max(maxEditCount, data.metrics.editCount);
		}

		return {
			frequency: this.calculateFrequencyScore(heatData.metrics, maxAccessCount),
			recency: this.calculateRecencyScore(heatData.metrics),
			succession: this.calculateSuccessionScore(heatData.metrics),
			duration: this.calculateDurationScore(heatData.metrics, maxDuration),
			edits: this.calculateEditScore(heatData.metrics, maxEditCount),
			composite: this.calculateCompositeScore(filePath),
			weights: this.settings.metricWeights
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
