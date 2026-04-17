// GCS Command Center — Mock Backend & Database (LocalStorage v4)
// Schema: accounts, staff, sites, siteTasks, inventory, shifts, feedEvents, chatHistory

const DB_KEY = 'gcs_database_v4';

const DEFAULT_CLEANER_TASKS = [
    'Vacuum all carpeted areas',
    'Mop hard floors',
    'Sanitize restrooms',
    'Restock paper products & soap',
    'Wipe down surfaces & fixtures',
    'Empty trash bins'
];

const DEFAULT_MAINTENANCE_TASKS = [
    'Inspect HVAC filters',
    'Check plumbing fixtures',
    'Test emergency lighting',
    'Lubricate door hinges & locks',
    'Report any equipment faults'
];

class Database {
    constructor() {
        this.memoryStore = null;
        this.activeSession = null;
        this.data = this.loadData();
        if (!this.data) this.seedData();

        try {
            window.addEventListener('storage', (e) => {
                if (e.key === DB_KEY) {
                    this.data = JSON.parse(e.newValue);
                    this.triggerUpdate();
                }
            });
        } catch (err) {}
    }

    loadData() {
        try {
            const raw = localStorage.getItem(DB_KEY);
            return raw ? JSON.parse(raw) : (this.memoryStore || null);
        } catch (err) {
            return this.memoryStore || null;
        }
    }

    saveData() {
        this.memoryStore = this.data;
        try { localStorage.setItem(DB_KEY, JSON.stringify(this.data)); } catch (err) {}
        this.triggerUpdate();
    }

    triggerUpdate() {
        window.dispatchEvent(new CustomEvent('db-update', { detail: { data: this.data } }));
    }

    clearData() {
        localStorage.removeItem(DB_KEY);
        this.memoryStore = null;
        this.activeSession = null;
        this.seedData();
    }

    // Stable invoice amount derived from siteId (no randomness per render)
    computeInvoiceAmount(siteId) {
        let hash = 0;
        for (let i = 0; i < siteId.length; i++) {
            hash = ((hash << 5) - hash + siteId.charCodeAt(i)) & 0xFFFFFF;
        }
        return 500 + (Math.abs(hash) % 4500);
    }

