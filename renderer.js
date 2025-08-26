async function load() {
  const out = await window.qosApi.getPolicies();
  const table = document.getElementById('tbl');
  const err = document.getElementById('err');

  if (!out.ok) {
    err.textContent = out.error || 'Ошибка получения данных';
    return;
  }

  const items = out.items;
  if (!items.length) {
    err.textContent = 'Политики QoS не найдены.';
    return;
  }

  const headers = ['hive','regView','Name','DSCPValue','ThrottleRate','IPProtocol','LocalPort','RemotePort','LocalIP','RemoteIP','AppPath','keyPath'];
  // заголовок
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  headers.forEach(h => {
    const th = document.createElement('th'); th.textContent = h;
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  table.appendChild(thead);

  // строки
  const tbody = document.createElement('tbody');
  for (const it of items) {
    const tr = document.createElement('tr');
    headers.forEach(h => {
      const td = document.createElement('td');
      td.textContent = it[h] ?? '';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
}

window.addEventListener('DOMContentLoaded', load);
