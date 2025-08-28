import { app, BrowserWindow, shell, screen, ipcMain } from 'electron';
import { format } from 'url';
import { environment } from '../environments/environment';
import { rendererAppName, rendererAppPort } from './constants';
import { join } from 'path';
import { fork, ChildProcess } from 'child_process';
import * as fs from 'fs';
import { log } from 'console';

export default class App {
  private static mainWindow: BrowserWindow | null = null;
  private static apiProcess: ChildProcess | null = null;

  static isDevelopmentMode(): boolean {
    if ('ELECTRON_IS_DEV' in process.env) {
      return parseInt(process.env.ELECTRON_IS_DEV, 10) === 1;
    }
    return !environment.production;
  }

  static async bootstrapApiServer() {
    const isPackaged = app.isPackaged;
    if (isPackaged) {
      console.log('🚀 Production: launching NestJS API server as a child process');
      // 1. Compute paths
      const resources = process.resourcesPath; // e.g. MyApp.app/Contents/Resources
      const sourceDbPath = join(resources, 'db', 'network.sqlite');
      const userDataPath = app.getPath('userData');
      const dbPath = join(userDataPath, 'network.sqlite');
      console.log('resourcesPath:', resources);
      console.log('sourceDbPath:', sourceDbPath);
      console.log('userDataPath:', userDataPath);
      console.log('destination dbPath:', dbPath);

      // 2. Ensure source DB exists
      if (!fs.existsSync(sourceDbPath)) {
        console.error('❌ Seed database not found:', sourceDbPath);
        app.quit();
        return;
      }

      // 3. Ensure userData folder exists
      try {
        fs.mkdirSync(userDataPath, { recursive: true });
      } catch (err) {
        console.error('❌ Could not create userData folder:', err);
      }

      // 4. Copy database if missing
      if (!fs.existsSync(dbPath)) {
        console.log('Copying seed database to userData...');
        try {
          fs.copyFileSync(sourceDbPath, dbPath);
          console.log('✅ Copied database to', dbPath);
        } catch (err) {
          console.error('❌ Error copying database:', err);
          app.quit();
          return;
        }
      } else {
        console.log('✅ Database already exists at', dbPath);
      }

      // 5. Verify read/write
      try {
        fs.accessSync(dbPath, fs.constants.R_OK | fs.constants.W_OK);
        console.log('✅ Database file is readable & writable');
      } catch (err) {
        console.error('❌ Database file permission error:', err);
        try {
          fs.chmodSync(dbPath, 0o600);
          console.log('🔧 Adjusted database permissions to 600');
        } catch (chmodErr) {
          console.error('❌ Could not change database permissions:', chmodErr);
          app.quit();
          return;
        }
      }

      // 6. Locate API server entrypoint
      const apiPath = join(resources, 'api-server', 'main.js');
      console.log('apiPath:', apiPath);
      if (!fs.existsSync(apiPath)) {
        console.error('❌ API server entry not found at', apiPath);
        app.quit();
        return;
      }

      // 7. Fork the API server
      console.log('🍴 Forking API server process...');
      try {
        this.apiProcess = fork(apiPath, [], {
          env: {
            ...process.env,
            DATABASE_PATH: dbPath,
            NODE_ENV: 'production'
          },
          stdio: ['pipe','pipe','pipe','ipc']
          
        });
      } catch (err) {
        console.error('❌ Failed to fork API server:', err);
        app.quit();
        return;
      }

      // 8. Wire up logging and health check
      this.apiProcess.stdout?.on('data', chunk => console.log('[API]', chunk.toString().trim()));
      this.apiProcess.stderr?.on('data', chunk => console.error('[API ERR]', chunk.toString().trim()));

      this.apiProcess.on('message', msg => console.log('[API MSG]', msg));
      this.apiProcess.on('error', err => console.error('[API ERROR]', err));
      this.apiProcess.on('exit', (code, signal) => console.log(`[API EXIT] code=${code} signal=${signal}`));

      // 9. Quick health probe after 3s
      setTimeout(() => {
        import('http').then(({ get }) => {
          get('http://localhost:3000/api/health', res => {
            console.log('[API HEALTH]', res.statusCode);
          }).on('error', e => console.error('[API HEALTH ERR]', e));
        });
      }, 3000);

      } else {
        // DEVELOPMENT MODE: start in-process
        console.log('🚀 Development: starting NestJS API in-process');
        try {
          const { NestFactory } = await import('@nestjs/core');
          const { AppModule } = await import('../../../api-server/src/app/app.module');
          const { ApiBootstrap } = await import('../../../api-server/src/bootstrap/api.bootstrap');

          const isDev = process.env.NODE_ENV !== 'production';
          const loggerLevels:any = isDev ? ['error','warn','log','debug','verbose','sql'] : ['error','warn'];
            
          const nestApp:any = await NestFactory.create(AppModule, { logger: loggerLevels });
          await ApiBootstrap.configureApp(nestApp);
          const port = process.env.PORT ?? 3000;
          await nestApp.listen(port);
          console.log(`✅ API Server listening on heloooooo.  http://localhost:${port}/api/health`);
          console.log('I a development enabled:', isDev);

        } catch (err) {
          console.error('❌ Failed to start in-process API Server:', err);
          app.quit();
        }
    }
  }

//   static async bootstrapApiServer() {
//   const isPackaged = app.isPackaged;

//   if (isPackaged) {
//     console.log('🚀 Production: launching NestJS API server child process');

//     const resources = process.resourcesPath;                 // e.g. /MyApp.app/Contents/Resources
//     const unpacked = join(resources, 'app.asar.unpacked');   // unpacked ASAR folder
//     const apiUnpacked = join(unpacked, 'api-server', 'main.js'); // path to real main.js in unpacked
//     const userDataPath = app.getPath('userData');
//     const dbPath = join(userDataPath, 'network.sqlite');
//     const sourceDbPath = join(resources, 'db', 'network.sqlite');

//     console.log('resourcesPath:', resources);
//     console.log('unpacked ASAR folder:', unpacked);
//     console.log('apiUnpacked main.js:', apiUnpacked);
//     console.log('userData folder:', userDataPath);
//     console.log('DB source path:', sourceDbPath);
//     console.log('DB destination path:', dbPath);

//     if (!fs.existsSync(apiUnpacked)) {
//       console.error('❌ API entrypoint not found:', apiUnpacked);
//       app.quit();
//       return;
//     }

//     if (!fs.existsSync(sourceDbPath)) {
//       console.error('❌ Seed DB not found:', sourceDbPath);
//       app.quit();
//       return;
//     }

//     try {
//       fs.mkdirSync(userDataPath, { recursive: true });
//     } catch (err) {
//       console.error('❌ Unable to create userData folder:', err);
//     }

//     if (!fs.existsSync(dbPath)) {
//       try {
//         fs.copyFileSync(sourceDbPath, dbPath);
//         console.log('✅ Copied DB to userData');
//       } catch (err) {
//         console.error('❌ Failed copying DB:', err);
//         app.quit();
//         return;
//       }
//     } else {
//       console.log('✅ DB already exists at userData');
//     }

//     try {
//       fs.accessSync(dbPath, fs.constants.R_OK | fs.constants.W_OK);
//       console.log('✅ DB file readable & writable');
//     } catch (permErr) {
//       console.error('❌ DB permission error:', permErr);
//       try {
//         fs.chmodSync(dbPath, 0o600);
//         console.log('🔧 Fixed DB permissions to 600');
//       } catch (chmodErr) {
//         console.error('❌ Failed to fix DB permissions:', chmodErr);
//         app.quit();
//         return;
//       }
//     }

//     console.log('🍴 Forking API server from unpacked path...');
//     this.apiProcess = fork(apiUnpacked, [], {
//       env: {
//         ...process.env,
//         DATABASE_PATH: dbPath,
//         NODE_ENV: 'production',
//       },
//       cwd: join(unpacked, 'api-server'),
//       stdio: ['pipe', 'pipe', 'pipe', 'ipc']
//     });

//     this.apiProcess.stdout?.on('data', d => console.log('[API]', d.toString().trim()));
//     this.apiProcess.stderr?.on('data', d => console.error('[API ERR]', d.toString().trim()));
//     this.apiProcess.on('message', msg => console.log('[API MSG]', msg));
//     this.apiProcess.on('error', err => console.error('[API ERROR]', err));
//     this.apiProcess.on('exit', (code, signal) => {
//       console.log(`[API EXIT] code=${code} signal=${signal}`);
//       this.apiProcess = null;
//     });

//     setTimeout(() => {
//       import('http').then(({ get }) => {
//         get('http://localhost:3000/api/health', res => console.log('[API HEALTH]', res.statusCode))
//           .on('error', e => console.error('[API HEALTH ERR]', e));
//       });
//     }, 3000);

//   } else {
//     // Development mode: in-process NestJS API server
//     console.log('🚀 Development: starting NestJS API in-process');
//     try {
//       const { NestFactory } = await import('@nestjs/core');
//       const { AppModule } = await import('../../../api-server/src/app/app.module');
//       const { ApiBootstrap } = await import('../../../api-server/src/bootstrap/api.bootstrap');

//       const isDev = process.env.NODE_ENV !== 'production';
//       const loggerLevels:any = isDev ? ['error', 'warn', 'log', 'debug', 'verbose'] : ['error', 'warn'];

//       const nestApp:any = await NestFactory.create(AppModule, { logger: loggerLevels });
//       await ApiBootstrap.configureApp(nestApp);

//       const port = process.env.PORT ?? 3000;
//       await nestApp.listen(port);
//       console.log(`✅ API Server listening on http://localhost:${port}/api/health`);
//     } catch (err) {
//       console.error('❌ Failed to start in-process API Server:', err);
//       app.quit();
//     }
//   }
// }



