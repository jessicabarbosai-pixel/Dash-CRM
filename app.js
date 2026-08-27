let rawData = [];
let filteredData = [];
let charts = {};
let tokenClient;

// 1. Inicialização e Google Auth
function initAuth() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        scope: CONFIG.SCOPES,
        callback: (response) => {
            if (response.error) { console.error('Erro Auth:', response); return; }
            document.getElementById('authSection').classList.add('hidden');
            document.getElementById('mainDashboard').classList.remove('hidden');
            fetchData();
        },
    });
    
    document.getElementById('authBtn').addEventListener('click', () => {
        tokenClient.requestAccessToken({prompt: 'consent'});
    });
    
    document.getElementById('refreshBtn').addEventListener('click', fetchData);
    ['filterProjeto', 'filterCanal', 'filterOwnership', 'filterTimeView'].forEach(id => {
        document.getElementById(id).addEventListener('change', applyFilters);
    });
}

// 2. Buscar Dados
async function fetchData() {
    try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SHEET_ID}/values/${CONFIG.SHEET_NAME}!A:P`, {
            headers: { Authorization: `Bearer ${gapi.client.getToken().access_token}` }
        });
        const result = await response.json();
        processData(result.values);
    } catch (error) {
        console.error("Erro ao ler planilha:", error);
    }
}

// 3. Processar Dados (Filtros de Canal Vazio e Mapeado + Ownership Inteligente)
function processData(rows) {
    if (!rows || rows.length < 2) return;
    
    let processed = [];
    
    for(let i = 1; i < rows.length; i++) {
        const row = rows[i];
        
        let canal = (row[CONFIG.COLUMNS.CANAL] || '').trim();
        let status = (row[CONFIG.COLUMNS.STATUS] || '').trim().toLowerCase();
        let projeto = (row[CONFIG.COLUMNS.PROJETO] || '').trim();
        
        // REGRA 1: Pular linhas sem canal, sem projeto, ou que o status seja 'mapeado'
        if (!canal || !projeto || status === 'mapeado') continue;
        
        // Extrair Data, Semana e Mês
        let dataStr = row[CONFIG.COLUMNS.ENVIO] || '';
        let weekLabel = 'Sem Data';
        let monthLabel = 'Sem Data';
        let rawDate = new Date(0);

        if (dataStr) {
            let d = new Date(dataStr);
            if (!isNaN(d)) {
                rawDate = d;
                // Formato Mês: "2026-04 (Abr)"
                monthLabel = d.toLocaleDateString('pt-BR', { year: 'numeric', month: 'short' });
                
                // Formato Semana (Pega a segunda-feira da semana)
                let day = d.getDay();
                let diff = d.getDate() - day + (day === 0 ? -6 : 1);
                let startOfWeek = new Date(d.setDate(diff));
                weekLabel = 'Sem ' + startOfWeek.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'});
            }
        }

        // Ownership
        const descBase = (row[CONFIG.COLUMNS.DESC_BASE] || '').trim();
        const descLower = descBase.toLowerCase();
        
        let ownership = 'Outros/Não Identificado';
        if (descLower.includes('alugado') && descLower.includes('terceiro')) ownership = 'Alugado e Terceiro';
        else if (descLower.includes('alugado')) ownership = 'Alugado';
        else if (descLower.includes('terceiro')) ownership = 'Terceiro';
        else if (descLower.includes('próprio') || descLower.includes('proprio')) ownership = 'Próprio';

        // Parse Numérico Seguro
        const parseNum = (val) => parseFloat(String(val).replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;

        processed.push({
            projeto: projeto,
            canal: canal,
            dataInt: rawDate.getTime(),
            semana: weekLabel,
            mes: monthLabel,
            baseCrua: descBase || 'Base Genérica',
            ownership: ownership,
            request: parseNum(row[CONFIG.COLUMNS.REQUEST]),
            arrive: parseNum(row[CONFIG.COLUMNS.ARRIVE]),
            show: parseNum(row[CONFIG.COLUMNS.SHOW])
        });
    }
    
    rawData = processed.sort((a, b) => a.dataInt - b.dataInt); // Ordenar por data
    populateFilters();
    applyFilters();
}

// 4. Preencher Filtros (Dropdowns)
function populateFilters() {
    const projetos = [...new Set(rawData.map(d => d.projeto))].sort();
    const canais = [...new Set(rawData.map(d => d.canal))].sort();
    const owners = [...new Set(rawData.map(d => d.ownership))].sort();

    document.getElementById('filterProjeto').innerHTML = '<option value="">Todas</option>' + projetos.map(p => `<option value="${p}">${p}</option>`).join('');
    document.getElementById('filterCanal').innerHTML = '<option value="">Todos</option>' + canais.map(c => `<option value="${c}">${c}</option>`).join('');
    document.getElementById('filterOwnership').innerHTML = '<option value="">Todos</option>' + owners.map(o => `<option value="${o}">${o}</option>`).join('');
}

// 5. Aplicar Filtros Gerais
function applyFilters() {
    const fProjeto = document.getElementById('filterProjeto').value;
    const fCanal = document.getElementById('filterCanal').value;
    const fOwner = document.getElementById('filterOwnership').value;
    
    filteredData = rawData.filter(d => {
        return (!fProjeto || d.projeto === fProjeto) &&
               (!fCanal || d.canal === fCanal) &&
               (!fOwner || d.ownership === fOwner);
    });

    updateKPIs();
    renderCharts();
    renderTables();
}

// 6. Atualizar Scorecards
function updateKPIs() {
    let req = 0, arr = 0;
    const basesUnicas = new Set();

    filteredData.forEach(d => {
        req += d.request;
        arr += d.arrive;
        basesUnicas.add(d.baseCrua);
    });

    const cr = req > 0 ? ((arr / req) * 100).toFixed(2) : 0;

    document.getElementById('kpiRequests').innerText = req.toLocaleString('pt-BR');
    document.getElementById('kpiArrives').innerText = arr.toLocaleString('pt-BR');
    document.getElementById('kpiCR').innerText = cr + '%';
    document.getElementById('kpiBases').innerText = basesUnicas.size;
}

// 7. Renderizar Gráficos (Sem Pizzas, Foco em Tendência e Volume)
function renderCharts() {
    const timeKey = document.getElementById('filterTimeView').value === 'mes' ? 'mes' : 'semana';
    
    // Obter todos os períodos ordenados
    const timeLabels = [...new Set(filteredData.map(d => d[timeKey]))];

    const c = CONFIG.COLORS;
    const colorPalette = [c.primary, c.secondary, c.success, c.warning, c.danger, c.purple, c.gray];

    // --- Gráfico 1: Tendência de Requests por Locadora ---
    const locadoras = [...new Set(filteredData.map(d => d.projeto))];
    const trendDatasets = locadoras.map((loc, i) => {
        const dataPoint = timeLabels.map(time => {
            return filteredData.filter(d => d.projeto === loc && d[timeKey] === time)
                               .reduce((sum, d) => sum + d.request, 0);
        });
        return {
            label: loc, data: dataPoint,
            borderColor: colorPalette[i % colorPalette.length],
            tension: 0.3, fill: false
        };
    });

    if(charts.trend) charts.trend.destroy();
    charts.trend = new Chart(document.getElementById('trendLocadoraChart'), {
        type: 'line', data: { labels: timeLabels, datasets: trendDatasets },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // --- Gráfico 2: Volumes por Locadora e Canal (Stacked Bar) ---
    const canais = [...new Set(filteredData.map(d => d.canal))];
    const locadoraCanalDatasets = canais.map((canal, i) => {
        const dataPoint = locadoras.map(loc => {
            return filteredData.filter(d => d.projeto === loc && d.canal === canal)
                               .reduce((sum, d) => sum + d.request, 0);
        });
        return {
            label: canal, data: dataPoint,
            backgroundColor: colorPalette[i % colorPalette.length]
        };
    });

    if(charts.locCanal) charts.locCanal.destroy();
    charts.locCanal = new Chart(document.getElementById('locadoraCanalChart'), {
        type: 'bar', data: { labels: locadoras, datasets: locadoraCanalDatasets },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } }
    });

    // --- Gráfico 3: Volumes Totais no Tempo (Request vs Arrive) ---
    const reqTempo = timeLabels.map(time => filteredData.filter(d => d[timeKey] === time).reduce((sum, d) => sum + d.request, 0));
    const arrTempo = timeLabels.map(time => filteredData.filter(d => d[timeKey] === time).reduce((sum, d) => sum + d.arrive, 0));

    if(charts.timeVol) charts.timeVol.destroy();
    charts.timeVol = new Chart(document.getElementById('timeVolumeChart'), {
        type: 'bar',
        data: {
            labels: timeLabels,
            datasets: [
                { label: 'Requests', data: reqTempo, backgroundColor: c.primary },
                { label: 'Arrives', data: arrTempo, backgroundColor: c.success }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // --- Gráfico 4: Frequência de Ownership no Tempo ---
    const owners = [...new Set(filteredData.map(d => d.ownership))];
    const ownerTimeDatasets = owners.map((owner, i) => {
        const dataPoint = timeLabels.map(time => {
            // Contagem de aparições (Frequência de bases abordadas)
            return filteredData.filter(d => d.ownership === owner && d[timeKey] === time).length;
        });
        return { label: owner, data: dataPoint, backgroundColor: colorPalette[i % colorPalette.length] };
    });

    if(charts.ownerTime) charts.ownerTime.destroy();
    charts.ownerTime = new Chart(document.getElementById('ownershipTimeChart'), {
        type: 'bar', data: { labels: timeLabels, datasets: ownerTimeDatasets },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } }
    });
}

// 8. Tabelas de Ownership e Ranking
function renderTables() {
    // --- Tabela de Ownership ---
    const ownerMap = {};
    filteredData.forEach(d => {
        if(!ownerMap[d.ownership]) ownerMap[d.ownership] = { freq: 0, req: 0, arr: 0, show: 0 };
        ownerMap[d.ownership].freq += 1; // 1 disparo = 1 frequência
        ownerMap[d.ownership].req += d.request;
        ownerMap[d.ownership].arr += d.arrive;
        ownerMap[d.ownership].show += d.show;
    });

    const ownerHtml = Object.entries(ownerMap).map(([owner, data]) => {
        const cr = data.req > 0 ? ((data.arr / data.req) * 100).toFixed(2) : 0;
        return `<tr>
            <td class="font-bold">${owner}</td>
            <td>${data.freq}x</td>
            <td>${data.req.toLocaleString('pt-BR')}</td>
            <td>${data.arr.toLocaleString('pt-BR')}</td>
            <td>${data.show.toLocaleString('pt-BR')}</td>
            <td><span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">${cr}%</span></td>
        </tr>`;
    }).join('');
    document.getElementById('ownershipTableBody').innerHTML = ownerHtml;

    // --- Tabela Ranking de Bases (Top 15) ---
    const baseMap = {};
    filteredData.forEach(d => {
        if(!baseMap[d.baseCrua]) baseMap[d.baseCrua] = { owner: d.ownership, freq: 0, req: 0 };
        baseMap[d.baseCrua].freq += 1;
        baseMap[d.baseCrua].req += d.request;
    });

    const ranking = Object.entries(baseMap)
        .sort((a, b) => b[1].freq - a[1].freq) // Ordenado pela frequência
        .slice(0, 15);

    const rankingHtml = ranking.map(([base, data]) => {
        return `<tr>
            <td class="max-w-xs truncate" title="${base}">${base}</td>
            <td><span class="bg-gray-100 px-2 py-1 rounded text-xs">${data.owner}</span></td>
            <td class="font-bold">${data.freq}x</td>
            <td>${data.req.toLocaleString('pt-BR')}</td>
        </tr>`;
    }).join('');
    document.getElementById('rankingTableBody').innerHTML = rankingHtml;
}

gapi.load('client', initAuth);
