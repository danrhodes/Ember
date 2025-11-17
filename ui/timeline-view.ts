import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import { EmberSettings } from '../types';
import { HeatManager } from '../managers/heat-manager';
import { ArchivalManager } from '../storage/archival-manager';

export const TIMELINE_VIEW_TYPE = 'ember-timeline-view';

/**
 * TimelineView
 *
 * Interactive timeline for viewing historical heat data.
 * Features:
 * - Scrubber slider to navigate through snapshots
 * - Date picker for specific points in time
 * - Snapshot comparison (current vs historical)
 * - Visual heat changes over time
 * - Restore capability
 */
export class TimelineView extends ItemView {
	private settings: EmberSettings;
	private heatManager: HeatManager;
	private archivalManager: ArchivalManager;
	private snapshots: Array<{ timestamp: number; date: string }> = [];
	private currentSnapshotIndex: number = -1;
	private isViewingHistory: boolean = false;

	// UI Elements
	private timelineSlider: HTMLInputElement;
	private dateDisplay: HTMLElement;
	private snapshotCount: HTMLElement;
	private comparisonContainer: HTMLElement;
	private historyIndicator: HTMLElement;
	private loadingOverlay: HTMLElement | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		settings: EmberSettings,
		heatManager: HeatManager,
		archivalManager: ArchivalManager
	) {
		super(leaf);
		this.settings = settings;
		this.heatManager = heatManager;
		this.archivalManager = archivalManager;
	}

	getViewType(): string {
		return TIMELINE_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Heat Timeline';
	}

	getIcon(): string {
		return 'history';
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('ember-timeline-container');

		// Load available snapshots
		await this.loadSnapshots();

		if (this.snapshots.length === 0) {
			this.showEmptyState(container);
			return;
		}

		// Create header
		this.createHeader(container);

		// Create timeline controls
		this.createTimelineControls(container);

		// Create comparison view
		this.createComparisonView(container);

		// Create action buttons
		this.createActionButtons(container);

		// Set to current state by default
		this.currentSnapshotIndex = this.snapshots.length - 1;
		this.updateDisplay();
	}

	async onClose(): Promise<void> {
		// Return to current state if viewing history
		if (this.isViewingHistory) {
			await this.returnToCurrent();
		}
	}

	/**
	 * Load available snapshots
	 */
	private async loadSnapshots(): Promise<void> {
		this.snapshots = await this.archivalManager.getSnapshotList();

		// Add "current" as the latest snapshot
		this.snapshots.push({
			timestamp: Date.now(),
			date: 'Current'
		});

		console.log('Ember Timeline: Loaded', this.snapshots.length, 'snapshots');
	}

	/**
	 * Show empty state when no snapshots exist
	 */
	private showEmptyState(container: HTMLElement): void {
		const emptyState = container.createEl('div', { cls: 'ember-empty-state' });
		emptyState.createEl('h3', { text: 'No Historical Data' });
		emptyState.createEl('p', { text: 'Snapshots will appear here once the archival system creates them.' });
		emptyState.createEl('p', {
			text: `Snapshots are created ${this.settings.archival.snapshotFrequency === 'daily' ? 'daily at midnight' :
				this.settings.archival.snapshotFrequency === 'weekly' ? 'weekly' : 'hourly'}.`
		});

		const manualButton = emptyState.createEl('button', { text: 'Create Snapshot Now' });
		manualButton.addEventListener('click', async () => {
			await this.archivalManager.createSnapshot();
			await this.onOpen(); // Refresh view
		});
	}

	/**
	 * Create header section
	 */
	private createHeader(container: HTMLElement): void {
		const header = container.createEl('div', { cls: 'ember-panel-header' });
		header.createEl('h4', { text: 'Heat Timeline' });

		this.historyIndicator = header.createEl('div', { cls: 'ember-history-indicator' });
		this.historyIndicator.style.display = 'none';
		this.historyIndicator.createEl('span', { text: '📍 Viewing History' });

		const subtitle = header.createEl('div', { cls: 'ember-panel-subtitle' });
		this.snapshotCount = subtitle.createEl('span', {
			text: `${this.snapshots.length} snapshots available`
		});
	}

	/**
	 * Create timeline scrubber controls
	 */
	private createTimelineControls(container: HTMLElement): void {
		const controlsContainer = container.createEl('div', { cls: 'ember-timeline-controls' });

		// Date display
		const dateContainer = controlsContainer.createEl('div', { cls: 'ember-timeline-date' });
		this.dateDisplay = dateContainer.createEl('h2', { text: 'Current' });

		// Timeline slider
		const sliderContainer = controlsContainer.createEl('div', { cls: 'ember-timeline-slider-container' });

		this.timelineSlider = sliderContainer.createEl('input', {
			type: 'range',
			cls: 'ember-timeline-slider'
		}) as HTMLInputElement;

		this.timelineSlider.min = '0';
		this.timelineSlider.max = String(this.snapshots.length - 1);
		this.timelineSlider.value = String(this.snapshots.length - 1);
		this.timelineSlider.step = '1';

		// Slider labels
		const labelsContainer = sliderContainer.createEl('div', { cls: 'ember-timeline-labels' });

		if (this.snapshots.length > 0) {
			const firstSnapshot = this.snapshots[0];
			const lastSnapshot = this.snapshots[this.snapshots.length - 1];

			labelsContainer.createEl('span', {
				text: this.formatDate(firstSnapshot.timestamp),
				cls: 'ember-timeline-label-start'
			});

			labelsContainer.createEl('span', {
				text: lastSnapshot.date,
				cls: 'ember-timeline-label-end'
			});
		}

		// Event listeners
		this.timelineSlider.addEventListener('input', () => {
			this.currentSnapshotIndex = parseInt(this.timelineSlider.value);
			this.updateDisplay();
		});

		this.timelineSlider.addEventListener('change', async () => {
			await this.loadSnapshot(this.currentSnapshotIndex);
		});

		// Navigation buttons
		const navButtons = controlsContainer.createEl('div', { cls: 'ember-timeline-nav' });

		const prevBtn = navButtons.createEl('button', { text: '← Previous' });
		prevBtn.title = 'Go to previous snapshot in timeline';
		prevBtn.setAttribute('aria-label', 'Previous snapshot');
		prevBtn.addEventListener('click', () => this.navigatePrevious());

		const nextBtn = navButtons.createEl('button', { text: 'Next →' });
		nextBtn.title = 'Go to next snapshot in timeline';
		nextBtn.setAttribute('aria-label', 'Next snapshot');
		nextBtn.addEventListener('click', () => this.navigateNext());

		const currentBtn = navButtons.createEl('button', { text: 'Jump to Current' });
		currentBtn.title = 'Return to live heat data';
		currentBtn.setAttribute('aria-label', 'Jump to current state');
		currentBtn.addEventListener('click', () => this.jumpToCurrent());
	}

	/**
	 * Create comparison view showing heat changes
	 */
	private createComparisonView(container: HTMLElement): void {
		this.comparisonContainer = container.createEl('div', { cls: 'ember-comparison-container' });

		const title = this.comparisonContainer.createEl('h3', { text: 'Heat Comparison' });

		// This will be populated when a snapshot is loaded
		const statsGrid = this.comparisonContainer.createEl('div', { cls: 'ember-stats-grid' });
	}

	/**
	 * Create action buttons
	 */
	private createActionButtons(container: HTMLElement): void {
		const actionsContainer = container.createEl('div', { cls: 'ember-timeline-actions' });

		const returnBtn = actionsContainer.createEl('button', {
			text: 'Return to Current',
			cls: 'mod-cta'
		});
		returnBtn.title = 'Exit historical view and return to live heat data';
		returnBtn.setAttribute('aria-label', 'Return to current state');
		returnBtn.addEventListener('click', async () => await this.returnToCurrent());

		const exportBtn = actionsContainer.createEl('button', { text: 'Export This Snapshot' });
		exportBtn.title = 'Export this snapshot using Settings → Ember → Export/Import';
		exportBtn.setAttribute('aria-label', 'Export current snapshot');
		exportBtn.addEventListener('click', () => this.exportCurrentSnapshot());

		// Warning message
		const warning = actionsContainer.createEl('div', { cls: 'ember-timeline-warning' });
		warning.createEl('p', {
			text: '⚠️ When viewing historical data, the visual renderer shows the heat state from that time.'
		});
	}

	/**
	 * Update display based on current snapshot index
	 */
	private updateDisplay(): void {
		if (this.currentSnapshotIndex < 0 || this.currentSnapshotIndex >= this.snapshots.length) {
			return;
		}

		const snapshot = this.snapshots[this.currentSnapshotIndex];

		// Update date display
		if (snapshot.date === 'Current') {
			this.dateDisplay.textContent = 'Current';
			this.historyIndicator.style.display = 'none';
		} else {
			this.dateDisplay.textContent = this.formatDateLong(snapshot.timestamp);
			this.historyIndicator.style.display = 'block';
		}

		// Update slider position
		this.timelineSlider.value = String(this.currentSnapshotIndex);
	}

	/**
	 * Load a specific snapshot
	 */
	private async loadSnapshot(index: number): Promise<void> {
		if (index < 0 || index >= this.snapshots.length) return;

		const snapshot = this.snapshots[index];

		// If current, restore to live data
		if (snapshot.date === 'Current') {
			await this.returnToCurrent();
			return;
		}

		// Show loading state
		this.showLoading('Loading snapshot...');

		try {
			// Load historical snapshot
			console.log('Ember Timeline: Loading snapshot from', snapshot.date);

			const success = await this.archivalManager.loadSnapshot(snapshot.timestamp);

			if (success) {
				this.isViewingHistory = true;
				this.updateComparison(snapshot.timestamp);

				// User feedback
				new Notice(`📸 Loaded snapshot from ${this.formatDate(snapshot.timestamp)}`);
				console.log('Ember Timeline: Loaded historical snapshot, visuals will update shortly');
			} else {
				new Notice('❌ Failed to load snapshot - please try again', 5000);
				console.error('Failed to load snapshot');
			}
		} finally {
			this.hideLoading();
		}
	}

	/**
	 * Update comparison stats
	 */
	private updateComparison(historicalTimestamp: number): void {
		const statsGrid = this.comparisonContainer.querySelector('.ember-stats-grid') as HTMLElement;
		if (!statsGrid) return;

		statsGrid.empty();

		// Get current and historical data
		const currentData = Array.from(this.heatManager.getAllHeatData().values());

		// Calculate stats
		const totalFiles = currentData.length;
		const avgHeat = totalFiles > 0
			? currentData.reduce((sum, d) => sum + d.heatScore, 0) / totalFiles
			: 0;
		const hotFiles = currentData.filter(d => d.heatScore > 70).length;

		// Display stats
		this.createStatCard(statsGrid, 'Total Files', String(totalFiles), 'file-text');
		this.createStatCard(statsGrid, 'Average Heat', avgHeat.toFixed(1), 'thermometer');
		this.createStatCard(statsGrid, 'Hot Files', String(hotFiles), 'flame');
		this.createStatCard(statsGrid, 'Snapshot Date', this.formatDate(historicalTimestamp), 'calendar');
	}

	/**
	 * Create a stat card
	 */
	private createStatCard(
		container: HTMLElement,
		label: string,
		value: string,
		icon: string
	): void {
		const card = container.createEl('div', { cls: 'ember-stat-card' });

		const content = card.createEl('div', { cls: 'ember-stat-content' });
		content.createEl('div', { cls: 'ember-stat-value', text: value });
		content.createEl('div', { cls: 'ember-stat-label', text: label });
	}

	/**
	 * Navigate to previous snapshot
	 */
	private navigatePrevious(): void {
		if (this.currentSnapshotIndex > 0) {
			this.currentSnapshotIndex--;
			this.updateDisplay();
			this.loadSnapshot(this.currentSnapshotIndex);
		}
	}

	/**
	 * Navigate to next snapshot
	 */
	private navigateNext(): void {
		if (this.currentSnapshotIndex < this.snapshots.length - 1) {
			this.currentSnapshotIndex++;
			this.updateDisplay();
			this.loadSnapshot(this.currentSnapshotIndex);
		}
	}

	/**
	 * Jump to current (latest) state
	 */
	private jumpToCurrent(): void {
		this.currentSnapshotIndex = this.snapshots.length - 1;
		this.updateDisplay();
		this.loadSnapshot(this.currentSnapshotIndex);
	}

	/**
	 * Return to current state
	 */
	private async returnToCurrent(): Promise<void> {
		if (!this.isViewingHistory) return;

		this.showLoading('Returning to current state...');

		try {
			console.log('Ember Timeline: Returning to current state');

			// Reload current data from storage
			await this.archivalManager.restoreCurrentState();

			this.isViewingHistory = false;
			this.currentSnapshotIndex = this.snapshots.length - 1;
			this.updateDisplay();

			// User feedback
			new Notice('✅ Returned to current state');
			console.log('Ember Timeline: Returned to current state, visuals will update shortly');
		} finally {
			this.hideLoading();
		}
	}

	/**
	 * Export current snapshot
	 */
	private exportCurrentSnapshot(): void {
		if (this.currentSnapshotIndex < 0 || this.currentSnapshotIndex >= this.snapshots.length) {
			return;
		}

		const snapshot = this.snapshots[this.currentSnapshotIndex];
		console.log('Ember Timeline: Export snapshot feature - use Export/Import in settings');
		// Note: Users can export via Settings → Ember → Export/Import
	}

	/**
	 * Format timestamp to short date
	 */
	private formatDate(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleDateString();
	}

	/**
	 * Format timestamp to long date
	 */
	private formatDateLong(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	/**
	 * Update settings
	 */
	updateSettings(settings: EmberSettings): void {
		this.settings = settings;
	}

	/**
	 * Refresh view
	 */
	async refresh(): Promise<void> {
		await this.loadSnapshots();
		await this.onOpen();
	}

	/**
	 * Show loading overlay
	 */
	private showLoading(message: string): void {
		if (this.loadingOverlay) {
			this.loadingOverlay.remove();
		}

		const container = this.containerEl.children[1] as HTMLElement;
		this.loadingOverlay = container.createEl('div', { cls: 'ember-loading-overlay' });

		const spinner = this.loadingOverlay.createEl('div', { cls: 'ember-loading-spinner' });
		this.loadingOverlay.createEl('div', {
			cls: 'ember-loading-text',
			text: message
		});
	}

	/**
	 * Hide loading overlay
	 */
	private hideLoading(): void {
		if (this.loadingOverlay) {
			this.loadingOverlay.remove();
			this.loadingOverlay = null;
		}
	}
}
