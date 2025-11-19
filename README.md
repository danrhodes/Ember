# Ember - Obsidian Plugin

**Visualize your vault's activity through dynamic heat tracking**

Ember tracks how you interact with your notes and creates a beautiful visual representation of your vault's usage patterns. Files you access frequently glow brighter, while unused notes cool down over time, helping you understand which notes matter most to your workflow.

---
## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [Features](#features)
  - [Views & Analytics](#views--analytics)
  - [Visualization Modes](#visualization-modes)
  - [Search & Filtering](#search--filtering)
  - [Batch Operations](#batch-operations)
  - [Manual Favorites](#manual-favorites)
  - [Exclusion System](#exclusion-system)
  - [Export/Import](#exportimport)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Settings](#settings)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

---

## Overview

Ember is an Obsidian plugin that tracks your note activity and visualizes it through a sophisticated "heat" system. Notes accumulate heat when you open, edit, or return to them. Heat naturally decays over time, creating a dynamic, ever-evolving view of your vault's activity patterns.

### What You Get

- **Visual Heat Tracking**: Files glow with colours representing activity levels
- **Multiple Views**: Statistics dashboard, timeline, popular files, and hot files panels
- **Advanced Analytics**: Activity trends, calendars, and peak time heatmaps
- **Smart Filtering**: Find files by folder, heat range, date range, or favourites
- **Batch Operations**: Manage multiple files at once
- **Keyboard Shortcuts**: Lightning-fast access to all features
- **Non-Invasive**: Stores data in JSON, never modifies your notes

---

## Installation

### From Obsidian Community Plugins (Coming Soon)

1. Open Obsidian Settings
2. Navigate to **Community Plugins**
3. Click **Browse** and search for "Ember"
4. Click **Install**, then **Enable**

### Manual Installation (For Testing)

1. Download the latest release from GitHub
2. Extract `main.js`, `manifest.json`, and `styles.css`
3. Copy to your vault's `.obsidian/plugins/ember/` folder
4. Reload Obsidian
5. Enable Ember in **Settings → Community Plugins**

---

## Quick Start

### 5-Minute Setup

1. **Install and enable** Ember from Community Plugins
2. **Check visualization is enabled**:
   - Settings → Ember → Visualization
   - Ensure "Apply to File Explorer" and "Apply to Tabs" are ON
   - Default mode is **Emergence** (beautiful gradient)
3. **Start using Obsidian normally** - heat accumulates automatically!
4. **Open views**:
   - Click 🔥 ribbon icon → **Popular Files**
   - Click 📊 ribbon icon → **Statistics Dashboard**
   - Use Command Palette (Ctrl/Cmd+P) → Search "Ember"

### First Steps

- **Explore the Statistics Dashboard**: See your vault's activity at a glance
- **Try the Popular Files view**: Find your most-accessed notes
- **Mark a favorite**: Right-click any file → "★ Mark as favorite"
- **Search for files**: Use the search box in Popular/Hot Files views
- **Customize colors**: Settings → Ember → Visualization → Colors

---

## Core Concepts

### How Heat Works

#### Heat Accumulation

Files gain heat through normal usage:

| Action | Heat Gained |
|--------|-------------|
| Opening a file | +5 heat |
| Editing a file | +10 heat |
| Quick return (within 5 min) | +3 heat |
| Session duration | Based on time spent |
| Manual favorite | +50 permanent boost |

#### Heat Decay

Heat naturally cools over time:

- **Default rate**: 5% every 30 minutes
- **Differential decay**: Hotter files cool faster (realistic cooling)
- **Pause for favorites**: Optionally prevent favorites from cooling
- **Background calculation**: Works even when Obsidian is closed

#### Heat Levels

Files are categorized by heat score (0-100):

- 🔥 **Blazing** (90-100): Extremely active
- 🔥 **Hot** (70-89): Very active
- ☀️ **Warm** (40-69): Moderately active
- ❄️ **Cool** (20-39): Less active
- ❄️ **Cold** (0-19): Rarely used

---

## Features

### Views & Analytics

#### 📊 Statistics Dashboard

Comprehensive analytics for your entire vault:

**Overview Cards:**
- Total tracked files
- Average heat score
- Hottest file in vault
- Number of favorited files

**Heat Distribution:**
- Visual breakdown by heat level (Blazing/Hot/Warm/Cool/Cold)
- Count and percentage for each level
- Color-coded badges

**Activity Trends (7-Day Chart):**
- Daily file access bar chart
- Momentum indicators (Heating Up ↗️, Stable ━, Cooling Down ↘️)
- Hover for exact counts

**Activity Calendar (30-Day Heatmap):**
- GitHub-style contribution graph
- 5 intensity levels with blue gradient
- Hover to see date and file count
- "Less to More" legend

**Peak Activity Times (24-Hour Heatmap):**
- Hourly activity patterns
- Orange gradient intensity
- Identifies your peak productivity hour

**Top Folders by Activity:**
- Most active folders ranked
- File count and average heat per folder

**Recent Activity:**
- Files accessed today, this week, this month

**Access**: Click 📊 ribbon icon or use Command Palette → "Open Statistics"

---

#### 📋 Popular Files View

Your most-accessed notes across all time:

- Ranked by total heat score
- Heat level badges (Hot/Warm/Cool)
- Favorite indicators (★)
- Click to open file
- Auto-updates every 5 seconds
- Configurable list length (default: 20)

**Features:**
- **Search**: Fuzzy matching to find files
- **Filters**: Folder, heat range, date range, favorites
- **Batch Operations**: Favorite/unfavorite/reset multiple files
- **Sort by**: Access count, heat score, last accessed

**Access**: Click 🔥 ribbon icon or Command Palette → "Open Popular Files"

---

#### 🔥 Hot Files View

Recently active files showing current focus areas:

- Shows files from last 7 days (configurable)
- **Momentum indicators**:
  - ↗️ **Heating Up**: Increasing activity
  - ↘️ **Cooling Down**: Decreasing activity
  - ━ **Stable**: Consistent activity
- Ranked by recent heat, not all-time popularity
- Perfect for tracking current projects

**Access**: Click 🔥 ribbon icon or Command Palette → "Open Hot Files"

---

#### ⏮️ Timeline View

Navigate through historical heat data:

**Snapshot Archival:**
- Automatically save heat snapshots
- Choose frequency: Hourly, Daily, or Weekly
- Retention: 90 days (configurable)
- Max snapshots: 100 (configurable)

**Timeline Navigation:**
- Previous/Next buttons to browse
- Jump to current state instantly
- Date picker for quick access

**Snapshot Management:**
- Load any historical snapshot
- Preview vault state at any point in time
- Return to current with one click
- Export snapshots for archival

**Use Cases:**
- Review project phases
- Analyze how focus shifted over time
- Recover from accidental heat resets
- Track long-term usage patterns

**Configure**: Settings → Ember → Archival Settings

**Access**: Command Palette → "Open Timeline"

---

### Visualization Modes

Three modes to visualize your vault's heat:

#### Emergence Mode (Default) ✨

**Best for**: Beautiful, full-spectrum visualization

- All files colored along gradient: Blue → Green → Yellow → Orange → Red
- Cold files (blue) through hot files (red)
- Font weight increases for hotter files
- Reveals usage patterns across entire vault
- Most visually engaging

#### Standard Mode

**Best for**: Clear distinction between active/inactive

- Hot files (top 20%): Red glow with intensity bar
- Cold files (bottom 20%): Blue tint with fade
- Neutral files (middle): No coloring (optional)
- Clean, minimal visual style

#### Analytical Mode

**Best for**: Power users and pattern analysis

- Multi-dimensional visualization
- Compare folders and tags
- Pattern detection
- Density maps
- Advanced analytics

**Switch Modes:**
- Settings → Ember → Visualization Mode
- Command Palette → "Cycle visualization mode"
- Keyboard shortcut: Ctrl/Cmd+Shift+V

**Applies To:**
- File Explorer
- Tab Headers
- Editor Background (subtle glow)

**Customize:**
- Hot/cold color selection
- Threshold adjustments (top/bottom percentages)
- Opacity controls (0-100%)
- Animation toggle

---

### Search & Filtering

#### Quick Search

Available in Popular Files and Hot Files views:

**Features:**
- **Fuzzy Matching**: "prf" matches "**P**opula**r** **F**iles.md"
- **Path Search**: Search by folder or filename
- **Real-time**: Results update as you type
- **Persistent**: Maintained during auto-refresh
- **Case-insensitive**: No exact capitalization needed

**How to Use:**
1. Open Popular Files or Hot Files view
2. Type in search box below header
3. Results filter instantly
4. Empty state shows "No files match [query]"

---

#### Advanced Filtering (Popular Files)

Multi-criteria filtering with AND logic:

**Filter Types:**

1. **Folder Path Filter**
   - Text input with partial matching
   - Example: "projects/" shows only files in projects folder

2. **Heat Range Filter**
   - Set minimum heat (0-100)
   - Set maximum heat (0-100)
   - Inclusive range

3. **Date Range Filter**
   - All time (default)
   - Today (last 24 hours)
   - This Week (last 7 days)
   - This Month (last 30 days)
   - Custom (specify dates)

4. **Favorites Only**
   - Toggle to show only favorited files

**Quick Filters:**

One-click buttons for common scenarios:
- Today
- This Week
- This Month
- Favorites Only

**Filter UI:**
- **Toggle Button**: Show/Hide advanced filters
- **Active Badge**: Shows count of active filters
- **Clear All**: Reset all criteria instantly
- **Expanded Panel**: Detailed controls

**How It Works:**
- All active filters use AND logic (all must match)
- Combines with search functionality
- Non-destructive (doesn't modify data)
- Works with batch operations

**Access**: Popular Files view → "Show Filters" button

---

### Batch Operations

Perform bulk actions on multiple files:

**Available In:**
- Popular Files view
- Hot Files view

**Operations:**

1. **Batch Favorite** ⭐
   - Mark multiple files as favorites at once
   - Adds +50 heat boost to each
   - Success notification shows count

2. **Batch Unfavorite** ⭐
   - Remove favorite status from multiple files
   - Removes heat boost
   - Preserves accumulated heat

3. **Batch Reset Heat** 🔄
   - Reset heat metrics to zero for multiple files
   - Preserves favorite status
   - Useful for archived projects

**How to Use:**

1. Click **"Batch Operations"** button
2. Checkboxes appear next to each file
3. Select files individually or click **"Select All"**
4. Choose operation from batch controls
5. Instant feedback via notifications
6. Click **"Exit Batch Mode"** when done

**Features:**
- Selection counter shows "X selected"
- Selections persist during auto-refresh
- Works with search and filters (batch only affects filtered results)
- Non-destructive (can undo by exiting)

---

### Manual Favorites

Mark important files to keep them hot:

**What It Does:**
- Permanent +50 heat boost (configurable)
- Optional: Pause decay for favorites
- Favorite indicator (★) in all views
- Files stay hot even if not accessed

**How to Favorite:**
- Right-click file → "★ Mark as favorite"
- Command Palette → "Toggle favorite for current file"
- Keyboard shortcut: Ctrl/Cmd+Shift+F
- Batch operations (multiple files at once)

**Use Cases:**
- MOCs (Maps of Content) you reference constantly
- Daily notes template
- Project dashboards
- Reference materials
- Index notes
- Important resources

**Configure**: Settings → Ember → Favorites

---

### Exclusion System

Prevent certain files from accumulating heat:

#### Exclusion Types

**1. Path-Based**

Exclude specific files or folders:
- Example: `Archive/` excludes entire folder
- Example: `scratch.md` excludes single file
- Example: `Templates/` excludes templates folder

**2. Glob Patterns**

Wildcard matching:
- Example: `*.excalidraw` excludes all Excalidraw files
- Example: `drafts/**/*.md` excludes all markdown in drafts
- Example: `*.canvas` excludes all canvas files

**3. Tag-Based**

Frontmatter tags:
- Example: `#archive` excludes files with archive tag
- Example: `#template` excludes templates
- Works with array and string tag formats
- Supports with or without `#` prefix

#### Quick Exclude

Right-click any file → "👁️ Exclude from Ember tracking"

#### Manage Exclusions

Settings → Ember → Exclusions → Add/Edit/Remove rules

Each rule can be:
- Enabled/disabled individually
- Edited or deleted
- Shows count of excluded files

---

### Export/Import

Save and restore your heat data:

#### Export Features

- Export complete heat database to JSON
- Includes metadata:
  - Export date
  - Plugin version
  - Vault name
  - File count
- Preserves all heat metrics and history
- Automatic timestamped filename

#### Import Features

- Import previously exported data
- Validates data structure before import
- Merges with existing data (preserves newer data)
- Automatic backup created before import

#### Use Cases

- **Transfer** data between vaults
- **Backup** before major changes
- **Share** heat data with team members
- **Migrate** to new device
- **Archive** historical snapshots

**Access**: Settings → Ember → Data Management → Export/Import

---

## Keyboard Shortcuts

All commands available via **Command Palette** (Ctrl/Cmd+P)

Assign custom hotkeys in **Settings → Hotkeys → Search "Ember"**

### View Commands

- `Ember: Open Popular Files` - Opens Popular Files view
- `Ember: Open Hot Files` - Shows recently active files
- `Ember: Open Statistics` - Opens analytics dashboard
- `Ember: Open Timeline` - Browse historical snapshots

### File Operations

- `Ember: Toggle favorite for current file` ⭐ - Mark/unmark as favorite
- `Ember: Reset heat for current file` 🔄 - Reset all heat metrics to zero
- `Ember: Show heat info for current file` 📊 - Display detailed heat info

### Global Settings

- `Ember: Cycle visualization mode` 🎨 - Cycle through visualization modes
- `Ember: Toggle visual effects on/off` ✨ - Enable/disable all visual effects

### Suggested Hotkey Assignments

| Command | Suggested Hotkey | Description |
|---------|------------------|-------------|
| Toggle favorite | `Ctrl+Shift+F` | Quick favorite toggle |
| Show heat info | `Ctrl+Shift+I` | Display file stats |
| Reset heat | `Ctrl+Shift+R` | Reset current file |
| Open Statistics | `Ctrl+Shift+S` | Open dashboard |
| Cycle viz mode | `Ctrl+Shift+V` | Change visualization |
| Toggle effects | `Ctrl+Shift+E` | Enable/disable visuals |

### Context Menu (Right-Click)

Right-click any file in File Explorer:

- ⭐ **Mark/Remove as favorite** - Toggle favorite status
- 🔥 **Reset Ember heat** - Reset heat metrics
- 👁️ **Exclude/Include from tracking** - Toggle tracking

---

## Settings

Ember provides 30+ settings organized into logical sections:

### Storage & Data

- **Storage Mode**: JSON only (default), Property only, or Both
- **Property Name**: Frontmatter property name (default: `ember-heat`)
- **Backup Count**: Number of backups to keep (default: 3)
- **Retention Policy**: Years to keep data, archive settings
- **Auto-cleanup**: Remove deleted files automatically

### Heat Calculation

**Metric Weights** (should sum to 100):
- Frequency: 30% - Total access count
- Recency: 40% - Recent access weighted higher
- Succession: 10% - Repeated quick access
- Duration: 15% - Time spent in note
- Edits: 5% - Modification activity

**Heat Increments:**
- File Open: +5 (default)
- File Edit: +10 (default)
- Quick Return: +3 (default)
- Quick Return Window: 5 minutes (default)

**Manual Boost:**
- Favorite Boost Value: +50 (default)

### Decay Settings

- **Decay Rate**: Percentage lost per cycle (default: 5%)
- **Decay Interval**: How often decay occurs (default: 30 minutes)
- **Differential Decay**: Higher heat decays faster (ON by default)
- **Differential Multiplier**: Multiplier for high heat (default: 2x)
- **Pause for Favorites**: Prevent favorites from cooling (ON by default)
- **Background Decay**: Calculate even when closed (ON by default)

### Visualization

- **Visualization Mode**: Standard, Emergence, or Analytical
- **Enable Animations**: Smooth transitions (ON by default)
- **Transition Duration**: Animation speed (default: 300ms)
- **Opacity**: Visual intensity 0-100% (default: 70%)

**Standard Mode:**
- Hot Color (default: red #dc2626)
- Cold Color (default: blue #3b82f6)
- Hot Threshold (top X%, default: 20%)
- Cold Threshold (bottom X%, default: 20%)
- Neutral Uncolored (hide middle range)

**Emergence Mode:**
- Gradient Type: Rainbow or Custom
- Custom Color Stops (5 colors)
- Clustering Enabled
- Density Calculation

**Apply To:**
- File Explorer (ON by default)
- Tab Headers (ON by default)

### Popular/Hot Files Views

- **Display Count**: Number of files to show (default: 20)
- **Hot Files Time Window**: Recent activity period (default: 7 days)
- **Show Status Bar**: Display widget (ON by default)
- **Show Ribbon Icons**: Display sidebar icons (ON by default)

### Exclusions

- **Manage Rules**: Add/edit/remove exclusions
- Path-based, Glob patterns, Tag-based
- Enable/disable individually
- View exclusion stats

### Archival (Timeline)

- **Enable**: Turn on snapshot archival
- **Snapshot Frequency**: Hourly, Daily, or Weekly
- **Retention Days**: How long to keep (default: 90)
- **Max Snapshots**: Maximum to store (default: 100)

### UI & Behavior

- **Status Bar Widget**: Show current file heat (ON)
- **Ribbon Icons**: Display sidebar icons (ON)
- **Context Menus**: Enable right-click options (ON)
- **Animations**: Smooth effects (ON)

### Advanced

- **Performance Mode**: Reduce update frequency for large vaults
- **Debug Logging**: Show detailed logs (OFF by default)
- **Update Debounce**: Delay before updates (default: 5000ms)

---

## Troubleshooting

### Heat colors aren't showing

**Solution:**
1. Settings → Ember → Visualization
2. Enable "Apply to File Explorer" and "Apply to Tabs"
3. Ensure mode is "Emergence" or "Standard"
4. Try toggling: Command Palette → "Toggle visual effects"

### Files aren't accumulating heat

**Check:**
1. Files aren't excluded:
   - Settings → Ember → Exclusions
   - Right-click file → Verify not "Excluded from tracking"
2. Plugin is enabled:
   - Settings → Community Plugins → Ember is ON

### Timeline shows no snapshots

**Solution:**
1. Enable archival: Settings → Ember → Archival Settings
2. Set snapshot frequency (daily recommended)
3. Wait for first snapshot to be created

### Search isn't finding files

**Note:** Search only looks in visible files:
- Popular Files: Top N files (configurable count)
- Hot Files: Recently active files (configurable window)

**Solution:** Increase display count in settings

### Batch operations aren't working

**Checklist:**
1. Click "Batch Operations" button first
2. Select files using checkboxes
3. Choose operation (Favorite/Unfavorite/Reset)
4. Check console for errors (Ctrl+Shift+I)

### Heat decaying too fast/slow

**Adjust:**
- Settings → Ember → Decay Settings
- **Slower**: Lower decay rate (try 3%)
- **Faster**: Higher decay rate (try 10%)
- **Less frequent**: Increase interval (try 60 min)
- **Protect favorites**: Enable "Pause Decay for Favorites"

---

## FAQ

### Performance

**Q: Will this slow down my vault?**

A: No. Ember is optimized for vaults with 10,000+ notes:
- CPU usage: <3% when active
- Visual updates: <50ms
- Debounced event handling
- Lazy data loading

**For large vaults (5,000+ files):**
- Enable Performance Mode: Settings → Advanced
- Increase update debounce to 10000ms
- Reduce Popular/Hot Files display count to 10-15
- Use exclusion rules for template folders, archives

**For better visual performance:**
- Reduce opacity to 50-60%
- Disable animations
- Use Standard mode instead of Emergence

### Data & Privacy

**Q: Does Ember modify my notes?**

A: No. Default storage is JSON file (`.obsidian/plugins/ember/heat-data.json`). Notes are never modified unless you enable Property Storage mode.

**Q: How do I backup my heat data?**

A: Three options:
1. Export via Settings → Ember → Export
2. Copy `.obsidian/plugins/ember/heat-data.json` manually
3. Enable snapshot archival for automatic historical backups

**Q: How do I reset all heat data?**

A: Two approaches:
1. Batch reset: Popular Files → Batch Operations → Select All → Reset Heat
2. Delete data file: Close Obsidian → Delete `.obsidian/plugins/ember/heat-data.json` → Reopen

**Q: Can I transfer heat data to another vault?**

A: Yes! Export from source vault, import into destination:
- Export: Settings → Ember → Export
- Import: Settings → Ember → Import (in destination vault)

### Features

**Q: What's the difference between Popular Files and Hot Files?**

A:
- **Popular Files**: All-time most accessed (ranked by total heat)
- **Hot Files**: Recently active (last 7 days, shows momentum)

**Q: Can I customize the colors?**

A: Yes! Settings → Ember → Visualization → Color customization

**Q: How do I exclude template files?**

A: Settings → Ember → Exclusions → Add rule:
- Type: Glob
- Pattern: `Templates/**/*.md`
- Enable the rule

**Q: Can I see heat for a specific file?**

A: Yes! Command Palette → "Show heat info for current file"
Or check the Status Bar widget at the bottom

---

## Support & Resources

- **Documentation**: [FEATURES.md](FEATURES.md) - Quick feature reference
- **Issues**: [GitHub Issues](https://github.com/danrhodes/ember/issues)
- **Discussions**: [GitHub Discussions](https://github.com/danrhodes/ember/discussions)
- **Author**: Dan Rhodes ([@danrhodes](https://github.com/danrhodes))

---

## License

MIT License - See [LICENSE](LICENSE) file for details

---

## Status

![Completion](https://img.shields.io/badge/status-stable-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)
![Obsidian](https://img.shields.io/badge/obsidian-0.15.0%2B-purple)
![TypeScript](https://img.shields.io/badge/typescript-5.0%2B-blue)
![Features](https://img.shields.io/badge/features-40%2B-blue)

**Ember is feature-complete, extensively tested, and production-ready.**


#obsidian
