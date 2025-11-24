import { App, TFile } from 'obsidian';
import { EmberSettings, HeatLevel, VisualizationMode } from '../types';
import { HeatManager } from '../managers/heat-manager';

/**
 * VisualRenderer
 *
 * Responsible for:
 * - Applying visual effects based on heat levels
 * - CSS class injection to file elements
 * - Managing color schemes
 * - Handling visualization mode (Standard, Emergence, Analytical)
 * - Smooth transitions between heat states
 */
export class VisualRenderer {
	private app: App;
	private settings: EmberSettings;
	private heatManager: HeatManager;
	private updateInterval: number | null = null;
	private readonly UPDATE_INTERVAL_MS = 1000; // Update visuals every second

	constructor(app: App, settings: EmberSettings, heatManager: HeatManager) {
		this.app = app;
		this.settings = settings;
		this.heatManager = heatManager;
	}

	/**
	 * Start rendering visual effects
	 */
	start(): void {
		// Initial render
		this.renderAll();

		// Set up periodic updates
		this.updateInterval = window.setInterval(() => {
			this.renderAll();
		}, this.UPDATE_INTERVAL_MS);
	}

	/**
	 * Stop rendering visual effects
	 */
	stop(): void {
		if (this.updateInterval !== null) {
			window.clearInterval(this.updateInterval);
			this.updateInterval = null;
		}

		// Remove all visual effects
		this.clearAll();
	}

	/**
	 * Render all visual effects
	 */
	renderAll(): void {
		if (this.settings.applyToFileExplorer) {
			this.renderFileExplorer();
		}

		if (this.settings.applyToTabs) {
			this.renderTabs();
		}
	}

	/**
	 * Render file explorer with heat-based colors
	 */
	private renderFileExplorer(): void {
		const fileExplorers = this.app.workspace.getLeavesOfType('file-explorer');

		if (fileExplorers.length === 0) {
			return;
		}

		// Get all heat data
		const allHeatData = Array.from(this.heatManager.getAllHeatData().values());

		if (allHeatData.length === 0) {
			return;
		}

		// Calculate thresholds for Standard mode
		const hotThreshold = this.calculateThreshold(
			allHeatData.map(d => d.heatScore),
			this.settings.standardMode.hotThreshold
		);
		const coldThreshold = this.calculateThreshold(
			allHeatData.map(d => d.heatScore),
			100 - this.settings.standardMode.coldThreshold
		);

		// Apply styling using DOM queries (more reliable than internal API)
		for (const leaf of fileExplorers) {
			const containerEl = leaf.view.containerEl;

			// Find all file/folder tree items
			const fileTreeItems = containerEl.querySelectorAll('.tree-item-self');

			for (const treeItem of Array.from(fileTreeItems)) {
				const element = treeItem as HTMLElement;

				// Get file path from data attribute or title
				const filePath = element.getAttribute('data-path') ||
								this.getFilePathFromElement(element);

				if (!filePath) continue;

				const heatData = this.heatManager.getHeatData(filePath);

				if (!heatData) {
					this.removeHeatClasses(element);
					continue;
				}

				// Apply heat-based styling
				this.applyHeatStyling(
					element,
					heatData.heatScore,
					hotThreshold,
					coldThreshold
				);

				// Apply favorite indicator
				if (heatData.metrics.isFavorite) {
					element.setAttribute('data-favorite', 'true');
				} else {
					element.removeAttribute('data-favorite');
				}
			}
		}
	}

	/**
	 * Render tabs with heat-based colors
	 */
	private renderTabs(): void {
		const leaves = this.app.workspace.getLeavesOfType('markdown');

		for (const leaf of leaves) {
			const view = leaf.view as unknown as Record<string, unknown>;
			const file = view.file;

			if (!file || !(file instanceof TFile)) continue;

			const heatData = this.heatManager.getHeatData(file.path);
			const tabEl = (leaf as unknown as Record<string, unknown>).tabHeaderEl as HTMLElement;

			if (!tabEl) continue;

			if (!heatData) {
				this.removeHeatClasses(tabEl);
				continue;
			}

			// Calculate thresholds (same as file explorer)
			const allHeatData = Array.from(this.heatManager.getAllHeatData().values());
			const hotThreshold = this.calculateThreshold(
				allHeatData.map(d => d.heatScore),
				this.settings.standardMode.hotThreshold
			);
			const coldThreshold = this.calculateThreshold(
				allHeatData.map(d => d.heatScore),
				100 - this.settings.standardMode.coldThreshold
			);

			this.applyHeatStyling(tabEl, heatData.heatScore, hotThreshold, coldThreshold);
		}
	}

