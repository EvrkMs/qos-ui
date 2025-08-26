const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');
const reg = require('native-reg');

// Создаем хранилище для настроек
const store = new Store();

// Примечание: Все QoS политики в Windows хранятся как строковые значения (REG_SZ),
// даже числовые параметры как DSCP Value и Throttle Rate

// Проверка прав администратора
function isAdmin() {
  try {
    // Пробуем открыть защищенный ключ для записи
    const testKey = reg.openKey(
      reg.HKLM,
      'SOFTWARE',
      reg.Access.READ | reg.Access.WOW64_64KEY
    );
    if (testKey) {
      reg.closeKey(testKey);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function createWindow() {
  // Получаем сохраненные размеры окна или используем дефолтные
  const windowBounds = store.get('windowBounds', {
    width: 1400,
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
    icon: path.join(__dirname, 'icon.ico'), // если есть иконка
    show: false
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

  // Проверяем права администратора
  if (!isAdmin()) {
    dialog.showMessageBoxSync(win, {
      type: 'warning',
      title: 'Требуются права администратора',
      message: 'Для редактирования и удаления QoS политик требуются права администратора.\nЧтение политик доступно в обычном режиме.',
      buttons: ['OK']
    });
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

// Получение строкового значения из реестра
function getStr(hkey, valueName) {
  try {
    const val = reg.queryValue(hkey, valueName);
    const parsed = reg.parseValue(val);
    return parsed !== null && parsed !== undefined ? String(parsed) : '';
  } catch {
    return '';
  }
}

// Запись строкового значения в реестр
function setStr(hkey, valueName, value) {
  try {
    // Если значение пустое или '*', удаляем параметр
    if (!value || value === '*' || value === '') {
      try {
        reg.deleteValue(hkey, valueName);
      } catch {
        // Игнорируем ошибку если значения не существует
      }
      return true;
    }
    reg.setValueSZ(hkey, valueName, String(value));
    return true;
  } catch (e) {
    console.error(`Error setting ${valueName}:`, e);
    return false;
  }
}

// Запись DWORD значения в реестр
function setDWord(hkey, valueName, value) {
  try {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) {
      // Если не число, удаляем параметр
      try {
        reg.deleteValue(hkey, valueName);
      } catch {
        // Игнорируем ошибку если значения не существует
      }
      return true;
    }
    reg.setValueDWORD(hkey, valueName, numValue);
    return true;
  } catch (e) {
    console.error(`Error setting ${valueName}:`, e);
    return false;
  }
}

function openQoSRoot(view, access = reg.Access.READ) {
  const flags = access | (view === '64' ? reg.Access.WOW64_64KEY : reg.Access.WOW64_32KEY);
  
  try {
    const root = reg.openKey(
      reg.HKLM,
      'Software\\Policies\\Microsoft\\Windows\\QoS',
      flags
    );
    return root;
  } catch (e) {
    console.error(`Failed to open QoS root for view ${view}:`, e);
    return null;
  }
}

async function collectQosPolicies() {
  const results = [];

  for (const view of ['64', '32']) {
    const root = openQoSRoot(view);
    if (!root) continue;

    try {
      // Получаем список подключей (правил QoS)
      let ruleNames = [];
      try {
        ruleNames = reg.enumKeyNames(root);
      } catch (e) {
        console.error(`Failed to enumerate keys for view ${view}:`, e);
        continue;
      }
      
      for (const ruleName of ruleNames) {
        const access = reg.Access.READ | (view === '64' ? reg.Access.WOW64_64KEY : reg.Access.WOW64_32KEY);

        try {
          const hRule = reg.openKey(root, ruleName, access);
          if (!hRule) continue;

          // Читаем все параметры политики (все значения QoS хранятся как строки!)
          const policy = {
            hive: 'HKLM',
            regView: view,
            Rule: ruleName,
            // Все параметры QoS политик хранятся как строковые значения
            ApplicationName: getStr(hRule, 'Application Name'),
            DSCPValue: getStr(hRule, 'DSCP Value'),
            ThrottleRate: getStr(hRule, 'Throttle Rate'),
            Protocol: getStr(hRule, 'Protocol'),
            LocalIP: getStr(hRule, 'Local IP'),
            LocalIPPrefixLength: getStr(hRule, 'Local IP Prefix Length'),
            LocalPort: getStr(hRule, 'Local Port'),
            RemoteIP: getStr(hRule, 'Remote IP'),
            RemoteIPPrefixLength: getStr(hRule, 'Remote IP Prefix Length'),
            RemotePort: getStr(hRule, 'Remote Port'),
            Version: getStr(hRule, 'Version'),
            // Дополнительные поля для UI
            keyPath: `HKLM\\Software\\Policies\\Microsoft\\Windows\\QoS\\${ruleName}`
          };

          reg.closeKey(hRule);
          results.push(policy);
        } catch (e) {
          console.error(`Error reading rule ${ruleName}:`, e);
        }
      }
    } catch (e) {
      console.error(`Error processing QoS policies for view ${view}:`, e);
    } finally {
      if (root) {
        reg.closeKey(root);
      }
    }
  }

  return results;
}

async function updateQoSPolicy(policyData) {
  if (!isAdmin()) {
    throw new Error('Требуются права администратора для изменения политик');
  }

  const view = policyData.regView || '64';
  const access = reg.Access.WRITE | reg.Access.READ |
    (view === '64' ? reg.Access.WOW64_64KEY : reg.Access.WOW64_32KEY);

  let root = null;
  let ruleKey = null;

  try {
    // Открываем корневой ключ QoS
    root = reg.openKey(
      reg.HKLM,
      'Software\\Policies\\Microsoft\\Windows\\QoS',
      access
    );

    if (!root) {
      throw new Error('Не удается открыть раздел QoS для записи');
    }

    // Открываем или создаем ключ правила
    try {
      ruleKey = reg.openKey(root, policyData.Rule, access);
    } catch {
      // Если ключ не существует, создаем его
      try {
        ruleKey = reg.createKey(root, policyData.Rule, access);
      } catch (createError) {
        throw new Error(`Не удается создать ключ правила: ${policyData.Rule}`);
      }
    }

    if (!ruleKey) {
      throw new Error(`Не удается открыть или создать ключ правила: ${policyData.Rule}`);
    }

    // Записываем значения (все QoS параметры хранятся как строки!)
    const updates = [];
    
    // Application Name - строковое значение
    if (policyData.ApplicationName !== undefined) {
      updates.push(setStr(ruleKey, 'Application Name', policyData.ApplicationName || '*'));
    }
    
    // DSCP Value - числовое значение как строка (0-63)
    if (policyData.DSCPValue !== undefined) {
      const dscpVal = parseInt(policyData.DSCPValue, 10);
      if (!isNaN(dscpVal) && dscpVal >= 0 && dscpVal <= 63) {
        updates.push(setNumAsStr(ruleKey, 'DSCP Value', dscpVal));
      } else {
        updates.push(setNumAsStr(ruleKey, 'DSCP Value', 0));
      }
    }
    
    // Throttle Rate - числовое значение как строка (-1 для unlimited)
    if (policyData.ThrottleRate !== undefined) {
      const throttleVal = parseInt(policyData.ThrottleRate, 10);
      updates.push(setNumAsStr(ruleKey, 'Throttle Rate', isNaN(throttleVal) ? -1 : throttleVal));
    }
    
    // Protocol - строковое значение (TCP, UDP, или *)
    if (policyData.Protocol !== undefined) {
      updates.push(setStr(ruleKey, 'Protocol', policyData.Protocol || '*'));
    }
    
    // Local IP - строковое значение
    if (policyData.LocalIP !== undefined) {
      updates.push(setStr(ruleKey, 'Local IP', policyData.LocalIP || '*'));
    }
    
    // Local IP Prefix Length - числовое значение как строка
    if (policyData.LocalIPPrefixLength !== undefined) {
      updates.push(setNumAsStr(ruleKey, 'Local IP Prefix Length', policyData.LocalIPPrefixLength || 0));
    }
    
    // Local Port - строковое значение или диапазон
    if (policyData.LocalPort !== undefined) {
      updates.push(setStr(ruleKey, 'Local Port', policyData.LocalPort || '*'));
    }
    
    // Remote IP - строковое значение
    if (policyData.RemoteIP !== undefined) {
      updates.push(setStr(ruleKey, 'Remote IP', policyData.RemoteIP || '*'));
    }
    
    // Remote IP Prefix Length - числовое значение как строка
    if (policyData.RemoteIPPrefixLength !== undefined) {
      updates.push(setNumAsStr(ruleKey, 'Remote IP Prefix Length', policyData.RemoteIPPrefixLength || 0));
    }
    
    // Remote Port - строковое значение или диапазон
    if (policyData.RemotePort !== undefined) {
      updates.push(setStr(ruleKey, 'Remote Port', policyData.RemotePort || '*'));
    }
    
    // Version - строковое значение
    if (policyData.Version !== undefined) {
      updates.push(setStr(ruleKey, 'Version', policyData.Version || '1.0'));
    }

    const success = updates.every(result => result !== false);

    return success;
  } catch (e) {
    console.error('Error updating QoS policy:', e);
    throw e;
  } finally {
    if (ruleKey) reg.closeKey(ruleKey);
    if (root) reg.closeKey(root);
  }
}

async function deleteQoSPolicy(ruleName, regView) {
  if (!isAdmin()) {
    throw new Error('Требуются права администратора для удаления политик');
  }

  const view = regView || '64';
  const access = reg.Access.WRITE | reg.Access.READ |
    (view === '64' ? reg.Access.WOW64_64KEY : reg.Access.WOW64_32KEY);

  let root = null;

  try {
    // Открываем корневой ключ QoS
    root = reg.openKey(
      reg.HKLM,
      'Software\\Policies\\Microsoft\\Windows\\QoS',
      access
    );

    if (!root) {
      throw new Error('Не удается открыть раздел QoS для удаления');
    }

    // Удаляем подключ с политикой
    reg.deleteKey(root, ruleName);
    
    return true;
  } catch (e) {
    console.error('Error deleting QoS policy:', e);
    throw e;
  } finally {
    if (root) reg.closeKey(root);
  }
}

async function createQoSPolicy(policyData) {
  if (!isAdmin()) {
    throw new Error('Требуются права администратора для создания политик');
  }

  // Проверяем, что имя правила задано
  if (!policyData.Rule || policyData.Rule.trim() === '') {
    throw new Error('Имя правила не может быть пустым');
  }

  // Используем функцию обновления для создания
  return updateQoSPolicy(policyData);
}

// IPC handlers
ipcMain.handle('get-qos-policies', async () => {
  try {
    const data = await collectQosPolicies();
    return { ok: true, items: data };
  } catch (e) {
    console.error('Error collecting QoS policies:', e);
    return { ok: false, error: String(e.message || e) };
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
    return { ok: false, error: String(e.message || e) };
  }
});

ipcMain.handle('delete-qos-policy', async (event, ruleName, regView) => {
  try {
    await deleteQoSPolicy(ruleName, regView);
    return { ok: true };
  } catch (e) {
    console.error('Error deleting QoS policy:', e);
    return { ok: false, error: String(e.message || e) };
  }
});

ipcMain.handle('create-qos-policy', async (event, policyData) => {
  try {
    const success = await createQoSPolicy(policyData);
    if (success) {
      return { ok: true };
    } else {
      return { ok: false, error: 'Не удалось создать политику' };
    }
  } catch (e) {
    console.error('Error creating QoS policy:', e);
    return { ok: false, error: String(e.message || e) };
  }
});

ipcMain.handle('check-admin', async () => {
  return isAdmin();
});

// IPC для управления окном
ipcMain.handle('get-window-bounds', () => {
  return store.get('windowBounds');
});

ipcMain.handle('reset-window-bounds', () => {
  store.delete('windowBounds');
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.setBounds({ width: 1400, height: 800 });
    win.center();
  }
});

// Открытие внешних ссылок
ipcMain.handle('open-external', async (event, url) => {
  shell.openExternal(url);
});