// import { 
//   Controller, 
//   Get, 
//   Post, 
//   Delete, 
//   Body, 
//   Param, 
//   UseInterceptors, 
//   UploadedFiles,
//   BadRequestException,
//   Logger
// } from '@nestjs/common';
// import { FilesInterceptor } from '@nestjs/platform-express';
// import { DbSettingsService, DatabaseInfo } from './dbsettings.service';
// import { ApiTags } from '@nestjs/swagger';

// // Add this interface to define the file type
// interface UploadedFile {
//   fieldname: string;
//   originalname: string;
//   encoding: string;
//   mimetype: string;
//   buffer: Buffer;
//   size: number;
// }

// interface CreateDatabaseDto {
//   dbName: string;
//   sitesData: any[];
//   linksData: any[];
// }
// @ApiTags('dbsettings')
// @Controller('api/dbsettings')
// export class DbSettingsController {
//   private readonly logger = new Logger(DbSettingsController.name);

//   constructor(private readonly databaseService: DbSettingsService) {}

//   @Get('databases')
//   async getDatabases(): Promise<DatabaseInfo[]> {
//     return this.databaseService.getAllDatabases();
//   }

//   @Post('database/switch/:dbName')
//   async switchDatabase(@Param('dbName') dbName: string): Promise<{ success: boolean; message: string }> {
//     const success = await this.databaseService.switchDatabase(dbName);
//     return {
//       success,
//       message: success ? `Switched to ${dbName}` : `Failed to switch to ${dbName}`
//     };
//   }

//   @Delete('database/:dbName')
//   async deleteDatabase(@Param('dbName') dbName: string): Promise<{ success: boolean; message: string }> {
//     try {
//       const success = await this.databaseService.deleteDatabase(dbName);
//       return {
//         success,
//         message: success ? `Deleted ${dbName}` : `Failed to delete ${dbName}`
//       };
//     } catch (error) {
//       return {
//         success: false,
//         message: error.message
//       };
//     }
//   }

//   @Post('database/create')
//   @UseInterceptors(FilesInterceptor('files', 2))
//   async createDatabase(
//     @UploadedFiles() files: UploadedFile[], // Use our custom interface
//     @Body('dbName') dbName: string
//   ): Promise<{ success: boolean; message: string }> {
//     try {
//       if (!files || files.length !== 2) {
//         throw new BadRequestException('Please upload both sites.json and links.json files');
//       }

//       if (!dbName || !dbName.trim()) {
//         throw new BadRequestException('Database name is required');
//       }

//       // Ensure .sqlite extension
//       const sanitizedDbName = dbName.trim().endsWith('.sqlite') 
//         ? dbName.trim() 
//         : `${dbName.trim()}.sqlite`;

//       let sitesData = [];
//       let linksData = [];

//       for (const file of files) {
//         try {
//           const content = JSON.parse(file.buffer.toString('utf8'));
          
//           if (file.originalname.toLowerCase().includes('sites')) {
//             sitesData = Array.isArray(content) ? content : [];
//           } else if (file.originalname.toLowerCase().includes('links')) {
//             linksData = Array.isArray(content) ? content : [];
//           }
//         } catch (parseError) {
//           throw new BadRequestException(`Invalid JSON in file ${file.originalname}`);
//         }
//       }

//       if (sitesData.length === 0 && linksData.length === 0) {
//         throw new BadRequestException('No valid data found in uploaded files');
//       }

//       const success = await this.databaseService.createDatabaseFromJson(
//         sanitizedDbName,
//         sitesData,
//         linksData
//       );

//       return {
//         success,
//         message: success 
//           ? `Database ${sanitizedDbName} created successfully with ${sitesData.length} sites and ${linksData.length} links`
//           : `Failed to create database ${sanitizedDbName}`
//       };
//     } catch (error) {
//       this.logger.error('Create database error:', error);
//       return {
//         success: false,
//         message: error.message || 'Failed to create database'
//       };
//     }
//   }
// }

import { 
  Controller, 
  Get, 
  Post, 
  Delete, 
  Body, 
  Param, 
  UseInterceptors, 
  UploadedFiles,
  BadRequestException,
  Logger
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { DbSettingsService, DatabaseInfo } from './dbsettings.service';
import { ApiTags } from '@nestjs/swagger';

interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}
@ApiTags('dbsettings')
@Controller('api/dbsettings')
export class DbSettingsController {
  private readonly logger = new Logger(DbSettingsController.name);

  constructor(private readonly databaseService: DbSettingsService) {}

  @Get('databases')
  async getDatabases(): Promise<DatabaseInfo[]> {
    return this.databaseService.getAllDatabases();
  }

  @Get('current-database')
  async getCurrentDatabase(): Promise<{ name: string; hasSpatial: boolean }> {
    const currentName = this.databaseService.getCurrentDatabaseName();
    const databases = await this.databaseService.getAllDatabases();
    const currentDb = databases.find(db => db.name === currentName);
    
    return {
      name: currentName,
      hasSpatial: currentDb?.hasSpatial || false
    };
  }

  @Post('database/switch/:dbName')
  async switchDatabase(@Param('dbName') dbName: string): Promise<{ success: boolean; message: string }> {
    const success = await this.databaseService.switchDatabase(dbName);
    return {
      success,
      message: success ? `Switched to ${dbName}` : `Failed to switch to ${dbName}`
    };
  }

