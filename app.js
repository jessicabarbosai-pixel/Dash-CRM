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
    
    // Filtros Gerais
    ['filterProjeto', 'filterCanal', 'filterOwnership', 'filterLoyalty', 'filterMes'].forEach(id => {
        document.getElementById(id).addEventListener('change', applyFilters);
    });

    // Filtros Exclusivos dos Painéis
    document.getElementById('funnelLocadoraSelect').addEventListener('change', renderFunnel);
    // Agora ouve a mudança de Mês do gráfico de semanas
    document.getElementById('timeVolMesSelect').addEventListener('change', renderTimeVolumeChart);
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

// FORMATO INGLÊS
const parseNum = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    let str = String(val).trim();
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

    const projHtml = '<option value="">Todas</option>' + projetos.map(p => `<option value="${p}">${p}</option>`).join('');
    
    document.getElementById('filterProjeto').innerHTML = projHtml;
    // O Dropdown do Funil
    document.getElementById('funnelLocadoraSelect').innerHTML = '<option value="">Todas as Locadoras</option>' + projetos.map(p => `<option value="${p}">${p}</option>`).join('');
    
    // O Dropdown de Tempo (Semanas) agora usa os meses
    document.getElementById('timeVolMesSelect').innerHTML = '<option value="">Todos os Meses</option>' + meses.map(m => `<option value="${m}">${m}</option>`).join('');
    
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
    renderFunnel(); 
    renderTimeVolumeChart(); 
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

    const elReq = document.getElementById('kpiRequests');
    const elArr = document.getElementById('kpiArrives');
    const elClk = document.getElementById('kpiClicks');
    const elBases = document.getElementById('kpiBases');

    if (elReq) elReq.innerText = req.toLocaleString('en-US'); 
    if (elArr) elArr.innerText = arr.toLocaleString('en-US');
    if (elClk) elClk.innerText = clk.toLocaleString('en-US'); 
    if (elBases) elBases.innerText = basesUnicas.size;
}

// NOVO: Renderizar Funil Visual
function renderFunnel() {
    const funnelLoc = document.getElementById('funnelLocadoraSelect').value;
    const funnelContainer = document.getElementById('funnelContainer');
    if (!funnelContainer) return;

    let dataForFunnel = filteredData;
    if (funnelLoc) dataForFunnel = filteredData.filter(d => d.projeto === funnelLoc);

    let req = 0, arr = 0, shw = 0, clk = 0;
    dataForFunnel.forEach(d => {
        req += d.request;
        arr += d.arrive;
        shw += d.show;
        clk += d.click;
    });

    const formatPct = (val) => val.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 1});

    const arrPct = req > 0 ? formatPct((arr / req) * 100) : 0;
    const shwPct = req > 0 ? formatPct((shw / req) * 100) : 0;
    const ctrPct = shw > 0 ? formatPct((clk / shw) * 100) : 0;

    funnelContainer.innerHTML = `
        <div class="funnel-wrapper">
            <div class="funnel-row layer-1">
                <div class="funnel-top"></div>
                <div class="funnel-body"><span class="funnel-text">Base: ${req.toLocaleString('en-US')}</span></div>
            </div>
            
            <div class="funnel-row layer-2">
                <div class="funnel-top"></div>
                <div class="funnel-body"><span class="funnel-text">Arrive ${arrPct}%</span></div>
            </div>
            
            <div class="funnel-row layer-3">
                <div class="funnel-top"></div>
                <div class="funnel-body"><span class="funnel-text">Show ${shwPct}%</span></div>
            </div>
            
            <div class="funnel-row layer-4">
                <div class="funnel-top"></div>
                <div class="funnel-body"><span class="funnel-text">CTR ${ctrPct}%</span></div>
            </div>
        </div>
    `;
}

