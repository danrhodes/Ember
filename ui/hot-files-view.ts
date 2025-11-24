import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import { EmberSettings } from '../types';
import { HeatManager } from '../managers/heat-manager';

export const HOT_FILES_VIEW_TYPE = 'ember-hot-files';

/**
 * HotFilesView
 *
 * Custom panel view showing recently active files (heating up)
 * Displays:
 * - Files accessed within time window (default: 7 days)
 * - File name (clickable to open)
 * - Last accessed time
 * - Heat score
 * - Momentum indicator (↗️ heating, → stable, ↘️ cooling)
 */
export class HotFilesView extends ItemView {
	private settings: EmberSettings;
	private heatManager: HeatManager;
	private refreshInterval: number | null = null;
	private readonly REFRESH_INTERVAL_MS = 5000; // Refresh every 5 seconds
	private previousHeatScores: Map<string, number> = new Map(); // Track heat changes
	private searchQuery = '';
	private selectedFiles: Set<string> = new Set(); // Track selected file paths
	private batchMode = false; // Toggle batch operations mode

	constructor(leaf: WorkspaceLeaf, settings: EmberSettings, heatManager: HeatManager) {
		super(leaf);
		this.settings = settings;
		this.heatManager = heatManager;
	}

	getViewType(): string {
		return HOT_FILES_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Hot Files';
	}

	getIcon(): string {
		return 'flame';
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('ember-hot-files-panel');

		// Render initial content
		this.renderContent();

		// Set up auto-refresh
		this.refreshInterval = window.setInterval(() => {
			this.renderContent();
		}, this.REFRESH_INTERVAL_MS);
	}

	async onClose(): Promise<void> {
		// Clean up interval
		if (this.refreshInterval !== null) {
			window.clearInterval(this.refreshInterval);
			this.refreshInterval = null;
		}
	}

	/**
	 * Render the hot files list
	 */
	private renderContent(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();

		// Add header
		const header = container.createEl('div', { cls: 'ember-panel-header' });
		header.createEl('h4', { text: 'Hot Files' });

		const timeWindowDays = this.settings.hotFilesTimeWindow;
		const subtitle = timeWindowDays === 1
			? 'Files active in the last day'
			: `Files active in the last ${timeWindowDays} days`;

		header.createEl('div', {
			cls: 'ember-panel-subtitle',
			text: subtitle
		});

		// Add search input
		const searchContainer = container.createEl('div', { cls: 'ember-search-container' });
		const searchInput = searchContainer.createEl('input', {
			cls: 'ember-search-input',
			type: 'text',
			placeholder: 'Search files...'
		}) as HTMLInputElement;
		searchInput.value = this.searchQuery;
		searchInput.addEventListener('input', (e) => {
			this.searchQuery = (e.target as HTMLInputElement).value;
			this.renderFileList(container, timeWindowDays);
		});

		// Batch operations controls
		this.renderBatchControls(container, timeWindowDays);

		// Render file list
		this.renderFileList(container, timeWindowDays);
	}

