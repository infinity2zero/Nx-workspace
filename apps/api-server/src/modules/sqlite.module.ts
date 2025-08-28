import { Module, Global, DynamicModule } from '@nestjs/common';
import { DbSettingsService } from './dbsettings/dbsettings.service';

export const SQLITE_CONNECTION = 'SQLITE_CONNECTION';

@Global()
@Module({})
export class SqliteModule {
  static forRoot(): DynamicModule {
    return {
      module: SqliteModule,
      providers: [
        DbSettingsService,
        {
          provide: SQLITE_CONNECTION,
          useFactory: (databaseService: DbSettingsService) => {
            return databaseService.getCurrentDatabase();
          },
          inject: [DbSettingsService],
        },
      ],
      exports: [DbSettingsService, SQLITE_CONNECTION],
    };
  }
}


