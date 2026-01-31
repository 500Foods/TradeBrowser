/**
 * Hydrogen Build Metrics Browser - UI Core Functions
 * Core UI components and event handling
 *
 * @version 1.0.0
 * @license MIT
 */

// Extend the global namespace
var HMB = HMB || {};

// Set up event listeners
HMB.setupEventListeners = function() {
  // Chart title click to show controls
  if (this.state.elements.chartTitle) {
    this.state.elements.chartTitle.addEventListener('click', () => {
      this.toggleControlPanel();
    });
  }

  // Initialize color picker
  this.setupColorPicker();

  // Metric selection dropdown change handler
  const metricSelect = document.getElementById('metric-select');
  if (metricSelect) {
    metricSelect.addEventListener('change', (e) => {
      const addMetricBtn = document.getElementById('add-selected-metric');
      if (addMetricBtn) {
        const metricPath = e.target.value;
        // Enable button only if a metric is selected AND it hasn't been added yet
        if (metricPath) {
          const alreadyAdded = this.state.selectedMetrics.some(m => m.path === metricPath);
          addMetricBtn.disabled = alreadyAdded;
        } else {
          addMetricBtn.disabled = true;
        }
      }
    });
  }

  // Add selected metric button
  const addMetricBtn = document.getElementById('add-selected-metric');
  if (addMetricBtn) {
    addMetricBtn.addEventListener('click', () => {
      this.addSelectedMetric();
    });
  }

  // Update chart button
  const updateChartBtn = document.getElementById('update-chart');
  if (updateChartBtn) {
    updateChartBtn.addEventListener('click', () => {
      this.updateChart();
    });
  }

  // Retry button for errors
  const retryBtn = document.getElementById('retry-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      this.hideError();
      this.showLoading();
      this.discoverMetricsFiles();
    });
  }

  // Note: Old text-based filter has been replaced with dropdown filters
  // Filter functionality is now handled in trade_browser_filters.js

  // Chart mode toggle buttons
  const regularModeBtn = document.getElementById('mode-regular');
  const annualModeBtn = document.getElementById('mode-annual');
  
  if (regularModeBtn && annualModeBtn) {
    regularModeBtn.addEventListener('click', () => {
      this.setChartMode('regular');
    });
    
    annualModeBtn.addEventListener('click', () => {
      this.setChartMode('annual');
    });
  }
};

// Set chart mode (regular or annual)
HMB.setChartMode = function(mode) {
  if (this.state.chartMode === mode) return;
  
  this.state.chartMode = mode;
  
  // Update button states
  const regularModeBtn = document.getElementById('mode-regular');
  const annualModeBtn = document.getElementById('mode-annual');
  const descriptionElement = document.getElementById('chart-mode-description');
  
  if (regularModeBtn && annualModeBtn) {
    if (mode === 'regular') {
      regularModeBtn.classList.add('active');
      annualModeBtn.classList.remove('active');
      if (descriptionElement) {
        descriptionElement.textContent = 'Chart data by date range';
      }
    } else {
      regularModeBtn.classList.remove('active');
      annualModeBtn.classList.add('active');
      if (descriptionElement) {
        descriptionElement.textContent = 'Compare years (Jan-Dec overlay)';
      }
    }
  }
  
  // Re-render the chart with new mode
  this.renderChart();
};

