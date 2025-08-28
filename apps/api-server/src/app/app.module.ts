import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SitesModule } from '../modules/sites/sites.module';
import { PbfModule } from '../modules/pbf/pbf.module';
import { SQLITE_CONNECTION, SqliteModule } from '../modules/sqlite.module';
import { AnalyticsModule } from '../modules/analytics/analytics.module';
import { DbSettingsModule } from '../modules/dbsettings/dbsettings.module';
import { DbSettingsService } from '../modules/dbsettings/dbsettings.service';
import { PathfindingModule } from '../modules/pathfinding/pathfinding.module';

@Module({
  imports: [
    SqliteModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PbfModule,
    SitesModule,
    AnalyticsModule,
    DbSettingsModule,
    PathfindingModule
  ],
  providers: [
    // Provide DATABASE as an alias - this gets the current active database
    {
      provide: 'DATABASE',
      useFactory: (databaseService: DbSettingsService) => databaseService.getCurrentDatabase(),
      inject: [DbSettingsService],
    },
    AppService
  ],
  controllers: [AppController],
})
export class AppModule {}

