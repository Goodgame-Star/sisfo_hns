import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hptfudqtrnyeqcqhhaeh.supabase.co'; 
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdGZ1ZHF0cm55ZXFjcWhoYWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMDEwODAsImV4cCI6MjA4Mzc3NzA4MH0.z6_4osc9GZfpZcUUyj51t4dGP3MUjq8No-hH8p9mB9U'; 

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================
// HELPER FUNCTIONS untuk Stock Management
// ============================================

/**
 * Get stock by location for a specific product
 */
export const getStockByLocation = async (kodeBarang, location) => {
    const { data, error } = await supabase
        .from('stock_locations')
        .select('*')
        .eq('kode_barang', kodeBarang)
        .eq('location', location)
        .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        console.error('Error fetching stock:', error);
        return null;
    }
    
    return data || { qty: 0 };
};

/**
 * Get all stock locations for a product
 */
export const getAllStockLocations = async (kodeBarang) => {
    const { data, error } = await supabase
        .from('stock_locations')
        .select('*')
        .eq('kode_barang', kodeBarang);
    
    if (error) {
        console.error('Error fetching all stock locations:', error);
        return [];
    }
    
    return data || [];
};

/**
 * Create stock movement (barang masuk/keluar/transfer)
 * Auto-approved untuk role tertentu, pending untuk yang lain
 */
export const createStockMovement = async (movement, currentUser) => {
    // Auto-approve untuk administrator & admin_gudang
    const autoApprove = ['administrator', 'admin_gudang'].includes(currentUser.role);
    
    const movementData = {
        ...movement,
        created_by: currentUser.id,
        status: autoApprove ? 'approved' : 'pending',
        approved_by: autoApprove ? currentUser.id : null,
        approved_at: autoApprove ? new Date().toISOString() : null
    };
    
    const { data, error } = await supabase
        .from('stock_movements')
        .insert([movementData])
        .select()
        .single();
    
    if (error) {
        console.error('Error creating stock movement:', error);
        throw error;
    }
    
    return data;
};

/**
 * Approve stock movement (untuk admin_gudang)
 */
export const approveStockMovement = async (movementId, userId) => {
    const { data, error } = await supabase
        .from('stock_movements')
        .update({
            status: 'approved',
            approved_by: userId,
            approved_at: new Date().toISOString()
        })
        .eq('id', movementId)
        .select()
        .single();
    
    if (error) {
        console.error('Error approving movement:', error);
        throw error;
    }
    
    return data;
};

/**
 * Get pending movements (untuk approval)
 */
export const getPendingMovements = async (location = null) => {
    let query = supabase
        .from('stock_movements')
        .select(`
            *,
            products!inner("NAMA BARANG", KATEGORI),
            created_by_user:users!stock_movements_created_by_fkey(name, username)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
    
    if (location && location !== 'all') {
        query = query.or(`from_location.eq.${location},to_location.eq.${location}`);
    }
    
    const { data, error } = await query;
    
    if (error) {
        console.error('Error fetching pending movements:', error);
        return [];
    }
    
    return data || [];
};

/**
 * Create daily stock check
 */
export const createDailyStockCheck = async (checkData, userId) => {
    const { data, error } = await supabase
        .from('daily_stock_checks')
        .insert([{
            ...checkData,
            checked_by: userId,
            check_date: new Date().toISOString().split('T')[0]
        }])
        .select()
        .single();
    
    if (error) {
        console.error('Error creating daily check:', error);
        throw error;
    }
    
    return data;
};

/**
 * Get daily stock checks for a location and date range
 */
export const getDailyStockChecks = async (location, startDate, endDate) => {
    const { data, error } = await supabase
        .from('daily_stock_checks')
        .select(`
            *,
            products("Kode Accurate", "NAMA BARANG", KATEGORI),
            checker:users!daily_stock_checks_checked_by_fkey(name)
        `)
        .eq('location', location)
        .gte('check_date', startDate)
        .lte('check_date', endDate)
        .order('check_date', { ascending: false });
    
    if (error) {
        console.error('Error fetching daily checks:', error);
        return [];
    }
    
    return data || [];
};

/**
 * Get unread stock alerts for a location
 */
export const getUnreadAlerts = async (location = null) => {
    let query = supabase
        .from('stock_alerts')
        .select(`
            *,
            products("Kode Accurate", "NAMA BARANG", KATEGORI, "NAMA BRAND")
        `)
        .eq('is_read', false)
        .order('created_at', { ascending: false });
    
    if (location && location !== 'all') {
        query = query.eq('location', location);
    }
    
    const { data, error } = await query;
    
    if (error) {
        console.error('Error fetching alerts:', error);
        return [];
    }
    
    return data || [];
};

/**
 * Mark alert as read
 */
export const markAlertAsRead = async (alertId, userId) => {
    const { error } = await supabase
        .from('stock_alerts')
        .update({
            is_read: true,
            read_by: userId,
            read_at: new Date().toISOString()
        })
        .eq('id', alertId);
    
    if (error) {
        console.error('Error marking alert as read:', error);
        throw error;
    }
};

/**
 * Get stock movement history for a product
 */
export const getStockHistory = async (kodeBarang, limit = 50) => {
    const { data, error } = await supabase
        .from('stock_movements')
        .select(`
            *,
            created_by_user:users!stock_movements_created_by_fkey(name),
            approved_by_user:users!stock_movements_approved_by_fkey(name)
        `)
        .eq('kode_barang', kodeBarang)
        .order('created_at', { ascending: false })
        .limit(limit);
    
    if (error) {
        console.error('Error fetching stock history:', error);
        return [];
    }
    
    return data || [];
};

/**
 * Get low stock products across all locations
 */
export const getLowStockProducts = async () => {
    const { data, error } = await supabase
        .from('stock_locations')
        .select(`
            *,
            products!inner(
                "Kode Accurate", 
                "NAMA BARANG", 
                KATEGORI, 
                "NAMA BRAND",
                min_stock
            )
        `)
        .order('qty', { ascending: true });
    
    if (error) {
        console.error('Error fetching low stock:', error);
        return [];
    }
    
    // Filter where qty < min_stock
    const lowStock = (data || []).filter(item => 
        item.qty < (item.products.min_stock || 5)
    );
    
    return lowStock;
};

/**
 * Get stock summary by location
 */
export const getStockSummaryByLocation = async (location) => {
    const { data, error } = await supabase
        .from('stock_locations')
        .select(`
            *,
            products("Kode Accurate", "NAMA BARANG", KATEGORI, "NAMA BRAND", min_stock, CP, SP, PRICE)
        `)
        .eq('location', location)
        .order('qty', { ascending: true });
    
    if (error) {
        console.error('Error fetching stock summary:', error);
        return [];
    }
    
    return data || [];
};

/**
 * Check if user has permission for action
 */
export const hasPermission = (user, action) => {
    const permissions = {
        administrator: ['all'],
        admin_gudang: ['view_all', 'approve_movement', 'manage_stock', 'view_prices'],
        staff_gudang: ['manage_stock', 'create_movement'],
        sales_toko: ['view_own_location', 'create_movement', 'daily_check'],
        sales_dealer: ['view_all', 'view_prices']
    };
    
    const userPermissions = permissions[user.role] || [];
    return userPermissions.includes('all') || userPermissions.includes(action);
};

/**
 * Can user see prices?
 */
export const canSeePrices = (userRole) => {
    return ['administrator', 'dealer'].includes(userRole);
};

