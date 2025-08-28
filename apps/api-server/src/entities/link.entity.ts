import { Entity, Column, PrimaryColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum LinkType {
  NORMAL_LINK = 'NORMAL_LINK',
  INTERCONNECT = 'INTERCONNECT',
  PATCH = 'PATCH'
}

@Entity('links')
export class Link {
  @ApiProperty({ 
    example: 'LINK_000001', 
    description: 'Unique link identifier' 
  })
  @PrimaryColumn('text')
  link_id: string;

  @ApiProperty({ 
    example: 'SITE_000001', 
    description: 'Source site ID' 
  })
  @Column('text')
  site_a_id: string;

  @ApiProperty({ 
    example: 'SITE_000002', 
    description: 'Target site ID' 
  })
  @Column('text')
  site_b_id: string;

  @ApiProperty({ 
    example: 'NORMAL_LINK', 
    enum: LinkType,
    description: 'Type of network link',
    nullable: true 
  })
  @Column('text', { nullable: true })
  link_type: LinkType | null;

  @ApiProperty({ 
    example: 45.7, 
    description: 'Link distance in kilometers',
    nullable: true 
  })
  @Column('real', { nullable: true })
  link_distance: number | null;

  @ApiProperty({ 
    example: '1234', 
    description: 'KMZ number',
    nullable: true 
  })
  @Column('text', { nullable: true })
  link_kmz_no: string | null;

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

  // Virtual property for WKT geometry (handled separately for spatial queries)
  @ApiProperty({ 
    example: 'LINESTRING(-0.1278 51.5074, 2.3522 48.8566)', 
    description: 'WKT geometry representation' 
  })
  wkt?: string;

  // We'll add relations later when needed
}
