import { IsString, IsOptional, IsArray, IsNumber, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PathfindingFiltersDto {
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  country?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  city?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platform?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  network?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeNodes?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeLinks?: string[];
}

export class PathfindingRequestDto {
  @ApiProperty()
  @IsString()
  source: string;

  @ApiProperty()
  @IsString()
  destination: string;

  @ApiProperty({ enum: ['dijkstra', 'astar', 'k-shortest', 'disjoint'] })
  @IsEnum(['dijkstra', 'astar', 'k-shortest', 'disjoint'])
  algorithm: 'dijkstra' | 'astar' | 'k-shortest' | 'disjoint';

  @ApiProperty({ required: false })
  @IsOptional()
  options?: any;

  @ApiProperty({ required: false, type: PathfindingFiltersDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PathfindingFiltersDto)
  filters?: PathfindingFiltersDto;
}

export class QoSConstraintsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  maxLatency?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  minBandwidth?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  maxJitter?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  minReliability?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  maxPacketLoss?: number;
}

export class QoSRoutingDto {
  @ApiProperty()
  @IsString()
  source: string;

  @ApiProperty()
  @IsString()
  destination: string;

  @ApiProperty({ type: QoSConstraintsDto })
  @ValidateNested()
  @Type(() => QoSConstraintsDto)
  constraints: QoSConstraintsDto;

  @ApiProperty({ enum: ['cost', 'latency', 'bandwidth', 'reliability', 'composite'] })
  @IsEnum(['cost', 'latency', 'bandwidth', 'reliability', 'composite'])
  optimizationGoal: 'cost' | 'latency' | 'bandwidth' | 'reliability' | 'composite';

  @ApiProperty({ required: false, type: PathfindingFiltersDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PathfindingFiltersDto)
  filters?: PathfindingFiltersDto;
}

export class TrafficDemandDto {
  @ApiProperty()
  @IsString()
  source: string;

  @ApiProperty()
  @IsString()
  destination: string;

  @ApiProperty()
  @IsNumber()
  demand: number;

  @ApiProperty()
  @IsNumber()
  priority: number;
}

export class TrafficEngineeringDto {
  @ApiProperty({ type: [TrafficDemandDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrafficDemandDto)
  demands: TrafficDemandDto[];

  @ApiProperty({ enum: ['minimize-congestion', 'maximize-utilization', 'balance-load'] })
  @IsEnum(['minimize-congestion', 'maximize-utilization', 'balance-load'])
  objective: 'minimize-congestion' | 'maximize-utilization' | 'balance-load';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  timeWindow?: number;

  @ApiProperty({ required: false, type: PathfindingFiltersDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PathfindingFiltersDto)
  filters?: PathfindingFiltersDto;
}