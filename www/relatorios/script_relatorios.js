// Link Principal (KPIs e Tabelas Superiores)
const LINK_GOOGLE_SHEETS = 'https://docs.google.com/spreadsheets/d/1NoXORXB5vftiEoulJuxgmp0kbaboXEHn/export?format=csv&gid=402461472';

// Novo Link (Quadro de Colaboradores)
const LINK_COLABORADORES = 'https://docs.google.com/spreadsheets/d/1NoXORXB5vftiEoulJuxgmp0kbaboXEHn/export?format=csv&gid=784632926';

const removeAcentos = (str) => {
  if (!str) return '';
  return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

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
    } else { currentVal += char; }
  }
  if (currentVal !== '' || currentRow.length > 0) { currentRow.push(currentVal); rows.push(currentRow); }
  return rows;
}

async function fetchData() {
  const statusText = document.getElementById('statusAtualizacao');
  if (statusText && statusText.innerHTML.includes('Atualizado')) {
    statusText.innerHTML = '<i class="ti ti-refresh ti-spin"></i> Atualizando...';
  }

  try {
    const ts = new Date().getTime();
    
    const [resPrincipal, resColaboradores] = await Promise.all([
        fetch(LINK_GOOGLE_SHEETS + '&_rnd=' + ts, { cache: 'no-store' }),
        fetch(LINK_COLABORADORES + '&_rnd=' + ts, { cache: 'no-store' })
    ]);

    const textPrincipal = await resPrincipal.text();
    const rowsPrincipal = parseCSVText(textPrincipal);

    const textColaboradores = await resColaboradores.text();
    const rowsColaboradores = parseCSVText(textColaboradores);

    // 1. Renderiza Tela Principal
    extractAndRenderMes(rowsPrincipal);
    extractAndRenderKPIs(rowsPrincipal);
    extractAndRenderTable(rowsPrincipal, 'STATUS DE CONDOM', 4, 'tbl-vencimentos', true);
    extractAndRenderTable(rowsPrincipal, 'ALERTAS', 2, 'tbl-alertas', true);
    extractAndRenderTable(rowsPrincipal, 'MEDIA DE DIAS', 2, 'tbl-medias', false);
    extractAndRenderTable(rowsPrincipal, 'ARRECADACAO', 2, 'tbl-colaborador', true);
    extractAndRenderTable(rowsPrincipal, 'COMPARATIVO MENSAL', 5, 'tbl-comparativo', true);

    // 2. Renderiza Quadro de Colaboradores
    processarQuadroColaboradores(rowsColaboradores);

    if (statusText) {
      const agora = new Date();
      statusText.innerHTML = `<i class="ti ti-check" style="color:var(--tg-accent)"></i> Atualizado às ${agora.toLocaleTimeString('pt-BR')}`;
    }
  } catch (e) {
    console.error("Erro ao carregar relatórios:", e);
    if (statusText) statusText.innerHTML = '<i class="ti ti-alert-triangle" style="color:#ff6b6b"></i> Falha na conexão';
  }
}

// ==========================================
// FUNÇÕES DO QUADRO DE COLABORADORES
// ==========================================
function processarQuadroColaboradores(rows) {
    let headerRowIdx = -1;
    let nameRowIdx = -1;
    
    for(let r = 0; r < Math.min(rows.length, 15); r++) {
        if(!rows[r]) continue;
        if(rows[r].some(c => removeAcentos(c).toUpperCase().includes('TOTAL GERAL'))) {
            nameRowIdx = r;
            headerRowIdx = r + 2; 
            break;
        }
    }

    if(nameRowIdx === -1 || !rows[headerRowIdx]) return;

    let cols = [];
    
    for(let c = 0; c < rows[nameRowIdx].length; c++) {
        let name = rows[nameRowIdx][c].trim();
        
        if(name && !name.toUpperCase().includes('TOTAL GERAL')) {
            let count = (rows[nameRowIdx+1] && rows[nameRowIdx+1][c]) ? rows[nameRowIdx+1][c].trim() : '0';
            if (!count) count = '0';
            
            let colCondo = -1;
            let colVenc = -1;
            let colStatus = -1;

            for(let scanC = c; scanC < rows[headerRowIdx].length; scanC++) {
                if (scanC > c && rows[nameRowIdx][scanC] && rows[nameRowIdx][scanC].trim() !== '') {
                    break;
                }
                
                let cellVal = removeAcentos(rows[headerRowIdx][scanC] || '').toUpperCase();
                if(cellVal === 'CONDOMINIO' || cellVal.includes('CONDOMINIO')) {
                    if (colCondo === -1) colCondo = scanC;
                }
                if(cellVal === 'VENCIMENTO' || cellVal.includes('VENCIMENTO') || cellVal.includes('VENC')) {
                    if (colVenc === -1) colVenc = scanC;
                }
                if(cellVal === 'STATUS' || cellVal.includes('STATUS')) {
                    if (colStatus === -1) colStatus = scanC;
                }
            }

            if (colCondo !== -1 && colStatus !== -1) {
                cols.push({ name, count, colCondo, colVenc, colStatus, items: [] });
            }
        }
    }

    let dataStartRow = headerRowIdx + 1;
    for(let r = dataStartRow; r < rows.length; r++) {
        if(!rows[r]) continue;
        
        cols.forEach(col => {
            let condo = rows[r][col.colCondo] ? rows[r][col.colCondo].trim() : '';
            let venc = (col.colVenc !== -1 && rows[r][col.colVenc]) ? rows[r][col.colVenc].trim() : '';
            let status = rows[r][col.colStatus] ? rows[r][col.colStatus].trim() : '';
            
            if (condo && condo !== '-' && condo !== '') {
                if (!status) status = '-';
                col.items.push({ condo, venc, status });
            }
        });
    }

    renderQuadroColaboradores(cols);
}

