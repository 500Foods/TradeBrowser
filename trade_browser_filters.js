/**
 * Trade Browser - Filter System
 * Cascading filter logic for Trade, Country, Commodity, Unit Type, and Year
 *
 * @version 1.1.0
 * @license MIT
 */

// Extend the global namespace
var HMB = HMB || {};

// Filter state
HMB.filterState = {
  trade: '',
  country: '',
  group: '',
  subgroup: '',
  marketSegment: '',
  commodity: '',
  commodityDetail: '',
  unitType: '',
  years: new Set(),
  availableYears: [],
  availableCountries: [],
  availableGroups: [],
  availableSubgroups: [],
  availableMarketSegments: [],
  availableCommodities: [],
  availableCommodityDetails: [],
  availableUnitTypes: [],
  filteredMetrics: []
};

// Filter hierarchy - order matters for progressive filtering
HMB.filterHierarchy = [
  'trade',
  'country',
  'group',
  'subgroup',
  'marketSegment',
  'commodity',
  'commodityDetail',
  'unitType'
];

// Default filter values
HMB.defaultFilterValues = {
  trade: 'Import',
  country: 'Canada',
  group: 'Vegetables',
  subgroup: 'Vegetables',
  marketSegment: 'Fresh'
  // unitType is determined dynamically based on available options
};

// Display labels for unit types
HMB.unitTypeLabels = {
  'Value': "Value ('000 USD)",
  'Volume': "Volume ('000 lbs)",
  'Unit Value': "Unit Value ($/lb)"
};

// Calculated metric types
HMB.calculatedUnitTypes = ['Volume_t', 'Price_per_kg', 'Price_per_lb'];

// Labels for calculated unit types
HMB.calculatedUnitTypeLabels = {
  'Volume_t': "Volume (t)",
  'Price_per_kg': "Price (USD $/kg)",
  'Price_per_lb': "Price (USD $/lb)"
};

// Conversion factor: 1 lb = 0.453592 kg, so 1000 lbs = 0.453592 metric tons
// But Volume is in '000 lbs, so Volume in metric tons = Volume ('000 lbs) / 2.2046
HMB.LBS_TO_METRIC_TONS = 1 / 2.2046;  // 0.453592

// Check if a unit type is a calculated metric
HMB.isCalculatedUnitType = function(unitType) {
  return this.calculatedUnitTypes.includes(unitType);
};

// Get display label for a unit type
HMB.getUnitTypeLabel = function(unitType) {
  if (this.unitTypeLabels[unitType]) {
    return this.unitTypeLabels[unitType];
  }
  if (this.calculatedUnitTypeLabels[unitType]) {
    return this.calculatedUnitTypeLabels[unitType];
  }
  return unitType;
};

// Initialize filters after data is loaded
HMB.initFilters = function() {
  if (!this.state.tradeData || this.state.tradeData.length === 0) {
    console.warn('No trade data available for filters');
    return;
  }

  // Pre-build trade data lookup for performance
  this._tradeDataLookup = this.buildTradeDataLookup();
  console.log('Trade data lookup built with', this._tradeDataLookup.size, 'entries');

  // Extract all unique values first
  this.extractFilterOptions();
  
  // Initialize year checkboxes (default all selected)
  this.initYearCheckboxes();
  
  // Initialize progressive filters with defaults
  this.initializeProgressiveFilters();
  
  // Set up event listeners
  this.setupFilterEventListeners();
  
  // Initial filter application (debounced to allow UI to render first)
  setTimeout(() => {
    this.applyFilters();
    console.log('Filters initialized successfully');
  }, 0);
};

