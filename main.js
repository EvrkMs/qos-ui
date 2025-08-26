const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const reg = require('native-reg');

// Создаем хранилище для настроек
const store = new Store();

function createWindow() {
  // Получаем сохраненные размеры окна или используем дефолтные
  const windowBounds = store.get('windowBounds', {
    width: 1200,
    height: 800,
    x: undefined,
    y: undefined
  });

  const win = new BrowserWindow({
    ...windowBounds,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false // Не показываем окно пока не загрузится
  });

  // Показываем окно когда оно готово
  win.once('ready-to-show', () => {
    win.show();
  });

  win.loadFile('dist/index.html');

  // Сохраняем размеры окна при изменении
  win.on('resize', () => {
    store.set('windowBounds', win.getBounds());
  });

  // Сохраняем позицию окна при перемещении
  win.on('move', () => {
    store.set('windowBounds', win.getBounds());
  });

  // Открыть DevTools в режиме разработки
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }

  return win;
}

app.whenReady().then(() => {
  createWindow();
  
  app.on('activate', () => { 
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(); 
    }
  });
});

app.on('window-all-closed', () => { 
  if (process.platform !== 'darwin') {
    app.quit(); 
  }
});

// --- QoS Registry helpers ---

// Утилита: берёт значение (строкой) из открытого ключа; пустая строка, если нет
function getStr(hkey, valueName) {
  try {
    const val = reg.queryValue(hkey, valueName);
    return reg.parseValue(val) ?? '';
  } catch {
    return '';
  }
}

// Функция для записи строкового значения в реестр
function setStr(hkey, valueName, value) {
  try {
    reg.setValueSZ(hkey, valueName, String(value || ''));
    return true;
  } catch (e) {
    console.error(`Error setting ${valueName}:`, e);
    return false;
  }
}

// Функция для записи числового значения в реестр
function setDWord(hkey, valueName, value) {
  try {
    const numValue = parseInt(value, 10) || 0;
    reg.setValueDWORD(hkey, valueName, numValue);
    return true;
  } catch (e) {
    console.error(`Error setting ${valueName}:`, e);
    return false;
  }
}

function openQoSRoot(view) {
  // view: '64' | '32'
  const access =
    reg.Access.READ |
    (view === '64' ? reg.Access.WOW64_64KEY : reg.Access.WOW64_32KEY);

  try {
    const root = reg.openKey(
      reg.HKLM,
      'Software\\Policies\\Microsoft\\Windows\\QoS',
      access
    );
    return root;
  } catch {
    return null;
  }
}

async function collectQosPolicies() {
  const results = [];

  for (const view of ['64', '32']) {
    const root = openQoSRoot(view);
    if (!root) continue;

    try {
      // Список правил = имена подключей под QoS
      const ruleNames = reg.enumKeyNames(root);
      
      for (const rule of ruleNames) {
        const access =
          reg.Access.READ |
          (view === '64' ? reg.Access.WOW64_64KEY : reg.Access.WOW64_32KEY);

        try {
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
        } catch (e) {
          console.error(`Error reading rule ${rule}:`, e);
        }
      }
    } catch (e) {
      console.error(`Error reading rules for view ${view}:`, e);
    } finally {
      reg.closeKey(root);
    }
  }

  return results;
}

async function updateQoSPolicy(policyData) {
  const view = policyData.regView || '64';
  const access =
    reg.Access.WRITE | reg.Access.READ |
    (view === '64' ? reg.Access.WOW64_64KEY : reg.Access.WOW64_32KEY);

  try {
    // Открываем корневой ключ QoS
    const root = reg.openKey(
      reg.HKLM,
      'Software\\Policies\\Microsoft\\Windows\\QoS',
      access
    );

    if (!root) {
      throw new Error('Не удается открыть раздел QoS для записи');
    }

    // Открываем ключ правила
    let ruleKey;
    try {
      ruleKey = reg.openKey(root, policyData.Rule, access);
    } catch {
      reg.closeKey(root);
      throw new Error(`Не удается открыть ключ правила: ${policyData.Rule}`);
    }

    if (!ruleKey) {
      reg.closeKey(root);
      throw new Error(`Ключ правила не существует: ${policyData.Rule}`);
    }

    // Записываем значения
    const updates = [
      () => setStr(ruleKey, 'Application Name', policyData.ApplicationName || ''),
      () => setDWord(ruleKey, 'DSCP Value', policyData.DSCPValue || 0),
      () => setDWord(ruleKey, 'Throttle Rate', policyData.ThrottleRate || -1),
      () => setStr(ruleKey, 'Protocol', policyData.Protocol || '*'),
      () => setStr(ruleKey, 'Local IP', policyData.LocalIP || '*'),
      () => setDWord(ruleKey, 'Local IP Prefix Length', policyData.LocalIPPrefixLen || 0),
      () => setStr(ruleKey, 'Local Port', policyData.LocalPort || '*'),
      () => setStr(ruleKey, 'Remote IP', policyData.RemoteIP || '*'),
      () => setDWord(ruleKey, 'Remote IP Prefix Length', policyData.RemoteIPPrefixLen || 0),
      () => setStr(ruleKey, 'Remote Port', policyData.RemotePort || '*'),
      () => setStr(ruleKey, 'Version', policyData.Version || '1.0')
    ];

    const results = updates.map(update => update());
    const success = results.every(result => result);

    reg.closeKey(ruleKey);
    reg.closeKey(root);

    return success;
  } catch (e) {
    console.error('Error updating QoS policy:', e);
    throw e;
  }
}

// IPC handlers
ipcMain.handle('get-qos-policies', async () => {
  try {
    const data = await collectQosPolicies();
    return { ok: true, items: data };
  } catch (e) {
    console.error('Error collecting QoS policies:', e);
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('update-qos-policy', async (event, policyData) => {
  try {
    const success = await updateQoSPolicy(policyData);
    if (success) {
      return { ok: true };
    } else {
      return { ok: false, error: 'Не удалось обновить все значения политики' };
    }
  } catch (e) {
    console.error('Error updating QoS policy:', e);
    return { ok: false, error: String(e) };
  }
});

// IPC для управления окном
ipcMain.handle('get-window-bounds', () => {
  return store.get('windowBounds');
});

ipcMain.handle('reset-window-bounds', () => {
  store.delete('windowBounds');
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.setBounds({ width: 1200, height: 800 });
    win.center();
  }
});