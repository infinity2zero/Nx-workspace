// src/modules/sites/sites.module.ts

import { Module, Global } from '@nestjs/common';
import { SitesService } from './sites.service';
import { SitesController } from './sites.controller';

@Global()
@Module({
  imports: [
  ],
  controllers: [SitesController],
  providers: [
    {
      provide: 'SitesService',
      useClass: SitesService,
    },
  ],
//   exports: [SitesService],
})
export class SitesModule {}
