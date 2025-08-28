// main.js — Electron main process
// - Читает Policy-based QoS из HKLM/HKCU (native-reg, fallback reg.exe)
// - IPC: get-policies, check-admin, create-policy, update-policy, delete-policy (как было)
// - ДОБАВЛЕНО: open-qos-wizard (gpedit.msc), add-qos-policy-win (PowerShell New-NetQosPolicy)

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');

// -------------------- Окно --------------------
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    }
  });

  const distHtml = path.join(__dirname, 'dist', 'index.html');
  const srcHtml  = path.join(__dirname, 'src', 'index.html');
  win.loadFile(fs.existsSync(distHtml) ? distHtml : srcHtml);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// -------------------- native-reg + helpers --------------------
let nreg = null;
try { nreg = require('native-reg'); } catch { nreg = null; }

const HIVES = { HKLM: 'HKLM', HKCU: 'HKCU' };

// Безопасно читаем REG_SZ как строку
function readSzNative(hKey, valueName) {
  try {
    const raw = nreg.queryValue(hKey, valueName);
    if (raw == null) return '';
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object') {
      if ('data' in raw && Buffer.isBuffer(raw.data)) {
        return raw.data.toString('utf16le').replace(/\u0000+$/g, '');
      }
      if ('value' in raw) return String(raw.value ?? '');
    }
    return String(raw);
  } catch {
    return '';
  }
}

function accessMask(view /* '64'|'32' */, write = false) {
  const base = write ? nreg.Access.ALL_ACCESS : nreg.Access.READ;
  const wow  = (view === '64') ? nreg.Access.WOW64_64KEY : nreg.Access.WOW64_32KEY;
  return base | wow;
}

function openRoot(hive, view, write = false) {
  const rootHive = hive === 'HKCU' ? nreg.HKCU : nreg.HKLM;
  return nreg.openKey(rootHive, 'Software\\Policies\\Microsoft\\Windows\\QoS', accessMask(view, write));
}

function listRulesNative(hive, view) {
  const root = openRoot(hive, view, false);
  if (!root) return [];
  const names = nreg.enumKeyNames(root) || [];
  nreg.closeKey(root);
  return names;
}

function readRuleNative(hive, view, rule) {
  const root = openRoot(hive, view, false);
  if (!root) return null;
  const hRule = nreg.openKey(root, rule, accessMask(view, false));
  nreg.closeKey(root);
  if (!hRule) return null;

  const obj = {
    hive,
    regView: view,
    Rule: rule,
    keyPath: `${hive}\\Software\\Policies\\Microsoft\\Windows\\QoS\\${rule}`,
    ApplicationName:       readSzNative(hRule, 'Application Name'),
    DSCPValue:             readSzNative(hRule, 'DSCP Value'),
    ThrottleRate:          readSzNative(hRule, 'Throttle Rate'),
    Protocol:              readSzNative(hRule, 'Protocol'),
    LocalIP:               readSzNative(hRule, 'Local IP'),
    LocalIPPrefixLength:   readSzNative(hRule, 'Local IP Prefix Length'),
    LocalPort:             readSzNative(hRule, 'Local Port'),
    RemoteIP:              readSzNative(hRule, 'Remote IP'),
    RemoteIPPrefixLength:  readSzNative(hRule, 'Remote IP Prefix Length'),
    RemotePort:            readSzNative(hRule, 'Remote Port'),
    Version:               readSzNative(hRule, 'Version'),
  };
  nreg.closeKey(hRule);
  return obj;
}

// -------------------- Fallback: reg.exe --------------------
function execReg(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
      if (err) resolve({ ok: false, stdout: String(stdout||''), stderr: String(stderr || err.message) });
      else     resolve({ ok: true,  stdout: String(stdout||''), stderr: '' });
    });
  });
}

function parseRegQuery(stdout) {
  const lines = String(stdout).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const res = [];
  let cur = null;
  for (const line of lines) {
    if (/^HKEY_/.test(line)) {
      if (cur) res.push(cur);
      cur = { path: line, values: {} };
    } else if (cur) {
      const m = line.match(/^(.+?)\s+REG_[A-Z0-9]+\s+(.+)$/);
      if (m) cur.values[m[1].trim()] = m[2].trim();
    }
  }
  if (cur) res.push(cur);
  return res;
}

