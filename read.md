┌─────────────────────────────────────┐
│           Electron App              │
│  ┌─────────────────────────────────┐│
│  │        Main Process             ││
│  │  ┌─────────────────────────────┐││
│  │  │     NestJS API Server       │││  ← Backend (Port 3000)
│  │  │   + SQLite Database         │││
│  │  │   + Business Logic          │││
│  │  └─────────────────────────────┘││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │      Renderer Process          ││
│  │  ┌─────────────────────────────┐││
│  │  │       Angular App           │││  ← Frontend UI
│  │  │   (Makes HTTP calls to      │││
│  │  │    localhost:3000)          │││
│  │  └─────────────────────────────┘││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
✅ Electron app = Backend (NestJS(api-server) + SQLite)

✅ Angular app = Frontend (UI components)

✅ Communication = HTTP calls (localhost:3000)

✅ Single desktop app with embedded API


site_id	TEXT
site_virtual_name	TEXT
site_name	TEXT
country	TEXT
city	TEXT
platform	TEXT
network	TEXT
last_modified_at	TEXT
is_deleted	INTEGER
geometry	POINT
this is the site , below is links
link_id	TEXT
site_a_id	TEXT
site_b_id	TEXT
link_type	TEXT
link_distance	REAL
link_kmz_no	TEXT
last_modified_at	TEXT
is_deleted	INTEGER
geometry	LINESTRING
these tables are there in our sqlite table
now I have below dependencies installed
"graphology": "^0.26.0",
    "graphology-metrics": "^2.4.0",
    "graphology-shortest-path": "^2.1.0",
    "graphology-simple-path": "^0.2.0",
    "graphology-traversal": "^0.3.1",
    "lru-cache": "^11.1.0",
give me a nestjs controller/service module to find shortest path , with dejkestra a version with A* and k-shortest path, diverse path (disjoints ..no overlaps) 
and also inlclude params as well.. like 
country[]
city	[]
platform	[]
network	[]
if user pass any of these params API filter out that from the shortest path
suggestion abd best implementations please.. consider on performance and optimization as it's is js type and also everything is bundled inside electron app (angular + nestjs + electron + sqlite3 db with spatial)
go blastic amaze me.. provide path finding end points what's all can be there in a real world ISP application

consider below --just  ideas-- feel free to optimize
Core Routing
Shortest path (Dijkstra, A*, Bellman-Ford)

K-shortest alternative paths

Redundant/backup paths

Load-balanced routing

Advanced Features
QoS-aware routing

Fault-tolerant paths

Traffic engineering

ECMP optimization

Network Analysis
Connectivity analysis

Resilience assessment

Bottleneck identification

Centrality analysis

Operations
Failure simulation

Health monitoring

Capacity planning

Maintenance impact

Business Intelligence
SLA compliance

Geo-fencing

Performance reporting

Expansion planning

⚡ Performance Optimizations
Graph Caching: LRU cache with 5-minute TTL

Prepared Statements: Optimized SQLite queries

Spatial Indexing: Efficient coordinate-based calculations

Parallel Processing: Concurrent path computations

Memory Management: Graph copying to prevent mutations
--
with this also provide a modern UI, angular component to calculate / use all these APIs , with all the filters dropdowns and all a real world app will have, a modern design ..please (keep the filters maybe on reuasable component as we need to include it in a maplibre view as well..to show the path on map..refer below is a working maplibre component setup-- create another component for it)
my angular set up is with , angular 20 + scss + bootstrap5 + ng-bootstrap + maplibre gl + ngx-toaster + ng2-charts

a one shot solution please.. do intensive research then provide error free and full thing.

working map-
import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  Input,
  Output,
  EventEmitter
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Map,
  NavigationControl,
  ScaleControl,
  LngLatLike,
  StyleSpecification,
  VectorSourceSpecification,
} from 'maplibre-gl';
import { DbSwitchService } from '../../core/services/db-switch.service';
import { Subscription } from 'rxjs';

type Filters = {
  country?: string[];
  city?: string[];
  network?: string[];
  platform?: string[];
  linkType?: string[];
  minDistance?: number | null;
  maxDistance?: number | null;
};

