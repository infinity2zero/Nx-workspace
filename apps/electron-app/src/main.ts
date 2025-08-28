import SquirrelEvents from './app/events/squirrel.events';
import ElectronEvents from './app/events/electron.events';
import UpdateEvents from './app/events/update.events';
import { app, BrowserWindow } from 'electron';
import App from './app/app';

export default class Main {
  static initialize() {
    if (SquirrelEvents.handleEvents()) {
      // squirrel event handled (except first run event) and app will exit in 1000ms, so don't do anything else
      app.quit();
    }
  }

  static bootstrapApp() {
    App.main(app, BrowserWindow);
  }

  static bootstrapAppEvents() {
    ElectronEvents.bootstrapElectronEvents();

    // initialize auto updater service
    if (!App.isDevelopmentMode()) {
      // UpdateEvents.initAutoUpdateService();
    } // This is the DEVELOPMENT block. 
    else {
      console.log('Running in Development mode: Activating hot-reloader.');
      try {
        const reloader = require('electron-reloader');
        reloader(module, {
          // Watch the compiled output of your Angular app
          watchRenderer: true,
          // A more specific path for Nx's build output
          pathToWatch: 'apps/angular-app/src'
        });
      } catch (_) { }
    }
  }
}





// handle setup events as quickly as possible
Main.initialize();

// bootstrap app
Main.bootstrapApp();
Main.bootstrapAppEvents();
