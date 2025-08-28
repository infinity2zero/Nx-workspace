import { join } from 'path';
import { platform } from 'os';
import { existsSync } from 'fs';

export function getSpatiaLiteExtensionPath(): string {
    const currentPlatform = platform();
    const isPackaged = !process.env['NODE_ENV'] || process.env['NODE_ENV'] === 'production';

    let platformFolder: string;
    let extensionFile: string;

    // Determine platform-specific path
    switch (currentPlatform) {
        case 'darwin':
            // Check if running on Apple Silicon or Intel
            const arch = process.arch === 'arm64' ? 'mac-arm64' : 'mac-x64';
            platformFolder = arch;
            extensionFile = 'mod_spatialite.dylib';
            break;
        case 'win32':
            platformFolder = 'win-x64';
            extensionFile = 'mod_spatialite.dll';
            break;
        case 'linux':
            platformFolder = 'linux-x64';
            extensionFile = 'mod_spatialite.so';
            break;
        default:
            console.warn(`Unsupported platform: ${currentPlatform}`);
            return null;
    }

    // Construct the path to the extension
    const extensionPath = isPackaged
        ? join((process as any).resourcesPath, 'resources', platformFolder, extensionFile)
        : join(process.cwd(), 'resources', platformFolder, extensionFile);

    console.log(`🔍 Looking for SpatiaLite extension at: ${extensionPath}`);

    if (existsSync(extensionPath)) {
        console.log(`✅ Found SpatiaLite extension: ${extensionPath}`);
        return extensionPath;
    } else {
        console.warn(`⚠️  SpatiaLite extension not found at: ${extensionPath}`);
        return null;
    }
}
// import { join } from 'path';
// import { platform } from 'os';
// import { existsSync } from 'fs';

// export function getSpatiaLiteExtensionPath(): string {
//     // This is the correct way to check if the app is packaged.
//     // 'process.resourcesPath' only exists in a packaged Electron app.
//     const isPackaged = 'resourcesPath' in process;

//     const currentPlatform = platform();
//     let platformFolder: string;
//     let extensionFile: string;

//     // This platform-specific logic is correct.
//     switch (currentPlatform) {
//         case 'darwin':
//             const arch = process.arch === 'arm64'? 'mac-arm64' : 'mac-x64';
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

//     // This path construction is now reliable for both environments.
//     const extensionPath = isPackaged
//        ? join((process as any).resourcesPath, 'resources', platformFolder, extensionFile)
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