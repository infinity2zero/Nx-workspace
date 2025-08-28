// import { TypeOrmModuleOptions } from '@nestjs/typeorm';
// import { join } from 'path';
// import { platform } from 'os';
// import { existsSync } from 'fs';
// import { Site } from '../entities/site.entity';
// import { Link } from '../entities/link.entity';
// import { Connection } from 'typeorm';

// // Function to get the correct SpatiaLite extension path
// function getSpatiaLiteExtensionPath(): string {
//     const currentPlatform = platform();
//     const isPackaged = !process.env['NODE_ENV'] || process.env['NODE_ENV'] === 'production';

//     let platformFolder: string;
//     let extensionFile: string;

//     // Determine platform-specific path
//     switch (currentPlatform) {
//         case 'darwin':
//             // Check if running on Apple Silicon or Intel
//             const arch = process.arch === 'arm64' ? 'mac-arm64' : 'mac-x64';
//             platformFolder = arch;
//             extensionFile = 'mod_spatialite.dylib';
//             break;
//         case 'win32':
//             platformFolder = 'win-x64';
//             extensionFile = 'mod_spatialite.dll';
//             break;
//         case 'linux':
//             platformFolder = 'linux-x64';
//             extensionFile = 'mod_spatialite.so';
//             break;
//         default:
//             console.warn(`Unsupported platform: ${currentPlatform}`);
//             return null;
//     }

//     // Construct the path to the extension
//     const extensionPath = isPackaged
//         ? join((process as any).resourcesPath, 'resources', platformFolder, extensionFile)
//         : join(process.cwd(), 'resources', platformFolder, extensionFile);

//     console.log(`🔍 Looking for SpatiaLite extension at: ${extensionPath}`);

//     if (existsSync(extensionPath)) {
//         console.log(`✅ Found SpatiaLite extension: ${extensionPath}`);
//         return extensionPath;
//     } else {
//         console.warn(`⚠️  SpatiaLite extension not found at: ${extensionPath}`);
//         return null;
//     }
// }

// export const databaseConfig: TypeOrmModuleOptions = {
//     type: 'sqlite',
//     database: join(process.cwd(), 'db/network.sqlite'),
//     entities: [Site, Link],
//     autoLoadEntities: true,
//     synchronize: false,
//     logging: process.env['NODE_ENV'] === 'development' ? ['error', 'warn', 'query'] : ['error'],

//     cache: {
//         duration: 30000,
//     },

//     extra: {
//         pragma: {
//             foreign_keys: 'ON',
//             journal_mode: 'WAL',
//         },
//     },

//     // Custom initialization to load SpatiaLite
//     dropSchema: false,
//     migrationsRun: false,

//     // We'll handle SpatiaLite loading in the connection
// };

// // Export function to initialize SpatiaLite after connection

// export async function initializeSpatiaLite(connection: Connection) {
//     const sqliteDriver = (connection.driver as any).databaseConnection;
//     const extensionPath = getSpatiaLiteExtensionPath();
//     if (!extensionPath) return false;

//     try {
//         // 1. Enable extension loading
//         await new Promise<void>((res, rej) =>
//             sqliteDriver.run('PRAGMA load_extension = 1;', (err) =>
//                 err ? rej(err) : res(),
//             ),
//         );

//         // 2. Actually load it
//         await new Promise<void>((res, rej) =>
//             sqliteDriver.loadExtension(extensionPath, (err) =>
//                 err ? rej(err) : res(),
//             ),
//         );
//         console.log('✅ SpatiaLite extension loaded');

//         // 3. Test it
//         // 1. Query with alias
//         const rows: Array<{ version: string }> =
//             await connection.query('SELECT spatialite_version() AS version');

//         // 2. Pull out the first row safely
//         if (rows.length) {
//             const version = rows[0].version;
//             console.log(`📍 SpatiaLite version: ${version}`);
//         } else {
//             console.warn('⚠️ No SpatiaLite version returned');
//         }

//         return true;
//     } catch (e) {
//         console.warn('⚠️ Failed to load SpatiaLite extension:', e.message);
//         return false;
//     }
// }

