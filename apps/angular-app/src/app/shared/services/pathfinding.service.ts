import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { 
  PathfindingRequest, 
  PathfindingResponse, 
  PathfindingFilters,
  NetworkNode,
  NetworkLink,
  CentralityMetrics,
  NetworkHealth
} from '../../shared/components/interfaces/pathfinding.interface';

@Injectable({
  providedIn: 'root'
})
export class PathfindingService {
  private readonly baseUrl = '/api/pathfinding';
  
  private pathResultsSubject = new BehaviorSubject<any[]>([]);
  public pathResults$ = this.pathResultsSubject.asObservable();

  constructor(private http: HttpClient) {}

  // Core pathfinding methods
  async findPath(request: PathfindingRequest): Promise<PathfindingResponse | undefined> {
    const response = await this.http.post<PathfindingResponse>(
      `${this.baseUrl}/path`, 
      request
    ).toPromise();
    
    if (response?.paths) {
      this.pathResultsSubject.next(response.paths);
    }
    
    return response!;
  }

  async findShortestPath(
    source: string, 
    destination: string, 
    filters?: PathfindingFilters
  ): Promise<PathfindingResponse | undefined> {
    return this.http.post<PathfindingResponse>(
      `${this.baseUrl}/shortest-path`,
      { source, destination, filters }
    ).toPromise()!;
  }

  async findAStarPath(
    source: string,
    destination: string,
    heuristic: 'euclidean' | 'manhattan' | 'great-circle' = 'euclidean',
    filters?: PathfindingFilters
  ): Promise<PathfindingResponse | undefined> {
    return this.http.post<PathfindingResponse>(
      `${this.baseUrl}/astar-path`,
      { source, destination, heuristic, filters }
    ).toPromise()!;
  }

  async findKShortestPaths(
    source: string,
    destination: string,
    k: number,
    options?: { allowLoops?: boolean; diversityFactor?: number },
    filters?: PathfindingFilters
  ): Promise<PathfindingResponse | undefined> {
    return this.http.post<PathfindingResponse>(
      `${this.baseUrl}/k-shortest-paths`,
      { source, destination, k, ...options, filters }
    ).toPromise()!;
  }

  async findDisjointPaths(
    source: string,
    destination: string,
    pathType: 'node-disjoint' | 'edge-disjoint' | 'link-disjoint',
    maxPaths?: number,
    filters?: PathfindingFilters
  ): Promise<PathfindingResponse | undefined> {
    return this.http.post<PathfindingResponse>(
      `${this.baseUrl}/disjoint-paths`,
      { source, destination, pathType, maxPaths, filters }
    ).toPromise()!;
  }

  // Analytics methods
  async getCentralityMetrics(filters?: PathfindingFilters): Promise<CentralityMetrics | undefined> {
    let params = new HttpParams();
    
    if (filters?.country) {
      filters.country.forEach(c => params = params.append('country', c));
    }
    if (filters?.city) {
      filters.city.forEach(c => params = params.append('city', c));
    }
    if (filters?.platform) {
      filters.platform.forEach(p => params = params.append('platform', p));
    }
    if (filters?.network) {
      filters.network.forEach(n => params = params.append('network', n));
    }

    return this.http.get<CentralityMetrics>(
      `${this.baseUrl}/analytics/centrality`,
      { params }
    ).toPromise()!;
  }

  async getNetworkHealth(filters?: PathfindingFilters): Promise<NetworkHealth | undefined> {
    let params = new HttpParams();
    
    if (filters?.country) {
      filters.country.forEach(c => params = params.append('country', c));
    }
    if (filters?.city) {
      filters.city.forEach(c => params = params.append('city', c));
    }

    return this.http.get<NetworkHealth>(
      `${this.baseUrl}/analytics/health`,
      { params }
    ).toPromise()!;
  }

  // Utility methods
  async getFilterValues(): Promise<any> {
    return this.http.get(`${this.baseUrl}/filters/values`).toPromise();
  }

  async getAvailableAlgorithms(): Promise<any> {
    return this.http.get(`${this.baseUrl}/algorithms`).toPromise();
  }

  async getSiteById(siteId: string): Promise<NetworkNode | undefined> {
    // This would typically call a separate sites API
    return this.http.get<NetworkNode>(`/api/sites/${siteId}`).toPromise()!;
  }

  async clearCache(): Promise<any> {
    return this.http.delete(`${this.baseUrl}/cache/clear`).toPromise();
  }

  async getCacheStats(): Promise<any> {
    return this.http.get(`${this.baseUrl}/cache/stats`).toPromise();
  }

  // State management
  updatePathResults(paths: any[]) {
    this.pathResultsSubject.next(paths);
  }

  clearPathResults() {
    this.pathResultsSubject.next([]);
  }
}