  @Delete('database/:dbName')
  async deleteDatabase(@Param('dbName') dbName: string): Promise<{ success: boolean; message: string }> {
    try {
      const success = await this.databaseService.deleteDatabase(dbName);
      return {
        success,
        message: success ? `Deleted ${dbName}` : `Failed to delete ${dbName}`
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  @Post('database/create')
  @UseInterceptors(FilesInterceptor('files', 2))
  async createDatabase(
    @UploadedFiles() files: UploadedFile[],
    @Body('dbName') dbName: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Received files: ${files?.length || 0}`);
      this.logger.log(`Database name: ${dbName}`);

      if (!files || files.length === 0) {
        throw new BadRequestException('Please upload at least one JSON file');
      }

      if (!dbName || !dbName.trim()) {
        throw new BadRequestException('Database name is required');
      }

      const sanitizedDbName = dbName.trim().endsWith('.sqlite') 
        ? dbName.trim() 
        : `${dbName.trim()}.sqlite`;

      let sitesData = [];
      let linksData = [];
      let filesProcessed = 0;

      for (const file of files) {
        this.logger.log(`Processing file: ${file.originalname}, size: ${file.size}`);
        
        try {
          // Check if buffer exists
          if (!file.buffer) {
            this.logger.error(`File ${file.originalname} has no buffer`);
            throw new BadRequestException(`File ${file.originalname} could not be read`);
          }

          // Convert buffer to string safely
          const fileContent = file.buffer.toString('utf8');
          this.logger.log(`File content length: ${fileContent.length}`);
          
          if (!fileContent || fileContent.trim().length === 0) {
            throw new BadRequestException(`File ${file.originalname} is empty`);
          }

          // Parse JSON
          const content = JSON.parse(fileContent);
          
          if (file.originalname.toLowerCase().includes('sites')) {
            sitesData = Array.isArray(content) ? content : [];
            this.logger.log(`Processed sites file: ${sitesData.length} records`);
            
            if (sitesData.length > 0) {
              const sample = sitesData[0];
              if (sample.latitude === undefined || sample.longitude === undefined) {
                throw new BadRequestException('Sites data must contain latitude and longitude fields');
              }
              
              // Validate numeric values
              if (typeof sample.latitude !== 'number' || typeof sample.longitude !== 'number') {
                throw new BadRequestException('Latitude and longitude must be numeric values');
              }
            }
            filesProcessed++;
          } else if (file.originalname.toLowerCase().includes('links')) {
            linksData = Array.isArray(content) ? content : [];
            this.logger.log(`Processed links file: ${linksData.length} records`);
            
            if (linksData.length > 0) {
              const sample = linksData[0];
              if (!sample.link_wkt) {
                this.logger.warn('Links data missing link_wkt field - geometry column will be empty');
              } else {
                // Validate WKT format (basic check)
                if (typeof sample.link_wkt !== 'string' || !sample.link_wkt.startsWith('LINESTRING')) {
                  this.logger.warn(`Invalid WKT format in link: ${sample.link_id}`);
                }
              }
            }
            filesProcessed++;
          } else {
            this.logger.warn(`Unrecognized file: ${file.originalname}`);
          }
        } catch (parseError) {
          this.logger.error(`JSON parse error in ${file.originalname}:`, parseError);
          throw new BadRequestException(`Invalid JSON in file ${file.originalname}: ${parseError.message}`);
        }
      }

      if (filesProcessed === 0) {
        throw new BadRequestException('No valid sites.json or links.json files found');
      }

      if (sitesData.length === 0 && linksData.length === 0) {
        throw new BadRequestException('No valid data found in uploaded files');
      }

      this.logger.log(`Creating database with ${sitesData.length} sites and ${linksData.length} links`);

      const success = await this.databaseService.createDatabaseFromJson(
        sanitizedDbName,
        sitesData,
        linksData
      );

      return {
        success,
        message: success 
          ? `Database ${sanitizedDbName} created successfully with ${sitesData.length} sites and ${linksData.length} links (spatial support enabled)`
          : `Failed to create database ${sanitizedDbName}`
      };
    } catch (error) {
      this.logger.error('Create database error:', error.stack || error);
      return {
        success: false,
        message: error.message || 'Failed to create database'
      };
    }
  }

  @Post('database/test-spatial/:dbName')
  async testSpatialSupport(@Param('dbName') dbName: string): Promise<{ success: boolean; message: string; results?: any }> {
    try {
      const originalDb = this.databaseService.getCurrentDatabaseName();
      await this.databaseService.switchDatabase(dbName);
      
      const db = this.databaseService.getCurrentDatabase();
      const tests = [];
      
      try {
        const versionResult = db.prepare('SELECT spatialite_version() AS version').get();
        tests.push({ test: 'SpatiaLite Version', result: versionResult });
      } catch (e) {
        tests.push({ test: 'SpatiaLite Version', error: e.message });
      }

      try {
        const sitesSpatial = db.prepare('SELECT COUNT(*) as count FROM sites WHERE geometry IS NOT NULL').get();
        tests.push({ test: 'Sites with Geometry', result: sitesSpatial });
      } catch (e) {
        tests.push({ test: 'Sites with Geometry', error: e.message });
      }

      try {
        const linksSpatial = db.prepare('SELECT COUNT(*) as count FROM links WHERE geometry IS NOT NULL').get();
        tests.push({ test: 'Links with Geometry', result: linksSpatial });
      } catch (e) {
        tests.push({ test: 'Links with Geometry', error: e.message });
      }

      if (originalDb !== dbName) {
        await this.databaseService.switchDatabase(originalDb);
      }

      return {
        success: true,
        message: 'Spatial tests completed',
        results: tests
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}


