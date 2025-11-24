import { ItemView, WorkspaceLeaf } from 'obsidian';
import { EmberSettings, HeatData } from '../types';
import { HeatManager } from '../managers/heat-manager';

export const STATISTICS_VIEW_TYPE = 'ember-statistics-view';

/**
 * StatisticsView
 *
 * Comprehensive analytics panel showing vault-wide heat insights:
 * - Overview statistics (total files, average heat, etc.)
 * - Heat distribution across files
 * - Activity trends (heating/cooling momentum)
 * - Top folders by activity
 * - Session statistics (today, this week, this month)
 * - Favorites and exclusions count
 */
export class StatisticsView extends ItemView {
	private settings: EmberSettings;
	private heatManager: HeatManager;
	private refreshInterval: number | null = null;
	private readonly REFRESH_INTERVAL_MS = 5000; // Refresh every 5 seconds

	constructor(leaf: WorkspaceLeaf, settings: EmberSettings, heatManager: HeatManager) {
		super(leaf);
		this.settings = settings;
		this.heatManager = heatManager;
	}

	getViewType(): string {
		return STATISTICS_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Ember Statistics';
	}

	getIcon(): string {
		return 'bar-chart-2';
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('ember-statistics-panel');

		this.render();

		// Auto-refresh statistics
		this.refreshInterval = window.setInterval(() => {
			this.render();
		}, this.REFRESH_INTERVAL_MS);
	}

	async onClose(): Promise<void> {
		if (this.refreshInterval !== null) {
			window.clearInterval(this.refreshInterval);
			this.refreshInterval = null;
		}
	}

	/**
	 * Render the statistics panel
	 */
	render(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('ember-statistics-panel');

		// Get all heat data
		const allHeatData = Array.from(this.heatManager.getAllHeatData().values());

		// Header
		const header = container.createEl('div', { cls: 'ember-panel-header' });
		header.createEl('h4', { text: 'Vault statistics' });
		header.createEl('div', {
			text: `Last updated: ${new Date().toLocaleTimeString()}`,
			cls: 'ember-panel-subtitle'
		});

		// Empty state
		if (allHeatData.length === 0) {
			const emptyState = container.createEl('div', { cls: 'ember-empty-state' });
			emptyState.createEl('h3', { text: '📊 No statistics yet' });
			emptyState.createEl('p', { text: 'Heat data will appear as you use your vault.' });
			const tipsList = emptyState.createEl('ul', { cls: 'ember-empty-tips' });
			tipsList.createEl('li', { text: 'Open and edit files to generate heat' });
			tipsList.createEl('li', { text: 'Statistics auto-update every 5 seconds' });
			tipsList.createEl('li', { text: 'Mark files as favorites for priority tracking' });
			return;
		}

		// Overview Section
		this.renderOverview(container, allHeatData);

		// Heat Distribution Section
		this.renderHeatDistribution(container, allHeatData);

		// Activity Trends Section (with line chart)
		this.renderActivityTrends(container, allHeatData);

		// Activity Calendar Section (GitHub-style)
		this.renderActivityCalendar(container, allHeatData);

		// Peak Activity Times Section
		this.renderPeakActivityTimes(container, allHeatData);

		// Top Folders Section
		this.renderTopFolders(container, allHeatData);

		// Session Statistics Section
		this.renderSessionStats(container, allHeatData);

		// Footer
		const footer = container.createEl('div', { cls: 'ember-panel-footer' });
		footer.createEl('small', { text: 'Ember - Dynamic Heat Tracking' });
	}

	/**
	 * Render overview statistics
	 */
	private renderOverview(container: HTMLElement, allHeatData: HeatData[]): void {
		const section = container.createEl('div', { cls: 'ember-stats-section' });
		section.createEl('h3', { text: 'Overview' });

		const statsGrid = section.createEl('div', { cls: 'ember-stats-grid' });

		// Total files tracked
		this.createStatCard(statsGrid, 'Total Files', allHeatData.length.toString(), 'file');

		// Average heat score
		const avgHeat = allHeatData.length > 0
			? (allHeatData.reduce((sum, d) => sum + d.heatScore, 0) / allHeatData.length).toFixed(1)
			: '0';
		this.createStatCard(statsGrid, 'Average Heat', avgHeat, 'thermometer');

		// Hottest file
		const hottestFile = allHeatData.length > 0
			? Math.max(...allHeatData.map(d => d.heatScore)).toFixed(1)
			: '0';
		this.createStatCard(statsGrid, 'Hottest File', hottestFile, 'flame');

		// Favorites count
		const favoritesCount = allHeatData.filter(d => d.metrics.isFavorite).length;
		this.createStatCard(statsGrid, 'Favorites', favoritesCount.toString(), 'star');
	}

