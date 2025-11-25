import { App, PluginSettingTab, Setting, Notice, Modal } from 'obsidian';
import EmberPlugin from './main';
import { StorageMode, VisualizationMode } from './types';

/**
 * EmberSettingTab
 *
 * Comprehensive settings interface for the Ember plugin
 * Organized into sections:
 * - Storage Settings
 * - Heat Calculation Settings
 * - Decay Settings
 * - Visualization Settings
 * - Exclusion Management
 * - UI Customization
 * - Advanced Settings
 */
export class EmberSettingTab extends PluginSettingTab {
	plugin: EmberPlugin;

	constructor(app: App, plugin: EmberPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('General')
			.setHeading();
		containerEl.createEl('p', {
			text: 'Configure heat tracking, visualization, and behavior.',
			cls: 'setting-item-description'
		});

		// Storage Settings
		this.addStorageSettings(containerEl);

		// Property Storage (Phase 3)
		this.addPropertyStorageSettings(containerEl);

		// Heat Calculation Settings
		this.addHeatCalculationSettings(containerEl);

		// Decay Settings
		this.addDecaySettings(containerEl);

		// Visualization Settings
		this.addVisualizationSettings(containerEl);

		// Exclusion Management
		this.addExclusionSettings(containerEl);

		// UI Customization
		this.addUISettings(containerEl);

		// Data Archival (Phase 3)
		this.addArchivalSettings(containerEl);

		// Export/Import (Phase 3)
		this.addExportImportSettings(containerEl);

		// Advanced Settings
		this.addAdvancedSettings(containerEl);
	}

	/**
	 * Storage Settings Section
	 */
	private addStorageSettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Storage')
			.setHeading();

