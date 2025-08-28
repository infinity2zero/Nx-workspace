import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { DbSettingsController } from './dbsettings.controller';

@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
        files: 2,
      },
      fileFilter: (req, file, cb) => {
        // Only allow JSON files
        if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
          cb(null, true);
        } else {
          cb(new Error('Only JSON files are allowed'), false);
        }
      },
    }),
  ],
  controllers: [DbSettingsController],
})
export class DbSettingsModule { }