// Extract unique filter options from trade data
HMB.extractFilterOptions = function() {
  const years = new Set();
  const countries = new Set();
  const groups = new Set();
  const subgroups = new Set();
  const marketSegments = new Set();
  const commodities = new Set();
  const commodityDetails = new Set();
  const unitTypes = new Set();

  this.state.tradeData.forEach(row => {
    years.add(row.Year);
    countries.add(row.GeographicDesc);
    if (row.Group) groups.add(row.Group);
    if (row.Subgroup) subgroups.add(row.Subgroup);
    if (row.MarketSegment) marketSegments.add(row.MarketSegment);
    if (row.CommodityName) commodities.add(row.CommodityName);
    if (row.CommodityDetail) commodityDetails.add(row.CommodityDetail);
    if (row.UnitType) unitTypes.add(row.UnitType);
  });

  // Store sorted arrays
  this.filterState.availableYears = Array.from(years).sort((a, b) => b - a); // Descending
  this.filterState.availableCountries = Array.from(countries).sort();
  this.filterState.availableGroups = Array.from(groups).sort();
  this.filterState.availableSubgroups = Array.from(subgroups).sort();
  this.filterState.availableMarketSegments = Array.from(marketSegments).sort();
  this.filterState.availableCommodities = Array.from(commodities).sort();
  this.filterState.availableCommodityDetails = Array.from(commodityDetails).sort();
  this.filterState.availableUnitTypes = Array.from(unitTypes).sort();

  // Default: select all years
  this.filterState.availableYears.forEach(year => this.filterState.years.add(year));

  console.log('Filter options extracted:', {
    years: this.filterState.availableYears.length,
    countries: this.filterState.availableCountries.length,
    groups: this.filterState.availableGroups.length,
    subgroups: this.filterState.availableSubgroups.length,
    marketSegments: this.filterState.availableMarketSegments.length,
    commodities: this.filterState.availableCommodities.length,
    commodityDetails: this.filterState.availableCommodityDetails.length,
    unitTypes: this.filterState.availableUnitTypes.length
  });
};

// Initialize year checkboxes
HMB.initYearCheckboxes = function() {
  const container = document.getElementById('year-checkboxes');
  if (!container) return;
  
  container.innerHTML = '';
  
  this.filterState.availableYears.forEach(year => {
    const checkbox = document.createElement('label');
    checkbox.className = 'year-checkbox checked';
    checkbox.innerHTML = `
      <input type="checkbox" value="${year}" checked>
      <span>${year}</span>
    `;
    
    // Add change handler
    const input = checkbox.querySelector('input');
    input.addEventListener('change', (e) => {
      if (e.target.checked) {
        this.filterState.years.add(parseInt(year));
        checkbox.classList.add('checked');
      } else {
        this.filterState.years.delete(parseInt(year));
        checkbox.classList.remove('checked');
      }
      this.applyFilters();
    });
    
    container.appendChild(checkbox);
  });
};

// Initialize progressive filters - set defaults and cascade updates
HMB.initializeProgressiveFilters = function() {
  // Start with trade filter
  const tradeSelect = document.getElementById('filter-trade');
  if (tradeSelect) {
    tradeSelect.value = this.defaultFilterValues.trade;
    this.filterState.trade = this.defaultFilterValues.trade;
  }
  
  // Cascade through all filters
  this.updateAllFilterOptions();
};

// Get available options for a filter based on current selections
HMB.getAvailableOptionsForFilter = function(filterName) {
  const options = new Set();
  
  // Get the filter index to know which filters come before it
  const filterIndex = this.filterHierarchy.indexOf(filterName);
  
  // Filter data based on all prior selections
  const filteredData = this.state.tradeData.filter(row => {
    // Check all filters that come before the current one
    for (let i = 0; i < filterIndex; i++) {
      const priorFilter = this.filterHierarchy[i];
      const filterValue = this.filterState[priorFilter];
      
      if (filterValue) {
        let rowValue;
        switch (priorFilter) {
          case 'trade': rowValue = row.Trade; break;
          case 'country': rowValue = row.GeographicDesc; break;
          case 'group': rowValue = row.Group; break;
          case 'subgroup': rowValue = row.Subgroup; break;
          case 'marketSegment': rowValue = row.MarketSegment; break;
          case 'commodity': rowValue = row.CommodityName; break;
          case 'commodityDetail': rowValue = row.CommodityDetail; break;
          case 'unitType': rowValue = row.UnitType; break;
        }
        
        if (rowValue !== filterValue) {
          return false;
        }
      }
    }
    return true;
  });
  
  // Extract unique values for the requested filter
  filteredData.forEach(row => {
    let value;
    switch (filterName) {
      case 'trade': value = row.Trade; break;
      case 'country': value = row.GeographicDesc; break;
      case 'group': value = row.Group; break;
      case 'subgroup': value = row.Subgroup; break;
      case 'marketSegment': value = row.MarketSegment; break;
      case 'commodity': value = row.CommodityName; break;
      case 'commodityDetail': value = row.CommodityDetail; break;
      case 'unitType': value = row.UnitType; break;
    }
    
    if (value) {
      options.add(value);
    }
  });
  
  return Array.from(options).sort();
};