@Component({
  selector: 'app-maplibre-vector-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './geomaplibre.html',
  styleUrls: ['./geomaplibre.scss'],
})
export class Geomaplibre implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true })
  mapContainer!: ElementRef<HTMLDivElement>;

  private dbSub?: Subscription;

  // View config
  @Input() center: LngLatLike = [78.9629, 20.5937]; // lng, lat
  @Input() zoom = 4;
  @Input() pitch = 0;
  @Input() bearing = 0;
  @Input() showScale = true;
  @Input() showNavigation = true;

  // Tile server base
  @Input() tilesBase = 'http://localhost:3000/api/tiles';

  // Dynamic filters
  @Input() filters: Filters = {};

  @Output() mapReady = new EventEmitter<Map>();
  @Output() mapDestroyed = new EventEmitter<void>();

  private map?: Map;



  constructor(private dbSwitchService: DbSwitchService) {
    
  }


  ngOnInit() {
  }



  /**
 * Reloads all of your vector‐tile sources when the database version changes,
 * by appending a cache‐busting query param and forcing MapLibre to refetch tiles.
 */
  private reloadPbfSources(newDbVersion: string) {
    if (!this.map!.isStyleLoaded()) {
    this.map!.once('styledata', () => this.reloadPbfSources(newDbVersion));
    return;
  }
  const ts = Date.now();
  const sources = [
    { id: 'sites', layerIds: ['sites-circle'], baseUrl: 'http://localhost:3000/api/tiles/sites/{z}/{x}/{y}.pbf' },
    { id: 'links', layerIds: ['links-line'], baseUrl: 'http://localhost:3000/api/tiles/links/{z}/{x}/{y}.pbf' }
  ];

  sources.forEach(srcDef => {
    // 1) Remove existing layers & source
    srcDef.layerIds.forEach(layerId => {
      if (this.map!.getLayer(layerId)) {
        this.map!.removeLayer(layerId);
      }
    });
    if (this.map!.getSource(srcDef.id)) {
      this.map!.removeSource(srcDef.id);
    }

    // 2) Re-add the source with cache-busting URL
    this.map!.addSource(srcDef.id, {
      type: 'vector',
      tiles: [`${srcDef.baseUrl}?v=${encodeURIComponent(newDbVersion)}&t=${ts}`],
      minzoom: 0,
      maxzoom: 14
    });

    // 3) Re-add the layer pointing to the new source
    if (srcDef.id === 'sites') {
      this.map!.addLayer({
        id: 'sites-circle',
        type: 'circle',
        source: 'sites',
        'source-layer': 'sites',
        paint: { /* same paint properties as before */ }
      });
    } else if (srcDef.id === 'links') {
      this.map!.addLayer({
        id: 'links-line',
        type: 'line',
        source: 'links',
        'source-layer': 'links',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#212d4f', 'line-width': 2 }
      });
    }
  });

  // 4) Force a repaint so new tiles load at once
  this.map!.triggerRepaint();
}



  ngAfterViewInit(): void {
    this.initMap();
    this.dbSub = this.dbSwitchService.dbVersion$.subscribe(version => {
      console.log('Database version changed:', version);
      if (version && this.map) {
        // this.reloadPbfSources(version);
        console.log('Reloaded PBF sources with new DB version.');
      }
    });

  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.mapDestroyed.emit();
    }
    this.dbSub?.unsubscribe();
  }

  // Public API to update filters at runtime
  updateFilters(next: Filters) {
    this.filters = next || {};
    this.reloadVectorSources();
  }

  // Public API to fly to a location
  flyTo(center: LngLatLike, zoom?: number) {
    this.map?.flyTo({ center, zoom: zoom ?? this.zoom, speed: 0.8 });
  }

  private initMap() {
    this.map = new Map({
      container: this.mapContainer.nativeElement,
      style: 'https://demotiles.maplibre.org/style.json',
      center: this.center,
      zoom: this.zoom,
    });

    this.map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    this.map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');



    this.map.on('load', () => {

      this.map!.addSource('osm', {
        type: 'raster',
        tiles: [
          // 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
        ],
        tileSize: 256,
        maxzoom: 19
      });
      this.map!.addLayer({ id: 'osm-layer', type: 'raster', source: 'osm' });

      this.map!.addSource('sites', {
        type: 'vector',
        tiles: ['http://localhost:3000/api/tiles/sites/{z}/{x}/{y}.pbf'],
        minzoom: 0,
        maxzoom: 14
      });

      this.map!.addLayer({
        id: 'sites-circle',
        type: 'circle',
        source: 'sites',
        'source-layer': 'sites',
        paint: {
          'circle-color': [
            'match',
            ['get', 'platform'],
            'Fiber', '#0d6efd',
            'Wireless', '#ffc107',
            'Satellite', '#dc3545',
              /* other */ '#0dcaf0',
          ],
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            2, 2,
            6, 3.5,
            10, 5,
            14, 7,
          ],
          'circle-stroke-color': '#111',
          'circle-stroke-width': 0.9,
          'circle-opacity': 0.9,
        }
      });

      this.map!.addSource('links', {
        type: 'vector',
        tiles: ['http://localhost:3000/api/tiles/links/{z}/{x}/{y}.pbf'],
        minzoom: 0,
        maxzoom: 14
      });

      this.map!.addLayer({
        id: 'links-line',
        type: 'line',
        source: 'links',
        'source-layer': 'links', // must match PBF layer key
        // filter: ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]],
        layout: {
          'line-cap': "round",
          'line-join': "round"
        },
        paint: {
          'line-color': "#212d4f",
          'line-width': 2
        }
      });


      this.addHoverInteractions();



      this.mapReady.emit(this.map!);
    });
  }

  private buildQuery(): string {
    const params = new URLSearchParams();
    const add = (k: string, v?: string[] | number | null) => {
      if (Array.isArray(v) && v.length) params.set(k, v.join(','));
      else if (typeof v === 'number') params.set(k, String(v));
    };
    add('country', this.filters.country);
    add('city', this.filters.city);
    add('network', this.filters.network);
    add('platform', this.filters.platform);
    add('linkType', this.filters.linkType);
    if (this.filters.minDistance != null) add('minDistance', this.filters.minDistance);
    if (this.filters.maxDistance != null) add('maxDistance', this.filters.maxDistance);
    const q = params.toString();
    return q ? `?${q}` : '';
  }

  private vectorSourceDef(tilesPath: string): VectorSourceSpecification {
    const urlTemplate = `${this.tilesBase}/${tilesPath}/{z}/{x}/{y}.pbf${this.buildQuery()}`;
    return {
      type: 'vector',
      tiles: [urlTemplate],
      minzoom: 0,
      maxzoom: 14,
    };
  }

  private addHoverInteractions() {
    if (!this.map) return;
    const map = this.map;

    const interactiveLayers = ['sites-circle', 'links-line'];
    interactiveLayers.forEach((id) => {
      map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''));
    });

    map.on('click', 'sites-circle', (e: any) => {
      const feature = e.features?.[0];
      if (feature) {
        console.log('Site clicked:', feature.properties);
      }
    });

    map.on('click', 'links-line', (e: any) => {
      const feature = e.features?.[0];
      if (feature) {
        console.log('Link clicked:', feature.properties);
      }
    });
  }

  private reloadVectorSources() {
    if (!this.map || !this.map.isStyleLoaded()) return;

    // This is the correct and reliable way to update source URLs.
    // It gets the current style, modifies the source URLs, and applies the new style.
    const style = this.map.getStyle();

    const newSitesTiles = [`${this.tilesBase}/sites/{z}/{x}/{y}.pbf${this.buildQuery()}`];
    const newLinksTiles = [`${this.tilesBase}/links/{z}/{x}/{y}.pbf${this.buildQuery()}`];

    if (style.sources['sites'] && 'tiles' in style.sources['sites']) {
      (style.sources['sites'] as VectorSourceSpecification).tiles = newSitesTiles;
    }
    if (style.sources['links'] && 'tiles' in style.sources['links']) {
      (style.sources['links'] as VectorSourceSpecification).tiles = newLinksTiles;
    }

    this.map.setStyle(style, { diff: true });
  }
}
--pbf service--
import { Injectable, Inject } from '@nestjs/common';
import { Database } from 'better-sqlite3';
import geojsonvt from 'geojson-vt';
import vtpbf from 'vt-pbf';
import { SQLITE_CONNECTION } from '../sqlite.module';
import { DbSettingsService } from '../dbsettings/dbsettings.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

