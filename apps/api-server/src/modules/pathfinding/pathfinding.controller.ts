// import { 
//   Controller, 
//   Post, 
//   Get, 
//   Body, 
//   Query, 
//   Param,
//   HttpException,
//   HttpStatus,
//   UseInterceptors,
//   Delete
// } from '@nestjs/common';
// import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';

// import { 
//   ApiTags, 
//   ApiOperation, 
//   ApiResponse, 
//   ApiBody, 
//   ApiQuery 
// } from '@nestjs/swagger';
// import { PathfindingService } from './pathfinding.service';
// import { AnalyticsService } from './analytics.service';
// import { AdvancedFeaturesService } from './advanced-features.service';
// import { CacheService } from './cache.service';
// import {
//   PathfindingRequest,
//   PathfindingResponse,
//   BatchPathfindingRequest,
//   PathfindingFilters,
//   QoSRoutingOptions,
//   LoadBalancingOptions,
//   TrafficEngineeringOptions
// } from './pathfinding-interfaces';

// @ApiTags('pathfinding')
// @Controller('api/pathfinding')
// export class PathfindingController {
//   constructor(
//     private readonly pathfindingService: PathfindingService,
//     private readonly analyticsService: AnalyticsService,
//     private readonly advancedFeaturesService: AdvancedFeaturesService,
//     private readonly cacheService: CacheService
//   ) {}

//   // ===== CORE PATHFINDING ENDPOINTS =====

//   @Post('path')
//   @ApiOperation({ summary: 'Find shortest path between two sites' })
//   @ApiResponse({ status: 200, description: 'Path found successfully' })
//   @ApiResponse({ status: 404, description: 'No path found' })
//   async findPath(@Body() request: PathfindingRequest): Promise<PathfindingResponse> {
//     try {
//       const startTime = Date.now();
      
//       // Generate cache key
//       const cacheKey = this.cacheService.generateCacheKey({
//         source: request.source,
//         destination: request.destination,
//         algorithm: request.algorithm,
//         filtersHash: this.cacheService.generateHash(request.filters || {}),
//         optionsHash: this.cacheService.generateHash(request.options || {})
//       });

//       // Check cache first
//       let paths = this.cacheService.getPath(cacheKey);
//       let cacheHit = !!paths;

//       if (!paths) {
//         paths = await this.pathfindingService.findPath(request);
//         this.cacheService.setPath(cacheKey, paths);
//       }

//       const processingTime = Date.now() - startTime;

//       return {
//         success: paths.length > 0,
//         paths,
//         metadata: {
//           requestId: this.generateRequestId(),
//           timestamp: new Date().toISOString(),
//           processingTime,
//           cacheHit
//         },
//         error: paths.length === 0 ? 'No path found between specified sites' : undefined
//       };
//     } catch (error) {
//       throw new HttpException(
//         `Path finding failed: ${error.message}`,
//         HttpStatus.INTERNAL_SERVER_ERROR
//       );
//     }
//   }

//   @Post('paths/batch')
//   @ApiOperation({ summary: 'Find multiple paths in batch' })
//   async findBatchPaths(@Body() batchRequest: BatchPathfindingRequest): Promise<PathfindingResponse[]> {
//     try {
//       const results: PathfindingResponse[] = [];
      
//       if (batchRequest.options?.parallel) {
//         // Process requests in parallel
//         const promises = batchRequest.requests.map(async (request) => {
//           try {
//             const response = await this.findPath(request);
//             return response;
//           } catch (error) {
//             return {
//               success: false,
//               paths: [],
//               metadata: {
//                 requestId: this.generateRequestId(),
//                 timestamp: new Date().toISOString(),
//                 processingTime: 0,
//                 cacheHit: false
//               },
//               error: error.message
//             };
//           }
//         });

//         const parallelResults = await Promise.all(promises);
//         results.push(...parallelResults);
//       } else {
//         // Process requests sequentially
//         for (const request of batchRequest.requests) {
//           try {
//             const response = await this.findPath(request);
//             results.push(response);
//           } catch (error) {
//             results.push({
//               success: false,
//               paths: [],
//               metadata: {
//                 requestId: this.generateRequestId(),
//                 timestamp: new Date().toISOString(),
//                 processingTime: 0,
//                 cacheHit: false
//               },
//               error: error.message
//             });
//           }
//         }
//       }

//       return results;
//     } catch (error) {
//       throw new HttpException(
//         `Batch path finding failed: ${error.message}`,
//         HttpStatus.INTERNAL_SERVER_ERROR
//       );
//     }
//   }

//   @Post('shortest-path')
//   @ApiOperation({ summary: 'Find shortest path using Dijkstra algorithm' })
//   async shortestPath(
//     @Body() body: { source: string; destination: string; filters?: PathfindingFilters }
//   ) {
//     const request: PathfindingRequest = {
//       source: body.source,
//       destination: body.destination,
//       algorithm: 'dijkstra',
//       filters: body.filters
//     };
    
//     return this.findPath(request);
//   }

