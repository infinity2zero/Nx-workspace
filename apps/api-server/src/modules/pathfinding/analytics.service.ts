// analytics.service.ts
import { Injectable } from '@nestjs/common';
import  Graph  from 'graphology';
import {
  degree as degreeCentrality,
  closeness as closenessCentrality,
  betweenness as betweennessCentrality
} from 'graphology-metrics/centrality';

import { density, diameter } from 'graphology-metrics/graph';
import { connectedComponents } from 'graphology-components';
import { GraphService } from './graph.service';
import {
  CentralityMetrics,
  ConnectivityAnalysis,
  ResilienceAssessment,
  NetworkHealth,
  FailureSimulation,
  PathfindingFilters
} from './pathfinding-interfaces';

@Injectable()
export class AnalyticsService {
  constructor(private readonly graphService: GraphService) {}

  async analyzeCentrality(filters: PathfindingFilters = {}): Promise<CentralityMetrics> {
    const graph = await this.graphService.buildGraph(filters);
    
    return {
      degreeCentrality: degreeCentrality(graph),
      betweennessCentrality: betweennessCentrality(graph),
      closenessCentrality: closenessCentrality(graph),
      eigenvectorCentrality: this.calculateEigenvectorCentrality(graph),
      pagerank: this.calculatePageRank(graph)
    };
  }

  async analyzeConnectivity(filters: PathfindingFilters = {}): Promise<ConnectivityAnalysis> {
    const graph = await this.graphService.buildGraph(filters);
    
    return {
      stronglyConnectedComponents: connectedComponents(graph),
      articulationPoints: this.findArticulationPoints(graph),
      bridges: this.findBridges(graph),
      connectivity: this.calculateConnectivity(graph)
    };
  }

  async assessResilience(filters: PathfindingFilters = {}): Promise<ResilienceAssessment> {
    const graph = await this.graphService.buildGraph(filters);
    const centrality = await this.analyzeCentrality(filters);
    const connectivity = await this.analyzeConnectivity(filters);
    
    const criticalNodes = this.identifyCriticalNodes(centrality, connectivity);
    const criticalLinks = this.identifyCriticalLinks(graph);
    
    return {
      redundancy: this.calculateRedundancy(graph),
      robustness: this.calculateRobustness(graph, criticalNodes),
      vulnerabilityScore: this.calculateVulnerability(criticalNodes, criticalLinks),
      criticalNodes,
      criticalLinks
    };
  }

  async getNetworkHealth(filters: PathfindingFilters = {}): Promise<NetworkHealth> {
    const graph = await this.graphService.buildGraph(filters);
    
    const totalNodes = graph.order;
    const totalLinks = graph.size;
    const averageNodeDegree = (2 * totalLinks) / totalNodes;
    const networkDiameter = diameter(graph);
    const clustering = this.calculateClusteringCoefficient(graph);
    const connectivity = this.calculateConnectivity(graph);
    
    return {
      totalNodes,
      totalLinks,
      averageNodeDegree,
      networkDiameter,
      clustering,
      connectivity
    };
  }

  async simulateFailures(
    failedElements: string[],
    failureType: 'node' | 'link' | 'area',
    filters: PathfindingFilters = {}
  ): Promise<FailureSimulation> {
    const originalGraph = await this.graphService.buildGraph(filters);
    const failedGraph = originalGraph.copy();
    
    // Apply failures
    if (failureType === 'node') {
      failedElements.forEach(nodeId => {
        if (failedGraph.hasNode(nodeId)) {
          failedGraph.dropNode(nodeId);
        }
      });
    } else if (failureType === 'link') {
      failedElements.forEach(linkId => {
        if (failedGraph.hasEdge(linkId)) {
          failedGraph.dropEdge(linkId);
        }
      });
    }
    
    const impactAssessment = this.assessFailureImpact(originalGraph, failedGraph);
    const recoveryOptions = await this.generateRecoveryOptions(
      originalGraph, 
      failedGraph, 
      failedElements
    );
    
    return {
      failureType,
      failedElements,
      impactAssessment,
      recoveryOptions
    };
  }

  private calculateEigenvectorCentrality(graph: Graph): Record<string, number> {
    // Simplified eigenvector centrality implementation
    const nodes = graph.nodes();
    const centrality: Record<string, number> = {};
    
    // Initialize with degree centrality
    nodes.forEach(node => {
      centrality[node] = graph.degree(node);
    });
    
    // Power iteration method
    for (let iter = 0; iter < 100; iter++) {
      const newCentrality: Record<string, number> = {};
      let maxValue = 0;
      
      nodes.forEach(node => {
        let sum = 0;
        graph.forEachNeighbor(node, neighbor => {
          sum += centrality[neighbor] || 0;
        });
        newCentrality[node] = sum;
        maxValue = Math.max(maxValue, sum);
      });
      
      // Normalize
      if (maxValue > 0) {
        nodes.forEach(node => {
          newCentrality[node] = newCentrality[node] / maxValue;
        });
      }
      
      // Check convergence
      let converged = true;
      nodes.forEach(node => {
        if (Math.abs((centrality[node] || 0) - newCentrality[node]) > 0.001) {
          converged = false;
        }
      });
      
      Object.assign(centrality, newCentrality);
      
      if (converged) break;
    }
    
    return centrality;
  }

