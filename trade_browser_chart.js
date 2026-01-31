/**
 * Hydrogen Build Metrics Browser - Chart Functions
 * D3 chart rendering and visualization
 *
 * @version 1.0.0
 * @license MIT
 */

// Extend the global namespace
var HMB = HMB || {};

// Render the D3 chart
HMB.renderChart = function() {
  // console.log('🎨 renderChart called, selectedMetrics:', this.state.selectedMetrics.length);
  // if (this.state.selectedMetrics.length > 0) {
  //   console.log('📊 Selected metrics:');
  //   this.state.selectedMetrics.forEach((m, i) => {
  //     console.log(`  ${i+1}. "${m.path}" (${m.label})`);
  //   });
  // }

  if (this.state.selectedMetrics.length === 0) {
    // console.log('❌ No metrics selected to render');
    // Clear the chart completely
    const svgElement = d3.select('#metrics-chart');
    svgElement.selectAll('*').remove();
    return;
  }

  if (!this.state.filteredData || this.state.filteredData.length === 0) {
    // console.log('🔄 Calling filterDataByDateRange...');
    this.filterDataByDateRange();
  }

  if (!this.state.filteredData || this.state.filteredData.length === 0) {
    // console.log('❌ No data available for selected date range');
    return;
  }

  // console.log('✅ Proceeding with chart rendering...');

  // Clear previous chart completely
  const svgElement = d3.select('#metrics-chart');
  svgElement.selectAll('*').remove();
  svgElement.html('');

  // Get container dimensions for responsive design
  const container = document.getElementById('chart-container');
  let width, height;
  if (this.state.isHeadless) {
    // Use configured dimensions for headless mode
    width = this.config.chartSettings.width - this.config.chartSettings.margin.left - this.config.chartSettings.margin.right;
    height = this.config.chartSettings.height - this.config.chartSettings.margin.top - this.config.chartSettings.margin.bottom - 90;
  } else {
    width = container.clientWidth - this.config.chartSettings.margin.left - this.config.chartSettings.margin.right;
    height = container.clientHeight - this.config.chartSettings.margin.top - this.config.chartSettings.margin.bottom - 90;
  }

  // Initialize zoom transform if not exists
  this.state.zoomTransform = this.state.zoomTransform || d3.zoomIdentity;

  // Add defs for gradients at SVG root level
  const defs = d3.select('#metrics-chart').append('defs');

  // Create SVG container with responsive dimensions
  const svgRoot = d3.select('#metrics-chart')
    .attr('width', this.state.isHeadless ? this.config.chartSettings.width : container.clientWidth)
    .attr('height', this.state.isHeadless ? this.config.chartSettings.height : container.clientHeight);

  // Add background rectangle for headless mode
  if (this.state.isHeadless) {
    svgRoot.insert('rect', ':first-child')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('fill', '#1e1e1e')
      .attr('rx', 6);
  }

  const svg = svgRoot.append('g')
    .attr('transform', `translate(${this.config.chartSettings.margin.left},${this.config.chartSettings.margin.top})`);

  // Add clip path for x-axis to prevent labels from extending beyond chart
  defs.append('clipPath')
    .attr('id', 'x-axis-clip')
    .append('rect')
    .attr('x', 0)
    .attr('y', -50)
    .attr('width', width)
    .attr('height', 150);

  // Add clip path for chart area to clip lines and bars at boundaries
  defs.append('clipPath')
    .attr('id', 'chart-clip')
    .append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', width)
    .attr('height', height);

  // Add chart title to SVG
  const chartTitle = svg.append('text')
    .attr('class', 'chart-title')
    .attr('x', width / 2)
    .attr('y', -20 )
    .attr('text-anchor', 'middle')
    .attr('fill', this.state.isHeadless ? '#ffffff' : 'var(--text-color)')
    .attr('font-family', '"Vanadium Sans Semi-Extended", Tahoma, Geneva, Verdana, sans-serif')
    .attr('font-size', '1.3rem')
    .attr('font-weight', '600')
    .attr('cursor', 'pointer')
    .text(this.config.title)
    .on('click', () => {
      // console.log('Chart title clicked!');
      this.toggleControlPanel();
    });

  // Add transparent overlay for SVG click area - always present but only active when panel is collapsed
  const svgOverlay = svg.append('rect')
    .attr('class', 'svg-overlay')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', 'transparent')
    .attr('cursor', 'pointer')
    .attr('opacity', 0)
    .on('click', () => {
      // console.log('SVG overlay clicked! Panel collapsed:', this.state.elements.controlPanel.classList.contains('collapsed'));

      // Only toggle if panel is collapsed
      if (this.state.elements.controlPanel.classList.contains('collapsed')) {
        // console.log('Toggling control panel from SVG overlay');
        this.toggleControlPanel();
      } else {
        // console.log('Panel not collapsed, ignoring click');
      }
    });

  // Log overlay creation
  // console.log('SVG overlay created with dimensions:', width, 'x', height);
  // console.log('Panel collapsed state:', this.state.elements.controlPanel.classList.contains('collapsed'));

  // Add click handler to the SVG element itself as fallback
  d3.select('#metrics-chart').on('click', function() {
    if (HMB.state.elements.controlPanel.classList.contains('collapsed')) {
      HMB.toggleControlPanel();
    }
  });

  // Store monthly tick values for zoom handler access
  this.state.monthlyTickValues = null;
  
  // Set up scales
  // Generate full date range for domain to ensure all dates are displayed
  // Use UTC dates constructed directly from date parts to avoid timezone conversions
  const dates = this.state.filteredData.map(d => {
    const [year, month, day] = d.date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  });
  const minDate = d3.min(dates);
  const maxDate = d3.max(dates);
  // Add one day padding on each end for comfortable bar/point display
  const paddedMinDate = d3.utcDay.offset(minDate, -1);
  const paddedMaxDate = d3.utcDay.offset(maxDate, 1);
  const allDates = d3.utcDay.range(minDate, d3.utcDay.offset(maxDate, 1));

  // Check if we're in annual mode
  const isAnnualMode = this.state.chartMode === 'annual';

  // Debug: Log missing dates within the selected date range
  // OPTIMIZED: Uses Map for O(1) lookups instead of O(N) Array.find()
  const logMissingDates = () => {
    // Skip expensive computation if not in headless mode (where missing dates are actually used)
    if (!this.state.isHeadless) {
      this.state.missingDates = [];
      return;
    }

    const startParts = this.state.currentDateRange.start.split('-').map(Number);
    const endParts = this.state.currentDateRange.end.split('-').map(Number);
    const startDate = new Date(Date.UTC(startParts[0], startParts[1] - 1, startParts[2]));
    const endDate = new Date(Date.UTC(endParts[0], endParts[1] - 1, endParts[2]));
    
    // OPTIMIZATION: Build a Map for O(1) date lookups instead of O(N) Array.find()
    const dataByDate = new Map();
    for (const item of this.state.filteredData) {
      dataByDate.set(item.date, item);
    }
    
    const missingDates = [];
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = d3.utcFormat('%Y-%m-%d')(currentDate);
      const file = dataByDate.get(dateStr);
      if (!file || !file.data) {
        missingDates.push(dateStr);
      }
      // Note: Removed the expensive nested metric check - it was checking metrics 
      // that don't apply to trade data structure. The trade data always has Amount.
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    
    this.state.missingDates = missingDates;
  };
  logMissingDates();

  let xScale;
  
  if (isAnnualMode) {
    // Annual mode: X axis shows months (0-11 representing Jan-Dec)
    xScale = d3.scaleLinear()
      .domain([0, 11])
      .range([0, width]);
  } else {
    // Regular mode: X axis shows dates
    xScale = d3.scaleUtc()
      .domain([paddedMinDate, paddedMaxDate])
      .range([0, width]);
  }

  // Create scales for each axis
  const leftAxisMetrics = this.state.selectedMetrics.filter(m => m.axis === 'left');
  const rightAxisMetrics = this.state.selectedMetrics.filter(m => m.axis === 'right');

  let leftYScale = d3.scaleLinear()
    .domain(this.getAxisDomain(leftAxisMetrics))
    .range([height, 0]);

  let rightYScale = d3.scaleLinear()
    .domain(this.getAxisDomain(rightAxisMetrics))
    .range([height, 0]);

  // Store original scales for zooming
  this.originalXScale = xScale.copy();
  this.originalLeftYScale = leftYScale.copy();
  this.originalRightYScale = rightYScale.copy();

  // Apply rescale if zoom transform exists
  if (this.state.zoomTransform) {
    xScale = this.state.zoomTransform.rescaleX(this.originalXScale);
    leftYScale = this.state.zoomTransform.rescaleY(this.originalLeftYScale);
    rightYScale = this.state.zoomTransform.rescaleY(this.originalRightYScale);
  }

  // Store current xScale for tooltip date calculation
  this.currentXScale = xScale;

  // Helper function to get day of week from YYYY-MM-DD string
  const getDayOfWeek = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    return date.getUTCDay(); // 0 = Sunday
  };

  let xAxis;
  
  if (isAnnualMode) {
    // Annual mode: Show month names on X axis
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    // Use explicit tick values 0-11 to ensure labels land exactly on months
    xAxis = svg.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale).tickValues([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]).tickFormat(d => monthNames[d]).tickPadding(10));
    
    // Style the month labels
    xAxis.selectAll('text')
      .attr('fill', this.state.isHeadless ? '#ffffff' : 'var(--text-color)')
      .attr('font-family', '"Vanadium Sans Semi-Extended", Tahoma, Geneva, Verdana, sans-serif')
      .style('font-size', '0.75rem');
  } else {
    // Regular mode: Show monthly labels on X axis (YYYY-MMM format)
    // Generate one tick per month at the start of each month
    const monthlyTickValues = [];
    const uniqueMonths = new Set();
    this.state.filteredData.forEach(d => {
      const [year, month] = d.date.split('-').map(Number);
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      if (!uniqueMonths.has(monthKey)) {
        uniqueMonths.add(monthKey);
        // First day of the month - data points are at start of month
        monthlyTickValues.push(new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)));
      }
    });
    monthlyTickValues.sort((a, b) => a - b);
    
    // Store for zoom handler access
    this.state.monthlyTickValues = monthlyTickValues;
    
    xAxis = svg.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${height})`)
      .attr('clip-path', 'url(#x-axis-clip)')
      .call(d3.axisBottom(xScale).tickValues(monthlyTickValues).tickFormat(d => {
        return d3.utcFormat('%Y-%b')(d); // Format as "YYYY-MMM" (e.g., "2021-Jan")
      }).tickPadding(5));

    // Rotate tick labels 90 degrees (vertical) and position below axis
    xAxis.selectAll('text')
      .attr('transform', 'rotate(90) translate(5, 4)')
      .attr('text-anchor', 'start')
      .attr('dx', '0.5em')
      .attr('dy', '-0.35em')
      .attr('fill', this.state.isHeadless ? '#ffffff' : 'var(--text-color)')
      .attr('font-family', '"Vanadium Sans Semi-Extended", Tahoma, Geneva, Verdana, sans-serif')
      .style('font-size', '0.75rem');
  }

  // In headless mode, set fill for missing dates
  if (this.state.isHeadless) {
    xAxis.selectAll('text')
      .filter(d => this.state.missingDates.includes(d3.utcFormat('%Y-%m-%d')(d)))
      .attr('fill', '#666666');
  }

  // In headless mode, remove clip-path from x-axis to show labels
  if (this.state.isHeadless) {
    xAxis.attr('clip-path', null);
  }

  // Add vertical grid lines
  if (isAnnualMode) {
    // Annual mode: Add grid lines for each month (0-11)
    for (let month = 0; month <= 11; month++) {
      const xPos = xScale(month);
      if (xPos >= 0 && xPos <= width) {
        svg.append('line')
          .attr('class', 'month-grid-line')
          .attr('x1', xPos)
          .attr('y1', 0)
          .attr('x2', xPos)
          .attr('y2', height)
          .attr('stroke', '#333')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '2,2');
      }
    }
  } else {
    // Regular mode: Add grid lines only on January 1st
    const januaryFirstDates = allDates.filter(d => d.getUTCMonth() === 0 && d.getUTCDate() === 1 && xScale(d) >= 0 && xScale(d) <= width);
    januaryFirstDates.forEach(d => {
      svg.append('line')
        .attr('class', 'year-grid-line')
        .attr('x1', xScale(d))
        .attr('y1', 0)
        .attr('x2', xScale(d))
        .attr('y2', height)
        .attr('stroke', '#333')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,2');
    });
  }

  // Add horizontal grid lines at left Y-axis tick positions
  const leftYTicks = leftYScale.ticks(5);
  leftYTicks.forEach(tickValue => {
    const yPos = leftYScale(tickValue);
    if (yPos >= 0 && yPos <= height) {
      svg.append('line')
        .attr('class', 'horizontal-grid-line')
        .attr('x1', 0)
        .attr('y1', yPos)
        .attr('x2', width)
        .attr('y2', yPos)
        .attr('stroke', '#333')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,2');
    }
  });

  // Add chart boundary lines
  svg.append('line')
    .attr('class', 'x-axis-line')
    .attr('x1', 0)
    .attr('y1', height)
    .attr('x2', width)
    .attr('y2', height)
    .attr('stroke', '#333')
    .attr('stroke-width', 1);

  svg.append('line')
    .attr('class', 'x-axis-line')
    .attr('x1', 0)
    .attr('y1', 0)
    .attr('x2', width)
    .attr('y2', 0)
    .attr('stroke', '#333')
    .attr('stroke-width', 1);

    svg.append('line')
    .attr('class', 'x-axis-line')
    .attr('x1', 0)
    .attr('y1', 0)
    .attr('x2', 0)
    .attr('y2', height)
    .attr('stroke', '#333')
    .attr('stroke-width', 1);

    svg.append('line')
    .attr('class', 'x-axis-line')
    .attr('x1', width)
    .attr('y1', 0)
    .attr('x2', width)
    .attr('y2', height)
    .attr('stroke', '#333')
    .attr('stroke-width', 1);

    // Helper function to abbreviate numbers
  const abbreviateNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toString();
  };

  // Add left Y axis
  svg.append('g')
    .attr('class', 'y-axis left-axis')
    .call(d3.axisLeft(leftYScale).ticks(5).tickFormat(abbreviateNumber).tickPadding(5))
    .selectAll('text')
    .attr('fill', this.state.isHeadless ? '#ffffff' : 'var(--text-color)')
    .attr('font-family', '"Vanadium Sans Semi-Extended", Tahoma, Geneva, Verdana, sans-serif');

  // Add right Y axis if needed
  if (rightAxisMetrics.length > 0) {
    svg.append('g')
      .attr('class', 'y-axis right-axis')
      .attr('transform', `translate(${width},0)`)
      .call(d3.axisRight(rightYScale).ticks(5).tickFormat(abbreviateNumber).tickPadding(5))
      .selectAll('text')
      .attr('fill', this.state.isHeadless ? '#ffffff' : 'var(--text-color)')
      .attr('font-family', '"Vanadium Sans Semi-Extended", Tahoma, Geneva, Verdana, sans-serif');
  }

  // Create gradients for bar metrics
  this.state.selectedMetrics.forEach(metric => {
    if (metric.type === 'bar') {
      const gradientId = `gradient-${metric.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const gradient = defs.append('linearGradient')
        .attr('id', gradientId)
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%');

      // Function to darken color by 50%
      const darkenColor = (color) => {
        // Simple darkening by reducing RGB values
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) * 0.5);
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) * 0.5);
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) * 0.5);
        return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
      };

      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', metric.color);

      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', darkenColor(metric.color));
    }
  });

  // Draw metrics
  this.drawMetrics(svg, xScale, leftYScale, rightYScale, width, height);

  // Add legend to SVG only if there are metrics
  if (this.state.selectedMetrics.length > 0) {
    this.drawLegend(svg, width, height);
  }

  // Add zoom and pan (skip in headless mode)
  if (!this.state.isHeadless) {
    const zoom = d3.zoom()
      .scaleExtent([0.5, 5])
      .translateExtent([[-width * 2, -height * 2], [width * 2, height * 2]])
      .on('zoom', (event) => {
        this.state.zoomTransform = event.transform;
        const rescaledX = event.transform.rescaleX(this.originalXScale);
        const rescaledLeftY = event.transform.rescaleY(this.originalLeftYScale);
        const rescaledRightY = event.transform.rescaleY(this.originalRightYScale);

        // Update current xScale for tooltip
        this.currentXScale = rescaledX;

        // Update x axis based on chart mode
        if (isAnnualMode) {
          // Annual mode: Update month labels
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          xAxis.call(d3.axisBottom(rescaledX).tickValues([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]).tickFormat(d => monthNames[d]).tickPadding(10));
          
          // Style the month labels
          xAxis.selectAll('text')
            .attr('fill', this.state.isHeadless ? '#ffffff' : 'var(--text-color)')
            .attr('font-family', '"Vanadium Sans Semi-Extended", Tahoma, Geneva, Verdana, sans-serif')
            .style('font-size', '0.75rem');
        } else if (this.state.monthlyTickValues) {
          // Regular mode: Update monthly labels
          xAxis.call(d3.axisBottom(rescaledX).tickValues(this.state.monthlyTickValues).tickFormat(d => {
            return d3.utcFormat('%Y-%b')(d); // Format as "YYYY-MMM"
          }).tickPadding(5));

          // Rotate tick labels 90 degrees (vertical) and position below axis
          xAxis.selectAll('text')
            .attr('transform', 'rotate(90) translate(5, 4)')
            .attr('text-anchor', 'start')
            .attr('dx', '0.5em')
            .attr('dy', '-0.35em')
            .attr('fill', this.state.isHeadless ? '#ffffff' : 'var(--text-color)')
            .attr('font-family', '"Vanadium Sans Semi-Extended", Tahoma, Geneva, Verdana, sans-serif')
            .style('font-size', '0.75rem');
        }

        // Update grid lines
        svg.selectAll('.month-grid-line, .year-grid-line, .horizontal-grid-line').remove();

        // Add horizontal grid lines at left Y-axis tick positions
        const rescaledLeftYTicks = rescaledLeftY.ticks(5);
        rescaledLeftYTicks.forEach(tickValue => {
          const yPos = rescaledLeftY(tickValue);
          if (yPos >= 0 && yPos <= height) {
            svg.append('line')
              .attr('class', 'horizontal-grid-line')
              .attr('x1', 0)
              .attr('y1', yPos)
              .attr('x2', width)
              .attr('y2', yPos)
              .attr('stroke', '#333')
              .attr('stroke-width', 1)
              .attr('stroke-dasharray', '2,2');
          }
        });
        if (isAnnualMode) {
          // Annual mode: Add grid lines for each month (0-11)
          for (let month = 0; month <= 11; month++) {
            const xPos = rescaledX(month);
            if (xPos >= 0 && xPos <= width) {
              svg.append('line')
                .attr('class', 'month-grid-line')
                .attr('x1', xPos)
                .attr('y1', 0)
                .attr('x2', xPos)
                .attr('y2', height)
                .attr('stroke', '#333')
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '2,2');
            }
          }
        } else {
          // Regular mode: Add grid lines only on January 1st
          const januaryFirstDates = allDates.filter(d => d.getUTCMonth() === 0 && d.getUTCDate() === 1 && rescaledX(d) >= 0 && rescaledX(d) <= width);
          januaryFirstDates.forEach(d => {
            svg.append('line')
              .attr('class', 'year-grid-line')
              .attr('x1', rescaledX(d))
              .attr('y1', 0)
              .attr('x2', rescaledX(d))
              .attr('y2', height)
              .attr('stroke', '#333')
              .attr('stroke-width', 1)
              .attr('stroke-dasharray', '2,2');
          });
        }

        // Update y axes
        svg.select('.left-axis').call(d3.axisLeft(rescaledLeftY).ticks(5).tickFormat(abbreviateNumber).tickPadding(5));
        if (rightAxisMetrics.length > 0) {
          svg.select('.right-axis').call(d3.axisRight(rescaledRightY).ticks(5).tickFormat(abbreviateNumber).tickPadding(5));
        }

        // Redraw metrics
        svg.selectAll('.metric-line, .metric-dot, .metric-hover, .metric-bar, .metric-bar-hover').remove();
        this.drawMetrics(svg, rescaledX, rescaledLeftY, rescaledRightY, width, height);
      });

    d3.select('#metrics-chart').call(zoom);
    d3.select('#metrics-chart').call(zoom.transform, this.state.zoomTransform);
    d3.select('#metrics-chart').on('dblclick.zoom', () => {
      svg.transition().call(zoom.transform, d3.zoomIdentity);
    });
  }
};