//   @Post('astar-path')
//   @ApiOperation({ summary: 'Find shortest path using A* algorithm' })
//   async astarPath(
//     @Body() body: { 
//       source: string; 
//       destination: string; 
//       filters?: PathfindingFilters;
//       heuristic?: 'euclidean' | 'manhattan' | 'great-circle';
//     }
//   ) {
//     const request: PathfindingRequest = {
//       source: body.source,
//       destination: body.destination,
//       algorithm: 'astar',
//       options: {
//         heuristic: this.getHeuristicFunction(body.heuristic || 'euclidean')
//       },
//       filters: body.filters
//     };
    
//     return this.findPath(request);
//   }

//   @Post('k-shortest-paths')
//   @ApiOperation({ summary: 'Find K shortest alternative paths' })
//   async kShortestPaths(
//     @Body() body: { 
//       source: string; 
//       destination: string; 
//       k: number;
//       allowLoops?: boolean;
//       diversityFactor?: number;
//       filters?: PathfindingFilters;
//     }
//   ) {
//     const request: PathfindingRequest = {
//       source: body.source,
//       destination: body.destination,
//       algorithm: 'k-shortest',
//       options: {
//         k: body.k,
//         allowLoops: body.allowLoops,
//         diversityFactor: body.diversityFactor
//       },
//       filters: body.filters
//     };
    
//     return this.findPath(request);
//   }

//   @Post('disjoint-paths')
//   @ApiOperation({ summary: 'Find disjoint backup paths' })
//   async disjointPaths(
//     @Body() body: { 
//       source: string; 
//       destination: string; 
//       pathType: 'node-disjoint' | 'edge-disjoint' | 'link-disjoint';
//       maxPaths?: number;
//       filters?: PathfindingFilters;
//     }
//   ) {
//     const request: PathfindingRequest = {
//       source: body.source,
//       destination: body.destination,
//       algorithm: 'disjoint',
//       options: {
//         pathType: body.pathType,
//         maxPaths: body.maxPaths || 2
//       },
//       filters: body.filters
//     };
    
//     return this.findPath(request);
//   }

//   // ===== ADVANCED ROUTING FEATURES =====

//   @Post('qos-routing')
//   @ApiOperation({ summary: 'QoS-aware path routing' })
//   async qosRouting(
//     @Body() body: {
//       source: string;
//       destination: string;
//       qosOptions: QoSRoutingOptions;
//       filters?: PathfindingFilters;
//     }
//   ) {
//     try {
//       const paths = await this.advancedFeaturesService.qosAwareRouting(
//         body.source,
//         body.destination,
//         body.qosOptions,
//         body.filters
//       );

//       return {
//         success: paths.length > 0,
//         paths,
//         metadata: {
//           requestId: this.generateRequestId(),
//           timestamp: new Date().toISOString(),
//           processingTime: 0,
//           cacheHit: false
//         }
//       };
//     } catch (error) {
//       throw new HttpException(
//         `QoS routing failed: ${error.message}`,
//         HttpStatus.INTERNAL_SERVER_ERROR
//       );
//     }
//   }

//   @Post('load-balanced-routing')
//   @ApiOperation({ summary: 'Load-balanced multi-path routing' })
//   async loadBalancedRouting(
//     @Body() body: {
//       source: string;
//       destination: string;
//       loadBalanceOptions: LoadBalancingOptions;
//       filters?: PathfindingFilters;
//     }
//   ) {
//     try {
//       const paths = await this.advancedFeaturesService.loadBalancedRouting(
//         body.source,
//         body.destination,
//         body.loadBalanceOptions,
//         body.filters
//       );

//       return {
//         success: paths.length > 0,
//         paths,
//         metadata: {
//           requestId: this.generateRequestId(),
//           timestamp: new Date().toISOString(),
//           processingTime: 0,
//           cacheHit: false
//         }
//       };
//     } catch (error) {
//       throw new HttpException(
//         `Load balanced routing failed: ${error.message}`,
//         HttpStatus.INTERNAL_SERVER_ERROR
//       );
//     }
//   }

//   @Post('traffic-engineering')
//   @ApiOperation({ summary: 'Traffic engineering optimization' })
//   async trafficEngineering(
//     @Body() body: {
//       demands: Array<{ source: string; destination: string; demand: number }>;
//       teOptions: TrafficEngineeringOptions;
//       filters?: PathfindingFilters;
//     }
//   ) {
//     try {
//       const result = await this.advancedFeaturesService.trafficEngineering(
//         body.demands,
//         body.teOptions,
//         body.filters
//       );

//       return {
//         success: true,
//         paths: result.paths,
//         optimization: result.optimization,
//         metadata: {
//           requestId: this.generateRequestId(),
//           timestamp: new Date().toISOString(),
//           processingTime: 0,
//           cacheHit: false
//         }
//       };
//     } catch (error) {
//       throw new HttpException(
//         `Traffic engineering failed: ${error.message}`,
//         HttpStatus.INTERNAL_SERVER_ERROR
//       );
//     }
//   }

//   @Post('fault-tolerant-routing')
//   @ApiOperation({ summary: 'Fault-tolerant routing with backup paths' })
//   async faultTolerantRouting(
//     @Body() body: {
//       source: string;
//       destination: string;
//       faultScenarios: string[][];
//       filters?: PathfindingFilters;
//     }
//   ) {
//     try {
//       const paths = await this.advancedFeaturesService.faultTolerantRouting(
//         body.source,
//         body.destination,
//         body.faultScenarios,
//         body.filters
//       );

