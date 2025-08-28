import { Injectable } from '@nestjs/common';
import Graph from 'graphology';
import { GraphService } from './graph.service';
import {bidirectional} from 'graphology-shortest-path/unweighted';
import { PathfindingService } from './pathfinding.service';
import {
  QoSRoutingOptions,
  LoadBalancingOptions,
  TrafficEngineeringOptions,
  PathfindingFilters,
  PathResult
} from './pathfinding-interfaces';

@Injectable()
export class AdvancedFeaturesService {
  constructor(
    private readonly graphService: GraphService,
    private readonly pathfindingService: PathfindingService
  ) { }

  async qosAwareRouting(
    source: string,
    destination: string,
    options: QoSRoutingOptions,
    filters: PathfindingFilters = {}
  ): Promise<PathResult[]> {
    // Enhance filters with QoS requirements
    const qosFilters = {
      ...filters,
      qosRequirements: options.constraints
    };

    const graph = await this.graphService.buildGraph(qosFilters);

    // Apply QoS weights to edges
    graph.forEachEdge((edge, attributes, source, target) => {
      const qosWeight = this.calculateQoSWeight(attributes, options.constraints);
      graph.setEdgeAttribute(edge, 'qosWeight', qosWeight);
    });

    // Find path using QoS-weighted graph
    const request = {
      source,
      destination,
      algorithm: 'dijkstra' as const,
      options: {
        weightFunction: (_, attributes) => attributes.qosWeight || attributes.weight || 1
      },
      filters: qosFilters
    };

    return this.pathfindingService.findPath(request);
  }

  async loadBalancedRouting(
    source: string,
    destination: string,
    options: LoadBalancingOptions,
    filters: PathfindingFilters = {}
  ): Promise<PathResult[]> {
    const maxPaths = options.maxPaths || 3;

    // Find multiple paths
    const kPathsRequest = {
      source,
      destination,
      algorithm: 'k-shortest' as const,
      options: { k: maxPaths },
      filters
    };

    const paths = await this.pathfindingService.findPath(kPathsRequest);

    // Apply load balancing strategy
    return this.applyLoadBalancing(paths, options);
  }

  async trafficEngineering(
    demands: Array<{ source: string, destination: string, demand: number }>,
    options: TrafficEngineeringOptions,
    filters: PathfindingFilters = {}
  ): Promise<{ paths: PathResult[], optimization: any }> {
    const graph = await this.graphService.buildGraph(filters);

    // Solve traffic engineering problem
    const optimization = await this.solveTrafficEngineering(graph, demands, options);

    // Generate optimized paths
    const paths: PathResult[] = [];
    for (const demand of demands) {
      const pathRequest = {
        source: demand.source,
        destination: demand.destination,
        algorithm: 'dijkstra' as const,
        filters
      };

      const demandPaths = await this.pathfindingService.findPath(pathRequest);
      paths.push(...demandPaths);
    }

    return { paths, optimization };
  }

  async faultTolerantRouting(
    source: string,
    destination: string,
    faultScenarios: string[][],
    filters: PathfindingFilters = {}
  ): Promise<PathResult[]> {
    const paths: PathResult[] = [];

    // Find primary path
    const primaryRequest = {
      source,
      destination,
      algorithm: 'dijkstra' as const,
      filters
    };

    const primaryPaths = await this.pathfindingService.findPath(primaryRequest);
    if (primaryPaths.length > 0) {
      paths.push(primaryPaths[0]);
    }

    // Find backup paths for each fault scenario
    for (const faultScenario of faultScenarios) {
      const faultFilters = {
        ...filters,
        excludeNodes: [...(filters.excludeNodes || []), ...faultScenario]
      };

      const backupRequest = {
        source,
        destination,
        algorithm: 'dijkstra' as const,
        filters: faultFilters
      };

      const backupPaths = await this.pathfindingService.findPath(backupRequest);
      if (backupPaths.length > 0) {
        backupPaths[0].metadata.algorithm = 'fault-tolerant-backup';
        paths.push(backupPaths[0]);
      }
    }

    return paths;
  }

  private calculateQoSWeight(linkAttributes: any, constraints: any): number {
    let weight = linkAttributes.weight || linkAttributes.distance || 1;

    // Apply latency constraints
    if (constraints.maxLatency) {
      const estimatedLatency = this.estimateLatency(linkAttributes);
      if (estimatedLatency > constraints.maxLatency) {
        weight *= 10; // Heavy penalty
      }
    }

    // Apply bandwidth constraints
    if (constraints.minBandwidth) {
      const availableBandwidth = this.getAvailableBandwidth(linkAttributes);
      if (availableBandwidth < constraints.minBandwidth) {
        weight *= 5; // Moderate penalty
      }
    }

    // Apply reliability constraints
    if (constraints.minReliability) {
      const reliability = this.getReliability(linkAttributes);
      if (reliability < constraints.minReliability) {
        weight *= 3;
      }
    }

    return weight;
  }

  private applyLoadBalancing(paths: PathResult[], options: LoadBalancingOptions): PathResult[] {
    switch (options.strategy) {
      case 'equal-cost':
        return this.equalCostLoadBalancing(paths);
      case 'weighted':
        return this.weightedLoadBalancing(paths, options.trafficSplitRatio);
      case 'adaptive':
        return this.adaptiveLoadBalancing(paths);
      default:
        return paths;
    }
  }