// Get domain for an axis based on metrics
HMB.getAxisDomain = function(metrics) {
  if (metrics.length === 0) return [0, 1];

  let min = 0; // Always start at 0
  let max = 0;

  metrics.forEach(metric => {
    // Pass filter context for calculated metrics
    const metricData = this.getMetricData(metric.path, metric.filterContext);
    metricData.forEach(dataPoint => {
      if (typeof dataPoint.value === 'number') {
        max = Math.max(max, dataPoint.value);
      }
    });
  });

  // Add 10% padding if we have a valid max value
  if (max > 0) {
    const padding = max * 0.1;
    return [0, max + padding];
  } else {
    return [0, 1];
  }
};

// Draw metrics on the chart
HMB.drawMetrics = function(svg, xScale, leftYScale, rightYScale, width, height) {
  const isAnnualMode = this.state.chartMode === 'annual';
  
  const lineGenerator = d3.line()
    .x(d => xScale(d.date))
    .y(d => {
      const metric = this.state.selectedMetrics.find(m => m.path === d.metricPath);
      return metric.axis === 'left' ? leftYScale(d.value) : rightYScale(d.value);
    })
    .curve(d3.curveMonotoneX);

  // In annual mode, we need to group data by year and create separate series
  if (isAnnualMode) {
    this.drawAnnualModeMetrics(svg, xScale, leftYScale, rightYScale, width, height);
    return;
  }

  this.state.selectedMetrics.forEach(metric => {
    // Prepare data for this metric
    const metricData = this.getMetricData(metric.path, metric.filterContext).map(dataPoint => {
      const [year, month, day] = dataPoint.date.split('-').map(Number);
      return {
        date: new Date(Date.UTC(year, month - 1, day, 0, 0, 0)),
        value: typeof dataPoint.value === 'number' ? dataPoint.value : null,
        metricPath: metric.path
      };
    });

    // Determine which scale to use
    const yScale = metric.axis === 'left' ? leftYScale : rightYScale;

    const [minX, maxX] = xScale.domain();
    const [minY, maxY] = yScale.domain();
    const validPoints = metric.type === 'line'
      ? metricData.filter(d => d.value !== null && d.value !== undefined)
      : metricData.filter(d => d.value !== null && d.value !== undefined && d.date >= minX && d.date <= maxX && d.value >= minY && d.value <= maxY);
    // console.log(`  ✅ Valid data points for "${metric.path}": ${validPoints.length}/${metricData.length}`);
    // if (validPoints.length === 0) {
    //   console.log(`  ❌ NO VALID DATA POINTS - this is why the metric doesn't show!`);
    // }

    // Draw line
    if (metric.type === 'line') {
      // Determine line width and dash array based on lineStyle
      let lineWidth = 2;
      let strokeDasharray = null;

      switch (metric.lineStyle) {
        case 'thin':
          lineWidth = 1;
          break;
        case 'regular':
          lineWidth = 3;
          break;
        case 'thick':
          lineWidth = 6;
          break;
        case 'dashed':
          lineWidth = 3;
          strokeDasharray = '8,4';
          break;
        case 'dotted':
          lineWidth = 3;
          strokeDasharray = '2,4';
          break;
        default:
          lineWidth = 3;
      }

      const linePath = svg.append('path')
        .datum(validPoints)
        .attr('class', 'metric-line')
        .attr('d', lineGenerator)
        .attr('stroke', metric.color)
        .attr('fill', 'none')
        .attr('clip-path', 'url(#chart-clip)')
        .style('stroke-width', lineWidth + 'px');

      if (strokeDasharray) {
        linePath.style('stroke-dasharray', strokeDasharray);
      }

      // Add invisible larger hover areas for each data point
      svg.selectAll('.metric-hover-' + metric.path.replace(/\./g, '-'))
        .data(validPoints)
        .enter()
        .append('circle')
        .attr('class', 'metric-hover')
        .attr('cx', d => xScale(d.date))
        .attr('cy', d => yScale(d.value))
        .attr('r', 10)
        .attr('fill', 'transparent')
        .attr('stroke', 'none')
        .attr('clip-path', 'url(#chart-clip)')
        .on('mouseover', (event, d) => {
          this.showTooltip(event, d, metric);
        })
        .on('mouseout', () => {
          this.hideTooltip();
        });

      // Add visible dots for each data point
      svg.selectAll('.metric-dot-' + metric.path.replace(/\./g, '-'))
        .data(validPoints)
        .enter()
        .append('circle')
        .attr('class', 'metric-dot')
        .attr('cx', d => xScale(d.date))
        .attr('cy', d => yScale(d.value))
        .attr('r', 4)
        .attr('fill', `url(#gradient-${metric.path.replace(/[^a-zA-Z0-9]/g, '_')})`)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)
        .attr('clip-path', 'url(#chart-clip)');
    } else if (metric.type === 'bar') {
      // Determine bar stroke width based on lineStyle
      let strokeWidth = 1;

      switch (metric.lineStyle) {
        case 'thin':
          strokeWidth = 1;
          break;
        case 'regular':
          strokeWidth = 2;
          break;
        case 'thick':
          strokeWidth = 3;
          break;
        case 'dashed':
          strokeWidth = 2;
          break;
        case 'dotted':
          strokeWidth = 2;
          break;
        default:
          strokeWidth = 2;
      }

      // Calculate bar width - use consistent width based on date range
      const dateRange = xScale.domain();
      const daysDiff = Math.ceil((dateRange[1] - dateRange[0]) / (24 * 60 * 60 * 1000)) + 1;
      const barWidth = Math.max(4, width / (daysDiff * 2));
      const cornerRadius = 3;

      // Function to create rounded top rectangle path
      const roundedTopRect = (x, y, w, h, r) => {
        return `M${x} ${y + r}
                Q${x} ${y} ${x + r} ${y}
                L${x + w - r} ${y}
                Q${x + w} ${y} ${x + w} ${y + r}
                L${x + w} ${y + h}
                L${x} ${y + h}
                Z`;
      };

      svg.selectAll('.metric-bar-' + metric.path.replace(/\./g, '-'))
        .data(validPoints)
        .enter()
        .append('path')
        .attr('class', 'metric-bar')
        .attr('d', d => {
          const barX = xScale(d.date) - barWidth / 2;
          const barY = yScale(d.value);
          const barHeight = height - yScale(d.value);
          return roundedTopRect(barX, barY, barWidth, barHeight, cornerRadius);
        })
        .attr('fill', `url(#gradient-${metric.path.replace(/[^a-zA-Z0-9]/g, '_')})`)
        .attr('clip-path', 'url(#chart-clip)')
        .style('stroke', metric.color)
        .style('stroke-width', strokeWidth + 'px');

      // Add invisible larger hover areas for each bar
      svg.selectAll('.metric-bar-hover-' + metric.path.replace(/\./g, '-'))
        .data(validPoints)
        .enter()
        .append('rect')
        .attr('class', 'metric-bar-hover')
        .attr('x', d => xScale(d.date) - barWidth / 2 - 5)
        .attr('y', 0)
        .attr('width', barWidth + 10)
        .attr('height', height)
        .attr('fill', 'transparent')
        .attr('stroke', 'none')
        .attr('clip-path', 'url(#chart-clip)')
        .on('mouseover', (event, d) => {
          this.showTooltip(event, d, metric);
        })
        .on('mouseout', () => {
          this.hideTooltip();
        });
    }
  });
};

