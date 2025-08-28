// src/modules/sites/sites.service.ts

import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Database } from 'better-sqlite3';
// import { PbfFilter } from '../pbf/pbf.service';
import { SQLITE_CONNECTION } from '../sqlite.module';
import { DbSettingsService } from '../dbsettings/dbsettings.service';

export interface SiteFilter {
  country?: string[];
  city?: string[];
  network?: string[];
  platform?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}

export interface SiteWithCoordinates {
  site_id: string;
  site_virtual_name: string;
  site_name: string;
  country: string;
  city: string;
  platform: string;
  network: string;
  latitude: number;
  longitude: number;
  last_modified_at: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface SitesResponse {
  data: SiteWithCoordinates[];
  meta: PaginationMeta;
}

@Injectable()
export class SitesService {
  constructor(private readonly dbService: DbSettingsService) {}
    private get db() {
      return this.dbService.getCurrentDatabase();
    }

  private buildWhere(filter: SiteFilter): { clause: string; params: any[] } {
    const clauses: string[] = ['is_deleted = 0'];
    const params: any[] = [];

    if (filter.country?.length) {
      clauses.push(`country IN (${filter.country.map(() => '?').join(',')})`);
      params.push(...filter.country);
    }
    if (filter.city?.length) {
      clauses.push(`city IN (${filter.city.map(() => '?').join(',')})`);
      params.push(...filter.city);
    }
    if (filter.network?.length) {
      clauses.push(`network IN (${filter.network.map(() => '?').join(',')})`);
      params.push(...filter.network);
    }
    if (filter.platform?.length) {
      const or = filter.platform.map(() => `LOWER(platform) LIKE LOWER(?)`).join(' OR ');
      clauses.push(`(${or})`);
      params.push(...filter.platform.map(p => `%${p}%`));
    }
    if (filter.search) {
      clauses.push(
        `(
          LOWER(site_name) LIKE LOWER(?) OR
          LOWER(site_virtual_name) LIKE LOWER(?) OR
          LOWER(country) LIKE LOWER(?) OR
          LOWER(city) LIKE LOWER(?)
        )`
      );
      for (let i = 0; i < 4; i++) {
        params.push(`%${filter.search}%`);
      }
    }

    return { clause: clauses.join(' AND '), params };
  }

  findAll(filter: SiteFilter = {}): SitesResponse {
    const limit = Math.min(filter.limit || 50, 500);
    const offset = filter.offset || 0;
    const page = Math.floor(offset / limit) + 1;

    const where = this.buildWhere(filter);

    // total count
    const totalStmt = this.db.prepare(
      `SELECT COUNT(*) AS cnt FROM sites WHERE ${where.clause}`
    );
    const total = (totalStmt.get(...where.params) as any).cnt as number;

    // data
    const stmt = this.db.prepare(
      `
      SELECT
        site_id,
        site_virtual_name,
        site_name,
        country,
        city,
        platform,
        network,
        AsGeoJSON(geometry) AS geojson,
        last_modified_at
      FROM sites
      WHERE ${where.clause}
      ORDER BY country, city, site_name
      LIMIT ? OFFSET ?
      `
    );
    const rows = stmt.all(...where.params, limit, offset) as any[];

    const data: SiteWithCoordinates[] = rows.map(r => {
      const geom = JSON.parse(r.geojson);
      return {
        site_id: r.site_id,
        site_virtual_name: r.site_virtual_name,
        site_name: r.site_name,
        country: r.country,
        city: r.city,
        platform: r.platform,
        network: r.network,
        latitude: geom.coordinates[1],
        longitude: geom.coordinates[0],
        last_modified_at: r.last_modified_at,
      };
    });

    const totalPages = Math.ceil(total / limit);
    const meta: PaginationMeta = {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };

    return { data, meta };
  }

  findOne(id: string): SiteWithCoordinates {
    const row = this.db
      .prepare(
        `
      SELECT
        site_id,
        site_virtual_name,
        site_name,
        country,
        city,
        platform,
        network,
        AsGeoJSON(geometry) AS geojson,
        last_modified_at
      FROM sites
      WHERE site_id = ? AND is_deleted = 0
      `
      )
      .get(id) as any;
    if (!row) throw new NotFoundException(`Site ${id} not found`);
    const geom = JSON.parse(row.geojson);
    return {
      site_id: row.site_id,
      site_virtual_name: row.site_virtual_name,
      site_name: row.site_name,
      country: row.country,
      city: row.city,
      platform: row.platform,
      network: row.network,
      latitude: geom.coordinates[1],
      longitude: geom.coordinates[0],
      last_modified_at: row.last_modified_at,
    };
  }

  getStats() {
    const totalSites = this.db
      .prepare(`SELECT COUNT(*) AS cnt FROM sites WHERE is_deleted = 0;`)
      .get() as { cnt: number };

    const countryStats = this.db
      .prepare(
        `
      SELECT country, COUNT(*) AS count
      FROM sites
      WHERE is_deleted = 0 AND country IS NOT NULL
      GROUP BY country
      ORDER BY count DESC
      LIMIT 20
      `
      )
      .all() as Array<{ country: string; count: number }>;

    const networkStats = this.db
      .prepare(
        `
      SELECT network, COUNT(*) AS count
      FROM sites
      WHERE is_deleted = 0 AND network IS NOT NULL
      GROUP BY network
      ORDER BY count DESC
      `
      )
      .all() as Array<{ network: string; count: number }>;

    const platformStats = this.db
      .prepare(
        `
      SELECT platform, COUNT(*) AS count
      FROM sites
      WHERE is_deleted = 0 AND platform IS NOT NULL
      GROUP BY platform
      ORDER BY count DESC
      LIMIT 15
      `
      )
      .all() as Array<{ platform: string; count: number }>;

    const cityStats = this.db
      .prepare(
        `
      SELECT country, city, COUNT(*) AS count
      FROM sites
      WHERE is_deleted = 0 AND city IS NOT NULL
      GROUP BY country, city
      ORDER BY count DESC
      LIMIT 20
      `
      )
      .all() as Array<{ country: string; city: string; count: number }>;

    return {
      totalSites,
      countryStats,
      networkStats,
      platformStats,
      topCities: cityStats,
    };
  }

  getSitesByBoundingBox(
    minLat: number,
    maxLat: number,
    minLon: number,
    maxLon: number,
    limit = 1000,
  ): SiteWithCoordinates[] {
    const stmt = this.db.prepare(
      `
      SELECT
        site_id,
        site_virtual_name,
        site_name,
        country,
        city,
        platform,
        network,
        AsGeoJSON(geometry) AS geojson,
        last_modified_at
      FROM sites
      WHERE is_deleted = 0
        AND Y(geometry) BETWEEN ? AND ?
        AND X(geometry) BETWEEN ? AND ?
      LIMIT ?
      `
    );
    const rows = stmt.all(minLat, maxLat, minLon, maxLon, limit) as any[];
    return rows.map(r => {
      const geom = JSON.parse(r.geojson);
      return {
        site_id: r.site_id,
        site_virtual_name: r.site_virtual_name,
        site_name: r.site_name,
        country: r.country,
        city: r.city,
        platform: r.platform,
        network: r.network,
        latitude: geom.coordinates[1],
        longitude: geom.coordinates[0],
        last_modified_at: r.last_modified_at,
      };
    });
  }
}