export interface PbfFilter {
  country?: string[];
  city?: string[];
  network?: string[];
  platform?: string[];
  linkType?: string[];
  minDistance?: number;
  maxDistance?: number;
}

@Injectable()
export class PbfService {
  constructor(private readonly dbService: DbSettingsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}
  private get db() {
    return this.dbService.getCurrentDatabase();
  }

  async clearTileCache(): Promise<void> {
    try {
      // Try clear() method first (cache-manager v5+)
      await this.cacheManager.clear();
      console.log('✅ Cache cleared successfully');
    } catch (error) {
      try {
        // Fallback: delete all keys manually
        const keys = await (this.cacheManager as any).store.keys();
        if (keys && keys.length > 0) {
          await Promise.all(keys.map(key => this.cacheManager.del(key)));
          console.log(`✅ Manually cleared ${keys.length} cache keys`);
        }
      } catch (fallbackError) {
        console.error('❌ Cache clear failed:', fallbackError);
      }
    }
  }

  private tileToBbox(z: number, x: number, y: number) {
    const n = 2 ** z;
    const minLon = (x / n) * 360 - 180;
    const maxLon = ((x + 1) / n) * 360 - 180;
    const toLat = (yy: number) =>
      Math.atan(Math.sinh(Math.PI * (1 - 2 * yy / n))) * (180 / Math.PI);
    return {
      minLon,
      maxLon,
      maxLat: toLat(y),
      minLat: toLat(y + 1),
    };
  }

