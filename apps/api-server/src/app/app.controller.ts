import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Database } from 'better-sqlite3';
import { existsSync } from 'fs';
import { join } from 'path';
import { SQLITE_CONNECTION } from '../modules/sqlite.module';
import { Inject } from '@nestjs/common';
import { DbSettingsService } from '../modules/dbsettings/dbsettings.service';

@ApiTags('health')
@Controller('api')
export class AppController {
  constructor(private readonly dbService: DbSettingsService) {}
    private get db() {
      return this.dbService.getCurrentDatabase();
    }

  @Get('health')
  @ApiOperation({ summary: 'Health check and database connection test' })
  getHealth() {
    try {
      const siteRow = this.db
        .prepare('SELECT COUNT(*) AS count FROM sites')
        .get() as { count: number };
      const linkRow = this.db
        .prepare('SELECT COUNT(*) AS count FROM links')
        .get() as { count: number };

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: {
          connected: true,
          sites: siteRow.count,
          links: linkRow.count,
        },
      };
    } catch (error: any) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: {
          connected: false,
          error: error.message,
        },
      };
    }
  }

  @Get('debug')
  @ApiOperation({ summary: 'Debug paths and environment' })
  getDebug() {
    const cwd = process.cwd();
    const dbPath = join(cwd, 'db', 'network.sqlite');
    return {
      cwd,
      dbPath,
      dbExists: existsSync(dbPath),
      nodeEnv: process.env['NODE_ENV'],
      dirname: __dirname,
    };
  }
}
