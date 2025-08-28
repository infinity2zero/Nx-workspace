// pathfinding.module.ts
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { PathfindingController } from './pathfinding.controller';
import { PathfindingService } from './pathfinding.service';
import { GraphService } from './graph.service';
import { AnalyticsService } from './analytics.service';
import { AdvancedFeaturesService } from './advanced-features.service';
import { CacheService } from './cache.service';
// import { SqliteModule } from '../sqlite/sqlite.module';
import { DbSettingsModule } from '../dbsettings/dbsettings.module';

@Module({
  imports: [
    DbSettingsModule,
    CacheModule.register({
      ttl: 300, // 5 minutes default TTL
      max: 1000, // Maximum number of items in cache
    }),
  ],
  controllers: [PathfindingController],
  providers: [
    PathfindingService,
    GraphService,
    AnalyticsService,
    AdvancedFeaturesService,
    CacheService,
  ],
  exports: [
    // PathfindingService,
    // GraphService,
    // AnalyticsService,
    // AdvancedFeaturesService,
    // CacheService,
  ],
})
export class PathfindingModule {}