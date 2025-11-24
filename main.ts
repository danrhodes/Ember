import { Plugin, TFile, Menu, Notice } from 'obsidian';
import { EmberSettings, DEFAULT_SETTINGS, VisualizationMode } from './types';
import { HeatManager } from './managers/heat-manager';
import { MetricsManager } from './managers/metrics-manager';
import { DecayManager } from './managers/decay-manager';
import { ExclusionManager } from './managers/exclusion-manager';
import { DataStore } from './storage/data-store';
import { ArchivalManager } from './storage/archival-manager';
import { ExportImportManager } from './storage/export-import-manager';
import { PropertyStorageManager } from './storage/property-storage-manager';
import { VisualRenderer } from './visualization/visual-renderer';
import { EventHandler } from './events/event-handler';
import { StatusBarWidget } from './ui/status-bar';
import { PopularFilesView, POPULAR_FILES_VIEW_TYPE } from './ui/popular-files-view';
import { HotFilesView, HOT_FILES_VIEW_TYPE } from './ui/hot-files-view';
import { StatisticsView, STATISTICS_VIEW_TYPE } from './ui/statistics-view';
import { TimelineView, TIMELINE_VIEW_TYPE } from './ui/timeline-view';
import { EmberSettingTab } from './settings';

/**
 * Ember Plugin - Visualize note activity through dynamic heat
 *
 * This is the main plugin class. Following the architectural principle of keeping
 * main.ts minimal, this file only handles:
 * - Plugin initialization and cleanup
 * - Settings loading and saving
 * - Manager initialization (will be added in subsequent tasks)
 * - Event registration (will be added in subsequent tasks)
 */
export default class EmberPlugin extends Plugin {
	settings: EmberSettings;

	// Managers
	private heatManager: HeatManager;
	private metricsManager: MetricsManager;
	private decayManager: DecayManager;
	private exclusionManager: ExclusionManager;
	private dataStore: DataStore;
	private archivalManager: ArchivalManager;
	private exportImportManager: ExportImportManager;
	private propertyStorageManager: PropertyStorageManager;

	// Visualization
	private visualRenderer: VisualRenderer;

	// Event Handling
	private eventHandler: EventHandler;

	// UI Components
	private statusBarWidget: StatusBarWidget;

