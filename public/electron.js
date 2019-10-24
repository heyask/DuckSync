const electron = require("electron");
const fs = require("fs");
const path = require("path");
const exec = require("child_process").exec;
const isDev = require("electron-is-dev");
const md5 = require("md5");
const watchman = require("fb-watchman");
const app = electron.app;
const ipcMain = electron.ipcMain;
const dialog = electron.dialog;
const BrowserWindow = electron.BrowserWindow;
const client = new watchman.Client({
  watchmanBinaryPath: "/usr/local/bin/watchman"
});
let mainWindow;
let dirs = [];

function addWatchList(dir) {
  const subscriptionName = md5(dir.from);
  dirs.push({
    from: dir.from,
    to: dir.to,
    subscriptionName
  });
  saveWatchData(dirs);
}
function removeWatchList(dir) {
  const foundIdx = dirs.findIndex(item => item.from === dir.from);
  if (foundIdx > -1) dirs.splice(foundIdx, 1);
  saveWatchData(dirs);
}
function saveWatchData(dirs) {
  fs.writeFileSync(
    app.getPath("userData") + "/watch-dirs.json",
    JSON.stringify(dirs),
    "utf8"
  );
}

async function initWatcher() {
  try {
    dirs = JSON.parse(
      fs.readFileSync(app.getPath("userData") + "/watch-dirs.json")
    );
    saveWatchData(dirs);
  } catch (e) {
    dirs = [];
  }

  client.capabilityCheck(
    { optional: [], required: ["relative_root"] },
    async function(error, resp) {
      if (error) {
        console.log(error);
        client.end();
        return;
      }

      // Initiate the watch
      await dirs.map(async item => {
        const respWatch = await watchmanCommandAsync([
          "watch-project",
          item.from
        ]);

        const respClock = await watchmanCommandAsync([
          "clock",
          respWatch.watch
        ]);
        let sub = {
          expression: ["allof", ["match", "*"]],
          fields: ["name", "size", "mtime_ms", "exists", "type"],
          since: respClock.clock,
          relative_root: respWatch.relative_path
        };

        await watchmanCommandAsync([
          "subscribe",
          respWatch.watch,
          item.subscriptionName,
          sub
        ]);

        console.log(
          "watch established on ",
          respWatch.watch,
          ", relative_path: ",
          respWatch.relative_path
        );
      });

      mainWindow.webContents.send("getDirs", dirs);

      // on file system changed
      client.on("subscription", async function(resp) {
        let files = resp.files.map(file =>
          file.name.substring(0, file.name.lastIndexOf("/") + 1)
        );
        files.sort((a, b) => {
          a = a.toUpperCase();
          b = b.toUpperCase();
          if (a > b) return -1;
          if (a < b) return 1;

          return 0;
        });

        const foundDir = dirs.find(item => item.from === resp.root);
        await sync(foundDir);
      });
    }
  );
}

async function syncAll(dirs) {
  mainWindow.webContents.send("syncAllStart");

  for (const dir of dirs) {
    await sync(dir);
  }
  mainWindow.webContents.send("syncAllEnd");
}

async function sync(dir) {
  mainWindow.webContents.send("syncStart", dir.from);
  await execRsync(dir.from + "/", dir.to + "/");
  mainWindow.webContents.send("syncEnd", dir.to);
}

async function execRsync(fromDir, toDir) {
  console.log("===rsync start===");
  const command = "rsync -az --delete '" + fromDir + "' '" + toDir + "'";
  const result = await execAsync(command);
  console.log("===rsync done===");
  return result;
}

function execAsync(command) {
  return new Promise(function(resolve, reject) {
    exec(command, (error, stdout, stderr) => {
      resolve(stdout, stderr);
      if (error !== null) {
        reject(error);
      }
    });
  });
}

function watchmanCommandAsync(arr) {
  return new Promise(function(resolve, reject) {
    client.command(arr, function(error, resp) {
      if (error) {
        console.error("Error initiating watch:", error);
        reject(error);
        return;
      }

      if ("warning" in resp) {
        console.log("warning: ", resp.warning);
      }

      resolve(resp);
    });
  });
}

async function onAppExit() {
  await dirs.map(async item => {
    const result = await watchmanCommandAsync([
      "unsubscribe",
      item.from,
      item.subscriptionName
    ]);
    console.log("unsubscribe result: " + result);
  });
  await client.command(["watch-del-all"]);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    // x: 0,
    // y: 1500,
    width: 900,
    height: 680,
    webPreferences: {
      nodeIntegration: true
    }
  });
  mainWindow.loadURL(
    isDev
      ? "http://localhost:3000"
      : `file://${path.join(__dirname, "../build/index.html")}`
  );
  if (isDev) {
    // Open the DevTools.
    //BrowserWindow.addDevToolsExtension('<location to your react chrome extension>');
    // mainWindow.webContents.openDevTools();
  } else {
    // mainWindow.webContents.openDevTools();
  }
  mainWindow.on("closed", () => (mainWindow = null));
}

app.on("ready", () => {
  createWindow();
  initWatcher();

  ipcMain.on("componentDidMount", async (event, arg) => {
    event.sender.send("getDirs", dirs);
  });
  ipcMain.on("syncAll", async (event, arg) => {
    await syncAll(dirs);
  });
  ipcMain.on("sync", async (event, fromDir) => {
    const foundDir = dirs.find(item => item.from === fromDir);
    await sync(foundDir);
  });
  ipcMain.on("selectDir", async (event, arg) => {
    dialog
      .showOpenDialog(mainWindow, {
        properties: ["openDirectory"]
      })
      .then(result => {
        if (!result.canceled) {
          event.sender.send("selectDirResult", {
            filePath: result.filePaths[0],
            type: arg
          });
        }
      })
      .catch(err => {
        console.log(err);
      });
  });
  ipcMain.on("addWatch", async (event, arg) => {
    await onAppExit();
    addWatchList(arg);
    await initWatcher();
    event.sender.send("reload");
  });
  ipcMain.on("removeWatch", async (event, arg) => {
    await onAppExit();
    removeWatchList(arg);
    await initWatcher();
    event.sender.send("reload");
  });
});

app.on("window-all-closed", () => {
  console.log("window-all-closed. platform:" + process.platform);
  app.quit();
});
app.on("will-quit", async () => {
  await onAppExit();
  console.log("app will quit:" + process.platform);
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