// Draw metrics in annual mode - groups data by year and creates separate series
HMB.drawAnnualModeMetrics = function(svg, xScale, leftYScale, rightYScale, width, height) {
  // Get all unique years from the data
  const years = new Set();
  this.state.selectedMetrics.forEach(metric => {
    const metricData = this.getMetricData(metric.path, metric.filterContext);
    metricData.forEach(dataPoint => {
      const [year] = dataPoint.date.split('-').map(Number);
      years.add(year);
    });
  });
  
  const sortedYears = Array.from(years).sort();
  
  // Generate colors for each year (use different hues)
  const yearColors = {};
  sortedYears.forEach((year, index) => {
    const hue = (index * 360 / sortedYears.length) % 360;
    yearColors[year] = `hsl(${hue}, 70%, 50%)`;
  });
  
  // Create annual line generator (x is month index 0-11)
  const annualLineGenerator = d3.line()
    .x(d => xScale(d.month))
    .y(d => {
      const yScale = d.axis === 'left' ? leftYScale : rightYScale;
      return yScale(d.value);
    })
    .curve(d3.curveMonotoneX);
  
  // Draw each metric, grouped by year
  this.state.selectedMetrics.forEach(metric => {
    const metricData = this.getMetricData(metric.path, metric.filterContext);
    const yScale = metric.axis === 'left' ? leftYScale : rightYScale;
    
    // Group data by year
    const dataByYear = {};
    metricData.forEach(dataPoint => {
      const [year, month] = dataPoint.date.split('-').map(Number);
      if (!dataByYear[year]) {
        dataByYear[year] = [];
      }
      dataByYear[year].push({
        month: month - 1, // Convert to 0-11
        value: typeof dataPoint.value === 'number' ? dataPoint.value : null,
        year: year,
        axis: metric.axis
      });
    });
    
    // Draw a line for each year
    sortedYears.forEach(year => {
      const yearData = dataByYear[year];
      if (!yearData || yearData.length === 0) return;
      
      // Sort by month
      yearData.sort((a, b) => a.month - b.month);
      
      // Filter valid points
      const validPoints = yearData.filter(d => d.value !== null && d.value !== undefined);
      if (validPoints.length === 0) return;
      
      // Determine line style
      let lineWidth = 3;
      let strokeDasharray = null;
      
      switch (metric.lineStyle) {
        case 'thin':
          lineWidth = 1;
          break;
        case 'regular':
          lineWidth = 3;
          break;
        case 'thick':
          lineWidth = 6;
          break;
        case 'dashed':
          lineWidth = 3;
          strokeDasharray = '8,4';
          break;
        case 'dotted':
          lineWidth = 3;
          strokeDasharray = '2,4';
          break;
      }
      
      // Use metric color blended with year color, or just year color if only one metric
      const lineColor = this.state.selectedMetrics.length === 1
        ? yearColors[year]
        : metric.color;
      
      // Draw the line
      const linePath = svg.append('path')
        .datum(validPoints)
        .attr('class', 'metric-line')
        .attr('d', annualLineGenerator)
        .attr('stroke', lineColor)
        .attr('fill', 'none')
        .attr('clip-path', 'url(#chart-clip)')
        .style('stroke-width', lineWidth + 'px');
      
      if (strokeDasharray) {
        linePath.style('stroke-dasharray', strokeDasharray);
      }
      
      // Add dots for each data point
      svg.selectAll(`.metric-dot-${metric.path.replace(/[^a-zA-Z0-9]/g, '_')}-${year}`)
        .data(validPoints)
        .enter()
        .append('circle')
        .attr('class', 'metric-dot')
        .attr('cx', d => xScale(d.month))
        .attr('cy', d => yScale(d.value))
        .attr('r', 4)
        .attr('fill', lineColor)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)
        .attr('clip-path', 'url(#chart-clip)');
      
      // Add hover areas
      svg.selectAll(`.metric-hover-${metric.path.replace(/[^a-zA-Z0-9]/g, '_')}-${year}`)
        .data(validPoints)
        .enter()
        .append('circle')
        .attr('class', 'metric-hover')
        .attr('cx', d => xScale(d.month))
        .attr('cy', d => yScale(d.value))
        .attr('r', 10)
        .attr('fill', 'transparent')
        .attr('stroke', 'none')
        .attr('clip-path', 'url(#chart-clip)')
        .on('mouseover', (event, d) => {
          // Create a modified metric object for the tooltip
          const annualMetric = {
            ...metric,
            displayLabel: `${metric.displayLabel || metric.label} (${d.year})`,
            year: d.year
          };
          this.showAnnualTooltip(event, d, annualMetric);
        })
        .on('mouseout', () => {
          this.hideTooltip();
        });
    });
  });
  
  // Store year colors for legend
  this.state.yearColors = yearColors;
  this.state.sortedYears = sortedYears;
};