// Create a simplified display label for the dropdown
// Creates concise but informative labels like "Test 01-CMP elapsed" instead of "Test Results Data Elapsed"
HMB.createDisplayLabel = function(path, context) {
  // Handle different metric types with specific formatting

  // 1. Test Results - Format as "Test <test_id> <metric_name>"
  if (path.includes('test_results.data') && context && context.test_id) {
    // Extract the metric name (last part of path)
    const parts = path.split('.');
    const metricName = parts[parts.length - 1];

    // Create concise format: "Test <test_id> <metric_name>"
    return `Test ${context.test_id} ${metricName}`;
  }

  // 2. CLOC (Code Lines) - Format as "CLOC <language> <metric_name>"
  else if (path.includes('cloc.main') && context && context.language) {
    // Extract the metric name (last part of path)
    const parts = path.split('.');
    const metricName = parts[parts.length - 1];

    // Create concise format: "CLOC <language> <metric_name>"
    return `CLOC ${context.language} ${metricName}`;
  }

  // 3. Coverage - Format as "Coverage <file> <metric_name>"
  else if (path.includes('coverage.data') && context && context.file_path) {
    // Extract the metric name (last part of path)
    const parts = path.split('.');
    const metricName = parts[parts.length - 1];

    // Clean up file path for display
    const cleanFilePath = context.file_path
      .replace(/\{.*?\}/g, '') // Remove {COLOR} codes
      .replace(/\.c$/, '')     // Remove .c suffix
      .replace(/[^a-zA-Z0-9_\.\/]/g, '_'); // Replace special chars

    // Create concise format: "Coverage <file> <metric_name>"
    return `Coverage ${cleanFilePath} ${metricName}`;
  }

  // 4. Stats - Format as "Stats <metric> <stat_name>"
  else if (path.includes('stats') && context && context.metric) {
    // Extract the metric name (last part of path)
    const parts = path.split('.');
    const metricName = parts[parts.length - 1];

    // Create concise format: "Stats <metric> <metric_name>"
    return `Stats ${context.metric} ${metricName}`;
  }

  // 5. General case - Create clean label with underscores as spaces
  else {
    // Start with basic cleaning
    let displayLabel = path
      .replace(/\./g, ' ')
      .replace(/\[/g, ' ')
      .replace(/\]/g, '')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/\s+/g, ' ');

    // Replace underscores with spaces for better readability
    displayLabel = displayLabel.replace(/_/g, ' ');

    // Capitalize properly
    displayLabel = displayLabel.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

    return displayLabel.trim();
  }
};

// Initialize date pickers
HMB.initDatePickers = function() {
  // Data starts from January 2017 and goes to October 2025
  // Set default date range to show all available data
  this.state.currentDateRange = {
    start: '2017-01-01',
    end: '2025-10-31'
  };

  // Initialize date pickers
  flatpickr(this.state.elements.startDate, {
    dateFormat: 'Y-m-d',
    defaultDate: this.state.currentDateRange.start,
    minDate: '2017-01-01',
    maxDate: '2025-10-31',
    onChange: (selectedDates, dateStr) => {
      // console.log('Start date changed to:', dateStr);
      this.state.currentDateRange.start = dateStr;
      this.handleDateRangeChange();
    }
  });

  flatpickr(this.state.elements.endDate, {
    dateFormat: 'Y-m-d',
    defaultDate: this.state.currentDateRange.end,
    minDate: '2017-01-01',
    maxDate: '2025-10-31',
    onChange: (selectedDates, dateStr) => {
      // console.log('End date changed to:', dateStr);
      this.state.currentDateRange.end = dateStr;
      this.handleDateRangeChange();
    }
  });
};

// Apply metrics filter based on search input
// Note: This function is deprecated - filtering is now handled by the filter system in trade_browser_filters.js
HMB.applyMetricsFilter = function() {
  // This function is kept for backward compatibility
  // The new filter system handles all filtering via dropdown selections
  console.log('applyMetricsFilter is deprecated - use the filter dropdowns instead');
};

// Update chart
HMB.updateChart = function() {
  this.filterDataByDateRange();
  this.renderChart();
};

// Generate a unique path for calculated metrics based on filter context
HMB.generateCalculatedMetricPath = function(calculatedType) {
  const fs = this.filterState;
  const parts = [
    fs.trade,
    fs.country,
    fs.group,
    fs.subgroup,
    fs.marketSegment,
    fs.commodity,
    fs.commodityDetail,
    calculatedType
  ].filter(p => p && p !== 'Unspecified');
  return parts.join('.');
};