// Update all filter options based on current selections
HMB.updateAllFilterOptions = function() {
  // Update each filter in hierarchy order
  this.filterHierarchy.forEach((filterName, index) => {
    this.updateFilterOptions(filterName, index);
  });
  
  // Update the Data to Plot dropdown after all other filters are updated
  this.updateDataToPlotDropdown();
};

// Update options for a specific filter
HMB.updateFilterOptions = function(filterName, filterIndex) {
  // Skip unitType here - it's handled separately by updateDataToPlotDropdown
  if (filterName === 'unitType') {
    return;
  }
  
  const availableOptions = this.getAvailableOptionsForFilter(filterName);
  const selectElement = document.getElementById(`filter-${filterName.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`);
  
  if (!selectElement || availableOptions.length === 0) {
    // Store the available options even if element doesn't exist
    this.filterState[`available${filterName.charAt(0).toUpperCase() + filterName.slice(1)}s`] = availableOptions;
    return;
  }
  
  // Get the current/default value
  let currentValue = this.filterState[filterName] || this.defaultFilterValues[filterName];
  
  // Check if current value is still valid, otherwise use first available
  const valueExists = availableOptions.includes(currentValue);
  const selectedValue = valueExists ? currentValue : availableOptions[0];
  
  // Remember current selection before repopulating
  const previousValue = selectElement.value;
  
  // Repopulate dropdown
  selectElement.innerHTML = '';
  availableOptions.forEach(optionValue => {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue;
    if (optionValue === selectedValue) {
      option.selected = true;
    }
    selectElement.appendChild(option);
  });
  
  // Update filter state
  this.filterState[filterName] = selectedValue;
  this.filterState[`available${filterName.charAt(0).toUpperCase() + filterName.slice(1)}s`] = availableOptions;
  
  // If value changed, cascade to subsequent filters
  if (previousValue !== selectedValue && filterIndex !== undefined) {
    this.cascadeFilterUpdate(filterIndex);
  }
};

// Update the Data to Plot dropdown based on available unit types
HMB.updateDataToPlotDropdown = function() {
  const selectElement = document.getElementById('filter-unit-type');
  if (!selectElement) return;
  
  // Get available unit types from progressive filtering
  const availableUnitTypes = this.getAvailableOptionsForFilter('unitType');
  this.filterState.availableUnitTypes = availableUnitTypes;
  
  // Remember current selection
  const previousValue = selectElement.value;
  
  // Build the list of options to display
  const optionsToShow = [];
  
  // Add base unit types (Value, Volume, Unit Value) with display labels
  availableUnitTypes.forEach(unitType => {
    optionsToShow.push({
      value: unitType,
      label: this.getUnitTypeLabel(unitType),
      isCalculated: false
    });
  });
  
  // Check if both Value and Volume are available for calculated metrics
  const hasValue = availableUnitTypes.includes('Value');
  const hasVolume = availableUnitTypes.includes('Volume');
  
  if (hasValue && hasVolume) {
    // Add calculated metrics
    this.calculatedUnitTypes.forEach(calcType => {
      optionsToShow.push({
        value: calcType,
        label: this.calculatedUnitTypeLabels[calcType],
        isCalculated: true
      });
    });
  }
  
  // Clear and repopulate dropdown
  selectElement.innerHTML = '';
  optionsToShow.forEach(option => {
    const optElement = document.createElement('option');
    optElement.value = option.value;
    optElement.textContent = option.label;
    optElement.dataset.isCalculated = option.isCalculated;
    selectElement.appendChild(optElement);
  });
  
  // Determine selected value
  let selectedValue;
  if (previousValue && optionsToShow.some(opt => opt.value === previousValue)) {
    // Keep previous selection if still valid
    selectedValue = previousValue;
  } else if (availableUnitTypes.includes('Value')) {
    // Default to Value if available
    selectedValue = 'Value';
  } else if (availableUnitTypes.length > 0) {
    // Otherwise use first available
    selectedValue = availableUnitTypes[0];
  } else if (optionsToShow.length > 0) {
    // Fallback to first option (should be a calculated one)
    selectedValue = optionsToShow[0].value;
  } else {
    selectedValue = '';
  }
  
  // Set the selected value
  selectElement.value = selectedValue;
  this.filterState.unitType = selectedValue;
  
  console.log('Data to Plot dropdown updated:', {
    availableUnitTypes: availableUnitTypes,
    hasBothValueAndVolume: hasValue && hasVolume,
    optionsCount: optionsToShow.length,
    selectedValue: selectedValue
  });
};

