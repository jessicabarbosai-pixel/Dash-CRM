let rawData = [];
let filteredData = [];
let charts = {};
let tokenClient;

// Color Helpers
const getLocadoraColor = (nome) => CONFIG.COLORS.LOCADORAS[nome] || CONFIG.COLORS.LOCADORAS['DEFAULT'];
const getCanalColor = (nome) => CONFIG.COLORS.CANAIS[nome] || CONFIG.COLORS.CANAIS['DEFAULT'];

// 1. Initialization
function initAuth() {
    const savedToken = localStorage.getItem('google_access_token');
    const tokenExpiry = localStorage.getItem('google_token_expiry');

    if (savedToken && tokenExpiry && Date.now() < parseInt(tokenExpiry)) {
        document.getElementById('authSection').classList.add('hidden');
        document.getElementById('mainDashboard').classList.remove('hidden');
        fetchData();
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        scope: CONFIG.SCOPES,
        callback: (response) => {
            if (response.error) { console.error('Auth Error:', response); return; }
            localStorage.setItem('google_access_token', response.access_token);
            localStorage.setItem('google_token_expiry', Date.now() + (response.expires_in * 1000));
            document.getElementById('authSection').classList.add('hidden');
            document.getElementById('mainDashboard').classList.remove('hidden');
            fetchData();
        },
    });
    
    document.getElementById('authBtn').addEventListener('click', () => { tokenClient.requestAccessToken({prompt: 'consent'}); });
    document.getElementById('refreshBtn').addEventListener('click', fetchData);
    
    ['filterSaida', 'filterProjeto', 'filterCanal', 'filterOwnership', 'filterLoyalty', 'filterMes'].forEach(id => {
        document.getElementById(id).addEventListener('change', applyFilters);
    });

    document.getElementById('funnelLocadoraSelect').addEventListener('change', renderFunnel);
    document.getElementById('timeVolMesSelect').addEventListener('change', renderTimeVolumeChart);
    document.getElementById('caixaMesSelect').addEventListener('change', renderCaixaWavesChart);
}