	/**
	 * Apply heat-based styling to an element
	 */
	private applyHeatStyling(
		element: HTMLElement,
		heatScore: number,
		hotThreshold: number,
		coldThreshold: number
	): void {
		// Remove existing heat classes
		this.removeHeatClasses(element);

		// Add base ember class
		element.addClass('ember-file');

		// Apply styling based on visualization mode
		if (this.settings.visualizationMode === VisualizationMode.STANDARD) {
			this.applyStandardMode(element, heatScore, hotThreshold, coldThreshold);
		} else if (this.settings.visualizationMode === VisualizationMode.EMERGENCE) {
			this.applyEmergenceMode(element, heatScore);
		} else if (this.settings.visualizationMode === VisualizationMode.ANALYTICAL) {
			this.applyAnalyticalMode(element, heatScore);
		}
	}

	/**
	 * Apply Standard mode visualization (hot/cold endpoints)
	 */
	private applyStandardMode(
		element: HTMLElement,
		heatScore: number,
		hotThreshold: number,
		coldThreshold: number
	): void {
		if (heatScore >= hotThreshold) {
			// Hot files
			element.addClass('ember-hot');
			const intensity = Math.min(100, ((heatScore - hotThreshold) / (100 - hotThreshold)) * 100);
			element.setCssProps({ '--ember-heat-intensity': `${intensity}` });
		} else if (heatScore <= coldThreshold) {
			// Cold files
			element.addClass('ember-cold');
			const intensity = Math.min(100, ((coldThreshold - heatScore) / coldThreshold) * 100);
			element.setCssProps({ '--ember-heat-intensity': `${intensity}` });
		} else {
			// Neutral (middle range) - no coloring if setting enabled
			if (this.settings.standardMode.neutralUncolored) {
				element.addClass('ember-neutral');
			}
		}
	}

	/**
	 * Apply Emergence mode visualization (full gradient)
	 * Shows smooth color gradient across all files based on heat
	 */
	private applyEmergenceMode(element: HTMLElement, heatScore: number): void {
		element.addClass('ember-emergence');

		// Calculate gradient color for text
		const color = this.getGradientColor(heatScore);

		// Set CSS properties
		element.setCssProps({
			'--ember-heat-score': `${heatScore}`,
			'--ember-gradient-color': color
		});

		element.setCssStyles({
			color: color,
			fontWeight: heatScore >= 60 ? '500' : ''
		});
	}

	/**
	 * Calculate color along gradient based on heat score
	 * Gradient: Blue (0) → Green (25) → Yellow (50) → Orange (75) → Red (100)
	 */
	private getGradientColor(heatScore: number): string {
		// Clamp heat score to 0-100
		const heat = Math.max(0, Math.min(100, heatScore));

		// Define gradient stops
		const stops = [
			{ position: 0, color: { r: 59, g: 130, b: 246 } },   // Blue #3b82f6
			{ position: 25, color: { r: 16, g: 185, b: 129 } },  // Green #10b981
			{ position: 50, color: { r: 251, g: 191, b: 36 } },  // Yellow #fbbf24
			{ position: 75, color: { r: 245, g: 158, b: 11 } },  // Orange #f59e0b
			{ position: 100, color: { r: 220, g: 38, b: 38 } }   // Red #dc2626
		];

		// Find the two stops to interpolate between
		let lowerStop = stops[0];
		let upperStop = stops[stops.length - 1];

		for (let i = 0; i < stops.length - 1; i++) {
			if (heat >= stops[i].position && heat <= stops[i + 1].position) {
				lowerStop = stops[i];
				upperStop = stops[i + 1];
				break;
			}
		}

		// Calculate interpolation factor (0 to 1)
		const range = upperStop.position - lowerStop.position;
		const factor = range === 0 ? 0 : (heat - lowerStop.position) / range;

		// Interpolate RGB values
		const r = Math.round(lowerStop.color.r + (upperStop.color.r - lowerStop.color.r) * factor);
		const g = Math.round(lowerStop.color.g + (upperStop.color.g - lowerStop.color.g) * factor);
		const b = Math.round(lowerStop.color.b + (upperStop.color.b - lowerStop.color.b) * factor);

		return `rgb(${r}, ${g}, ${b})`;
	}

