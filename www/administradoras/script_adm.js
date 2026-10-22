let columns = [
  { id: 'condominio', label: 'Condomínios', visible: true, removable: true },
  { id: 'col_administradora', label: 'Administradoras', visible: true, removable: true },
  { id: 'col_telefone', label: 'Telefone', visible: true, removable: true },
  { id: 'col_email_adm', label: 'E-mail Administradoras', visible: true, removable: true },
  { id: 'col_email_portaria', label: 'E-mail Secretarias/Portarias', visible: true, removable: true }
];

let data = [];
let filterText = '';
let sortCol = '';
let sortAsc = true;
let colFilters = {};

const LINK_GOOGLE_SHEETS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTzOF8AuTujM90L5_sKwqGMmj58RYp9oHWSWd4vZLeAecx2pPIEctAlPpXDd8sx1UOkQUTr6Cy2p4wX/pub?gid=0&single=true&output=csv';

const removeAcentos = (str) => {
  if (!str) return '';
  return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

async function initData() {
  try {
    let sheetsData = [];
    if (LINK_GOOGLE_SHEETS && LINK_GOOGLE_SHEETS !== 'COLE_O_SEU_LINK_AQUI') {
      const sheetUrlNoCache = LINK_GOOGLE_SHEETS + (LINK_GOOGLE_SHEETS.includes('?') ? '&' : '?') + 'cache_buster=' + Date.now();
      const resSheets = await fetch(sheetUrlNoCache, { cache: 'no-store' });
      const textSheets = await resSheets.text();
      const parsedRows = parseCSVText(textSheets);
      
      if (parsedRows.length > 0) {
        
        let headerRowIndex = -1;
        let colMap = {};
        for (let i = 0; i < parsedRows.length; i++) {
          const rowCells = parsedRows[i].map(c => removeAcentos(c));
          if (rowCells.some(cell => cell.includes('condominio') || cell.includes('administradora'))) {
            headerRowIndex = i; break;
          }
        }
        if (headerRowIndex !== -1) {
          const headers = parsedRows[headerRowIndex].map(h => removeAcentos(h.trim()));
          const dataRows = parsedRows.slice(headerRowIndex + 1);
          headers.forEach((h, idx) => {
            if (h.includes('condominio')) colMap.condominio = idx;
            else if (h.includes('administradora') && !h.includes('telefone') && !h.includes('email')) colMap.col_administradora = idx;
            else if (h.includes('telefone')) colMap.col_telefone = idx;
            else if (h.includes('email') && h.includes('administradora')) colMap.col_email_adm = idx;
            else if (h.includes('email') || h.includes('secretaria') || h.includes('portaria')) colMap.col_email_portaria = idx;
          });
          if (colMap.condominio === undefined) colMap.condominio = 0;
          if (colMap.col_administradora === undefined) colMap.col_administradora = 1;
          if (colMap.col_telefone === undefined) colMap.col_telefone = 2;
          if (colMap.col_email_adm === undefined) colMap.col_email_adm = 3;
          if (colMap.col_email_portaria === undefined) colMap.col_email_portaria = 4;

          let isSubInativo = false;
          dataRows.forEach(rowArr => {
            const cleanRow = rowArr.map(v => v ? String(v).trim() : '');
            const filledCells = cleanRow.filter(v => v !== '');
            if (filledCells.length === 0) return;
            const firstCellLower = removeAcentos(cleanRow[0] || '');
            const secondCellLower = removeAcentos(cleanRow[1] || '');
            if (filledCells.length <= 2 && (firstCellLower.includes('inativ') || secondCellLower.includes('inativ'))) {
              isSubInativo = true; return;
            }
            if (firstCellLower.includes('condominio') && secondCellLower.includes('administradora')) return;
            const nomeCond = cleanRow[colMap.condominio] || cleanRow[0];
            if (!nomeCond || removeAcentos(nomeCond) === 'condominios' || removeAcentos(nomeCond) === 'condominio') return;

            const rowObj = {
              condominio: nomeCond,
              col_administradora: cleanRow[colMap.col_administradora] || '',
              col_telefone: cleanRow[colMap.col_telefone] || '',
              col_email_adm: cleanRow[colMap.col_email_adm] || '',
              col_email_portaria: cleanRow[colMap.col_email_portaria] || ''
            };
            if (isSubInativo && !rowObj.condominio.includes('(INATIVO)')) rowObj.condominio += " <span style='color:#ff6b6b;font-size:10px;font-weight:bold;margin-left:8px;'>(INATIVO)</span>";
            sheetsData.push(rowObj);
          });
        }

      }
      if (sheetsData.length > 0) {
        data = sheetsData;
        salvarNoServidor('/api/adm');
      }
    }
  } catch (e) { console.error(e); }
  renderAll();
  checkUrlParams();
}

function parseCSVText(text) {
  const rows = []; let currentRow = []; let currentVal = ''; let insideQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]; const nextChar = text[i + 1];
    if (char === '"') { 
      if (insideQuotes && nextChar === '"') { currentVal += '"'; i++; } else { insideQuotes = !insideQuotes; } 
    }
    else if (char === ',' && !insideQuotes) { currentRow.push(currentVal); currentVal = ''; }
    else if ((char === '\n' || char === '\r') && !insideQuotes) { 
      if (char === '\r' && nextChar === '\n') i++; 
      currentRow.push(currentVal); rows.push(currentRow); currentRow = []; currentVal = ''; 
    }
    else { currentVal += char; }
  }
  if (currentVal !== '' || currentRow.length > 0) { currentRow.push(currentVal); rows.push(currentRow); }
  return rows;
}