	/**
	 * Render the file list with optional filtering
	 */
	private renderFileList(container: HTMLElement, timeWindowDays: number): void {
		// Remove existing file list
		const existingList = container.querySelector('.ember-file-list');
		const existingFooter = container.querySelector('.ember-panel-footer');
		const existingEmpty = container.querySelector('.ember-empty-state');
		if (existingList) existingList.remove();
		if (existingFooter) existingFooter.remove();
		if (existingEmpty) existingEmpty.remove();

		// Get hot files
		const timeWindowMs = this.settings.hotFilesTimeWindow * 24 * 60 * 60 * 1000;
		let hotFiles = this.heatManager.getHotFiles(
			timeWindowMs,
			this.settings.popularFilesCount * 2 // Get more files to allow filtering
		);

		// Apply search filter
		if (this.searchQuery.trim()) {
			hotFiles = this.filterFiles(hotFiles, this.searchQuery);
		}

		// Limit to configured count after filtering
		hotFiles = hotFiles.slice(0, this.settings.popularFilesCount);

		if (hotFiles.length === 0) {
			const emptyText = this.searchQuery.trim()
				? `No files match "${this.searchQuery}"`
				: `No files accessed in the last ${timeWindowDays} day${timeWindowDays > 1 ? 's' : ''}. Start working to see activity!`;
			container.createEl('div', {
				cls: 'ember-empty-state',
				text: emptyText
			});
			return;
		}

		// Create file list
		const listEl = container.createEl('div', { cls: 'ember-file-list' });

		for (let i = 0; i < hotFiles.length; i++) {
			const heatData = hotFiles[i];
			const rank = i + 1;

			const itemEl = listEl.createEl('div', { cls: 'ember-hot-file-item' });

			// Checkbox for batch operations (only in batch mode)
			if (this.batchMode) {
				const checkbox = itemEl.createEl('input', {
					type: 'checkbox',
					cls: 'ember-file-checkbox'
				}) as HTMLInputElement;
				checkbox.checked = this.selectedFiles.has(heatData.path);
				checkbox.addEventListener('change', (e) => {
					e.stopPropagation();
					if (checkbox.checked) {
						this.selectedFiles.add(heatData.path);
					} else {
						this.selectedFiles.delete(heatData.path);
					}
					this.renderBatchControls(container, timeWindowDays);
				});
			}

			// Rank badge
			itemEl.createEl('span', {
				cls: 'ember-rank-badge',
				text: `${rank}`
			});

			// File name (clickable)
			const fileNameEl = itemEl.createEl('div', { cls: 'ember-file-name' });

			const linkEl = fileNameEl.createEl('a', {
				cls: 'ember-file-link',
				text: this.getFileName(heatData.path)
			});

			linkEl.addEventListener('click', async (e) => {
				e.preventDefault();
				await this.openFile(heatData.path);
			});

			// Stats row
			const statsEl = itemEl.createEl('div', { cls: 'ember-file-stats' });

			// Last accessed time
			statsEl.createEl('span', {
				cls: 'ember-stat-item',
				text: this.formatTimeAgo(heatData.metrics.lastAccessed)
			});

			// Heat score
			const heatLevel = this.heatManager.getHeatLevel(heatData.heatScore);
			statsEl.createEl('span', {
				cls: `ember-heat-badge ${this.getHeatBadgeClass(heatLevel)}`,
				text: `${Math.round(heatData.heatScore)}`
			});

			// Momentum indicator
			const momentum = this.calculateMomentum(heatData.path, heatData.heatScore);
			if (momentum !== 'stable') {
				const momentumIcon = statsEl.createEl('span', {
					cls: `ember-momentum-indicator ember-momentum-${momentum}`,
					text: this.getMomentumIcon(momentum)
				});
				momentumIcon.setAttribute('aria-label',
					momentum === 'heating' ? 'Heating up' : 'Cooling down'
				);
			}

			// Favorite indicator
			if (heatData.metrics.isFavorite) {
				statsEl.createEl('span', {
					cls: 'ember-favorite-indicator',
					text: '★'
				});
			}

			// Add hover effect
			itemEl.addEventListener('mouseenter', () => {
				itemEl.addClass('ember-hover');
			});

			itemEl.addEventListener('mouseleave', () => {
				itemEl.removeClass('ember-hover');
			});

			// Store current heat for next momentum calculation
			this.previousHeatScores.set(heatData.path, heatData.heatScore);
		}

		// Add refresh timestamp
		const footer = container.createEl('div', { cls: 'ember-panel-footer' });
		footer.createEl('small', {
			text: `Last updated: ${new Date().toLocaleTimeString()}`
		});
	}

	/**
	 * Calculate file momentum (heating, cooling, stable)
	 */
	private calculateMomentum(path: string, currentHeat: number): 'heating' | 'cooling' | 'stable' {
		const previousHeat = this.previousHeatScores.get(path);

		if (previousHeat === undefined) {
			return 'stable'; // First time seeing this file
		}

		const diff = currentHeat - previousHeat;

		if (diff > 2) {
			return 'heating';
		} else if (diff < -2) {
			return 'cooling';
		} else {
			return 'stable';
		}
	}

	/**
	 * Get momentum icon
	 */
	private getMomentumIcon(momentum: 'heating' | 'cooling' | 'stable'): string {
		switch (momentum) {
			case 'heating':
				return '↗';
			case 'cooling':
				return '↘';
			default:
				return '→';
		}
	}

	/**
	 * Filter files by search query (fuzzy search)
	 */
	private filterFiles<T extends { path: string; heatScore: number }>(files: T[], query: string): T[] {
		const lowerQuery = query.toLowerCase();
		return files.filter(file => {
			const fileName = this.getFileName(file.path).toLowerCase();
			const filePath = file.path.toLowerCase();

			// Simple fuzzy matching - check if all query characters appear in order
			let queryIndex = 0;
			for (let i = 0; i < fileName.length && queryIndex < lowerQuery.length; i++) {
				if (fileName[i] === lowerQuery[queryIndex]) {
					queryIndex++;
				}
			}

			// If all query characters matched, include this file
			// Also include if query is a substring of path
			return queryIndex === lowerQuery.length || filePath.includes(lowerQuery);
		});
	}

	/**
	 * Get file name from path
	 */
	private getFileName(path: string): string {
		const parts = path.split('/');
		const fileName = parts[parts.length - 1];
		return fileName.replace('.md', '');
	}

	/**
	 * Get CSS class for heat badge
	 */
	private getHeatBadgeClass(heatLevel: string): string {
		if (heatLevel === 'blazing' || heatLevel === 'critical' || heatLevel === 'hot') {
			return 'hot';
		} else if (heatLevel === 'warm') {
			return 'warm';
		} else {
			return 'cool';
		}
	}