// NOVO: Gráfico de Semanas focado apenas no Mês escolhido
function renderTimeVolumeChart() {
    const mes = document.getElementById('timeVolMesSelect').value;
    
    // Isola as semanas com base no mês selecionado
    let dataToUse = filteredData;
    if (mes) {
        dataToUse = filteredData.filter(d => d.mes === mes);
    }
    
    // Extrai apenas as semanas presentes naquele mês específico
    const weekLabels = [...new Set(dataToUse.map(d => d.semana))];
    
    const reqTempo = weekLabels.map(wk => dataToUse.filter(d => d.semana === wk).reduce((sum, d) => sum + d.request, 0));

    const elTimeVol = document.getElementById('timeVolumeChart');
    if (elTimeVol) {
        if(charts.timeVol) charts.timeVol.destroy();
        charts.timeVol = new Chart(elTimeVol, {
            type: 'bar',
            data: { labels: weekLabels, datasets: [
                { label: 'Requests Totais', data: reqTempo, backgroundColor: '#3b82f6' }
            ]},
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

// 7. Renderizar Gráficos Chart.js 
function renderCharts() {
    const monthLabels = [...new Set(filteredData.map(d => d.mes))];
    const weekLabels = [...new Set(filteredData.map(d => d.semana))];
    const locadoras = [...new Set(filteredData.map(d => d.projeto))];

    // --- 1: Tendência de Requests por Locadora (Meses) ---
    const trendDatasets = locadoras.map(loc => {
        const dataPoint = monthLabels.map(mesTime => filteredData.filter(d => d.projeto === loc && d.mes === mesTime).reduce((sum, d) => sum + d.request, 0));
        return { label: loc, data: dataPoint, borderColor: getLocadoraColor(loc), tension: 0.3, fill: false };
    });

    const elTrend = document.getElementById('trendLocadoraChart');
    if (elTrend) {
        if(charts.trend) charts.trend.destroy();
        charts.trend = new Chart(elTrend, {
            type: 'line', data: { labels: monthLabels, datasets: trendDatasets },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // --- 2: Volumes por Locadora e Canal ---
    const canais = [...new Set(filteredData.map(d => d.canal))];
    const locadoraCanalDatasets = canais.map(canal => {
        const dataPoint = locadoras.map(loc => filteredData.filter(d => d.projeto === loc && d.canal === canal).reduce((sum, d) => sum + d.request, 0));
        return { label: canal, data: dataPoint, backgroundColor: getCanalColor(canal) };
    });

    const elLocCanal = document.getElementById('locadoraCanalChart');
    if (elLocCanal) {
        if(charts.locCanal) charts.locCanal.destroy();
        charts.locCanal = new Chart(elLocCanal, {
            type: 'bar', data: { labels: locadoras, datasets: locadoraCanalDatasets },
            options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } }
        });
    }

    // --- NOVO: Total de Cliques por Locadora ---
    const elClicksLoc = document.getElementById('clicksLocadoraChart');
    if (elClicksLoc) {
        const clicksData = locadoras.map(loc => filteredData.filter(d => d.projeto === loc).reduce((sum, d) => sum + d.click, 0));
        if(charts.clicksLoc) charts.clicksLoc.destroy();
        charts.clicksLoc = new Chart(elClicksLoc, {
            type: 'bar',
            data: { labels: locadoras, datasets: [{
                label: 'Total de Cliques', data: clicksData, backgroundColor: '#8b5cf6'
            }]},
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // --- 4: Ownership por Semana (Exceto CAIXA) ---
    const validOwnersData = filteredData.filter(d => !d.isCaixa);
    const owners = [...new Set(validOwnersData.map(d => d.ownership))];
    const ownerTimeDatasets = owners.map((owner, i) => {
        const dataPoint = weekLabels.map(wk => validOwnersData.filter(d => d.ownership === owner && d.semana === wk).length);
        const coresExtras = ['#14b8a6', '#f59e0b', '#ec4899', '#64748b'];
        return { label: owner, data: dataPoint, backgroundColor: coresExtras[i % coresExtras.length] };
    });

    const elOwnerTime = document.getElementById('ownershipTimeChart');
    if (elOwnerTime) {
        if(charts.ownerTime) charts.ownerTime.destroy();
        charts.ownerTime = new Chart(elOwnerTime, {
            type: 'bar', data: { labels: weekLabels, datasets: ownerTimeDatasets },
            options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } }
        });
    }

    // --- 5: Waves por Semana (APENAS CAIXA) ---
    const caixaData = filteredData.filter(d => d.isCaixa);
    const waves = [...new Set(caixaData.map(d => d.wave))].slice(0, 8); 
    
    const wavesDatasets = waves.map((wv, i) => {
        const dataPoint = weekLabels.map(wk => caixaData.filter(d => d.wave === wv && d.semana === wk).length);
        const palette = ['#0284c7', '#38bdf8', '#0369a1', '#bae6fd', '#0c4a6e', '#7dd3fc', '#0284c7'];
        return { label: wv, data: dataPoint, backgroundColor: palette[i % palette.length] };
    });

    const elCaixaWaves = document.getElementById('caixaWavesChart');
    if (elCaixaWaves) {
        if(charts.caixaWaves) charts.caixaWaves.destroy();
        charts.caixaWaves = new Chart(elCaixaWaves, {
            type: 'bar', data: { labels: weekLabels, datasets: wavesDatasets },
            options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } }
        });
    }
}

// 8. Tabelas
function renderTables() {
    const elOwnerBody = document.getElementById('ownershipTableBody');
    if (elOwnerBody) {
        const ownerMap = {};
        filteredData.filter(d => !d.isCaixa).forEach(d => {
            if(!ownerMap[d.ownership]) ownerMap[d.ownership] = { freq: 0, req: 0, clk: 0 };
            ownerMap[d.ownership].freq += 1;
            ownerMap[d.ownership].req += d.request;
            ownerMap[d.ownership].clk += d.click;
        });
        elOwnerBody.innerHTML = Object.entries(ownerMap).map(([owner, data]) => `<tr><td class="font-bold">${owner}</td><td>${data.freq}x</td><td>${data.req.toLocaleString('en-US')}</td><td>${data.clk.toLocaleString('en-US')}</td></tr>`).join('');
    }

    const elWavesBody = document.getElementById('wavesTableBody');
    if (elWavesBody) {
        const waveMap = {};
        filteredData.filter(d => d.isCaixa).forEach(d => {
            if(!waveMap[d.wave]) waveMap[d.wave] = { freq: 0, req: 0, clk: 0 };
            waveMap[d.wave].freq += 1;
            waveMap[d.wave].req += d.request;
            waveMap[d.wave].clk += d.click;
        });
        elWavesBody.innerHTML = Object.entries(waveMap).sort((a, b) => b[1].freq - a[1].freq).slice(0,10).map(([wave, data]) => `<tr><td class="font-bold truncate max-w-[150px]" title="${wave}">${wave}</td><td>${data.freq}x</td><td>${data.req.toLocaleString('en-US')}</td><td>${data.clk.toLocaleString('en-US')}</td></tr>`).join('');
    }

    const elRankingBody = document.getElementById('rankingTableBody');
    if (elRankingBody) {
        const baseMap = {};
        filteredData.forEach(d => {
            if(!baseMap[d.baseCrua]) baseMap[d.baseCrua] = { freq: 0, req: 0 };
            baseMap[d.baseCrua].freq += 1;
            baseMap[d.baseCrua].req += d.request;
        });
        elRankingBody.innerHTML = Object.entries(baseMap).sort((a, b) => b[1].freq - a[1].freq).slice(0, 15).map(([base, data]) => `<tr><td class="truncate max-w-[150px]" title="${base}">${base}</td><td class="font-bold">${data.freq}x</td><td>${data.req.toLocaleString('en-US')}</td></tr>`).join('');
    }
}

gapi.load('client', initAuth);