//       return {
//         success: paths.length > 0,
//         paths,
//         metadata: {
//           requestId: this.generateRequestId(),
//           timestamp: new Date().toISOString(),
//           processingTime: 0,
//           cacheHit: false
//         }
//       };
//     } catch (error) {
//       throw new HttpException(
//         `Fault tolerant routing failed: ${error.message}`,
//         HttpStatus.INTERNAL_SERVER_ERROR
//       );
//     }
//   }

//   // ===== NETWORK ANALYSIS ENDPOINTS =====

//   @Get('analytics/centrality')
//   @ApiOperation({ summary: 'Calculate network centrality metrics' })
//   @UseInterceptors(CacheInterceptor)
//   @CacheTTL(300) // 5 minutes
//   async getCentralityMetrics(
//     @Query('country') country?: string[],
//     @Query('city') city?: string[],
//     @Query('platform') platform?: string[],
//     @Query('network') network?: string[]
//   ) {
//     try {
//       const filters: PathfindingFilters = {
//         country: country ? (Array.isArray(country) ? country : [country]) : undefined,
//         city: city ? (Array.isArray(city) ? city : [city]) : undefined,
//         platform: platform ? (Array.isArray(platform) ? platform : [platform]) : undefined,
//         network: network ? (Array.isArray(network) ? network : [network]) : undefined
//       };

//       return await this.analyticsService.analyzeCentrality(filters);
//     } catch (error) {
//       throw new HttpException(
//         `Centrality analysis failed: ${error.message}`,
//         HttpStatus.INTERNAL_SERVER_ERROR
//       );
//     }
//   }

//   @Get('analytics/connectivity')
//   @ApiOperation({ summary: 'Analyze network connectivity' })
//   @UseInterceptors(CacheInterceptor)
//   @CacheTTL(300)
//   async getConnectivityAnalysis(
//     @Query('country') country?: string[],
//     @Query('city') city?: string[],
//     @Query('platform') platform?: string[],
//     @Query('network') network?: string[]
//   ) {
//     try {
//       const filters: PathfindingFilters = {
//         country: country ? (Array.isArray(country) ? country : [country]) : undefined,
//         city: city ? (Array.isArray(city) ? city : [city]) : undefined,
//         platform: platform ? (Array.isArray(platform) ? platform : [platform]) : undefined,
//         network: network ? (Array.isArray(network) ? network : [network]) : undefined
//       };

//       return await this.analyticsService.analyzeConnectivity(filters);
//     } catch (error) {
//       throw new HttpException(
//         `Connectivity analysis failed: ${error.message}`,
//         HttpStatus.INTERNAL_SERVER_ERROR
//       );
//     }
//   }

//   @Get('analytics/resilience')
//   @ApiOperation({ summary: 'Assess network resilience' })
//   @UseInterceptors(CacheInterceptor)
//   @CacheTTL(600) // 10 minutes
//   async getResilienceAssessment(
//     @Query('country') country?: string[],
//     @Query('city') city?: string[],
//     @Query('platform') platform?: string[],
//     @Query('network') network?: string[]
//   ) {
//     try {
//       const filters: PathfindingFilters = {
//         country: country ? (Array.isArray(country) ? country : [country]) : undefined,
//         city: city ? (Array.isArray(city) ? city : [city]) : undefined,
//         platform: platform ? (Array.isArray(platform) ? platform : [platform]) : undefined,
//         network: network ? (Array.isArray(network) ? network : [network]) : undefined
//       };

//       return await this.analyticsService.assessResilience(filters);
//     } catch (error) {
//       throw new HttpException(
//         `Resilience assessment failed: ${error.message}`,
//         HttpStatus.INTERNAL_SERVER_ERROR
//       );
//     }
//   }

//   @Get('analytics/health')
//   @ApiOperation({ summary: 'Get network health metrics' })
//   @UseInterceptors(CacheInterceptor)
//   @CacheTTL(120) // 2 minutes
//   async getNetworkHealth(
//     @Query('country') country?: string[],
//     @Query('city') city?: string[],
//     @Query('platform') platform?: string[],
//     @Query('network') network?: string[]
//   ) {
//     try {
//       const filters: PathfindingFilters = {
//         country: country ? (Array.isArray(country) ? country : [country]) : undefined,
//         city: city ? (Array.isArray(city) ? city : [city]) : undefined,
//         platform: platform ? (Array.isArray(platform) ? platform : [platform]) : undefined,
//         network: network ? (Array.isArray(network) ? network : [network]) : undefined
//       };

//       return await this.analyticsService.getNetworkHealth(filters);
//     } catch (error) {
//       throw new HttpException(
//         `Network health check failed: ${error.message}`,
//         HttpStatus.INTERNAL_SERVER_ERROR
//       );
//     }
//   }