	/**
	 * Format time ago
	 */
	private formatTimeAgo(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;

		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) {
			return `${days}d ago`;
		} else if (hours > 0) {
			return `${hours}h ago`;
		} else if (minutes > 0) {
			return `${minutes}m ago`;
		} else {
			return 'Just now';
		}
	}

	/**
	 * Open a file in Obsidian
	 */
	private async openFile(path: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);

		if (file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);
		}
	}

	/**
	 * Render batch operation controls
	 */
	private renderBatchControls(container: HTMLElement, timeWindowDays: number): void {
		const existingControls = container.querySelector('.ember-batch-controls');
		if (existingControls) existingControls.remove();

		const controlsContainer = container.createEl('div', { cls: 'ember-batch-controls' });

		// Batch mode toggle
		const toggleButton = controlsContainer.createEl('button', {
			cls: `ember-batch-toggle ${this.batchMode ? 'active' : ''}`,
			text: this.batchMode ? 'Exit Batch Mode' : 'Batch Operations'
		});

		toggleButton.addEventListener('click', () => {
			this.batchMode = !this.batchMode;
			this.selectedFiles.clear();
			this.renderContent();
		});

		// Show action buttons only in batch mode
		if (this.batchMode) {
			// Selection counter
			controlsContainer.createEl('span', {
				cls: 'ember-selection-counter',
				text: `${this.selectedFiles.size} selected`
			});

			// Action buttons
			const actionsContainer = controlsContainer.createEl('div', { cls: 'ember-batch-actions' });

			// Select all button
			const selectAllBtn = actionsContainer.createEl('button', {
				cls: 'ember-batch-btn ember-batch-select-all',
				text: 'Select All'
			});
			selectAllBtn.addEventListener('click', () => this.selectAll(container, timeWindowDays));

			// Clear selection button
			const clearBtn = actionsContainer.createEl('button', {
				cls: 'ember-batch-btn ember-batch-clear',
				text: 'Clear'
			});
			clearBtn.addEventListener('click', () => this.clearSelection(container, timeWindowDays));

			// Favorite selected button
			const favoriteBtn = actionsContainer.createEl('button', {
				cls: 'ember-batch-btn ember-batch-favorite',
				text: `★ Favorite (${this.selectedFiles.size})`
			});
			favoriteBtn.addEventListener('click', () => this.batchFavorite(container, timeWindowDays, true));

			// Unfavorite selected button
			const unfavoriteBtn = actionsContainer.createEl('button', {
				cls: 'ember-batch-btn ember-batch-unfavorite',
				text: `☆ Unfavorite (${this.selectedFiles.size})`
			});
			unfavoriteBtn.addEventListener('click', () => this.batchFavorite(container, timeWindowDays, false));

			// Reset heat button
			const resetBtn = actionsContainer.createEl('button', {
				cls: 'ember-batch-btn ember-batch-reset',
				text: `Reset Heat (${this.selectedFiles.size})`
			});
			resetBtn.addEventListener('click', () => this.batchResetHeat(container, timeWindowDays));
		}
	}

	/**
	 * Select all visible files
	 */
	private selectAll(container: HTMLElement, timeWindowDays: number): void {
		const timeWindowMs = timeWindowDays * 24 * 60 * 60 * 1000;
		let hotFiles = this.heatManager.getRecentlyActiveFiles(timeWindowMs);

		if (this.searchQuery.trim()) {
			hotFiles = this.filterFiles(hotFiles, this.searchQuery);
		}

		hotFiles.forEach(file => this.selectedFiles.add(file.path));
		this.renderBatchControls(container, timeWindowDays);
		this.renderFileList(container, timeWindowDays);
	}

	/**
	 * Clear all selections
	 */
	private clearSelection(container: HTMLElement, timeWindowDays: number): void {
		this.selectedFiles.clear();
		this.renderBatchControls(container, timeWindowDays);
		this.renderFileList(container, timeWindowDays);
	}

	/**
	 * Batch favorite/unfavorite operation
	 */
	private batchFavorite(container: HTMLElement, timeWindowDays: number, isFavorite: boolean): void {
		if (this.selectedFiles.size === 0) return;

		this.selectedFiles.forEach(path => {
			const heatData = this.heatManager.getHeatData(path);
			if (heatData) {
				heatData.metrics.isFavorite = isFavorite;
				this.heatManager.setHeatData(path, heatData);
			}
		});

		this.selectedFiles.clear();
		this.renderBatchControls(container, timeWindowDays);
		this.renderFileList(container, timeWindowDays);
	}

	/**
	 * Batch reset heat operation
	 */
	private batchResetHeat(container: HTMLElement, timeWindowDays: number): void {
		if (this.selectedFiles.size === 0) return;

		this.selectedFiles.forEach(path => {
			this.heatManager.resetFileHeat(path);
		});

		this.selectedFiles.clear();
		this.renderBatchControls(container, timeWindowDays);
		this.renderFileList(container, timeWindowDays);
	}

	/**
	 * Refresh the view
	 */
	refresh(): void {
		this.renderContent();
	}

	/**
	 * Update settings
	 */
	updateSettings(settings: EmberSettings): void {
		this.settings = settings;
		this.renderContent();
	}
}