    seedData() {
        const now = new Date();
        const minNow = (mins) => new Date(now.getTime() + 1000 * 60 * mins).toISOString();

        this.data = {
            accounts: [
                { id: 'U1', username: 'manager', password: 'password', role: 'manager', staffId: null },
                { id: 'U2', username: 'alice',   password: 'password', role: 'staff',   staffId: 'S1' },
                { id: 'U3', username: 'bob',     password: 'password', role: 'staff',   staffId: 'S2' }
            ],
            staff: [
                { id: 'S1', name: 'Alice Walker',    avatar: 'AW', hours: 32, type: 'cleaner',     phone: '555-0101', email: 'alice@gcs.com' },
                { id: 'S2', name: 'Bob Smith',       avatar: 'BS', hours: 40, type: 'maintenance', phone: '555-0102', email: 'bob@gcs.com' },
                { id: 'S3', name: 'Charlie Davis',   avatar: 'CD', hours: 28, type: 'cleaner',     phone: '555-0103', email: 'charlie@gcs.com' },
                { id: 'S4', name: 'Diana Prince',    avatar: 'DP', hours: 38, type: 'cleaner',     phone: '555-0104', email: 'diana@gcs.com' },
                { id: 'S5', name: 'Evan Wright',     avatar: 'EW', hours: 20, type: 'maintenance', phone: '555-0105', email: 'evan@gcs.com' },
                { id: 'S6', name: 'Fiona Gallagher', avatar: 'FG', hours: 42, type: 'cleaner',     phone: '555-0106', email: 'fiona@gcs.com' },
                { id: 'S7', name: 'George Miller',   avatar: 'GM', hours: 15, type: 'cleaner',     phone: '555-0107', email: 'george@gcs.com' },
                { id: 'S8', name: 'Hannah Lee',      avatar: 'HL', hours: 35, type: 'maintenance', phone: '555-0108', email: 'hannah@gcs.com' }
            ],
            sites: [
                { id: 'L1', name: 'Site 44 (Downtown)',     address: '44 Wall Street, New York, NY 10005',        lat: 40.7128, lng: -74.0060 },
                { id: 'L2', name: 'Northpark Complex',      address: '120 Northpark Blvd, Newark, NJ 07102',      lat: 40.7300, lng: -74.0100 },
                { id: 'L3', name: 'Apex Tower (Floor 12)',  address: '350 5th Avenue, New York, NY 10118',        lat: 40.7580, lng: -73.9855 },
                { id: 'L4', name: 'Westside Clinic',        address: '210 W 14th Street, New York, NY 10011',     lat: 40.7410, lng: -73.9980 },
                { id: 'L5', name: 'Easton Warehouse',       address: '88 Industrial Dr, Brooklyn, NY 11231',      lat: 40.7110, lng: -73.9580 }
            ],
            siteTasks: [
                { siteId: 'L1', cleanerTasks: [...DEFAULT_CLEANER_TASKS], maintenanceTasks: [...DEFAULT_MAINTENANCE_TASKS] },
                { siteId: 'L2', cleanerTasks: [...DEFAULT_CLEANER_TASKS], maintenanceTasks: [...DEFAULT_MAINTENANCE_TASKS] },
                {
                    siteId: 'L3',
                    cleanerTasks: ['Clean all glass surfaces', 'Vacuum executive suites', 'Sanitize kitchen & break areas', 'Empty all bins', 'Wipe meeting room tables & AV equipment'],
                    maintenanceTasks: [...DEFAULT_MAINTENANCE_TASKS]
                },
                {
                    siteId: 'L4',
                    cleanerTasks: ['Disinfect all surfaces (medical grade)', 'Sanitize restrooms', 'Restock PPE dispensers', 'Mop all floors', 'Empty biohazard bins'],
                    maintenanceTasks: ['Check medical gas lines', 'Test emergency generators', 'Inspect fire suppression system', 'Calibrate HVAC systems']
                },
                {
                    siteId: 'L5',
                    cleanerTasks: ['Sweep warehouse floor', 'Clean break room', 'Empty industrial bins', 'Wipe loading dock surfaces'],
                    maintenanceTasks: ['Inspect forklift charging stations', 'Check loading dock seals', 'Test fire suppression', 'Inspect industrial lighting']
                }
            ],
            inventory: [
                { id: 'INV1',  siteId: 'L1', item: 'Bleach',                     qty: 3,  minQty: 5,  unit: 'gallons' },
                { id: 'INV2',  siteId: 'L1', item: 'Paper Towels',               qty: 24, minQty: 12, unit: 'rolls' },
                { id: 'INV3',  siteId: 'L1', item: 'Hand Soap',                  qty: 2,  minQty: 4,  unit: 'liters' },
                { id: 'INV4',  siteId: 'L1', item: 'Trash Bags (65gal)',          qty: 40, minQty: 20, unit: 'bags' },
                { id: 'INV5',  siteId: 'L2', item: 'Mop Heads',                  qty: 1,  minQty: 3,  unit: 'units' },
                { id: 'INV6',  siteId: 'L2', item: 'Disinfectant Spray',         qty: 8,  minQty: 6,  unit: 'cans' },
                { id: 'INV7',  siteId: 'L2', item: 'Latex Gloves',               qty: 5,  minQty: 10, unit: 'boxes' },
                { id: 'INV8',  siteId: 'L3', item: 'Glass Cleaner',              qty: 6,  minQty: 4,  unit: 'bottles' },
                { id: 'INV9',  siteId: 'L3', item: 'Microfiber Cloths',          qty: 10, minQty: 8,  unit: 'units' },
                { id: 'INV10', siteId: 'L4', item: 'Medical-Grade Disinfectant', qty: 2,  minQty: 6,  unit: 'gallons' },
                { id: 'INV11', siteId: 'L4', item: 'PPE Gloves',                 qty: 20, minQty: 15, unit: 'boxes' },
                { id: 'INV12', siteId: 'L5', item: 'Industrial Trash Bags',      qty: 30, minQty: 20, unit: 'bags' },
                { id: 'INV13', siteId: 'L5', item: 'Floor Degreaser',            qty: 2,  minQty: 4,  unit: 'gallons' }
            ],
            shifts: [
                { id: 'SH1', staffId: 'S1', siteId: 'L1', targetTime: minNow(-25),  status: 'late',      notes: 'Needs critical attention.',         completedTasks: [] },
                { id: 'SH2', staffId: 'S2', siteId: 'L2', targetTime: minNow(-120), status: 'active',    clockInTime: minNow(-120), notes: '',        completedTasks: [] },
                { id: 'SH3', staffId: 'S3', siteId: 'L3', targetTime: minNow(30),   status: 'upcoming',  notes: 'VIP cleaning protocol required.',    completedTasks: [] },
                { id: 'SH4', staffId: 'S4', siteId: 'L4', targetTime: minNow(-45),  status: 'active',    clockInTime: minNow(-45),  notes: '',        completedTasks: [] },
                { id: 'SH5', staffId: 'S5', siteId: 'L5', targetTime: minNow(140),  status: 'upcoming',  notes: '',                                  completedTasks: [] },
                { id: 'SH6', staffId: 'S6', siteId: 'L1', targetTime: minNow(-300), status: 'completed', clockInTime: minNow(-300), clockOutTime: minNow(-120), notes: '', completedTasks: ['Vacuum all carpeted areas', 'Mop hard floors', 'Empty trash bins'] },
                { id: 'SH7', staffId: 'S7', siteId: 'L2', targetTime: minNow(60),   status: 'upcoming',  notes: '',                                  completedTasks: [] },
                { id: 'SH8', staffId: 'S8', siteId: 'L3', targetTime: minNow(-10),  status: 'late',      notes: 'Traffic reported on highway.',       completedTasks: [] },
                { id: 'SH9', staffId: 'S2', siteId: 'L4', targetTime: minNow(240),  status: 'upcoming',  notes: '',                                  completedTasks: [] }
            ],
            feedEvents: [
                { id: 'E1', type: 'alert',   message: 'Alice Walker is 25m late for Site 44.',                   timestamp: minNow(-25)  },
                { id: 'E2', type: 'success', message: 'Bob Smith clocked in at Northpark Complex.',              timestamp: minNow(-120) },
                { id: 'E3', type: 'info',    message: 'Fiona Gallagher completed shift at Site 44.',            timestamp: minNow(-60)  },
                { id: 'E4', type: 'alert',   message: 'Hannah Lee is 10m late for Apex Tower.',                 timestamp: minNow(-10)  },
                { id: 'E5', type: 'success', message: 'Diana Prince clocked in at Westside Clinic.',            timestamp: minNow(-45)  },
                { id: 'E6', type: 'info',    message: 'Restock requested at Northpark Complex by Bob Smith.',   timestamp: minNow(-30)  },
                { id: 'E7', type: 'info',    message: 'Weekly deep clean completed at Easton Warehouse.',       timestamp: minNow(-200) },
                { id: 'E8', type: 'alert',   message: 'Low supply of bleach at Westside Clinic.',              timestamp: minNow(-40)  }
            ],
            chatHistory: []
        };
        this.saveData();
    }