function salvarNoServidor(route) {
  fetch(route, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ columns: columns, data: data })
  }).catch(() => {});
}

function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q');
  if (q) {
    const termoBusca = q.trim();
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = termoBusca;
    filterText = termoBusca;
    renderBody();
    const exactMatch = data.findIndex(row => Object.values(row).some(v => v !== null && v !== undefined && removeAcentos(String(v)).includes(removeAcentos(termoBusca))));
    if (exactMatch !== -1) setTimeout(() => openDetailsModal(exactMatch), 150);
  }
}

function renderAll() { renderHead(); renderBody(); renderColList(); updateCount(); }

function renderHead() {
  const head = document.getElementById('tableHead');
  if (!head) return;
  const visibleCols = columns.filter(c => c.visible);
  let html = '<tr><th style="width:50px; text-align:center;">Ver</th>';
  html += visibleCols.map(c => {
    const sortIcon = sortCol === c.id ? (sortAsc ? '▲' : '▼') : '↕';
    const filterVal = colFilters[c.id] || '';
    return `<th>
      <div style="cursor:pointer; display:flex; justify-content:space-between; align-items:center;" onclick="sortBy('${c.id}')" title="Ordenar">
        ${c.label} <span style="color:var(--tg-accent); margin-left:8px;">${sortIcon}</span>
      </div>
      <input type="text" placeholder="Filtrar coluna..." value="${filterVal}" oninput="filterColumn('${c.id}', this.value)" onclick="event.stopPropagation()">
    </th>`;
  }).join('');
  html += '</tr>';
  head.innerHTML = html;
}

