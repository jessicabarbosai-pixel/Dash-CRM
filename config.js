const CONFIG = {
    // 🔑 Credenciais Google
    SHEET_ID: '1cdQakr3EvsKlKt2Ki0Avogm8ez_AIAEy8A_nPiOaNZ4',
    SHEET_NAME: 'Controle',
    GOOGLE_CLIENT_ID: '926846773138-hssggjmr74dah1jbrobn3rffv2opubr6.apps.googleusercontent.com',
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    
    // 📊 Índices das Colunas no Google Sheets (A=0, B=1...)
    COLUMNS: {
        PROJETO: 1,      // Coluna B (Locadora)
        ENVIO: 3,        // Coluna D (Data)
        CANAL: 5,        // Coluna F (Canal - Pop up, push, xpannel)
        STATUS: 6,       // Coluna G (Status - Mapeado, Enviado...)
        DESC_BASE: 7,    // Coluna H (Descrição Base / Ownership)
        REQUEST: 11,     // Coluna L
        ARRIVE: 12,      // Coluna M
        SHOW: 14         // Coluna O
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