// Cascade filter update to subsequent filters
HMB.cascadeFilterUpdate = function(changedFilterIndex) {
  // Update all filters that come after the changed one
  for (let i = changedFilterIndex + 1; i < this.filterHierarchy.length; i++) {
    const filterName = this.filterHierarchy[i];
    if (filterName === 'unitType') {
      // Special handling for unitType - update the Data to Plot dropdown
      this.updateDataToPlotDropdown();
    } else {
      this.updateFilterOptions(filterName, i);
    }
  }
};

// Helper function to set dropdown value with fallback to first option
HMB.setDropdownValue = function(selectElement, availableOptions, defaultValue) {
  if (!selectElement || availableOptions.length === 0) return '';

  // Check if default value exists in available options
  const defaultExists = availableOptions.includes(defaultValue);
  const selectedValue = defaultExists ? defaultValue : availableOptions[0];

  // Populate dropdown
  selectElement.innerHTML = '';
  availableOptions.forEach(optionValue => {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue;
    if (optionValue === selectedValue) {
      option.selected = true;
    }
    selectElement.appendChild(option);
  });

  return selectedValue;
};

// Populate filter dropdowns (legacy method, now handled by progressive filtering)
HMB.populateFilterDropdowns = function() {
  // This is now handled by initializeProgressiveFilters and updateAllFilterOptions
  // Keeping for backwards compatibility
  this.updateAllFilterOptions();
};

// Set up filter event listeners
HMB.setupFilterEventListeners = function() {
  // Trade type filter
  const tradeSelect = document.getElementById('filter-trade');
  if (tradeSelect) {
    tradeSelect.addEventListener('change', (e) => {
      this.filterState.trade = e.target.value;
      this.cascadeFilterUpdate(0);
      this.applyFilters();
    });
  }

  // Country filter
  const countrySelect = document.getElementById('filter-country');
  if (countrySelect) {
    countrySelect.addEventListener('change', (e) => {
      this.filterState.country = e.target.value;
      this.cascadeFilterUpdate(1);
      this.applyFilters();
    });
  }

  // Group filter
  const groupSelect = document.getElementById('filter-group');
  if (groupSelect) {
    groupSelect.addEventListener('change', (e) => {
      this.filterState.group = e.target.value;
      this.cascadeFilterUpdate(2);
      this.applyFilters();
    });
  }

  // Subgroup filter
  const subgroupSelect = document.getElementById('filter-subgroup');
  if (subgroupSelect) {
    subgroupSelect.addEventListener('change', (e) => {
      this.filterState.subgroup = e.target.value;
      this.cascadeFilterUpdate(3);
      this.applyFilters();
    });
  }

  // Market Segment filter
  const marketSegmentSelect = document.getElementById('filter-market-segment');
  if (marketSegmentSelect) {
    marketSegmentSelect.addEventListener('change', (e) => {
      this.filterState.marketSegment = e.target.value;
      this.cascadeFilterUpdate(4);
      this.applyFilters();
    });
  }

  // Commodity filter
  const commoditySelect = document.getElementById('filter-commodity');
  if (commoditySelect) {
    commoditySelect.addEventListener('change', (e) => {
      this.filterState.commodity = e.target.value;
      this.cascadeFilterUpdate(5);
      this.applyFilters();
    });
  }

  // Commodity Detail filter
  const commodityDetailSelect = document.getElementById('filter-commodity-detail');
  if (commodityDetailSelect) {
    commodityDetailSelect.addEventListener('change', (e) => {
      this.filterState.commodityDetail = e.target.value;
      this.cascadeFilterUpdate(6);
      this.applyFilters();
    });
  }

  // Unit type filter
  const unitTypeSelect = document.getElementById('filter-unit-type');
  if (unitTypeSelect) {
    unitTypeSelect.addEventListener('change', (e) => {
      this.filterState.unitType = e.target.value;
      this.applyFilters();
    });
  }

  // Select all years button
  const selectAllBtn = document.getElementById('select-all-years');
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      this.filterState.availableYears.forEach(year => this.filterState.years.add(year));
      this.updateYearCheckboxesUI();
      this.applyFilters();
    });
  }

  // Clear all years button
  const clearAllBtn = document.getElementById('clear-all-years');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      this.filterState.years.clear();
      this.updateYearCheckboxesUI();
      this.applyFilters();
    });
  }
};