// Show tooltip for annual mode
HMB.showAnnualTooltip = function(event, d, metric) {
  // Clear any pending hide timeout
  if (this.tooltipHideTimeout) {
    clearTimeout(this.tooltipHideTimeout);
    this.tooltipHideTimeout = null;
  }
  
  const tooltip = this.state.elements.tooltip;
  if (!tooltip) return;
  
  // Get chart container bounds for proper positioning
  const chartContainer = this.state.elements.chartContainer;
  const containerRect = chartContainer ? chartContainer.getBoundingClientRect() : null;
  
  // Format the tooltip content
  const seriesName = metric.displayLabel || metric.label;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = monthNames[d.month];
  const value = typeof d.value === 'number' ? d.value.toLocaleString() : d.value;
  
  // In annual mode with single metric, use year color to match the line
  let lineColor = metric.color;
  if (this.state.chartMode === 'annual' && this.state.selectedMetrics.length === 1 && this.state.yearColors) {
    lineColor = this.state.yearColors[d.year] || metric.color;
  }
  
  // Set tooltip content with vertical colored line and dot
  tooltip.innerHTML = `
    <table style="border-collapse: collapse; margin: 0;">
      <tr>
        <td style="padding: 0 4.5px 0 0; vertical-align: middle;">
          <div style="position: relative; width: 12px; height: 100%; min-height: 50px;">
            <div style="position: absolute; left: 5px; top: 2px; bottom: 2px; width: 2px; background-color: ${lineColor};"></div>
            <div style="position: absolute; left: 2px; top: calc(50% - 4px); width: 8px; height: 8px; background-color: ${lineColor}; border-radius: 50%; border: 2px solid white;"></div>
          </div>
        </td>
        <td style="padding: 0; vertical-align: middle;">
          <div style="font-size: 0.8rem; line-height: 1.2;">
            <div><strong>${seriesName}</strong></div>
            <div>${monthName} ${d.year}</div>
            <div>Value: ${value}</div>
          </div>
        </td>
      </tr>
    </table>
  `;
  
  // Position tooltip near mouse cursor (relative to chart container)
  let x = event.clientX - (containerRect ? containerRect.left : 0) + 10;
  let y = event.clientY - (containerRect ? containerRect.top : 0) - 10;
  
  // If we have container bounds, ensure tooltip stays within chart area
  if (containerRect) {
    if (x + 200 > containerRect.width) {
      x = event.clientX - containerRect.left - 210;
    }
    if (y + 80 > containerRect.height) {
      y = event.clientY - containerRect.top - 90;
    }
    x = Math.max(10, Math.min(x, containerRect.width - 210));
    y = Math.max(10, Math.min(y, containerRect.height - 90));
  }
  
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
  
  // Set fade-in transition and show
  tooltip.style.transition = 'opacity 0.1s ease';
  tooltip.style.opacity = '1';
  tooltip.classList.add('visible');
};