	/**
	 * Apply Analytical mode visualization
	 * Multi-dimensional heat visualization showing access patterns
	 */
	private applyAnalyticalMode(element: HTMLElement, heatScore: number): void {
		element.addClass('ember-analytical');

		// Get file path from element
		const filePath = this.getFilePathFromElement(element);
		if (!filePath) return;

		const heatData = this.heatManager.getHeatData(filePath);
		if (!heatData) return;

		// Multi-dimensional analysis based on different metrics
		const metrics = heatData.metrics;

		// Calculate metric-specific scores (0-100 normalized)
		const allHeatData = Array.from(this.heatManager.getAllHeatData().values());

		// Frequency intensity (access count)
		const maxAccess = Math.max(...allHeatData.map(d => d.metrics.accessCount));
		const frequencyIntensity = maxAccess > 0 ? (metrics.accessCount / maxAccess) * 100 : 0;

		// Recency intensity (how recently accessed)
		const now = Date.now();
		const daysSinceAccess = (now - metrics.lastAccessed) / (1000 * 60 * 60 * 24);
		const recencyIntensity = Math.max(0, 100 - (daysSinceAccess * 10)); // Decay over 10 days

		// Duration intensity (time spent)
		const maxDuration = Math.max(...allHeatData.map(d => d.metrics.totalDuration));
		const durationIntensity = maxDuration > 0 ? (metrics.totalDuration / maxDuration) * 100 : 0;

		// Edit intensity (edit count)
		const maxEdits = Math.max(...allHeatData.map(d => d.metrics.editCount));
		const editIntensity = maxEdits > 0 ? (metrics.editCount / maxEdits) * 100 : 0;

		// Determine dominant pattern
		const pattern = this.determineAccessPattern(
			frequencyIntensity,
			recencyIntensity,
			durationIntensity,
			editIntensity
		);

		element.setAttribute('data-access-pattern', pattern);

		// Apply color based on dominant metric
		const color = this.getAnalyticalColor(pattern, heatScore);

		// Set CSS custom properties for multi-dimensional styling
		element.setCssProps({
			'--ember-heat-score': `${heatScore}`,
			'--ember-frequency': `${frequencyIntensity}`,
			'--ember-recency': `${recencyIntensity}`,
			'--ember-duration': `${durationIntensity}`,
			'--ember-edits': `${editIntensity}`,
			'--ember-analytical-color': color,
			'--ember-pattern-indicator': this.getPatternIndicator(pattern)
		});

		// Font weight based on overall heat
		let fontWeight = '';
		if (heatScore >= 70) {
			fontWeight = '600';
		} else if (heatScore >= 40) {
			fontWeight = '500';
		}

		element.setCssStyles({
			color: color,
			fontWeight: fontWeight
		});
	}

	/**
	 * Determine the dominant access pattern based on metrics
	 */
	private determineAccessPattern(
		frequency: number,
		recency: number,
		duration: number,
		edits: number
	): string {
		// Find dominant metric
		const max = Math.max(frequency, recency, duration, edits);

		// Classify based on dominant metric and combinations
		if (edits > 50 && frequency > 50) {
			return 'active-editor'; // Frequently edited
		} else if (duration > 50 && frequency > 50) {
			return 'deep-work'; // Long sessions, frequent access
		} else if (frequency > 50 && recency < 30) {
			return 'abandoned'; // Was frequent, now cold
		} else if (recency > 70 && frequency < 30) {
			return 'new-interest'; // Recently discovered
		} else if (frequency > 70) {
			return 'reference'; // High frequency, moderate other metrics
		} else if (duration > 70) {
			return 'deep-dive'; // Long reading sessions
		} else if (recency > 70) {
			return 'recent'; // Recently active
		} else if (max < 30) {
			return 'dormant'; // Low activity across all metrics
		} else {
			return 'balanced'; // Moderate activity
		}
	}

	/**
	 * Get color for analytical mode based on access pattern
	 */
	private getAnalyticalColor(pattern: string, heatScore: number): string {
		// Color scheme based on pattern type
		const colors: Record<string, string> = {
			'active-editor': '#8b5cf6',   // Purple - active editing
			'deep-work': '#ec4899',       // Pink - deep focus
			'abandoned': '#6b7280',       // Gray - old activity
			'new-interest': '#10b981',    // Green - newly discovered
			'reference': '#3b82f6',       // Blue - frequent reference
			'deep-dive': '#f59e0b',       // Orange - long reading
			'recent': '#14b8a6',          // Teal - recent activity
			'dormant': '#9ca3af',         // Light gray - inactive
			'balanced': '#a855f7'         // Light purple - balanced
		};

		const baseColor = colors[pattern] || colors['balanced'];

		// Adjust opacity based on heat score
		const opacity = Math.max(0.5, Math.min(1, heatScore / 100));

		// Convert hex to rgb with opacity
		const hex = baseColor.replace('#', '');
		const r = parseInt(hex.substring(0, 2), 16);
		const g = parseInt(hex.substring(2, 4), 16);
		const b = parseInt(hex.substring(4, 6), 16);

		return `rgba(${r}, ${g}, ${b}, ${opacity})`;
	}

