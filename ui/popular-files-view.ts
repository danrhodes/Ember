import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import { EmberSettings } from '../types';
import { HeatManager } from '../managers/heat-manager';

export const POPULAR_FILES_VIEW_TYPE = 'ember-popular-files';

/**
 * PopularFilesView
 *
 * Custom panel view showing most accessed files of all time
 * Displays:
 * - File name (clickable to open)
 * - Access count
 * - Heat score
 * - Heat badge (hot/warm/cool)
 */
interface FilterState {
	folderPath: string;
	heatMin: number;
	heatMax: number;
	dateRange: 'all' | 'today' | 'week' | 'month' | 'custom';
	customDateStart: number | null;
	customDateEnd: number | null;
	onlyFavorites: boolean;
}

export class PopularFilesView extends ItemView {
	private settings: EmberSettings;
	private heatManager: HeatManager;
	private refreshInterval: number | null = null;
	private readonly REFRESH_INTERVAL_MS = 5000; // Refresh every 5 seconds
	private searchQuery = '';
	private selectedFiles: Set<string> = new Set(); // Track selected file paths
	private batchMode = false; // Toggle batch operations mode
	private filterState: FilterState = {
		folderPath: '',
		heatMin: 0,
		heatMax: 100,
		dateRange: 'all',
		customDateStart: null,
		customDateEnd: null,
		onlyFavorites: false
	};
	private showFilters = false;

	constructor(leaf: WorkspaceLeaf, settings: EmberSettings, heatManager: HeatManager) {
		super(leaf);
		this.settings = settings;
		this.heatManager = heatManager;
	}

	getViewType(): string {
		return POPULAR_FILES_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Popular files';
	}