// Show tooltip on hover
HMB.showTooltip = function(event, d, metric) {
  // Clear any pending hide timeout
  if (this.tooltipHideTimeout) {
    clearTimeout(this.tooltipHideTimeout);
    this.tooltipHideTimeout = null;
  }

  const tooltip = this.state.elements.tooltip;
  if (!tooltip) return;

  // Get chart container bounds for proper positioning
  const chartContainer = this.state.elements.chartContainer;
  const containerRect = chartContainer ? chartContainer.getBoundingClientRect() : null;

  // Format the tooltip content
  const seriesName = metric.displayLabel || metric.label;
  // Calculate date from mouse position using current rescaled x-scale
  const mouseX = event.clientX - containerRect.left - this.config.chartSettings.margin.left;
  const dateObj = this.currentXScale.invert(mouseX);
  const date = d3.utcFormat('%Y-%m-%d')(dateObj);
  const value = typeof d.value === 'number' ? d.value.toLocaleString() : d.value;

  // Set tooltip content with vertical colored line and dot
  tooltip.innerHTML = `
    <table style="border-collapse: collapse; margin: 0;">
      <tr>
        <td style="padding: 0 8px 0 0; vertical-align: middle;">
          <div style="position: relative; width: 12px; height: 100%; min-height: 50px;">
            <div style="position: absolute; left: 5px; top: 2px; bottom: 2px; width: 2px; background-color: ${metric.color};"></div>
            <div style="position: absolute; left: 2px; top: calc(50% - 4px); width: 8px; height: 8px; background-color: ${metric.color}; border-radius: 50%; border: 2px solid white;"></div>
          </div>
        </td>
        <td style="padding: 0; vertical-align: middle;">
          <div style="font-size: 0.8rem; line-height: 1.2;">
            <div><strong>${seriesName}</strong></div>
            <div>${date}</div>
            <div>Value: ${value}</div>
          </div>
        </td>
      </tr>
    </table>
  `;

  // Position tooltip near mouse cursor (relative to chart container)
  let x = event.clientX - containerRect.left + 10;
  let y = event.clientY - containerRect.top - 10;

  // If we have container bounds, ensure tooltip stays within chart area
  if (containerRect) {
    // Adjust if tooltip would go outside chart container
    if (x + 200 > containerRect.width) { // Assume tooltip width ~200px
      x = event.clientX - containerRect.left - 210;
    }
    if (y + 80 > containerRect.height) { // Assume tooltip height ~80px
      y = event.clientY - containerRect.top - 90;
    }

    // Ensure tooltip stays within container bounds
    x = Math.max(10, Math.min(x, containerRect.width - 210));
    y = Math.max(10, Math.min(y, containerRect.height - 90));
  } else {
    // Fallback to viewport bounds if container not found
    if (x + 200 > window.innerWidth) {
      x = event.clientX - 210;
    }
    if (y + 80 > window.innerHeight) {
      y = event.clientY - 90;
    }
    x = Math.max(10, Math.min(x, window.innerWidth - 210));
    y = Math.max(10, Math.min(y, window.innerHeight - 90));
  }

  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;

  // Set fade-in transition and show
  tooltip.style.transition = 'opacity 0.1s ease';
  tooltip.style.opacity = '1';
  tooltip.classList.add('visible');
};

