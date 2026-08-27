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
            if (response.error) {
                console.error('Erro Auth:', response);
                return;
            }
            document.getElementById('authSection').classList.add('hidden');
            document.getElementById('mainDashboard').classList.remove('hidden');
            fetchData();
        },
    });
    
    document.getElementById('authBtn').addEventListener('click', () => {
        tokenClient.requestAccessToken({prompt: 'consent'});
    });
    
    document.getElementById('refreshBtn').addEventListener('click', fetchData);
    ['filterProjeto', 'filterCanal', 'filterOwnership'].forEach(id => {
        document.getElementById(id).addEventListener('change', applyFilters);
    });
}

// 2. Buscar Dados do Sheets
async function fetchData() {
    try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SHEET_ID}/values/${CONFIG.SHEET_NAME}!A:T`, {
            headers: { Authorization: `Bearer ${gapi.client.getToken().access_token}` }
        });
        const result = await response.json();
        processData(result.values);
    } catch (error) {
        console.error("Erro ao ler planilha:", error);
        alert("Erro ao ler dados. Verifique se a planilha está compartilhada e tem dados.");
    }
}

// 3. Processar e Extrair Inteligência (Ownership) da Coluna H
function processData(rows) {
    if (!rows || rows.length < 2) return;
    
    rawData = rows.slice(1).map(row => {
        const descBase = row[CONFIG.COLUMNS.DESC_BASE] || '';
        const descLower = descBase.toLowerCase();
        
        // Extrair Ownership Inteligente
        let ownership = 'Outros';
        if (descLower.includes('alugado') || descLower.includes('terceiro')) ownership = 'Alugado/Terceiro';
        else if (descLower.includes('próprio') || descLower.includes('proprio')) ownership = 'Próprio';

        // Tratar Data e Semana (Mês/Dia/Ano ou Ano-Mes-Dia)
        let dataStr = row[CONFIG.COLUMNS.ENVIO] || '';
        let weekLabel = 'Sem Data';
        if (dataStr) {
            let d = new Date(dataStr);
            if (!isNaN(d)) {
                // Formatar para exibição "Semana: 01/Jan"
                weekLabel = d.toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'});
            }
        }

        return {
            projeto: (row[CONFIG.COLUMNS.PROJETO] || 'Sem Projeto').trim(),
            canal: (row[CONFIG.COLUMNS.CANAL] || 'Sem Canal').trim(),
            semana: weekLabel,
            baseCrua: descBase.trim() || 'Sem Base Definida',
            ownership: ownership,
            request: parseFloat(String(row[CONFIG.COLUMNS.REQUEST]).replace(/[^\d.,-]/g, '').replace(',', '.')) || 0,
            ctr: parseFloat(String(row[CONFIG.COLUMNS.CTR]).replace(/[^\d.,-]/g, '').replace(',', '.')) || 0
        };
    }).filter(item => item.projeto !== 'Sem Projeto');

    populateFilters();
    applyFilters();
}

// 4. Preencher Filtros HTML
function populateFilters() {
    const projetos = [...new Set(rawData.map(d => d.projeto))].sort();
    const canais = [...new Set(rawData.map(d => d.canal))].sort();

    const projSelect = document.getElementById('filterProjeto');
    projSelect.innerHTML = '<option value="">Todas</option>' + projetos.map(p => `<option value="${p}">${p}</option>`).join('');
    
    const canalSelect = document.getElementById('filterCanal');
    canalSelect.innerHTML = '<option value="">Todos</option>' + canais.map(c => `<option value="${c}">${c}</option>`).join('');
}

// 5. Aplicar Filtros e Atualizar Tela
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
    renderRankingTable();
}

// 6. Atualizar Cards Principais
function updateKPIs() {
    let totalReq = 0;
    let somaCTR = 0;
    let ctrCount = 0;
    
    // Para achar a Top Base
    const baseCount = {};

    filteredData.forEach(d => {
        totalReq += d.request;
        if (d.ctr > 0) { somaCTR += d.ctr; ctrCount++; }
        
        if (!baseCount[d.baseCrua]) baseCount[d.baseCrua] = 0;
        baseCount[d.baseCrua] += d.request;
    });

    const avgCTR = ctrCount > 0 ? (somaCTR / ctrCount) : 0;
    
    // Descobrir a base mais alta
    let topBaseName = '-';
    let maxBaseReq = 0;
    for (const [name, req] of Object.entries(baseCount)) {
        if (req > maxBaseReq) { maxBaseReq = req; topBaseName = name; }
    }

    document.getElementById('kpiRequests').innerText = totalReq.toLocaleString('pt-BR');
    document.getElementById('kpiCTR').innerText = avgCTR.toFixed(2) + '%';
    document.getElementById('kpiTopBase').innerText = topBaseName;
}

// 7. Atualizar Gráficos (Chart.js)
function renderCharts() {
    // ---- Gráfico de Tendência (Requests por Semana) ----
    const weekMap = {};
    filteredData.forEach(d => {
        if (!weekMap[d.semana]) weekMap[d.semana] = 0;
        weekMap[d.semana] += d.request;
    });

    const weeks = Object.keys(weekMap).sort(); // Idealmente ordenar por data real
    const weekData = weeks.map(w => weekMap[w]);

    if(charts.trend) charts.trend.destroy();
    charts.trend = new Chart(document.getElementById('trendChart'), {
        type: 'line',
        data: {
            labels: weeks,
            datasets: [{
                label: 'Requests Totais',
                data: weekData,
                borderColor: CONFIG.COLORS.primary,
                backgroundColor: 'rgba(102, 126, 234, 0.2)',
                tension: 0.3,
                fill: true
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // ---- Gráfico Locadora por Canal ----
    const locMap = {};
    const canaisExistentes = [...new Set(filteredData.map(d => d.canal))];
    
    filteredData.forEach(d => {
        if (!locMap[d.projeto]) {
            locMap[d.projeto] = {};
            canaisExistentes.forEach(c => locMap[d.projeto][c] = 0);
        }
        locMap[d.projeto][d.canal] += d.request;
    });

    const locadoras = Object.keys(locMap);
    const datasets = canaisExistentes.map((canal, index) => {
        const cores = [CONFIG.COLORS.primary, CONFIG.COLORS.warning, CONFIG.COLORS.success, CONFIG.COLORS.info];
        return {
            label: canal,
            data: locadoras.map(loc => locMap[loc][canal]),
            backgroundColor: cores[index % cores.length]
        };
    });

    if(charts.locadora) charts.locadora.destroy();
    charts.locadora = new Chart(document.getElementById('locadoraChart'), {
        type: 'bar',
        data: { labels: locadoras, datasets: datasets },
        options: { 
            responsive: true, maintainAspectRatio: false,
            scales: { x: { stacked: true }, y: { stacked: true } }
        }
    });
}

// 8. Tabela de Ranking de Bases
function renderRankingTable() {
    const baseAgrupada = {};
    
    filteredData.forEach(d => {
        if (!baseAgrupada[d.baseCrua]) {
            baseAgrupada[d.baseCrua] = { req: 0, ctrSum: 0, ctrCount: 0, ownership: d.ownership };
        }
        baseAgrupada[d.baseCrua].req += d.request;
        if (d.ctr > 0) {
            baseAgrupada[d.baseCrua].ctrSum += d.ctr;
            baseAgrupada[d.baseCrua].ctrCount++;
        }
    });

    const ranking = Object.entries(baseAgrupada)
        .sort((a, b) => b[1].req - a[1].req)
        .slice(0, 20); // Top 20

    const tbody = document.getElementById('rankingTableBody');
    tbody.innerHTML = ranking.map(item => {
        const name = item[0];
        const data = item[1];
        const avgCtr = data.ctrCount > 0 ? (data.ctrSum / data.ctrCount).toFixed(2) : 0;
        
        let badgeColor = data.ownership === 'Próprio' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
        if(data.ownership === 'Outros') badgeColor = 'bg-gray-100 text-gray-800';

        return `<tr>
            <td class="font-medium max-w-xs truncate" title="${name}">${name}</td>
            <td><span class="px-2 py-1 rounded text-xs font-bold ${badgeColor}">${data.ownership}</span></td>
            <td>${data.req.toLocaleString('pt-BR')}</td>
            <td>${avgCtr}%</td>
        </tr>`;
    }).join('');
}

// Carregar APIs
gapi.load('client', () => {
    initAuth();
});