	/**
	 * Render heat distribution chart
	 */
	private renderHeatDistribution(container: HTMLElement, allHeatData: HeatData[]): void {
		const section = container.createEl('div', { cls: 'ember-stats-section' });
		section.createEl('h3', { text: 'Heat distribution' });

		// Categorize files by heat level
		const distribution = {
			blazing: allHeatData.filter(d => d.heatScore >= 90).length,
			hot: allHeatData.filter(d => d.heatScore >= 70 && d.heatScore < 90).length,
			warm: allHeatData.filter(d => d.heatScore >= 40 && d.heatScore < 70).length,
			cool: allHeatData.filter(d => d.heatScore >= 20 && d.heatScore < 40).length,
			cold: allHeatData.filter(d => d.heatScore < 20).length
		};

		const chartContainer = section.createEl('div', { cls: 'ember-distribution-chart' });

		// Create horizontal bar chart
		const total = allHeatData.length;
		this.createDistributionBar(chartContainer, 'Blazing (90-100)', distribution.blazing, total, '#dc2626');
		this.createDistributionBar(chartContainer, 'Hot (70-89)', distribution.hot, total, '#f59e0b');
		this.createDistributionBar(chartContainer, 'Warm (40-69)', distribution.warm, total, '#fbbf24');
		this.createDistributionBar(chartContainer, 'Cool (20-39)', distribution.cool, total, '#60a5fa');
		this.createDistributionBar(chartContainer, 'Cold (0-19)', distribution.cold, total, '#3b82f6');
	}

	/**
	 * Render activity trends with line chart
	 */
	private renderActivityTrends(container: HTMLElement, allHeatData: HeatData[]): void {
		const section = container.createEl('div', { cls: 'ember-stats-section' });
		section.createEl('h3', { text: 'Activity trends (last 7 days)' });

		// Calculate daily activity for the last 7 days
		const now = Date.now();
		const oneDay = 24 * 60 * 60 * 1000;
		const days = 7;

		const dailyActivity = new Array(days).fill(0);
		const dailyLabels: string[] = [];

		// Generate labels (last 7 days)
		for (let i = days - 1; i >= 0; i--) {
			const date = new Date(now - i * oneDay);
			dailyLabels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
		}

		// Count files accessed each day
		allHeatData.forEach(data => {
			const lastAccessed = data.metrics.lastAccessed;
			const daysSince = Math.floor((now - lastAccessed) / oneDay);

			if (daysSince >= 0 && daysSince < days) {
				dailyActivity[days - 1 - daysSince]++;
			}
		});

		// Render line chart
		this.renderLineChart(section, dailyActivity, dailyLabels);

		// Momentum stats
		const statsGrid = section.createEl('div', { cls: 'ember-stats-grid', attr: { style: 'margin-top: 16px;' } });

		const recentWindow = this.settings.hotFilesTimeWindow * 24 * 60 * 60 * 1000;

		let heatingUp = 0;
		let cooling = 0;
		let stable = 0;

		allHeatData.forEach(data => {
			const recentActivity = data.metrics.lastAccessed > now - recentWindow;

			if (recentActivity && data.heatScore > 50) {
				heatingUp++;
			} else if (!recentActivity && data.heatScore < 30) {
				cooling++;
			} else {
				stable++;
			}
		});

		this.createStatCard(statsGrid, 'Heating Up', heatingUp.toString(), 'trending-up', '#f59e0b');
		this.createStatCard(statsGrid, 'Stable', stable.toString(), 'minus', '#64748b');
		this.createStatCard(statsGrid, 'Cooling Down', cooling.toString(), 'trending-down', '#60a5fa');
	}