// Create a display label from current filter selections
// Joins filter values with " - " separator, excluding "Vegetables" and "Unspecified"
HMB.createFilterBasedLabel = function() {
  const fs = this.filterState;
  const parts = [];
  
  // Add each filter value if it exists and isn't excluded
  if (fs.trade && fs.trade !== 'Vegetables' && fs.trade !== 'Unspecified') {
    parts.push(fs.trade);
  }
  if (fs.country && fs.country !== 'Vegetables' && fs.country !== 'Unspecified') {
    parts.push(fs.country);
  }
  if (fs.group && fs.group !== 'Vegetables' && fs.group !== 'Unspecified') {
    parts.push(fs.group);
  }
  if (fs.subgroup && fs.subgroup !== 'Vegetables' && fs.subgroup !== 'Unspecified') {
    parts.push(fs.subgroup);
  }
  if (fs.marketSegment && fs.marketSegment !== 'Vegetables' && fs.marketSegment !== 'Unspecified') {
    parts.push(fs.marketSegment);
  }
  if (fs.commodity && fs.commodity !== 'Vegetables' && fs.commodity !== 'Unspecified') {
    parts.push(fs.commodity);
  }
  if (fs.commodityDetail && fs.commodityDetail !== 'Vegetables' && fs.commodityDetail !== 'Unspecified') {
    parts.push(fs.commodityDetail);
  }
  // Always include the unit type (data to plot)
  if (fs.unitType) {
    parts.push(fs.unitType);
  }
  
  return parts.join(' - ');
};

// Add selected metric
HMB.addSelectedMetric = function() {
  const metricSelect = document.getElementById('metric-select');
  const metricPath = metricSelect.value;
  if (!metricPath) return;

  // Try to find the metric in availableMetrics first, then in filteredMetrics
  let metric = this.state.availableMetrics.find(m => m.path === metricPath);
  
  // If not found, check if it's a calculated metric from filteredMetrics
  if (!metric && this.filterState && this.filterState.filteredMetrics) {
    metric = this.filterState.filteredMetrics.find(m => m.path === metricPath);
  }
  
  // If still not found, check if it's a calculated metric type
  let isCalculatedMetric = false;
  let uniquePath = metricPath;
  
  if (!metric && this.isCalculatedUnitType && this.isCalculatedUnitType(metricPath)) {
    isCalculatedMetric = true;
    // Create a unique path that includes the filter context
    uniquePath = this.generateCalculatedMetricPath(metricPath);
    
    // Create a virtual metric for the calculated type
    const calculatedContext = this.createCalculatedMetricContext(metricPath);
    metric = {
      path: uniquePath,
      label: this.calculatedUnitTypeLabels[metricPath],
      context: calculatedContext,
      isCalculated: true,
      calculatedType: metricPath
    };
  } else if (metric) {
    isCalculatedMetric = metric.isCalculated || (this.isCalculatedUnitType && this.isCalculatedUnitType(metric.context.unitType));
    if (isCalculatedMetric) {
      // Generate a unique path for the calculated metric
      uniquePath = this.generateCalculatedMetricPath(metric.context.unitType || metric.calculatedType);
      metric.path = uniquePath;
    }
  }
  
  if (!metric) {
    console.warn('Metric not found:', metricPath);
    return;
  }

  // Check if already added (using the unique path)
  const existing = this.state.selectedMetrics.find(m => m.path === uniquePath);
  if (existing) {
    // console.log('Metric already added');
    // Update the button state in case this was called directly
    const addMetricBtn = document.getElementById('add-selected-metric');
    if (addMetricBtn) {
      addMetricBtn.disabled = true;
    }
    return;
  }

  // Read current UI selections
  const axisSelect = document.getElementById('metric-axis');
  const typeSelect = document.getElementById('metric-type');
  const colorInput = document.getElementById('metric-color');
  const lineStyleSelect = document.getElementById('metric-line-style');

  // Create display label from filter selections
  let displayLabel = this.createFilterBasedLabel();

  // Create metric configuration with current UI selections
  const metricConfig = {
    path: uniquePath,
    label: metric.label,
    displayLabel: displayLabel,
    axis: axisSelect ? axisSelect.value : 'left',
    type: typeSelect ? typeSelect.value : 'line',
    color: colorInput && colorInput.value ? colorInput.value : this.getRandomColor(),
    lineStyle: lineStyleSelect ? lineStyleSelect.value : 'regular',
    isCalculated: isCalculatedMetric,
    calculatedType: isCalculatedMetric ? (metric.calculatedType || metric.context.unitType) : null,
    // Store the filter context for calculated metrics so they retain their data even when filters change
    filterContext: isCalculatedMetric ? {
      trade: this.filterState.trade,
      country: this.filterState.country,
      group: this.filterState.group,
      subgroup: this.filterState.subgroup,
      marketSegment: this.filterState.marketSegment,
      commodity: this.filterState.commodity,
      commodityDetail: this.filterState.commodityDetail,
      years: this.filterState.years ? new Set(this.filterState.years) : new Set(),
      unitType: metric.calculatedType || metric.context.unitType
    } : null
  };

  this.state.selectedMetrics.push(metricConfig);
  
  // Set chart title on first metric addition
  if (this.state.selectedMetrics.length === 1) {
    const reportTitleInput = document.getElementById('report-title');
    if (reportTitleInput) {
      reportTitleInput.value = displayLabel;
      this.config.title = displayLabel;
    }
  }
  
  this.updateSelectedMetricsUI();
  this.updateChart();

  // Update the button state after adding
  const addMetricBtn = document.getElementById('add-selected-metric');
  if (addMetricBtn) {
    addMetricBtn.disabled = true;
  }
};

