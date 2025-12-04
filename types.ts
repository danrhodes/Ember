// Core Types and Interfaces for Ember Plugin

/**
 * Heat level categories based on normalized heat score
 */
export enum HeatLevel {
	COLD = 'cold',
	COOL = 'cool',
	WARM = 'warm',
	HOT = 'hot',
	CRITICAL = 'critical',
	BLAZING = 'blazing'
}

/**
 * Visualization modes for displaying heat
 */
export enum VisualizationMode {
	STANDARD = 'standard',      // Hot/cold endpoints, neutral middle
	EMERGENCE = 'emergence',    // Full gradient across all files
	ANALYTICAL = 'analytical',  // Multi-dimensional analysis
	MINIMAL = 'minimal'         // Accessibility mode: subtle opacity fade, no colors
}

/**
 * Storage modes for heat data
 */
export enum StorageMode {
	JSON_ONLY = 'json',         // Store in JSON file only (default, non-invasive)
	PROPERTY_ONLY = 'property', // Store in frontmatter properties only
	BOTH = 'both'               // Store in both JSON and properties
}

/**
 * Individual metrics tracked for each file
 */
export interface HeatMetrics {
	// Access frequency: total number of opens over time
	accessCount: number;

	// Recency weight: timestamp of last access
	lastAccessed: number;

	// Succession tracking: consecutive accesses without other files between
	successionCount: number;
	successionTimestamp: number;

	// Session duration: total time spent in file (milliseconds)
	totalDuration: number;
	sessionStart: number | null; // null when not currently open

	// Edit activity: number of modifications
	editCount: number;
	lastEdited: number;

	// Manual boost: user-marked favorite
	isFavorite: boolean;
	favoriteBoost: number; // Permanent boost value (default 50)
}

/**
 * Complete heat data for a single file
 */
export interface HeatData {
	// File path (unique identifier)
	path: string;

	// Normalized heat score (0-100)
	heatScore: number;

	// Individual metrics
	metrics: HeatMetrics;

	// Timestamps
	firstTracked: number;
	lastUpdated: number;

	// Heat history for timeline features (optional, added in Phase 3)
	history?: HeatHistoryEntry[];
}

/**
 * Heat history entry for timeline scrubbing (Phase 3)
 */
export interface HeatHistoryEntry {
	timestamp: number;
	heatScore: number;
}

/**
 * Data retention and archival policy
 */
export interface RetentionPolicy {
	// Keep data for this many years
	retentionYears: number;

	// Archive inactive files after this many months
	archiveAfterMonths: number;

	// Auto-cleanup deleted files on startup
	autoCleanup: boolean;

	// Compress archived data
	compressArchive: boolean;
}

/**
 * Exclusion rule for files/folders/tags
 */
export interface ExclusionRule {
	type: 'path' | 'tag' | 'glob';
	pattern: string;
	enabled: boolean;
}

/**
 * Standard mode visualization settings
 */
export interface StandardModeSettings {
	hotColor: string;        // Color for hot files (default: #dc2626)
	coldColor: string;       // Color for cold files (default: #3b82f6)
	hotThreshold: number;    // Top X% are hot (default: 20)
	coldThreshold: number;   // Bottom X% are cold (default: 20)
	neutralUncolored: boolean; // Middle range uncolored (default: true)
}

/**
 * Emergence mode visualization settings
 */
export interface EmergenceModeSettings {
	gradientType: 'rainbow' | 'custom';
	colorStops: string[];    // Array of colors for custom gradient
	clusteringEnabled: boolean;
	densityCalculation: boolean;
}

/**
 * Analytical mode visualization settings (Phase 3)
 */
export interface AnalyticalModeSettings {
	multiDimensional: boolean;
	compareFolders: boolean;
	compareTags: boolean;
	patternDetection: boolean;
	densityMaps: boolean;
}

/**
 * Complete plugin settings
 */
export interface EmberSettings {
	// Storage Settings
	storageMode: StorageMode;
	propertyName: string;            // Property name for frontmatter (default: 'ember-heat')
	backupCount: number;             // Number of backups to keep (default: 3)
	conflictStrategy: 'json-wins' | 'property-wins' | 'higher-wins'; // Conflict resolution strategy (default: 'json-wins')
	retentionPolicy: RetentionPolicy;

	// Heat Calculation Weights (should sum to 100)
	metricWeights: {
		frequency: number;   // Default: 30
		recency: number;     // Default: 40
		succession: number;  // Default: 10
		duration: number;    // Default: 15
		edits: number;       // Default: 5
	};

	// Heat Increments
	heatIncrements: {
		fileOpen: number;     // Default: 5
		fileEdit: number;     // Default: 10
		quickReturn: number;  // Default: 3 (return within quickReturnWindow)
		quickReturnWindow: number; // Default: 5 minutes (in milliseconds)
	};

	// Manual Boost
	manualBoostValue: number; // Default: 50

	// Decay Settings
	decayInterval: number;    // Minutes between decay cycles (default: 30)
	decayRate: number;        // Percentage decay per cycle (default: 5)
	differentialDecay: boolean; // High heat decays faster (default: true)
	differentialMultiplier: number; // Multiplier for high heat (default: 2)
	pauseDecayForFavorites: boolean; // Default: true
	calculateDecayWhileClosed: boolean; // Default: true