  private emptyTile(): Buffer {
    return Buffer.from(vtpbf.fromGeojsonVt({}));
  }

  private clauseIn(field: string, vals?: string[]) {
    return vals?.length
      ? ` AND ${field} IN (${vals.map(() => '?').join(',')})`
      : '';
  }

  private makePbf(
    z: number,
    x: number,
    y: number,
    features: any[],
    layerName: string
  ): Buffer {
    if (!features.length) return this.emptyTile();

    const geojson = { type: 'FeatureCollection', features };

    // This is the key change. By adding `promoteId: 'id'`, we tell geojson-vt
    // to look for a property named 'id' on each feature and use it as the
    // feature's top-level ID. This makes the tile compliant with spec v2.
    const index = geojsonvt((geojson as any), {
      extent: 4096,
      buffer: 64,
      promoteId: 'id', // <-- THE FIX
    });

    const tile = index.getTile(z, x, y);
    if (!tile?.features.length) return this.emptyTile();

    return Buffer.from(vtpbf.fromGeojsonVt({ [layerName]: tile }));
  }

  async getSitesPbf(
    z: number,
    x: number,
    y: number,
    f: PbfFilter
  ): Promise<Buffer> {
    const { minLon, minLat, maxLon, maxLat } = this.tileToBbox(z, x, y);

    const sql = `
      SELECT
        site_id,
        site_name,
        country,
        city,
        platform,
        network,
        AsGeoJSON(geometry) AS geom
      FROM sites
      WHERE is_deleted = 0
        AND MBRIntersects(
          geometry,
          BuildMBR(?, ?, ?, ?, 4326)
        )
        ${this.clauseIn('country', f.country)}
        ${this.clauseIn('city', f.city)}
        ${this.clauseIn('network', f.network)}
        ${this.clauseIn('platform', f.platform)}
      LIMIT 1000
    `;

    const params = [
      minLon,
      minLat,
      maxLon,
      maxLat,
      ...(f.country || []),
      ...(f.city || []),
      ...(f.network || []),
      ...(f.platform || []),
    ];

    const rows = this.db.prepare(sql).all(params);
    const features = rows.map((r: any) => ({
      type: 'Feature',
      properties: {
        id: r.site_id, // This 'id' property is used by `promoteId`
        name: r.site_name,
        country: r.country,
        city: r.city,
        platform: r.platform,
        network: r.network,
      },
      geometry: JSON.parse(r.geom),
    }));

    return this.makePbf(z, x, y, features, 'sites');
  }