// Hide tooltip with delay to reduce flicker
HMB.hideTooltip = function() {
  const tooltip = this.state.elements.tooltip;
  if (tooltip) {
    // Clear any existing hide timeout
    if (this.tooltipHideTimeout) {
      clearTimeout(this.tooltipHideTimeout);
    }
    // Delay hide by 200ms to reduce flicker
    this.tooltipHideTimeout = setTimeout(() => {
      tooltip.style.transition = 'opacity 0.5s ease';
      tooltip.style.opacity = '0';
      tooltip.classList.remove('visible');
      this.tooltipHideTimeout = null;
    }, 200);
  }
};

// Draw legend in SVG
HMB.drawLegend = function(svg, width, height) {
  // Create legend group - position it within the visible chart area
  const legendGroup = svg.append('g')
    .attr('class', 'chart-legend')
    .attr('transform', `translate(0, ${height + 115})`);

  // In annual mode with a single metric, show years in legend
  let legendData;
  let useYearColors = false;
  
  if (this.state.chartMode === 'annual' && this.state.selectedMetrics.length === 1 && this.state.sortedYears) {
    // Create legend items for each year
    legendData = this.state.sortedYears.map(year => ({
      displayLabel: String(year),
      color: this.state.yearColors[year],
      isYear: true
    }));
    useYearColors = true;
  } else {
    // Regular legend - show metrics
    legendData = this.state.selectedMetrics.slice().sort((a, b) =>
      (a.displayLabel || a.label).localeCompare(b.displayLabel || b.label)
    );
  }

  // Calculate widths for each legend item
  const tempText = legendGroup.append('text')
    .attr('font-size', '0.85rem')
    .style('visibility', 'hidden');
  const itemWidths = legendData.map(d => {
    const label = d.displayLabel || d.label;
    tempText.text(label);
    let textWidth;
    if (this.state.isHeadless) {
      textWidth = label.length * 8;
    } else {
      textWidth = tempText.node().getBBox().width;
    }
    return 15 + 5 + textWidth + 5; // color 15 + space 5 + text + padding 5
  });
  tempText.remove();

  const totalLegendWidth = itemWidths.reduce((sum, w, i) => sum + w + (i < itemWidths.length - 1 ? 20 : 0), 0);
  const startX = (width - totalLegendWidth) / 2;
  const positions = [];
  let currentX = startX;
  for (let i = 0; i < itemWidths.length; i++) {
    positions.push(currentX);
    currentX += itemWidths[i] + (i < itemWidths.length - 1 ? 20 : 0);
  }

  const legendItems = legendGroup.selectAll('.legend-item')
    .data(legendData)
    .enter()
    .append('g')
    .attr('class', 'legend-item')
    .attr('transform', (d, i) => `translate(${positions[i]}, 0)`);

  // Add color swatches
  legendItems.append('rect')
    .attr('class', 'legend-color')
    .attr('width', 15)
    .attr('height', 4)
    .attr('x', 0)
    .attr('y', -6)
    .attr('fill', d => d.color)
    .attr('rx', 1);

  // Add legend labels using display label for consistency
  legendItems.append('text')
    .attr('class', 'legend-label')
    .attr('x', 20)
    .attr('y', 0)
    .attr('fill', this.state.isHeadless ? '#ffffff' : 'var(--text-color)')
    .attr('font-family', '"Vanadium Sans Semi-Extended", Tahoma, Geneva, Verdana, sans-serif')
    .attr('font-size', '0.85rem')
    .text(d => d.displayLabel || d.label);
};