function psEscape(str) {
  return String(str).replace(/'/g, "''");
}

function checkAdminNetSession() {
  return new Promise((resolve) => {
    exec('net session', { windowsHide: true }, (err) => resolve(!err));
  });
}

async function runPowerShell(script) {
  const tmp = path.join(os.tmpdir(), `qos_${Date.now()}.ps1`);
  fs.writeFileSync(tmp, script, 'utf8');
  return new Promise((resolve) => {
    exec(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tmp}"`, { windowsHide: true, timeout: 60000 }, (err, stdout, stderr) => {
      fs.unlink(tmp, () => {});
      if (err) resolve({ ok: false, stdout, stderr: stderr || err.message });
      else resolve({ ok: true, stdout, stderr: '' });
    });
  });
}

async function listRulesRegExe(hive, view) {
  const root = `${hive}\\Software\\Policies\\Microsoft\\Windows\\QoS`;
  const out = await execReg(`reg query "${root}" /reg:${view}`);
  if (!out.ok) return [];
  const lines = out.stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  return lines.filter(l => l.startsWith(root + '\\')).map(s => s.split('\\').pop());
}

async function readRuleRegExe(hive, view, rule) {
  const key = `${hive}\\Software\\Policies\\Microsoft\\Windows\\QoS\\${rule}`;
  const out = await execReg(`reg query "${key}" /reg:${view}`);
  if (!out.ok) return null;
  const blocks = parseRegQuery(out.stdout);
  const me = blocks.find(b => b.path.toLowerCase() === key.toLowerCase());
  const v = (me && me.values) ? me.values : {};
  return {
    hive,
    regView: view,
    Rule: rule,
    keyPath: key,
    ApplicationName:       v['Application Name'] || '',
    DSCPValue:             v['DSCP Value'] || '',
    ThrottleRate:          v['Throttle Rate'] || '',
    Protocol:              v['Protocol'] || '',
    LocalIP:               v['Local IP'] || '',
    LocalIPPrefixLength:   v['Local IP Prefix Length'] || '',
    LocalPort:             v['Local Port'] || '',
    RemoteIP:              v['Remote IP'] || '',
    RemoteIPPrefixLength:  v['Remote IP Prefix Length'] || '',
    RemotePort:            v['Remote Port'] || '',
    Version:               v['Version'] || ''
  };
}

// -------------------- Обобщённое чтение --------------------
async function collectPolicies() {
  const result = [];
  const hives = [HIVES.HKLM, HIVES.HKCU];
  const views = ['64', '32'];
  const useNative = !!nreg;

  for (const hive of hives) {
    for (const view of views) {
      try {
        const ruleNames = useNative ? listRulesNative(hive, view) : await listRulesRegExe(hive, view);
        for (const rule of ruleNames) {
          const obj = useNative ? readRuleNative(hive, view, rule) : await readRuleRegExe(hive, view, rule);
          if (obj) result.push(obj);
        }
      } catch {
        // продолжаем дальше
      }
    }
  }
  return result;
}

// -------------------- Админ-права --------------------
async function isAdmin() {
  return await new Promise(res => {
    exec('net session', { windowsHide: true }, (err) => res(!err));
  });
}

// -------------------- Запись/CRUD через реестр (как было) --------------------
function strOr(val) { return (val === undefined || val === null) ? '' : String(val); }

function writeValueNative(hive, view, rule, name, data) {
  const root = openRoot(hive, view, true);
  if (!root) throw new Error('Cannot open QoS root for write');
  let hRule = nreg.openKey(root, rule, accessMask(view, true));
  if (!hRule) hRule = nreg.createKey(root, rule, accessMask(view, true));
  nreg.setValue(hRule, name, nreg.REG_SZ, String(data));
  nreg.closeKey(hRule);
  nreg.closeKey(root);
}