// 2. Fetch Data
async function fetchData() {
    try {
        const token = localStorage.getItem('google_access_token');
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SHEET_ID}/values/${CONFIG.SHEET_NAME}!A:Z`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.status === 401) {
            localStorage.removeItem('google_access_token');
            localStorage.removeItem('google_token_expiry');
            document.getElementById('authSection').classList.remove('hidden');
            document.getElementById('mainDashboard').classList.add('hidden');
            return;
        }

        const result = await response.json();
        processData(result.values);
    } catch (error) {
        console.error("Spreadsheet Error:", error);
    }
}

const parseNum = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    let str = String(val).trim();
    str = str.replace(/,/g, '');
    return parseFloat(str) || 0;
};

// 3. Process Data
function processData(rows) {
    if (!rows || rows.length < 2) return;
    
    let processed = [];
    
    for(let i = 1; i < rows.length; i++) {
        const row = rows[i];
        
        let saida = (row[CONFIG.COLUMNS.SAIDA] || '').trim().toUpperCase().replace(/-/g, ' '); 
        if (saida === 'ENTREGAFRETE' || saida === 'ENTREGA FRETE') saida = 'ENTREGA FRETE';

        let projeto = (row[CONFIG.COLUMNS.PROJETO] || '').trim().toUpperCase().replace(/\s+/g, ' '); 
        let canal = (row[CONFIG.COLUMNS.CANAL] || '').trim().toUpperCase().replace(/-/g, ' ').replace(/\s+/g, ' ');
        if (canal === 'POPUP') canal = 'POP UP';
        if (canal === 'XPANNEL' || canal === 'X PANEL') canal = 'X PANNEL';

        let status = (row[CONFIG.COLUMNS.STATUS] || '').trim().toLowerCase();
        
        // Exclusions
        if (!canal || !projeto || status.includes('mapead') || status.includes('cancelad')) continue;
        
        let dataStr = row[CONFIG.COLUMNS.ENVIO] || '';
        let weekLabel = 'No Date';
        let monthLabel = 'No Date';
        let rawDate = new Date(0);

        if (dataStr) {
            let d = new Date(dataStr);
            d = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
            if (!isNaN(d)) {
                rawDate = d;
                let nomeMes = d.toLocaleDateString('en-US', { month: 'long' });
                monthLabel = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
                let weekOfMonth = Math.ceil(d.getDate() / 7);
                weekLabel = `${monthLabel} - Wk ${weekOfMonth}`;
            }
        }

        let descBase = (row[CONFIG.COLUMNS.DESC_BASE] || '').trim();
        descBase = descBase.replace(/lotes/gi, 'Lot').replace(/lote/gi, 'Lot').replace(/\s+/g, ' ').trim();
        if (descBase) {
            descBase = descBase.charAt(0).toUpperCase() + descBase.slice(1);
        }

        const ownerCol = (row[CONFIG.COLUMNS.OWNERSHIP] || '').trim();
        const combinedOwnerText = (ownerCol + " " + descBase).toLowerCase();
        
        let isCaixa = projeto === 'CAIXA';
        let ownership = 'Others/Not Identified';
        let wave = 'N/A';

        // NOTE: The spreadsheet logic still looks for Portuguese words, but displays in English
        if (isCaixa) {
            ownership = 'Ignored (CAIXA)';
            wave = descBase || 'Undefined Base';
        } else {
            if (combinedOwnerText.includes('alugado') && (combinedOwnerText.includes('terceiro') || combinedOwnerText.includes('terceirizad'))) {
                ownership = 'Rented & Third-Party';
            } else if (combinedOwnerText.includes('alugado')) {
                ownership = 'Rented';
            } else if (combinedOwnerText.includes('terceiro') || combinedOwnerText.includes('terceirizad')) {
                ownership = 'Third-Party';
            } else if (combinedOwnerText.includes('próprio') || combinedOwnerText.includes('proprio')) {
                ownership = 'Owned';
            }
        }

        const loyaltyCol = (row[CONFIG.COLUMNS.LOYALTY] || '').trim();
        const combinedLoyaltyText = (loyaltyCol + " " + descBase).toLowerCase();
        let loyalty = 'Not Informed';
        
        if (combinedLoyaltyText.includes('l4') || combinedLoyaltyText.includes('loyalty 4')) loyalty = 'L4';
        else if (combinedLoyaltyText.includes('l3') || combinedLoyaltyText.includes('loyalty 3') || combinedLoyaltyText.includes('>= 3')) loyalty = 'L3';
        else if (combinedLoyaltyText.includes('l2') || combinedLoyaltyText.includes('loyalty 2') || combinedLoyaltyText.includes('>= 2')) loyalty = 'L2';
        else if (combinedLoyaltyText.includes('l1') || combinedLoyaltyText.includes('loyalty 1')) loyalty = 'L1';

        processed.push({
            saida: saida || 'UNDEFINED', 
            projeto, canal, dataInt: rawDate.getTime(), semana: weekLabel, mes: monthLabel,
            baseCrua: descBase || 'Generic Base',
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

// 4. Fill Filters
function populateFilters() {
    const saidas = [...new Set(rawData.map(d => d.saida))].sort();
    const projetos = [...new Set(rawData.map(d => d.projeto))].sort();
    const canais = [...new Set(rawData.map(d => d.canal))].sort();
    const owners = [...new Set(rawData.filter(d => !d.isCaixa).map(d => d.ownership))].sort();
    const loyalties = [...new Set(rawData.map(d => d.loyalty))].sort();
    const meses = [...new Set(rawData.map(d => d.mes))];

    document.getElementById('filterSaida').innerHTML = '<option value="">All Outputs</option>' + saidas.map(s => `<option value="${s}">${s}</option>`).join('');
    const projHtml = '<option value="">All</option>' + projetos.map(p => `<option value="${p}">${p}</option>`).join('');
    const mesHtml = '<option value="">All Months</option>' + meses.map(m => `<option value="${m}">${m}</option>`).join('');
    
    document.getElementById('filterProjeto').innerHTML = projHtml;
    document.getElementById('funnelLocadoraSelect').innerHTML = '<option value="">All Companies</option>' + projetos.map(p => `<option value="${p}">${p}</option>`).join('');
    
    document.getElementById('filterMes').innerHTML = mesHtml;
    document.getElementById('timeVolMesSelect').innerHTML = mesHtml;
    document.getElementById('caixaMesSelect').innerHTML = mesHtml;
    
    document.getElementById('filterCanal').innerHTML = '<option value="">All</option>' + canais.map(c => `<option value="${c}">${c}</option>`).join('');
    document.getElementById('filterOwnership').innerHTML = '<option value="">All</option>' + owners.map(o => `<option value="${o}">${o}</option>`).join('');
    document.getElementById('filterLoyalty').innerHTML = '<option value="">All</option>' + loyalties.map(l => `<option value="${l}">${l}</option>`).join('');
}

// 5. Apply Filters
function applyFilters() {
    const fSaida = document.getElementById('filterSaida').value;
    const fProjeto = document.getElementById('filterProjeto').value;
    const fCanal = document.getElementById('filterCanal').value;
    const fOwner = document.getElementById('filterOwnership').value;
    const fLoyalty = document.getElementById('filterLoyalty').value;
    const fMes = document.getElementById('filterMes').value;
    
    filteredData = rawData.filter(d => {
        return (!fSaida || d.saida === fSaida) &&
               (!fProjeto || d.projeto === fProjeto) &&
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
    renderCaixaWavesChart();
}

// 6. Update Scorecards
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

// Render Funnel
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

    const formatPct = (val) => val.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 1});

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

// Render Weekly Request Volumes
function renderTimeVolumeChart() {
    const mes = document.getElementById('timeVolMesSelect').value;
    let dataToUse = filteredData;
    if (mes) dataToUse = filteredData.filter(d => d.mes === mes);
    
    const weekLabels = [...new Set(dataToUse.map(d => d.semana))];
    const reqTempo = weekLabels.map(wk => dataToUse.filter(d => d.semana === wk).reduce((sum, d) => sum + d.request, 0));

    const elTimeVol = document.getElementById('timeVolumeChart');
    if (elTimeVol) {
        if(charts.timeVol) charts.timeVol.destroy();
        charts.timeVol = new Chart(elTimeVol, {
            type: 'bar',
            data: { labels: weekLabels, datasets: [{ label: 'Total Requests', data: reqTempo, backgroundColor: '#3b82f6' }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

// Render Caixa Waves
function renderCaixaWavesChart() {
    const mes = document.getElementById('caixaMesSelect').value;
    let dataToUse = filteredData.filter(d => d.isCaixa);
    if (mes) dataToUse = dataToUse.filter(d => d.mes === mes);

    const waveMap = {};
    dataToUse.forEach(d => {
        if(!waveMap[d.wave]) waveMap[d.wave] = 0;
        waveMap[d.wave] += d.request;
    });

    const sortedWaves = Object.entries(waveMap).sort((a,b) => b[1] - a[1]).slice(0, 8);
    
    const elCaixaWaves = document.getElementById('caixaWavesChart');
    if (elCaixaWaves) {
        if(charts.caixaWaves) charts.caixaWaves.destroy();
        charts.caixaWaves = new Chart(elCaixaWaves, {
            type: 'bar', 
            data: { 
                labels: sortedWaves.map(w => w[0]), 
                datasets: [{ label: 'Volume', data: sortedWaves.map(w => w[1]), backgroundColor: '#0284c7', borderRadius: 4 }]
            },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
}

// 7. Render Charts
function renderCharts() {
    const monthLabels = [...new Set(filteredData.map(d => d.mes))];
    const weekLabels = [...new Set(filteredData.map(d => d.semana))];
    const locadoras = [...new Set(filteredData.map(d => d.projeto))];

    // --- Efficiency by Channel (CTR) ---
    const elCtrCanal = document.getElementById('ctrCanalChart');
    if (elCtrCanal) {
        const canaisAtivos = [...new Set(filteredData.map(d => d.canal))];
        const canalStats = canaisAtivos.map(c => {
            const dadosCanal = filteredData.filter(d => d.canal === c);
            const shw = dadosCanal.reduce((acc, d) => acc + d.show, 0);
            const clk = dadosCanal.reduce((acc, d) => acc + d.click, 0);
            const ctr = shw > 0 ? (clk / shw) * 100 : 0;
            return { canal: c, ctr: ctr, color: getCanalColor(c) };
        }).sort((a, b) => b.ctr - a.ctr);

        if(charts.ctrCanal) charts.ctrCanal.destroy();
        charts.ctrCanal = new Chart(elCtrCanal, {
            type: 'bar',
            data: {
                labels: canalStats.map(c => c.canal),
                datasets: [{ label: 'CTR (%)', data: canalStats.map(c => c.ctr), backgroundColor: canalStats.map(c => c.color), borderRadius: 4 }]
            },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    // --- Loyalty Distribution ---
    const elLoyalty = document.getElementById('loyaltyChart');
    if (elLoyalty) {
        const loyaltiesUnicos = ['L1', 'L2', 'L3', 'L4', 'Not Informed'];
        const loyaltyStats = loyaltiesUnicos.map(l => filteredData.filter(d => d.loyalty === l).reduce((acc, d) => acc + d.request, 0));
        const loyaltyColors = ['#94a3b8', '#3b82f6', '#8b5cf6', '#eab308', '#e2e8f0']; 

        if(charts.loyalty) charts.loyalty.destroy();
        charts.loyalty = new Chart(elLoyalty, {
            type: 'bar',
            data: {
                labels: loyaltiesUnicos,
                datasets: [{ label: 'Total Requests', data: loyaltyStats, backgroundColor: loyaltyColors, borderRadius: 4 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    // --- Request Trend by Company ---
    const elTrend = document.getElementById('trendLocadoraChart');
    if (elTrend) {
        const trendDatasets = locadoras.map(loc => {
            const dataPoint = monthLabels.map(mesTime => filteredData.filter(d => d.projeto === loc && d.mes === mesTime).reduce((sum, d) => sum + d.request, 0));
            return { label: loc, data: dataPoint, borderColor: getLocadoraColor(loc), tension: 0.3, fill: false };
        });
        if(charts.trend) charts.trend.destroy();
        charts.trend = new Chart(elTrend, { type: 'line', data: { labels: monthLabels, datasets: trendDatasets }, options: { responsive: true, maintainAspectRatio: false } });
    }

    // --- Volumes by Company and Channel ---
    const elLocCanal = document.getElementById('locadoraCanalChart');
    if (elLocCanal) {
        const canais = [...new Set(filteredData.map(d => d.canal))];
        const locadoraCanalDatasets = canais.map(canal => {
            const dataPoint = locadoras.map(loc => filteredData.filter(d => d.projeto === loc && d.canal === canal).reduce((sum, d) => sum + d.request, 0));
            return { label: canal, data: dataPoint, backgroundColor: getCanalColor(canal) };
        });
        if(charts.locCanal) charts.locCanal.destroy();
        charts.locCanal = new Chart(elLocCanal, { type: 'bar', data: { labels: locadoras, datasets: locadoraCanalDatasets }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } } });
    }

    // --- Total Clicks by Company ---
    const elClicksLoc = document.getElementById('clicksLocadoraChart');
    if (elClicksLoc) {
        const clicksData = locadoras.map(loc => filteredData.filter(d => d.projeto === loc).reduce((sum, d) => sum + d.click, 0));
        if(charts.clicksLoc) charts.clicksLoc.destroy();
        charts.clicksLoc = new Chart(elClicksLoc, { type: 'bar', data: { labels: locadoras, datasets: [{ label: 'Total Clicks', data: clicksData, backgroundColor: '#8b5cf6' }] }, options: { responsive: true, maintainAspectRatio: false } });
    }

    // --- Ownership per Week ---
    const elOwnerTime = document.getElementById('ownershipTimeChart');
    if (elOwnerTime) {
        const validOwnersData = filteredData.filter(d => !d.isCaixa);
        const owners = [...new Set(validOwnersData.map(d => d.ownership))];
        const ownerTimeDatasets = owners.map((owner, i) => {
            const dataPoint = weekLabels.map(wk => validOwnersData.filter(d => d.ownership === owner && d.semana === wk).length);
            const coresExtras = ['#14b8a6', '#f59e0b', '#ec4899', '#64748b', '#3b82f6', '#ef4444', '#8b5cf6'];
            return { label: owner, data: dataPoint, backgroundColor: coresExtras[i % coresExtras.length] };
        });
        if(charts.ownerTime) charts.ownerTime.destroy();
        charts.ownerTime = new Chart(elOwnerTime, { type: 'bar', data: { labels: weekLabels, datasets: ownerTimeDatasets }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } } });
    }
}

// 8. Bottom Tables
function renderTables() {
    const formatUS = (n) => n.toLocaleString('en-US');

    // Ownership Table
    const elOwnerBody = document.getElementById('ownershipTableBody');
    if (elOwnerBody) {
        const ownerMap = {};
        filteredData.filter(d => !d.isCaixa).forEach(d => {
            if(!ownerMap[d.ownership]) ownerMap[d.ownership] = { freq: 0, req: 0, clk: 0 };
            ownerMap[d.ownership].freq += 1;
            ownerMap[d.ownership].req += d.request;
            ownerMap[d.ownership].clk += d.click;
        });
        elOwnerBody.innerHTML = Object.entries(ownerMap).map(([owner, data]) => `<tr><td class="font-bold">${owner}</td><td>${data.freq}x</td><td>${formatUS(data.req)}</td><td>${formatUS(data.clk)}</td></tr>`).join('');
    }

    // Waves Table
    const elWavesBody = document.getElementById('wavesTableBody');
    if (elWavesBody) {
        const waveMap = {};
        filteredData.filter(d => d.isCaixa).forEach(d => {
            if(!waveMap[d.wave]) waveMap[d.wave] = { freq: 0, req: 0, clk: 0 };
            waveMap[d.wave].freq += 1;
            waveMap[d.wave].req += d.request;
            waveMap[d.wave].clk += d.click;
        });
        elWavesBody.innerHTML = Object.entries(waveMap).sort((a, b) => b[1].freq - a[1].freq).slice(0,10).map(([wave, data]) => `<tr><td class="font-bold truncate max-w-[150px]" title="${wave}">${wave}</td><td>${data.freq}x</td><td>${formatUS(data.req)}</td><td>${formatUS(data.clk)}</td></tr>`).join('');
    }

    // Ranking
    const baseMap = {};
    filteredData.forEach(d => {
        if(!baseMap[d.baseCrua]) baseMap[d.baseCrua] = { freq: 0, req: 0 };
        baseMap[d.baseCrua].freq += 1;
        baseMap[d.baseCrua].req += d.request;
    });

    const elRankingBody = document.getElementById('rankingTableBody');
    if (elRankingBody) {
        elRankingBody.innerHTML = Object.entries(baseMap).sort((a, b) => b[1].freq - a[1].freq).slice(0, 15).map(([base, data]) => `<tr><td class="truncate max-w-[150px]" title="${base}">${base}</td><td class="font-bold">${data.freq}x</td><td>${formatUS(data.req)}</td></tr>`).join('');
    }

    // CTR Table
    const elRankingCtrBody = document.getElementById('rankingCtrTableBody');
    if (elRankingCtrBody) {
        const baseCtrMap = {};
        filteredData.forEach(d => {
            if(!baseCtrMap[d.baseCrua]) baseCtrMap[d.baseCrua] = { req: 0, shw: 0, clk: 0 };
            baseCtrMap[d.baseCrua].req += d.request;
            baseCtrMap[d.baseCrua].shw += d.show;
            baseCtrMap[d.baseCrua].clk += d.click;
        });

        const topCtr = Object.entries(baseCtrMap)
            .filter(([_, data]) => data.req >= 100) 
            .map(([base, data]) => {
                const ctr = data.shw > 0 ? (data.clk / data.shw) * 100 : 0;
                return { base, req: data.req, shw: data.shw, ctr };
            })
            .sort((a, b) => b.ctr - a.ctr)
            .slice(0, 15);

        elRankingCtrBody.innerHTML = topCtr.map(data => `<tr><td class="truncate max-w-[150px]" title="${data.base}">${data.base}</td><td>${formatUS(data.req)}</td><td>${formatUS(data.shw)}</td><td class="font-bold text-green-600">${data.ctr.toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%</td></tr>`).join('');
    }
}

// Start
gapi.load('client', initAuth);