  async getLinksPbf(
    z: number,
    x: number,
    y: number,
    f: PbfFilter
  ): Promise<Buffer> {
    const { minLon, minLat, maxLon, maxLat } = this.tileToBbox(z, x, y);

    const sql = `
      SELECT
        link_id,
        link_type,
        link_distance,
        AsGeoJSON(geometry) AS geom
      FROM links
      WHERE is_deleted = 0
        AND MBRIntersects(
          geometry,
          BuildMBR(?, ?, ?, ?, 4326)
        )
        ${this.clauseIn('link_type', f.linkType)}
        AND (? IS NULL OR link_distance >= ?)
        AND (? IS NULL OR link_distance <= ?)
      LIMIT 10000
    `;

    const params = [
      minLon,
      minLat,
      maxLon,
      maxLat,
      ...(f.linkType || []),
      f.minDistance,
      f.minDistance,
      f.maxDistance,
      f.maxDistance,
    ];

    // const rows = this.db.prepare(sql).all(params);
    // const features = rows.map((r: any) => ({
    //   type: 'Feature',
    //   properties: {
    //     id: r.link_id, // This 'id' property is used by `promoteId`
    //     type: r.link_type,
    //     distance: r.link_distance,
    //   },
    //   geometry: JSON.parse(r.geom),
    // }));

    const rows = this.db.prepare(sql).all(params);
const features = rows
  .map((r: any) => {
    const geom = JSON.parse(r.geom);
    return {
      type: 'Feature',
      properties: { id: r.link_id, type: r.link_type, distance: r.link_distance },
      geometry: geom
    };
  })
  .filter(f =>
    f.geometry &&
    (f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString')
  );
  return this.makePbf(z, x, y, features, 'links');

    // console.log(features.map(f => f.geometry.type).slice(0,10));

    // return this.makePbf(z, x, y, features, 'links');
  }

  async getCombinedPbf(
    z: number,
    x: number,
    y: number,
    f: PbfFilter
  ): Promise<Buffer> {
    // This function can be simplified as the individual PBF generation
    // already handles the v2 spec compliance. We just need to merge them.
    const [sitesPbf, linksPbf] = await Promise.all([
      this.getSitesPbf(z, x, y, f),
      this.getLinksPbf(z, x, y, f),
    ]);

    const sitesTile = vtpbf.toGeojson(sitesPbf).sites;
    const linksTile = vtpbf.toGeojson(linksPbf).links;
    
    const combinedLayers = {};
    if (sitesTile) combinedLayers['sites'] = sitesTile;
    if (linksTile) combinedLayers['links'] = linksTile;

    if (Object.keys(combinedLayers).length === 0) return this.emptyTile();

    return Buffer.from(vtpbf.fromGeojsonVt(combinedLayers));
  }
}
---controller-
import { Controller, Get, Param, Query, Res, ParseIntPipe, Post } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PbfService, PbfFilter } from './pbf.service';
import * as zlib from 'zlib';

@ApiTags('tiles')
@Controller('api/tiles')
export class PbfController {
  constructor(private readonly pbfService: PbfService) { }

  @Get('debug')
  @ApiOperation({ summary: 'Debug tile service' })
  getDebug() {
    return {
      message: 'PBF Tile service is working',
      timestamp: new Date().toISOString(),
      endpoints: [
        'GET /api/tiles/sites/{z}/{x}/{y}.pbf',
        'GET /api/tiles/links/{z}/{x}/{y}.pbf',
        'GET /api/tiles/combined/{z}/{x}/{y}.pbf'
      ]
    };
  }

  @Post('clear-cache')
  async clearCache() {
    await this.pbfService.clearTileCache();
    return { success: true };
  }

  @Get('sites/:z/:x/:y.pbf')
  @ApiOperation({ summary: 'Get vector tiles for sites' })
  @ApiParam({ name: 'z', description: 'Zoom level', example: 10 })
  @ApiParam({ name: 'x', description: 'Tile X coordinate', example: 512 })
  @ApiParam({ name: 'y', description: 'Tile Y coordinate', example: 256 })
  @ApiQuery({ name: 'country', required: false, description: 'Filter by countries (comma-separated)' })
  @ApiQuery({ name: 'city', required: false, description: 'Filter by cities (comma-separated)' })
  @ApiQuery({ name: 'network', required: false, description: 'Filter by networks (comma-separated)' })
  @ApiQuery({ name: 'platform', required: false, description: 'Filter by platforms (comma-separated)' })
  async getSitesTile(
    @Param('z', ParseIntPipe) z: number,
    @Param('x', ParseIntPipe) x: number,
    @Param('y', ParseIntPipe) y: number,
    @Query() query: any,
    @Res() res: Response,
  ) {
    const filter: PbfFilter = {
      country: query.country ? query.country.split(',') : undefined,
      city: query.city ? query.city.split(',') : undefined,
      network: query.network ? query.network.split(',') : undefined,
      platform: query.platform ? query.platform.split(',') : undefined,
    };

    const buffer = await this.pbfService.getSitesPbf(z, x, y, filter);
    this.sendPbf(res, buffer);
  }