async function writeValueRegExe(hive, view, rule, name, data) {
  const key = `${hive}\\Software\\Policies\\Microsoft\\Windows\\QoS\\${rule}`;
  await execReg(`reg add "${key}" /f /reg:${view}`);
  const cmd = `reg add "${key}" /v "${name}" /t REG_SZ /d "${String(data)}" /f /reg:${view}`;
  const out = await execReg(cmd);
  if (!out.ok) throw new Error(out.stderr || 'reg add failed');
}

async function deleteKeyNative(hive, view, rule) {
  const rootHive = (hive === 'HKCU') ? nreg.HKCU : nreg.HKLM;
  const root = nreg.openKey(rootHive, 'Software\\Policies\\Microsoft\\Windows\\QoS', accessMask(view, true));
  if (!root) throw new Error('Cannot open QoS root for delete');
  const ok = nreg.deleteKey(root, rule);
  nreg.closeKey(root);
  if (!ok) throw new Error('deleteKey failed');
}

async function deleteKeyRegExe(hive, view, rule) {
  const key = `${hive}\\Software\\Policies\\Microsoft\\Windows\\QoS\\${rule}`;
  const out = await execReg(`reg delete "${key}" /f /reg:${view}`);
  if (!out.ok) throw new Error(out.stderr || 'reg delete failed');
}

async function cleanRegistry(rule) {
  const hives = [HIVES.HKLM, HIVES.HKCU];
  const views = ['64', '32'];
  for (const hive of hives) {
    for (const view of views) {
      try {
        if (nreg) await deleteKeyNative(hive, view, rule);
        else await deleteKeyRegExe(hive, view, rule);
      } catch {
        /* ignore */
      }
    }
  }
}

async function createOrUpdatePolicy(data, isCreate = false) {
  // Ожидаем поля: Rule, regView ('64'|'32'), hive (optional, default HKLM), + все значения строками
  const rule   = strOr(data.Rule).trim();
  const view   = (data.regView === '32') ? '32' : '64';
  const hive   = (data.hive === 'HKCU') ? 'HKCU' : 'HKLM';
  if (!rule) throw new Error('Имя правила (Rule/Name) не задано');

  const writeKv = async (name, value) => {
    if (nreg) writeValueNative(hive, view, rule, name, strOr(value));
    else await writeValueRegExe(hive, view, rule, name, strOr(value));
  };

  const fields = {
    'Application Name': data.ApplicationName,
    'DSCP Value':       data.DSCPValue,
    'Throttle Rate':    data.ThrottleRate,
    'Protocol':         data.Protocol,
    'Local IP':         data.LocalIP,
    'Local IP Prefix Length': data.LocalIPPrefixLength,
    'Local Port':       data.LocalPort,
    'Remote IP':        data.RemoteIP,
    'Remote IP Prefix Length': data.RemoteIPPrefixLength,
    'Remote Port':      data.RemotePort,
    'Version':          data.Version,
  };

  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) await writeKv(k, strOr(v));
  }

  return { ok: true };
}

async function deletePolicy({ Rule, regView, hive }) {
  const rule = strOr(Rule).trim();
  const view = (regView === '32') ? '32' : '64';
  const hv   = (hive === 'HKCU') ? 'HKCU' : 'HKLM';
  if (!rule) throw new Error('Rule пуст');

  if (nreg) await deleteKeyNative(hv, view, rule);
  else await deleteKeyRegExe(hv, view, rule);
  return { ok: true };
}

// -------------------- New: добавление через PowerShell --------------------
function kbpsStringToBitsPerSecond(s) {
  if (!s) return null;
  const m = String(s).match(/-?\d+/);
  if (!m) return null;
  const kb = Number(m[0]);
  if (!Number.isFinite(kb) || kb <= 0) return null;
  // трактуем значение как "КБ/с" -> 1000 байт * 8 бит
  return Math.round(kb * 1000 * 8);
}

