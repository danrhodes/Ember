import { Plugin } from 'obsidian';
import { EmberSettings } from '../types';
import { HeatManager } from './heat-manager';
import { DataStore } from '../storage/data-store';

/**
 * DecayManager
 *
 * Responsible for:
 * - Scheduled heat decay at regular intervals
 * - Configurable decay rates
 * - Differential decay (high heat decays faster)
 * - Pausing decay for favorited files
 * - Calculating decay for time elapsed while Obsidian was closed
 */
export class DecayManager {
	private plugin: Plugin;
	private settings: EmberSettings;
	private heatManager: HeatManager;
	private dataStore: DataStore;
	private decayIntervalId: number | null = null;
	private lastDecayTime: number;

	constructor(
		plugin: Plugin,
		settings: EmberSettings,
		heatManager: HeatManager,
		dataStore: DataStore
	) {
		this.plugin = plugin;
		this.settings = settings;
		this.heatManager = heatManager;
		this.dataStore = dataStore;
		this.lastDecayTime = Date.now();
	}

	/**
	 * Start the decay scheduler
	 */
	start(): void {
		// Calculate decay for time that passed while plugin was inactive
		if (this.settings.calculateDecayWhileClosed) {
			this.calculateMissedDecay();
		}

		// Set up interval for regular decay
		const intervalMs = this.settings.decayInterval * 60 * 1000; // Convert minutes to milliseconds

		this.decayIntervalId = window.setInterval(() => {
			this.performDecay();
		}, intervalMs);

		// Register with Obsidian to ensure cleanup
		this.plugin.registerInterval(this.decayIntervalId);
	}

	/**
	 * Stop the decay scheduler
	 */
	stop(): void {
		if (this.decayIntervalId !== null) {
			window.clearInterval(this.decayIntervalId);
			this.decayIntervalId = null;
		}

		// Save last decay time for next session
		this.lastDecayTime = Date.now();
	}

	/**
	 * Calculate and apply decay that should have occurred while plugin was inactive
	 */
	private calculateMissedDecay(): void {
		const now = Date.now();
		const timeSinceLastDecay = now - this.lastDecayTime;

		// Calculate how many decay cycles were missed
		const intervalMs = this.settings.decayInterval * 60 * 1000;
		const missedCycles = Math.floor(timeSinceLastDecay / intervalMs);

		if (missedCycles > 0) {
			if (this.settings.debugLogging) {
				console.debug(`Ember: Applying ${missedCycles} missed decay cycles`);
			}

			// Apply decay for each missed cycle
			for (let i = 0; i < missedCycles; i++) {
				this.performDecay(true); // Silent decay (no save)
			}

			// Save after all missed cycles
			void this.dataStore.save(true);
		}

		// Update last decay time
		this.lastDecayTime = now;
	}

	/**
	 * Perform decay on all tracked files
	 * @param silent - If true, don't trigger a save (used for batch decay)
	 */
	performDecay(silent = false): void {
		const allData = this.heatManager.getAllHeatData();
		let filesDecayed = 0;

		for (const [filePath, heatData] of allData) {
			// Skip if heat is already at 0
			if (heatData.heatScore <= 0) continue;

			// Skip favorites if setting enabled
			if (
				heatData.metrics.isFavorite &&
				this.settings.pauseDecayForFavorites
			) {
				continue;
			}

			// Calculate decay amount
			let decayPercentage = this.settings.decayRate;

			// Apply differential decay for high heat
			if (this.settings.differentialDecay && heatData.heatScore > 70) {
				decayPercentage *= this.settings.differentialMultiplier;
			}

			// Apply decay using HeatManager
			this.heatManager.decreaseHeat(filePath, decayPercentage);
			filesDecayed++;
		}

		// Update last decay time
		this.lastDecayTime = Date.now();

		if (this.settings.debugLogging) {
			console.debug(`Ember: Decay applied to ${filesDecayed} files`);
		}

		// Trigger save unless silent
		if (!silent) {
			void this.dataStore.save();
		}
	}

	/**
	 * Manually trigger decay (useful for testing)
	 */
	manualDecay(): void {
		this.performDecay();
		if (this.settings.debugLogging) {
			console.debug('Ember: Manual decay triggered');
		}
	}

	/**
	 * Get time until next decay cycle
	 * @returns Milliseconds until next decay
	 */
	getTimeUntilNextDecay(): number {
		if (this.decayIntervalId === null) return 0;

		const intervalMs = this.settings.decayInterval * 60 * 1000;
		const timeSinceLastDecay = Date.now() - this.lastDecayTime;
		const timeUntilNext = intervalMs - timeSinceLastDecay;

		return Math.max(0, timeUntilNext);
	}

	/**
	 * Get decay statistics
	 * @returns Object with decay stats
	 */
	getStatistics(): {
		lastDecayTime: number;
		nextDecayTime: number;
		decayInterval: number;
		decayRate: number;
		isRunning: boolean;
	} {
		const intervalMs = this.settings.decayInterval * 60 * 1000;

		return {
			lastDecayTime: this.lastDecayTime,
			nextDecayTime: this.lastDecayTime + intervalMs,
			decayInterval: this.settings.decayInterval,
			decayRate: this.settings.decayRate,
			isRunning: this.decayIntervalId !== null
		};
	}

	/**
	 * Update settings and restart scheduler if needed
	 * @param settings - New settings object
	 */
	updateSettings(settings: EmberSettings): void {
		const intervalChanged = settings.decayInterval !== this.settings.decayInterval;

		this.settings = settings;

		// Restart scheduler if interval changed
		if (intervalChanged && this.decayIntervalId !== null) {
			this.stop();
			this.start();
			if (this.settings.debugLogging) {
				console.debug('Ember: Decay scheduler restarted with new interval');
			}
		}
	}

	/**
	 * Reset decay timer (useful after settings change)
	 */
	resetTimer(): void {
		this.lastDecayTime = Date.now();
	}
}
