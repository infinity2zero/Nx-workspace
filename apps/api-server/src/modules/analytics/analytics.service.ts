
import { Injectable, Inject } from '@nestjs/common';
import { DbSettingsService } from '../dbsettings/dbsettings.service';

export interface DistributionItem {
  label: string;
  count: number;
}

export interface TimeSeriesPoint {
  period: string;
  count: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly dbService: DbSettingsService) {}
  private get db() {
    return this.dbService.getCurrentDatabase();
  }

  // 1. Overview totals
  getOverview() {
    const totalSites = this.db
      .prepare('SELECT COUNT(*) AS cnt FROM sites WHERE is_deleted = 0')
      .get() as { cnt: number };

    const totalLinks = this.db
      .prepare('SELECT COUNT(*) AS cnt FROM links')
      .get() as { cnt: number };

    const totalCountries = this.db
      .prepare('SELECT COUNT(DISTINCT country) AS cnt FROM sites WHERE is_deleted = 0 AND country IS NOT NULL')
      .get() as { cnt: number };

    const totalCities = this.db
      .prepare('SELECT COUNT(DISTINCT city) AS cnt FROM sites WHERE is_deleted = 0 AND city IS NOT NULL')
      .get() as { cnt: number };

    return { totalSites, totalLinks, totalCountries, totalCities };
  }

  // 2. Distribution by field
  private getDistribution(
    sql: string,
    params: any[] = [],
  ): DistributionItem[] {
    const stmt = this.db.prepare(sql);
    const rows = params.length ? stmt.all(...params) : stmt.all();
    return (rows as any[]).map(r => ({
      label: r.label,
      count: r.count as number,
    }));
  }

  getCountryDistribution(limit = 20): DistributionItem[] {
    const sql = `
      SELECT country AS label, COUNT(*) AS count
      FROM sites
      WHERE is_deleted = 0 AND country IS NOT NULL
      GROUP BY country
      ORDER BY count DESC
      LIMIT ?`;
    return this.getDistribution(sql, [limit]);
  }

  getCityDistribution(limit = 20): DistributionItem[] {
    const sql = `
      SELECT city || ', ' || country AS label, COUNT(*) AS count
      FROM sites
      WHERE is_deleted = 0 AND city IS NOT NULL
      GROUP BY city, country
      ORDER BY count DESC
      LIMIT ?`;
    return this.getDistribution(sql, [limit]);
  }

  getNetworkDistribution(): DistributionItem[] {
    const sql = `
      SELECT network AS label, COUNT(*) AS count
      FROM sites
      WHERE is_deleted = 0 AND network IS NOT NULL
      GROUP BY network
      ORDER BY count DESC`;
    return this.getDistribution(sql);
  }

  getPlatformDistribution(limit = 100): DistributionItem[] {
    const sql = `
      SELECT platform AS label, COUNT(*) AS count
      FROM sites
      WHERE is_deleted = 0 AND platform IS NOT NULL
      GROUP BY platform
      ORDER BY count DESC
      LIMIT ?`;
    return this.getDistribution(sql, [limit]);
  }

  // 3. Time series: new sites per month
  getMonthlySites(yearsBack = 1): TimeSeriesPoint[] {
    const sql = `
      SELECT strftime('%Y-%m', last_modified_at) AS period, COUNT(*) AS count
      FROM sites
      WHERE is_deleted = 0
        AND last_modified_at >= date('now', ?)
      GROUP BY period
      ORDER BY period`;
    const since = `-${yearsBack} years`;
    return (this.db.prepare(sql).all(since) as any[]).map(r => ({
      period: r.period,
      count: r.count as number,
    }));
  }

  // 4. Custom count with optional filters
  countSitesByFilter(country?: string, network?: string): number {
    let sql = 'SELECT COUNT(*) AS cnt FROM sites WHERE is_deleted = 0';
    const params: any[] = [];

    if (country) {
      sql += ' AND country = ?';
      params.push(country);
    }
    if (network) {
      sql += ' AND network = ?';
      params.push(network);
    }

    return (this.db.prepare(sql).get(...params) as any).cnt as number;
  }
}