// Update year checkboxes UI based on current state
HMB.updateYearCheckboxesUI = function() {
  const container = document.getElementById('year-checkboxes');
  if (!container) return;
  
  const checkboxes = container.querySelectorAll('.year-checkbox');
  checkboxes.forEach(checkbox => {
    const input = checkbox.querySelector('input');
    const year = parseInt(input.value);
    input.checked = this.filterState.years.has(year);
    checkbox.classList.toggle('checked', input.checked);
  });
};

// Build a lookup key for trade data
HMB.buildTradeDataKey = function(trade, country, commodity, unitType, year) {
  return `${trade}|${country}|${commodity}|${unitType}|${year}`;
};

// Pre-build a Set of valid trade data combinations for fast lookup
HMB.buildTradeDataLookup = function() {
  const lookup = new Set();
  
  this.state.tradeData.forEach(row => {
    const key = this.buildTradeDataKey(
      row.Trade,
      row.GeographicDesc,
      row.CommodityName,
      row.UnitType,
      row.Year
    );
    lookup.add(key);
  });
  
  return lookup;
};

// Apply all filters and update the metric dropdown
HMB.applyFilters = function() {
  // Build lookup once for performance
  if (!this._tradeDataLookup) {
    this._tradeDataLookup = this.buildTradeDataLookup();
  }

  // Convert years Set to array for faster iteration
  const selectedYears = Array.from(this.filterState.years);

  // Check if we're selecting a calculated metric
  const isCalculatedMetric = this.isCalculatedUnitType(this.filterState.unitType);

  // Filter the available metrics based on current filter state
  this.filterState.filteredMetrics = this.state.availableMetrics.filter(metric => {
    const ctx = metric.context;

    // Check trade type
    if (this.filterState.trade && ctx.trade !== this.filterState.trade) {
      return false;
    }

    // Check country
    if (this.filterState.country && ctx.country !== this.filterState.country) {
      return false;
    }

    // Check group
    if (this.filterState.group && ctx.group !== this.filterState.group) {
      return false;
    }

    // Check subgroup
    if (this.filterState.subgroup && ctx.subgroup !== this.filterState.subgroup) {
      return false;
    }

    // Check market segment
    if (this.filterState.marketSegment && ctx.marketSegment !== this.filterState.marketSegment) {
      return false;
    }

    // Check commodity
    if (this.filterState.commodity && ctx.commodity !== this.filterState.commodity) {
      return false;
    }

    // Check commodity detail
    if (this.filterState.commodityDetail && ctx.commodityDetail !== this.filterState.commodityDetail) {
      return false;
    }

    // Check unit type (Value vs Volume) - for calculated metrics, we don't filter by unit type
    // since they use both Value and Volume data
    if (!isCalculatedMetric && this.filterState.unitType && ctx.unitType !== this.filterState.unitType) {
      return false;
    }

    // For calculated metrics, we need to check if both Value and Volume exist for this context
    if (isCalculatedMetric) {
      // For calculated metrics, we accept any metric that has either Value or Volume unit type
      // The actual calculation will be done when getting the data
      if (ctx.unitType !== 'Value' && ctx.unitType !== 'Volume') {
        return false;
      }
      
      // Check years - the metric must have data in at least one selected year
      // For calculated metrics, we check both Value and Volume availability
      for (let i = 0; i < selectedYears.length; i++) {
        const valueKey = this.buildTradeDataKey(
          ctx.trade,
          ctx.country,
          ctx.commodity,
          'Value',
          selectedYears[i]
        );
        const volumeKey = this.buildTradeDataKey(
          ctx.trade,
          ctx.country,
          ctx.commodity,
          'Volume',
          selectedYears[i]
        );
        // For calculated metrics, we need both Value and Volume
        if (this._tradeDataLookup.has(valueKey) && this._tradeDataLookup.has(volumeKey)) {
          return true;
        }
      }
      return false;
    }

    // Check years - the metric must have data in at least one selected year
    // Use the pre-built lookup for O(1) lookups
    for (let i = 0; i < selectedYears.length; i++) {
      const key = this.buildTradeDataKey(
        ctx.trade,
        ctx.country,
        ctx.commodity,
        ctx.unitType,
        selectedYears[i]
      );
      if (this._tradeDataLookup.has(key)) {
        return true;
      }
    }

    return false;
  });

  // Update the metric dropdown with filtered results
  this.updateFilteredMetricDropdown();

  // Update the filter result count
  this.updateFilterResultCount();

  // Enable/disable add button based on filter result
  this.updateAddButtonState();
};

