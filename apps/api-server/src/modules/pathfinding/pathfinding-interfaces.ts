
// ===== CORE INTERFACES =====
export interface NetworkNode {
  site_id: string;
  site_virtual_name: string;
  site_name: string;
  country: string;
  city: string;
  platform: string;
  network: string;
  last_modified_at: string;
  is_deleted: number;
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
}

export interface NetworkLink {
  link_id: string;
  site_a_id: string;
  site_b_id: string;
  link_type: string;
  link_distance: number;
  link_kmz_no: string;
  last_modified_at: string;
  is_deleted: number;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
}

export interface PathfindingFilters {
  country?: string[];
  city?: string[];
  platform?: string[];
  network?: string[];
  excludeNodes?: string[];
  excludeLinks?: string[];
  qosRequirements?: QoSRequirements;
}

export interface QoSRequirements {
  maxLatency?: number;
  minBandwidth?: number;
  reliability?: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface PathResult {
  path: string[];
  distance: number;
  cost: number;
  latency?: number;
  bandwidth?: number;
  reliability?: number;
  nodes: NetworkNode[];
  links: NetworkLink[];
  metadata: PathMetadata;
}

export interface PathMetadata {
  algorithm: string;
  executionTime: number;
  hopCount: number;
  qosScore?: number;
  riskAssessment?: RiskAssessment;
  loadBalanceWeight?: number;
  
}

export interface RiskAssessment {
  redundancy: number;
  singlePointsOfFailure: string[];
  diversityScore: number;
  resilienceRating: 'low' | 'medium' | 'high';
}

// ===== ALGORITHM SPECIFIC INTERFACES =====

export interface DijkstraOptions {
  weightFunction?: (link: NetworkLink) => number;
  bidirectional?: boolean;
}

export interface AStarOptions {
  heuristic?: (from: NetworkNode, to: NetworkNode) => number;
  weightFunction?: (link: NetworkLink) => number;
}

export interface KShortestPathsOptions {
  k: number;
  allowLoops?: boolean;
  diversityFactor?: number;
}

export interface DisjointPathsOptions {
  pathType: 'node-disjoint' | 'edge-disjoint' | 'link-disjoint';
  maxPaths?: number;
  minPathLength?: number;
}

// ===== ADVANCED ROUTING INTERFACES =====

export interface QoSRoutingOptions {
  constraints: QoSConstraints;
  optimizationGoal: 'cost' | 'latency' | 'bandwidth' | 'reliability' | 'composite';
}

export interface QoSConstraints {
  maxLatency?: number;
  minBandwidth?: number;
  maxJitter?: number;
  minReliability?: number;
  maxPacketLoss?: number;
}

export interface LoadBalancingOptions {
  strategy: 'equal-cost' | 'weighted' | 'adaptive';
  maxPaths?: number;
  trafficSplitRatio?: number[];
}

export interface TrafficEngineeringOptions {
  objective: 'minimize-congestion' | 'maximize-utilization' | 'balance-load';
  timeWindow?: number;
  trafficMatrix?: TrafficDemand[];
}

export interface TrafficDemand {
  source: string;
  destination: string;
  demand: number;
  priority: number;
}

// ===== NETWORK ANALYSIS INTERFACES =====

export interface ConnectivityAnalysis {
  stronglyConnectedComponents: string[][];
  articulationPoints: string[];
  bridges: string[];
  connectivity: number;
}

export interface CentralityMetrics {
  degreeCentrality: Record<string, number>;
  betweennessCentrality: Record<string, number>;
  closenessCentrality: Record<string, number>;
  eigenvectorCentrality: Record<string, number>;
  pagerank: Record<string, number>;
}

export interface ResilienceAssessment {
  redundancy: number;
  robustness: number;
  vulnerabilityScore: number;
  criticalNodes: string[];
  criticalLinks: string[];
}

// ===== MONITORING & ANALYTICS INTERFACES =====

export interface PerformanceMetrics {
  pathComputationTime: number;
  graphBuildTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  algorithmEfficiency: number;
}

export interface NetworkHealth {
  totalNodes: number;
  totalLinks: number;
  averageNodeDegree: number;
  networkDiameter: number;
  clustering: number;
  connectivity: number;
}

export interface FailureSimulation {
  failureType: 'node' | 'link' | 'area';
  failedElements: string[];
  impactAssessment: ImpactAssessment;
  recoveryOptions: RecoveryOption[];
}

export interface ImpactAssessment {
  affectedPaths: number;
  isolatedNodes: string[];
  performanceDegradation: number;
  serviceDisruption: number;
}

export interface RecoveryOption {
  strategy: string;
  alternativePaths: PathResult[];
  recoveryTime: number;
  cost: number;
}

// ===== REQUEST/RESPONSE INTERFACES =====

export interface PathfindingRequest {
  source: string;
  destination: string;
  algorithm: 'dijkstra' | 'astar' | 'k-shortest' | 'disjoint';
  options?: any;
  filters?: PathfindingFilters;
}

export interface PathfindingResponse {
  success: boolean;
  paths: PathResult[];
  metadata: {
    requestId: string;
    timestamp: string;
    processingTime: number;
    cacheHit: boolean;
  };
  error?: string;
}

export interface BatchPathfindingRequest {
  requests: PathfindingRequest[];
  options?: {
    parallel?: boolean;
    maxConcurrency?: number;
    timeout?: number;
  };
}

// ===== CACHING INTERFACES =====

export interface CacheConfig {
  maxSize: number;
  ttl: number; // Time to live in seconds
  strategy: 'lru' | 'lfu' | 'fifo';
}

export interface CacheKey {
  source: string;
  destination: string;
  algorithm: string;
  filtersHash: string;
  optionsHash: string;
}

// ===== VISUALIZATION INTERFACES =====

export interface PathVisualization {
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
  layout: 'force' | 'hierarchical' | 'circular' | 'geographic';
}

export interface VisualizationNode {
  id: string;
  label: string;
  x?: number;
  y?: number;
  size: number;
  color: string;
  attributes: Record<string, any>;
}

export interface VisualizationEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  color: string;
  width: number;
  attributes: Record<string, any>;
}