function renderBody() {
  const body = document.getElementById('tableBody');
  if (!body) return;
  const visibleCols = columns.filter(c => c.visible);
  
  let filtered = data.filter(row => {
    if (!row) return false;
    if (filterText) {
        const termoBusca = removeAcentos(filterText);
        if (!Object.values(row).some(v => removeAcentos(String(v)).includes(termoBusca))) return false;
    }
    for (const colId in colFilters) {
      const filterVal = removeAcentos(colFilters[colId]);
      if (filterVal) {
        const cellVal = removeAcentos(String(row[colId] || ''));
        if (!cellVal.includes(filterVal)) return false;
      }
    }
    return true;
  });

  if (sortCol) {
    filtered.sort((a, b) => {
      let valA = String(a[sortCol] || '').toLowerCase(); let valB = String(b[sortCol] || '').toLowerCase();
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }

  const footerCount = document.getElementById('footerCount');
  if (filtered.length === 0) {
    body.innerHTML = `<tr><td colspan="${visibleCols.length + 1}" style="text-align:center; padding:40px; color:var(--txt3);">Nenhum registro encontrado</td></tr>`;
    if (footerCount) footerCount.textContent = '0 exibidos'; 
    return;
  }

  body.innerHTML = filtered.map((row) => {
    const realIdx = data.indexOf(row);
    let rowHtml = `<tr><td style="text-align:center;">
      <button onclick="openDetailsModal(${realIdx})" style="background:none;border:none;color:var(--txt2);cursor:pointer;font-size:18px;"><i class="ti ti-maximize"></i></button>
    </td>`;
    
    const cells = visibleCols.map(c => {
      const val = row[c.id] || '';
      const safeVal = String(val).replace(/"/g, '&quot;');
      const copyBtn = `<button class="copy-btn" onclick="copyContent(this)" data-value="${safeVal}" title="Copiar"><i class="ti ti-copy"></i></button>`;
      if (c.id === 'condominio') return `<td class="name-cell"><span class="status-dot"></span>${val}${copyBtn}</td>`;
      if (c.id.includes('email')) return `<td style="color:var(--tg-accent);">${val}${copyBtn}</td>`;
      return `<td>${val}${copyBtn}</td>`;
    }).join('');
    
    return rowHtml + cells + `</tr>`;
  }).join('');

  if (footerCount) footerCount.textContent = `${filtered.length} exibidos`;
}

function sortBy(colId) { if (sortCol === colId) sortAsc = !sortAsc; else { sortCol = colId; sortAsc = true; } renderHead(); renderBody(); }
function filterColumn(colId, value) { colFilters[colId] = value; renderBody(); }
function filterTable() { const input = document.getElementById('searchInput'); filterText = input ? input.value : ''; renderBody(); }

function renderColList() {
  const list = document.getElementById('colList');
  if (!list) return;
  list.innerHTML = columns.map(c => `<div class="col-item"><input type="checkbox" id="col_${c.id}" ${c.visible ? 'checked' : ''} onchange="toggleCol('${c.id}')"><label for="col_${c.id}">${c.label}</label></div>`).join('');
}

function updateCount() { const rc = document.getElementById('rowCount'); if (rc) rc.textContent = `${data.length} registros no total`; }

function toggleCol(id) { const col = columns.find(c => c.id === id); if (col) { col.visible = !col.visible; renderAll(); } }

function toggleColDropdown() { 
    const dd = document.getElementById('colDropdown'); 
    if (dd) dd.classList.toggle('open'); 
}

function copyContent(btnElement) {
  const text = btnElement.getAttribute('data-value'); 
  if (!text) return;
  const showSuccess = () => {
    const icon = btnElement.querySelector('i'); 
    if (icon) {
      icon.className = 'ti ti-check'; icon.style.color = 'var(--tg-accent)';
      setTimeout(() => { icon.className = 'ti ti-copy'; icon.style.color = ''; }, 1500);
    }
  };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(showSuccess).catch(console.error); 
  else {
    const textArea = document.createElement("textarea"); textArea.value = text; textArea.style.position = "fixed"; textArea.style.left = "-999999px"; 
    document.body.appendChild(textArea); textArea.focus(); textArea.select();
    try { document.execCommand('copy'); showSuccess(); } catch (err) {} textArea.remove();
  }
}

function openDetailsModal(idx) {
  const rowData = data[idx]; 
  const detailsContent = document.getElementById('detailsContent');
  const detailsModal = document.getElementById('detailsModal');
  if (!detailsContent || !detailsModal || !rowData) return;
  detailsContent.innerHTML = columns.map(c => `
    <div class="detail-item"><div class="detail-label">${c.label}</div><div class="detail-value">${rowData[c.id] || '<span style="color:var(--txt3); font-style:italic;">Não preenchido</span>'}</div></div>
  `).join('');
  detailsModal.classList.add('open');
}

function closeDetailsModal() { 
  const detailsModal = document.getElementById('detailsModal');
  if (detailsModal) detailsModal.classList.remove('open'); 
}

document.addEventListener('click', function(e) {
  const dd = document.getElementById('colDropdown'); 
  const btn = e.target.closest('.col-manager-btn');
  if (!btn && !e.target.closest('.col-dropdown') && dd) dd.classList.remove('open'); 
  if (e.target.classList.contains('modal-overlay')) closeDetailsModal(); 
});

window.onload = function() { initData(); };