		new Setting(containerEl)
			.setName('Storage mode')
			.setDesc('Where to store heat data (JSON recommended)')
			.addDropdown(dropdown => dropdown
				.addOptions({
					[StorageMode.JSON_ONLY]: 'JSON only (recommended)',
					[StorageMode.PROPERTY_ONLY]: 'Frontmatter properties only',
					[StorageMode.BOTH]: 'Both JSON and properties'
				})
				.setValue(this.plugin.settings.storageMode)
				.onChange((value) => {
					this.plugin.settings.storageMode = value as StorageMode;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Property name')
			.setDesc('Name of frontmatter property (if using property storage)')
			.addText(text => text
				.setPlaceholder('ember-heat')
				.setValue(this.plugin.settings.propertyName)
				.onChange((value) => {
					this.plugin.settings.propertyName = value || 'ember-heat';
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Number of backups')
			.setDesc('How many backup files to keep (1-10)')
			.addSlider(slider => slider
				.setLimits(1, 10, 1)
				.setValue(this.plugin.settings.backupCount)
				.setDynamicTooltip()
				.onChange((value) => {
					this.plugin.settings.backupCount = value;
					void this.plugin.saveSettings();
				})
			);
	}

	/**
	 * Property Storage Settings Section (Phase 3)
	 */
	private addPropertyStorageSettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Property storage & dataview integration')
			.setHeading();

		containerEl.createEl('p', {
			text: 'Store heat data in frontmatter properties for dataview queries. Manage migration and sync between JSON and properties.',
			cls: 'setting-item-description'
		});

		// Migration Tools
		new Setting(containerEl)
			.setName('Migration tools')
			.setHeading();

		new Setting(containerEl)
			.setName('Migrate to properties')
			.setDesc('Write all heat data to frontmatter properties')
			.addButton(button => button
				.setButtonText('Migrate all')
				.setIcon('database')
				.onClick(() => {
					const propManager = this.plugin.getPropertyStorageManager();
					void propManager.writeAllToProperties(true).then(() => {
						this.display(); // Refresh display
					});
				})
			);

		new Setting(containerEl)
			.setName('Remove all properties')
			.setDesc('Remove heat properties from all files (keeps JSON data)')
			.addButton(button => button
				.setButtonText('Remove all')
				.setIcon('trash')
				.setWarning()
				.onClick(() => {
					const propManager = this.plugin.getPropertyStorageManager();
					void propManager.removeAllProperties(true).then(() => {
						this.display(); // Refresh display
					});
				})
			);

		// Conflict Resolution
		new Setting(containerEl)
			.setName('Conflict resolution')
			.setHeading();

		containerEl.createEl('p', {
			text: 'Resolve differences between JSON and property storage.',
			cls: 'setting-item-description'
		});

		let conflictStrategy: 'json-wins' | 'property-wins' | 'higher-wins' = 'json-wins';

		new Setting(containerEl)
			.setName('Conflict strategy')
			.setDesc('How to resolve conflicts between JSON and properties')
			.addDropdown(dropdown => dropdown
				.addOption('json-wins', 'JSON wins (trust JSON data)')
				.addOption('property-wins', 'Property wins (trust properties)')
				.addOption('higher-wins', 'Higher wins (use max value)')
				.setValue(conflictStrategy)
				.onChange((value: 'json-wins' | 'property-wins' | 'higher-wins') => {
					conflictStrategy = value;
				})
			);

		new Setting(containerEl)
			.setName('Resolve conflicts')
			.setDesc('Apply conflict resolution strategy')
			.addButton(button => button
				.setButtonText('Resolve')
				.setIcon('check-circle')
				.onClick(() => {
					const propManager = this.plugin.getPropertyStorageManager();
					void propManager.resolveConflicts(conflictStrategy).then((stats) => {
						new Notice(`Ember: ${stats.conflicts} conflicts found, ${stats.resolved} resolved.`);
						this.display(); // Refresh display
					});
				})
			);

		// Dataview Query Examples
		new Setting(containerEl)
			.setName('Dataview query examples')
			.setHeading();

		const examplesDiv = containerEl.createDiv({ cls: 'ember-dataview-examples' });
		examplesDiv.createEl('p', {
			text: 'Once properties are enabled, you can query heat data with dataview:',
			cls: 'setting-item-description'
		});

		const codeBlock1 = examplesDiv.createEl('pre');
		codeBlock1.createEl('code', {
			text: `TABLE ${this.plugin.settings.propertyName} as "Heat"\nWHERE ${this.plugin.settings.propertyName} > 50\nSORT ${this.plugin.settings.propertyName} DESC\nLIMIT 10`
		});

		examplesDiv.createEl('p', {
			text: 'Show files with heat above 70:',
			cls: 'setting-item-description'
		});

		const codeBlock2 = examplesDiv.createEl('pre');
		codeBlock2.createEl('code', {
			text: `LIST\nWHERE ${this.plugin.settings.propertyName} > 70`
		});
	}

	/**
	 * Heat Calculation Settings Section
	 */
	private addHeatCalculationSettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Heat calculation')
			.setHeading();

		new Setting(containerEl)
			.setName('Metric weights')
			.setHeading();
		containerEl.createEl('p', {
			text: 'Adjust how much each metric contributes to total heat (should sum to 100)',
			cls: 'setting-item-description'
		});

		new Setting(containerEl)
			.setName('Frequency weight')
			.setDesc('Weight of access count (0-100)')
			.addSlider(slider => slider
				.setLimits(0, 100, 5)
				.setValue(this.plugin.settings.metricWeights.frequency)
				.setDynamicTooltip()
				.onChange((value) => {
					this.plugin.settings.metricWeights.frequency = value;
					void this.plugin.saveSettings();
					this.updateWeightDisplay();
				})
			);

		new Setting(containerEl)
			.setName('Recency weight')
			.setDesc('Weight of recent access (0-100)')
			.addSlider(slider => slider
				.setLimits(0, 100, 5)
				.setValue(this.plugin.settings.metricWeights.recency)
				.setDynamicTooltip()
				.onChange((value) => {
					this.plugin.settings.metricWeights.recency = value;
					void this.plugin.saveSettings();
					this.updateWeightDisplay();
				})
			);

		new Setting(containerEl)
			.setName('Succession weight')
			.setDesc('Weight of quick returns (0-100)')
			.addSlider(slider => slider
				.setLimits(0, 100, 5)
				.setValue(this.plugin.settings.metricWeights.succession)
				.setDynamicTooltip()
				.onChange((value) => {
					this.plugin.settings.metricWeights.succession = value;
					void this.plugin.saveSettings();
					this.updateWeightDisplay();
				})
			);

		new Setting(containerEl)
			.setName('Duration weight')
			.setDesc('Weight of time spent in file (0-100)')
			.addSlider(slider => slider
				.setLimits(0, 100, 5)
				.setValue(this.plugin.settings.metricWeights.duration)
				.setDynamicTooltip()
				.onChange((value) => {
					this.plugin.settings.metricWeights.duration = value;
					void this.plugin.saveSettings();
					this.updateWeightDisplay();
				})
			);

		new Setting(containerEl)
			.setName('Edit weight')
			.setDesc('Weight of edit count (0-100)')
			.addSlider(slider => slider
				.setLimits(0, 100, 5)
				.setValue(this.plugin.settings.metricWeights.edits)
				.setDynamicTooltip()
				.onChange((value) => {
					this.plugin.settings.metricWeights.edits = value;
					void this.plugin.saveSettings();
					this.updateWeightDisplay();
				})
			);

		// Weight sum display
		const weightSumEl = containerEl.createEl('div', {
			cls: 'ember-weight-sum',
			text: this.getWeightSumText()
		});
		weightSumEl.style.padding = '8px';
		weightSumEl.style.marginBottom = '16px';
		weightSumEl.style.borderRadius = '4px';
		weightSumEl.style.backgroundColor = 'var(--background-secondary)';

		new Setting(containerEl)
			.setName('Heat increments')
			.setHeading();

		new Setting(containerEl)
			.setName('File open increment')
			.setDesc('Heat added when opening a file')
			.addSlider(slider => slider
				.setLimits(1, 20, 1)
				.setValue(this.plugin.settings.heatIncrements.fileOpen)
				.setDynamicTooltip()
				.onChange((value) => {
					this.plugin.settings.heatIncrements.fileOpen = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('File edit increment')
			.setDesc('Heat added when editing a file')
			.addSlider(slider => slider
				.setLimits(1, 30, 1)
				.setValue(this.plugin.settings.heatIncrements.fileEdit)
				.setDynamicTooltip()
				.onChange((value) => {
					this.plugin.settings.heatIncrements.fileEdit = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Quick return increment')
			.setDesc('Heat added for quick returns to same file')
			.addSlider(slider => slider
				.setLimits(1, 10, 1)
				.setValue(this.plugin.settings.heatIncrements.quickReturn)
				.setDynamicTooltip()
				.onChange((value) => {
					this.plugin.settings.heatIncrements.quickReturn = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Manual boost value')
			.setDesc('Heat boost for favorited files')
			.addSlider(slider => slider
				.setLimits(10, 100, 5)
				.setValue(this.plugin.settings.manualBoostValue)
				.setDynamicTooltip()
				.onChange((value) => {
					this.plugin.settings.manualBoostValue = value;
					void this.plugin.saveSettings();
				})
			);
	}

	/**
	 * Decay Settings Section
	 */
	private addDecaySettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Decay')
			.setHeading();

		new Setting(containerEl)
			.setName('Decay interval')
			.setDesc('Minutes between decay cycles')
			.addSlider(slider => slider
				.setLimits(5, 120, 5)
				.setValue(this.plugin.settings.decayInterval)
				.setDynamicTooltip()
				.onChange((value) => {
					this.plugin.settings.decayInterval = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Decay rate')
			.setDesc('Percentage of heat to remove per cycle (1-20%)')
			.addSlider(slider => slider
				.setLimits(1, 20, 1)
				.setValue(this.plugin.settings.decayRate)
				.setDynamicTooltip()
				.onChange((value) => {
					this.plugin.settings.decayRate = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Differential decay')
			.setDesc('High heat files decay faster (natural cooling)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.differentialDecay)
				.onChange((value) => {
					this.plugin.settings.differentialDecay = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Pause decay for favorites')
			.setDesc('Favorited files don\'t lose heat over time')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.pauseDecayForFavorites)
				.onChange((value) => {
					this.plugin.settings.pauseDecayForFavorites = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Calculate decay while closed')
			.setDesc('Apply decay for time Obsidian was closed')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.calculateDecayWhileClosed)
				.onChange((value) => {
					this.plugin.settings.calculateDecayWhileClosed = value;
					void this.plugin.saveSettings();
				})
			);
	}

	/**
	 * Visualization Settings Section
	 */
	private addVisualizationSettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Visualization')
			.setHeading();

		new Setting(containerEl)
			.setName('Visualization mode')
			.setDesc('How to display heat visually')
			.addDropdown(dropdown => dropdown
				.addOptions({
					[VisualizationMode.STANDARD]: 'Standard (hot/cold)',
					[VisualizationMode.EMERGENCE]: 'Emergence (full gradient)',
					[VisualizationMode.ANALYTICAL]: 'Analytical (phase 3)'
				})
				.setValue(this.plugin.settings.visualizationMode)
				.onChange((value) => {
					this.plugin.settings.visualizationMode = value as VisualizationMode;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Enable animations')
			.setDesc('Smooth transitions and pulse effects')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableAnimations)
				.onChange((value) => {
					this.plugin.settings.enableAnimations = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Standard mode')
			.setHeading();

		new Setting(containerEl)
			.setName('Hot color')
			.setDesc('Color for hot files (hex color)')
			.addText(text => text
				.setPlaceholder('#dc2626')
				.setValue(this.plugin.settings.standardMode.hotColor)
				.onChange((value) => {
					this.plugin.settings.standardMode.hotColor = value || '#dc2626';
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Cold color')
			.setDesc('Color for cold files (hex color)')
			.addText(text => text
				.setPlaceholder('#3b82f6')
				.setValue(this.plugin.settings.standardMode.coldColor)
				.onChange((value) => {
					this.plugin.settings.standardMode.coldColor = value || '#3b82f6';
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Hot threshold')
			.setDesc('Top X% of files are "hot" (1-50%)')
			.addSlider(slider => slider
				.setLimits(1, 50, 1)
				.setValue(this.plugin.settings.standardMode.hotThreshold)
				.setDynamicTooltip()
				.onChange((value) => {
					this.plugin.settings.standardMode.hotThreshold = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Cold threshold')
			.setDesc('Bottom X% of files are "cold" (1-50%)')
			.addSlider(slider => slider
				.setLimits(1, 50, 1)
				.setValue(this.plugin.settings.standardMode.coldThreshold)
				.setDynamicTooltip()
				.onChange((value) => {
					this.plugin.settings.standardMode.coldThreshold = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Apply to file explorer')
			.setDesc('Show heat colors in file explorer')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.applyToFileExplorer)
				.onChange((value) => {
					this.plugin.settings.applyToFileExplorer = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Apply to tabs')
			.setDesc('Show heat colors on tab headers')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.applyToTabs)
				.onChange((value) => {
					this.plugin.settings.applyToTabs = value;
					void this.plugin.saveSettings();
				})
			);
	}

	/**
	 * Exclusion Settings Section
	 */
	private addExclusionSettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Exclusions')
			.setHeading();

		containerEl.createEl('p', {
			text: 'Exclude files or folders from heat tracking. Right-click files to quickly exclude them.',
			cls: 'setting-item-description'
		});

		// Path Exclusions
		new Setting(containerEl)
			.setName('Path exclusions')
			.setHeading();
		this.addExclusionList(containerEl, 'path');

		// Glob Pattern Exclusions
		new Setting(containerEl)
			.setName('Glob pattern exclusions')
			.setHeading();
		containerEl.createEl('p', {
			text: 'Examples: *.md, drafts/**, **/*.tmp',
			cls: 'setting-item-description'
		});
		this.addExclusionList(containerEl, 'glob');

		// Tag Exclusions
		new Setting(containerEl)
			.setName('Tag exclusions')
			.setHeading();
		containerEl.createEl('p', {
			text: 'Exclude files with specific frontmatter tags',
			cls: 'setting-item-description'
		});
		this.addExclusionList(containerEl, 'tag');

		// Add new exclusion button
		new Setting(containerEl)
			.setName('Add new exclusion')
			.setDesc('Add a new exclusion rule')
			.addButton(button => button
				.setButtonText('Add path')
				.onClick(() => this.addNewExclusion(containerEl, 'path'))
			)
			.addButton(button => button
				.setButtonText('Add glob')
				.onClick(() => this.addNewExclusion(containerEl, 'glob'))
			)
			.addButton(button => button
				.setButtonText('Add tag')
				.onClick(() => this.addNewExclusion(containerEl, 'tag'))
			);
	}

	/**
	 * Add exclusion list for a specific type
	 */
	private addExclusionList(containerEl: HTMLElement, type: 'path' | 'glob' | 'tag'): void {
		const rules = this.plugin.settings.exclusionRules.filter(r => r.type === type);

		const listContainer = containerEl.createEl('div', {
			cls: `ember-exclusion-list-${type}`
		});

		if (rules.length === 0) {
			listContainer.createEl('p', {
				text: `No ${type} exclusions configured.`,
				cls: 'setting-item-description'
			});
			return;
		}

		rules.forEach((rule, index) => {
			new Setting(listContainer)
				.setName(rule.pattern)
				.setClass('ember-exclusion-item')
				.addToggle(toggle => toggle
					.setValue(rule.enabled)
					.setTooltip(rule.enabled ? 'Enabled' : 'Disabled')
					.onChange((value) => {
						rule.enabled = value;
						void this.plugin.saveSettings();
					})
				)
				.addButton(button => button
					.setIcon('trash')
					.setTooltip('Delete')
					.onClick(() => {
						this.plugin.settings.exclusionRules = this.plugin.settings.exclusionRules.filter(r => r !== rule);
						void this.plugin.saveSettings().then(() => {
							this.display(); // Refresh settings display
						});
					})
				);
		});
	}

	/**
	 * Add a new exclusion rule
	 */
	private addNewExclusion(containerEl: HTMLElement, type: 'path' | 'glob' | 'tag'): void {
		const modal = new ExclusionModal(this.app, type, async (pattern: string) => {
			if (pattern) {
				this.plugin.settings.exclusionRules.push({
					type,
					pattern,
					enabled: true
				});
				await this.plugin.saveSettings();
				this.display(); // Refresh settings display
			}
		});
		modal.open();
	}

	/**
	 * UI Customization Settings Section
	 */
	private addUISettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('UI customization')
			.setHeading();

		new Setting(containerEl)
			.setName('Show status bar')
			.setDesc('Display heat info in status bar')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showStatusBar)
				.onChange((value) => {
					this.plugin.settings.showStatusBar = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Show ribbon icon')
			.setDesc('Display Ember icon in left ribbon')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showRibbonIcon)
				.onChange((value) => {
					this.plugin.settings.showRibbonIcon = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Popular files count')
			.setDesc('Number of files to show in popular Files panel')
			.addSlider(slider => slider
				.setLimits(5, 50, 5)
				.setValue(this.plugin.settings.popularFilesCount)
				.setDynamicTooltip()
				.onChange((value) => {
					this.plugin.settings.popularFilesCount = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Hot files time window')
			.setDesc('Days to look back for recently active files (1-30)')
			.addSlider(slider => slider
				.setLimits(1, 30, 1)
				.setValue(this.plugin.settings.hotFilesTimeWindow)
				.setDynamicTooltip()
				.onChange((value) => {
					this.plugin.settings.hotFilesTimeWindow = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Visual opacity')
			.setDesc('Opacity of heat indicators (10-100%)')
			.addSlider(slider => slider
				.setLimits(10, 100, 5)
				.setValue(this.plugin.settings.opacity)
				.setDynamicTooltip()
				.onChange((value) => {
					this.plugin.settings.opacity = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Enable context menus')
			.setDesc('Add Ember actions to right-click menus')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableContextMenus)
				.onChange((value) => {
					this.plugin.settings.enableContextMenus = value;
					void this.plugin.saveSettings();
				})
			);
	}

	/**
	 * Data Archival Settings Section (Phase 3)
	 */
	private addArchivalSettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Data archival & history')
			.setHeading();

		containerEl.createEl('p', {
			text: 'Periodic snapshots enable historical heat tracking, timeline scrubbing, and trend analysis.',
			cls: 'setting-item-description'
		});

		new Setting(containerEl)
			.setName('Enable archival system')
			.setDesc('Create periodic snapshots of heat data for historical analysis')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.archival.enabled)
				.onChange((value) => {
					this.plugin.settings.archival.enabled = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Snapshot frequency')
			.setDesc('How often to create automatic snapshots')
			.addDropdown(dropdown => dropdown
				.addOption('hourly', 'Hourly')
				.addOption('daily', 'Daily')
				.addOption('weekly', 'Weekly')
				.setValue(this.plugin.settings.archival.snapshotFrequency)
				.onChange((value: 'hourly' | 'daily' | 'weekly') => {
					this.plugin.settings.archival.snapshotFrequency = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Retention period')
			.setDesc('Days to keep snapshots before automatic cleanup (7-365)')
			.addSlider(slider => slider
				.setLimits(7, 365, 7)
				.setValue(this.plugin.settings.archival.retentionDays)
				.setDynamicTooltip()
				.onChange((value) => {
					this.plugin.settings.archival.retentionDays = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Maximum snapshots')
			.setDesc('Maximum number of snapshots to keep (10-500)')
			.addSlider(slider => slider
				.setLimits(10, 500, 10)
				.setValue(this.plugin.settings.archival.maxSnapshots)
				.setDynamicTooltip()
				.onChange((value) => {
					this.plugin.settings.archival.maxSnapshots = value;
					void this.plugin.saveSettings();
				})
			);

		// Add snapshot statistics display
		new Setting(containerEl)
			.setName('Snapshot statistics')
			.setHeading();
		const statsDiv = containerEl.createDiv({ cls: 'ember-archival-stats' });

		// Get statistics from archival manager
		const plugin = this.plugin as unknown as { archivalManager?: { getStatistics: () => { totalSnapshots: number; oldestSnapshot: number | null; newestSnapshot: number | null; totalSize: number; averageFileCount: number } } };
		if (plugin.archivalManager) {
			const stats = plugin.archivalManager.getStatistics();
			const statsGrid = statsDiv.createDiv({ cls: 'ember-stats-grid' });

			this.createStatItem(statsGrid, 'Total snapshots', stats.totalSnapshots.toString());
			this.createStatItem(statsGrid, 'Oldest snapshot', this.formatDate(stats.oldestSnapshot));
			this.createStatItem(statsGrid, 'Newest snapshot', this.formatDate(stats.newestSnapshot));
			this.createStatItem(statsGrid, 'Storage size', this.formatBytes(stats.totalSize));
		} else {
			statsDiv.createEl('p', {
				text: 'Archival manager not initialized. Enable the archival system to see statistics.',
				cls: 'setting-item-description'
			});
		}
	}

	/**
	 * Helper: Create a stat item for display
	 */
	private createStatItem(container: HTMLElement, label: string, value: string): void {
		const item = container.createDiv({ cls: 'ember-stat-item' });
		item.createEl('span', { text: label, cls: 'ember-stat-label' });
		item.createEl('span', { text: value, cls: 'ember-stat-value' });
	}

	/**
	 * Helper: Format date for display
	 */
	private formatDate(timestamp: number | null): string {
		if (!timestamp || timestamp === 0) return 'Never';
		const date = new Date(timestamp);
		return date.toLocaleString();
	}

	/**
	 * Helper: Format bytes to human-readable string
	 */
	private formatBytes(bytes: number): string {
		if (bytes === 0) return '0 bytes';
		const k = 1024;
		const sizes = ['bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
	}

	/**
	 * Export/Import Settings Section (Phase 3)
	 */
	private addExportImportSettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Export & import')
			.setHeading();

		containerEl.createEl('p', {
			text: 'Export your heat data for backup or transfer to another vault. Import data from previous exports.',
			cls: 'setting-item-description'
		});

		// Export JSON Button
		new Setting(containerEl)
			.setName('Export to JSON')
			.setDesc('Download all heat data as JSON file (includes metadata)')
			.addButton(button => button
				.setButtonText('Export JSON')
				.setIcon('download')
				.onClick(() => {
					const exportManager = this.plugin.getExportImportManager();
					exportManager.exportJSONToFile();
				})
			);

		// Export CSV Button
		new Setting(containerEl)
			.setName('Export to CSV')
			.setDesc('Download heat data as CSV file (for spreadsheet analysis)')
			.addButton(button => button
				.setButtonText('Export CSV')
				.setIcon('table')
				.onClick(() => {
					const exportManager = this.plugin.getExportImportManager();
					exportManager.exportCSVToFile();
				})
			);

		// Import Section
		new Setting(containerEl)
			.setName('Import heat data')
			.setHeading();

		// Import Strategy Selector
		let importStrategy: 'replace' | 'merge' | 'skip' = 'merge';
		let createBackup = true;

		new Setting(containerEl)
			.setName('Import strategy')
			.setDesc('How to handle existing data when importing')
			.addDropdown(dropdown => dropdown
				.addOption('merge', 'Merge (update higher heat, add new)')
				.addOption('replace', 'Replace (clear all, import fresh)')
				.addOption('skip', 'Skip (only add new files)')
				.setValue(importStrategy)
				.onChange((value: 'replace' | 'merge' | 'skip') => {
					importStrategy = value;
				})
			);

		new Setting(containerEl)
			.setName('Create backup before import')
			.setDesc('Automatically create a backup before importing (recommended)')
			.addToggle(toggle => toggle
				.setValue(createBackup)
				.onChange((value) => {
					createBackup = value;
				})
			);

		// Import Button
		new Setting(containerEl)
			.setName('Import from JSON')
			.setDesc('Select a JSON file to import heat data')
			.addButton(button => button
				.setButtonText('Import JSON')
				.setIcon('upload')
				.onClick(() => {
					// Create file input element
					const input = document.createElement('input');
					input.type = 'file';
					input.accept = '.json';
					input.onchange = (e: Event) => {
						const target = e.target as HTMLInputElement;
						const file = target.files?.[0];
						if (file) {
							const reader = new FileReader();
							reader.onload = (event) => {
								const jsonString = event.target?.result as string;
								const exportManager = this.plugin.getExportImportManager();
								void exportManager.importFromJSON(
									jsonString,
									importStrategy,
									createBackup
								).then((result) => {
									if (result.success) {
										new Notice(result.message);
										// Refresh the display
										this.display();
									} else {
										new Notice(`Import failed: ${result.message}`);
									}
								});
							};
							reader.readAsText(file);
						}
					};
					input.click();
				})
			);
	}

	/**
	 * Advanced Settings Section
	 */
	private addAdvancedSettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Advanced')
			.setHeading();

		new Setting(containerEl)
			.setName('Debug logging')
			.setDesc('Enable console logging for debugging')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.debugLogging)
				.onChange((value) => {
					this.plugin.settings.debugLogging = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Update debounce')
			.setDesc('Milliseconds to wait before saving (1000-10000)')
			.addSlider(slider => slider
				.setLimits(1000, 10000, 1000)
				.setValue(this.plugin.settings.updateDebounce)
				.setDynamicTooltip()
				.onChange((value) => {
					this.plugin.settings.updateDebounce = value;
					void this.plugin.saveSettings();
				})
			);

		// Reset button
		new Setting(containerEl)
			.setName('Reset to defaults')
			.setDesc('Reset all settings to default values')
			.addButton(button => button
				.setButtonText('Reset')
				.setWarning()
				.onClick(() => {
					// TODO: Implement reset functionality
					new Notice('Reset functionality will be added in phase 1.13');
				})
			);
	}

	/**
	 * Get text showing sum of metric weights
	 */
	private getWeightSumText(): string {
		const sum = Object.values(this.plugin.settings.metricWeights).reduce((a, b) => a + b, 0);
		return `Total weight: ${sum}% ${sum === 100 ? '✓' : '(should be 100)'}`;
	}

	/**
	 * Update the weight sum display
	 */
	private updateWeightDisplay(): void {
		const weightSumEl = this.containerEl.querySelector('.ember-weight-sum');
		if (weightSumEl) {
			weightSumEl.textContent = this.getWeightSumText();
		}
	}
}

/**
 * Modal for adding new exclusion rules
 */
class ExclusionModal extends Modal {
	private type: 'path' | 'glob' | 'tag';
	private onSubmit: (pattern: string) => void;

	constructor(app: App, type: 'path' | 'glob' | 'tag', onSubmit: (pattern: string) => void) {
		super(app);
		this.type = type;
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		new Setting(contentEl)
			.setName(`Add ${this.type} exclusion`)
			.setHeading();

		let inputEl: HTMLInputElement;

		new Setting(contentEl)
			.setName('Pattern')
			.setDesc(this.getDescription())
			.addText(text => {
				inputEl = text.inputEl;
				text
					.setPlaceholder(this.getPlaceholder())
					.onChange(value => {
						// Store value for submit
					});
			});

		new Setting(contentEl)
			.addButton(button => button
				.setButtonText('Add')
				.setCta()
				.onClick(() => {
					const pattern = inputEl.value.trim();
					if (pattern) {
						this.onSubmit(pattern);
						this.close();
					} else {
						new Notice('Please enter a pattern');
					}
				})
			)
			.addButton(button => button
				.setButtonText('Cancel')
				.onClick(() => {
					this.close();
				})
			);
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	private getDescription(): string {
		switch (this.type) {
			case 'path':
				return 'Enter exact file path or folder path (e.g., "folder/file.md" or "folder/")';
			case 'glob':
				return 'Enter glob pattern (e.g., "*.md", "drafts/**", "**/*.tmp")';
			case 'tag':
				return 'Enter tag name (with or without #)';
		}
	}

	private getPlaceholder(): string {
		switch (this.type) {
			case 'path':
				return 'folder/subfolder/';
			case 'glob':
				return '**/*.tmp';
			case 'tag':
				return 'draft';
		}
	}
}
