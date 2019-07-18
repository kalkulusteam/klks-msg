"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Main {
    static onWindowAllClosed() {
        if (process.platform !== 'darwin') {
            Main.application.quit();
        }
    }
    static onClose() {
        // Dereference the window object. 
        Main.mainWindow = null;
    }
    static onReady() {
        Main.mainWindow = new Main.BrowserWindow({ width: 1200, height: 700, icon: './static/assets/img/favicon.png' });
        Main.mainWindow.loadFile('./static/index.html');
        Main.mainWindow.on('closed', Main.onClose);
    }
    static main(app, browserWindow) {
        // we pass the Electron.App object and the  
        // Electron.BrowserWindow into this function 
        // so this class has no dependencies. This 
        // makes the code easier to write tests for 
        Main.BrowserWindow = browserWindow;
        Main.application = app;
        Main.application.on('window-all-closed', Main.onWindowAllClosed);
        Main.application.on('ready', Main.onReady);
    }
}
exports.default = Main;
//# sourceMappingURL=main.js.map