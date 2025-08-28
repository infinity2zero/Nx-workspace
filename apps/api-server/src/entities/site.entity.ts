import { Entity, Column, PrimaryColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('sites')
export class Site {
  @ApiProperty({ 
    example: 'SITE_000001', 
    description: 'Unique site identifier' 
  })
  @PrimaryColumn('text')
  site_id: string;

  @ApiProperty({ 
    example: 'Tech Solutions Inc.', 
    description: 'Virtual company name',
    nullable: true 
  })
  @Column('text', { nullable: true })
  site_virtual_name: string | null;

  @ApiProperty({ 
    example: 'London-datacenter', 
    description: 'Site name' 
  })
  @Column('text')
  site_name: string;

  @ApiProperty({ 
    example: 'United Kingdom', 
    description: 'Country',
    nullable: true 
  })
  @Column('text', { nullable: true })
  country: string | null;

  @ApiProperty({ 
    example: 'London', 
    description: 'City',
    nullable: true 
  })
  @Column('text', { nullable: true })
  city: string | null;

  @ApiProperty({ 
    example: 'Cisco ASR9000', 
    description: 'Equipment platform',
    nullable: true 
  })
  @Column('text', { nullable: true })
  platform: string | null;

  @ApiProperty({ 
    example: 'Core Backbone', 
    description: 'Network type',
    nullable: true 
  })
  @Column('text', { nullable: true })
  network: string | null;

  @ApiProperty({ 
    example: '2025-08-23T12:00:00.000Z', 
    description: 'Last modified timestamp' 
  })
  @Column('text')
  last_modified_at: string;

  @ApiProperty({ 
    example: 0, 
    description: 'Deletion flag (0=active, 1=deleted)' 
  })
  @Column('integer', { default: 0 })
  is_deleted: number;

  // Virtual properties for coordinates (from geometry column)
  @ApiProperty({ 
    example: 51.5074, 
    description: 'Latitude coordinate' 
  })
  latitude?: number;

  @ApiProperty({ 
    example: -0.1278, 
    description: 'Longitude coordinate' 
  })
  longitude?: number;

  // We'll add relations later when needed
}
