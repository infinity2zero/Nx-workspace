import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { PathfindingFilters } from '../interfaces/pathfinding.interface';
import { PathfindingService } from '../../services/pathfinding.service';
import { NgSelectModule } from '@ng-select/ng-select';

@Component({
  selector: 'app-filter-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbModule, NgSelectModule],
  templateUrl: './filter-panel.html',
  styleUrls: ['./filter-panel.scss']
})
export class FilterPanelComponent implements OnInit {
  @Input() filters: PathfindingFilters = {};
  @Output() filtersChange = new EventEmitter<PathfindingFilters>();

  filterForm!: FormGroup;
  showQoS = false;
  showExclusions = false;
  showAdvanced = false;
  loadingCities = false;

  availableCountries: string[] = [];
  availableCities: string[] = [];
  availableNetworks: string[] = [];
  availablePlatforms: string[] = [];

  constructor(
    private fb: FormBuilder,
    private pathfindingService: PathfindingService
  ) {
    this.initializeForm();
  }

  ngOnInit() {
    this.loadFilterOptions();
    this.updateFormFromFilters();
  }

  toggleQoS(){}

  private initializeForm() {
    this.filterForm = this.fb.group({
      country: [[]],
      city: [[]],
      network: [[]],
      includeFiber: [true],
      includeWireless: [true],
      includeSatellite: [true],
      includeMicrowave: [true],
      minDistance: [null],
      maxDistance: [null],
      excludeNodes: [''],
      excludeLinks: [''],
      allowBackups: [false],
      preferReliable: [false],
      avoidCongested: [false]
    });
  }

  private async loadFilterOptions() {
    try {
      const options = await this.pathfindingService.getFilterValues();
      this.availableCountries = options.countries;
      this.availableCities = options.cities;
      this.availableNetworks = options.networks;
      this.availablePlatforms = options.platforms;
    } catch (error) {
      console.error('Failed to load filter options:', error);
    }
  }

  private updateFormFromFilters() {
    if (this.filters) {
      this.filterForm.patchValue({
        country: this.filters.country || [],
        city: this.filters.city || [],
        network: this.filters.network || [],
        includeFiber: !this.filters.platform || this.filters.platform.includes('Fiber'),
        includeWireless: !this.filters.platform || this.filters.platform.includes('Wireless'),
        includeSatellite: !this.filters.platform || this.filters.platform.includes('Satellite'),
        includeMicrowave: !this.filters.platform || this.filters.platform.includes('Microwave'),
        excludeNodes: this.filters.excludeNodes?.join(', ') || '',
        excludeLinks: this.filters.excludeLinks?.join(', ') || ''
      });
    }
  }

  onFilterChange() {
    this.emitFilters();
  }

  onPlatformChange() {
    const formValue = this.filterForm.value;
    const platforms: string[] = [];
    
    if (formValue.includeFiber) platforms.push('Fiber');
    if (formValue.includeWireless) platforms.push('Wireless');
    if (formValue.includeSatellite) platforms.push('Satellite');
    if (formValue.includeMicrowave) platforms.push('Microwave');
    
    this.emitFilters(platforms);
  }

  onRangeChange() {
    this.emitFilters();
  }

  onExcludeNodesChange() {
    this.emitFilters();
  }

  onExcludeLinksChange() {
    this.emitFilters();
  }

  private emitFilters(platforms?: string[]) {
    const formValue = this.filterForm.value;
    
    const filters: PathfindingFilters = {
      country: formValue.country?.length ? formValue.country : undefined,
      city: formValue.city?.length ? formValue.city : undefined,
      network: formValue.network?.length ? formValue.network : undefined,
      platform: platforms || this.getPlatformsFromForm(),
      excludeNodes: this.parseCommaSeparated(formValue.excludeNodes),
      excludeLinks: this.parseCommaSeparated(formValue.excludeLinks)
    };

    // Remove empty arrays and null values
    Object.keys(filters).forEach(key => {
      const value = filters[key as keyof PathfindingFilters];
      if (Array.isArray(value) && value.length === 0) {
        delete filters[key as keyof PathfindingFilters];
      }
    });

    this.filtersChange.emit(filters);
  }

