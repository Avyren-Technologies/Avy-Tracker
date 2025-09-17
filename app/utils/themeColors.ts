// Reusable theme colors for consistent UI across the app
export const themeColors = {
    // Light theme colors
    light: {
        primary: '#3B82F6', // Blue-500
        secondary: '#0EA5E9', // Sky-500
        accent: '#6366F1', // Indigo-500
        background: '#F8FAFC', // Slate-50
        surface: '#FFFFFF', // White
        card: '#FFFFFF', // White
        text: '#0F172A', // Slate-900
        textSecondary: '#475569', // Slate-600
        textTertiary: '#64748B', // Slate-500
        border: '#E2E8F0', // Slate-200
        inputBackground: '#FFFFFF', // White
        inputBorder: '#E2E8F0', // Slate-200
        inputBorderFocus: '#3B82F6', // Blue-500
        inputBorderError: '#EF4444', // Red-500
        inputBorderSuccess: '#10B981', // Emerald-500
        success: '#10B981', // Emerald-500
        warning: '#F59E0B', // Amber-500
        error: '#EF4444', // Red-500
        info: '#3B82F6', // Blue-500
    },
    // Dark theme colors
    dark: {
        primary: '#60A5FA', // Blue-400
        secondary: '#38BDF8', // Sky-400
        accent: '#818CF8', // Indigo-400
        background: '#0F172A', // Slate-900
        surface: '#1E293B', // Slate-800
        card: '#1E293B', // Slate-800
        text: '#F8FAFC', // Slate-50
        textSecondary: '#CBD5E1', // Slate-300
        textTertiary: '#94A3B8', // Slate-400
        border: '#334155', // Slate-700
        inputBackground: '#1E293B', // Slate-800
        inputBorder: '#334155', // Slate-700
        inputBorderFocus: '#60A5FA', // Blue-400
        inputBorderError: '#F87171', // Red-400
        inputBorderSuccess: '#34D399', // Emerald-400
        success: '#34D399', // Emerald-400
        warning: '#FBBF24', // Amber-400
        error: '#F87171', // Red-400
        info: '#60A5FA', // Blue-400
    }
};

// Helper function to get current theme colors
export const getCurrentColors = (theme: 'light' | 'dark') => {
    return themeColors[theme];
};

// Export individual color sets for convenience
export const lightColors = themeColors.light;
export const darkColors = themeColors.dark;