  @Get('links/:z/:x/:y.pbf')
  @ApiOperation({ summary: 'Get vector tiles for links' })
  @ApiParam({ name: 'z', description: 'Zoom level', example: 10 })
  @ApiParam({ name: 'x', description: 'Tile X coordinate', example: 512 })
  @ApiParam({ name: 'y', description: 'Tile Y coordinate', example: 256 })
  @ApiQuery({ name: 'country', required: false, description: 'Filter by countries (comma-separated)' })
  @ApiQuery({ name: 'city', required: false, description: 'Filter by cities (comma-separated)' })
  @ApiQuery({ name: 'network', required: false, description: 'Filter by networks (comma-separated)' })
  @ApiQuery({ name: 'platform', required: false, description: 'Filter by platforms (comma-separated)' })
  @ApiQuery({ name: 'linkType', required: false, description: 'Filter by link types (comma-separated)' })
  @ApiQuery({ name: 'minDistance', required: false, type: Number, description: 'Minimum link distance' })
  @ApiQuery({ name: 'maxDistance', required: false, type: Number, description: 'Maximum link distance' })
  async getLinksTile(
    @Param('z', ParseIntPipe) z: number,
    @Param('x', ParseIntPipe) x: number,
    @Param('y', ParseIntPipe) y: number,
    @Query() query: any,
    @Res() res: Response,
  ) {
    const filter: PbfFilter = {
      country: query.country ? query.country.split(',') : undefined,
      city: query.city ? query.city.split(',') : undefined,
      network: query.network ? query.network.split(',') : undefined,
      platform: query.platform ? query.platform.split(',') : undefined,
      linkType: query.linkType ? query.linkType.split(',') : undefined,
      minDistance: query.minDistance ? parseFloat(query.minDistance) : undefined,
      maxDistance: query.maxDistance ? parseFloat(query.maxDistance) : undefined,
    };

    const buffer = await this.pbfService.getLinksPbf(z, x, y, filter);
    this.sendPbf(res, buffer);
  }

  @Get('combined/:z/:x/:y.pbf')
  @ApiOperation({ summary: 'Get combined vector tiles' })
  @ApiParam({ name: 'z', description: 'Zoom level', example: 10 })
  @ApiParam({ name: 'x', description: 'Tile X coordinate', example: 512 })
  @ApiParam({ name: 'y', description: 'Tile Y coordinate', example: 256 })
  @ApiQuery({ name: 'country', required: false, description: 'Filter by countries (comma-separated)' })
  @ApiQuery({ name: 'city', required: false, description: 'Filter by cities (comma-separated)' })
  @ApiQuery({ name: 'network', required: false, description: 'Filter by networks (comma-separated)' })
  @ApiQuery({ name: 'platform', required: false, description: 'Filter by platforms (comma-separated)' })
  @ApiQuery({ name: 'linkType', required: false, description: 'Filter by link types (comma-separated)' })
  @ApiQuery({ name: 'minDistance', required: false, type: Number, description: 'Minimum link distance' })
  @ApiQuery({ name: 'maxDistance', required: false, type: Number, description: 'Maximum link distance' })
  async getCombinedTile(
    @Param('z', ParseIntPipe) z: number,
    @Param('x', ParseIntPipe) x: number,
    @Param('y', ParseIntPipe) y: number,
    @Query() query: any,
    @Res() res: Response,
  ) {
    const filter: PbfFilter = {
      country: query.country ? query.country.split(',') : undefined,
      city: query.city ? query.city.split(',') : undefined,
      network: query.network ? query.network.split(',') : undefined,
      platform: query.platform ? query.platform.split(',') : undefined,
      linkType: query.linkType ? query.linkType.split(',') : undefined,
      minDistance: query.minDistance ? parseFloat(query.minDistance) : undefined,
      maxDistance: query.maxDistance ? parseFloat(query.maxDistance) : undefined,
    };

    const buffer = await this.pbfService.getCombinedPbf(z, x, y, filter);
    this.sendPbf(res, buffer);
  }

  private sendPbf(res: Response, buffer: Buffer) {
    res.setHeader('Content-Type', 'application/vnd.mapbox-vector-tile');
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=300');
    try {
      // Convert Buffer to Uint8Array for gzipSync
      const uint8Data = Uint8Array.from(buffer);
      const compressed = zlib.gzipSync(uint8Data);
      res.send(compressed);
    } catch (err) {
      console.error('Error compressing tile:', err);
      res.status(500).send('Error compressing tile');
    }
  }
}
now amaze me buddy