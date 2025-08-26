const { app, BrowserWindow, ipcMain } = require('electron');
const { exec } = require('child_process');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// --- helpers ---
// --- helpers ---
const reg = require('native-reg');

// Утилита: берёт значение (строкой) из открытого ключа; пустая строка, если нет
function getStr(hkey, valueName) {
  try {
    const val = reg.queryValue(hkey, valueName);        // форматированное чтение текущего ключа
    return reg.parseValue(val) ?? '';                    // в строку/число/…; null -> ''
  } catch {
    return '';
  }
}

function openQoSRoot(view) {
  // view: '64' | '32'
  const access =
    reg.Access.READ |
    (view === '64' ? reg.Access.WOW64_64KEY : reg.Access.WOW64_32KEY);

  const root = reg.openKey(
    reg.HKLM,
    'Software\\Policies\\Microsoft\\Windows\\QoS',
    access
  );
  return root; // может быть null, если раздела нет
}

async function collectQosPolicies() {
  const results = [];

  for (const view of ['64', '32']) {
    const root = openQoSRoot(view);
    if (!root) continue;

    // Список правил = имена подключей под QoS
    const ruleNames = reg.enumKeyNames(root); // ['app', 'rule2', ...]
    for (const rule of ruleNames) {
      const access =
        reg.Access.READ |
        (view === '64' ? reg.Access.WOW64_64KEY : reg.Access.WOW64_32KEY);

      const hRule = reg.openKey(root, rule, access);
      if (!hRule) continue;

      const item = {
        hive: 'HKLM',
        regView: view,
        Rule: rule,
        ApplicationName: getStr(hRule, 'Application Name'),
        DSCPValue: String(getStr(hRule, 'DSCP Value')),
        ThrottleRate: String(getStr(hRule, 'Throttle Rate')),
        Protocol: getStr(hRule, 'Protocol'),
        LocalIP: getStr(hRule, 'Local IP'),
        LocalIPPrefixLen: String(getStr(hRule, 'Local IP Prefix Length')),
        LocalPort: getStr(hRule, 'Local Port'),
        RemoteIP: getStr(hRule, 'Remote IP'),
        RemoteIPPrefixLen: String(getStr(hRule, 'Remote IP Prefix Length')),
        RemotePort: getStr(hRule, 'Remote Port'),
        Version: getStr(hRule, 'Version'),
        keyPath: `HKLM\\Software\\Policies\\Microsoft\\Windows\\QoS\\${rule}`
      };

      reg.closeKey(hRule);
      results.push(item);
    }

    reg.closeKey(root);
  }

  return results;
}


ipcMain.handle('get-qos-policies', async () => {
  try {
    const data = await collectQosPolicies();
    return { ok: true, items: data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