  private calculatePageRank(graph: Graph, damping = 0.85, iterations = 100): Record<string, number> {
    const nodes = graph.nodes();
    const pagerank: Record<string, number> = {};
    const n = nodes.length;
    
    // Initialize
    nodes.forEach(node => {
      pagerank[node] = 1 / n;
    });
    
    for (let iter = 0; iter < iterations; iter++) {
      const newPagerank: Record<string, number> = {};
      
      nodes.forEach(node => {
        newPagerank[node] = (1 - damping) / n;
        
        graph.forEachInNeighbor(node, neighbor => {
          const outDegree = graph.outDegree(neighbor);
          if (outDegree > 0) {
            newPagerank[node] += damping * (pagerank[neighbor] / outDegree);
          }
        });
      });
      
      Object.assign(pagerank, newPagerank);
    }
    
    return pagerank;
  }

  private findArticulationPoints(graph: Graph): string[] {
    // Tarjan's algorithm for finding articulation points
    const visited = new Set<string>();
    const articulationPoints = new Set<string>();
    const discovery = new Map<string, number>();
    const low = new Map<string, number>();
    const parent = new Map<string, string | null>();
    let time = 0;
    
    const dfs = (node: string) => {
      visited.add(node);
      discovery.set(node, time);
      low.set(node, time);
      time++;
      
      let children = 0;
      
      graph.forEachNeighbor(node, neighbor => {
        if (!visited.has(neighbor)) {
          children++;
          parent.set(neighbor, node);
          dfs(neighbor);
          
          low.set(node, Math.min(low.get(node)!, low.get(neighbor)!));
          
          // Root is articulation point if it has more than one child
          if (parent.get(node) === null && children > 1) {
            articulationPoints.add(node);
          }
          
          // Non-root is articulation point if low[neighbor] >= discovery[node]
          if (parent.get(node) !== null && low.get(neighbor)! >= discovery.get(node)!) {
            articulationPoints.add(node);
          }
        } else if (neighbor !== parent.get(node)) {
          low.set(node, Math.min(low.get(node)!, discovery.get(neighbor)!));
        }
      });
    };
    
    graph.forEachNode(node => {
      if (!visited.has(node)) {
        dfs(node);
      }
    });
    
    return Array.from(articulationPoints);
  }

  private findBridges(graph: Graph): string[] {
    // Tarjan's algorithm for finding bridges
    const visited = new Set<string>();
    const bridges: string[] = [];
    const discovery = new Map<string, number>();
    const low = new Map<string, number>();
    const parent = new Map<string, string | null>();
    let time = 0;
    
    const dfs = (node: string) => {
      visited.add(node);
      discovery.set(node, time);
      low.set(node, time);
      time++;
      
      graph.forEachNeighbor(node, neighbor => {
        if (!visited.has(neighbor)) {
          parent.set(neighbor, node);
          dfs(neighbor);
          
          low.set(node, Math.min(low.get(node)!, low.get(neighbor)!));
          
          // Bridge condition
          if (low.get(neighbor)! > discovery.get(node)!) {
            const edge = graph.edge(node, neighbor);
            if (edge) bridges.push(edge);
          }
        } else if (neighbor !== parent.get(node)) {
          low.set(node, Math.min(low.get(node)!, discovery.get(neighbor)!));
        }
      });
    };
    
    graph.forEachNode(node => {
      if (!visited.has(node)) {
        dfs(node);
      }
    });
    
    return bridges;
  }

  private calculateConnectivity(graph: Graph): number {
    // Calculate node connectivity (minimum nodes to disconnect)
    const components = connectedComponents(graph);
    if (components.length > 1) return 0;
    
    // For simplicity, return minimum degree as approximation
    let minDegree = Infinity;
    graph.forEachNode(node => {
      minDegree = Math.min(minDegree, graph.degree(node));
    });
    
    return minDegree === Infinity ? 0 : minDegree;
  }