function buildNewPolicyPs(p) {
  // p: { Name, DSCPValue, ThrottleRate, ApplicationName, Protocol,
  //      LocalIP, LocalIPPrefixLength, LocalPort,
  //      RemoteIP, RemoteIPPrefixLength, RemotePort,
  //      PolicyStore, NetworkProfile }
  const lines = [];
  lines.push(`$ErrorActionPreference='Stop'`);
  lines.push(`Import-Module NetQos -ErrorAction Stop`);

  const args = [];
  args.push(`-Name "${p.Name}"`);
  args.push(`-NetworkProfile ${p.NetworkProfile || 'All'}`);
  args.push(`-PolicyStore ${p.PolicyStore || 'localhost'}`); // 'GPO:localhost' чтобы положить в Local GPO

  if (p.DSCPValue && /^\d+$/.test(p.DSCPValue)) {
    const dscp = Math.max(0, Math.min(63, parseInt(p.DSCPValue, 10)));
    args.push(`-DSCPAction ${dscp}`);
  }
  const bps = kbpsStringToBitsPerSecond(p.ThrottleRate);
  if (bps) args.push(`-ThrottleRateActionBitsPerSecond ${bps}`);

  if (p.ApplicationName && p.ApplicationName.trim())
    args.push(`-AppPathNameMatchCondition "${p.ApplicationName.trim()}"`);

  const proto = (p.Protocol || '').toUpperCase();
  if (proto === 'TCP' || proto === 'UDP') args.push(`-IPProtocolMatchCondition ${proto}`);

  // Если задан один порт (любая сторона) — используем общий матч
  const port = [p.LocalPort, p.RemotePort].find(x => /^\d+$/.test(String(x||'')));
  if (port) args.push(`-IPPortMatchCondition ${parseInt(port,10)}`);

  if (p.LocalIP && p.LocalIPPrefixLength)   args.push(`-IPSrcPrefixMatchCondition "${p.LocalIP}/${p.LocalIPPrefixLength}"`);
  if (p.RemoteIP && p.RemoteIPPrefixLength) args.push(`-IPDstPrefixMatchCondition "${p.RemoteIP}/${p.RemoteIPPrefixLength}"`);

  lines.push(`New-NetQosPolicy ${args.join(' ')}`);
  lines.push(`Get-NetQosPolicy -Name "${p.Name}" -PolicyStore ActiveStore | Format-List *`);
  return lines.join(os.EOL);
}

function runPowershellScript(psCode) {
  return new Promise((resolve) => {
    const tmp = path.join(os.tmpdir(), `qos_add_${Date.now()}.ps1`);
    fs.writeFileSync(tmp, psCode, 'utf8');
    execFile('powershell.exe',
      ['-NoProfile','-ExecutionPolicy','Bypass','-File', tmp],
      { windowsHide: true, timeout: 60_000 },
      (err, stdout, stderr) => {
        try { fs.unlinkSync(tmp); } catch {}
        if (err) resolve({ ok:false, stdout:String(stdout||''), stderr:String(stderr||err.message) });
        else     resolve({ ok:true,  stdout:String(stdout||''), stderr:String(stderr||'') });
      });
  });
}

// -------------------- IPC --------------------
ipcMain.handle('get-policies', async () => {
  try { return { ok: true, items: await collectPolicies() }; }
  catch (e) { return { ok: false, error: String(e) }; }
});

ipcMain.handle('check-admin', async () => {
  try { return await isAdmin(); }
  catch { return false; }
});

ipcMain.handle('create-policy', async (_evt, data) => {
  try { return await createOrUpdatePolicy(data); }
  catch (e) { return { ok: false, error: String(e) }; }
});

ipcMain.handle('update-policy', async (_evt, data) => {
  try { return await createOrUpdatePolicy(data); }
  catch (e) { return { ok: false, error: String(e) }; }
});

ipcMain.handle('delete-policy', async (_evt, { Rule, regView, hive }) => {
  try { return await deletePolicy({ Rule, regView, hive }); }
  catch (e) { return { ok: false, error: String(e) }; }
});

ipcMain.handle('open-qos-wizard', async () => {
  return new Promise((resolve) => {
    exec('gpedit.msc', { windowsHide: true }, (err) => {
      if (err) resolve({ ok: false, error: String(err) });
      else resolve({ ok: true });
    });
  });
});

