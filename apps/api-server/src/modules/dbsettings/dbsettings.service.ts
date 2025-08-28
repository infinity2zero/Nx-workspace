import { Injectable, Logger } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { getSpatiaLiteExtensionPath } from '../../utils/spatialite-path';

export interface DatabaseInfo {
  name: string;
  path: string;
  size: number;
  created: Date;
  isActive: boolean;
  isDeletable: boolean;
  siteCount?: number;
  linkCount?: number;
  hasSpatial?: boolean;
}

export interface IndexCreationOptions {
  sitesIndexColumns?: string[];
  linksIndexColumns?: string[];
  createAllIndexes?: boolean;
}

@Injectable()
export class DbSettingsService {
  private readonly logger = new Logger(DbSettingsService.name);
  private currentDb: Database.Database;
  private readonly dbFolder = path.join(process.cwd(), 'db');
  private readonly defaultDbName = 'network.sqlite';
  private currentDbName: string;
  
  constructor() {
    const productionDbPath = process.env.DATABASE_PATH;
    if (productionDbPath) {
      // --- PRODUCTION MODE ---
      // The Electron main process has provided the exact path.
      this.logger.log(`Production mode detected. Using database path from environment: ${productionDbPath}`);
      this.dbFolder = path.dirname(productionDbPath);
      this.currentDbName = path.basename(productionDbPath);
      this.currentDb = this.openDatabaseWithSpatial(productionDbPath);
    } else {
      // --- DEVELOPMENT MODE ---
      // Fall back to the original logic for local development.
      this.logger.log('Development mode detected. Using local db folder.');
      this.dbFolder = path.join(process.cwd(), 'db');
      this.ensureDbFolder();
      this.initializeDefaultDb();
    }
  }

  private ensureDbFolder() {
    if (!fs.existsSync(this.dbFolder)) {
      fs.mkdirSync(this.dbFolder, { recursive: true });
    }
  }

  private initializeDefaultDb() {
    const defaultDbPath = path.join(this.dbFolder, this.defaultDbName);
    this.currentDbName = this.defaultDbName;
    this.currentDb = this.openDatabaseWithSpatial(defaultDbPath);
  }

  private openDatabaseWithSpatial(dbPath: string): Database.Database {
    this.logger.log(`Opening SQLite DB with spatial: ${dbPath} for ${this.currentDbName}`);

    const db = new Database(dbPath, {
      readonly: false,
      fileMustExist: false,
    });

    // Performance pragmas
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('temp_store = MEMORY');
    db.pragma('cache_size = -200000'); // 200MB cache

    // Load spatial extension
    const extPath = getSpatiaLiteExtensionPath();
    if (!extPath || !fs.existsSync(extPath)) {
      this.logger.warn(`SpatiaLite not found at ${extPath}`);
      return db;
    }

    try {
      this.logger.log(`Loading SpatiaLite extension: ${extPath}`);
      db.loadExtension(extPath);

      try {
        const spatialCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='spatial_ref_sys'").get();
        if (!spatialCheck) {
          this.logger.log('Initializing spatial metadata...');
          db.exec('SELECT InitSpatialMetadata(1)');
        }
      } catch (initError) {
        this.logger.warn('Could not initialize spatial metadata:', initError.message);
      }

      const version = db.prepare('SELECT spatialite_version() AS version').get() as any;
      this.logger.log(`Loaded SpatiaLite v${version?.version}, for database ${this.currentDbName}`);
    } catch (err) {
      this.logger.error(`Failed to load SpatiaLite: ${err.message}`);
    }

    return db;
  }

  getCurrentDatabase(): Database.Database {
    return this.currentDb;
  }

  getCurrentDatabaseName(): string {
    return this.currentDbName;
  }