	async onload() {
		// Load settings
		await this.loadSettings();

		// Initialize managers in correct order
		if (this.settings.debugLogging) {
			console.debug('Ember: Initializing managers...');
		}

		// 1. HeatManager - Core heat tracking
		this.heatManager = new HeatManager(this.settings);

		// 2. MetricsManager - Depends on HeatManager
		this.metricsManager = new MetricsManager(this.settings, this.heatManager);

		// 3. ExclusionManager - File/folder exclusions
		this.exclusionManager = new ExclusionManager(this.settings, this.app);

		// 4. DataStore - Load persisted data
		this.dataStore = new DataStore(this, this.settings, this.heatManager);
		const dataLoaded = await this.dataStore.load();
		if (this.settings.debugLogging) {
			if (dataLoaded) {
				console.debug('Ember: Heat data loaded successfully');
			} else {
				console.debug('Ember: Starting with fresh heat data');
			}
		}

		// 5. ArchivalManager - Start snapshot system (Phase 3)
		this.archivalManager = new ArchivalManager(this, this.settings, this.heatManager);
		await this.archivalManager.start();
		if (this.settings.debugLogging) {
			console.debug('Ember: Archival system initialized');
		}

		// 6. ExportImportManager - Export/Import functionality (Phase 3)
		this.exportImportManager = new ExportImportManager(this, this.settings, this.heatManager);
		if (this.settings.debugLogging) {
			console.debug('Ember: export/import manager initialized');
		}

		// 7. PropertyStorageManager - Property storage for Dataview integration (Phase 3)
		this.propertyStorageManager = new PropertyStorageManager(this, this.settings, this.heatManager);
		if (this.settings.debugLogging) {
			console.debug('Ember: Property storage manager initialized');
		}

		// 8. DecayManager - Start decay scheduler
		this.decayManager = new DecayManager(this, this.settings, this.heatManager, this.dataStore);
		this.decayManager.start();

		// 9. VisualRenderer - Start visual effects
		this.visualRenderer = new VisualRenderer(this.app, this.settings, this.heatManager);
		this.visualRenderer.start();

		// 10. EventHandler - Register file events
		this.eventHandler = new EventHandler(
			this,
			this.settings,
			this.metricsManager,
			this.exclusionManager,
			this.dataStore
		);
		this.eventHandler.registerEvents();

		// 11. StatusBarWidget - Add to status bar
		this.statusBarWidget = new StatusBarWidget(this, this.settings, this.heatManager);
		this.statusBarWidget.start();

		// 12. Register Popular Files View
		this.registerView(
			POPULAR_FILES_VIEW_TYPE,
			(leaf) => new PopularFilesView(leaf, this.settings, this.heatManager)
		);

		// 13. Register Hot Files View
		this.registerView(
			HOT_FILES_VIEW_TYPE,
			(leaf) => new HotFilesView(leaf, this.settings, this.heatManager)
		);

		// 14. Register Statistics View
		this.registerView(
			STATISTICS_VIEW_TYPE,
			(leaf) => new StatisticsView(leaf, this.settings, this.heatManager)
		);

		// 15. Register Timeline View
		this.registerView(
			TIMELINE_VIEW_TYPE,
			(leaf) => new TimelineView(leaf, this.settings, this.heatManager, this.archivalManager)
		);

		// 17. Add settings tab
		this.addSettingTab(new EmberSettingTab(this.app, this));

		// 18. Add ribbon icon to open Popular Files view
		this.addRibbonIcon('flame', 'Open popular files', () => {
			void this.activatePopularFilesView();
		});

		// 19. Add ribbon icon to open Hot Files view
		this.addRibbonIcon('fire', 'Open hot files', () => {
			void this.activateHotFilesView();
		});

		// 20. Add ribbon icon to open Statistics view
		this.addRibbonIcon('bar-chart-2', 'Open statistics', () => {
			void this.activateStatisticsView();
		});

		// 21. Add ribbon icon to open Timeline view
		this.addRibbonIcon('history', 'Open timeline', () => {
			void this.activateTimelineView();
		});

		// 23. Add commands
		this.addCommand({
			id: 'toggle-favorite',
			name: 'Toggle favorite for current file',
			callback: () => {
				this.toggleCurrentFileFavorite();
			}
		});

		this.addCommand({
			id: 'open-statistics',
			name: 'Open statistics',
			callback: async () => {
				await this.activateStatisticsView();
			}
		});

		this.addCommand({
			id: 'open-timeline',
			name: 'Open timeline',
			callback: async () => {
				await this.activateTimelineView();
			}
		});

		this.addCommand({
			id: 'open-popular-files',
			name: 'Open popular files',
			callback: async () => {
				await this.activatePopularFilesView();
			}
		});

		this.addCommand({
			id: 'open-hot-files',
			name: 'Open hot files',
			callback: async () => {
				await this.activateHotFilesView();
			}
		});

		this.addCommand({
			id: 'reset-current-file-heat',
			name: 'Reset heat for current file',
			callback: () => {
				this.resetCurrentFileHeat();
			}
		});

		this.addCommand({
			id: 'show-file-heat-info',
			name: 'Show heat info for current file',
			callback: () => {
				this.showCurrentFileHeatInfo();
			}
		});

		this.addCommand({
			id: 'cycle-visualization-mode',
			name: 'Cycle visualization mode',
			callback: async () => {
				await this.cycleVisualizationMode();
			}
		});

		this.addCommand({
			id: 'toggle-visual-effects',
			name: 'Toggle visual effects on/off',
			callback: async () => {
				await this.toggleVisualEffects();
			}
		});

		// 24. Register file menu (context menu) events
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (file instanceof TFile) {
					this.addFileMenuItems(menu, file);
				}
			})
		);
	}

	onunload() {

		// Cleanup in reverse order of initialization

		// 1. Stop status bar widget
		if (this.statusBarWidget) {
			this.statusBarWidget.stop();
		}

		// 2. Event handlers are auto-cleaned by Obsidian's registerEvent()

		// 3. Stop visual renderer
		if (this.visualRenderer) {
			this.visualRenderer.stop();
		}

		// 4. Stop decay scheduler
		if (this.decayManager) {
			this.decayManager.stop();
		}

		// 5. Stop archival system and save final snapshot
		if (this.archivalManager) {
			this.archivalManager.stop();
		}

		// 6. Save final data
		if (this.dataStore) {
			this.dataStore.save(true); // Immediate save
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);

		// Notify all components of settings changes
		if (this.heatManager) this.heatManager.updateSettings(this.settings);
		if (this.metricsManager) this.metricsManager.updateSettings(this.settings);
		if (this.decayManager) this.decayManager.updateSettings(this.settings);
		if (this.exclusionManager) this.exclusionManager.updateSettings(this.settings);
		if (this.dataStore) this.dataStore.updateSettings(this.settings);
		if (this.archivalManager) this.archivalManager.updateSettings(this.settings);
		if (this.exportImportManager) this.exportImportManager.updateSettings(this.settings);
		if (this.propertyStorageManager) this.propertyStorageManager.updateSettings(this.settings);
		if (this.visualRenderer) this.visualRenderer.updateSettings(this.settings);
		if (this.statusBarWidget) this.statusBarWidget.updateSettings(this.settings);

		// Update all view instances
		this.app.workspace.getLeavesOfType(POPULAR_FILES_VIEW_TYPE).forEach(leaf => {
			(leaf.view as PopularFilesView).updateSettings(this.settings);
		});
		this.app.workspace.getLeavesOfType(HOT_FILES_VIEW_TYPE).forEach(leaf => {
			(leaf.view as HotFilesView).updateSettings(this.settings);
		});
		this.app.workspace.getLeavesOfType(STATISTICS_VIEW_TYPE).forEach(leaf => {
			(leaf.view as StatisticsView).updateSettings(this.settings);
		});
		this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE).forEach(leaf => {
			(leaf.view as TimelineView).updateSettings(this.settings);
		});
	}

	/**
	 * Activate the Popular Files view
	 * Creates or reveals the view in the right sidebar
	 */
	async activatePopularFilesView(): Promise<void> {
		// Check if view is already open
		const existingLeaves = this.app.workspace.getLeavesOfType(POPULAR_FILES_VIEW_TYPE);

		if (existingLeaves.length > 0) {
			// View already exists, just reveal it
			this.app.workspace.revealLeaf(existingLeaves[0]);
			return;
		}

		// Create new view in right sidebar
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({
				type: POPULAR_FILES_VIEW_TYPE,
				active: true,
			});
			this.app.workspace.revealLeaf(leaf);
		}
	}

	/**
	 * Activate the Hot Files view
	 * Creates or reveals the view in the right sidebar
	 */
	async activateHotFilesView(): Promise<void> {
		// Check if view is already open
		const existingLeaves = this.app.workspace.getLeavesOfType(HOT_FILES_VIEW_TYPE);

		if (existingLeaves.length > 0) {
			// View already exists, just reveal it
			this.app.workspace.revealLeaf(existingLeaves[0]);
			return;
		}

		// Create new view in right sidebar
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({
				type: HOT_FILES_VIEW_TYPE,
				active: true,
			});
			this.app.workspace.revealLeaf(leaf);
		}
	}

	/**
	 * Activate the Statistics view
	 * Creates or reveals the view in the right sidebar
	 */
	async activateStatisticsView(): Promise<void> {
		// Check if view is already open
		const existingLeaves = this.app.workspace.getLeavesOfType(STATISTICS_VIEW_TYPE);

		if (existingLeaves.length > 0) {
			// View already exists, just reveal it
			this.app.workspace.revealLeaf(existingLeaves[0]);
			return;
		}

		// Create new view in right sidebar
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({
				type: STATISTICS_VIEW_TYPE,
				active: true,
			});
			this.app.workspace.revealLeaf(leaf);
		}
	}

	/**
	 * Activate the Timeline view
	 * Creates or reveals the view in the right sidebar
	 */
	async activateTimelineView(): Promise<void> {
		// Check if view is already open
		const existingLeaves = this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE);

		if (existingLeaves.length > 0) {
			// View already exists, just reveal it
			this.app.workspace.revealLeaf(existingLeaves[0]);
			return;
		}

		// Create new view in right sidebar
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({
				type: TIMELINE_VIEW_TYPE,
				active: true,
			});
			this.app.workspace.revealLeaf(leaf);
		}
	}

	/**
	 * Toggle favorite status for current file
	 */
	toggleCurrentFileFavorite(): void {
		const activeFile = this.app.workspace.getActiveFile();

		if (!activeFile) {
			new Notice('No active file');
			return;
		}

		this.toggleFileFavorite(activeFile);
	}

	/**
	 * Toggle favorite status for a file
	 */
	toggleFileFavorite(file: TFile): void {
		const heatData = this.heatManager.getHeatData(file.path);
		const isFavorite = heatData?.metrics.isFavorite || false;

		// Toggle favorite
		this.heatManager.setFavorite(file.path, !isFavorite);

		// Save data
		void this.dataStore.save();

		// Force visual update
		if (this.visualRenderer) {
			this.visualRenderer.forceUpdate();
		}

		// Show notification
		const fileName = file.basename;
		if (!isFavorite) {
			new Notice(`★ "${fileName}" marked as favorite`);
		} else {
			new Notice(`☆ "${fileName}" removed from favorites`);
		}
	}

	/**
	 * Reset heat for current file
	 */
	resetCurrentFileHeat(): void {
		const activeFile = this.app.workspace.getActiveFile();

		if (!activeFile) {
			new Notice('No active file');
			return;
		}

		const fileName = activeFile.basename;
		this.heatManager.resetFileHeat(activeFile.path);
		void this.dataStore.save();

		if (this.visualRenderer) {
			this.visualRenderer.forceUpdate();
		}

		new Notice(`Heat reset for "${fileName}"`);
	}

	/**
	 * Show heat info for current file
	 */
	showCurrentFileHeatInfo(): void {
		const activeFile = this.app.workspace.getActiveFile();

		if (!activeFile) {
			new Notice('No active file');
			return;
		}

		const heatData = this.heatManager.getHeatData(activeFile.path);

		if (!heatData) {
			new Notice(`"${activeFile.basename}" has no heat data yet`);
			return;
		}

		const fileName = activeFile.basename;
		const heatLevel = this.heatManager.getHeatLevel(heatData.heatScore);
		const favorite = heatData.metrics.isFavorite ? '★' : '';

		const message = `${favorite}"${fileName}"
Heat: ${heatData.heatScore.toFixed(1)} (${heatLevel})
Accessed: ${heatData.metrics.accessCount}x
Edited: ${heatData.metrics.editCount}x
Last accessed: ${new Date(heatData.metrics.lastAccessed).toLocaleDateString()}`;

		new Notice(message, 8000);
	}

	/**
	 * Cycle through visualization modes
	 */
	async cycleVisualizationMode(): Promise<void> {
		const modes: VisualizationMode[] = [
			VisualizationMode.STANDARD,
			VisualizationMode.EMERGENCE,
			VisualizationMode.ANALYTICAL
		];
		const currentIndex = modes.indexOf(this.settings.visualizationMode);
		const nextIndex = (currentIndex + 1) % modes.length;
		const nextMode = modes[nextIndex];

		this.settings.visualizationMode = nextMode;
		await this.saveSettings();

		const modeNames: Record<VisualizationMode, string> = {
			[VisualizationMode.STANDARD]: 'Standard',
			[VisualizationMode.EMERGENCE]: 'Emergence',
			[VisualizationMode.ANALYTICAL]: 'Analytical'
		};

		new Notice(`Visualization mode: ${modeNames[nextMode]}`);
	}

	/**
	 * Toggle visual effects on/off
	 */
	async toggleVisualEffects(): Promise<void> {
		const currentState = this.settings.applyToFileExplorer && this.settings.applyToTabs;

		this.settings.applyToFileExplorer = !currentState;
		this.settings.applyToTabs = !currentState;
		await this.saveSettings();

		if (!currentState) {
			new Notice('Visual effects enabled');
		} else {
			new Notice('Visual effects disabled');
		}
	}

	/**
	 * Get ExportImportManager instance (for settings UI)
	 */
	getExportImportManager(): ExportImportManager {
		return this.exportImportManager;
	}

	/**
	 * Get PropertyStorageManager instance (for settings UI)
	 */
	getPropertyStorageManager(): PropertyStorageManager {
		return this.propertyStorageManager;
	}

	/**
	 * Add context menu items for a file
	 */
	addFileMenuItems(menu: Menu, file: TFile): void {
		// Only add menu items for markdown files
		if (file.extension !== 'md') {
			return;
		}

		const heatData = this.heatManager.getHeatData(file.path);
		const isFavorite = heatData?.metrics.isFavorite || false;
		const isExcluded = this.exclusionManager.isExcluded(file.path);

		// Add favorite toggle
		menu.addItem((item) => {
			item
				.setTitle(isFavorite ? '☆ Remove from favorites' : '★ Mark as favorite')
				.setIcon('star')
				.onClick(() => {
					this.toggleFileFavorite(file);
				});
		});

		// Add exclusion toggle
		menu.addItem((item) => {
			item
				.setTitle(isExcluded ? 'Include in Ember tracking' : 'Exclude from Ember tracking')
				.setIcon(isExcluded ? 'eye' : 'eye-off')
				.onClick(() => {
					if (isExcluded) {
						// Remove exclusion
						this.exclusionManager.removeExclusion('path', file.path);
						new Notice(`"${file.basename}" is now tracked by Ember`);
					} else {
						// Add exclusion
						this.exclusionManager.quickExclude(file.path);
						new Notice(`"${file.basename}" excluded from Ember`);
					}
					// Save settings
					this.saveSettings();
					// Force visual update
					if (this.visualRenderer) {
						this.visualRenderer.forceUpdate();
					}
				});
		});

		// Add heat reset option if file is tracked
		if (heatData) {
			menu.addItem((item) => {
				item
					.setTitle('Reset Ember heat')
					.setIcon('thermometer')
					.onClick(() => {
						this.heatManager.resetFileHeat(file.path);
						void this.dataStore.save();
						new Notice(`Heat reset for "${file.basename}"`);
						// Force visual update
						if (this.visualRenderer) {
							this.visualRenderer.forceUpdate();
						}
					});
			});
		}
	}
}
