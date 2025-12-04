import { MarkdownView, Notice } from 'obsidian';
import { EmberSettings } from '../types';
import { HeatManager } from '../managers/heat-manager';

/**
 * EditorHeatBanner
 *
 * Displays a heat level banner under the file title in the editor
 * Shows: heat level, heat score, and quick access to heat info
 */
export class EditorHeatBanner {
	private settings: EmberSettings;
	private heatManager: HeatManager;
	private activeBanners: Map<string, HTMLElement> = new Map();

	constructor(settings: EmberSettings, heatManager: HeatManager) {
		this.settings = settings;
		this.heatManager = heatManager;
	}

	/**
	 * Update settings and refresh all banners
	 */
	updateSettings(settings: EmberSettings): void {
		this.settings = settings;
		this.refreshAllBanners();
	}

	/**
	 * Add or update banner for a specific view
	 */
	addBanner(view: MarkdownView): void {
		console.debug('[EditorHeatBanner] addBanner called for view');

		if (!this.settings.showHeatInEditor) {
			console.debug('[EditorHeatBanner] Setting disabled, removing banner');
			this.removeBanner(view);
			return;
		}

		const file = view.file;
		if (!file) {
			console.debug('[EditorHeatBanner] No file in view');
			this.removeBanner(view);
			return;
		}

		console.debug('[EditorHeatBanner] File path:', file.path);

		const heatData = this.heatManager.getHeatData(file.path);
		if (!heatData) {
			console.debug('[EditorHeatBanner] No heat data for file');
			this.removeBanner(view);
			return;
		}

		console.debug('[EditorHeatBanner] Heat data found:', heatData);

		// Check if banner already exists and is still in the DOM
		const existingBanner = this.activeBanners.get(file.path);
		if (existingBanner && existingBanner.isConnected) {
			console.debug('[EditorHeatBanner] Banner already exists and is connected, skipping');
			return;
		}

		// Remove existing banner if present but not connected
		if (existingBanner) {
			console.debug('[EditorHeatBanner] Removing disconnected banner');
			existingBanner.remove();
			this.activeBanners.delete(file.path);
		}

		// Find the content container - use a small delay to ensure DOM is ready
		setTimeout(() => {
			// Double-check banner doesn't exist after timeout
			const stillExistingBanner = this.activeBanners.get(file.path);
			if (stillExistingBanner && stillExistingBanner.isConnected) {
				console.debug('[EditorHeatBanner] Banner created by another call, skipping');
				return;
			}

			console.debug('[EditorHeatBanner] Timeout fired, looking for container');
			const contentEl = view.contentEl;
			console.debug('[EditorHeatBanner] contentEl:', contentEl);

			// Try different selectors for different view modes
			let targetContainer: Element | null = null;
			let selectorUsed = '';

			// For reading mode: look for markdown-preview-sizer inside markdown-preview-view
			const previewView = contentEl.querySelector('.markdown-preview-view');
			if (previewView) {
				const previewSizer = previewView.querySelector('.markdown-preview-sizer');
				if (previewSizer) {
					targetContainer = previewSizer;
					selectorUsed = '.markdown-preview-view > .markdown-preview-sizer';
				} else {
					targetContainer = previewView;
					selectorUsed = '.markdown-preview-view';
				}
			}

			// For edit mode: look for markdown source view or cm-editor
			if (!targetContainer) {
				targetContainer = contentEl.querySelector('.markdown-source-view');
				if (targetContainer) {
					selectorUsed = '.markdown-source-view';
				}
			}

			// Fallback to view-content
			if (!targetContainer) {
				targetContainer = contentEl.querySelector('.view-content');
				if (targetContainer) {
					selectorUsed = '.view-content';
				}
			}

			// Last resort: use contentEl directly
			if (!targetContainer) {
				targetContainer = contentEl;
				selectorUsed = 'contentEl (fallback)';
			}

			console.debug('[EditorHeatBanner] Using selector:', selectorUsed);
			console.debug('[EditorHeatBanner] Target container:', targetContainer);

			// Create banner
			const banner = this.createBanner(file.path, heatData.heatScore);
			console.debug('[EditorHeatBanner] Banner created:', banner);

			// Insert banner at the top
			if (targetContainer.firstChild) {
				console.debug('[EditorHeatBanner] Inserting before first child');
				targetContainer.insertBefore(banner, targetContainer.firstChild);
			} else {
				console.debug('[EditorHeatBanner] Appending to container');
				targetContainer.appendChild(banner);
			}

			// Store reference
			this.activeBanners.set(file.path, banner);
			console.debug('[EditorHeatBanner] Banner stored in activeBanners, total banners:', this.activeBanners.size);
		}, 100);
	}

