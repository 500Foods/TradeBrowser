# Trade Browser

## Overview

The Trade Browser (trade_browser) is a powerful D3.js-based visualization tool that provides interactive analysis of the veg-trade-data.csv file. It was ported from the more complex Hydrogen Build Metrics Browser, and further adapted by adding more filtering and charting options.

## Features

### 🎨 Interactive Browser Mode

- **Dual-Axis Charts**: Visualize multiple metrics with independent Y-axes
- **Multiple Chart Types**: Line and bar charts with smooth animations
- **Interactive Controls**: Click-to-edit on chart title and legend
- **Date Range Selection**: Flatpickr-powered date selection with 30-day fallback
- **Color Customization**: Iro.js color picker with hex input support
- **Responsive Design**: Optimized for all screen sizes from mobile to 4K displays

### ⚙️ Command Line Mode

- **Automated Reporting**: Generate SVG reports from local metrics files
- **Configuration Driven**: JSON-based configuration for flexible reporting
- **Headless Operation**: Run without browser dependencies
- **Batch Processing**: Process multiple metrics files automatically

## Installation

### Browser Mode

Simply open `http://localhost:8080/trade_browser.html` in any modern browser. No installation required! Note: A link is provided in the default Swagger configuraiton, and the code is included in the swagger folder of the payload.

### Command Line Mode

Requires Node.js v18+ and npm dependencies.

```bash
# Install dependencies
cd elements/001-hydrogen/hydrogen/extras/trade_browser
npm install jsdom @jaames/iro flatpickr d3

# Make script executable
chmod +x trade_browser.sh
```

## Usage

### Browser Mode Usage

1. Open `trade_browser.html` in your browser
2. The application automatically loads metrics from GitHub
3. Click on the chart title or legend to show controls
4. Use the control panel to:
   - Select date ranges
   - Add/remove metrics
   - Customize colors and chart types
   - Export SVG reports

### Command Line Mode Usage

```bash
# Basic usage with default configuration
./trade_browser.sh

# Custom configuration and output file
./trade_browser.sh custom_config.json report_output.svg

# Using Node.js directly
node trade_browser_cli.js trade_browser_auto.json metrics_report.svg
```

## Configuration

### Browser Configuration (`trade_browser_defaults.json`)

```json
{
  "title": "Hydrogen Build Metrics Browser",
  "dateRange": {
    "start": "30_days_ago",
    "end": "today"
  },
  "metrics": [
    {
      "path": "summary.total_tests",
      "label": "Total Tests",
      "axis": "left",
      "type": "line",
      "color": "#4a90e2"
    },
    {
      "path": "summary.combined_coverage",
      "label": "Combined Coverage %",
      "axis": "right",
      "type": "line",
      "color": "#7ed321"
    }
  ]
}
```

### CLI Configuration (`trade_browser_auto.json`)

```json
{
  "title": "Hydrogen Build Metrics Auto Report",
  "mode": "auto",
  "dateRange": {
    "start": "30_days_ago",
    "end": "today"
  },
  "metrics": [
    {
      "path": "summary.total_tests",
      "label": "Total Tests",
      "axis": "left",
      "type": "line",
      "color": "#4a90e2"
    },
    {
      "path": "summary.total_passed",
      "label": "Tests Passed",
      "axis": "left",
      "type": "bar",
      "color": "#7ed321"
    },
    {
      "path": "summary.combined_coverage",
      "label": "Coverage %",
      "axis": "right",
      "type": "line",
      "color": "#f5a623"
    }
  ],
  "outputFile": "hydrogen_metrics_report.svg"
}
```

## Metrics Reference

### Available Metric Paths

The browser automatically extracts all numeric values from the metrics JSON. Common paths include:

- `summary.total_tests` - Total number of tests
- `summary.total_passed` - Tests that passed
- `summary.combined_coverage` - Overall test coverage
- `test_results.data[].elapsed` - Test execution times
- `cloc.language[].code` - Lines of code by language
- `coverage.data[].coverage_percentage` - File coverage percentages

### Adding Custom Metrics

1. Click "Add Metric" in the control panel
2. Select from the list of available metrics
3. Configure axis, chart type, and color
4. Click "Update Chart" to refresh visualization

## Architecture

```Features
┌────────────────────────────────────────────────────────┐
│         Hydrogen Build Metrics Browser                 │
├─────────────────────┬────────────────────┬─────────────┤
│   Browser Mode      │   CLI Mode         │  Core       │
├─────────────────────┼────────────────────┼─────────────┤
│ - GitHub API        │ - Local FS Access  │ - D3 Charts │
│ - Interactive UI    │ - Headless Render  │ - Data Proc │
│ - Real-time Updates │ - Batch Processing │ - Config    │
└─────────────────────┴────────────────────┴─────────────┘
```

## Technical Details

### Dependencies

- **D3.js v7.8.5** - Data visualization
- **Flatpickr v4.6.13** - Date selection
- **Iro.js v5** - Color picker
- **Font Awesome 6.4.0** - Icons
- **JSDOM** - CLI HTML environment

### Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers

### Performance

- **Initial Load**: ~1-2 seconds (depending on network)
- **Chart Rendering**: ~500-1000ms for 30 days of data
- **Memory Usage**: ~100-200MB for typical datasets
- **SVG Export**: ~100-500KB file size

## Troubleshooting

### Common Issues

#### **Browser: "No metrics files found"**

- Check GitHub repository availability
- Verify network connectivity
- Try refreshing the page

### **CLI: "Config file not found"**

- Verify file path is correct
- Check file permissions
- Use absolute paths if needed

#### **CLI: "No metrics files found"**

- Check local metrics directory structure
- Verify file permissions
- Ensure metrics files exist for recent dates

### Debugging

#### **Browser Mode**

```javascript
// Open browser console (F12) and check for errors
console.log('Debug info:', window.hmBrowser?.getDebugInfo());
```

#### **CLI Mode**

```bash
# Run with debug logging
DEBUG=1 node trade_browser_cli.js config.json output.svg
```

## Examples

### Basic Browser Usage

1. Open `trade_browser.html`
2. Wait for automatic data loading
3. Click chart title to show controls
4. Adjust date range as needed
5. Export SVG when satisfied

### Advanced CLI Usage

```bash
# Generate report for specific date range
node trade_browser_cli.js custom_config.json report_2025-11.svg

# Process with custom metrics
node trade_browser_cli.js performance_config.json perf_report.svg
```

## Development

### Project Structure

```files
trade_browser/
├── trade_browser.html          # Main HTML file
├── trade_browser.css           # Styles
├── trade_browser.js            # Core functionality
├── trade_browser_cli.js        # CLI implementation
├── trade_browser.sh            # CLI shell script
├── trade_browser_defaults.json # Browser config
├── trade_browser_auto.json     # CLI config
├── architecture.md          # System architecture
├── implementation_plan.md    # Implementation details
├── TEST_PLAN.md             # Testing strategy
└── README.md                # This documentation
```

### Building

```bash
# Install dependencies
npm install

# Run in development mode
npm start

# Build for production
npm run build
```

## Support

For issues, questions, or feature requests:

- Check the [GitHub Issues](https://github.com/500Foods/Philement/issues)
- Review the [architecture documentation](/elements/001-hydrogen/hydrogen/extras/trade_browser/architecture.md)
