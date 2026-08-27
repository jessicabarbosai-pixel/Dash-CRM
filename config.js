const CONFIG = {
    // 🔑 Credenciais Google
    SHEET_ID: '1cdQakr3EvsKlKt2Ki0Avogm8ez_AIAEy8A_nPiOaNZ4',
    SHEET_NAME: 'Controle',
    
    // NOVO CLIENT ID COLOCADO AQUI:
    GOOGLE_CLIENT_ID: '926846773138-hssggjmr74dah1jbrobn3rffv2opubr6.apps.googleusercontent.com',
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    
    // 📊 Índices das Colunas no Google Sheets
    COLUMNS: {
        PROJETO: 1,      
        TIPO: 2,         
        ENVIO: 3,        
        CANAL: 5,        
        DESC_BASE: 7,    
        REQUEST: 11,     
        CLICK: 16,       
        CTR: 18          
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