    // ─── Dashboard ──────────────────────────────────────────────────────────────

    getDashboardData() {
        const enrich = (s) => ({
            ...s,
            staff: this.data.staff.find(m => m.id === s.staffId),
            site:  this.data.sites.find(l => l.id === s.siteId)
        });
        return {
            shifts:    this.data.shifts.map(enrich),
            feed:      [...this.data.feedEvents].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
            staffList: this.data.staff,
            sites:     this.data.sites
        };
    }

    getOverviewStats() {
        const shifts    = this.data.shifts;
        const total     = shifts.length;
        const late      = shifts.filter(s => s.status === 'late').length;
        const active    = shifts.filter(s => s.status === 'active').length;
        const completed = shifts.filter(s => s.status === 'completed').length;
        const upcoming  = shifts.filter(s => s.status === 'upcoming').length;
        const compliance = total > 0 ? Math.round(((active + completed) / total) * 100) : 100;

        const latesBySite = {};
        shifts.filter(s => s.status === 'late').forEach(s => {
            const site = this.data.sites.find(l => l.id === s.siteId);
            const name = site ? site.name : s.siteId;
            latesBySite[name] = (latesBySite[name] || 0) + 1;
        });
        const maxLate = Math.max(1, ...Object.values(latesBySite));

        return { total, late, active, completed, upcoming, compliance, latesBySite, maxLate };
    }