//   @Post('analytics/failure-simulation')
//   @ApiOperation({ summary: 'Simulate network failures' })
//   async simulateFailures(
//     @Body() body: {
//       failedElements: string[];
//       failureType: 'node' | 'link' | 'area';
//       filters?: PathfindingFilters;
//     }
//   ) {
//     try {
//       return await this.analyticsService.simulateFailures(
//         body.failedElements,
//         body.failureType,
//         body.filters
//       );
//     } catch (error) {
//       throw new HttpException(
//         `Failure simulation failed: ${error.message}`,
//         HttpStatus.INTERNAL_SERVER_ERROR
//       );
//     }
//   }

//   // ===== UTILITY ENDPOINTS =====

//   @Get('filters/values')
//   @ApiOperation({ summary: 'Get available filter values' })
//   @UseInterceptors(CacheInterceptor)
//   @CacheTTL(1800) // 30 minutes
//   async getFilterValues() {
//     try {
//       // This would query your database for unique values
//       return {
//         countries: ['USA', 'Canada', 'Mexico', 'UK', 'Germany', 'France', 'Japan'],
//         cities: ['New York', 'London', 'Tokyo', 'Berlin', 'Paris', 'Toronto', 'Los Angeles'],
//         platforms: ['Fiber', 'Wireless', 'Satellite', 'Microwave'],
//         networks: ['Core', 'Metro', 'Access', 'Backbone', 'Regional'],
//         linkTypes: ['Fiber', 'Microwave', 'Satellite', 'Copper']
//       };
//     } catch (error) {
//       throw new HttpException(
//         `Failed to get filter values: ${error.message}`,
//         HttpStatus.INTERNAL_SERVER_ERROR
//       );
//     }
//   }

//   @Get('algorithms')
//   @ApiOperation({ summary: 'Get available pathfinding algorithms' })
//   async getAvailableAlgorithms() {
//     return {
//       algorithms: [
//         {
//           name: 'dijkstra',
//           description: 'Dijkstra shortest path algorithm',
//           complexity: 'O(E log V)',
//           useCase: 'Single shortest path',
//           optimal: true
//         },
//         {
//           name: 'astar',
//           description: 'A* heuristic search algorithm',
//           complexity: 'O(E log V)',
//           useCase: 'Heuristic shortest path',
//           optimal: true
//         },
//         {
//           name: 'k-shortest',
//           description: 'K shortest paths algorithm',
//           complexity: 'O(K * E log V)',
//           useCase: 'Multiple alternative paths',
//           optimal: true
//         },
//         {
//           name: 'disjoint',
//           description: 'Disjoint paths algorithm',
//           complexity: 'O(V * E)',
//           useCase: 'Redundant backup paths',
//           optimal: true
//         }
//       ],
//       features: [
//         'QoS-aware routing',
//         'Load balancing',
//         'Traffic engineering',
//         'Fault tolerance',
//         'Network analysis'
//       ]
//     };
//   }

//   @Delete('cache/clear')
//   @ApiOperation({ summary: 'Clear pathfinding cache' })
//   async clearCache() {
//     try {
//       this.cacheService.clearAll();
//       return { success: true, message: 'Cache cleared successfully' };
//     } catch (error) {
//       throw new HttpException(
//         `Failed to clear cache: ${error.message}`,
//         HttpStatus.INTERNAL_SERVER_ERROR
//       );
//     }
//   }

//   @Get('cache/stats')
//   @ApiOperation({ summary: 'Get cache statistics' })
//   async getCacheStats() {
//     try {
//       return this.cacheService.getStats();
//     } catch (error) {
//       throw new HttpException(
//         `Failed to get cache stats: ${error.message}`,
//         HttpStatus.INTERNAL_SERVER_ERROR
//       );
//     }
//   }

//   // ===== HELPER METHODS =====

//   private generateRequestId(): string {
//     return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
//   }

//   private getHeuristicFunction(type: string) {
//     switch (type) {
//       case 'euclidean':
//         return (from: any, to: any) => {
//           const [x1, y1] = from.coordinates || [0, 0];
//           const [x2, y2] = to.coordinates || [0, 0];
//           return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
//         };
//       case 'manhattan':
//         return (from: any, to: any) => {
//           const [x1, y1] = from.coordinates || [0, 0];
//           const [x2, y2] = to.coordinates || [0, 0];
//           return Math.abs(x2 - x1) + Math.abs(y2 - y1);
//         };
//       case 'great-circle':
//         return (from: any, to: any) => {
//           const [lng1, lat1] = from.coordinates || [0, 0];
//           const [lng2, lat2] = to.coordinates || [0, 0];
          
//           const R = 6371; // Earth's radius in km
//           const dLat = (lat2 - lat1) * Math.PI / 180;
//           const dLng = (lng2 - lng1) * Math.PI / 180;
          
//           const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
//                    Math.sin(dLng / 2) * Math.sin(dLng / 2);
          
//           const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          
//           return R * c;
//         };
//       default:
//         return (from: any, to: any) => 0; // No heuristic
//     }
//   }
// }


