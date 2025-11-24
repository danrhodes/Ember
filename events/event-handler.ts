import { Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import { EmberSettings } from '../types';
import { MetricsManager } from '../managers/metrics-manager';
import { ExclusionManager } from '../managers/exclusion-manager';
import { DataStore } from '../storage/data-store';

/**
 * EventHandler
 *
 * Responsible for:
 * - Listening to file open events
 * - Listening to file modification events
 * - Tracking active file sessions
 * - Debouncing rapid events
 * - Filtering excluded files
 * - Triggering metrics updates
 */
export class EventHandler {
	private plugin: Plugin;
	private settings: EmberSettings;
	private metricsManager: MetricsManager;
	private exclusionManager: ExclusionManager;
	private dataStore: DataStore;

	// Debouncing state
	private eventQueue: Map<string, number> = new Map();
	private debounceTimer: number | null = null;
	private readonly DEBOUNCE_MS: number;

	// Session tracking
	private currentFile: string | null = null;
	private activeLeaf: WorkspaceLeaf | null = null;

	constructor(
		plugin: Plugin,
		settings: EmberSettings,
		metricsManager: MetricsManager,
		exclusionManager: ExclusionManager,
		dataStore: DataStore
	) {
		this.plugin = plugin;
		this.settings = settings;
		this.metricsManager = metricsManager;
		this.exclusionManager = exclusionManager;
		this.dataStore = dataStore;
		this.DEBOUNCE_MS = settings.updateDebounce;
	}

	/**
	 * Register all event listeners
	 */
	registerEvents(): void {
		// File open event
		this.plugin.registerEvent(
			this.plugin.app.workspace.on('file-open', (file: TFile | null) => {
				if (file) {
					this.onFileOpen(file);
				}
			})
		);

		// File modification event
		this.plugin.registerEvent(
			this.plugin.app.vault.on('modify', (file) => {
				if (file instanceof TFile) {
					this.onFileModify(file);
				}
			})
		);

		// Active leaf change (for session tracking)
		this.plugin.registerEvent(
			this.plugin.app.workspace.on('active-leaf-change', (leaf: WorkspaceLeaf | null) => {
				this.onActiveLeafChange(leaf);
			})
		);

		// File deletion (cleanup heat data)
		this.plugin.registerEvent(
			this.plugin.app.vault.on('delete', (file) => {
				if (file instanceof TFile) {
					this.onFileDelete(file);
				}
			})
		);

		// File rename (update heat data path)
		this.plugin.registerEvent(
			this.plugin.app.vault.on('rename', (file, oldPath) => {
				if (file instanceof TFile) {
					this.onFileRename(file, oldPath);
				}
			})
		);

	}

	/**
	 * Handle file open event
	 * @param file - The opened file
	 */
	private onFileOpen(file: TFile): void {
		const filePath = file.path;

		// Check if file should be excluded
		if (this.exclusionManager.isExcluded(filePath)) {
			return;
		}

		// Check file type (only track markdown files by default)
		if (!this.shouldTrackFile(file)) {
			return;
		}

		// Add to event queue
		this.queueEvent(filePath, 'open');
	}

	/**
	 * Handle file modification event
	 * @param file - The modified file
	 */
	private onFileModify(file: TFile): void {
		const filePath = file.path;

		// Check if file should be excluded
		if (this.exclusionManager.isExcluded(filePath)) {
			return;
		}

		// Check file type
		if (!this.shouldTrackFile(file)) {
			return;
		}

		// Add to event queue
		this.queueEvent(filePath, 'modify');
	}

	/**
	 * Handle active leaf change (for session tracking)
	 * @param leaf - The new active leaf
	 */
	private onActiveLeafChange(leaf: WorkspaceLeaf | null): void {
		// Close session for previous file
		if (this.currentFile) {
			this.metricsManager.onFileClose(this.currentFile);
			this.currentFile = null;
		}

		// Start session for new file
		if (leaf) {
			const view = leaf.view;
			if (view.getViewType() === 'markdown') {
				const file = (view as unknown as Record<string, unknown>).file;
				if (file instanceof TFile) {
					this.currentFile = file.path;
				}
			}
		}

		this.activeLeaf = leaf;
	}

	/**
	 * Handle file deletion
	 * @param file - The deleted file
	 */
	private onFileDelete(file: TFile): void {
		// Remove from heat data (will be handled by VaultWatcher in Phase 3)
		// For now, we can keep the data for potential recovery
		if (this.settings.debugLogging) {
			console.debug(`Ember: File deleted: ${file.path}`);
		}
	}

	/**
	 * Handle file rename
	 * @param file - The renamed file
	 * @param oldPath - The old file path
	 */
	private onFileRename(file: TFile, oldPath: string): void {
		// Update path in heat data (will be handled by VaultWatcher in Phase 3)
		if (this.settings.debugLogging) {
			console.debug(`Ember: File renamed: ${oldPath} -> ${file.path}`);
		}
	}

	/**
	 * Queue an event for debounced processing
	 * @param filePath - Path to the file
	 * @param eventType - Type of event ('open' or 'modify')
	 */
	private queueEvent(filePath: string, eventType: 'open' | 'modify'): void {
		const now = Date.now();
		const lastEvent = this.eventQueue.get(filePath);

		// Skip if same file was processed very recently (prevent spam)
		if (lastEvent && now - lastEvent < 1000) {
			return;
		}

		// Update queue
		this.eventQueue.set(filePath, now);

		// Process event based on type
		if (eventType === 'open') {
			this.processFileOpen(filePath);
		} else if (eventType === 'modify') {
			this.processFileModify(filePath);
		}

		// Schedule debounced save
		this.scheduleSave();
	}

	/**
	 * Process file open event (immediate, not debounced)
	 * @param filePath - Path to the file
	 */
	private processFileOpen(filePath: string): void {
		// Notify metrics manager
		this.metricsManager.onFileAccess(filePath);

		if (this.settings.debugLogging) {
			console.debug(`Ember: File accessed: ${filePath}`);
		}
	}

	/**
	 * Process file modify event (immediate, not debounced)
	 * @param filePath - Path to the file
	 */
	private processFileModify(filePath: string): void {
		// Notify metrics manager
		this.metricsManager.onFileEdit(filePath);

		if (this.settings.debugLogging) {
			console.debug(`Ember: File edited: ${filePath}`);
		}
	}

	/**
	 * Schedule a debounced save
	 */
	private scheduleSave(): void {
		if (this.debounceTimer !== null) {
			window.clearTimeout(this.debounceTimer);
		}

		this.debounceTimer = window.setTimeout(() => {
			void this.dataStore.save();
			this.debounceTimer = null;
		}, this.DEBOUNCE_MS);
	}

	/**
	 * Check if file should be tracked
	 * @param file - File to check
	 * @returns True if file should be tracked
	 */
	private shouldTrackFile(file: TFile): boolean {
		// Only track markdown files by default
		// Could be expanded to include other file types in settings
		return file.extension === 'md';
	}

	/**
	 * Cleanup on plugin unload
	 */
	cleanup(): void {
		// Close session for current file
		if (this.currentFile) {
			this.metricsManager.onFileClose(this.currentFile);
			this.currentFile = null;
		}

		// Clear debounce timer
		if (this.debounceTimer !== null) {
			window.clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}

		// Force save
		this.dataStore.forceSave();
	}

	/**
	 * Update settings
	 * @param settings - New settings object
	 */
	updateSettings(settings: EmberSettings): void {
		this.settings = settings;
	}

	/**
	 * Manually trigger file access event (useful for testing)
	 * @param filePath - Path to the file
	 */
	triggerFileAccess(filePath: string): void {
		this.processFileOpen(filePath);
		this.scheduleSave();
	}

	/**
	 * Manually trigger file edit event (useful for testing)
	 * @param filePath - Path to the file
	 */
	triggerFileEdit(filePath: string): void {
		this.processFileModify(filePath);
		this.scheduleSave();
	}
}