	/**
	 * Get visual pattern indicator (for CSS)
	 */
	private getPatternIndicator(pattern: string): string {
		// Map patterns to visual indicators (using CSS gradients or borders)
		const indicators: Record<string, string> = {
			'active-editor': '✎',
			'deep-work': '◆',
			'abandoned': '○',
			'new-interest': '★',
			'reference': '▣',
			'deep-dive': '◉',
			'recent': '●',
			'dormant': '·',
			'balanced': '◎'
		};

		return indicators[pattern] || '○';
	}

	/**
	 * Extract file path from DOM element
	 */
	private getFilePathFromElement(element: HTMLElement): string | null {
		// Try to get path from data attribute
		if (element.dataset.path) {
			return element.dataset.path;
		}

		// Try to get from title or other attributes
		const titleEl = element.querySelector('.nav-file-title-content, .workspace-tab-header-inner-title');
		if (titleEl) {
			const text = titleEl.textContent;
			// Try to find matching file in vault
			const files = this.app.vault.getMarkdownFiles();
			const match = files.find(f => f.basename === text);
			if (match) return match.path;
		}

		// Fallback: traverse to find file item with path
		let current: HTMLElement | null = element;
		while (current) {
			if (current.dataset && current.dataset.path) {
				return current.dataset.path;
			}
			current = current.parentElement;
		}

		return null;
	}

	/**
	 * Remove all ember classes from an element
	 */
	private removeHeatClasses(element: HTMLElement): void {
		element.removeClass('ember-file');
		element.removeClass('ember-hot');
		element.removeClass('ember-cold');
		element.removeClass('ember-neutral');
		element.removeClass('ember-emergence');
		element.removeClass('ember-analytical');
		element.removeClass('ember-editor');
		element.removeAttribute('data-favorite');

		// Remove heat level classes
		for (const level of Object.values(HeatLevel)) {
			element.removeClass(`ember-heat-${level}`);
		}

		// Remove custom properties
		element.setCssProps({
			'--ember-heat-intensity': '',
			'--ember-heat-score': ''
		});
	}

	/**
	 * Calculate threshold value from scores
	 * @param scores - Array of heat scores
	 * @param percentile - Percentile to calculate (0-100)
	 * @returns Threshold value
	 */
	private calculateThreshold(scores: number[], percentile: number): number {
		if (scores.length === 0) return 0;

		const sorted = [...scores].sort((a, b) => a - b);
		const index = Math.floor((percentile / 100) * sorted.length);

		return sorted[Math.min(index, sorted.length - 1)] || 0;
	}

	/**
	 * Clear all visual effects
	 */
	clearAll(): void {
		// Clear file explorer
		const fileExplorers = this.app.workspace.getLeavesOfType('file-explorer');
		for (const leaf of fileExplorers) {
			const view = leaf.view as unknown as Record<string, unknown>;
			if (!view.fileItems) continue;

			const fileItems = view.fileItems as Record<string, HTMLElement>;
			for (const fileItem of Object.values(fileItems)) {
				this.removeHeatClasses(fileItem);
			}
		}

		// Clear tabs
		const leaves = this.app.workspace.getLeavesOfType('markdown');
		for (const leaf of leaves) {
			const tabEl = (leaf as unknown as Record<string, unknown>).tabHeaderEl as HTMLElement;
			if (tabEl) {
				this.removeHeatClasses(tabEl);
			}
		}

		// Clear editor
		const activeLeaf = this.app.workspace.getLeaf(false);
		if (activeLeaf && activeLeaf.view.getViewType() === 'markdown') {
			const view = activeLeaf.view;
			const editorEl = (view as unknown as Record<string, unknown>).containerEl as HTMLElement;
			if (editorEl) {
				this.removeHeatClasses(editorEl);
			}
		}
	}

	/**
	 * Force immediate update of visuals
	 */
	forceUpdate(): void {
		this.renderAll();
	}

	/**
	 * Update settings and re-render
	 */
	updateSettings(settings: EmberSettings): void {
		this.settings = settings;
		this.renderAll();
	}
}
