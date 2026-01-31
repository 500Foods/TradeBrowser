/**
 * Trade Browser - Data Processing Functions
 * Data processing, metric extraction, and filtering
 *
 * @version 1.0.0
 * @license MIT
 */

// Extend the global namespace
var HMB = HMB || {};

// Extract available metrics from trade data
HMB.extractAvailableMetrics = function() {
  if (this.state.tradeData.length === 0) return;

  // Extract unique metric combinations from trade data
  const metrics = [];
  const uniqueMetrics = new Set();

  this.state.tradeData.forEach(row => {
    // Create a unique metric key based on Trade, GeographicDesc, Group, Subgroup, 
    // MarketSegment, CommodityName, CommodityDetail, UnitType, and UnitDesc
    const metricKey = `${row.Trade}|${row.GeographicDesc}|${row.Group}|${row.Subgroup}|${row.MarketSegment}|${row.CommodityName}|${row.CommodityDetail}|${row.UnitType}|${row.UnitDesc}`;
    
    if (!uniqueMetrics.has(metricKey)) {
      uniqueMetrics.add(metricKey);
      
      const metricPath = metricKey.replace(/\s+/g, '_').replace(/\|/g, '.');
      
      metrics.push({
        path: metricPath,
        label: this.createTradeMetricLabel(row),
        context: {
          trade: row.Trade,
          country: row.GeographicDesc,
          group: row.Group,
          subgroup: row.Subgroup,
          marketSegment: row.MarketSegment,
          commodity: row.CommodityName,
          commodityDetail: row.CommodityDetail,
          unitType: row.UnitType,
          unitDesc: row.UnitDesc
        }
      });
    }
  });

  this.state.availableMetrics = metrics;

  // Update metric count display
  const metricCountElement = document.getElementById('metric-count');
  if (metricCountElement) {
    metricCountElement.textContent = `(${this.state.availableMetrics.length})`;
  }

  // Update the selected metrics UI
  this.updateSelectedMetricsUI();

  // Initialize the new filter system
  if (this.initFilters) {
    this.initFilters();
  }

  console.log('Available metrics extracted:', this.state.availableMetrics.length);
};

// Create a human-readable metric label from a trade data row
HMB.createTradeMetricLabel = function(row) {
  const parts = [];
  
  parts.push(row.Trade);
  parts.push(row.GeographicDesc);
  
  if (row.Group && row.Group !== 'Unspecified') parts.push(row.Group);
  if (row.Subgroup && row.Subgroup !== 'Unspecified') parts.push(row.Subgroup);
  if (row.MarketSegment && row.MarketSegment !== 'Unspecified') parts.push(row.MarketSegment);
  if (row.CommodityName && row.CommodityName !== 'Unspecified') parts.push(row.CommodityName);
  if (row.CommodityDetail && row.CommodityDetail !== 'Unspecified') parts.push(row.CommodityDetail);
  
  parts.push(row.UnitType);
  
  return parts.join(' - ');
};