// Update selected metrics UI
HMB.updateSelectedMetricsUI = function() {
  const selectedMetricsList = document.getElementById('selected-metrics');
  if (!selectedMetricsList) return;

  selectedMetricsList.innerHTML = '';

  this.state.selectedMetrics.forEach(metric => {
    const metricElement = document.createElement('div');
    metricElement.className = 'selected-metric-item';
    metricElement.dataset.path = metric.path;
    metricElement.draggable = true;

    metricElement.innerHTML = `
      <button class="reorder-handle-btn" title="Drag to reorder" data-metric-path="${metric.path}">
        <i class="fas fa-grip-vertical"></i>
      </button>
      <div class="metric-info-selected">
        <div class="metric-label-selected" title="Path: ${metric.path}">${metric.displayLabel || metric.label}</div>
        <div class="metric-details-selected">
          <span class="metric-color-preview" style="background-color: ${metric.color}"></span>
          <span class="metric-axis-badge ${metric.axis}">${metric.axis}</span>
          <span class="metric-type-badge ${metric.type}">${metric.type}</span>
          <span class="metric-style-badge ${metric.lineStyle}">${metric.lineStyle}</span>
        </div>
      </div>
      <button class="remove-metric-btn" title="Remove metric" data-metric-path="${metric.path}">
        <i class="fas fa-trash-alt"></i>
      </button>
    `;

    // Add click handler for remove button
    const removeBtn = metricElement.querySelector('.remove-metric-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeMetric(metric.path);
      });
    }

    // Add drag and drop handlers for reordering
    metricElement.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', metricElement.outerHTML);
      metricElement.classList.add('dragging');
      this.state.dragIndex = Array.from(selectedMetricsList.children).indexOf(metricElement);
    });

    metricElement.addEventListener('dragend', (e) => {
      metricElement.classList.remove('dragging');
      // Remove drag over classes from all items
      selectedMetricsList.querySelectorAll('.selected-metric-item').forEach(item => {
        item.classList.remove('drag-over');
      });
    });

    metricElement.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    metricElement.addEventListener('dragenter', (e) => {
      e.preventDefault();
      if (metricElement !== e.relatedTarget && !metricElement.contains(e.relatedTarget)) {
        metricElement.classList.add('drag-over');
      }
    });

    metricElement.addEventListener('dragleave', (e) => {
      if (metricElement !== e.relatedTarget && !metricElement.contains(e.relatedTarget)) {
        metricElement.classList.remove('drag-over');
      }
    });

    metricElement.addEventListener('drop', (e) => {
      e.preventDefault();
      metricElement.classList.remove('drag-over');

      const draggedIndex = this.state.dragIndex;
      const targetIndex = Array.from(selectedMetricsList.children).indexOf(metricElement);

      if (draggedIndex !== targetIndex && draggedIndex !== undefined) {
        // Reorder the array
        const draggedMetric = this.state.selectedMetrics.splice(draggedIndex, 1)[0];
        this.state.selectedMetrics.splice(targetIndex, 0, draggedMetric);

        // Update UI and chart
        this.updateSelectedMetricsUI();
        this.updateChart();
      }
    });

    // Add click handler for metric label to copy path to clipboard
    const metricLabel = metricElement.querySelector('.metric-label-selected');
    if (metricLabel) {
      metricLabel.addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyMetricPathToClipboard(metric.path);
      });
    }

    selectedMetricsList.appendChild(metricElement);
  });
};

