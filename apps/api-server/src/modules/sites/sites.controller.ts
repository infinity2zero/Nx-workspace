// src/modules/sites/sites.controller.ts

import { Controller, Get, Param, Query, BadRequestException, Inject } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { SitesService, SiteFilter } from './sites.service';

@ApiTags('sites')
@Controller('api/sites')
export class SitesController {
  constructor(
    @Inject('SitesService') private readonly sitesService: SitesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all sites' })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'network', required: false })
  @ApiQuery({ name: 'platform', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200 })
  findAll(@Query() q: any) {
    const filter: SiteFilter = {
      country: q.country ? q.country.split(',') : undefined,
      city: q.city ? q.city.split(',') : undefined,
      network: q.network ? q.network.split(',') : undefined,
      platform: q.platform ? q.platform.split(',') : undefined,
      search: q.search,
      limit: q.limit ? parseInt(q.limit) : undefined,
      offset: q.offset ? parseInt(q.offset) : undefined,
    };
    return this.sitesService.findAll(filter);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get site statistics' })
  @ApiResponse({ status: 200 })
  getStats() {
    return this.sitesService.getStats();
  }

  @Get('bbox')
  @ApiOperation({ summary: 'Get sites in bounding box' })
  @ApiQuery({ name: 'minLat', type: Number })
  @ApiQuery({ name: 'maxLat', type: Number })
  @ApiQuery({ name: 'minLon', type: Number })
  @ApiQuery({ name: 'maxLon', type: Number })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  getByBbox(@Query() q: any) {
    const { minLat, maxLat, minLon, maxLon, limit } = q;
    if (!minLat || !maxLat || !minLon || !maxLon) {
      throw new BadRequestException('minLat, maxLat, minLon, maxLon required');
    }
    return this.sitesService.getSitesByBoundingBox(
      parseFloat(minLat),
      parseFloat(maxLat),
      parseFloat(minLon),
      parseFloat(maxLon),
      limit ? parseInt(limit) : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get site by ID' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  findOne(@Param('id') id: string) {
    return this.sitesService.findOne(id);
  }
}