// Recursively extract numeric values from nested JSON with enhanced labeling
HMB.extractNumericValues = function(data, path = '', context = {}) {
  const results = [];

  // Special handling for cloc data - flatten by language
  if (path === 'cloc.main' && Array.isArray(data)) {
    data.forEach(item => {
      if (item.language) {
        const languageKey = item.language.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        const languagePath = `cloc.main.${languageKey}`;
        results.push(...this.extractNumericValues(item, languagePath, context));
      }
    });
    return results;
  }

  for (const [key, value] of Object.entries(data)) {
    // Build path based on data type
    let newPath;
    if (Array.isArray(data)) {
      // When data is an array, we're iterating over indices
      // The path should include the array index
      newPath = `${path}[${key}]`;
    } else {
      // For regular objects, use dot notation
      newPath = path ? `${path}.${key}` : key;
    }

    const newContext = {...context};

    // Handle special cases for better labeling
    if (Array.isArray(data)) {
      // For arrays, use the index but also capture identifying fields
      const index = parseInt(key);
      if (data[index] && typeof data[index] === 'object') {
        // Capture identifying fields from array items
        if (data[index].test_id) newContext.test_id = data[index].test_id;
        if (data[index].language) newContext.language = data[index].language;
        if (data[index].file_path) newContext.file_path = data[index].file_path;
        if (data[index].metric) newContext.metric = data[index].metric;
      }
    }

    // Handle numeric strings (percentages, comma-separated numbers, and numbers with units)
    if (typeof value === 'string') {
      // Clean the string: remove commas, spaces, and units
      const cleanedValue = value.replace(/,/g, '').replace(/\s*(KB|MB|GB|%)?$/i, '');
      const numericValue = parseFloat(cleanedValue);
      if (!isNaN(numericValue)) {
        const cleanPath = this.createCleanMetricPath(newPath, newContext);
        results.push({
          path: cleanPath, // Use clean path as primary identifier
          value: numericValue,
          label: this.createEnhancedMetricLabel(cleanPath, newContext), // Use clean path for labeling too
          originalPath: newPath, // Store original path for data lookup
          context: newContext // Store context for reference
        });
      }
    }
    else if (typeof value === 'number') {
      const cleanPath = this.createCleanMetricPath(newPath, newContext);
      results.push({
        path: cleanPath, // Use clean path as primary identifier
        value: value,
        label: this.createEnhancedMetricLabel(cleanPath, newContext), // Use clean path for labeling too
        originalPath: newPath, // Store original path for data lookup
        context: newContext // Store context for reference
      });
    }
    else if (typeof value === 'object' && value !== null) {
      // Handle arrays and objects with enhanced context
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          const itemPath = `${path}.${key}[${index}]`;
          if (typeof item === 'object' && item !== null) {
            // Create array-specific context
            const arrayContext = {...newContext};
            if (item.test_id) arrayContext.test_id = item.test_id;
            if (item.language) arrayContext.language = item.language;
            if (item.file_path) arrayContext.file_path = item.file_path;
            if (item.metric) arrayContext.metric = item.metric;

            // Pass the correct array path with index
            results.push(...this.extractNumericValues(item, itemPath, arrayContext));
          } else if (typeof item === 'number') {
            const arrayContext = {...newContext};
            const cleanPath = this.createCleanMetricPath(itemPath, arrayContext);
            results.push({
              path: cleanPath,
              value: item,
              label: this.createEnhancedMetricLabel(itemPath, arrayContext),
              originalPath: itemPath,
              context: arrayContext
            });
          } else if (typeof item === 'string') {
            // Clean the string: remove commas, spaces, and units
            const cleanedValue = item.replace(/,/g, '').replace(/\s*(KB|MB|GB|%)?$/i, '');
            const numericValue = parseFloat(cleanedValue);
            if (!isNaN(numericValue)) {
              const arrayContext = {...newContext};
              const cleanPath = this.createCleanMetricPath(itemPath, arrayContext);
              results.push({
                path: cleanPath,
                value: numericValue,
                label: this.createEnhancedMetricLabel(itemPath, arrayContext),
                originalPath: itemPath,
                context: arrayContext
              });
            }
          }
        });
      } else {
        results.push(...this.extractNumericValues(value, newPath, newContext));
      }
    }
  }

  return results;
};

// Helper function to extract context from a path
HMB.getContextForPath = function(path) {
  const context = {};

  // Try to extract context from the path pattern
  if (path.includes('test_results.data')) {
    // Extract test_id from path like "test_results.data.01-CMP.elapsed"
    const match = path.match(/test_results\.data\.([^.]+)\./);
    if (match && match[1]) {
      context.test_id = match[1];
    }
  }
  else if (path.includes('cloc.main')) {
    // Extract language from path like "cloc.main.C.1000"
    const match = path.match(/cloc\.main\.([^.]+)\./);
    if (match && match[1]) {
      context.language = match[1];
    }
  }
  else if (path.includes('coverage.data')) {
    // Extract file info from path like "coverage.data.src_main_c.95.5"
    const match = path.match(/coverage\.data\.([^.]+)\./);
    if (match && match[1]) {
      context.file_path = match[1];
    }
  }
  else if (path.includes('stats')) {
    // Extract metric from path like "stats.performance.avg_time"
    const match = path.match(/stats\.([^.]+)\./);
    if (match && match[1]) {
      context.metric = match[1];
    }
  }

  return context;
};