import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Query, 
  Param,
  HttpException,
  HttpStatus,
  UseInterceptors,
  Delete
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBody, 
  ApiQuery,
  ApiParam,
  ApiProperty
} from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsNumber, IsEnum, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { BatchPathfindingRequest, PathfindingFilters, PathfindingRequest, PathfindingResponse } from './pathfinding-interfaces';
import { PathfindingService } from './pathfinding.service';
import { AnalyticsService } from './analytics.service';
import { AdvancedFeaturesService } from './advanced-features.service';
import { CacheService } from './cache.service';

// DTO Classes for Swagger
export class PathfindingFiltersDto {
  @ApiProperty({ required: false, type: [String], description: 'Filter by countries' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  country?: string[];

  @ApiProperty({ required: false, type: [String], description: 'Filter by cities' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  city?: string[];

  @ApiProperty({ required: false, type: [String], description: 'Filter by platforms' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platform?: string[];

  @ApiProperty({ required: false, type: [String], description: 'Filter by networks' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  network?: string[];
}

export class PathfindingRequestDto {
  @ApiProperty({ description: 'Source site ID', example: 'NYC' })
  @IsString()
  source: string;

  @ApiProperty({ description: 'Destination site ID', example: 'LAX' })
  @IsString()
  destination: string;

  @ApiProperty({ 
    enum: ['dijkstra', 'astar', 'k-shortest', 'disjoint'], 
    description: 'Pathfinding algorithm to use',
    example: 'dijkstra'
  })
  @IsEnum(['dijkstra', 'astar', 'k-shortest', 'disjoint'])
  algorithm: 'dijkstra' | 'astar' | 'k-shortest' | 'disjoint';

  @ApiProperty({ required: false, description: 'Algorithm-specific options' })
  @IsOptional()
  options?: any;

  @ApiProperty({ required: false, type: PathfindingFiltersDto })
  @IsOptional()
  @Type(() => PathfindingFiltersDto)
  filters?: PathfindingFiltersDto;
}

export class ShortestPathDto {
  @ApiProperty({ description: 'Source site ID', example: 'NYC' })
  @IsString()
  source: string;

  @ApiProperty({ description: 'Destination site ID', example: 'LAX' })
  @IsString()
  destination: string;

  @ApiProperty({ required: false, type: PathfindingFiltersDto })
  @IsOptional()
  @Type(() => PathfindingFiltersDto)
  filters?: PathfindingFiltersDto;
}

export class AstarPathDto {
  @ApiProperty({ description: 'Source site ID', example: 'NYC' })
  @IsString()
  source: string;

  @ApiProperty({ description: 'Destination site ID', example: 'LAX' })
  @IsString()
  destination: string;

  @ApiProperty({ 
    enum: ['euclidean', 'manhattan', 'great-circle'], 
    required: false,
    description: 'Heuristic function type',
    example: 'euclidean'
  })
  @IsOptional()
  @IsEnum(['euclidean', 'manhattan', 'great-circle'])
  heuristic?: 'euclidean' | 'manhattan' | 'great-circle';

  @ApiProperty({ required: false, type: PathfindingFiltersDto })
  @IsOptional()
  @Type(() => PathfindingFiltersDto)
  filters?: PathfindingFiltersDto;
}

export class KShortestPathsDto {
  @ApiProperty({ description: 'Source site ID', example: 'NYC' })
  @IsString()
  source: string;

  @ApiProperty({ description: 'Destination site ID', example: 'LAX' })
  @IsString()
  destination: string;

  @ApiProperty({ description: 'Number of paths to find', example: 3, minimum: 1, maximum: 10 })
  @IsNumber()
  @Type(() => Number)
  k: number;

  @ApiProperty({ required: false, description: 'Allow loops in paths', example: false })
  @IsOptional()
  @IsBoolean()
  allowLoops?: boolean;

  @ApiProperty({ required: false, description: 'Diversity factor (0-1)', example: 0.7 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  diversityFactor?: number;

  @ApiProperty({ required: false, type: PathfindingFiltersDto })
  @IsOptional()
  @Type(() => PathfindingFiltersDto)
  filters?: PathfindingFiltersDto;
}

export class DisjointPathsDto {
  @ApiProperty({ description: 'Source site ID', example: 'NYC' })
  @IsString()
  source: string;

  @ApiProperty({ description: 'Destination site ID', example: 'LAX' })
  @IsString()
  destination: string;

  @ApiProperty({ 
    enum: ['node-disjoint', 'edge-disjoint', 'link-disjoint'],
    description: 'Type of disjoint paths',
    example: 'node-disjoint'
  })
  @IsEnum(['node-disjoint', 'edge-disjoint', 'link-disjoint'])
  pathType: 'node-disjoint' | 'edge-disjoint' | 'link-disjoint';

  @ApiProperty({ required: false, description: 'Maximum number of paths', example: 2 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxPaths?: number;

  @ApiProperty({ required: false, type: PathfindingFiltersDto })
  @IsOptional()
  @Type(() => PathfindingFiltersDto)
  filters?: PathfindingFiltersDto;
}

export class FailureSimulationDto {
  @ApiProperty({ description: 'Elements that have failed', example: ['NYC', 'CHI'] })
  @IsArray()
  @IsString({ each: true })
  failedElements: string[];

  @ApiProperty({ 
    enum: ['node', 'link', 'area'],
    description: 'Type of failure',
    example: 'node'
  })
  @IsEnum(['node', 'link', 'area'])
  failureType: 'node' | 'link' | 'area';

  @ApiProperty({ required: false, type: PathfindingFiltersDto })
  @IsOptional()
  @Type(() => PathfindingFiltersDto)
  filters?: PathfindingFiltersDto;
}

@ApiTags('pathfinding')
@Controller('api/pathfinding')
export class PathfindingController {
  constructor(
    private readonly pathfindingService: PathfindingService,
    private readonly analyticsService: AnalyticsService,
    private readonly advancedFeaturesService: AdvancedFeaturesService,
    private readonly cacheService: CacheService
  ) {}

  //   // ===== CORE PATHFINDING ENDPOINTS =====

  @Post('path')
  @ApiOperation({ summary: 'Find shortest path between two sites' })
  @ApiResponse({ status: 200, description: 'Path found successfully' })
  @ApiResponse({ status: 404, description: 'No path found' })
  async findPath(@Body() request: PathfindingRequest): Promise<PathfindingResponse> {
    try {
      const startTime = Date.now();
      
      // Generate cache key
      const cacheKey = this.cacheService.generateCacheKey({
        source: request.source,
        destination: request.destination,
        algorithm: request.algorithm,
        filtersHash: this.cacheService.generateHash(request.filters || {}),
        optionsHash: this.cacheService.generateHash(request.options || {})
      });

      // Check cache first
      let paths = this.cacheService.getPath(cacheKey);
      let cacheHit = !!paths;

      if (!paths) {
        paths = await this.pathfindingService.findPath(request);
        this.cacheService.setPath(cacheKey, paths);
      }

      const processingTime = Date.now() - startTime;

      return {
        success: paths.length > 0,
        paths,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date().toISOString(),
          processingTime,
          cacheHit
        },
        error: paths.length === 0 ? 'No path found between specified sites' : undefined
      };
    } catch (error) {
      throw new HttpException(
        `Path finding failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('paths/batch')
  @ApiOperation({ summary: 'Find multiple paths in batch' })
  async findBatchPaths(@Body() batchRequest: BatchPathfindingRequest): Promise<PathfindingResponse[]> {
    try {
      const results: PathfindingResponse[] = [];
      
      if (batchRequest.options?.parallel) {
        // Process requests in parallel
        const promises = batchRequest.requests.map(async (request) => {
          try {
            const response = await this.findPath(request);
            return response;
          } catch (error) {
            return {
              success: false,
              paths: [],
              metadata: {
                requestId: this.generateRequestId(),
                timestamp: new Date().toISOString(),
                processingTime: 0,
                cacheHit: false
              },
              error: error.message
            };
          }
        });

        const parallelResults = await Promise.all(promises);
        results.push(...parallelResults);
      } else {
        // Process requests sequentially
        for (const request of batchRequest.requests) {
          try {
            const response = await this.findPath(request);
            results.push(response);
          } catch (error) {
            results.push({
              success: false,
              paths: [],
              metadata: {
                requestId: this.generateRequestId(),
                timestamp: new Date().toISOString(),
                processingTime: 0,
                cacheHit: false
              },
              error: error.message
            });
          }
        }
      }

      return results;
    } catch (error) {
      throw new HttpException(
        `Batch path finding failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('path')
  @ApiOperation({ summary: 'Find shortest path between two sites' })
  @ApiBody({ type: PathfindingRequestDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Path found successfully',
    example: {
      success: true,
      paths: [{
        path: ['NYC', 'CHI', 'LAX'],
        distance: 2500.5,
        cost: 45.2,
        metadata: {
          algorithm: 'dijkstra',
          executionTime: 25,
          hopCount: 2
        }
      }]
    }
  })
  
  

  @Post('shortest-path')
  @ApiOperation({ summary: 'Find shortest path using Dijkstra algorithm' })
  @ApiBody({ 
    type: ShortestPathDto,
    examples: {
      example1: {
        summary: 'Simple shortest path',
        value: {
          source: 'NYC',
          destination: 'LAX'
        }
      },
      example2: {
        summary: 'With filters',
        value: {
          source: 'NYC',
          destination: 'LAX',
          filters: {
            platform: ['Fiber'],
            country: ['USA']
          }
        }
      }
    }
  })
  async shortestPath(@Body() body: ShortestPathDto) {
    const request: PathfindingRequest = {
      source: body.source,
      destination: body.destination,
      algorithm: 'dijkstra',
      filters: body.filters
    };
    return this.findPath(request);
  }

  @Post('astar-path')
  @ApiOperation({ summary: 'Find shortest path using A* algorithm' })
  @ApiBody({ 
    type: AstarPathDto,
    examples: {
      example1: {
        summary: 'A* with euclidean heuristic',
        value: {
          source: 'NYC',
          destination: 'LAX',
          heuristic: 'euclidean'
        }
      },
      example2: {
        summary: 'A* with geographic heuristic',
        value: {
          source: 'NYC',
          destination: 'LAX',
          heuristic: 'great-circle',
          filters: {
            platform: ['Fiber', 'Microwave']
          }
        }
      }
    }
  })
  async astarPath(@Body() body: AstarPathDto) {
    const request: PathfindingRequest = {
      source: body.source,
      destination: body.destination,
      algorithm: 'astar',
      options: {
        heuristic: this.getHeuristicFunction(body.heuristic || 'euclidean')
      },
      filters: body.filters
    };
    return this.findPath(request);
  }

  @Post('k-shortest-paths')
  @ApiOperation({ summary: 'Find K shortest alternative paths' })
  @ApiBody({ 
    type: KShortestPathsDto,
    examples: {
      example1: {
        summary: 'Find 3 alternative paths',
        value: {
          source: 'NYC',
          destination: 'LAX',
          k: 3,
          allowLoops: false,
          diversityFactor: 0.7
        }
      }
    }
  })
  async kShortestPaths(@Body() body: KShortestPathsDto) {
    const request: PathfindingRequest = {
      source: body.source,
      destination: body.destination,
      algorithm: 'k-shortest',
      options: {
        k: body.k,
        allowLoops: body.allowLoops,
        diversityFactor: body.diversityFactor
      },
      filters: body.filters
    };
    return this.findPath(request);
  }

  @Post('disjoint-paths')
  @ApiOperation({ summary: 'Find disjoint backup paths' })
  @ApiBody({ 
    type: DisjointPathsDto,
    examples: {
      example1: {
        summary: 'Node-disjoint paths',
        value: {
          source: 'NYC',
          destination: 'LAX',
          pathType: 'node-disjoint',
          maxPaths: 2
        }
      },
      example2: {
        summary: 'Edge-disjoint paths',
        value: {
          source: 'NYC',
          destination: 'LAX',
          pathType: 'edge-disjoint',
          maxPaths: 3
        }
      }
    }
  })
  async disjointPaths(@Body() body: DisjointPathsDto) {
    const request: PathfindingRequest = {
      source: body.source,
      destination: body.destination,
      algorithm: 'disjoint',
      options: {
        pathType: body.pathType,
        maxPaths: body.maxPaths || 2
      },
      filters: body.filters
    };
    return this.findPath(request);
  }

  // ===== NETWORK ANALYSIS ENDPOINTS =====

  @Get('analytics/centrality')
  @ApiOperation({ summary: 'Calculate network centrality metrics' })
  @ApiQuery({ name: 'country', required: false, type: [String], description: 'Filter by countries' })
  @ApiQuery({ name: 'city', required: false, type: [String], description: 'Filter by cities' })
  @ApiQuery({ name: 'platform', required: false, type: [String], description: 'Filter by platforms' })
  @ApiQuery({ name: 'network', required: false, type: [String], description: 'Filter by network types' })
  @ApiResponse({
    status: 200,
    description: 'Centrality metrics calculated successfully',
    example: {
      degreeCentrality: { 'NYC': 0.8, 'LAX': 0.6 },
      betweennessCentrality: { 'NYC': 0.7, 'LAX': 0.4 },
      closenessCentrality: { 'NYC': 0.9, 'LAX': 0.5 }
    }
  })
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  async getCentralityMetrics(
    @Query('country') country?: string[],
    @Query('city') city?: string[],
    @Query('platform') platform?: string[],
    @Query('network') network?: string[]
  ) {
    try {
      const filters: PathfindingFilters = {
        country: country ? (Array.isArray(country) ? country : [country]) : undefined,
        city: city ? (Array.isArray(city) ? city : [city]) : undefined,
        platform: platform ? (Array.isArray(platform) ? platform : [platform]) : undefined,
        network: network ? (Array.isArray(network) ? network : [network]) : undefined
      };
      return await this.analyticsService.analyzeCentrality(filters);
    } catch (error) {
      throw new HttpException(
        `Centrality analysis failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('analytics/health')
  @ApiOperation({ summary: 'Get network health metrics' })
  @ApiQuery({ name: 'country', required: false, type: [String], description: 'Filter by countries' })
  @ApiQuery({ name: 'city', required: false, type: [String], description: 'Filter by cities' })
  @ApiQuery({ name: 'platform', required: false, type: [String], description: 'Filter by platforms' })
  @ApiQuery({ name: 'network', required: false, type: [String], description: 'Filter by network types' })
  @ApiResponse({
    status: 200,
    description: 'Network health metrics',
    example: {
      totalNodes: 15,
      totalLinks: 23,
      averageNodeDegree: 3.2,
      networkDiameter: 5,
      connectivity: 0.85
    }
  })
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(120)
  async getNetworkHealth(
    @Query('country') country?: string[],
    @Query('city') city?: string[],
    @Query('platform') platform?: string[],
    @Query('network') network?: string[]
  ) {
    try {
      const filters: PathfindingFilters = {
        country: country ? (Array.isArray(country) ? country : [country]) : undefined,
        city: city ? (Array.isArray(city) ? city : [city]) : undefined,
        platform: platform ? (Array.isArray(platform) ? platform : [platform]) : undefined,
        network: network ? (Array.isArray(network) ? network : [network]) : undefined
      };
      return await this.analyticsService.getNetworkHealth(filters);
    } catch (error) {
      throw new HttpException(
        `Network health check failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('analytics/failure-simulation')
  @ApiOperation({ summary: 'Simulate network failures' })
  @ApiBody({ 
    type: FailureSimulationDto,
    examples: {
      nodeFailure: {
        summary: 'Simulate node failures',
        value: {
          failedElements: ['NYC', 'CHI'],
          failureType: 'node'
        }
      },
      linkFailure: {
        summary: 'Simulate link failures', 
        value: {
          failedElements: ['NYC-CHI', 'LAX-DFW'],
          failureType: 'link'
        }
      }
    }
  })
  async simulateFailures(@Body() body: FailureSimulationDto) {
    try {
      return await this.analyticsService.simulateFailures(
        body.failedElements,
        body.failureType,
        body.filters
      );
    } catch (error) {
      throw new HttpException(
        `Failure simulation failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ===== UTILITY ENDPOINTS =====

  @Get('filters/values')
  @ApiOperation({ summary: 'Get available filter values' })
  @ApiResponse({
    status: 200,
    description: 'Available filter values',
    example: {
      countries: ['USA', 'Canada', 'Mexico'],
      cities: ['New York', 'Los Angeles', 'Chicago'],
      platforms: ['Fiber', 'Wireless', 'Satellite'],
      networks: ['Core', 'Metro', 'Access']
    }
  })
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(1800)
  async getFilterValues() {
    try {
      return {
        countries: ['USA', 'Canada', 'Mexico', 'UK', 'Germany', 'France', 'Japan'],
        cities: ['New York', 'London', 'Tokyo', 'Berlin', 'Paris', 'Toronto', 'Los Angeles'],
        platforms: ['Fiber', 'Wireless', 'Satellite', 'Microwave'],
        networks: ['Core', 'Metro', 'Access', 'Backbone', 'Regional'],
        linkTypes: ['Fiber', 'Microwave', 'Satellite', 'Copper']
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get filter values: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('algorithms')
  @ApiOperation({ summary: 'Get available pathfinding algorithms' })
  @ApiResponse({
    status: 200,
    description: 'Available algorithms and features',
    example: {
      algorithms: [
        {
          name: 'dijkstra',
          description: 'Dijkstra shortest path algorithm',
          complexity: 'O(E log V)',
          optimal: true
        }
      ]
    }
  })
  async getAvailableAlgorithms() {
    return {
      algorithms: [
        {
          name: 'dijkstra',
          description: 'Dijkstra shortest path algorithm',
          complexity: 'O(E log V)',
          useCase: 'Single shortest path',
          optimal: true
        },
        {
          name: 'astar',
          description: 'A* heuristic search algorithm', 
          complexity: 'O(E log V)',
          useCase: 'Heuristic shortest path',
          optimal: true
        },
        {
          name: 'k-shortest',
          description: 'K shortest paths algorithm',
          complexity: 'O(K * E log V)',
          useCase: 'Multiple alternative paths',
          optimal: true
        },
        {
          name: 'disjoint',
          description: 'Disjoint paths algorithm',
          complexity: 'O(V * E)', 
          useCase: 'Redundant backup paths',
          optimal: true
        }
      ],
      features: [
        'QoS-aware routing',
        'Load balancing', 
        'Traffic engineering',
        'Fault tolerance',
        'Network analysis'
      ]
    };
  }

  @Delete('cache/clear')
  @ApiOperation({ summary: 'Clear pathfinding cache' })
  @ApiResponse({ status: 200, description: 'Cache cleared successfully' })
  async clearCache() {
    try {
      this.cacheService.clearAll();
      return { success: true, message: 'Cache cleared successfully' };
    } catch (error) {
      throw new HttpException(
        `Failed to clear cache: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('cache/stats')
  @ApiOperation({ summary: 'Get cache statistics' })
  @ApiResponse({
    status: 200,
    description: 'Cache statistics',
    example: {
      paths: { size: 150, max: 1000, hitRate: 0.85 },
      graphs: { size: 5, max: 50, hitRate: 0.92 }
    }
  })
  async getCacheStats() {
    try {
      return this.cacheService.getStats();
    } catch (error) {
      throw new HttpException(
        `Failed to get cache stats: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ===== HELPER METHODS =====

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getHeuristicFunction(type: string) {
    switch (type) {
      case 'euclidean':
        return (from: any, to: any) => {
          const [x1, y1] = from.coordinates || [0, 0];
          const [x2, y2] = to.coordinates || [0, 0];
          return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        };
      case 'manhattan':
        return (from: any, to: any) => {
          const [x1, y1] = from.coordinates || [0, 0];
          const [x2, y2] = to.coordinates || [0, 0];
          return Math.abs(x2 - x1) + Math.abs(y2 - y1);
        };
      case 'great-circle':
        return (from: any, to: any) => {
          const [lng1, lat1] = from.coordinates || [0, 0];
          const [lng2, lat2] = to.coordinates || [0, 0];
          
          const R = 6371; // Earth's radius in km
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLng = (lng2 - lng1) * Math.PI / 180;
          
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                   Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                   Math.sin(dLng / 2) * Math.sin(dLng / 2);
          
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          
          return R * c;
        };
      default:
        return (from: any, to: any) => 0; // No heuristic
    }
  }
}
