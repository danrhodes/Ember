import { App, TFile } from 'obsidian';
import { EmberSettings, ExclusionRule } from '../types';

/**
 * ExclusionManager
 *
 * Responsible for:
 * - Managing file/folder exclusion rules
 * - Checking if files should be excluded from tracking
 * - Path pattern matching (exact, prefix, glob)
 * - Folder inheritance (excluded folders exclude all children)
 * - Tag-based exclusions (Phase 2)
 */
export class ExclusionManager {
	private settings: EmberSettings;
	private app: App;

	constructor(settings: EmberSettings, app: App) {
		this.settings = settings;
		this.app = app;
	}

	/**
	 * Check if a file path should be excluded from tracking
	 * @param filePath - Path to check
	 * @returns True if file should be excluded
	 */
	isExcluded(filePath: string): boolean {
		const normalizedPath = this.normalizePath(filePath);

		for (const rule of this.settings.exclusionRules) {
			if (!rule.enabled) continue;

			if (rule.type === 'path') {
				if (this.matchesPathRule(normalizedPath, rule.pattern)) {
					return true;
				}
			} else if (rule.type === 'glob') {
				if (this.matchesGlobPattern(normalizedPath, rule.pattern)) {
					return true;
				}
			} else if (rule.type === 'tag') {
				if (this.hasExcludedTag(filePath, rule.pattern)) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Match a file path against a path rule
	 * Supports:
	 * - Exact match: "path/to/file.md"
	 * - Folder match: "path/to/folder/" (includes all children)
	 * - Prefix match: "path/to/folder" (also includes children)
	 *
	 * @param filePath - Normalized file path
	 * @param pattern - Pattern to match against
	 * @returns True if path matches pattern
	 */
	private matchesPathRule(filePath: string, pattern: string): boolean {
		const normalizedPattern = this.normalizePath(pattern);

		// Exact match
		if (filePath === normalizedPattern) {
			return true;
		}

		// Folder match (with or without trailing slash)
		// If pattern is a folder, it should match all files within it
		if (normalizedPattern.endsWith('/') || !normalizedPattern.includes('.')) {
			const folderPattern = normalizedPattern.endsWith('/')
				? normalizedPattern
				: normalizedPattern + '/';

			if (filePath.startsWith(folderPattern)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Match a file path against a glob pattern
	 * Supports basic wildcards:
	 * - * matches any characters except /
	 * - ** matches any characters including /
	 * - ? matches a single character
	 *
	 * Examples:
	 * - "*.md" matches all markdown files in root
	 * - "drafts/**" matches everything in drafts folder
	 *
	 * @param filePath - Normalized file path
	 * @param pattern - Glob pattern
	 * @returns True if path matches glob pattern
	 */
	private matchesGlobPattern(filePath: string, pattern: string): boolean {
		const normalizedPattern = this.normalizePath(pattern);

		// Convert glob pattern to regex
		let regexPattern = normalizedPattern
			// Escape special regex characters except *, ?, and /
			.replace(/[.+^${}()|[\]\\]/g, '\\$&')
			// Replace ** with a placeholder
			.replace(/\*\*/g, '___DOUBLESTAR___')
			// Replace * with regex (match anything except /)
			.replace(/\*/g, '[^/]*')
			// Replace *** back to ** pattern (match anything including /)
			.replace(/___DOUBLESTAR___/g, '.*')
			// Replace ? with single character match
			.replace(/\?/g, '.');

		// Anchor the pattern
		regexPattern = '^' + regexPattern + '$';

		const regex = new RegExp(regexPattern);
		return regex.test(filePath);
	}

	/**
	 * Check if a file has a specific tag in its frontmatter
	 * Supports both formats:
	 * - tags: [tag1, tag2]
	 * - tags: tag1, tag2
	 * - With or without # prefix
	 *
	 * @param filePath - Path to the file
	 * @param tagPattern - Tag to check for (with or without #)
	 * @returns True if file has the tag
	 */
	private hasExcludedTag(filePath: string, tagPattern: string): boolean {
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (!(file instanceof TFile)) {
			return false;
		}

		// Get file cache (contains parsed frontmatter)
		const cache = this.app.metadataCache.getFileCache(file);

		if (!cache || !cache.frontmatter) {
			return false;
		}

		// Get tags from frontmatter
		const frontmatterTags = cache.frontmatter.tags;

		if (!frontmatterTags) {
			return false;
		}

		// Normalize tag pattern (remove # if present)
		const normalizedPattern = tagPattern.startsWith('#') ? tagPattern.slice(1) : tagPattern;

		// Handle array of tags
		if (Array.isArray(frontmatterTags)) {
			return frontmatterTags.some(tag => {
				const normalizedTag = typeof tag === 'string'
					? (tag.startsWith('#') ? tag.slice(1) : tag)
					: String(tag);
				return normalizedTag === normalizedPattern;
			});
		}

		// Handle string (single tag or comma-separated)
		if (typeof frontmatterTags === 'string') {
			const tags = frontmatterTags.split(',').map(t => t.trim());
			return tags.some(tag => {
				const normalizedTag = tag.startsWith('#') ? tag.slice(1) : tag;
				return normalizedTag === normalizedPattern;
			});
		}

		return false;
	}

	/**
	 * Normalize a file path for consistent matching
	 * - Converts backslashes to forward slashes
	 * - Removes leading slashes
	 * - Removes trailing slashes (except for explicit folder patterns)
	 *
	 * @param path - Path to normalize
	 * @returns Normalized path
	 */
	private normalizePath(path: string): string {
		return path
			.replace(/\\/g, '/') // Convert backslashes to forward slashes
			.replace(/^\/+/, ''); // Remove leading slashes
	}

	/**
	 * Add an exclusion rule
	 * @param type - Type of rule (path, glob, tag)
	 * @param pattern - Pattern to match
	 * @param enabled - Whether rule is enabled (default: true)
	 */
	addExclusion(type: 'path' | 'glob' | 'tag', pattern: string, enabled: boolean = true): void {
		const rule: ExclusionRule = {
			type,
			pattern,
			enabled
		};

		// Check if rule already exists
		const exists = this.settings.exclusionRules.some(
			r => r.type === type && r.pattern === pattern
		);

		if (!exists) {
			this.settings.exclusionRules.push(rule);
		}
	}

	/**
	 * Remove an exclusion rule
	 * @param type - Type of rule
	 * @param pattern - Pattern to remove
	 */
	removeExclusion(type: 'path' | 'glob' | 'tag', pattern: string): void {
		const index = this.settings.exclusionRules.findIndex(
			r => r.type === type && r.pattern === pattern
		);

		if (index !== -1) {
			this.settings.exclusionRules.splice(index, 1);
		}
	}

	/**
	 * Toggle an exclusion rule on/off
	 * @param type - Type of rule
	 * @param pattern - Pattern to toggle
	 */
	toggleExclusion(type: 'path' | 'glob' | 'tag', pattern: string): void {
		const rule = this.settings.exclusionRules.find(
			r => r.type === type && r.pattern === pattern
		);

		if (rule) {
			rule.enabled = !rule.enabled;
		}
	}

	/**
	 * Get all exclusion rules
	 * @returns Array of exclusion rules
	 */
	getExclusions(): ExclusionRule[] {
		return [...this.settings.exclusionRules];
	}

	/**
	 * Get exclusion rules by type
	 * @param type - Type of rules to get
	 * @returns Filtered array of exclusion rules
	 */
	getExclusionsByType(type: 'path' | 'glob' | 'tag'): ExclusionRule[] {
		return this.settings.exclusionRules.filter(r => r.type === type);
	}

	/**
	 * Clear all exclusion rules
	 */
	clearAll(): void {
		this.settings.exclusionRules = [];
	}

	/**
	 * Quick-exclude a file or folder
	 * Automatically determines if it's a file or folder and adds appropriate rule
	 * @param path - Path to exclude
	 */
	quickExclude(path: string): void {
		const isFolder = !path.includes('.') || path.endsWith('/');
		const type = 'path';
		const pattern = isFolder && !path.endsWith('/') ? path + '/' : path;

		this.addExclusion(type, pattern, true);
	}

	/**
	 * Check if a specific path is explicitly excluded
	 * @param path - Path to check
	 * @returns True if path has an explicit exclusion rule
	 */
	hasExplicitExclusion(path: string): boolean {
		const normalizedPath = this.normalizePath(path);

		return this.settings.exclusionRules.some(rule => {
			if (!rule.enabled) return false;

			if (rule.type === 'path') {
				return this.normalizePath(rule.pattern) === normalizedPath;
			}

			return false;
		});
	}

	/**
	 * Get statistics about exclusions
	 * @returns Object with exclusion stats
	 */
	getStatistics(): {
		total: number;
		enabled: number;
		disabled: number;
		byType: { path: number; glob: number; tag: number };
	} {
		const total = this.settings.exclusionRules.length;
		const enabled = this.settings.exclusionRules.filter(r => r.enabled).length;
		const disabled = total - enabled;

		const byType = {
			path: this.settings.exclusionRules.filter(r => r.type === 'path').length,
			glob: this.settings.exclusionRules.filter(r => r.type === 'glob').length,
			tag: this.settings.exclusionRules.filter(r => r.type === 'tag').length
		};

		return { total, enabled, disabled, byType };
	}

	/**
	 * Update settings
	 * @param settings - New settings object
	 */
	updateSettings(settings: EmberSettings): void {
		this.settings = settings;
	}
}