  private getPlatformsFromForm(): string[] {
    const formValue = this.filterForm.value;
    const platforms: string[] = [];
    
    if (formValue.includeFiber) platforms.push('Fiber');
    if (formValue.includeWireless) platforms.push('Wireless');
    if (formValue.includeSatellite) platforms.push('Satellite');
    if (formValue.includeMicrowave) platforms.push('Microwave');
    
    return platforms;
  }

  private parseCommaSeparated(value: string): string[] | undefined {
    if (!value?.trim()) return undefined;
    return value.split(',').map(v => v.trim()).filter(v => v.length > 0);
  }

  toggleExclusions() {
    this.showExclusions = !this.showExclusions;
  }

  toggleAdvanced() {
    this.showAdvanced = !this.showAdvanced;
  }

  applyPreset(preset: string) {
    switch (preset) {
      case 'fastest':
        this.filterForm.patchValue({
          includeFiber: true,
          includeWireless: false,
          includeSatellite: false,
          includeMicrowave: true,
          preferReliable: false,
          avoidCongested: true
        });
        break;
        
      case 'reliable':
        this.filterForm.patchValue({
          includeFiber: true,
          includeWireless: true,
          includeSatellite: false,
          includeMicrowave: true,
          preferReliable: true,
          avoidCongested: false
        });
        break;
        
      case 'redundant':
        this.filterForm.patchValue({
          includeFiber: true,
          includeWireless: true,
          includeSatellite: true,
          includeMicrowave: true,
          allowBackups: true,
          preferReliable: false,
          avoidCongested: false
        });
        break;
    }
    
    this.onPlatformChange();
  }

  clearAllFilters() {
    this.filterForm.reset({
      country: [],
      city: [],
      network: [],
      includeFiber: true,
      includeWireless: true,
      includeSatellite: true,
      includeMicrowave: true,
      excludeNodes: '',
      excludeLinks: '',
      allowBackups: false,
      preferReliable: false,
      avoidCongested: false
    });
    
    this.onFilterChange();
  }

  get hasActiveFilters(): boolean {
    const formValue = this.filterForm.value;
    
    return !!(
      formValue.country?.length ||
      formValue.city?.length ||
      formValue.network?.length ||
      !formValue.includeFiber ||
      !formValue.includeWireless ||
      !formValue.includeSatellite ||
      !formValue.includeMicrowave ||
      formValue.minDistance ||
      formValue.maxDistance ||
      formValue.excludeNodes?.trim() ||
      formValue.excludeLinks?.trim() ||
      formValue.allowBackups ||
      formValue.preferReliable ||
      formValue.avoidCongested
    );
  }

  get currentDistanceRange(): string {
    const formValue = this.filterForm.value;
    const min = formValue.minDistance;
    const max = formValue.maxDistance;
    
    if (min && max) {
      return `${min} - ${max} km`;
    } else if (min) {
      return `≥ ${min} km`;
    } else if (max) {
      return `≤ ${max} km`;
    } else {
      return 'No limit';
    }
  }

  getFilterSummary(): string {
    const formValue = this.filterForm.value;
    const active: string[] = [];
    
    if (formValue.country?.length) {
      active.push(`${formValue.country.length} countries`);
    }
    
    if (formValue.city?.length) {
      active.push(`${formValue.city.length} cities`);
    }
    
    const platformCount = [
      formValue.includeFiber,
      formValue.includeWireless,
      formValue.includeSatellite,
      formValue.includeMicrowave
    ].filter(Boolean).length;
    
    if (platformCount < 4) {
      active.push(`${platformCount}/4 platforms`);
    }
    
    if (formValue.excludeNodes?.trim()) {
      const count = this.parseCommaSeparated(formValue.excludeNodes)?.length || 0;
      active.push(`${count} excluded sites`);
    }
    
    if (formValue.excludeLinks?.trim()) {
      const count = this.parseCommaSeparated(formValue.excludeLinks)?.length || 0;
      active.push(`${count} excluded links`);
    }
    
    return active.length > 0 ? `${active.length} active filters` : 'No active filters';
  }
}