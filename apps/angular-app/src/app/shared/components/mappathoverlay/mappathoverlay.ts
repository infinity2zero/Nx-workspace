import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { PathResult, NetworkNode, NetworkLink } from '../interfaces/pathfinding.interface';

@Component({
  selector: 'app-map-path-overlay',
  standalone: true,
  imports: [CommonModule, NgbModule],
  templateUrl: './mappathoverlay.html',
  styleUrls: ['./mappathoverlay.scss']
})
export class MapPathOverlayComponent implements OnChanges {
  @Input() paths: PathResult[] = [];
  @Input() selectedNode: NetworkNode | null = null;
  @Input() selectedLink: NetworkLink | null = null;
  
  @Output() pathSelectionChange = new EventEmitter<Set<PathResult>>();
  @Output() zoomToPathRequested = new EventEmitter<PathResult>();
  @Output() highlightPathRequested = new EventEmitter<PathResult>();
  @Output() clearPathsRequested = new EventEmitter<void>();
  @Output() nodeSelected = new EventEmitter<NetworkNode>();
  @Output() linkSelected = new EventEmitter<NetworkLink>();

  selectedPaths = new Set<PathResult>();
  allPathsVisible = true;
  
  nodeStats: any = null;
  linkStats: any = null;

  // Color palette for paths
  private pathColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#82E0AA', '#F8C471'
  ];

  ngOnChanges(changes: SimpleChanges) {
    if (changes['paths']) {
      this.updatePathSelection();
    }
    
    if (changes['selectedNode']) {
      this.updateNodeStats();
    }
    
    if (changes['selectedLink']) {
      this.updateLinkStats();
    }
  }

  private updatePathSelection() {
    // Reset selection when paths change
    this.selectedPaths.clear();
    if (this.paths.length > 0) {
      // Auto-select first path
      this.selectedPaths.add(this.paths[0]);
    }
    this.pathSelectionChange.emit(this.selectedPaths);
  }

  private updateNodeStats() {
    if (this.selectedNode) {
      // Calculate node statistics based on current paths
      const connectionCount = this.calculateNodeConnections(this.selectedNode);
      const pathsUsing = this.calculatePathsUsingNode(this.selectedNode);
      
      this.nodeStats = {
        connectionCount,
        pathsUsing
      };
    } else {
      this.nodeStats = null;
    }
  }

  private updateLinkStats() {
    if (this.selectedLink) {
      // Calculate link statistics
      const utilization = Math.random() * 80 + 10; // Mock utilization
      const pathsUsing = this.calculatePathsUsingLink(this.selectedLink);
      
      this.linkStats = {
        utilization: utilization.toFixed(1),
        pathsUsing
      };
    } else {
      this.linkStats = null;
    }
  }

  togglePathSelection(path: PathResult) {
    if (this.selectedPaths.has(path)) {
      this.selectedPaths.delete(path);
    } else {
      this.selectedPaths.add(path);
    }
    this.pathSelectionChange.emit(this.selectedPaths);
  }

  toggleAllPaths() {
    if (this.allPathsVisible) {
      this.selectedPaths.clear();
    } else {
      this.selectedPaths.clear();
      this.paths.forEach(path => this.selectedPaths.add(path));
    }
    this.allPathsVisible = !this.allPathsVisible;
    this.pathSelectionChange.emit(this.selectedPaths);
  }

  clearPaths() {
    this.selectedPaths.clear();
    this.clearPathsRequested.emit();
  }

  zoomToPath(path: PathResult) {
    this.zoomToPathRequested.emit(path);
  }

  highlightPath(path: PathResult) {
    // Clear previous selection and select only this path
    this.selectedPaths.clear();
    this.selectedPaths.add(path);
    this.pathSelectionChange.emit(this.selectedPaths);
    this.highlightPathRequested.emit(path);
  }

  clearNodeSelection() {
    this.selectedNode = null;
    this.nodeStats = null;
  }

  clearLinkSelection() {
    this.selectedLink = null;
    this.linkStats = null;
  }

  getPathColor(index: number): string {
    return this.pathColors[index % this.pathColors.length];
  }

  getPlatformClass(platform: string): string {
    const classes:any = {
      'Fiber': 'bg-success',
      'Wireless': 'bg-warning',
      'Satellite': 'bg-info',
      'Microwave': 'bg-secondary'
    };
    return classes[platform] || 'bg-light';
  }

  getLinkTypeClass(linkType: string): string {
    const classes:any = {
      'Fiber': 'bg-success',
      'Microwave': 'bg-warning',
      'Satellite': 'bg-info',
      'Wireless': 'bg-secondary'
    };
    return classes[linkType] || 'bg-light';
  }

  getNodeTooltip(node: NetworkNode): string {
    return `${node.site_name} (${node.site_id})\n${node.city}, ${node.country}\nPlatform: ${node.platform}`;
  }

  trackByPath(index: number, path: PathResult): string {
    return path.path.join('-') + path.metadata.algorithm;
  }

  private calculateNodeConnections(node: NetworkNode): number {
    // Count unique connections from all paths
    const connections = new Set<string>();
    
    this.paths.forEach(path => {
      const nodeIndex = path.path.indexOf(node.site_id);
      if (nodeIndex !== -1) {
        // Add previous node
        if (nodeIndex > 0) {
          connections.add(path.path[nodeIndex - 1]);
        }
        // Add next node
        if (nodeIndex < path.path.length - 1) {
          connections.add(path.path[nodeIndex + 1]);
        }
      }
    });
    
    return connections.size;
  }

  private calculatePathsUsingNode(node: NetworkNode): number {
    return this.paths.filter(path => 
      path.path.includes(node.site_id)
    ).length;
  }

  private calculatePathsUsingLink(link: NetworkLink): number {
    return this.paths.filter(path =>
      path.links.some(l => l.link_id === link.link_id)
    ).length;
  }
}