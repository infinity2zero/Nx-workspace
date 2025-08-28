// pathfinding.service.ts

import { Injectable } from '@nestjs/common';
import Graph from 'graphology';
import { bidirectional as dijkstra } from 'graphology-shortest-path';
import { allSimplePaths } from 'graphology-simple-path';
import { GraphService } from './graph.service';

import {
  PathfindingRequest,
  PathResult,
  DijkstraOptions,
  AStarOptions,
  KShortestPathsOptions,
  DisjointPathsOptions,
  NetworkNode,
  NetworkLink,
  RiskAssessment
} from './pathfinding-interfaces';
import { log } from 'console';

@Injectable()
export class PathfindingService {
  constructor(private readonly graphService: GraphService) {}

  async findPath(request: PathfindingRequest): Promise<PathResult[]> {
    const startTime = Date.now();
    const graph = await this.graphService.buildGraph(request.filters);
     log('Graph nodes:', graph.order, 'edges:', graph.size);
    let results: PathResult[] = [];

    switch (request.algorithm) {
      case 'dijkstra':
        // results = await this.dijkstraPath(graph, request);
        break;
      case 'astar':
        results = await this.astarPath(graph, request);
        break;
      case 'k-shortest':
        results = await this.kShortestPaths(graph, request);
        break;
      case 'disjoint':
        results = await this.disjointPaths(graph, request);
        break;
      default:
        throw new Error(`Unknown algorithm: ${request.algorithm}`);
    }

    const executionTime = Date.now() - startTime;
    results.forEach(r => (r.metadata.executionTime = executionTime));
    return results;
  }

  // private async dijkstraPath(graph: Graph, request: PathfindingRequest): Promise<PathResult[]> {
  //   const options = (request.options as DijkstraOptions) || {};
  //   try {
  //     const path = dijkstra(graph, request.source, request.destination, {
  //       getEdgeWeight: options.weightFunction ?? ((_, attr) => attr.weight ?? 1),
  //     });
  //     if (!path) return [];
  //     return [await this.buildPathResult(graph, path, 'dijkstra', request)];
  //   } catch {
  //     return [];
  //   }
  // }

  private async astarPath(graph: Graph, request: PathfindingRequest): Promise<PathResult[]> {
    const options = (request.options as AStarOptions) || {};
    const getWeightFn = options.weightFunction ?? ((_, attr) => attr.weight ?? 1);

    const startNode = await this.graphService.getNodeById(request.source);
    const goalNode = await this.graphService.getNodeById(request.destination);
    if (!startNode || !goalNode) return [];

    const path = this.astarAlgorithm(
      graph,
      request.source,
      request.destination,
      options.heuristic ?? this.euclideanHeuristic,
      getWeightFn,
      startNode,
      goalNode
    );
    if (!path) return [];
    return [await this.buildPathResult(graph, path, 'astar', request)];
  }

  private astarAlgorithm(
    graph: Graph,
    start: string,
    goal: string,
    heuristic: (a: NetworkNode, b: NetworkNode) => number,
    getWeight: (edge: string, attr: any) => number,
    startNode: NetworkNode,
    goalNode: NetworkNode
  ): string[] | null {
    const open = new Set([start]);
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>([[start, 0]]);
    const fScore = new Map<string, number>([[start, heuristic(startNode, goalNode)]]);

    while (open.size) {
      let current = [...open].reduce((a, b) =>
        (fScore.get(a) ?? Infinity) < (fScore.get(b) ?? Infinity) ? a : b
      );
      if (current === goal) return this.reconstructPath(cameFrom, current);

      open.delete(current);
      graph.forEachNeighbor(current, (nbr, attr) => {
        const tentative = (gScore.get(current) ?? Infinity) + getWeight('', attr);
        if (tentative < (gScore.get(nbr) ?? Infinity)) {
          cameFrom.set(nbr, current);
          gScore.set(nbr, tentative);
          this.graphService.getNodeById(nbr).then(nbrNode => {
            if (nbrNode) {
              fScore.set(nbr, tentative + heuristic(nbrNode, goalNode));
            }
          });
          open.add(nbr);
        }
      });
    }
    return null;
  }

  private reconstructPath(cameFrom: Map<string, string>, curr: string): string[] {
    const path = [curr];
    while (cameFrom.has(curr)) {
      curr = cameFrom.get(curr)!;
      path.unshift(curr);
    }
    return path;
  }

  private euclideanHeuristic(a: NetworkNode, b: NetworkNode): number {
    const [x1, y1] = a.geometry.coordinates;
    const [x2, y2] = b.geometry.coordinates;
    return Math.hypot(x2 - x1, y2 - y1);
  }

