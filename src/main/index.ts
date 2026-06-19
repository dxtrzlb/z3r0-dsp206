import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { registerIpc } from './ipc';
import { startServer, type ServerHandle } from './server';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'z3r0 DSP 206',
    backgroundColor: '#0e0f13',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

const { session, hub } = registerIpc(() => mainWindow);

let server: ServerHandle | null = null;
// Expose the pairing code + port so the renderer can show "pair your iPad" details.
ipcMain.handle('dsp:serverInfo', () => (server ? { port: server.port, code: server.code } : null));

app.whenReady().then(async () => {
  createWindow();
  try {
    server = await startServer(hub);
    console.log(`[z3r0] LAN server on :${server.port} — pairing code ${server.code}`);
  } catch (err) {
    console.error('[z3r0] LAN server failed to start:', err);
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Release the USB handle and close the server before the app exits (§1 mutual exclusion).
app.on('before-quit', async () => {
  session.disconnect();
  await server?.close();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
