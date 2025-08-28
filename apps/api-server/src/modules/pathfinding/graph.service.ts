import { Inject, Injectable } from '@nestjs/common';
import { Database } from 'better-sqlite3';
import Graph from 'graphology';
import UndirectedGraph from 'graphology';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { LRUCache } from 'lru-cache';
import { DbSettingsService } from '../dbsettings/dbsettings.service';
import { PathfindingFilters, NetworkNode, NetworkLink } from './pathfinding-interfaces';

@Injectable()
export class GraphService {
  private graphCache = new LRUCache<string, Graph>({ 
    max: 10, 
    ttl: 1000 * 60 * 5 // 5 minutes
  });

  constructor(
    private readonly dbService: DbSettingsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private get db(): Database {
    return this.dbService.getCurrentDatabase();
  }

  async buildGraph(filters: PathfindingFilters = {}): Promise<Graph> {
    const cacheKey = this.generateCacheKey(filters);
    
    // Check cache first
    if (this.graphCache.has(cacheKey)) {
      return this.graphCache.get(cacheKey)!.copy();
    }

    const graph = new UndirectedGraph();
    
    // Build nodes query with filters
    const nodesQuery = this.buildNodesQuery(filters);
    const nodes = this.db.prepare(nodesQuery.sql).all(nodesQuery.params) as NetworkNode[];
    
    // Add nodes to graph
    nodes.forEach(node => {
      graph.addNode(node.site_id, {
        ...node,
        coordinates: node.geometry.coordinates,
        weight: this.calculateNodeWeight(node)
      });
    });

    // Build links query with filters
    const linksQuery = this.buildLinksQuery(filters);
    const links = this.db.prepare(linksQuery.sql).all(linksQuery.params) as NetworkLink[];
    
    // Add edges to graph
    links.forEach(link => {
      if (graph.hasNode(link.site_a_id) && graph.hasNode(link.site_b_id)) {
        const weight = this.calculateLinkWeight(link, filters);
        graph.addEdge(link.site_a_id, link.site_b_id, {
          ...link,
          weight: weight,
          distance: link.link_distance,
          type: link.link_type
        });
      }
    });

    // Cache the graph
    this.graphCache.set(cacheKey, graph.copy());
    
    return graph;
  }

  private buildNodesQuery(filters: PathfindingFilters) {
    let sql = `
      SELECT site_id, site_virtual_name, site_name, country, city, 
             platform, network, last_modified_at, is_deleted,
             AsGeoJSON(geometry) as geometry
      FROM sites 
      WHERE is_deleted = 0
    `;
    
    const params: any[] = [];
    
    if (filters.country?.length) {
      sql += ` AND country IN (${filters.country.map(() => '?').join(',')})`;
      params.push(...filters.country);
    }
    
    if (filters.city?.length) {
      sql += ` AND city IN (${filters.city.map(() => '?').join(',')})`;
      params.push(...filters.city);
    }
    
    if (filters.platform?.length) {
      sql += ` AND platform IN (${filters.platform.map(() => '?').join(',')})`;
      params.push(...filters.platform);
    }
    
    if (filters.network?.length) {
      sql += ` AND network IN (${filters.network.map(() => '?').join(',')})`;
      params.push(...filters.network);
    }
    
    if (filters.excludeNodes?.length) {
      sql += ` AND site_id NOT IN (${filters.excludeNodes.map(() => '?').join(',')})`;
      params.push(...filters.excludeNodes);
    }
    
    return { sql, params };
  }

  private buildLinksQuery(filters: PathfindingFilters) {
    let sql = `
      SELECT link_id, site_a_id, site_b_id, link_type, link_distance,
             link_kmz_no, last_modified_at, is_deleted,
             AsGeoJSON(geometry) as geometry
      FROM links 
      WHERE is_deleted = 0
    `;
    
    const params: any[] = [];
    
    if (filters.excludeLinks?.length) {
      sql += ` AND link_id NOT IN (${filters.excludeLinks.map(() => '?').join(',')})`;
      params.push(...filters.excludeLinks);
    }
    
    return { sql, params };
  }

  private calculateNodeWeight(node: NetworkNode): number {
    let weight = 1;
    
    // Adjust weight based on platform reliability
    switch (node.platform) {
      case 'Fiber': weight *= 0.8; break;
      case 'Wireless': weight *= 1.2; break;
      case 'Satellite': weight *= 1.5; break;
      default: weight *= 1.0;
    }
    
    return weight;
  }

  private calculateLinkWeight(link: NetworkLink, filters: PathfindingFilters): number {
    let weight = link.link_distance;
    
    // Apply QoS requirements
    if (filters.qosRequirements) {
      const qos = filters.qosRequirements;
      
      // Latency penalty
      if (qos.maxLatency) {
        const estimatedLatency = this.estimateLatency(link);
        if (estimatedLatency > qos.maxLatency) {
          weight *= 2; // Heavy penalty for exceeding latency
        }
      }
      
      // Bandwidth consideration
      if (qos.minBandwidth) {
        const linkCapacity = this.getLinkCapacity(link);
        if (linkCapacity < qos.minBandwidth) {
          weight *= 1.5; // Moderate penalty for insufficient bandwidth
        }
      }
      
      // Priority adjustment
      switch (qos.priority) {
        case 'critical': weight *= 0.7; break;
        case 'high': weight *= 0.8; break;
        case 'medium': weight *= 1.0; break;
        case 'low': weight *= 1.2; break;
      }
    }
    
    return weight;
  }

  private estimateLatency(link: NetworkLink): number {
    // Rough latency estimation based on distance and link type
    const baseLatency = link.link_distance * 0.005; // ~5ms per 1000km
    
    switch (link.link_type) {
      case 'Fiber': return baseLatency;
      case 'Microwave': return baseLatency * 1.2;
      case 'Satellite': return baseLatency + 250; // Satellite delay
      default: return baseLatency;
    }
  }

  private getLinkCapacity(link: NetworkLink): number {
    // Mock capacity based on link type
    switch (link.link_type) {
      case 'Fiber': return 10000; // 10 Gbps
      case 'Microwave': return 1000; // 1 Gbps
      case 'Satellite': return 100; // 100 Mbps
      default: return 100;
    }
  }

  private generateCacheKey(filters: PathfindingFilters): string {
    return JSON.stringify(filters);
  }

  async getNodeById(nodeId: string): Promise<NetworkNode | null> {
    const sql = `
      SELECT site_id, site_virtual_name, site_name, country, city, 
             platform, network, last_modified_at, is_deleted,
             AsGeoJSON(geometry) as geometry
      FROM sites 
      WHERE site_id = ? AND is_deleted = 0
    `;
    
    const result = this.db.prepare(sql).get(nodeId) as NetworkNode | undefined;
    return result || null;
  }

  async getLinkById(linkId: string): Promise<NetworkLink | null> {
    const sql = `
      SELECT link_id, site_a_id, site_b_id, link_type, link_distance,
             link_kmz_no, last_modified_at, is_deleted,
             AsGeoJSON(geometry) as geometry
      FROM links 
      WHERE link_id = ? AND is_deleted = 0
    `;
    
    const result = this.db.prepare(sql).get(linkId) as NetworkLink | undefined;
    return result || null;
  }

  async clearCache(): Promise<void> {
    this.graphCache.clear();
    await this.cacheManager.clear();
  }
}