	/**
	 * Render top folders by activity
	 */
	private renderTopFolders(container: HTMLElement, allHeatData: HeatData[]): void {
		const section = container.createEl('div', { cls: 'ember-stats-section' });
		section.createEl('h3', { text: 'Top folders by activity' });

		// Group by folder
		const folderStats = new Map<string, { count: number; totalHeat: number }>();

		allHeatData.forEach(data => {
			const pathParts = data.path.split('/');
			const folder = pathParts.length > 1 ? pathParts[0] : '(root)';

			const existingStats = folderStats.get(folder);
			if (existingStats) {
				existingStats.count++;
				existingStats.totalHeat += data.heatScore;
			} else {
				folderStats.set(folder, { count: 1, totalHeat: data.heatScore });
			}
		});

		// Sort by average heat
		const sortedFolders = Array.from(folderStats.entries())
			.map(([folder, stats]) => ({
				folder,
				count: stats.count,
				avgHeat: stats.totalHeat / stats.count
			}))
			.sort((a, b) => b.avgHeat - a.avgHeat)
			.slice(0, 5);

		const listContainer = section.createEl('div', { cls: 'ember-folder-list' });

		sortedFolders.forEach((item, index) => {
			const folderItem = listContainer.createEl('div', { cls: 'ember-folder-item' });

			// Rank
			folderItem.createEl('span', {
				text: `${index + 1}`,
				cls: 'ember-rank-badge'
			});

			// Folder name and stats
			const folderInfo = folderItem.createEl('div', { cls: 'ember-folder-info' });
			folderInfo.createEl('div', {
				text: item.folder,
				cls: 'ember-folder-name'
			});
			folderInfo.createEl('div', {
				text: `${item.count} files • Avg heat: ${item.avgHeat.toFixed(1)}`,
				cls: 'ember-folder-stats'
			});

			// Heat bar
			const heatBar = folderItem.createEl('div', { cls: 'ember-folder-heat-bar' });
			const percentage = Math.min(100, item.avgHeat);
			heatBar.createEl('div', {
				cls: 'ember-folder-heat-fill',
				attr: { style: `width: ${percentage}%` }
			});
		});
	}

	/**
	 * Render session statistics
	 */
	private renderSessionStats(container: HTMLElement, allHeatData: HeatData[]): void {
		const section = container.createEl('div', { cls: 'ember-stats-section' });
		section.createEl('h3', { text: 'Recent activity' });

		const now = Date.now();
		const oneDay = 24 * 60 * 60 * 1000;
		const oneWeek = 7 * oneDay;
		const oneMonth = 30 * oneDay;

		const today = allHeatData.filter(d => d.metrics.lastAccessed > now - oneDay).length;
		const thisWeek = allHeatData.filter(d => d.metrics.lastAccessed > now - oneWeek).length;
		const thisMonth = allHeatData.filter(d => d.metrics.lastAccessed > now - oneMonth).length;

		const statsGrid = section.createEl('div', { cls: 'ember-stats-grid' });

		this.createStatCard(statsGrid, 'Today', today.toString(), 'calendar-clock');
		this.createStatCard(statsGrid, 'This Week', thisWeek.toString(), 'calendar-days');
		this.createStatCard(statsGrid, 'This Month', thisMonth.toString(), 'calendar');
	}

	/**
	 * Create a stat card
	 */
	private createStatCard(
		container: HTMLElement,
		label: string,
		value: string,
		icon: string,
		color?: string
	): void {
		const card = container.createEl('div', { cls: 'ember-stat-card' });

		if (color) {
			card.style.borderLeftColor = color;
		}

		const iconEl = card.createEl('div', { cls: 'ember-stat-icon' });
		const svgEl = iconEl.createSvg('svg', { cls: `svg-icon lucide-${icon}` });
		const useEl = svgEl.createSvg('use');
		useEl.setAttr('href', `#lucide-${icon}`);

		const content = card.createEl('div', { cls: 'ember-stat-content' });
		content.createEl('div', { text: value, cls: 'ember-stat-value' });
		content.createEl('div', { text: label, cls: 'ember-stat-label' });
	}

	/**
	 * Create a distribution bar
	 */
	private createDistributionBar(
		container: HTMLElement,
		label: string,
		count: number,
		total: number,
		color: string
	): void {
		const barContainer = container.createEl('div', { cls: 'ember-distribution-bar' });

		// Label and count
		const labelEl = barContainer.createEl('div', { cls: 'ember-distribution-label' });
		labelEl.createEl('span', { text: label });
		labelEl.createEl('span', { text: `${count}`, cls: 'ember-distribution-count' });

		// Bar
		const barBg = barContainer.createEl('div', { cls: 'ember-distribution-bar-bg' });
		const percentage = total > 0 ? (count / total) * 100 : 0;
		barBg.createEl('div', {
			cls: 'ember-distribution-bar-fill',
			attr: { style: `width: ${percentage}%; background-color: ${color}` }
		});

		// Percentage
		barContainer.createEl('div', {
			text: `${percentage.toFixed(1)}%`,
			cls: 'ember-distribution-percentage'
		});
	}

