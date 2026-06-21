const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js') 
    },
    backgroundColor: '#040005',
    title: "CASHFS Management System"
  });

  // Determine path based on environment
  const indexPath = app.isPackaged 
    ? path.join(__dirname, '../dist/index.html') 
    : path.join(__dirname, '../dist/index.html');

  mainWindow.loadFile(indexPath);

  // Auto-Updater Check
  autoUpdater.checkForUpdatesAndNotify();

  mainWindow.on('closed', () => (mainWindow = null));
}

app.whenReady().then(() => {
  createWindow();
  
  // Update event listeners
  autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('update_available');
  });
  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update_downloaded');
  });
});

// Allow renderer to trigger the actual restart after download
ipcMain.on('restart_app', () => {
  autoUpdater.quitAndInstall();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});