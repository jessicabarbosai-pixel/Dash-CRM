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
    ['filterProjeto', 'filterCanal', 'filterOwnership', 'filterLoyalty', 'filterTimeView'].forEach(id => {
        document.getElementById(id).addEventListener('change', applyFilters);
    });
}

// 2. Buscar Dados
async function fetchData() {
    try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SHEET_ID}/values/${CONFIG.SHEET_NAME}!A:W`, {
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
        
        let projeto = (row[CONFIG.COLUMNS.PROJETO] || '').trim().toUpperCase(); // Normaliza nomes
        let canal = (row[CONFIG.COLUMNS.CANAL] || '').trim().toUpperCase();
        let status = (row[CONFIG.COLUMNS.STATUS] || '').trim().toLowerCase();
        
        // REGRA 1: Pular linhas sem canal, sem projeto, ou com status 'mapeado'
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
                monthLabel = d.toLocaleDateString('pt-BR', { year: 'numeric', month: 'short' });
                
                let day = d.getDay();
                let diff = d.getDate() - day + (day === 0 ? -6 : 1);
                let startOfWeek = new Date(d.setDate(diff));
                weekLabel = 'Sem ' + startOfWeek.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'});
            }
        }

        // Ownership (Cruza dados da coluna I e M)
        const ownerCol = (row[CONFIG.COLUMNS.OWNERSHIP] || '').trim();
        const descBase = (row[CONFIG.COLUMNS.DESC_BASE] || '').trim();
        const combinedOwnerText = (ownerCol + " " + descBase).toLowerCase();
        
        let ownership = 'Outros/Não Identificado';
        if (combinedOwnerText.includes('alugado') && combinedOwnerText.includes('terceiro')) ownership = 'Alugado e Terceiro';
        else if (combinedOwnerText.includes('alugado')) ownership = 'Alugado';
        else if (combinedOwnerText.includes('terceiro')) ownership = 'Terceiro';
        else if (combinedOwnerText.includes('próprio') || combinedOwnerText.includes('proprio')) ownership = 'Próprio';

        // Loyalty (Cruza dados da coluna J e M)
        const loyaltyCol = (row[CONFIG.COLUMNS.LOYALTY] || '').trim();
        const combinedLoyaltyText = (loyaltyCol + " " + descBase).toLowerCase();

        let loyalty = 'Não Informado';
        if (combinedLoyaltyText.includes('l4') || combinedLoyaltyText.includes('loyalty 4')) loyalty = 'L4';
        else if (combinedLoyaltyText.includes('l3') || combinedLoyaltyText.includes('loyalty 3') || combinedLoyaltyText.includes('loyalty >= 3')) loyalty = 'L3';
        else if (combinedLoyaltyText.includes('l2') || combinedLoyaltyText.includes('loyalty 2') || combinedLoyaltyText.includes('loyalty = 2') || combinedLoyaltyText.includes('loyalty >= 2')) loyalty = 'L2';
        else if (combinedLoyaltyText.includes('l1') || combinedLoyaltyText.includes('loyalty 1')) loyalty = 'L1';

        // Parse Numérico Seguro (Limpa formatação BR)
        const parseNum = (val) => {
            if (!val) return 0;
            let str = String(val).trim();
            if (/,/.test(str)) str = str.replace(/\./g, '').replace(',', '.'); // Ajusta "1.000,50" pra "1000.50"
            return parseFloat(str.replace(/[^\d.-]/g, '')) || 0;
        };

        processed.push({
            projeto: projeto,
            canal: canal,
            dataInt: rawDate.getTime(),
            semana: weekLabel,
            mes: monthLabel,
            baseCrua: descBase || 'Base Genérica',
            ownership: ownership,
            loyalty: loyalty,
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
    const loyalties = [...new Set(rawData.map(d => d.loyalty))].sort();

    document.getElementById('filterProjeto').innerHTML = '<option value="">Todas</option>' + projetos.map(p => `<option value="${p}">${p}</option>`).join('');
    document.getElementById('filterCanal').innerHTML = '<option value="">Todos</option>' + canais.map(c => `<option value="${c}">${c}</option>`).join('');
    document.getElementById('filterOwnership').innerHTML = '<option value="">Todos</option>' + owners.map(o => `<option value="${o}">${o}</option>`).join('');
    document.getElementById('filterLoyalty').innerHTML = '<option value="">Todos</option>' + loyalties.map(l => `<option value="${l}">${l}</option>`).join('');
}

// 5. Aplicar Filtros Gerais
function applyFilters() {
    const fProjeto = document.getElementById('filterProjeto').value;
    const fCanal = document.getElementById('filterCanal').value;
    const fOwner = document.getElementById('filterOwnership').value;
    const fLoyalty = document.getElementById('filterLoyalty').value;
    
    filteredData = rawData.filter(d => {
        return (!fProjeto || d.projeto === fProjeto) &&
               (!fCanal || d.canal === fCanal) &&
               (!fOwner || d.ownership === fOwner) &&
               (!fLoyalty || d.loyalty === fLoyalty);
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

    // CR Calculado puramente sem multiplicar por 100
    const cr = req > 0 ? (arr / req).toFixed(4) : 0;

    document.getElementById('kpiRequests').innerText = req.toLocaleString('pt-BR');
    document.getElementById('kpiArrives').innerText = arr.toLocaleString('pt-BR');
    document.getElementById('kpiCR').innerText = cr;
    document.getElementById('kpiBases').innerText = basesUnicas.size;
}

// 7. Renderizar Gráficos
function renderCharts() {
    const timeKey = document.getElementById('filterTimeView').value === 'mes' ? 'mes' : 'semana';
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
        return { label: loc, data: dataPoint, borderColor: colorPalette[i % colorPalette.length], tension: 0.3, fill: false };
    });

    if(charts.trend) charts.trend.destroy();
    charts.trend = new Chart(document.getElementById('trendLocadoraChart'), {
        type: 'line', data: { labels: timeLabels, datasets: trendDatasets },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // --- Gráfico 2: Volumes por Locadora e Canal ---
    const canais = [...new Set(filteredData.map(d => d.canal))];
    const locadoraCanalDatasets = canais.map((canal, i) => {
        const dataPoint = locadoras.map(loc => {
            return filteredData.filter(d => d.projeto === loc && d.canal === canal)
                               .reduce((sum, d) => sum + d.request, 0);
        });
        return { label: canal, data: dataPoint, backgroundColor: colorPalette[i % colorPalette.length] };
    });

    if(charts.locCanal) charts.locCanal.destroy();
    charts.locCanal = new Chart(document.getElementById('locadoraCanalChart'), {
        type: 'bar', data: { labels: locadoras, datasets: locadoraCanalDatasets },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } }
    });

    // --- Gráfico 3: Volumes Totais no Tempo ---
    const reqTempo = timeLabels.map(time => filteredData.filter(d => d[timeKey] === time).reduce((sum, d) => sum + d.request, 0));
    const arrTempo = timeLabels.map(time => filteredData.filter(d => d[timeKey] === time).reduce((sum, d) => sum + d.arrive, 0));

    if(charts.timeVol) charts.timeVol.destroy();
    charts.timeVol = new Chart(document.getElementById('timeVolumeChart'), {
        type: 'bar',
        data: { labels: timeLabels, datasets: [{ label: 'Requests', data: reqTempo, backgroundColor: c.primary }, { label: 'Arrives', data: arrTempo, backgroundColor: c.success }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // --- Gráfico 4: Frequência de Ownership no Tempo ---
    const owners = [...new Set(filteredData.map(d => d.ownership))];
    const ownerTimeDatasets = owners.map((owner, i) => {
        const dataPoint = timeLabels.map(time => {
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

// 8. Tabelas
function renderTables() {
    // --- Tabela de Ownership ---
    const ownerMap = {};
    filteredData.forEach(d => {
        if(!ownerMap[d.ownership]) ownerMap[d.ownership] = { freq: 0, req: 0, arr: 0, show: 0 };
        ownerMap[d.ownership].freq += 1;
        ownerMap[d.ownership].req += d.request;
        ownerMap[d.ownership].arr += d.arrive;
        ownerMap[d.ownership].show += d.show;
    });

    const ownerHtml = Object.entries(ownerMap).map(([owner, data]) => {
        const cr = data.req > 0 ? (data.arr / data.req).toFixed(4) : 0;
        return `<tr>
            <td class="font-bold">${owner}</td>
            <td>${data.freq}x</td>
            <td>${data.req.toLocaleString('pt-BR')}</td>
            <td>${data.arr.toLocaleString('pt-BR')}</td>
            <td>${data.show.toLocaleString('pt-BR')}</td>
            <td><span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">${cr}</span></td>
        </tr>`;
    }).join('');
    document.getElementById('ownershipTableBody').innerHTML = ownerHtml;

    // --- Tabela Ranking de Bases ---
    const baseMap = {};
    filteredData.forEach(d => {
        if(!baseMap[d.baseCrua]) baseMap[d.baseCrua] = { owner: d.ownership, loy: d.loyalty, freq: 0, req: 0 };
        baseMap[d.baseCrua].freq += 1;
        baseMap[d.baseCrua].req += d.request;
    });

    const ranking = Object.entries(baseMap).sort((a, b) => b[1].freq - a[1].freq).slice(0, 15);

    const rankingHtml = ranking.map(([base, data]) => {
        return `<tr>
            <td class="max-w-xs truncate" title="${base}">${base}</td>
            <td><span class="bg-gray-100 px-2 py-1 rounded text-xs">${data.owner}</span></td>
            <td><span class="bg-green-100 px-2 py-1 rounded text-xs">${data.loy}</span></td>
            <td class="font-bold">${data.freq}x</td>
            <td>${data.req.toLocaleString('pt-BR')}</td>
        </tr>`;
    }).join('');
    document.getElementById('rankingTableBody').innerHTML = rankingHtml;
}

gapi.load('client', initAuth);