  private calculateClusteringCoefficient(graph: Graph): number {
    let totalClustering = 0;
    let nodeCount = 0;
    
    graph.forEachNode(node => {
      const neighbors = graph.neighbors(node);
      if (neighbors.length < 2) return;
      
      let edgesBetweenNeighbors = 0;
      for (let i = 0; i < neighbors.length; i++) {
        for (let j = i + 1; j < neighbors.length; j++) {
          if (graph.hasEdge(neighbors[i], neighbors[j])) {
            edgesBetweenNeighbors++;
          }
        }
      }
      
      const possibleEdges = (neighbors.length * (neighbors.length - 1)) / 2;
      const clustering = edgesBetweenNeighbors / possibleEdges;
      
      totalClustering += clustering;
      nodeCount++;
    });
    
    return nodeCount > 0 ? totalClustering / nodeCount : 0;
  }

  private identifyCriticalNodes(
    centrality: CentralityMetrics, 
    connectivity: ConnectivityAnalysis
  ): string[] {
    const critical = new Set<string>();
    
    // Add articulation points
    connectivity.articulationPoints.forEach(node => critical.add(node));
    
    // Add high centrality nodes (top 10%)
    const sortedBetweenness = Object.entries(centrality.betweennessCentrality)
      .sort(([,a], [,b]) => b - a);
    
    const topCount = Math.ceil(sortedBetweenness.length * 0.1);
    for (let i = 0; i < topCount && i < sortedBetweenness.length; i++) {
      critical.add(sortedBetweenness[i][0]);
    }
    
    return Array.from(critical);
  }

  private identifyCriticalLinks(graph: Graph): string[] {
    const bridges = this.findBridges(graph);
    
    // Also add high-traffic links (simplified)
    const criticalLinks = new Set(bridges);
    
    graph.forEachEdge((edge, attributes) => {
      // If link has high utilization or is a major route
      if (attributes.weight && attributes.weight > 1000) {
        criticalLinks.add(edge);
      }
    });
    
    return Array.from(criticalLinks);
  }

  private calculateRedundancy(graph: Graph): number {
    const totalNodes = graph.order;
    if (totalNodes === 0) return 0;
    
    const articulationPoints = this.findArticulationPoints(graph);
    return 1 - (articulationPoints.length / totalNodes);
  }

  private calculateRobustness(graph: Graph, criticalNodes: string[]): number {
    if (graph.order === 0) return 0;
    
    // Simulate removal of critical nodes and measure impact
    const originalSize = graph.size;
    let remainingConnectivity = 0;
    
    const testGraph = graph.copy();
    criticalNodes.forEach(node => {
      if (testGraph.hasNode(node)) {
        testGraph.dropNode(node);
      }
    });
    
    const components = connectedComponents(testGraph);
    if (components.length > 0) {
      remainingConnectivity = Math.max(...components.map(c => c.length)) / graph.order;
    }
    
    return remainingConnectivity;
  }

  private calculateVulnerability(criticalNodes: string[], criticalLinks: string[]): number {
    // Higher score means more vulnerable
    const nodeVulnerability = Math.min(1.0, criticalNodes.length / 10);
    const linkVulnerability = Math.min(1.0, criticalLinks.length / 20);
    
    return (nodeVulnerability + linkVulnerability) / 2;
  }

  private assessFailureImpact(originalGraph: Graph, failedGraph: Graph) {
    const originalComponents = connectedComponents(originalGraph);
    const failedComponents = connectedComponents(failedGraph);
    
    const isolatedNodes = failedGraph.nodes().filter(node => 
      failedGraph.degree(node) === 0
    );
    
    const affectedPaths = this.estimateAffectedPaths(originalGraph, failedGraph);
    const performanceDegradation = 1 - (failedGraph.size / originalGraph.size);
    
    return {
      affectedPaths,
      isolatedNodes,
      performanceDegradation,
      serviceDisruption: failedComponents.length > originalComponents.length ? 0.8 : 0.2
    };
  }

  private estimateAffectedPaths(originalGraph: Graph, failedGraph: Graph): number {
    // Simplified estimation based on lost connectivity
    const originalConnectivity = originalGraph.size;
    const remainingConnectivity = failedGraph.size;
    
    return originalConnectivity - remainingConnectivity;
  }

  private async generateRecoveryOptions(
    originalGraph: Graph,
    failedGraph: Graph,
    failedElements: string[]
  ) {
    // Generate recovery strategies
    const options = [];
    
    // Option 1: Restore failed elements
    options.push({
      strategy: 'restore-failed-elements',
      alternativePaths: [], // Would calculate alternative paths
      recoveryTime: failedElements.length * 2, // hours
      cost: failedElements.length * 1000 // cost units
    });
    
    // Option 2: Deploy temporary links
    options.push({
      strategy: 'deploy-temporary-links',
      alternativePaths: [],
      recoveryTime: failedElements.length * 0.5,
      cost: failedElements.length * 500
    });
    
    return options;
  }
}