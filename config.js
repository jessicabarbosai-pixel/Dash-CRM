const CONFIG = {
    // 🔑 Credenciais Google
    SHEET_ID: '1cdQakr3EvsKlKt2Ki0Avogm8ez_AIAEy8A_nPiOaNZ4',
    SHEET_NAME: 'Controle',
    GOOGLE_CLIENT_ID: '926846773138-hssggjmr74dah1jbrobn3rffv2opubr6.apps.googleusercontent.com',
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    
    // 📊 Índices EXATOS das Colunas na aba "Controle" (A=0, B=1, C=2...)
    COLUMNS: {
        PROJETO: 2,      // Coluna C (Locadora)
        ENVIO: 4,        // Coluna E (Data)
        CANAL: 5,        // Coluna F (Canal)
        STATUS: 6,       // Coluna G (Status)
        OWNERSHIP: 8,    // Coluna I (Ownership)
        LOYALTY: 9,      // Coluna J (Loyalty)
        DESC_BASE: 12,   // Coluna M (Descrição Base)
        REQUEST: 17,     // Coluna R (Request)
        ARRIVE: 18,      // Coluna S (Arrive/Exposure)
        SHOW: 20,        // Coluna U (Show)
        CLICK: 22        // Coluna W (Click)
    },
    
    // 🎨 Cores Fixas para Locadoras e Canais
    COLORS: {
        LOCADORAS: {
            'MOVIDA': '#f97316',   // Laranja
            'CAIXA': '#0284c7',    // Azul Escuro (Caixa)
            'SETELOC': '#10b981',  // Verde
            'MAESTRO': '#eab308',  // Amarelo
            'FOCO': '#ef4444',     // Vermelho
            'BR22': '#8b5cf6',     // Roxo
            'AUTOMOB': '#64748b',  // Cinza Azulado
            'UNIDAS': '#14b8a6',   // Teal
            'AVISO': '#ec4899',    // Rosa
            'DEFAULT': '#94a3b8'   // Cinza Padrão
        },
        CANAIS: {
            'POP UP': '#3b82f6',   // Azul Vivo
            'PUSH': '#8b5cf6',     // Roxo
            'X PANNEL': '#f59e0b', // Laranja
            'XPANNEL': '#f59e0b',
            'WHATSAPP': '#10b981', // Verde
            'EMAIL': '#ef4444',    // Vermelho
            'DEFAULT': '#94a3b8'
        }
    }
};