// Update the metric dropdown with filtered metrics
HMB.updateFilteredMetricDropdown = function() {
  const dropdown = document.getElementById('metric-select');
  if (!dropdown) return;
  
  // Clear existing options (keep the default)
  while (dropdown.options.length > 1) {
    dropdown.remove(1);
  }
  
  // Check if we're showing a calculated metric
  const isCalculatedMetric = this.isCalculatedUnitType(this.filterState.unitType);
  
  if (isCalculatedMetric && this.filterState.filteredMetrics.length > 0) {
    // For calculated metrics, create a virtual metric entry
    // Use the first matching metric as the base and modify its context
    const baseMetric = this.filterState.filteredMetrics[0];
    const calculatedContext = {
      ...baseMetric.context,
      unitType: this.filterState.unitType,
      unitDesc: this.calculatedUnitTypeLabels[this.filterState.unitType]
    };
    
    // Create a unique path for the calculated metric
    const calculatedPath = `${baseMetric.context.trade}.${baseMetric.context.country}.${baseMetric.context.commodity}.${this.filterState.unitType}`;
    
    const option = document.createElement('option');
    option.value = this.filterState.unitType; // Use unitType as path for calculated metrics
    
    // Create a display label
    const displayLabel = this.createTradeMetricLabelFromContext(calculatedContext);
    option.textContent = displayLabel;
    
    option.dataset.originalLabel = displayLabel;
    option.dataset.metricPath = this.filterState.unitType;
    option.dataset.isCalculated = 'true';
    dropdown.appendChild(option);
    
    // Create a single virtual metric for the filtered metrics list
    this.filterState.filteredMetrics = [{
      path: this.filterState.unitType,
      label: displayLabel,
      context: calculatedContext,
      isCalculated: true
    }];
  } else {
    // Add regular filtered metrics
    this.filterState.filteredMetrics.forEach(metric => {
      const option = document.createElement('option');
      option.value = metric.path;
      
      // Create a display label
      const displayLabel = this.createTradeMetricLabelFromContext(metric.context);
      option.textContent = displayLabel;
      
      option.dataset.originalLabel = metric.label;
      option.dataset.metricPath = metric.path;
      option.dataset.isCalculated = 'false';
      dropdown.appendChild(option);
    });
  }
  
  // Update the metrics count
  const metricCountElement = document.getElementById('metric-count');
  if (metricCountElement) {
    metricCountElement.textContent = `(${this.filterState.filteredMetrics.length})`;
  }
};

