import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { PbfController } from './pbf.controller';
import { PbfService } from './pbf.service';

@Module({
  imports: [
    CacheModule.register({
      ttl: 300, // Cache for 5 minutes
      max: 1000, // Maximum 1000 tiles in cache
    }),
  ],
  controllers: [PbfController],
  providers: [PbfService],
})
export class PbfModule {}