function renderQuadroColaboradores(cols) {
    const board = document.getElementById('boardColaboradores');
    if(!board) return;

    let html = '';
    cols.forEach(col => {
        html += `<div class="board-col">
            <div class="board-col-header">
                <span class="board-col-title">${col.name}</span>
                <span class="board-col-count">${col.count}</span>
            </div>
            <div class="board-items">`;
        
        col.items.forEach(item => {
            let statusClass = 'st-default';
            let stUpper = removeAcentos(item.status).toUpperCase();
            
            if(stUpper.includes('FINALIZADO') && !stUpper.includes('ATRASO')) statusClass = 'st-finalizado';
            else if(stUpper.includes('ATRASO')) statusClass = 'st-atraso';
            else if(stUpper.includes('AG. DOC') || stUpper.includes('DOCUMENTO')) statusClass = 'st-ag-docs';
            else if(stUpper.includes('PENDENTE')) statusClass = 'st-pendente';
            else if(stUpper.includes('ANDAMENTO')) statusClass = 'st-andamento';
            else if(stUpper.includes('AGUARDANDO') || stUpper.includes('SOLICITACAO')) statusClass = 'st-aguardando';

            // NOVO FORMATO PARA A DATA: Numa segunda linha, como uma etiqueta leve
            let vencHtml = item.venc ? `<div style="margin-top: 6px; font-size: 10px; color: var(--txt4); display: flex; align-items: center; gap: 4px;"><i class="ti ti-calendar-due"></i> Vencimento: ${item.venc}</div>` : '';

            html += `
            <div class="board-item" data-search="${removeAcentos(item.venc + ' ' + item.condo + ' ' + item.status).toUpperCase()}">
                <div style="flex: 1; padding-right: 10px;">
                    <span class="item-name" style="display: block;">${item.condo}</span>
                    ${vencHtml}
                </div>
                <span class="item-status ${statusClass}">${item.status}</span>
            </div>`;
        });

        if(col.items.length === 0) {
            html += `<div style="text-align:center; color:var(--txt4); font-size:12px; margin-top:20px;">Nenhum registro</div>`;
        }

        html += `</div></div>`;
    });

    board.innerHTML = html;
    filtrarColaboradores();
}

