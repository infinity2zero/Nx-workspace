import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import {
  PathResult,
  PathfindingRequest,
  PathfindingFilters,
  NetworkNode,
  QoSConstraints
} from '../../shared/components/interfaces/pathfinding.interface';
import { FilterPanelComponent } from '../../shared/components/filterpanel/filter-panel';
import { PathfindingService } from '../../shared/services/pathfinding.service';

@Component({
  selector: 'app-path-finder',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule,
    FilterPanelComponent
  ],
  templateUrl: './path-finder.html',
  styleUrls: ['./path-finder.scss']
})
export class PathFinderComponent implements OnInit, OnDestroy {
  @Input() canShowOnMap = true;
  @Output() pathFound = new EventEmitter<PathResult[]>();
  @Output() showPath = new EventEmitter<PathResult>();

  private destroy$ = new Subject<void>();
  
  pathForm!: FormGroup;
  pathResults: PathResult[] = [];
  currentFilters: PathfindingFilters = {};
  
  loading = false;
  showFilters = false;
  showQoS = false;
  viewMode: 'list' | 'cards' | 'comparison' = 'list';
  
  expandedPaths = new Set<PathResult>();
  sourceNode: NetworkNode | null = null;
  destinationNode: NetworkNode | null = null;
  selectorTarget: 'source' | 'destination' = 'source';
  
  lastPerformance: any = null;

  get selectedAlgorithm() {
    return this.pathForm.get('algorithm')?.value;
  }

  constructor(
    private fb: FormBuilder,
    private pathfindingService: PathfindingService,
    private toastr: ToastrService
  ) {
    this.initializeForm();
  }

  ngOnInit() {
    this.setupFormSubscriptions();
  }

  swapEndpoints(){}

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm() {
    this.pathForm = this.fb.group({
      source: ['', Validators.required],
      destination: ['', Validators.required],
      algorithm: ['dijkstra', Validators.required],
      kValue: [3],
      disjointType: ['node-disjoint'],
      maxLatency: [null],
      minBandwidth: [null],
      priority: ['medium']
    });
  }