    // ─── Mobile ─────────────────────────────────────────────────────────────────

    getMobileStaffData(staffId) {
        const staffShifts    = this.data.shifts.filter(s => s.staffId === staffId);
        const nextShift      = staffShifts.find(s => s.status === 'upcoming' || s.status === 'late');
        const activeShift    = staffShifts.find(s => s.status === 'active');
        const completedShifts = staffShifts
            .filter(s => s.status === 'completed')
            .sort((a, b) => new Date(b.clockOutTime || b.targetTime) - new Date(a.clockOutTime || a.targetTime));

        const expand = (s) => {
            if (!s) return null;
            const site      = this.data.sites.find(l => l.id === s.siteId);
            const staff     = this.data.staff.find(m => m.id === s.staffId);
            const taskConf  = this.data.siteTasks.find(t => t.siteId === s.siteId);
            const taskKey   = staff && staff.type === 'maintenance' ? 'maintenanceTasks' : 'cleanerTasks';
            const tasks     = taskConf ? taskConf[taskKey] : DEFAULT_CLEANER_TASKS;
            return { ...s, site, staff, tasks };
        };

        return {
            staff:         this.data.staff.find(s => s.id === staffId),
            nextShift:     expand(nextShift),
            activeShift:   expand(activeShift),
            lastCompleted: expand(completedShifts[0])
        };
    }

    // ─── Clock In / Out ──────────────────────────────────────────────────────────

    clockIn(staffId, shiftId) {
        const shift = this.data.shifts.find(s => s.id === shiftId);
        if (!shift) return;
        shift.status      = 'active';
        shift.clockInTime = new Date().toISOString();
        shift.completedTasks = [];
        const staff = this.data.staff.find(s => s.id === staffId);
        const site  = this.data.sites.find(s => s.id === shift.siteId);
        this.addFeedEvent('success', `${staff.name} clocked in at ${site.name}.`);
        this.saveData();
    }

    clockOut(staffId, shiftId) {
        const shift = this.data.shifts.find(s => s.id === shiftId);
        if (!shift) return;
        shift.status       = 'completed';
        shift.clockOutTime = new Date().toISOString();
        const staff = this.data.staff.find(s => s.id === staffId);
        this.addFeedEvent('info', `${staff.name} completed shift and clocked out.`);
        this.saveData();
    }

    saveTaskProgress(shiftId, completedTasks) {
        const shift = this.data.shifts.find(s => s.id === shiftId);
        if (shift) { shift.completedTasks = completedTasks; this.saveData(); }
    }

    // ─── Feed ────────────────────────────────────────────────────────────────────

    addFeedEvent(type, message) {
        this.data.feedEvents.push({ id: 'E' + Date.now(), type, message, timestamp: new Date().toISOString() });
    }

    // ─── Staff CRUD ──────────────────────────────────────────────────────────────