  private async kShortestPaths(graph: Graph, request: PathfindingRequest): Promise<PathResult[]> {
    const opts = (request.options as KShortestPathsOptions) || { k: 3 };
    const paths = this.yensAlgorithm(graph, request.source, request.destination, opts.k);
    const res: PathResult[] = [];
    for (const p of paths) {
      if (p) res.push(await this.buildPathResult(graph, p, 'k-shortest', request));
    }
    return res;
  }

  private yensAlgorithm(graph: Graph, s: string, t: string, k: number): (string[] | null)[] {
    const A: (string[] | null)[] = [];
    const B: { path: string[]; cost: number }[] = [];
    const first = dijkstra(graph, s, t);
    if (!first) return [];
    A.push(first);
    for (let i = 1; i < k; i++) {
      const prev = A[i - 1]!;
      for (let j = 0; j < prev.length - 1; j++) {
        const spur = prev[j];
        const root = prev.slice(0, j + 1);
        const removed: [string, string][] = [];
        for (const p of A) {
          if (p && p.length > j && p.slice(0, j + 1).join() === root.join()) {
            const e = graph.edge(p[j], p[j + 1]);
            if (e) {
              removed.push([p[j], p[j + 1]]);
              graph.dropEdge(e);
            }
          }
        }
        const spurPath = dijkstra(graph, spur, t);
        for (const [u, v] of removed) graph.addEdge(u, v);
        if (spurPath) {
          const full = [...root.slice(0, -1), ...spurPath];
          B.push({ path: full, cost: this.calculatePathCost(graph, full) });
        }
      }
      if (!B.length) break;
      B.sort((a, b) => a.cost - b.cost);
      A.push(B.shift()!.path);
    }
    return A;
  }

  private async disjointPaths(graph: Graph, request: PathfindingRequest): Promise<PathResult[]> {
    const opts = (request.options as DisjointPathsOptions) || { pathType: 'node-disjoint', maxPaths: 2 };
    const raw = this.findDisjoint(graph, request.source, request.destination, opts.pathType, opts.maxPaths);
    return Promise.all(raw.map(p => p ? this.buildPathResult(graph, p, 'disjoint', request) : Promise.resolve(null)))
      .then(arr => arr.filter(x => x) as PathResult[]);
  }

  private findDisjoint(
    graph: Graph,
    s: string,
    t: string,
    type: 'node-disjoint' | 'edge-disjoint' | 'link-disjoint',
    max: number
  ): string[][] {
    const R: string[][] = [];
    const usedN = new Set<string>();
    const usedE = new Set<string>();
    for (let i = 0; i < max; i++) {
      const g2 = graph.copy();
      if (type === 'node-disjoint') {
        usedN.forEach(n => n !== s && n !== t && g2.dropNode(n));
      } else {
        usedE.forEach(e => g2.dropEdge(e));
      }
      const p = dijkstra(g2, s, t);
      if (!p) break;
      R.push(p);
      if (type === 'node-disjoint') p.forEach(n => usedN.add(n));
      else for (let j = 0; j < p.length - 1; j++) {
        const e = graph.edge(p[j], p[j + 1]);
        if (e) usedE.add(e);
      }
    }
    return R;
  }

  private calculatePathCost(graph: Graph, path: string[]): number {
    return path.slice(0, -1).reduce((sum, u, i) => {
      const attr = graph.getEdgeAttributes(u, path[i + 1]);
      return sum + (attr.weight ?? 1);
    }, 0);
  }

  private async buildPathResult(
    graph: Graph,
    path: string[],
    alg: string,
    request: PathfindingRequest
  ): Promise<PathResult> {
    const nodes: NetworkNode[] = [];
    const links: NetworkLink[] = [];
    let dist = 0, cost = 0;

    for (const id of path) {
      const n = await this.graphService.getNodeById(id);
      if (n) nodes.push(n);
    }
    for (let i = 0; i < path.length - 1; i++) {
      const attr = graph.getEdgeAttributes(path[i], path[i + 1]);
      const ln = await this.graphService.getLinkById(attr.link_id);
      if (ln) {
        links.push(ln);
        dist += ln.link_distance;
        cost += attr.weight ?? ln.link_distance;
      }
    }

    const risk: RiskAssessment = {
      redundancy: 1 - (path.filter(n => graph.degree(n) <= 2).length / path.length),
      singlePointsOfFailure: path.filter(n => graph.degree(n) <= 2),
      diversityScore: Math.min(1, path.length / 10),
      resilienceRating:
        path.every(n => graph.degree(n) > 2) ? 'high' :
        path.filter(n => graph.degree(n) <= 2).length <= 2 ? 'medium' : 'low'
    };

    return {
      path,
      distance: dist,
      cost,
      nodes,
      links,
      metadata: {
        algorithm: alg,
        executionTime: 0,
        hopCount: path.length - 1,
        qosScore: this.calculateQoSScore(links, request.filters?.qosRequirements),
        riskAssessment: risk
      }
    };
  }

  private calculateQoSScore(_links: NetworkLink[], _qos: any): number {
    return 1.0;
  }
}
