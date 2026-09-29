# Checkpoint 5 — Electron Shell: Plan

## Goal

Create an Electron shell that wraps `apps/web`'s build output and talks to `apps/server` over HTTP.

## Spec

- Wraps `apps/web`'s built output (Vite build → `dist/`)
- Points at the same `apps/server` API as the browser
- Does NOT embed its own copy of the server
- Packaged with `electron-builder`

## Implementation

### 1. `apps/desktop/package.json`

```json
{
  "name": "@dms/desktop",
  "version": "0.0.0",
  "private": true,
  "main": "dist/main.js",
  "scripts": {
    "dev": "concurrently \"pnpm --filter web run dev\" \"wait-on http://localhost:5173 && electron .\"",
    "build": "tsc",
    "dist": "electron-builder",
    "dist:dir": "electron-builder --dir"
  },
  "dependencies": {
    "@dms/web": "workspace:*"
  },
  "devDependencies": {
    "electron": "^30.0.0",
    "electron-builder": "^24.0.0",
    "concurrently": "^8.0.0",
    "wait-on": "^7.0.0",
    "typescript": "^5"
  },
  "build": {
    "appId": "com.inventioo.dms",
    "productName": "Inventioo DMS",
    "files": [
      "dist/**/*",
      "node_modules/**/*"
    ],
    "directories": {
      "output": "release"
    },
    "win": {
      "target": "nsis"
    },
    "mac": {
      "target": "dmg"
    },
    "linux": {
      "target": "AppImage"
    }
  }
}
```

### 2. `apps/desktop/src/main.ts`

```typescript
import { app, BrowserWindow } from "electron";
import * as path from "path";
import isDev from "electron-is-dev";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // Load the built web app
    const webDistPath = path.join(__dirname, "../../web/dist");
    mainWindow.loadFile(path.join(webDistPath, "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
```

### 3. `apps/desktop/src/preload.ts`

```typescript
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
  },
  // Add any IPC methods here as needed
  ipc: {
    invoke: (channel: string, ...args: any[]) => {
      const validChannels = ["app:version", "app:quit"];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
      throw new Error(`Invalid IPC channel: ${channel}`);
    },
  },
});
```

### 4. `apps/desktop/electron-builder.yml`

```yaml
appId: com.inventioo.dms
productName: Inventioo DMS
directories:
  output: release
  buildResources: build
files:
  - dist/**/*
  - node_modules/**/*
  - package.json
win:
  target:
    - target: nsis
      arch:
        - x64
  artifactName: ${productName}-Setup-${version}.${ext}
mac:
  target:
    - target: dmg
      arch:
        - x64
        - arm64
  artifactName: ${productName}-${version}-${arch}.${ext}
linux:
  target:
    - target: AppImage
      arch:
        - x64
  artifactName: ${productName}-${version}.${ext}
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
```

### 5. `apps/desktop/tsconfig.json`

```json
{
  "extends": "@dms/config-typescript/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "module": "commonjs",
    "target": "ES2022"
  },
  "include": ["src/**/*"]
}
```

## Build Order

1. `apps/web` builds first (Vite → `dist/`)
2. `apps/desktop` copies/serves the built files
3. `electron-builder` packages the app

## Verification

- `pnpm --filter desktop run dev` opens Electron window with the web app
- `pnpm --filter desktop run build` compiles TypeScript
- `pnpm --filter desktop run dist` creates installable package
- App cold start ≤ 3s (fitness function #6)
- All API calls work the same as in the browser