    addStaff(name, type, phone, email) {
        const newStaff = {
            id:     'S' + Date.now(),
            name,
            avatar: name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
            hours:  0,
            type,
            phone:  phone || '',
            email:  email || ''
        };
        this.data.staff.push(newStaff);
        this.addFeedEvent('info', `New employee ${name} added as ${type}.`);
        this.saveData();
        return newStaff;
    }

    deleteStaff(staffId) {
        this.data.staff  = this.data.staff.filter(s => s.id !== staffId);
        this.data.shifts = this.data.shifts.filter(s => s.staffId !== staffId);
        this.saveData();
    }

    // ─── Sites CRUD ──────────────────────────────────────────────────────────────

    addSite(name, address) {
        const id = 'SITE' + Date.now();
        const newSite = {
            id, name,
            address: address || 'Address Pending',
            lat: 40.7128 + (Math.random() * 0.1 - 0.05),
            lng: -74.0060 + (Math.random() * 0.1 - 0.05)
        };
        this.data.sites.push(newSite);
        this.data.siteTasks.push({ siteId: id, cleanerTasks: [...DEFAULT_CLEANER_TASKS], maintenanceTasks: [...DEFAULT_MAINTENANCE_TASKS] });
        this.addFeedEvent('success', `New facility "${name}" registered.`);
        this.saveData();
        return newSite;
    }

    deleteSite(siteId) {
        this.data.sites     = this.data.sites.filter(s => s.id !== siteId);
        this.data.shifts    = this.data.shifts.filter(s => s.siteId !== siteId);
        this.data.siteTasks = this.data.siteTasks.filter(t => t.siteId !== siteId);
        this.data.inventory = this.data.inventory.filter(i => i.siteId !== siteId);
        this.saveData();
    }

    // ─── Shifts CRUD ─────────────────────────────────────────────────────────────

    createShift(staffId, siteId, targetTime, notes) {
        const id = 'SH' + Date.now();
        const shift = { id, staffId, siteId, targetTime, status: 'upcoming', notes: notes || '', completedTasks: [] };
        this.data.shifts.push(shift);
        const staff = this.data.staff.find(s => s.id === staffId);
        const site  = this.data.sites.find(s => s.id === siteId);
        this.addFeedEvent('info', `Shift created: ${staff ? staff.name : staffId} → ${site ? site.name : siteId}.`);
        this.saveData();
        return shift;
    }

    cancelShift(shiftId) {
        const shift = this.data.shifts.find(s => s.id === shiftId);
        if (shift) {
            const staff = this.data.staff.find(s => s.id === shift.staffId);
            this.addFeedEvent('info', `Shift cancelled${staff ? ' for ' + staff.name : ''}.`);
        }
        this.data.shifts = this.data.shifts.filter(s => s.id !== shiftId);
        this.saveData();
    }

    updateShift(shiftId, updates) {
        const shift = this.data.shifts.find(s => s.id === shiftId);
        if (!shift) return;
        ['staffId', 'siteId', 'targetTime', 'notes', 'status'].forEach(k => {
            if (k in updates) shift[k] = updates[k];
        });
        const staff = this.data.staff.find(s => s.id === shift.staffId);
        const site  = this.data.sites.find(s => s.id === shift.siteId);
        this.addFeedEvent('info', `Shift updated${staff ? ' for ' + staff.name : ''}${site ? ' at ' + site.name : ''}.`);
        this.saveData();
    }

    // Returns the conflicting shift or null. Flags overlaps within 4 h same day.
    hasShiftConflict(staffId, targetTime, excludeShiftId = null) {
        const targetMs  = new Date(targetTime).getTime();
        const targetDay = new Date(targetTime).toDateString();
        return this.data.shifts.find(s => {
            if (s.id === excludeShiftId) return false;
            if (s.staffId !== staffId)   return false;
            if (s.status === 'completed' || s.status === 'cancelled') return false;
            if (new Date(s.targetTime).toDateString() !== targetDay)  return false;
            return Math.abs(new Date(s.targetTime).getTime() - targetMs) / 3600000 < 4;
        }) || null;
    }