	// Visualization Settings
	visualizationMode: VisualizationMode;
	enableAnimations: boolean; // Default: true
	transitionDuration: number; // milliseconds (default: 300)
	opacity: number;           // 0-100 (default: 70)

	// Mode-specific settings
	standardMode: StandardModeSettings;
	emergenceMode: EmergenceModeSettings;
	analyticalMode: AnalyticalModeSettings;

	// Application targets
	applyToFileExplorer: boolean; // Default: true
	applyToTabs: boolean;         // Default: true

	// Exclusions
	exclusionRules: ExclusionRule[];

	// UI Settings
	showStatusBar: boolean;       // Default: true
	showRibbonIcon: boolean;      // Default: true
	showHeatInEditor: boolean;    // Show heat banner under file title (default: false)
	useHeatIcons: boolean;        // Show heat icons next to file names (default: true)
	colorTextWithIcons: boolean;  // Also color text when using icons (default: true)
	useFlameEffect: boolean;      // Show animated flames for 100 heat files (default: true)
	popularFilesCount: number;    // Default: 20
	hotFilesTimeWindow: number;   // Days (default: 7)
	enableContextMenus: boolean;  // Default: true

	// Archival Settings (Phase 3)
	archival: {
		enabled: boolean;                                  // Enable snapshot archival
		snapshotFrequency: 'hourly' | 'daily' | 'weekly'; // How often to create snapshots
		retentionDays: number;                            // How long to keep snapshots (default: 90)
		maxSnapshots: number;                             // Maximum snapshots to keep (default: 100)
	};

	// Advanced Settings
	performanceMode: boolean;     // Reduce update frequency (default: false)
	debugLogging: boolean;        // Default: false
	updateDebounce: number;       // milliseconds (default: 5000)
}

/**
 * Default settings for the plugin
 */
export const DEFAULT_SETTINGS: EmberSettings = {
	// Storage Settings
	storageMode: StorageMode.JSON_ONLY,
	propertyName: 'ember-heat',
	backupCount: 3,
	conflictStrategy: 'json-wins',
	retentionPolicy: {
		retentionYears: 5,
		archiveAfterMonths: 12,
		autoCleanup: true,
		compressArchive: true
	},

	// Heat Calculation Weights
	metricWeights: {
		frequency: 30,
		recency: 40,
		succession: 10,
		duration: 15,
		edits: 5
	},

	// Heat Increments
	heatIncrements: {
		fileOpen: 5,
		fileEdit: 10,
		quickReturn: 3,
		quickReturnWindow: 5 * 60 * 1000 // 5 minutes in milliseconds
	},

	// Manual Boost
	manualBoostValue: 50,

	// Decay Settings
	decayInterval: 30,
	decayRate: 5,
	differentialDecay: true,
	differentialMultiplier: 2,
	pauseDecayForFavorites: true,
	calculateDecayWhileClosed: true,

	// Visualization Settings
	visualizationMode: VisualizationMode.EMERGENCE,
	enableAnimations: true,
	transitionDuration: 300,
	opacity: 70,

	// Standard Mode Settings
	standardMode: {
		hotColor: '#dc2626',  // Tailwind red-600
		coldColor: '#3b82f6', // Tailwind blue-500
		hotThreshold: 20,
		coldThreshold: 20,
		neutralUncolored: true
	},

	// Emergence Mode Settings
	emergenceMode: {
		gradientType: 'rainbow',
		colorStops: [
			'#3b82f6', // blue
			'#10b981', // green
			'#fbbf24', // yellow
			'#f59e0b', // orange
			'#dc2626'  // red
		],
		clusteringEnabled: false,
		densityCalculation: false
	},

	// Analytical Mode Settings
	analyticalMode: {
		multiDimensional: false,
		compareFolders: false,
		compareTags: false,
		patternDetection: false,
		densityMaps: false
	},

	// Application Targets
	applyToFileExplorer: true,
	applyToTabs: true,

	// Exclusions
	exclusionRules: [
		// Default tag exclusions (disabled by default - user can enable)
		{ type: 'tag', pattern: 'draft', enabled: false },
		{ type: 'tag', pattern: 'archive', enabled: false },
		{ type: 'tag', pattern: 'template', enabled: false }
	],

	// UI Settings
	showStatusBar: true,
	showRibbonIcon: true,
	showHeatInEditor: false,
	useHeatIcons: true,
	colorTextWithIcons: true,
	useFlameEffect: true,
	popularFilesCount: 20,
	hotFilesTimeWindow: 7,
	enableContextMenus: true,

	// Archival Settings (Phase 3)
	archival: {
		enabled: false,              // Disabled by default
		snapshotFrequency: 'daily',
		retentionDays: 90,
		maxSnapshots: 100
	},

	// Advanced Settings
	performanceMode: false,
	debugLogging: false,
	updateDebounce: 5000
};

/**
 * Heat data store structure (in-memory and JSON)
 */
export interface HeatDataStore {
	version: string;
	lastSaved: number;
	files: Record<string, HeatData>; // Map of file path to HeatData
}

/**
 * Backup metadata
 */
export interface BackupMetadata {
	timestamp: number;
	fileCount: number;
	version: string;
}

/**
 * Export data structure
 */
export interface ExportData {
	metadata: {
		exportDate: number;
		version: string;
		vaultName: string;
		fileCount: number;
	};
	data: HeatDataStore;
}