  private setupFormSubscriptions() {
    // Watch for algorithm changes
    this.pathForm.get('algorithm')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(algorithm => {
        this.onAlgorithmChange(algorithm);
      });

    // Auto-search on input changes (debounced)
    this.pathForm.get('source')?.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        if (value && value.length > 2) {
          this.loadSourceNode(value);
        }
      });

    this.pathForm.get('destination')?.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        if (value && value.length > 2) {
          this.loadDestinationNode(value);
        }
      });
  }

  private onAlgorithmChange(algorithm: string) {
    // Reset algorithm-specific form controls
    this.pathForm.patchValue({
      kValue: algorithm === 'k-shortest' ? 3 : null,
      disjointType: algorithm === 'disjoint' ? 'node-disjoint' : null
    });
  }

  async findPath() {
    if (this.pathForm.invalid) {
      this.pathForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.pathResults = [];

    try {
      const request = this.buildPathRequest();
      const response:any = await this.pathfindingService.findPath(request);
      
      if (response.success) {
        this.pathResults = response.paths;
        this.lastPerformance = response.metadata;
        this.pathFound.emit(this.pathResults);
        
        this.toastr.success(
          `Found ${this.pathResults.length} path(s)`,
          'Success'
        );
      } else {
        this.toastr.warning(
          response.error || 'No paths found',
          'No Results'
        );
      }
    } catch (error) {
      console.error('Path finding error:', error);
      this.toastr.error(
        'Failed to find paths. Please try again.',
        'Error'
      );
    } finally {
      this.loading = false;
    }
  }

  async findAdvancedPaths() {
    // Implement advanced pathfinding with multiple algorithms
    if (this.pathForm.invalid) {
      this.pathForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.pathResults = [];

    try {
      const algorithms = ['dijkstra', 'astar', 'k-shortest'];
      const promises = algorithms.map(algorithm => {
        const request = this.buildPathRequest(algorithm);
        return this.pathfindingService.findPath(request);
      });

      const responses = await Promise.all(promises);
      
      // Combine all results
      const allPaths: PathResult[] = [];
      responses.forEach((response:any) => {
        if (response.success) {
          allPaths.push(...response.paths);
        }
      });

      // Remove duplicates and sort by cost
      this.pathResults = this.removeDuplicatePaths(allPaths)
        .sort((a, b) => a.cost - b.cost);

      if (this.pathResults.length > 0) {
        this.pathFound.emit(this.pathResults);
        this.toastr.success(
          `Found ${this.pathResults.length} diverse path(s)`,
          'Advanced Search Complete'
        );
      } else {
        this.toastr.warning('No paths found', 'No Results');
      }
    } catch (error) {
      console.error('Advanced path finding error:', error);
      this.toastr.error(
        'Failed to find paths. Please try again.',
        'Error'
      );
    } finally {
      this.loading = false;
    }
  }

  private buildPathRequest(algorithm?: string): PathfindingRequest {
    const formValue = this.pathForm.value;
    const selectedAlgorithm = algorithm || formValue.algorithm;

    const request: PathfindingRequest = {
      source: formValue.source,
      destination: formValue.destination,
      algorithm: selectedAlgorithm,
      filters: this.currentFilters
    };

    // Add algorithm-specific options
    if (selectedAlgorithm === 'k-shortest') {
      request.options = {
        k: formValue.kValue || 3,
        allowLoops: false,
        diversityFactor: 0.7
      };
    } else if (selectedAlgorithm === 'disjoint') {
      request.options = {
        pathType: formValue.disjointType,
        maxPaths: 2
      };
    }

    // Add QoS requirements if specified
    if (this.showQoS && (formValue.maxLatency || formValue.minBandwidth)) {
      request.filters = {
        ...request.filters,
        qosRequirements: {
          maxLatency: formValue.maxLatency,
          minBandwidth: formValue.minBandwidth,
          priority: formValue.priority
        }
      };
    }

    return request;
  }

  private removeDuplicatePaths(paths: PathResult[]): PathResult[] {
    const seen = new Set<string>();
    return paths.filter(path => {
      const pathKey = path.path.join('-');
      if (seen.has(pathKey)) {
        return false;
      }
      seen.add(pathKey);
      return true;
    });
  }

  onFiltersChange(filters: PathfindingFilters) {
    this.currentFilters = filters;
  }

  onSourceInput(event: any) {
    const value = event.target.value;
    if (value !== this.sourceNode?.site_id) {
      this.sourceNode = null;
    }
  }

  onDestinationInput(event: any) {
    const value = event.target.value;
    if (value !== this.destinationNode?.site_id) {
      this.destinationNode = null;
    }
  }

  private async loadSourceNode(siteId: string) {
    try {
      this.sourceNode = await this.pathfindingService.getSiteById(siteId) as any;
    } catch (error) {
      console.warn('Could not load source node:', error);
    }
  }

  private async loadDestinationNode(siteId: string) {
    try {
      this.destinationNode = await this.pathfindingService.getSiteById(siteId) as any;
    } catch (error) {
      console.warn('Could not load destination node:', error);
    }
  }

  toggleFilters() {
    this.showFilters = !this.showFilters;
  }

  toggleQoS() {
    this.showQoS = !this.showQoS;
  }

  setViewMode(mode: 'list' | 'cards' | 'comparison') {
    this.viewMode = mode;
  }

  clearAll() {
    this.pathForm.reset({
      algorithm: 'dijkstra',
      priority: 'medium'
    });
    this.pathResults = [];
    this.currentFilters = {};
    this.sourceNode = null;
    this.destinationNode = null;
    this.expandedPaths.clear();
    this.lastPerformance = null;
  }

  showOnMap(path: PathResult) {
    this.showPath.emit(path);
  }

  showPathDetails(path: PathResult) {
    // Implement path details modal
    console.log('Show path details:', path);
  }

  exportPath(path: PathResult) {
    // Implement path export functionality
    const dataStr = JSON.stringify(path, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `path-${path.path[0]}-to-${path.path[path.path.length - 1]}.json`;
    link.click();
    
    URL.revokeObjectURL(link.href);
    this.toastr.success('Path exported successfully', 'Export');
  }

  togglePathExpansion(path: PathResult) {
    if (this.expandedPaths.has(path)) {
      this.expandedPaths.delete(path);
    } else {
      this.expandedPaths.add(path);
    }
  }

  openSiteSelector(target: 'source' | 'destination') {
    this.selectorTarget = target;
    // Open modal logic would go here
  }

  // Tracking functions for *ngFor
  trackByPath(index: number, path: PathResult): string {
    return path.path.join('-') + path.metadata.algorithm;
  }

  trackByNode(index: number, node: NetworkNode): string {
    return node.site_id;
  }

  trackByLink(index: number, link: any): string {
    return link.link_id;
  }

  // Utility functions for styling
  getLinkTypeClass(linkType: string): string {
    const classes:any = {
      'Fiber': 'bg-success',
      'Microwave': 'bg-warning',
      'Satellite': 'bg-info',
      'Wireless': 'bg-secondary'
    };
    return classes[linkType] || 'bg-light';
  }

  getResilienceClass(resilience?: string): string {
    const classes:any = {
      'high': 'text-success',
      'medium': 'text-warning',
      'low': 'text-danger'
    };
    return classes[resilience || ''] || 'text-muted';
  }

  getQoSProgressClass(score?: number): string {
    if (!score) return 'bg-secondary';
    if (score >= 0.8) return 'bg-success';
    if (score >= 0.6) return 'bg-warning';
    return 'bg-danger';
  }

  getLinkCapacity(link: any): number {
    // Mock capacity calculation
    const capacities:any = {
      'Fiber': 10000,
      'Microwave': 1000,
      'Satellite': 100,
      'Wireless': 500
    };
    return capacities[link.link_type] || 1000;
  }
}