	getIcon(): string {
		return 'flame';
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('ember-popular-files-panel');

		// Render initial content
		this.renderContent();

		// Set up auto-refresh - only refresh file list to avoid interrupting user input
		this.refreshInterval = window.setInterval(() => {
			this.refreshFileListOnly();
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
	 * Render the popular files list
	 */
	private renderContent(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();

		// Add header
		const header = container.createEl('div', { cls: 'ember-panel-header' });
		header.createEl('h4', { text: 'Most popular files' });
		header.createEl('div', {
			cls: 'ember-panel-subtitle',
			text: `Top ${this.settings.popularFilesCount} by access count`
		});

		// Add search input
		const searchContainer = container.createEl('div', { cls: 'ember-search-container' });
		const searchInput = searchContainer.createEl('input', {
			cls: 'ember-search-input',
			type: 'text',
			placeholder: 'Search files...',
			value: this.searchQuery
		});
		searchInput.addEventListener('input', (e) => {
			this.searchQuery = (e.target as HTMLInputElement).value;
			this.renderFileList(container);
		});

		// Batch operations controls
		this.renderBatchControls(container);

		// Filter controls
		this.renderFilterControls(container);

		// Render file list
		this.renderFileList(container);
	}

	/**
	 * Render the file list with optional filtering
	 */
	private renderFileList(container: HTMLElement): void {
		// Remove existing file list
		const existingList = container.querySelector('.ember-file-list');
		const existingFooter = container.querySelector('.ember-panel-footer');
		const existingEmpty = container.querySelector('.ember-empty-state');
		if (existingList) existingList.remove();
		if (existingFooter) existingFooter.remove();
		if (existingEmpty) existingEmpty.remove();

		// Get popular files
		let popularFiles = this.heatManager.getMostPopularFiles(
			this.settings.popularFilesCount * 3 // Get more files to allow filtering
		);

		// Apply search filter
		if (this.searchQuery.trim()) {
			popularFiles = this.filterFiles(popularFiles, this.searchQuery);
		}

		// Apply advanced filters
		popularFiles = this.applyFilters(popularFiles);

		// Limit to configured count after filtering
		popularFiles = popularFiles.slice(0, this.settings.popularFilesCount);

		if (popularFiles.length === 0) {
			const emptyText = this.searchQuery.trim()
				? `No files match "${this.searchQuery}"`
				: 'No files tracked yet. Start using Obsidian to build heat!';
			container.createEl('div', {
				cls: 'ember-empty-state',
				text: emptyText
			});
			return;
		}

		// Create file list
		const listEl = container.createEl('div', { cls: 'ember-file-list' });

		for (let i = 0; i < popularFiles.length; i++) {
			const heatData = popularFiles[i];
			const rank = i + 1;

			const itemEl = listEl.createEl('div', { cls: 'ember-popular-file-item' });

			// Checkbox for batch operations (only in batch mode)
			if (this.batchMode) {
				const checkbox = itemEl.createEl('input', {
					type: 'checkbox',
					cls: 'ember-file-checkbox'
				});
				checkbox.checked = this.selectedFiles.has(heatData.path);
				checkbox.addEventListener('change', (e) => {
					e.stopPropagation();
					if (checkbox.checked) {
						this.selectedFiles.add(heatData.path);
					} else {
						this.selectedFiles.delete(heatData.path);
					}
					this.renderBatchControls(container);
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

			linkEl.addEventListener('click', (e) => {
				e.preventDefault();
				void this.openFile(heatData.path);
			});

			// Stats row
			const statsEl = itemEl.createEl('div', { cls: 'ember-file-stats' });

			// Access count
			statsEl.createEl('span', {
				cls: 'ember-stat-item',
				text: `${heatData.metrics.accessCount} views`
			});

			// Heat score
			const heatLevel = this.heatManager.getHeatLevel(heatData.heatScore);
			statsEl.createEl('span', {
				cls: `ember-heat-badge ${this.getHeatBadgeClass(heatLevel)}`,
				text: `${Math.round(heatData.heatScore)}`
			});

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
		}

		// Add refresh timestamp
		const footer = container.createEl('div', { cls: 'ember-panel-footer' });
		footer.createEl('small', {
			text: `Last updated: ${new Date().toLocaleTimeString()}`
		});
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
	 * Render filter controls
	 */
	private renderFilterControls(container: HTMLElement): void {
		const existingFilters = container.querySelector('.ember-filter-controls');
		if (existingFilters) existingFilters.remove();

		const filterContainer = container.createEl('div', { cls: 'ember-filter-controls' });

		// Filter toggle button
		const toggleButton = filterContainer.createEl('button', {
			cls: `ember-filter-toggle ${this.showFilters ? 'active' : ''}`,
			text: this.showFilters ? 'Hide filters' : 'Show filters'
		});

		toggleButton.addEventListener('click', () => {
			this.showFilters = !this.showFilters;
			this.renderContent();
		});

		// Active filter count badge
		const activeFilterCount = this.getActiveFilterCount();
		if (activeFilterCount > 0) {
			filterContainer.createEl('span', {
				cls: 'ember-filter-badge',
				text: `${activeFilterCount}`
			});
		}

		// Quick filter buttons
		const quickFilters = filterContainer.createEl('div', { cls: 'ember-quick-filters' });

		this.createQuickFilterButton(quickFilters, 'Today', 'today');
		this.createQuickFilterButton(quickFilters, 'This week', 'week');
		this.createQuickFilterButton(quickFilters, 'This month', 'month');
		this.createQuickFilterButton(quickFilters, 'Favorites only', 'favorites');

		// Clear all filters button
		if (activeFilterCount > 0) {
			const clearButton = filterContainer.createEl('button', {
				cls: 'ember-filter-clear',
				text: 'Clear all filters'
			});
			clearButton.addEventListener('click', () => this.clearAllFilters(container));
		}

		// Expanded filter panel
		if (this.showFilters) {
			this.renderExpandedFilters(filterContainer);
		}
	}

	/**
	 * Create a quick filter button
	 */
	private createQuickFilterButton(container: HTMLElement, label: string, type: string): void {
		const isActive = (type === 'favorites' && this.filterState.onlyFavorites) ||
			(type !== 'favorites' && this.filterState.dateRange === type);

		const button = container.createEl('button', {
			cls: `ember-quick-filter ${isActive ? 'active' : ''}`,
			text: label
		});

		button.addEventListener('click', () => {
			if (type === 'favorites') {
				this.filterState.onlyFavorites = !this.filterState.onlyFavorites;
			} else {
				this.filterState.dateRange = type as FilterState['dateRange'];
			}
			this.renderContent();
		});
	}

	/**
	 * Render expanded filter panel
	 */
	private renderExpandedFilters(container: HTMLElement): void {
		const panel = container.createEl('div', { cls: 'ember-filter-panel' });

		// Folder filter
		const folderGroup = panel.createEl('div', { cls: 'ember-filter-group' });
		folderGroup.createEl('label', { text: 'Folder path:', cls: 'ember-filter-label' });
		const folderInput = folderGroup.createEl('input', {
			type: 'text',
			cls: 'ember-filter-input',
			placeholder: 'e.g., Projects/Work',
			value: this.filterState.folderPath
		});
		folderInput.addEventListener('input', (e) => {
			this.filterState.folderPath = (e.target as HTMLInputElement).value;
			this.renderFileList(container.parentElement as HTMLElement);
		});

		// Heat range filter
		const heatGroup = panel.createEl('div', { cls: 'ember-filter-group' });
		heatGroup.createEl('label', { text: 'Heat range:', cls: 'ember-filter-label' });
		const heatRangeContainer = heatGroup.createEl('div', { cls: 'ember-filter-range' });

		const minInput = heatRangeContainer.createEl('input', {
			type: 'number',
			cls: 'ember-filter-input-small',
			placeholder: 'Min',
			value: this.filterState.heatMin.toString(),
			attr: { min: '0', max: '100' }
		});

		heatRangeContainer.createEl('span', { text: ' - ' });

		const maxInput = heatRangeContainer.createEl('input', {
			type: 'number',
			cls: 'ember-filter-input-small',
			placeholder: 'Max',
			value: this.filterState.heatMax.toString(),
			attr: { min: '0', max: '100' }
		});

		minInput.addEventListener('change', (e) => {
			this.filterState.heatMin = parseInt((e.target as HTMLInputElement).value) || 0;
			this.renderFileList(container.parentElement as HTMLElement);
		});

		maxInput.addEventListener('change', (e) => {
			this.filterState.heatMax = parseInt((e.target as HTMLInputElement).value) || 100;
			this.renderFileList(container.parentElement as HTMLElement);
		});

		// Date range filter
		const dateGroup = panel.createEl('div', { cls: 'ember-filter-group' });
		dateGroup.createEl('label', { text: 'Date range:', cls: 'ember-filter-label' });
		const dateSelect = dateGroup.createEl('select', {
			cls: 'ember-filter-select',
			value: this.filterState.dateRange
		});

		['all', 'today', 'week', 'month', 'custom'].forEach(option => {
			const optionEl = dateSelect.createEl('option', {
				value: option,
				text: option.charAt(0).toUpperCase() + option.slice(1)
			});
			if (option === this.filterState.dateRange) {
				optionEl.selected = true;
			}
		});

		dateSelect.addEventListener('change', (e) => {
			this.filterState.dateRange = (e.target as HTMLSelectElement).value as FilterState['dateRange'];
			this.renderFileList(container.parentElement as HTMLElement);
		});
	}

	/**
	 * Apply filters to file list
	 */
	private applyFilters<T extends { path: string; heatScore: number; metrics: { lastAccessed: number; isFavorite: boolean } }>(files: T[]): T[] {
		return files.filter(file => {
			// Folder filter
			if (this.filterState.folderPath.trim()) {
				if (!file.path.toLowerCase().includes(this.filterState.folderPath.toLowerCase())) {
					return false;
				}
			}

			// Heat range filter
			if (file.heatScore < this.filterState.heatMin || file.heatScore > this.filterState.heatMax) {
				return false;
			}

			// Date range filter
			const now = Date.now();
			const lastAccessed = file.metrics.lastAccessed;
			const oneDay = 24 * 60 * 60 * 1000;

			if (this.filterState.dateRange === 'today') {
				if (now - lastAccessed > oneDay) return false;
			} else if (this.filterState.dateRange === 'week') {
				if (now - lastAccessed > 7 * oneDay) return false;
			} else if (this.filterState.dateRange === 'month') {
				if (now - lastAccessed > 30 * oneDay) return false;
			}

			// Favorites filter
			if (this.filterState.onlyFavorites && !file.metrics.isFavorite) {
				return false;
			}

			return true;
		});
	}

	/**
	 * Get count of active filters
	 */
	private getActiveFilterCount(): number {
		let count = 0;
		if (this.filterState.folderPath.trim()) count++;
		if (this.filterState.heatMin > 0 || this.filterState.heatMax < 100) count++;
		if (this.filterState.dateRange !== 'all') count++;
		if (this.filterState.onlyFavorites) count++;
		return count;
	}

	/**
	 * Clear all filters
	 */
	private clearAllFilters(container: HTMLElement): void {
		this.filterState = {
			folderPath: '',
			heatMin: 0,
			heatMax: 100,
			dateRange: 'all',
			customDateStart: null,
			customDateEnd: null,
			onlyFavorites: false
		};
		this.renderContent();
	}

	/**
	 * Render batch operation controls
	 */
	private renderBatchControls(container: HTMLElement): void {
		const existingControls = container.querySelector('.ember-batch-controls');
		if (existingControls) existingControls.remove();

		const controlsContainer = container.createEl('div', { cls: 'ember-batch-controls' });

		// Batch mode toggle
		const toggleButton = controlsContainer.createEl('button', {
			cls: `ember-batch-toggle ${this.batchMode ? 'active' : ''}`,
			text: this.batchMode ? 'Exit batch mode' : 'Batch operations'
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
				text: 'Select all'
			});
			selectAllBtn.addEventListener('click', () => this.selectAll(container));

			// Clear selection button
			const clearBtn = actionsContainer.createEl('button', {
				cls: 'ember-batch-btn ember-batch-clear',
				text: 'Clear'
			});
			clearBtn.addEventListener('click', () => this.clearSelection(container));

			// Favorite selected button
			const favoriteBtn = actionsContainer.createEl('button', {
				cls: 'ember-batch-btn ember-batch-favorite',
				text: `Favorite (${this.selectedFiles.size})`
			});
			favoriteBtn.addEventListener('click', () => this.batchFavorite(container, true));

			// Unfavorite selected button
			const unfavoriteBtn = actionsContainer.createEl('button', {
				cls: 'ember-batch-btn ember-batch-unfavorite',
				text: `Unfavorite (${this.selectedFiles.size})`
			});
			unfavoriteBtn.addEventListener('click', () => this.batchFavorite(container, false));

			// Reset heat button
			const resetBtn = actionsContainer.createEl('button', {
				cls: 'ember-batch-btn ember-batch-reset',
				text: `Reset heat (${this.selectedFiles.size})`
			});
			resetBtn.addEventListener('click', () => this.batchResetHeat(container));
		}
	}

	/**
	 * Select all visible files
	 */
	private selectAll(container: HTMLElement): void {
		let popularFiles = this.heatManager.getMostPopularFiles(
			this.settings.popularFilesCount * 2
		);

		if (this.searchQuery.trim()) {
			popularFiles = this.filterFiles(popularFiles, this.searchQuery);
		}

		popularFiles = popularFiles.slice(0, this.settings.popularFilesCount);

		popularFiles.forEach(file => this.selectedFiles.add(file.path));
		this.renderBatchControls(container);
		this.renderFileList(container);
	}

	/**
	 * Clear all selections
	 */
	private clearSelection(container: HTMLElement): void {
		this.selectedFiles.clear();
		this.renderBatchControls(container);
		this.renderFileList(container);
	}

	/**
	 * Batch favorite/unfavorite operation
	 */
	private batchFavorite(container: HTMLElement, isFavorite: boolean): void {
		if (this.selectedFiles.size === 0) return;

		this.selectedFiles.forEach(path => {
			const heatData = this.heatManager.getHeatData(path);
			if (heatData) {
				heatData.metrics.isFavorite = isFavorite;
				this.heatManager.setHeatData(path, heatData);
			}
		});

		this.selectedFiles.clear();
		this.renderBatchControls(container);
		this.renderFileList(container);
	}

	/**
	 * Batch reset heat operation
	 */
	private batchResetHeat(container: HTMLElement): void {
		if (this.selectedFiles.size === 0) return;

		this.selectedFiles.forEach(path => {
			this.heatManager.resetFileHeat(path);
		});

		this.selectedFiles.clear();
		this.renderBatchControls(container);
		this.renderFileList(container);
	}

	/**
	 * Refresh only the file list without rebuilding search input (prevents interrupting typing)
	 */
	private refreshFileListOnly(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		if (container) {
			this.renderFileList(container);
		}
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
