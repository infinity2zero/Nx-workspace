// src/modules/analytics/analytics.module.ts

import { Module, Global } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { join } from 'path';

@Global()
@Module({
  imports: [
    // Ensure this path matches your DB location
    
  ],
  providers: [
    AnalyticsService
  ],
  controllers: [AnalyticsController],
//   exports: [AnalyticsService],
})
export class AnalyticsModule {}
