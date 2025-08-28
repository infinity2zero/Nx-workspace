// src/modules/analytics/analytics.controller.ts

import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService, DistributionItem, TimeSeriesPoint } from './analytics.service';

@ApiTags('analytics')
@Controller('api/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get overview totals' })
  getOverview() {
    return this.analytics.getOverview();
  }

  @Get('distribution/countries')
  @ApiOperation({ summary: 'Get distribution of sites by country' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max items' })
  getCountryDist(@Query('limit') limit?: number): DistributionItem[] {
    return this.analytics.getCountryDistribution(limit);
  }

  @Get('distribution/cities')
  @ApiOperation({ summary: 'Get distribution of sites by city' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getCityDist(@Query('limit') limit?: number): DistributionItem[] {
    return this.analytics.getCityDistribution(limit);
  }

  @Get('distribution/network')
  @ApiOperation({ summary: 'Get distribution of sites by network type' })
  getNetworkDist(): DistributionItem[] {
    return this.analytics.getNetworkDistribution();
  }

  @Get('distribution/platform')
  @ApiOperation({ summary: 'Get distribution of sites by platform' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getPlatformDist(@Query('limit') limit?: number): DistributionItem[] {
    return this.analytics.getPlatformDistribution(limit);
  }

  @Get('timeseries/sites/monthly')
  @ApiOperation({ summary: 'Get monthly new sites time series' })
  @ApiQuery({ name: 'yearsBack', required: false, type: Number, description: 'Years back to include' })
  getMonthlySites(@Query('yearsBack') yearsBack?: number): TimeSeriesPoint[] {
    return this.analytics.getMonthlySites(yearsBack);
  }

  @Get('count/sites')
  @ApiOperation({ summary: 'Count sites by optional filters' })
  @ApiQuery({ name: 'country', required: false, type: String })
  @ApiQuery({ name: 'network', required: false, type: String })
  countSites(
    @Query('country') country?: string,
    @Query('network') network?: string,
  ) {
    return { count: this.analytics.countSitesByFilter(country, network) };
  }
}