// Create a human-readable label from a metric path
HMB.createMetricLabel = function(path) {
  return path
    .replace(/\./g, ' ')
    .replace(/\[/g, ' ')
    .replace(/\]/g, '')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
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

// Create a clean metric path that uses descriptive identifiers instead of array indices
HMB.createCleanMetricPath = function(path, context) {
  // Handle test_results.data array items
  if (path.includes('test_results.data') && context.test_id) {
    return path.replace(/test_results\.data\[\d+\]/, `test_results.data.${context.test_id}`);
  }
  // Handle cloc.main array items - this is the key fix for the Shell/Markdown issue
  else if (path.includes('cloc.main') && context.language) {
    return path.replace(/cloc\.main\[\d+\]/, `cloc.main.${context.language.replace(/\s+/g, '_').replace(/\//g, '_')}`);
  }
  // Handle stats array items
  else if (path.includes('stats') && context.metric) {
    return path.replace(/stats\[\d+\]/, `stats.${context.metric}`);
  }
  // Handle coverage.data array items
  else if (path.includes('coverage.data') && context.file_path) {
    // Clean up file_path by removing color codes and .c suffix
    const cleanFilePath = context.file_path
      .replace(/\{.*?\}/g, '') // Remove {COLOR} codes
      .replace(/\.c$/, '')     // Remove .c suffix
      .replace(/[^a-zA-Z0-9_\.\/]/g, '_'); // Replace special chars with underscore
    return path.replace(/coverage\.data\[\d+\]/, `coverage.data.${cleanFilePath}`);
  }
  // For other arrays, try to find a meaningful identifier
  else if (path.includes('[') && path.includes(']')) {
    // If we have any context, use it
    if (context.test_id) {
      return path.replace(/\[\d+\]/, `.${context.test_id}`);
    } else if (context.language) {
      return path.replace(/\[\d+\]/, `.${context.language.replace(/\s+/g, '_')}`);
    } else if (context.metric) {
      return path.replace(/\[\d+\]/, `.${context.metric}`);
    }
  }

  // Default: return original path if no special handling
  return path;
};

// Create an enhanced metric label with descriptive information
HMB.createEnhancedMetricLabel = function(path, context) {
  // Handle test_results.data items
  if (path.includes('test_results.data') && context.test_id) {
    const baseLabel = path
      .replace('test_results.data', `Test ${context.test_id}`)
      .replace(/\[/g, ' ')
      .replace(/\]/g, '')
      .replace(/\./g, ' ');
    return `${baseLabel} (${context.test_id})`;
  }
  // Handle cloc.main items
  else if (path.includes('cloc.main') && context.language) {
    const baseLabel = path
      .replace('cloc.main', `CLOC ${context.language}`)
      .replace(/\[/g, ' ')
      .replace(/\]/g, '')
      .replace(/\./g, ' ');
    return `${baseLabel} (${context.language})`;
  }
  // Handle stats items
  else if (path.includes('stats') && context.metric) {
    const baseLabel = path
      .replace('stats', `Stats ${context.metric}`)
      .replace(/\[/g, ' ')
      .replace(/\]/g, '')
      .replace(/\./g, ' ');
    return `${baseLabel} (${context.metric})`;
  }
  // Handle coverage.data items
  else if (path.includes('coverage.data') && context.file_path) {
    const cleanFilePath = context.file_path
      .replace(/\{.*?\}/g, '') // Remove {COLOR} codes
      .replace(/\.c$/, '');    // Remove .c suffix
    const baseLabel = path
      .replace('coverage.data', `Coverage ${cleanFilePath}`)
      .replace(/\[/g, ' ')
      .replace(/\]/g, '')
      .replace(/\./g, ' ');
    return `${baseLabel} (${cleanFilePath})`;
  }

  // Default labeling for other cases
  return this.createMetricLabel(path);
};

// Get nested value from object using dot notation (enhanced to handle our clean paths)
HMB.getNestedValue = function(obj, path) {
  // Always use the clean path with identifier-based lookup
  // This ensures we find the correct data regardless of array order in each file
  const result = this.getNestedValueByPath(obj, path);
  return result;
};

// Helper function to get value by exact path
// Enhanced to handle both clean paths (test_results.data.01-CMP.elapsed)
// and original array paths (test_results.data[0].elapsed)
HMB.getNestedValueByPath = function(obj, path) {
  // First, try to handle clean paths by converting them to array access
  if (path.includes('test_results.data.') && !path.includes('[')) {
    // Convert clean path like "test_results.data.01-CMP.elapsed" to array access
    const match = path.match(/test_results\.data\.([^.]+)\.(.+)/);
    if (match) {
      const testIdFromPath = match[1];
      const remainingPath = match[2];

      // Find the array index for this test_id
      const dataArray = obj?.test_results?.data;
      if (Array.isArray(dataArray)) {
        for (let i = 0; i < dataArray.length; i++) {
          // Normalize both identifiers for comparison (though test IDs are typically already normalized)
          const jsonTestId = dataArray[i]?.test_id;
          if (jsonTestId) {
            const normalizedJsonTestId = jsonTestId.replace(/\s+/g, '_').replace(/\//g, '_');
            if (normalizedJsonTestId === testIdFromPath || jsonTestId === testIdFromPath) {
              // Found the matching test, now get the remaining path
              const result = this.getNestedValueByPath(dataArray[i], remainingPath);
              return result;
            }
          }
        }
      }
      return undefined;
    }
  }
  else if (path.includes('cloc.main.') && !path.includes('[')) {
    // Convert clean path like "cloc.main.C.1000" or "cloc.main.C_C++_Header.code" to array access
    const match = path.match(/cloc\.main\.([^.]+)\.(.+)/);
    if (match) {
      const languageFromPath = match[1];
      const remainingPath = match[2];

      // Find the array index for this language
      const mainArray = obj?.cloc?.main;
      if (Array.isArray(mainArray)) {
        for (let i = 0; i < mainArray.length; i++) {
          // Normalize both the path language and JSON language for comparison
          // The path may have underscores where the JSON has spaces or slashes
          const jsonLanguage = mainArray[i]?.language;
          if (jsonLanguage) {
            const normalizedJsonLanguage = jsonLanguage.replace(/\s+/g, '_').replace(/\//g, '_');
            if (normalizedJsonLanguage === languageFromPath) {
              // Found the matching language, now get the remaining path
              return this.getNestedValueByPath(mainArray[i], remainingPath);
            }
          }
        }
      }
      return undefined;
    }
  }
  else if (path.includes('coverage.data.') && !path.includes('[')) {
      // Convert clean path like "coverage.data.src/api/api_service.c.coverage_percentage" to array access
      // Need to handle file paths that contain dots by matching from the end
      const lastDotIndex = path.lastIndexOf('.');
      const filePathFromPath = path.substring('coverage.data.'.length, lastDotIndex);
      const remainingPath = path.substring(lastDotIndex + 1);

      // Find the array index for this file_path
      const dataArray = obj?.coverage?.data;
      if (Array.isArray(dataArray)) {
          for (let i = 0; i < dataArray.length; i++) {
              // Normalize both file paths for comparison
              const jsonFilePath = dataArray[i]?.file_path;
              if (jsonFilePath) {
                  const normalizedJsonFilePath = jsonFilePath.replace(/\s+/g, '_').replace(/\//g, '_');
                  if (normalizedJsonFilePath === filePathFromPath || jsonFilePath === filePathFromPath) {
                      // Found the matching file, now get the remaining path
                      return this.getNestedValueByPath(dataArray[i], remainingPath);
                  }
              }
          }
      }
      return undefined;
  }
  else if (path.includes('.stats.') && !path.includes('[')) {
    // Handle nested stats like "cloc.stats.metric.value"
    const statsPathMatch = path.match(/(.+)\.stats\.([^.]+)\.(.+)/);
    if (statsPathMatch) {
      const prefix = statsPathMatch[1]; // "cloc"
      const metricFromPath = statsPathMatch[2]; // "Unity Ratio"
      const remainingPath = statsPathMatch[3]; // "value"

      // First get the object containing stats
      const containerObj = this.getNestedValueByPath(obj, prefix);
      const statsArray = containerObj?.stats;
      if (Array.isArray(statsArray)) {
        for (let i = 0; i < statsArray.length; i++) {
          // Normalize both identifiers for comparison
          const jsonMetric = statsArray[i]?.metric;
          if (jsonMetric) {
            const normalizedJsonMetric = jsonMetric.replace(/\s+/g, '_').replace(/\//g, '_');
            if (normalizedJsonMetric === metricFromPath || jsonMetric === metricFromPath) {
              // Found the matching metric, now get the remaining path
              return this.getNestedValueByPath(statsArray[i], remainingPath);
            }
          }
        }
      }
      return undefined;
    }
  }
  else if (path.startsWith('stats.') && !path.includes('[')) {
    // Convert clean path like "stats.performance.avg_time" to array access (for root-level stats)
    const match = path.match(/^stats\.([^.]+)\.(.+)/);
    if (match) {
      const metricFromPath = match[1];
      const remainingPath = match[2];

      // Find the array index for this metric
      const statsArray = obj?.stats;
      if (Array.isArray(statsArray)) {
        for (let i = 0; i < statsArray.length; i++) {
          // Normalize both identifiers for comparison
          const jsonMetric = statsArray[i]?.metric;
          if (jsonMetric) {
            const normalizedJsonMetric = jsonMetric.replace(/\s+/g, '_').replace(/\//g, '_');
            if (normalizedJsonMetric === metricFromPath || jsonMetric === metricFromPath) {
              // Found the matching metric, now get the remaining path
              return this.getNestedValueByPath(statsArray[i], remainingPath);
            }
          }
        }
      }
      return undefined;
    }
  }

  // Handle original array notation paths like test_results.data[0].elapsed
  let result = path.split('.').reduce((o, p) => {
    // Handle array access like item[0]
    if (p.includes('[')) {
      const arrayPart = p.match(/^([^\[]+)\[(\d+)\]/);
      if (arrayPart) {
        const arrayName = arrayPart[1];
        const index = parseInt(arrayPart[2]);
        return (o || {})[arrayName] ? (o || {})[arrayName][index] : undefined;
      }
    }
    return (o || {})[p];
  }, obj);

  // Parse string values that contain numbers
  if (typeof result === 'string') {
    const cleanedValue = result.replace(/,/g, '').replace(/\s*(KB|MB|GB|%)?$/i, '');
    const numericValue = parseFloat(cleanedValue);
    if (!isNaN(numericValue)) {
      return numericValue;
    }
  }

  return result;
};

// Filter data by current date range
HMB.filterDataByDateRange = function() {
  if (!this.state.currentDateRange || !this.state.currentDateRange.start || !this.state.currentDateRange.end) {
    // No date range set, use all data
    this.state.filteredData = this.state.tradeData.map(row => {
      const dateStr = `${row.Year}-${String(row.MonthNumber).padStart(2, '0')}-01`;
      return {
        date: dateStr,
        data: row,
        hasData: true
      };
    });
    return;
  }

  const startDate = new Date(this.state.currentDateRange.start);
  const endDate = new Date(this.state.currentDateRange.end);

  // Filter trade data by date range
  this.state.filteredData = this.state.tradeData.filter(row => {
    // Create a date from Year and MonthNumber (use 1st of the month for comparison)
    const rowDate = new Date(row.Year, row.MonthNumber - 1, 1);
    return rowDate >= startDate && rowDate <= endDate;
  }).map(row => {
    const dateStr = `${row.Year}-${String(row.MonthNumber).padStart(2, '0')}-01`;
    return {
      date: dateStr,
      data: row,
      hasData: true
    };
  });

  console.log('Filtered trade data count:', this.state.filteredData.length, 'for date range:', this.state.currentDateRange.start, 'to', this.state.currentDateRange.end);
};

// Get data for a specific metric at each date
HMB.getMetricData = function(metricPath, filterContext) {
  // Check if this is a calculated metric by looking at the path
  // Calculated metric paths are in format: trade.country.group.subgroup.marketSegment.commodity.commodityDetail.calculatedType
  const pathParts = metricPath.split('.');
  const lastPart = pathParts[pathParts.length - 1];
  const isCalculatedMetric = this.isCalculatedUnitType && this.isCalculatedUnitType(lastPart);
  
  if (isCalculatedMetric) {
    // Pass the calculated type (last part of the path) and filter context to the data function
    return this.getCalculatedMetricData(lastPart, filterContext);
  }
  
  // Find the metric context from available metrics
  const metric = this.state.availableMetrics.find(m => m.path === metricPath);
  if (!metric) return [];

  // Filter trade data to match the metric context
  const filteredData = this.state.tradeData.filter(row => {
    return row.Trade === metric.context.trade &&
           row.GeographicDesc === metric.context.country &&
           row.Group === metric.context.group &&
           row.Subgroup === metric.context.subgroup &&
           row.MarketSegment === metric.context.marketSegment &&
           row.CommodityName === metric.context.commodity &&
           row.CommodityDetail === metric.context.commodityDetail &&
           row.UnitType === metric.context.unitType &&
           row.UnitDesc === metric.context.unitDesc;
  });

  // Return data points with date and value
  return filteredData.map(row => {
    const dateStr = `${row.Year}-${String(row.MonthNumber).padStart(2, '0')}-01`;
    return {
      date: dateStr,
      value: row.Amount
    };
  });
};

// Get data for calculated metrics (Volume_t, Price_per_kg, Price_per_lb)
HMB.getCalculatedMetricData = function(calculatedType, filterContext) {
  // Use provided filter context or fall back to current filter state
  const fs = filterContext || this.filterState || {};
  
  // Find matching Value and Volume data
  const valueData = [];
  const volumeData = [];
  
  // Filter trade data to match the context
  this.state.tradeData.forEach(row => {
    if (row.Trade !== fs.trade) return;
    if (row.GeographicDesc !== fs.country) return;
    if (row.CommodityName !== fs.commodity) return;
    
    // Group/Subgroup/MarketSegment/CommodityDetail filters if set
    if (fs.group && row.Group !== fs.group) return;
    if (fs.subgroup && row.Subgroup !== fs.subgroup) return;
    if (fs.marketSegment && row.MarketSegment !== fs.marketSegment) return;
    if (fs.commodityDetail && row.CommodityDetail !== fs.commodityDetail) return;
    
    // Check year filter - only apply if years is set and not empty
    if (fs.years && fs.years.size > 0 && !fs.years.has(row.Year)) return;
    
    const dateStr = `${row.Year}-${String(row.MonthNumber).padStart(2, '0')}-01`;
    
    if (row.UnitType === 'Value') {
      valueData.push({ date: dateStr, value: row.Amount });
    } else if (row.UnitType === 'Volume') {
      volumeData.push({ date: dateStr, value: row.Amount });
    }
  });
  
  // Create a map of volume data by date for easy lookup
  const volumeByDate = {};
  volumeData.forEach(item => {
    volumeByDate[item.date] = item.value;
  });
  
  // Calculate the requested metric
  const result = [];
  
  valueData.forEach(valueItem => {
    const date = valueItem.date;
    const value = valueItem.value; // Value in '000 USD
    const volume = volumeByDate[date]; // Volume in '000 lbs
    
    if (volume === undefined || volume === 0) return; // Skip if no matching volume data
    
    let calculatedValue;
    
    switch (calculatedType) {
      case 'Volume_t':
        // Volume in metric tons = Volume ('000 lbs) / 2.2046
        calculatedValue = volume * (this.LBS_TO_METRIC_TONS || 0.453592);
        break;
        
      case 'Price_per_lb':
        // Price per lb = (Value in '000 USD) / (Volume in '000 lbs)
        // = (Value * 1000 USD) / (Volume * 1000 lbs) = USD per lb
        calculatedValue = value / volume;
        break;
        
      case 'Price_per_kg':
        // Price per kg = Price per lb * 2.2046
        // = (Value / Volume) * 2.2046 USD per kg
        calculatedValue = (value / volume) * 2.2046;
        break;
        
      default:
        calculatedValue = null;
    }
    
    if (calculatedValue !== null && !isNaN(calculatedValue) && isFinite(calculatedValue)) {
      result.push({
        date: date,
        value: calculatedValue
      });
    }
  });
  
  return result.sort((a, b) => new Date(a.date) - new Date(b.date));
};