	/**
	 * Remove banner for a specific view
	 */
	removeBanner(view: MarkdownView): void {
		const file = view.file;
		if (!file) return;

		const banner = this.activeBanners.get(file.path);
		if (banner) {
			banner.remove();
			this.activeBanners.delete(file.path);
		}
	}

	/**
	 * Create the banner element
	 */
	private createBanner(filePath: string, heatScore: number): HTMLElement {
		const banner = document.createElement('div');
		banner.addClass('ember-editor-heat-banner');

		const heatLevel = this.heatManager.getHeatLevel(heatScore);
		const heatClass = this.getHeatClass(heatLevel);

		banner.addClass(`ember-heat-${heatClass}`);

		// Add flame effect for max heat files
		if (this.settings.useFlameEffect && heatScore >= 100) {
			banner.addClass('ember-on-fire');
		}

		// Heat indicator
		const indicator = banner.createEl('div', { cls: 'ember-heat-indicator' });
		indicator.createEl('span', {
			cls: 'ember-heat-icon',
			text: this.getHeatIcon(heatLevel)
		});

		// Heat info
		const info = banner.createEl('div', { cls: 'ember-heat-info' });
		info.createEl('span', {
			cls: 'ember-heat-label',
			text: `${heatLevel.toUpperCase()} `
		});
		info.createEl('span', {
			cls: 'ember-heat-score',
			text: `${Math.round(heatScore)}`
		});

		// Quick stats
		const heatData = this.heatManager.getHeatData(filePath);
		if (heatData) {
			const stats = banner.createEl('div', { cls: 'ember-heat-stats' });

			stats.createEl('span', {
				cls: 'ember-heat-stat',
				text: `${heatData.metrics.accessCount} views`
			});

			stats.createEl('span', {
				cls: 'ember-heat-stat',
				text: `${heatData.metrics.editCount} edits`
			});

			if (heatData.metrics.isFavorite) {
				stats.createEl('span', {
					cls: 'ember-heat-stat ember-favorite',
					text: '★ favorite'
				});
			}
		}

		// Click to show detailed info
		banner.addEventListener('click', () => {
			this.showDetailedInfo(filePath);
		});

		banner.setAttribute('title', 'Click for detailed heat information');

		return banner;
	}

	/**
	 * Get CSS class for heat level
	 */
	private getHeatClass(heatLevel: string): string {
		switch (heatLevel) {
			case 'blazing':
			case 'critical':
			case 'hot':
				return 'hot';
			case 'warm':
				return 'warm';
			default:
				return 'cool';
		}
	}

	/**
	 * Get icon for heat level
	 */
	private getHeatIcon(heatLevel: string): string {
		switch (heatLevel) {
			case 'blazing':
			case 'critical':
				return '🔥';
			case 'hot':
				return '🔥';
			case 'warm':
				return '🌡️';
			case 'cool':
				return '❄️';
			default:
				return '🧊';
		}
	}

	/**
	 * Show detailed heat information
	 */
	private showDetailedInfo(filePath: string): void {
		const heatData = this.heatManager.getHeatData(filePath);
		if (!heatData) return;

		const fileName = filePath.split('/').pop()?.replace('.md', '') || filePath;
		const heatLevel = this.heatManager.getHeatLevel(heatData.heatScore);
		const favorite = heatData.metrics.isFavorite ? '★ ' : '';

		const message = `${favorite}"${fileName}"
Heat: ${heatData.heatScore.toFixed(1)} (${heatLevel})
Accessed: ${heatData.metrics.accessCount}x
Edited: ${heatData.metrics.editCount}x
Last accessed: ${new Date(heatData.metrics.lastAccessed).toLocaleString()}`;

		new Notice(message, 8000);
	}

	/**
	 * Refresh all active banners
	 */
	refreshAllBanners(): void {
		// Clear all banners if disabled
		if (!this.settings.showHeatInEditor) {
			this.activeBanners.forEach(banner => banner.remove());
			this.activeBanners.clear();
		}
	}

	/**
	 * Clean up all banners
	 */
	cleanup(): void {
		this.activeBanners.forEach(banner => banner.remove());
		this.activeBanners.clear();
	}
}
