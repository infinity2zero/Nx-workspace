import { Controller, Get, Param, Query, Res, ParseIntPipe, Post } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PbfService, PbfFilter } from './pbf.service';
import * as zlib from 'zlib';

@ApiTags('tiles')
@Controller('api/tiles')
export class PbfController {
  constructor(private readonly pbfService: PbfService) { }

  @Get('debug')
  @ApiOperation({ summary: 'Debug tile service' })
  getDebug() {
    return {
      message: 'PBF Tile service is working',
      timestamp: new Date().toISOString(),
      endpoints: [
        'GET /api/tiles/sites/{z}/{x}/{y}.pbf',
        'GET /api/tiles/links/{z}/{x}/{y}.pbf',
        'GET /api/tiles/combined/{z}/{x}/{y}.pbf'
      ]
    };
  }

  @Post('clear-cache')
  async clearCache() {
    await this.pbfService.clearTileCache();
    return { success: true };
  }

  @Get('sites/:z/:x/:y.pbf')
  @ApiOperation({ summary: 'Get vector tiles for sites' })
  @ApiParam({ name: 'z', description: 'Zoom level', example: 10 })
  @ApiParam({ name: 'x', description: 'Tile X coordinate', example: 512 })
  @ApiParam({ name: 'y', description: 'Tile Y coordinate', example: 256 })
  @ApiQuery({ name: 'country', required: false, description: 'Filter by countries (comma-separated)' })
  @ApiQuery({ name: 'city', required: false, description: 'Filter by cities (comma-separated)' })
  @ApiQuery({ name: 'network', required: false, description: 'Filter by networks (comma-separated)' })
  @ApiQuery({ name: 'platform', required: false, description: 'Filter by platforms (comma-separated)' })
  async getSitesTile(
    @Param('z', ParseIntPipe) z: number,
    @Param('x', ParseIntPipe) x: number,
    @Param('y', ParseIntPipe) y: number,
    @Query() query: any,
    @Res() res: Response,
  ) {
    const filter: PbfFilter = {
      country: query.country ? query.country.split(',') : undefined,
      city: query.city ? query.city.split(',') : undefined,
      network: query.network ? query.network.split(',') : undefined,
      platform: query.platform ? query.platform.split(',') : undefined,
    };

    const buffer = await this.pbfService.getSitesPbf(z, x, y, filter);
    this.sendPbf(res, buffer);
  }

  @Get('links/:z/:x/:y.pbf')
  @ApiOperation({ summary: 'Get vector tiles for links' })
  @ApiParam({ name: 'z', description: 'Zoom level', example: 10 })
  @ApiParam({ name: 'x', description: 'Tile X coordinate', example: 512 })
  @ApiParam({ name: 'y', description: 'Tile Y coordinate', example: 256 })
  @ApiQuery({ name: 'country', required: false, description: 'Filter by countries (comma-separated)' })
  @ApiQuery({ name: 'city', required: false, description: 'Filter by cities (comma-separated)' })
  @ApiQuery({ name: 'network', required: false, description: 'Filter by networks (comma-separated)' })
  @ApiQuery({ name: 'platform', required: false, description: 'Filter by platforms (comma-separated)' })
  @ApiQuery({ name: 'linkType', required: false, description: 'Filter by link types (comma-separated)' })
  @ApiQuery({ name: 'minDistance', required: false, type: Number, description: 'Minimum link distance' })
  @ApiQuery({ name: 'maxDistance', required: false, type: Number, description: 'Maximum link distance' })
  async getLinksTile(
    @Param('z', ParseIntPipe) z: number,
    @Param('x', ParseIntPipe) x: number,
    @Param('y', ParseIntPipe) y: number,
    @Query() query: any,
    @Res() res: Response,
  ) {
    const filter: PbfFilter = {
      country: query.country ? query.country.split(',') : undefined,
      city: query.city ? query.city.split(',') : undefined,
      network: query.network ? query.network.split(',') : undefined,
      platform: query.platform ? query.platform.split(',') : undefined,
      linkType: query.linkType ? query.linkType.split(',') : undefined,
      minDistance: query.minDistance ? parseFloat(query.minDistance) : undefined,
      maxDistance: query.maxDistance ? parseFloat(query.maxDistance) : undefined,
    };

    const buffer = await this.pbfService.getLinksPbf(z, x, y, filter);
    this.sendPbf(res, buffer);
  }

  @Get('combined/:z/:x/:y.pbf')
  @ApiOperation({ summary: 'Get combined vector tiles' })
  @ApiParam({ name: 'z', description: 'Zoom level', example: 10 })
  @ApiParam({ name: 'x', description: 'Tile X coordinate', example: 512 })
  @ApiParam({ name: 'y', description: 'Tile Y coordinate', example: 256 })
  @ApiQuery({ name: 'country', required: false, description: 'Filter by countries (comma-separated)' })
  @ApiQuery({ name: 'city', required: false, description: 'Filter by cities (comma-separated)' })
  @ApiQuery({ name: 'network', required: false, description: 'Filter by networks (comma-separated)' })
  @ApiQuery({ name: 'platform', required: false, description: 'Filter by platforms (comma-separated)' })
  @ApiQuery({ name: 'linkType', required: false, description: 'Filter by link types (comma-separated)' })
  @ApiQuery({ name: 'minDistance', required: false, type: Number, description: 'Minimum link distance' })
  @ApiQuery({ name: 'maxDistance', required: false, type: Number, description: 'Maximum link distance' })
  async getCombinedTile(
    @Param('z', ParseIntPipe) z: number,
    @Param('x', ParseIntPipe) x: number,
    @Param('y', ParseIntPipe) y: number,
    @Query() query: any,
    @Res() res: Response,
  ) {
    const filter: PbfFilter = {
      country: query.country ? query.country.split(',') : undefined,
      city: query.city ? query.city.split(',') : undefined,
      network: query.network ? query.network.split(',') : undefined,
      platform: query.platform ? query.platform.split(',') : undefined,
      linkType: query.linkType ? query.linkType.split(',') : undefined,
      minDistance: query.minDistance ? parseFloat(query.minDistance) : undefined,
      maxDistance: query.maxDistance ? parseFloat(query.maxDistance) : undefined,
    };

    const buffer = await this.pbfService.getCombinedPbf(z, x, y, filter);
    this.sendPbf(res, buffer);
  }

  private sendPbf(res: Response, buffer: Buffer) {
    res.setHeader('Content-Type', 'application/vnd.mapbox-vector-tile');
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=300');
    try {
      // Convert Buffer to Uint8Array for gzipSync
      const uint8Data = Uint8Array.from(buffer);
      const compressed = zlib.gzipSync(uint8Data);
      res.send(compressed);
    } catch (err) {
      console.error('Error compressing tile:', err);
      res.status(500).send('Error compressing tile');
    }
  }



}
