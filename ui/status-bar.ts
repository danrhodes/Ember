import { Plugin, TFile } from 'obsidian';
import { EmberSettings } from '../types';
import { HeatManager } from '../managers/heat-manager';

/**
 * StatusBarWidget
 *
 * Displays current file's heat information in the status bar:
 * - Heat level icon (🔥 for hot, ❄️ for cold)
 * - Heat score
 * - Trend indicator (↑ heating, ↓ cooling, → stable)
 * - Clickable for quick info
 */
export class StatusBarWidget {
	private plugin: Plugin;
	private settings: EmberSettings;
	private heatManager: HeatManager;
	private statusBarItem: HTMLElement;
	private currentFile: string | null = null;
	private previousHeat: number = 0;
	private updateInterval: number | null = null;
	private readonly UPDATE_INTERVAL_MS = 2000; // Update every 2 seconds

	constructor(plugin: Plugin, settings: EmberSettings, heatManager: HeatManager) {
		this.plugin = plugin;
		this.settings = settings;
		this.heatManager = heatManager;

		// Create status bar item
		this.statusBarItem = plugin.addStatusBarItem();
		this.statusBarItem.addClass('ember-status-bar');
		this.statusBarItem.style.cursor = 'pointer';

		// Add click handler
		this.statusBarItem.addEventListener('click', () => this.onStatusBarClick());

		// Set initial text
		this.statusBarItem.setText('Ember: No file');
	}

	/**
	 * Start the status bar updates
	 */
	start(): void {
		// Initial update
		this.update();

		// Set up periodic updates
		this.updateInterval = window.setInterval(() => {
			this.update();
		}, this.UPDATE_INTERVAL_MS);

		console.log('Ember: Status bar widget started');
	}

	/**
	 * Stop the status bar updates
	 */
	stop(): void {
		if (this.updateInterval !== null) {
			window.clearInterval(this.updateInterval);
			this.updateInterval = null;
		}

		// Clear status bar
		this.statusBarItem.setText('');

		console.log('Ember: Status bar widget stopped');
	}

	/**
	 * Update the status bar with current file's heat info
	 */
	update(): void {
		if (!this.settings.showStatusBar) {
			this.statusBarItem.style.display = 'none';
			return;
		}

		this.statusBarItem.style.display = '';

		// Get current file
		const activeFile = this.plugin.app.workspace.getActiveFile();

		if (!activeFile) {
			this.statusBarItem.setText('Ember: No file');
			this.currentFile = null;
			return;
		}

		// Check if file changed
		if (this.currentFile !== activeFile.path) {
			this.currentFile = activeFile.path;
			this.previousHeat = 0; // Reset previous heat when switching files
		}

		// Get heat data
		const heatData = this.heatManager.getHeatData(activeFile.path);

		if (!heatData) {
			this.statusBarItem.setText('Ember: Not tracked');
			return;
		}

		// Get heat level
		const heatLevel = this.heatManager.getHeatLevel(heatData.heatScore);
		const heatScore = Math.round(heatData.heatScore);

		// Calculate trend
		const trend = this.getTrend(heatData.heatScore);

		// Get icon
		const icon = this.getHeatIcon(heatLevel);

		// Build status text
		const statusText = `${icon} ${heatScore} ${trend}`;

		// Update status bar
		this.statusBarItem.setText(statusText);

		// Update previous heat for next trend calculation
		this.previousHeat = heatData.heatScore;

		// Add tooltip
		this.statusBarItem.setAttribute('aria-label',
			`Heat: ${heatScore} (${heatLevel})\n` +
			`Access count: ${heatData.metrics.accessCount}\n` +
			`Last accessed: ${this.formatTime(heatData.metrics.lastAccessed)}\n` +
			`Click for more info`
		);

		// Apply color based on heat level
		this.applyColor(heatLevel);
	}

	/**
	 * Get heat icon based on level
	 */
	private getHeatIcon(heatLevel: string): string {
		switch (heatLevel) {
			case 'blazing':
				return '🔥🔥';
			case 'critical':
			case 'hot':
				return '🔥';
			case 'warm':
				return '🌡️';
			case 'cool':
				return '❄️';
			case 'cold':
				return '❄️❄️';
			default:
				return '○';
		}
	}

	/**
	 * Get trend indicator
	 */
	private getTrend(currentHeat: number): string {
		if (this.previousHeat === 0) {
			return '→'; // No previous data
		}

		const diff = currentHeat - this.previousHeat;

		if (diff > 1) {
			return '↑'; // Heating up
		} else if (diff < -1) {
			return '↓'; // Cooling down
		} else {
			return '→'; // Stable
		}
	}

	/**
	 * Apply color to status bar based on heat level
	 */
	private applyColor(heatLevel: string): void {
		// Remove existing color classes
		this.statusBarItem.removeClass('ember-status-hot');
		this.statusBarItem.removeClass('ember-status-warm');
		this.statusBarItem.removeClass('ember-status-cool');
		this.statusBarItem.removeClass('ember-status-cold');

		// Add appropriate color class
		if (heatLevel === 'blazing' || heatLevel === 'critical' || heatLevel === 'hot') {
			this.statusBarItem.addClass('ember-status-hot');
		} else if (heatLevel === 'warm') {
			this.statusBarItem.addClass('ember-status-warm');
		} else if (heatLevel === 'cool') {
			this.statusBarItem.addClass('ember-status-cool');
		} else if (heatLevel === 'cold') {
			this.statusBarItem.addClass('ember-status-cold');
		}
	}

	/**
	 * Format timestamp for tooltip
	 */
	private formatTime(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;

		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) {
			return `${days} day${days > 1 ? 's' : ''} ago`;
		} else if (hours > 0) {
			return `${hours} hour${hours > 1 ? 's' : ''} ago`;
		} else if (minutes > 0) {
			return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
		} else {
			return 'Just now';
		}
	}

	/**
	 * Handle status bar click
	 */
	private onStatusBarClick(): void {
		const activeFile = this.plugin.app.workspace.getActiveFile();

		if (!activeFile) return;

		const heatData = this.heatManager.getHeatData(activeFile.path);

		if (!heatData) return;

		// Show detailed info in a notice
		const heatLevel = this.heatManager.getHeatLevel(heatData.heatScore);

		const info = [
			`Heat Score: ${Math.round(heatData.heatScore)} (${heatLevel})`,
			`Access Count: ${heatData.metrics.accessCount}`,
			`Last Accessed: ${this.formatTime(heatData.metrics.lastAccessed)}`,
			`Last Edited: ${heatData.metrics.lastEdited ? this.formatTime(heatData.metrics.lastEdited) : 'Never'}`,
			`Succession: ${heatData.metrics.successionCount}`,
			`Favorite: ${heatData.metrics.isFavorite ? 'Yes ★' : 'No'}`
		].join('\n');

		// Create a modal-like notice (Phase 3 will add proper modal)
		const notice = document.createElement('div');
		notice.className = 'notice ember-heat-notice';
		notice.style.whiteSpace = 'pre-line';
		notice.style.fontFamily = 'monospace';
		notice.textContent = info;

		document.body.appendChild(notice);

		setTimeout(() => {
			notice.remove();
		}, 5000);
	}

	/**
	 * Force update
	 */
	forceUpdate(): void {
		this.update();
	}

	/**
	 * Update settings
	 */
	updateSettings(settings: EmberSettings): void {
		this.settings = settings;
		this.update();
	}
}