// Copy metric path to clipboard
HMB.copyMetricPathToClipboard = function(metricPath) {
  try {
    // Create a temporary input element
    const tempInput = document.createElement('input');
    tempInput.value = metricPath;
    document.body.appendChild(tempInput);

    // Select and copy the text
    tempInput.select();
    tempInput.setSelectionRange(0, 99999); // For mobile devices

    // Copy to clipboard
    const success = document.execCommand('copy');

    // Clean up
    document.body.removeChild(tempInput);

    // Show feedback
    if (success) {
      // Show a temporary notification
      const existingNotification = document.getElementById('copy-notification');
      if (existingNotification) {
        existingNotification.remove();
      }

      const notification = document.createElement('div');
      notification.id = 'copy-notification';
      notification.className = 'copy-notification';
      notification.textContent = `Copied: ${metricPath}`;
      document.body.appendChild(notification);

      // Remove notification after 2 seconds
      setTimeout(() => {
        notification.remove();
      }, 2000);
    }

    return success;
  } catch (error) {
    console.error('Failed to copy metric path:', error);
    return false;
  }
};

// Remove a metric from selected metrics
HMB.removeMetric = function(metricPath) {
  this.state.selectedMetrics = this.state.selectedMetrics.filter(m => m.path !== metricPath);
  this.updateSelectedMetricsUI();
  this.updateChart();

  // Update the add button state in case the removed metric was the one selected in dropdown
  const metricSelect = document.getElementById('metric-select');
  const addMetricBtn = document.getElementById('add-selected-metric');
  if (metricSelect && addMetricBtn) {
    const selectedMetricPath = metricSelect.value;
    if (selectedMetricPath) {
      // For calculated metrics, generate the unique path to check if it's already added
      let checkPath = selectedMetricPath;
      if (this.isCalculatedUnitType && this.isCalculatedUnitType(selectedMetricPath)) {
        checkPath = this.generateCalculatedMetricPath(selectedMetricPath);
      }
      // Check if the currently selected metric in dropdown is now available to add
      const alreadyAdded = this.state.selectedMetrics.some(m => m.path === checkPath);
      addMetricBtn.disabled = alreadyAdded;
    } else {
      addMetricBtn.disabled = true;
    }
  }
};

// Initialize color picker after DOM is ready
HMB.setupColorPicker = function() {
  // Initialize color picker
  if (this.initColorPicker) {
    this.initColorPicker();
  }
};

// Generate random color
HMB.getRandomColor = function() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

// Populate the metric dropdown with available metrics
// Note: This function is now primarily handled by the filter system
// This version is kept for initial population and fallback
HMB.populateMetricDropdown = function() {
  const dropdown = document.getElementById('metric-select');
  if (!dropdown) return;

  console.log('Populating dropdown with', this.state.availableMetrics.length, 'metrics');

  // Clear existing options (keep the default)
  while (dropdown.options.length > 1) {
    dropdown.remove(1);
  }

  // Set default color to skyblue (#87CEEB)
  const colorInput = document.getElementById('metric-color');
  if (colorInput) {
    colorInput.value = '#87CEEB'; // Sky blue
    const colorPreview = document.getElementById('color-preview');
    if (colorPreview) {
      colorPreview.style.backgroundColor = '#87CEEB';
    }
  }

  // Initialize color picker after elements are created
  this.initColorPicker();

  // Update the metrics count
  const metricCountElement = document.getElementById('metric-count');
  if (metricCountElement) {
    metricCountElement.textContent = `(${this.state.availableMetrics.length})`;
  }

  // The actual population is now handled by the filter system
  if (this.filterState && this.applyFilters) {
    this.applyFilters();
  }
};