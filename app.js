let rawData = [];
let filteredData = [];
let charts = {};
let tokenClient;

// Helpers de Cores
const getLocadoraColor = (nome) => CONFIG.COLORS.LOCADORAS[nome] || CONFIG.COLORS.LOCADORAS['DEFAULT'];
const getCanalColor = (nome) => CONFIG.COLORS.CANAIS[nome] || CONFIG.COLORS.CANAIS['DEFAULT'];

// 1. Inicialização
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
    
    document.getElementById('authBtn').addEventListener('click', () => { tokenClient.requestAccessToken({prompt: 'consent'}); });
    document.getElementById('refreshBtn').addEventListener('click', fetchData);
    ['filterProjeto', 'filterCanal', 'filterOwnership', 'filterLoyalty', 'filterMes'].forEach(id => {
        document.getElementById(id).addEventListener('change', applyFilters);
    });
}

// 2. Buscar Dados
async function fetchData() {
    try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SHEET_ID}/values/${CONFIG.SHEET_NAME}!A:Z`, {
            headers: { Authorization: `Bearer ${gapi.client.getToken().access_token}` }
        });
        const result = await response.json();
        processData(result.values);
    } catch (error) {
        console.error("Erro ao ler planilha:", error);
    }
}

// FORMATO INGLÊS: "1,250,500.50" -> Remove vírgulas, transforma em Float.
const parseNum = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    let str = String(val).trim();
    // Remove APENAS as vírgulas (que no inglês separam milhares)
    str = str.replace(/,/g, '');
    return parseFloat(str) || 0;
};

// 3. Processar Dados
function processData(rows) {
    if (!rows || rows.length < 2) return;
    
    let processed = [];
    
    for(let i = 1; i < rows.length; i++) {
        const row = rows[i];
        
        let projeto = (row[CONFIG.COLUMNS.PROJETO] || '').trim().toUpperCase(); 
        let canal = (row[CONFIG.COLUMNS.CANAL] || '').trim().toUpperCase();
        let status = (row[CONFIG.COLUMNS.STATUS] || '').trim().toLowerCase();
        
        // Exclusões
        if (!canal || !projeto || status.includes('mapead')) continue;
        
        // Tratamento de Tempo
        let dataStr = row[CONFIG.COLUMNS.ENVIO] || '';
        let weekLabel = 'Sem Data';
        let monthLabel = 'Sem Data';
        let rawDate = new Date(0);

        if (dataStr) {
            let d = new Date(dataStr);
            d = new Date(d.getTime() + d.getTimezoneOffset() * 60000);

            if (!isNaN(d)) {
                rawDate = d;
                let nomeMes = d.toLocaleDateString('pt-BR', { month: 'long' });
                monthLabel = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
                let weekOfMonth = Math.ceil(d.getDate() / 7);
                weekLabel = `${monthLabel} - Sem ${weekOfMonth}`;
            }
        }

        // Ownership, Loyalty e WAVES
        const descBase = (row[CONFIG.COLUMNS.DESC_BASE] || '').trim();
        const ownerCol = (row[CONFIG.COLUMNS.OWNERSHIP] || '').trim();
        const combinedOwnerText = (ownerCol + " " + descBase).toLowerCase();
        
        let isCaixa = projeto === 'CAIXA';
        let ownership = 'Outros/Não Identificado';
        let wave = 'Não se aplica';

        if (isCaixa) {
            ownership = 'Ignorado (CAIXA)';
            wave = descBase || 'Base Indefinida';
        } else {
            if (combinedOwnerText.includes('alugado') && combinedOwnerText.includes('terceiro')) ownership = 'Alugado e Terceiro';
            else if (combinedOwnerText.includes('alugado')) ownership = 'Alugado';
            else if (combinedOwnerText.includes('terceiro')) ownership = 'Terceiro';
            else if (combinedOwnerText.includes('próprio') || combinedOwnerText.includes('proprio')) ownership = 'Próprio';
        }

        const loyaltyCol = (row[CONFIG.COLUMNS.LOYALTY] || '').trim();
        const combinedLoyaltyText = (loyaltyCol + " " + descBase).toLowerCase();
        let loyalty = 'Não Informado';
        if (combinedLoyaltyText.includes('l4') || combinedLoyaltyText.includes('loyalty 4')) loyalty = 'L4';
        else if (combinedLoyaltyText.includes('l3') || combinedLoyaltyText.includes('loyalty 3') || combinedLoyaltyText.includes('loyalty >= 3')) loyalty = 'L3';
        else if (combinedLoyaltyText.includes('l2') || combinedLoyaltyText.includes('loyalty 2') || combinedLoyaltyText.includes('loyalty = 2') || combinedLoyaltyText.includes('loyalty >= 2')) loyalty = 'L2';
        else if (combinedLoyaltyText.includes('l1') || combinedLoyaltyText.includes('loyalty 1')) loyalty = 'L1';

        processed.push({
            projeto, canal, dataInt: rawDate.getTime(), semana: weekLabel, mes: monthLabel,
            baseCrua: descBase || 'Base Genérica',
            ownership, wave, loyalty, isCaixa,
            request: parseNum(row[CONFIG.COLUMNS.REQUEST]),
            arrive: parseNum(row[CONFIG.COLUMNS.ARRIVE]),
            show: parseNum(row[CONFIG.COLUMNS.SHOW]),
            click: parseNum(row[CONFIG.COLUMNS.CLICK])
        });
    }
    
    rawData = processed.sort((a, b) => a.dataInt - b.dataInt);
    populateFilters();
    applyFilters();
}

// 4. Preencher Filtros
function populateFilters() {
    const projetos = [...new Set(rawData.map(d => d.projeto))].sort();
    const canais = [...new Set(rawData.map(d => d.canal))].sort();
    const owners = [...new Set(rawData.filter(d => !d.isCaixa).map(d => d.ownership))].sort();
    const loyalties = [...new Set(rawData.map(d => d.loyalty))].sort();
    const meses = [...new Set(rawData.map(d => d.mes))];

    document.getElementById('filterProjeto').innerHTML = '<option value="">Todas</option>' + projetos.map(p => `<option value="${p}">${p}</option>`).join('');
    document.getElementById('filterCanal').innerHTML = '<option value="">Todos</option>' + canais.map(c => `<option value="${c}">${c}</option>`).join('');
    document.getElementById('filterOwnership').innerHTML = '<option value="">Todos</option>' + owners.map(o => `<option value="${o}">${o}</option>`).join('');
    document.getElementById('filterLoyalty').innerHTML = '<option value="">Todos</option>' + loyalties.map(l => `<option value="${l}">${l}</option>`).join('');
    document.getElementById('filterMes').innerHTML = '<option value="">Todos os Meses</option>' + meses.map(m => `<option value="${m}">${m}</option>`).join('');
}

// 5. Aplicar Filtros
function applyFilters() {
    const fProjeto = document.getElementById('filterProjeto').value;
    const fCanal = document.getElementById('filterCanal').value;
    const fOwner = document.getElementById('filterOwnership').value;
    const fLoyalty = document.getElementById('filterLoyalty').value;
    const fMes = document.getElementById('filterMes').value;
    
    filteredData = rawData.filter(d => {
        return (!fProjeto || d.projeto === fProjeto) &&
               (!fCanal || d.canal === fCanal) &&
               (!fOwner || d.ownership === fOwner) &&
               (!fLoyalty || d.loyalty === fLoyalty) &&
               (!fMes || d.mes === fMes);
    });

    updateKPIs();
    renderCharts();
    renderTables();
}

// 6. Atualizar Scorecards
function updateKPIs() {
    let req = 0, arr = 0, clk = 0;
    const basesUnicas = new Set();

    filteredData.forEach(d => {
        req += d.request;
        arr += d.arrive;
        clk += d.click;
        basesUnicas.add(d.baseCrua);
    });

    document.getElementById('kpiRequests').innerText = req.toLocaleString('en-US'); // Exibindo com vírgulas estilo US para visual
    document.getElementById('kpiArrives').innerText = arr.toLocaleString('en-US');
    document.getElementById('kpiClicks').innerText = clk.toLocaleString('en-US'); 
    document.getElementById('kpiBases').innerText = basesUnicas.size;
}

// 7. Renderizar Gráficos 
function renderCharts() {
    const monthLabels = [...new Set(filteredData.map(d => d.mes))];
    const weekLabels = [...new Set(filteredData.map(d => d.semana))];
    const locadoras = [...new Set(filteredData.map(d => d.projeto))];

    // --- NOVO: FUNIL DE CONVERSÃO (Por Locadora) ---
    const funnelMetrics = [
        { label: 'Request', key: 'request', color: '#3b82f6' }, // Azul
        { label: 'Arrive', key: 'arrive', color: '#10b981' },   // Verde
        { label: 'Show', key: 'show', color: '#f59e0b' },       // Laranja
        { label: 'Click', key: 'click', color: '#8b5cf6' }      // Roxo
    ];

    const funnelDatasets = funnelMetrics.map(metric => {
        return {
            label: metric.label,
            backgroundColor: metric.color,
            data: locadoras.map(loc => filteredData.filter(d => d.projeto === loc).reduce((sum, d) => sum + d[metric.key], 0))
        };
    });

    if(charts.funnel) charts.funnel.destroy();
    charts.funnel = new Chart(document.getElementById('funnelChart'), {
        type: 'bar',
        data: { labels: locadoras, datasets: funnelDatasets },
        options: { 
            responsive: true, maintainAspectRatio: false,
            scales: { x: { stacked: false }, y: { stacked: false } },
            plugins: { tooltip: { mode: 'index', intersect: false } }
        }
    });

    // --- 1: Tendência de Requests por Locadora (Meses) ---
    const trendDatasets = locadoras.map(loc => {
        const dataPoint = monthLabels.map(mesTime => filteredData.filter(d => d.projeto === loc && d.mes === mesTime).reduce((sum, d) => sum + d.request, 0));
        return { label: loc, data: dataPoint, borderColor: getLocadoraColor(loc), tension: 0.3, fill: false };
    });

    if(charts.trend) charts.trend.destroy();
    charts.trend = new Chart(document.getElementById('trendLocadoraChart'), {
        type: 'line', data: { labels: monthLabels, datasets: trendDatasets },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // --- 2: Volumes por Locadora e Canal ---
    const canais = [...new Set(filteredData.map(d => d.canal))];
    const locadoraCanalDatasets = canais.map(canal => {
        const dataPoint = locadoras.map(loc => filteredData.filter(d => d.projeto === loc && d.canal === canal).reduce((sum, d) => sum + d.request, 0));
        return { label: canal, data: dataPoint, backgroundColor: getCanalColor(canal) };
    });

    if(charts.locCanal) charts.locCanal.destroy();
    charts.locCanal = new Chart(document.getElementById('locadoraCanalChart'), {
        type: 'bar', data: { labels: locadoras, datasets: locadoraCanalDatasets },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } }
    });

    // --- 3: Volumes Totais (Request vs Arrive vs Click) (Semanas) ---
    const reqTempo = weekLabels.map(wk => filteredData.filter(d => d.semana === wk).reduce((sum, d) => sum + d.request, 0));
    const arrTempo = weekLabels.map(wk => filteredData.filter(d => d.semana === wk).reduce((sum, d) => sum + d.arrive, 0));
    const clkTempo = weekLabels.map(wk => filteredData.filter(d => d.semana === wk).reduce((sum, d) => sum + d.click, 0));

    if(charts.timeVol) charts.timeVol.destroy();
    charts.timeVol = new Chart(document.getElementById('timeVolumeChart'), {
        type: 'bar',
        data: { labels: weekLabels, datasets: [
            { label: 'Requests', data: reqTempo, backgroundColor: '#3b82f6' }, 
            { label: 'Arrives', data: arrTempo, backgroundColor: '#10b981' },
            { label: 'Clicks', data: clkTempo, backgroundColor: '#8b5cf6' }
        ]},
        options: { responsive: true, maintainAspectRatio: false }
    });

    // --- 4: Ownership por Semana (Exceto CAIXA) ---
    const validOwnersData = filteredData.filter(d => !d.isCaixa);
    const owners = [...new Set(validOwnersData.map(d => d.ownership))];
    const ownerTimeDatasets = owners.map((owner, i) => {
        const dataPoint = weekLabels.map(wk => validOwnersData.filter(d => d.ownership === owner && d.semana === wk).length);
        const coresExtras = ['#14b8a6', '#f59e0b', '#ec4899', '#64748b'];
        return { label: owner, data: dataPoint, backgroundColor: coresExtras[i % coresExtras.length] };
    });

    if(charts.ownerTime) charts.ownerTime.destroy();
    charts.ownerTime = new Chart(document.getElementById('ownershipTimeChart'), {
        type: 'bar', data: { labels: weekLabels, datasets: ownerTimeDatasets },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } }
    });

    // --- 5: Waves por Semana (APENAS CAIXA) ---
    const caixaData = filteredData.filter(d => d.isCaixa);
    const waves = [...new Set(caixaData.map(d => d.wave))].slice(0, 8); 
    
    const wavesDatasets = waves.map((wv, i) => {
        const dataPoint = weekLabels.map(wk => caixaData.filter(d => d.wave === wv && d.semana === wk).length);
        const palette = ['#0284c7', '#38bdf8', '#0369a1', '#bae6fd', '#0c4a6e', '#7dd3fc', '#0284c7'];
        return { label: wv, data: dataPoint, backgroundColor: palette[i % palette.length] };
    });

    if(charts.caixaWaves) charts.caixaWaves.destroy();
    charts.caixaWaves = new Chart(document.getElementById('caixaWavesChart'), {
        type: 'bar', data: { labels: weekLabels, datasets: wavesDatasets },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } }
    });
}

// 8. Tabelas
function renderTables() {
    // Tabela Ownership (Sem Caixa)
    const ownerMap = {};
    filteredData.filter(d => !d.isCaixa).forEach(d => {
        if(!ownerMap[d.ownership]) ownerMap[d.ownership] = { freq: 0, req: 0, clk: 0 };
        ownerMap[d.ownership].freq += 1;
        ownerMap[d.ownership].req += d.request;
        ownerMap[d.ownership].clk += d.click;
    });
    document.getElementById('ownershipTableBody').innerHTML = Object.entries(ownerMap).map(([owner, data]) => `<tr><td class="font-bold">${owner}</td><td>${data.freq}x</td><td>${data.req.toLocaleString('en-US')}</td><td>${data.clk.toLocaleString('en-US')}</td></tr>`).join('');

    // Tabela WAVES (Só Caixa)
    const waveMap = {};
    filteredData.filter(d => d.isCaixa).forEach(d => {
        if(!waveMap[d.wave]) waveMap[d.wave] = { freq: 0, req: 0, clk: 0 };
        waveMap[d.wave].freq += 1;
        waveMap[d.wave].req += d.request;
        waveMap[d.wave].clk += d.click;
    });
    const wavesHtml = Object.entries(waveMap).sort((a, b) => b[1].freq - a[1].freq).slice(0,10).map(([wave, data]) => `<tr><td class="font-bold truncate max-w-[150px]" title="${wave}">${wave}</td><td>${data.freq}x</td><td>${data.req.toLocaleString('en-US')}</td><td>${data.clk.toLocaleString('en-US')}</td></tr>`).join('');
    document.getElementById('wavesTableBody').innerHTML = wavesHtml;

    // Tabela Ranking Geral
    const baseMap = {};
    filteredData.forEach(d => {
        if(!baseMap[d.baseCrua]) baseMap[d.baseCrua] = { freq: 0, req: 0 };
        baseMap[d.baseCrua].freq += 1;
        baseMap[d.baseCrua].req += d.request;
    });
    const rankingHtml = Object.entries(baseMap).sort((a, b) => b[1].freq - a[1].freq).slice(0, 15).map(([base, data]) => `<tr><td class="truncate max-w-[150px]" title="${base}">${base}</td><td class="font-bold">${data.freq}x</td><td>${data.req.toLocaleString('en-US')}</td></tr>`).join('');
    document.getElementById('rankingTableBody').innerHTML = rankingHtml;
}

gapi.load('client', initAuth);
