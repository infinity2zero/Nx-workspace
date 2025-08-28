
import { LRUCache as LRU } from 'lru-cache';
import { PathResult, CacheConfig, CacheKey } from './pathfinding-interfaces';
import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CacheService {
  private pathCache: LRU<string, PathResult[]>;
  private graphCache: LRU<string, any>;
  private metricsCache: LRU<string, any>;

  constructor() {
    this.pathCache = new LRU({
      max: 1000,
      ttl: 1000 * 60 * 10, // 10 minutes
    });

    this.graphCache = new LRU({
      max: 50,
      ttl: 1000 * 60 * 5, // 5 minutes
    });

    this.metricsCache = new LRU({
      max: 100,
      ttl: 1000 * 60 * 15, // 15 minutes
    });
  }

  generateCacheKey(keyData: CacheKey): string {
    const keyString = JSON.stringify({
      source: keyData.source,
      destination: keyData.destination,
      algorithm: keyData.algorithm,
      filtersHash: keyData.filtersHash,
      optionsHash: keyData.optionsHash,
    });

    return crypto.createHash('md5').update(keyString).digest('hex');
  }

  generateHash(obj: any): string {
    return crypto.createHash('md5').update(JSON.stringify(obj)).digest('hex');
  }

  // Path caching
  setPath(key: string, paths: PathResult[]): void {
    this.pathCache.set(key, paths);
  }

  getPath(key: string): PathResult[] | undefined {
    return this.pathCache.get(key);
  }

  // Graph caching
  setGraph(key: string, graph: any): void {
    this.graphCache.set(key, graph);
  }

  getGraph(key: string): any | undefined {
    return this.graphCache.get(key);
  }

  // Metrics caching
  setMetrics(key: string, metrics: any): void {
    this.metricsCache.set(key, metrics);
  }

  getMetrics(key: string): any | undefined {
    return this.metricsCache.get(key);
  }

  // Cache management
  clearAll(): void {
    this.pathCache.clear();
    this.graphCache.clear();
    this.metricsCache.clear();
  }

  clearPaths(): void {
    this.pathCache.clear();
  }

  clearGraphs(): void {
    this.graphCache.clear();
  }

  clearMetrics(): void {
    this.metricsCache.clear();
  }

  getStats() {
    return {
      paths: {
        size: this.pathCache.size,
        max: this.pathCache.max,
        hitRate: this.calculateHitRate(this.pathCache)
      },
      graphs: {
        size: this.graphCache.size,
        max: this.graphCache.max,
        hitRate: this.calculateHitRate(this.graphCache)
      },
      metrics: {
        size: this.metricsCache.size,
        max: this.metricsCache.max,
        hitRate: this.calculateHitRate(this.metricsCache)
      }
    };
  }

  private calculateHitRate(cache: LRU<any, any>): number {
    // LRU doesn't provide built-in hit rate, so we'll mock it
    // In production, you might want to use a different cache implementation
    // or track hits/misses manually
    return cache.size / (cache.max || 1);
  }

  // Preemptive cache warming
  async warmCache(commonRoutes: Array<{ source: string, destination: string }>): Promise<void> {
    // This would be implemented to pre-calculate common paths
    console.log(`Warming cache for ${commonRoutes.length} common routes`);
  }

  // Cache invalidation patterns
  invalidateByPattern(pattern: RegExp): void {
    // Invalidate path cache entries matching pattern
    const pathKeys = Array.from(this.pathCache.keys());
    pathKeys.forEach(key => {
      if (pattern.test(key)) {
        this.pathCache.delete(key);
      }
    });

    // Similar for other caches
    const graphKeys = Array.from(this.graphCache.keys());
    graphKeys.forEach(key => {
      if (pattern.test(key)) {
        this.graphCache.delete(key);
      }
    });
  }

  // Invalidate cache entries related to specific nodes/links
  invalidateByElements(nodeIds: string[], linkIds: string[]): void {
    const escapedIds = [...nodeIds, ...linkIds].map(id =>
      id.replace(
        /[.*+?^${}()|[\]\\]/g,   // notice the fixed character class
        '\\$&'                   // double-escaped replacement
      )
    );

    // 2️⃣ Join into one big alternation string
    const patternString = escapedIds.join('|');

    // 3️⃣ Construct the RegExp from that single string
    const elementsPattern = new RegExp(patternString, 'g');

    this.invalidateByPattern(elementsPattern);
  }

}
