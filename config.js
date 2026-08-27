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
        SHOW: 20         // Coluna U (Show)
    },
    
    // 🎨 Cores do Dashboard
    COLORS: {
        primary: '#4f46e5',
        secondary: '#0ea5e9',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        purple: '#8b5cf6',
        gray: '#64748b'
    }
};