	/**
	 * Render line chart for activity trends
	 */
	private renderLineChart(container: HTMLElement, data: number[], labels: string[]): void {
		const chartContainer = container.createEl('div', { cls: 'ember-line-chart' });

		// Calculate max value for scaling
		const maxValue = Math.max(...data, 1);
		const chartHeight = 120;

		// Create SVG-like chart using divs
		const chartArea = chartContainer.createEl('div', { cls: 'ember-chart-area' });

		// Create bars for each day
		data.forEach((value, index) => {
			const barContainer = chartArea.createEl('div', { cls: 'ember-chart-bar-container' });

			// Bar
			const barHeight = (value / maxValue) * chartHeight;
			const bar = barContainer.createEl('div', {
				cls: 'ember-chart-bar',
				attr: { style: `height: ${barHeight}px` }
			});

			// Value label on hover
			bar.createEl('span', {
				cls: 'ember-chart-value',
				text: value.toString()
			});

			// Label
			barContainer.createEl('div', {
				cls: 'ember-chart-label',
				text: labels[index]
			});
		});
	}

	/**
	 * Render activity calendar (GitHub-style contribution graph)
	 */
	private renderActivityCalendar(container: HTMLElement, allHeatData: HeatData[]): void {
		const section = container.createEl('div', { cls: 'ember-stats-section' });
		section.createEl('h3', { text: 'Activity calendar (last 30 days)' });

		const now = Date.now();
		const oneDay = 24 * 60 * 60 * 1000;
		const days = 30;

		// Calculate activity for each day
		const activityMap = new Map<string, number>();

		allHeatData.forEach(data => {
			const lastAccessed = data.metrics.lastAccessed;
			const date = new Date(lastAccessed);
			const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

			activityMap.set(dateKey, (activityMap.get(dateKey) || 0) + 1);
		});

		// Find max activity for scaling
		const maxActivity = Math.max(...Array.from(activityMap.values()), 1);

		// Create calendar grid
		const calendarGrid = section.createEl('div', { cls: 'ember-activity-calendar' });

		// Create 30 day cells (5 weeks x 7 days, showing last 30 days)
		for (let i = days - 1; i >= 0; i--) {
			const date = new Date(now - i * oneDay);
			const dateKey = date.toISOString().split('T')[0];
			const activity = activityMap.get(dateKey) || 0;

			// Calculate intensity level (0-4)
			const intensity = activity === 0 ? 0 : Math.min(4, Math.ceil((activity / maxActivity) * 4));

			calendarGrid.createEl('div', {
				cls: `ember-calendar-cell ember-calendar-intensity-${intensity}`,
				attr: {
					'data-date': date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
					'data-activity': activity.toString(),
					title: `${date.toLocaleDateString()}: ${activity} file${activity !== 1 ? 's' : ''} accessed`
				}
			});
		}

		// Add legend
		const legend = section.createEl('div', { cls: 'ember-calendar-legend' });
		legend.createEl('span', { text: 'Less', cls: 'ember-legend-label' });
		for (let i = 0; i <= 4; i++) {
			legend.createEl('div', { cls: `ember-calendar-cell ember-calendar-intensity-${i}` });
		}
		legend.createEl('span', { text: 'More', cls: 'ember-legend-label' });
	}

	/**
	 * Render peak activity times
	 */
	private renderPeakActivityTimes(container: HTMLElement, allHeatData: HeatData[]): void {
		const section = container.createEl('div', { cls: 'ember-stats-section' });
		section.createEl('h3', { text: 'Peak activity times' });

		// Group activity by hour of day (0-23)
		const hourlyActivity = new Array(24).fill(0);

		allHeatData.forEach(data => {
			const date = new Date(data.metrics.lastAccessed);
			const hour = date.getHours();
			hourlyActivity[hour]++;
		});

		// Find peak hours
		const maxActivity = Math.max(...hourlyActivity, 1);
		const peakHour = hourlyActivity.indexOf(maxActivity);

		// Create heatmap visualization
		const heatmapContainer = section.createEl('div', { cls: 'ember-hourly-heatmap' });

		hourlyActivity.forEach((activity, hour) => {
			const intensity = activity === 0 ? 0 : Math.min(4, Math.ceil((activity / maxActivity) * 4));

			const cell = heatmapContainer.createEl('div', {
				cls: `ember-hourly-cell ember-hourly-intensity-${intensity}`,
				attr: {
					title: `${hour}:00 - ${activity} file${activity !== 1 ? 's' : ''} accessed`
				}
			});

			// Add hour label for every 3 hours
			if (hour % 3 === 0) {
				cell.createEl('span', {
					cls: 'ember-hourly-label',
					text: `${hour}`
				});
			}
		});

		// Peak time summary
		const peakSummary = section.createEl('div', { cls: 'ember-peak-summary' });
		peakSummary.createEl('p', {
			text: `Peak activity at ${peakHour}:00 with ${maxActivity} file${maxActivity !== 1 ? 's' : ''} accessed`
		});
	}

	/**
	 * Update settings
	 */
	updateSettings(settings: EmberSettings): void {
		this.settings = settings;
		this.render();
	}
}