function filtrarColaboradores() {
    const input = document.getElementById('filterColaborador');
    if(!input) return;
    const filter = removeAcentos(input.value).toUpperCase();
    
    const items = document.querySelectorAll('.board-item');
    items.forEach(item => {
        const searchData = item.getAttribute('data-search');
        if(searchData.includes(filter)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// ==========================================
// FUNÇÕES DO PAINEL PRINCIPAL (KPIs e Tabelas)
// ==========================================
function extractAndRenderMes(rows) {
    let mes = '--';
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
        if (!rows[r]) continue;
        for (let c = 0; c < rows[r].length; c++) {
            let cellVal = removeAcentos(rows[r][c] || '').toUpperCase().trim();
            if (cellVal.includes('MES VIGENTE')) {
                for (let scanC = c + 1; scanC <= c + 4; scanC++) {
                    if (rows[r][scanC] && rows[r][scanC].trim() !== '') {
                        mes = rows[r][scanC].trim();
                        break;
                    }
                }
                if (mes !== '--') break;
            }
        }
        if (mes !== '--') break;
    }
    
    const el = document.getElementById('mesVigenteDisplay');
    if (el && el.innerText !== mes) {
        el.innerText = mes;
        el.parentElement.classList.remove('updated');
        void el.parentElement.offsetWidth; 
        el.parentElement.classList.add('updated');
    }
}

function extractAndRenderKPIs(rows) {
    let kpiKeys = {
        'TOTAL DE CONDOMINIOS': 'kpi-total',
        'FEITOS': 'kpi-finalizados',
        'FINALIZADOS': 'kpi-finalizados',
        'CONCLUIDOS': 'kpi-finalizados',
        'EM ANDAMENTO': 'kpi-andamento',
        'PENDENTES': 'kpi-pendentes',
        'AG. DOCUMENTOS': 'kpi-ag-documentos',
        'ATRASADOS': 'kpi-atrasados',
        '% CONCLUSAO': 'kpi-conclusao',
        'AGUARDANDO ENTREGA': 'kpi-aguardando'
    };
    
    let kpis = {};
    for (let r = 0; r < Math.min(rows.length, 15); r++) {
        if(!rows[r]) continue;
        for (let c = 0; c < rows[r].length; c++) {
            let val = removeAcentos(rows[r][c] || '').toUpperCase().trim();
            if (kpiKeys[val] && kpis[kpiKeys[val]] === undefined) { 
                let foundVal = '0';
                for (let scanR = r + 1; scanR <= r + 2; scanR++) {
                    if (!rows[scanR]) continue;
                    for (let scanC = c; scanC <= c + 1; scanC++) {
                        let cellContent = rows[scanR][scanC] ? rows[scanR][scanC].trim() : '';
                        if (cellContent !== '' && /\d/.test(cellContent)) {
                            foundVal = cellContent;
                            break;
                        }
                    }
                    if (foundVal !== '0') break;
                }
                kpis[kpiKeys[val]] = foundVal;
            }
        }
    }
    
    for (let id of new Set(Object.values(kpiKeys))) {
        const el = document.getElementById(id);
        if(el && kpis[id] !== undefined && el.innerText !== kpis[id]) {
             el.innerText = kpis[id];
             el.parentElement.classList.remove('updated');
             void el.parentElement.offsetWidth;
             el.parentElement.classList.add('updated');
        }
    }
}

function extractAndRenderTable(rows, keyword, maxCols, targetId, hasSubHeader) {
    let tableData = [];
    let headerRowIdx = -1;
    let startColIdx = -1;

    for (let r = 0; r < rows.length; r++) {
        if(!rows[r]) continue;
        for (let c = 0; c < rows[r].length; c++) {
            let cell = removeAcentos(rows[r][c] || '').toUpperCase();
            if (cell.includes(removeAcentos(keyword).toUpperCase())) {
                headerRowIdx = r;
                startColIdx = c;
                break;
            }
        }
        if (headerRowIdx !== -1) break;
    }

    if (headerRowIdx === -1) return;

    let dataStartRow = headerRowIdx + 1;
    let colIndices = [];

    while (dataStartRow < rows.length) {
        let row = rows[dataStartRow];
        let hasData = false;
        if (row) {
            for (let c = startColIdx; c < row.length && colIndices.length < maxCols; c++) {
                if (row[c] && row[c].trim() !== '') {
                    colIndices.push(c);
                    hasData = true;
                }
            }
        }
        if (hasData) break;
        dataStartRow++;
    }

    while (colIndices.length < maxCols) {
        colIndices.push(colIndices.length > 0 ? colIndices[colIndices.length - 1] + 1 : startColIdx + colIndices.length);
    }

    for (let r = dataStartRow; r < rows.length; r++) {
        if(!rows[r]) break;
        let rowData = colIndices.map(idx => rows[r][idx] ? rows[r][idx].trim() : '');
        let isEmpty = rowData.every(cell => !cell || cell.trim() === '');
        
        if (isEmpty) {
            let nextRow = rows[r+1];
            if (!nextRow) break;
            let nextRowData = colIndices.map(idx => nextRow[idx] ? nextRow[idx].trim() : '');
            if (nextRowData.every(val => val === '')) break; 
            continue;
        }

        tableData.push(rowData);
        let isTotal = removeAcentos(rowData[0] || '').toUpperCase().includes('TOTAL');
        if (isTotal) break;
    }
    
    renderTableHTML(tableData, targetId, hasSubHeader);
}

function renderTableHTML(tableData, targetId, hasSubHeader) {
    const container = document.getElementById(targetId);
    if(!container || tableData.length === 0) return;

    let html = '';
    let startRow = 0;

    if (hasSubHeader && tableData[0]) {
        html += '<thead><tr>';
        tableData[0].forEach(h => { html += `<th>${h || ''}</th>`; });
        html += '</tr></thead>';
        startRow = 1;
    }

    html += '<tbody>';
    for(let i = startRow; i < tableData.length; i++) {
        let row = tableData[i];
        let isEmpty = row.every(cell => !cell || cell.trim() === '');
        if (isEmpty) continue;

        let firstCell = removeAcentos(row[0] || '').toUpperCase();
        let isTotal = firstCell.includes('TOTAL');
        let isAtrasado = firstCell.includes('ATRASADOS');
        
        let style = '';
        if (isTotal) style = 'font-weight: bold; background: rgba(126, 217, 87, 0.1); color: var(--tg-accent);';
        if (isAtrasado) style = 'font-weight: bold; background: rgba(255, 107, 107, 0.15); color: #ff6b6b;';
        
        html += `<tr style="${style}">`;
        row.forEach((cell, index) => { 
            let cellStyle = (isAtrasado && index > 0) ? 'color: #ff6b6b; font-weight: bold;' : '';
            html += `<td style="${cellStyle}">${cell || ''}</td>`; 
        });
        html += '</tr>';
    }
    html += '</tbody>';
    container.innerHTML = html;
}

window.onload = () => { fetchData(); setInterval(fetchData, 30000); };