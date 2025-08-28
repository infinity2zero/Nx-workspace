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