ipcMain.handle('add-qos-policy-win', async (_evt, form) => {
  try {
    const admin = await checkAdminNetSession();
    if (!admin) return { ok: false, error: 'Требуются права администратора' };

    const name = String(form.Name || '').trim();
    if (!name) return { ok: false, error: 'Name обязателен' };

    const params = [`-Name '${psEscape(name)}'`];

    if (form.DSCPValue !== undefined && form.DSCPValue !== '') {
      let dscp = parseInt(form.DSCPValue, 10);
      if (!isNaN(dscp)) {
        dscp = Math.max(0, Math.min(63, dscp));
        params.push(`-DSCPAction ${dscp}`);
      }
    }

    if (form.ThrottleRate !== undefined && form.ThrottleRate !== '') {
      const rate = parseFloat(form.ThrottleRate);
      if (!isNaN(rate) && rate > 0) {
        const bps = Math.round(rate * 1000 * 8);
        params.push(`-ThrottleRateActionBitsPerSecond ${bps}`);
      }
    }

    if (form.ApplicationName) {
      params.push(`-AppPathNameMatchCondition '${psEscape(form.ApplicationName)}'`);
    }

    if (form.Protocol === 'TCP' || form.Protocol === 'UDP') {
      params.push(`-IPProtocolMatchCondition ${form.Protocol}`);
    }

    const portVal = form.LocalPort || form.RemotePort;
    if (portVal) {
      const pn = parseInt(portVal, 10);
      if (!isNaN(pn) && pn >= 1 && pn <= 65535) {
        params.push(`-IPPortMatchCondition ${pn}`);
      }
    }

    if (form.LocalIP && form.LocalIPPrefixLength) {
      params.push(`-IPSrcPrefixMatchCondition '${psEscape(form.LocalIP + '/' + form.LocalIPPrefixLength)}'`);
    }

    if (form.RemoteIP && form.RemoteIPPrefixLength) {
      params.push(`-IPDstPrefixMatchCondition '${psEscape(form.RemoteIP + '/' + form.RemoteIPPrefixLength)}'`);
    }

    const profile = form.NetworkProfile || 'All';
    params.push(`-NetworkProfile ${profile}`);

    const store = form.PolicyStore || 'localhost';
    params.push(`-PolicyStore '${psEscape(store)}'`);

    const cmd = `New-NetQosPolicy ${params.join(' ')}`;
    const script = `${cmd}\nGet-NetQosPolicy -Name '${psEscape(name)}' -PolicyStore ActiveStore | Format-List *\n`;
    const out = await runPowerShell(script);
    if (!out.ok) return { ok: false, error: out.stderr, stdout: out.stdout };
    return { ok: true, stdout: out.stdout };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('remove-qos-policy-win', async (_evt, { Name }) => {
  try {
    const admin = await checkAdminNetSession();
    if (!admin) return { ok: false, error: 'Требуются права администратора' };
    const name = String(Name || '').trim();
    if (!name) return { ok: false, error: 'Name обязателен' };

    const script = `\n` +
      `Remove-NetQosPolicy -Name '${psEscape(name)}' -PolicyStore localhost -Confirm:$false -ErrorAction SilentlyContinue\n` +
      `Remove-NetQosPolicy -Name '${psEscape(name)}' -PolicyStore "GPO:localhost" -Confirm:$false -ErrorAction SilentlyContinue\n` +
      `Remove-NetQosPolicy -Name '${psEscape(name)}' -PolicyStore ActiveStore -Confirm:$false -ErrorAction SilentlyContinue\n` +
      `Get-NetQosPolicy -Name '${psEscape(name)}' -PolicyStore ActiveStore -ErrorAction SilentlyContinue | Format-List *\n`;
    const out = await runPowerShell(script);
    await cleanRegistry(name);
    if (!out.ok) return { ok: false, error: out.stderr || out.error, stdout: out.stdout };
    const warn = out.stdout && out.stdout.trim() ? 'Правило может управляться доменным GPO и появиться снова' : undefined;
    return warn ? { ok: true, warning: warn } : { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});
