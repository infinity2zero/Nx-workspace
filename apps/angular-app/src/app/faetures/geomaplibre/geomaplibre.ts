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