  async getAllDatabases(): Promise<DatabaseInfo[]> {
    const databases: DatabaseInfo[] = [];
    const files = fs.readdirSync(this.dbFolder);

    for (const file of files) {
      if (file.endsWith('.sqlite')) {
        const filePath = path.join(this.dbFolder, file);
        const stats = fs.statSync(filePath);
        const isActive = this.currentDbName === file;

        let siteCount = 0;
        let linkCount = 0;
        let hasSpatial = false;

        try {
          const tempDb = this.openDatabaseWithSpatial(filePath);

          try {
            const spatialCheck = tempDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='spatial_ref_sys'").get();
            hasSpatial = !!spatialCheck;
          } catch (e) { }

          try {
            const siteResult = tempDb.prepare("SELECT COUNT(*) as count FROM sites").get() as any;
            siteCount = siteResult?.count || 0;
          } catch (e) { }

          try {
            const linkResult = tempDb.prepare("SELECT COUNT(*) as count FROM links").get() as any;
            linkCount = linkResult?.count || 0;
          } catch (e) { }

          tempDb.close();
        } catch (e) {
          this.logger.warn(`Could not read database ${file}: ${e.message}`);
        }

        databases.push({
          name: file,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          isActive,
          isDeletable: file !== this.defaultDbName,
          siteCount,
          linkCount,
          hasSpatial
        });
      }
    }

    return databases.sort((a, b) => a.name.localeCompare(b.name));
  }

  async switchDatabase(dbName: string): Promise<boolean> {
    try {
      const dbPath = path.join(this.dbFolder, dbName);

      if (!fs.existsSync(dbPath)) {
        throw new Error(`Database ${dbName} not found`);
      }

      if (this.currentDb) {
        this.currentDb.close();
      }

      this.currentDb = this.openDatabaseWithSpatial(dbPath);
      this.currentDbName = dbName;

      this.logger.log(`Switched to database: ${dbName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to switch database: ${error.message}`);
      this.initializeDefaultDb();
      return false;
    }
  }

  async deleteDatabase(dbName: string): Promise<boolean> {
    if (dbName === this.defaultDbName) {
      throw new Error('Cannot delete default database');
    }

    try {
      const dbPath = path.join(this.dbFolder, dbName);

      if (this.currentDbName === dbName) {
        await this.switchDatabase(this.defaultDbName);
      }

      fs.unlinkSync(dbPath);
      this.logger.log(`Deleted database: ${dbName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete database: ${error.message}`);
      return false;
    }
  }