  private static createMainWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    this.mainWindow = new BrowserWindow({
      width: Math.min(1400, width),
      height: Math.min(900, height),
      minWidth: 1200,
      minHeight: 700,
      show: false,
      ...(process.platform === 'darwin'
        ? { titleBarStyle: 'hidden'  }
        : {
            titleBarStyle: 'hidden',
            titleBarOverlay: { color: '#1e293b', symbolColor: '#ffffff', height: 40 },
          }),
      webPreferences: {
        contextIsolation: true,
        backgroundThrottling: false,
        preload: join(__dirname, 'main.preload.js'),
        nodeIntegration: false,
        webSecurity: false,
      },
    });

    this.mainWindow.setMenu(null);
    this.mainWindow.setTitle('ISP Network Management');
    this.mainWindow.center();

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      console.log('🪟 Main window ready');
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
      console.log('🪟 Main window closed');
    });

    if (process.platform !== 'darwin') {
      this.mainWindow.on('maximize', () => {
        this.mainWindow?.webContents.send('window-maximized');
      });
      this.mainWindow.on('unmaximize', () => {
        this.mainWindow?.webContents.send('window-unmaximized');
      });
    }
  }

  private static loadMainWindow() {
    if (!this.mainWindow) return;
    
    const isDev = !app.isPackaged;
    // const isDev = App.isDevelopmentMode();

    if (isDev) {
      const url = `http://localhost:${rendererAppPort}`;
      this.mainWindow.loadURL(url);
      if (this.isDevelopmentMode()) {
        // alert('In development mode - opening DevTools');
        this.mainWindow.webContents.openDevTools();
      }
    } else {
      const fileUrl = format({
        pathname: join(__dirname, '..', rendererAppName, 'index.html'),
        protocol: 'file:',
        slashes: true,
      });
      this.mainWindow.loadURL(fileUrl);
    }
  }

  private static onReady() {
    console.log('📱 Electron ready event fired');
    this.createMainWindow();
    this.loadMainWindow();
    this.bootstrapApiServer();

  }

  private static onWindowAllClosed() {
    console.log('🚪 All windows closed');
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }

  private static onActivate() {
    console.log('🔄 App activated');
    if (!this.mainWindow) {
      this.createMainWindow();
      this.loadMainWindow();
    }
  }

  // ⭐ SETUP IPC HANDLERS ONLY ONCE IN MAIN METHOD
  private static setupIpcHandlers() {
    console.log('🔧 Setting up IPC handlers...');
    
    // Remove any existing handlers to prevent duplicates
    try {
      ipcMain.removeHandler('get-platform');
      ipcMain.removeHandler('get-app-version');
      ipcMain.removeHandler('open-external');
      ipcMain.removeHandler('show-item-in-folder');
      if (process.platform !== 'darwin') {
        ipcMain.removeHandler('window-minimize');
        ipcMain.removeHandler('window-maximize');
        ipcMain.removeHandler('window-unmaximize');
        ipcMain.removeHandler('window-close');
      }
    } catch (e) {
      // Ignore errors if handlers don't exist
    }

    // Register handlers
    if (process.platform !== 'darwin') {
      ipcMain.handle('window-minimize', () => {
        console.log('📉 Minimizing window');
        this.mainWindow?.minimize();
      });
      ipcMain.handle('window-maximize', () => {
        console.log('📈 Maximizing window');
        this.mainWindow?.maximize();
      });
      ipcMain.handle('window-unmaximize', () => {
        console.log('📉 Restoring window');
        this.mainWindow?.unmaximize();
      });
      ipcMain.handle('window-close', () => {
        console.log('❌ Closing window');
        this.mainWindow?.close();
      });
    }

    ipcMain.handle('get-platform', () => {
      console.log('🔍 Getting platform:', process.platform);
      return process.platform;
    });
    
    ipcMain.handle('get-app-version', () => {
      const version = app.getVersion();
      console.log('📋 Getting app version:', version);
      return version;
    });
    
    ipcMain.handle('open-external', (_e, url: string) => {
      console.log('🌐 Opening external URL:', url);
      return shell.openExternal(url);
    });
    
    ipcMain.handle('show-item-in-folder', (_e, fullPath: string) => {
      console.log('📁 Showing item in folder:', fullPath);
      return shell.showItemInFolder(fullPath);
    });

    console.log('✅ IPC handlers set up successfully');
  }

  static main(electronApp: Electron.App,BrowserWindow) {
    console.log('🚀 Electron App starting...');
    console.log(`📍 Platform: ${process.platform}`);
    console.log(`🏗️  Architecture: ${process.arch}`);
    console.log(`📦 Packaged: ${electronApp.isPackaged}`);

    // ⭐ SETUP IPC HANDLERS ONCE AT STARTUP
    this.setupIpcHandlers();

    // Setup event listeners
    electronApp.on('ready', this.onReady.bind(this));
    electronApp.on('window-all-closed', this.onWindowAllClosed.bind(this));
    electronApp.on('activate', this.onActivate.bind(this));
    
    electronApp.on('before-quit', () => {
      console.log('🚪 App about to quit');
    });

    console.log('✅ Event listeners registered');
  }
}
