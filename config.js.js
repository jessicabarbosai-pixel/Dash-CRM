const CONFIG = {
    // 🔑 Credenciais Google
    SHEET_ID: '1cdQakr3EvsKlKt2Ki0Avogm8ez_AIAEy8A_nPiOaNZ4',
    SHEET_NAME: 'Controle',
    GOOGLE_CLIENT_ID: '926846773138-hssggjmr74dah1jbrobn3rffv2opubr6.apps.googleusercontent.com',
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    
    // 📊 Índices das Colunas no Google Sheets (0 = A, 1 = B, etc)
    COLUMNS: {
        PROJETO: 1,      // Coluna B (Locadora)
        TIPO: 2,         // Coluna C
        ENVIO: 3,        // Coluna D (Data)
        CANAL: 5,        // Coluna F (Canal)
        DESC_BASE: 7,    // Coluna H (Descrição Base / Ownership)
        REQUEST: 11,     // Coluna L (Request / Volume)
        CLICK: 16,       // Coluna Q (Click)
        CTR: 18          // Coluna S (CTR)
    },
    
    // 🎨 Cores do Dashboard
    COLORS: {
        primary: '#667eea',
        secondary: '#764ba2',
        success: '#48bb78',
        warning: '#ed8936',
        info: '#4299e1',
        locadoras: {
            'BR22': '#4299e1',
            'Seteloc': '#48bb78',
            'Movida': '#ed8936',
            'Foco': '#f56565',
            'Nexovia': '#9f7aea'
        }
    }
};