  async createDatabaseFromJson(
    dbName: string,
    sitesData: any[],
    linksData: any[],
    indexOptions?: IndexCreationOptions
  ): Promise<boolean> {
    let newDb: Database.Database | null = null;

    try {
      const dbPath = path.join(this.dbFolder, dbName);
      newDb = this.openDatabaseWithSpatial(dbPath);

      // Clear existing data if any
      try {
        newDb.exec('DROP TABLE IF EXISTS sites');
        newDb.exec('DROP TABLE IF EXISTS links');
      } catch (e) {
        // Tables might not exist
      }

      let sitesColumns: string[] = [];
      let linksColumns: string[] = [];

      if (sitesData.length > 0) {
        sitesColumns = await this.createSitesTable(newDb, sitesData);
      }

      if (linksData.length > 0) {
        linksColumns = await this.createLinksTable(newDb, linksData);
      }

      // Create dynamic indexes
      await this.createDynamicIndexes(newDb, sitesColumns, linksColumns, indexOptions);

      // Analyze for query optimization
      try {
        newDb.exec('ANALYZE');
        this.logger.log('Database analysis completed');
      } catch (error) {
        this.logger.warn('Database analysis failed:', error.message);
      }

      newDb.close();
      newDb = null;

      this.logger.log(`Created database: ${dbName} with ${sitesData.length} sites and ${linksData.length} links`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to create database: ${error.message}`);
      if (newDb) {
        try {
          newDb.close();
        } catch (e) { }
      }
      return false;
    }
  }

  private async createSitesTable(db: Database.Database, sitesData: any[]): Promise<string[]> {
    const sampleSite = sitesData[0];
    const columns: string[] = [];
    const allColumns: string[] = [];

    Object.keys(sampleSite).forEach(key => {
      if (key === 'latitude' || key === 'longitude') return; // Skip, using geometry

      const value = sampleSite[key];
      let type = 'TEXT';
      if (typeof value === 'number') {
        type = Number.isInteger(value) ? 'INTEGER' : 'REAL';
      } else if (typeof value === 'boolean') {
        type = 'INTEGER';
      }

      // Add constraints for important fields
      if (key === 'site_id') {
        columns.push(`${key} ${type} PRIMARY KEY`);
      } else if (key === 'site_name' || key === 'last_modified_at') {
        columns.push(`${key} ${type} NOT NULL`);
      } else if (key === 'is_deleted') {
        columns.push(`${key} ${type} NOT NULL DEFAULT 0`);
      } else {
        columns.push(`${key} ${type}`);
      }

      allColumns.push(key);
    });

    // Create table
    const createTableSQL = `CREATE TABLE sites (${columns.join(', ')})`;
    db.exec(createTableSQL);

    // Add geometry column using SpatiaLite
    try {
      db.exec("SELECT AddGeometryColumn('sites', 'geometry', 4326, 'POINT', 'XY')");
      allColumns.push('geometry');
      this.logger.log('Added geometry column to sites table');
    } catch (error) {
      this.logger.warn('Could not add geometry column to sites:', error.message);
    }

    // Prepare bulk insert with transaction
    const siteKeys = Object.keys(sampleSite).filter(key => key !== 'latitude' && key !== 'longitude');
    const placeholders = siteKeys.map(() => '?').join(', ');

    const insertSQL = `INSERT INTO sites (${siteKeys.join(', ')}, geometry) VALUES (${placeholders}, MakePoint(?, ?, 4326))`;
    const insertSite = db.prepare(insertSQL);

    // Bulk insert with transaction
    const insertTransaction = db.transaction((sites) => {
      for (const site of sites) {
        try {
          const values = siteKeys.map(key => {
            let val = site[key];
            if (typeof val === 'boolean') val = val ? 1 : 0;
            return val;
          });

          // Add longitude, latitude for MakePoint
          values.push(parseFloat(site.longitude), parseFloat(site.latitude));
          insertSite.run(...values);
        } catch (error) {
          this.logger.warn(`Failed to insert site ${site.site_id}: ${error.message}`);
        }
      }
    });

    insertTransaction(sitesData);

    // Create spatial index
    try {
      db.exec("SELECT CreateSpatialIndex('sites', 'geometry')");
      this.logger.log('Created spatial index for sites.geometry');
    } catch (error) {
      this.logger.warn('Could not create spatial index for sites:', error.message);
    }

    this.logger.log(`Inserted ${sitesData.length} sites with spatial geometry`);
    return allColumns;
  }

  private async createLinksTable(db: Database.Database, linksData: any[]): Promise<string[]> {
    const sampleLink = linksData[0];
    const columns: string[] = [];
    const allColumns: string[] = [];

    Object.keys(sampleLink).forEach(key => {
      if (key === 'link_wkt') return; // Skip, using geometry

      const value = sampleLink[key];
      let type = 'TEXT';
      if (typeof value === 'number') {
        type = Number.isInteger(value) ? 'INTEGER' : 'REAL';
      } else if (typeof value === 'boolean') {
        type = 'INTEGER';
      }

      // Add constraints for important fields
      if (key === 'link_id') {
        columns.push(`${key} ${type} PRIMARY KEY`);
      } else if (key === 'site_a_id' || key === 'site_b_id' || key === 'last_modified_at') {
        columns.push(`${key} ${type} NOT NULL`);
      } else if (key === 'is_deleted') {
        columns.push(`${key} ${type} NOT NULL DEFAULT 0`);
      } else {
        columns.push(`${key} ${type}`);
      }

      allColumns.push(key);
    });

    // Add foreign key constraints if site references exist
    const hasSiteRefs = sampleLink.site_a_id && sampleLink.site_b_id;
    let foreignKeys = '';
    if (hasSiteRefs) {
      foreignKeys = ', FOREIGN KEY (site_a_id) REFERENCES sites(site_id), FOREIGN KEY (site_b_id) REFERENCES sites(site_id)';
    }

    const createTableSQL = `CREATE TABLE links (${columns.join(', ')}${foreignKeys})`;
    db.exec(createTableSQL);

    // Add geometry column
    try {
      db.exec("SELECT AddGeometryColumn('links', 'geometry', 4326, 'LINESTRING', 'XY')");
      allColumns.push('geometry');
      this.logger.log('Added geometry column to links table');
    } catch (error) {
      this.logger.warn('Could not add geometry column to links:', error.message);
    }

    const linkKeys = Object.keys(sampleLink).filter(key => key !== 'link_wkt');
    const placeholders = linkKeys.map(() => '?').join(', ');

    const insertSQL = `INSERT INTO links (${linkKeys.join(', ')}, geometry) VALUES (${placeholders}, GeomFromText(?, 4326))`;
    const insertLink = db.prepare(insertSQL);

    const insertTransaction = db.transaction((links) => {
      for (const link of links) {
        try {
          const values = linkKeys.map(key => {
            let val = link[key];
            if (typeof val === 'boolean') val = val ? 1 : 0;
            return val;
          });

          // Add WKT geometry - handle null/empty case
          const wkt = link.link_wkt || null;
          values.push(wkt);

          insertLink.run(...values);
        } catch (error) {
          this.logger.warn(`Failed to insert link ${link.link_id}: ${error.message}`);
        }
      }
    });

    insertTransaction(linksData);

    // Create spatial index
    try {
      db.exec("SELECT CreateSpatialIndex('links', 'geometry')");
      this.logger.log('Created spatial index for links.geometry');
    } catch (error) {
      this.logger.warn('Could not create spatial index for links:', error.message);
    }

    this.logger.log(`Inserted ${linksData.length} links with spatial geometry`);
    return allColumns;
  }

  private async createDynamicIndexes(
    db: Database.Database,
    sitesColumns: string[],
    linksColumns: string[],
    indexOptions?: IndexCreationOptions
  ): Promise<void> {
    this.logger.log('Creating dynamic indexes...');

    const indexesCreated: string[] = [];
    const indexesFailed: string[] = [];

    // Determine which columns to index for sites
    const sitesIndexColumns = indexOptions?.sitesIndexColumns ||
      (indexOptions?.createAllIndexes !== false ? sitesColumns : []);

    // Determine which columns to index for links
    const linksIndexColumns = indexOptions?.linksIndexColumns ||
      (indexOptions?.createAllIndexes !== false ? linksColumns : []);

    // Create indexes for sites table
    if (sitesIndexColumns.length > 0) {
      this.logger.log(`Creating indexes for sites table on columns: ${sitesIndexColumns.join(', ')}`);

      for (const column of sitesIndexColumns) {
        if (column === 'geometry') {
          // Spatial index already created in createSitesTable
          continue;
        }

        const indexName = `idx_sites_${column}`;
        const indexSQL = `CREATE INDEX IF NOT EXISTS ${indexName} ON sites(${column})`;

        try {
          db.exec(indexSQL);
          indexesCreated.push(indexName);
        } catch (error) {
          this.logger.warn(`Failed to create index ${indexName}: ${error.message}`);
          indexesFailed.push(indexName);
        }
      }

      // Create some useful composite indexes for sites
      const compositeIndexes = [
        { name: 'idx_sites_country_city', columns: ['country', 'city'] },
        { name: 'idx_sites_country_network', columns: ['country', 'network'] },
        { name: 'idx_sites_city_platform', columns: ['city', 'platform'] },
        { name: 'idx_sites_network_platform', columns: ['network', 'platform'] }
      ];

      for (const { name, columns } of compositeIndexes) {
        // Only create if all columns exist
        if (columns.every(col => sitesIndexColumns.includes(col))) {
          const indexSQL = `CREATE INDEX IF NOT EXISTS ${name} ON sites(${columns.join(', ')})`;
          try {
            db.exec(indexSQL);
            indexesCreated.push(name);
          } catch (error) {
            this.logger.warn(`Failed to create composite index ${name}: ${error.message}`);
            indexesFailed.push(name);
          }
        }
      }
    }

    // Create indexes for links table
    if (linksIndexColumns.length > 0) {
      this.logger.log(`Creating indexes for links table on columns: ${linksIndexColumns.join(', ')}`);

      for (const column of linksIndexColumns) {
        if (column === 'geometry') {
          // Spatial index already created in createLinksTable
          continue;
        }

        const indexName = `idx_links_${column}`;
        const indexSQL = `CREATE INDEX IF NOT EXISTS ${indexName} ON links(${column})`;

        try {
          db.exec(indexSQL);
          indexesCreated.push(indexName);
        } catch (error) {
          this.logger.warn(`Failed to create index ${indexName}: ${error.message}`);
          indexesFailed.push(indexName);
        }
      }

      // Create some useful composite indexes for links
      const compositeIndexes = [
        { name: 'idx_links_sites_pair', columns: ['site_a_id', 'site_b_id'] },
        { name: 'idx_links_type_distance', columns: ['link_type', 'link_distance'] },
        { name: 'idx_links_type_deleted', columns: ['link_type', 'is_deleted'] }
      ];

      for (const { name, columns } of compositeIndexes) {
        // Only create if all columns exist
        if (columns.every(col => linksIndexColumns.includes(col))) {
          const indexSQL = `CREATE INDEX IF NOT EXISTS ${name} ON links(${columns.join(', ')})`;
          try {
            db.exec(indexSQL);
            indexesCreated.push(name);
          } catch (error) {
            this.logger.warn(`Failed to create composite index ${name}: ${error.message}`);
            indexesFailed.push(name);
          }
        }
      }
    }

    this.logger.log(`Indexes created successfully: ${indexesCreated.length}`);
    if (indexesCreated.length > 0) {
      this.logger.log(`Created indexes: ${indexesCreated.join(', ')}`);
    }

    if (indexesFailed.length > 0) {
      this.logger.warn(`Failed to create indexes: ${indexesFailed.join(', ')}`);
    }
  }

  // Method to get available columns for a database (for UI)
  async getDatabaseSchema(dbName?: string): Promise<{ sitesColumns: string[], linksColumns: string[] }> {
    let tempDb: Database.Database | null = null;

    try {
      if (dbName && dbName !== this.currentDbName) {
        const dbPath = path.join(this.dbFolder, dbName);
        tempDb = this.openDatabaseWithSpatial(dbPath);
      } else {
        tempDb = this.currentDb;
      }

      const sitesColumns: string[] = [];
      const linksColumns: string[] = [];

      // Get sites columns
      try {
        const sitesPragma = tempDb.prepare("PRAGMA table_info(sites)").all() as any[];
        sitesColumns.push(...sitesPragma.map((col: any) => col.name));
      } catch (e) {
        this.logger.warn('Could not get sites table schema');
      }

      // Get links columns
      try {
        const linksPragma = tempDb.prepare("PRAGMA table_info(links)").all() as any[];
        linksColumns.push(...linksPragma.map((col: any) => col.name));
      } catch (e) {
        this.logger.warn('Could not get links table schema');
      }

      if (dbName && dbName !== this.currentDbName && tempDb) {
        tempDb.close();
      }

      return { sitesColumns, linksColumns };
    } catch (error) {
      if (tempDb && dbName && dbName !== this.currentDbName) {
        try {
          tempDb.close();
        } catch (e) { }
      }
      throw error;
    }
  }

  // Method to get existing indexes for a database (for UI)
  async getDatabaseIndexes(dbName?: string): Promise<{ sitesIndexes: string[], linksIndexes: string[] }> {
    let tempDb: Database.Database | null = null;

    try {
      if (dbName && dbName !== this.currentDbName) {
        const dbPath = path.join(this.dbFolder, dbName);
        tempDb = this.openDatabaseWithSpatial(dbPath);
      } else {
        tempDb = this.currentDb;
      }

      const sitesIndexes: string[] = [];
      const linksIndexes: string[] = [];

      // Get all indexes
      const allIndexes = tempDb.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").all() as any[];

      for (const index of allIndexes) {
        if (index.tbl_name === 'sites') {
          sitesIndexes.push(index.name);
        } else if (index.tbl_name === 'links') {
          linksIndexes.push(index.name);
        }
      }

      if (dbName && dbName !== this.currentDbName && tempDb) {
        tempDb.close();
      }

      return { sitesIndexes, linksIndexes };
    } catch (error) {
      if (tempDb && dbName && dbName !== this.currentDbName) {
        try {
          tempDb.close();
        } catch (e) { }
      }
      throw error;
    }
  }
}