// Create display label from context
HMB.createTradeMetricLabelFromContext = function(context) {
  const parts = [];
  
  if (context.trade) parts.push(context.trade);
  if (context.country) parts.push(context.country);
  if (context.commodity && context.commodity !== 'Unspecified') parts.push(context.commodity);
  if (context.unitType) {
    // Use display label for unit type if available
    const unitTypeLabel = this.getUnitTypeLabel ? this.getUnitTypeLabel(context.unitType) : context.unitType;
    parts.push(unitTypeLabel);
  }
  
  return parts.join(' - ');
};

// Create a calculated metric context based on current filter state
HMB.createCalculatedMetricContext = function(calculatedType) {
  return {
    trade: this.filterState.trade,
    country: this.filterState.country,
    group: this.filterState.group,
    subgroup: this.filterState.subgroup,
    marketSegment: this.filterState.marketSegment,
    commodity: this.filterState.commodity,
    commodityDetail: this.filterState.commodityDetail,
    unitType: calculatedType,
    unitDesc: this.calculatedUnitTypeLabels[calculatedType]
  };
};

// Update filter result count display
HMB.updateFilterResultCount = function() {
  const resultElement = document.getElementById('filter-result');
  const countElement = document.getElementById('filter-result-count');
  
  if (countElement) {
    countElement.textContent = this.filterState.filteredMetrics.length;
  }
  
  if (resultElement) {
    // Add special styling when exactly one match
    if (this.filterState.filteredMetrics.length === 1) {
      resultElement.classList.add('match-exactly');
      resultElement.innerHTML = '<strong>1</strong> data series matches - ready to add!';
    } else {
      resultElement.classList.remove('match-exactly');
      resultElement.innerHTML = `<span id="filter-result-count">${this.filterState.filteredMetrics.length}</span> data series match your filters`;
    }
  }
};

// Update add button state based on filter results
HMB.updateAddButtonState = function() {
  const addButton = document.getElementById('add-selected-metric');
  const metricSelect = document.getElementById('metric-select');
  
  if (!addButton) return;
  
  // Enable button only if exactly one metric matches
  if (this.filterState.filteredMetrics.length === 1) {
    addButton.disabled = false;
    // Auto-select the only option
    if (metricSelect) {
      metricSelect.selectedIndex = 1;
    }
  } else {
    addButton.disabled = true;
    if (metricSelect) {
      metricSelect.selectedIndex = 0;
    }
  }
};

// Clear all filters
HMB.clearFilters = function() {
  this.filterState.trade = '';
  this.filterState.country = '';
  this.filterState.group = '';
  this.filterState.subgroup = '';
  this.filterState.marketSegment = '';
  this.filterState.commodity = '';
  this.filterState.commodityDetail = '';
  this.filterState.unitType = '';

  // Reset dropdowns
  const tradeSelect = document.getElementById('filter-trade');
  const countrySelect = document.getElementById('filter-country');
  const groupSelect = document.getElementById('filter-group');
  const subgroupSelect = document.getElementById('filter-subgroup');
  const marketSegmentSelect = document.getElementById('filter-market-segment');
  const commoditySelect = document.getElementById('filter-commodity');
  const commodityDetailSelect = document.getElementById('filter-commodity-detail');
  const unitTypeSelect = document.getElementById('filter-unit-type');

  if (tradeSelect) tradeSelect.value = '';
  if (countrySelect) countrySelect.value = '';
  if (groupSelect) groupSelect.value = '';
  if (subgroupSelect) subgroupSelect.value = '';
  if (marketSegmentSelect) marketSegmentSelect.value = '';
  if (commoditySelect) commoditySelect.value = '';
  if (commodityDetailSelect) commodityDetailSelect.value = '';
  if (unitTypeSelect) unitTypeSelect.value = '';

  // Reset years to all selected
  this.filterState.availableYears.forEach(year => this.filterState.years.add(year));
  this.updateYearCheckboxesUI();

  // Update all filter options (will show all available values)
  this.updateAllFilterOptions();

  // Reapply filters
  this.applyFilters();
};
