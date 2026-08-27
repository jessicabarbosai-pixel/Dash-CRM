const CONFIG = {
    // 🔑 Credenciais Google
    SHEET_ID: '1cdQakr3EvsKlKt2Ki0Avogm8ez_AIAEy8A_nPiOaNZ4',
    SHEET_NAME: 'Controle',
    GOOGLE_CLIENT_ID: '926846773138-hssggjmr74dah1jbrobn3rffv2opubr6.apps.googleusercontent.com',
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    
    // 📊 Índices EXATOS das Colunas na aba "Controle" (A=0, B=1, C=2...)
    COLUMNS: {
        SAIDA: 1,        // Coluna B (Saída: Fura Fila, CRM, Entregafrete)
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
        CLICK: 22        // Coluna W (Cliques)
    },
    
    // 🎨 Cores Fixas para Locadoras e Canais
    COLORS: {
        LOCADORAS: {
            'MOVIDA': '#f97316',   
            'CAIXA': '#0284c7',    
            'SETELOC': '#10b981',  
            'MAESTRO': '#eab308',  
            'FOCO': '#ef4444',     
            'BR22': '#8b5cf6',     
            'AUTOMOB': '#64748b',  
            'UNIDAS': '#14b8a6',   
            'AVISO': '#ec4899',    
            'DEFAULT': '#94a3b8'   
        },
        CANAIS: {
            'POP UP': '#3b82f6',   
            'PUSH': '#8b5cf6',     
            'X PANNEL': '#f59e0b', 
            'XPANNEL': '#f59e0b',
            'WHATSAPP': '#10b981', 
            'EMAIL': '#ef4444',    
            'DEFAULT': '#94a3b8'
        }
    }
};