  private equalCostLoadBalancing(paths: PathResult[]): PathResult[] {
    // Find paths with equal or similar costs
    if (paths.length === 0) return paths;

    const minCost = Math.min(...paths.map(p => p.cost));
    const tolerance = minCost * 0.1; // 10% tolerance

    return paths.filter(path => path.cost <= minCost + tolerance);
  }

  private weightedLoadBalancing(
    paths: PathResult[],
    ratios?: number[]
  ): PathResult[] {
    if (!ratios || ratios.length !== paths.length) {
      // Default to inverse cost weighting
      const totalCost = paths.reduce((sum, path) => sum + path.cost, 0);
      paths.forEach((path, index) => {
        const weight = totalCost / path.cost; // Higher weight for lower cost
        path.metadata.loadBalanceWeight = weight;
      });
    } else {
      paths.forEach((path, index) => {
        path.metadata.loadBalanceWeight = ratios[index];
      });
    }

    return paths;
  }

  private adaptiveLoadBalancing(paths: PathResult[]): PathResult[] {
    // Implement adaptive load balancing based on current network conditions
    // This would typically involve real-time monitoring data

    paths.forEach(path => {
      const utilization = this.getCurrentUtilization(path);
      const adaptiveWeight = 1 / (1 + utilization); // Lower weight for higher utilization
      path.metadata.loadBalanceWeight = adaptiveWeight;
    });

    return paths.sort((a, b) =>
      (b.metadata.loadBalanceWeight || 0) - (a.metadata.loadBalanceWeight || 0)
    );
  }

  private async solveTrafficEngineering(
    graph: Graph,
    demands: any[],
    options: TrafficEngineeringOptions
  ): Promise<any> {
    // Simplified traffic engineering optimization
    // In practice, this would use linear programming or other optimization techniques

    const linkUtilization = new Map<string, number>();
    const pathAssignments = new Map<string, string[]>();

    // Initialize link utilization
    graph.forEachEdge(edge => {
      linkUtilization.set(edge, 0);
    });

    // Assign paths to minimize congestion
    for (const demand of demands) {
      const demandKey = `${demand.source}-${demand.destination}`;

      // Find path that minimizes max link utilization
      const bestPath:any = this.findMinCongestPath(graph, demand, linkUtilization);

      if (bestPath) {
        pathAssignments.set(demandKey, bestPath);

        // Update link utilization
        for (let i = 0; i < bestPath.length - 1; i++) {
          const edge = graph.edge(bestPath[i], bestPath[i + 1]);
          if (edge) {
            const currentUtil = linkUtilization.get(edge) || 0;
            linkUtilization.set(edge, currentUtil + demand.demand);
          }
        }
      }
    }

    return {
      objective: options.objective,
      linkUtilization: Object.fromEntries(linkUtilization),
      pathAssignments: Object.fromEntries(pathAssignments),
      maxUtilization: Math.max(...Array.from(linkUtilization.values()))
    };
  }

  private async findMinCongestPath(
    graph: Graph,
    demand: any,
    currentUtilization: Map<string, number>
  ): Promise<string[] | null> {
    const modifiedGraph = this.adjustWeights(graph, currentUtilization);

    try {
      return bidirectional(modifiedGraph, demand.source, demand.destination);
    } catch {
      return null;
    }
  }


  private adjustWeights(
    graph: Graph,
    utilization: Map<string, number>
  ): Graph {
    const g = graph.copy();
    g.forEachEdge((edge, attrs) => {
      const util = utilization.get(edge) || 0;
      const cap = attrs.capacity ?? 1000;
      const factor = 1 + (util / cap) ** 2;
      g.setEdgeAttribute(edge, 'weight', attrs.weight * factor);
    });
    return g;
  }

  private estimateLatency(linkAttributes: any): number {
    const distance = linkAttributes.distance || 0;
    const linkType = linkAttributes.link_type || 'Fiber';

    let baseLatency = distance * 0.005; // 5ms per 1000km

    switch (linkType) {
      case 'Satellite':
        baseLatency += 250; // Geostationary satellite delay
        break;
      case 'Microwave':
        baseLatency *= 1.1;
        break;
      case 'Fiber':
      default:
        // Base latency unchanged
        break;
    }

    return baseLatency;
  }

  private getAvailableBandwidth(linkAttributes: any): number {
    // Mock implementation - in reality, this would query current utilization
    const capacity = linkAttributes.capacity || this.getDefaultCapacity(linkAttributes.link_type);
    const utilization = linkAttributes.utilization || 0.3; // 30% default utilization

    return capacity * (1 - utilization);
  }

  private getReliability(linkAttributes: any): number {
    // Mock reliability based on link type and age
    const linkType = linkAttributes.link_type || 'Fiber';

    let baseReliability = 0.99;

    switch (linkType) {
      case 'Fiber':
        baseReliability = 0.999;
        break;
      case 'Microwave':
        baseReliability = 0.995;
        break;
      case 'Satellite':
        baseReliability = 0.990;
        break;
    }

    return baseReliability;
  }

  private getDefaultCapacity(linkType: string): number {
    switch (linkType) {
      case 'Fiber': return 10000; // 10 Gbps
      case 'Microwave': return 1000; // 1 Gbps  
      case 'Satellite': return 100; // 100 Mbps
      default: return 1000;
    }
  }

  private getCurrentUtilization(path: PathResult): number {
    // Mock current utilization - in reality, this would come from monitoring systems
    return Math.random() * 0.8; // 0-80% utilization
  }
}