    notifyStaff(staffId, message) {
        const staff = this.data.staff.find(s => s.id === staffId);
        this.addFeedEvent('info', `📲 Notification → ${staff ? staff.name : staffId}: "${message}"`);
        this.saveData();
        return { staff, message };
    }

    // ─── Site Tasks CRUD ─────────────────────────────────────────────────────────

    getSiteTasks(siteId) {
        return this.data.siteTasks.find(t => t.siteId === siteId) || { siteId, cleanerTasks: [], maintenanceTasks: [] };
    }

    addSiteTask(siteId, taskType, taskName) {
        let conf = this.data.siteTasks.find(t => t.siteId === siteId);
        if (!conf) { conf = { siteId, cleanerTasks: [], maintenanceTasks: [] }; this.data.siteTasks.push(conf); }
        conf[taskType].push(taskName.trim());
        this.saveData();
    }

    removeSiteTask(siteId, taskType, index) {
        const conf = this.data.siteTasks.find(t => t.siteId === siteId);
        if (conf && conf[taskType]) { conf[taskType].splice(index, 1); this.saveData(); }
    }

    // ─── Inventory CRUD ──────────────────────────────────────────────────────────

    getInventory(siteId) {
        return siteId ? this.data.inventory.filter(i => i.siteId === siteId) : this.data.inventory;
    }

    addInventoryItem(siteId, item, qty, minQty, unit) {
        const newItem = { id: 'INV' + Date.now(), siteId, item: item.trim(), qty: parseInt(qty) || 0, minQty: parseInt(minQty) || 1, unit: unit.trim() };
        this.data.inventory.push(newItem);
        this.saveData();
        return newItem;
    }

    updateInventoryQty(invId, qty) {
        const item = this.data.inventory.find(i => i.id === invId);
        if (!item) return;
        item.qty = parseInt(qty) || 0;
        const site = this.data.sites.find(s => s.id === item.siteId);
        if (item.qty < item.minQty) {
            this.addFeedEvent('alert', `Low stock: "${item.item}" at ${site ? site.name : 'unknown site'}.`);
        }
        this.saveData();
    }

    removeInventoryItem(invId) {
        this.data.inventory = this.data.inventory.filter(i => i.id !== invId);
        this.saveData();
    }

    // ─── Chat History ────────────────────────────────────────────────────────────

    getChatHistory()            { return this.data.chatHistory || []; }
    saveChatMessage(role, text) {
        if (!this.data.chatHistory) this.data.chatHistory = [];
        this.data.chatHistory.push({ role, text, timestamp: new Date().toISOString() });
        this.saveData();
    }
    clearChatHistory()          { this.data.chatHistory = []; this.saveData(); }

    // ─── Authentication ──────────────────────────────────────────────────────────

    authenticateUser(username, password) {
        const user = this.data.accounts.find(u => u.username === username && u.password === password);
        if (user) {
            const session = { id: user.id, username: user.username, role: user.role, staffId: user.staffId };
            this.activeSession = session;
            try { localStorage.setItem('gcs_session', JSON.stringify(session)); } catch (e) {}
            return { success: true, user: session };
        }
        return { success: false };
    }

    getSession() {
        try {
            const raw = localStorage.getItem('gcs_session');
            return raw ? JSON.parse(raw) : (this.activeSession || null);
        } catch (e) {
            return this.activeSession || null;
        }
    }

    clearSession() {
        this.activeSession = null;
        try { localStorage.removeItem('gcs_session'); } catch (e) {}
    }
}

// Expose defaults for mobile.js usage
window.DEFAULT_CLEANER_TASKS     = DEFAULT_CLEANER_TASKS;
window.DEFAULT_MAINTENANCE_TASKS = DEFAULT_MAINTENANCE_TASKS;
window.db = new Database();
