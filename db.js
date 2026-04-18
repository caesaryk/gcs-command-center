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
            const data = raw ? JSON.parse(raw) : (this.memoryStore || null);
            if (data) {
                this.migrateShiftSchema(data);
                this.migrateStaffRoles(data);
                this.migrateInventorySchema(data);
            }
            return data;
        } catch (err) {
            return this.memoryStore || null;
        }
    }

    migrateShiftSchema(data) {
        // Convert old single-staffId shifts to staffIds array
        if (data.shifts) {
            data.shifts.forEach(shift => {
                if (shift.staffId && !shift.staffIds) {
                    shift.staffIds = [shift.staffId];
                }
                if (!shift.type) shift.type = 'shift';
                if (!shift.createdAt) shift.createdAt = new Date().toISOString();
                if (shift.isRecurring === undefined) shift.isRecurring = false;
            });
        }
    }

    migrateStaffRoles(data) {
        // Convert old single-role staff to multi-role format
        if (data.staff) {
            data.staff.forEach(staff => {
                if (!staff.roles && staff.type) {
                    staff.roles = [staff.type];
                }
                if (!staff.roles) staff.roles = ['cleaner'];
                if (staff.isActive === undefined) staff.isActive = true;
                if (!staff.startDate) staff.startDate = new Date().toISOString();
            });
        }
    }

    migrateInventorySchema(data) {
        // Add new inventory fields to existing items
        const now = new Date().toISOString();
        if (data.inventory) {
            data.inventory.forEach(item => {
                if (!item.reorderQty) item.reorderQty = item.minQty;
                if (!item.lastRestocked) item.lastRestocked = now;
                if (!item.restockFrequency) item.restockFrequency = 'weekly';
                if (!item.notes) item.notes = '';
            });
        }
        // Initialize supplyRequests if missing
        if (!data.supplyRequests) data.supplyRequests = [];
        // Initialize inventoryTemplates if missing
        if (!data.inventoryTemplates) data.inventoryTemplates = [];
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
            clients: [
                { id: 'C1', name: 'Manhattan Corporate Group', contact: 'Sarah Chen', phone: '212-555-0101', email: 'sarah@mcg.com', address: '500 5th Avenue, New York, NY 10110', notes: 'Premium client, VIP protocol required', createdAt: now.toISOString() },
                { id: 'C2', name: 'Metropolitan Healthcare', contact: 'Dr. James Mitchell', phone: '212-555-0102', email: 'admin@metrohealth.org', address: '800 Broadway, New York, NY 10003', notes: 'Medical facility - use medical-grade disinfectants', createdAt: now.toISOString() },
                { id: 'C3', name: 'Tri-State Logistics', contact: 'Michael Torres', phone: '908-555-0103', email: 'ops@tristate.com', address: '200 Industrial Park Drive, Newark, NJ 07102', notes: 'Warehouse operations - 24/7 access required', createdAt: now.toISOString() },
                { id: 'C4', name: 'Empire Building Associates', contact: 'Jessica Williams', phone: '212-555-0104', email: 'facilities@empirebd.com', address: '350 5th Avenue, New York, NY 10118', notes: 'Multi-floor commercial - premium account', createdAt: now.toISOString() }
            ],
            inventoryTemplates: [
                {
                    id: 'TMPL1',
                    name: 'Commercial Standard',
                    serviceTypes: ['commercial'],
                    items: [
                        { itemName: 'Bleach', defaultQty: 5, minQty: 3, unit: 'gallons' },
                        { itemName: 'Paper Towels', defaultQty: 24, minQty: 12, unit: 'rolls' },
                        { itemName: 'Hand Soap', defaultQty: 4, minQty: 2, unit: 'liters' },
                        { itemName: 'Trash Bags (65gal)', defaultQty: 50, minQty: 25, unit: 'bags' },
                        { itemName: 'Disinfectant Spray', defaultQty: 12, minQty: 6, unit: 'cans' },
                        { itemName: 'Latex Gloves', defaultQty: 10, minQty: 5, unit: 'boxes' }
                    ]
                },
                {
                    id: 'TMPL2',
                    name: 'Medical Facility',
                    serviceTypes: ['medical'],
                    items: [
                        { itemName: 'Medical-Grade Disinfectant', defaultQty: 10, minQty: 6, unit: 'gallons' },
                        { itemName: 'PPE Gloves', defaultQty: 50, minQty: 25, unit: 'boxes' },
                        { itemName: 'Hand Sanitizer', defaultQty: 6, minQty: 3, unit: 'liters' },
                        { itemName: 'Biohazard Bags', defaultQty: 30, minQty: 15, unit: 'bags' },
                        { itemName: 'Surface Wipes (Medical)', defaultQty: 12, minQty: 6, unit: 'canisters' },
                        { itemName: 'N95 Masks', defaultQty: 20, minQty: 10, unit: 'boxes' }
                    ]
                },
                {
                    id: 'TMPL3',
                    name: 'Warehouse',
                    serviceTypes: ['warehouse'],
                    items: [
                        { itemName: 'Floor Degreaser', defaultQty: 10, minQty: 5, unit: 'gallons' },
                        { itemName: 'Industrial Trash Bags', defaultQty: 50, minQty: 30, unit: 'bags' },
                        { itemName: 'Degreaser Cleaner', defaultQty: 5, minQty: 3, unit: 'gallons' },
                        { itemName: 'Heavy-Duty Mop Heads', defaultQty: 6, minQty: 3, unit: 'units' },
                        { itemName: 'Safety Vests', defaultQty: 10, minQty: 5, unit: 'units' },
                        { itemName: 'Work Gloves', defaultQty: 12, minQty: 6, unit: 'pairs' }
                    ]
                }
            ],
            staff: [
                { id: 'S1', name: 'Alice Walker',    avatar: 'AW', hours: 32, type: 'cleaner',     roles: ['cleaner'], phone: '555-0101', email: 'alice@gcs.com', isActive: true, startDate: new Date(2024, 0, 15).toISOString(), notes: '' },
                { id: 'S2', name: 'Bob Smith',       avatar: 'BS', hours: 40, type: 'maintenance', roles: ['maintenance'], phone: '555-0102', email: 'bob@gcs.com', isActive: true, startDate: new Date(2023, 6, 20).toISOString(), notes: '' },
                { id: 'S3', name: 'Charlie Davis',   avatar: 'CD', hours: 28, type: 'cleaner',     roles: ['cleaner'], phone: '555-0103', email: 'charlie@gcs.com', isActive: true, startDate: new Date(2024, 2, 10).toISOString(), notes: '' },
                { id: 'S4', name: 'Diana Prince',    avatar: 'DP', hours: 38, type: 'cleaner',     roles: ['cleaner'], phone: '555-0104', email: 'diana@gcs.com', isActive: true, startDate: new Date(2023, 11, 5).toISOString(), notes: '' },
                { id: 'S5', name: 'Evan Wright',     avatar: 'EW', hours: 20, type: 'maintenance', roles: ['maintenance'], phone: '555-0105', email: 'evan@gcs.com', isActive: true, startDate: new Date(2024, 1, 1).toISOString(), notes: '' },
                { id: 'S6', name: 'Fiona Gallagher', avatar: 'FG', hours: 42, type: 'cleaner',     roles: ['cleaner'], phone: '555-0106', email: 'fiona@gcs.com', isActive: true, startDate: new Date(2023, 5, 12).toISOString(), notes: '' },
                { id: 'S7', name: 'George Miller',   avatar: 'GM', hours: 15, type: 'cleaner',     roles: ['cleaner'], phone: '555-0107', email: 'george@gcs.com', isActive: true, startDate: new Date(2024, 3, 1).toISOString(), notes: '' },
                { id: 'S8', name: 'Hannah Lee',      avatar: 'HL', hours: 35, type: 'maintenance', roles: ['maintenance'], phone: '555-0108', email: 'hannah@gcs.com', isActive: true, startDate: new Date(2023, 8, 18).toISOString(), notes: '' }
            ],
            sites: [
                { id: 'L1', name: 'Site 44 (Downtown)',     address: '44 Wall Street, New York, NY 10005',        lat: 40.7128, lng: -74.0060, clientId: 'C1', siteManager: 'Robert Adams', managerPhone: '212-555-0201', managerEmail: 'radams@mcg.com', serviceType: 'commercial', squareFeet: 45000, notes: 'Weekly deep clean every Friday. Executive areas priority.', isActive: true },
                { id: 'L2', name: 'Northpark Complex',      address: '120 Northpark Blvd, Newark, NJ 07102',      lat: 40.7300, lng: -74.0100, clientId: 'C3', siteManager: 'David Hernandez', managerPhone: '908-555-0202', managerEmail: 'dhernandez@tristate.com', serviceType: 'warehouse', squareFeet: 120000, notes: '24/7 access required. Loading dock cleaning critical. Monthly deep clean first Sunday.', isActive: true },
                { id: 'L3', name: 'Apex Tower (Floor 12)',  address: '350 5th Avenue, New York, NY 10118',        lat: 40.7580, lng: -73.9855, clientId: 'C4', siteManager: 'Michelle Rodriguez', managerPhone: '212-555-0203', managerEmail: 'mrodriguez@empirebd.com', serviceType: 'commercial', squareFeet: 35000, notes: 'Premium commercial. VIP protocol. Glass surfaces must be pristine daily.', isActive: true },
                { id: 'L4', name: 'Westside Clinic',        address: '210 W 14th Street, New York, NY 10011',     lat: 40.7410, lng: -73.9980, clientId: 'C2', siteManager: 'Dr. Patricia Wong', managerPhone: '212-555-0204', managerEmail: 'pwong@metrohealth.org', serviceType: 'medical', squareFeet: 28000, notes: 'Medical facility - STRICT hygiene protocols. Medical-grade disinfectants only. Biohazard compliance required.', isActive: true },
                { id: 'L5', name: 'Easton Warehouse',       address: '88 Industrial Dr, Brooklyn, NY 11231',      lat: 40.7110, lng: -73.9580, clientId: 'C3', siteManager: 'Kevin McCarthy', managerPhone: '908-555-0205', managerEmail: 'kmccarthy@tristate.com', serviceType: 'warehouse', squareFeet: 85000, notes: 'Industrial facility. Floor degreaser required. Inventory bins must remain accessible.', isActive: true }
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
                { id: 'INV1',  siteId: 'L1', item: 'Bleach',                     qty: 3,  minQty: 5,  reorderQty: 10, unit: 'gallons', lastRestocked: minNow(-432), restockFrequency: 'weekly', notes: 'Use for floors and surfaces' },
                { id: 'INV2',  siteId: 'L1', item: 'Paper Towels',               qty: 24, minQty: 12, reorderQty: 24, unit: 'rolls', lastRestocked: minNow(-120), restockFrequency: 'weekly', notes: 'Standard dispensers' },
                { id: 'INV3',  siteId: 'L1', item: 'Hand Soap',                  qty: 2,  minQty: 4,  reorderQty: 6,  unit: 'liters', lastRestocked: minNow(-600), restockFrequency: 'biweekly', notes: 'For all restrooms' },
                { id: 'INV4',  siteId: 'L1', item: 'Trash Bags (65gal)',         qty: 40, minQty: 20, reorderQty: 50, unit: 'bags', lastRestocked: minNow(-240), restockFrequency: 'weekly', notes: 'Executive areas priority' },
                { id: 'INV5',  siteId: 'L2', item: 'Mop Heads',                  qty: 1,  minQty: 3,  reorderQty: 6,  unit: 'units', lastRestocked: minNow(-1440), restockFrequency: 'monthly', notes: 'Warehouse-grade' },
                { id: 'INV6',  siteId: 'L2', item: 'Disinfectant Spray',         qty: 8,  minQty: 6,  reorderQty: 12, unit: 'cans', lastRestocked: minNow(-360), restockFrequency: 'weekly', notes: 'Industrial strength' },
                { id: 'INV7',  siteId: 'L2', item: 'Latex Gloves',               qty: 5,  minQty: 10, reorderQty: 15, unit: 'boxes', lastRestocked: minNow(-480), restockFrequency: 'weekly', notes: 'Low stock!' },
                { id: 'INV8',  siteId: 'L3', item: 'Glass Cleaner',              qty: 6,  minQty: 4,  reorderQty: 8,  unit: 'bottles', lastRestocked: minNow(-180), restockFrequency: 'weekly', notes: 'Premium VIP protocol' },
                { id: 'INV9',  siteId: 'L3', item: 'Microfiber Cloths',          qty: 10, minQty: 8,  reorderQty: 12, unit: 'units', lastRestocked: minNow(-300), restockFrequency: 'biweekly', notes: 'Must be pristine' },
                { id: 'INV10', siteId: 'L4', item: 'Medical-Grade Disinfectant', qty: 2,  minQty: 6,  reorderQty: 10, unit: 'gallons', lastRestocked: minNow(-720), restockFrequency: 'weekly', notes: 'Medical-grade only!' },
                { id: 'INV11', siteId: 'L4', item: 'PPE Gloves',                 qty: 20, minQty: 15, reorderQty: 30, unit: 'boxes', lastRestocked: minNow(-240), restockFrequency: 'weekly', notes: 'Critical supply' },
                { id: 'INV12', siteId: 'L5', item: 'Industrial Trash Bags',      qty: 30, minQty: 20, reorderQty: 50, unit: 'bags', lastRestocked: minNow(-480), restockFrequency: 'weekly', notes: 'Heavy-duty industrial' },
                { id: 'INV13', siteId: 'L5', item: 'Floor Degreaser',            qty: 2,  minQty: 4,  reorderQty: 8,  unit: 'gallons', lastRestocked: minNow(-840), restockFrequency: 'biweekly', notes: 'For loading dock' }
            ],
            supplyRequests: [
                {
                    id: 'SR1',
                    siteId: 'L1',
                    items: [
                        { itemName: 'Bleach', qty: 10, unit: 'gallons', reason: 'low_stock' },
                        { itemName: 'Hand Soap', qty: 6, unit: 'liters', reason: 'low_stock' }
                    ],
                    status: 'pending',
                    requestedBy: 'S1',
                    requestedAt: minNow(-120),
                    approvedBy: null,
                    approvedAt: null,
                    orderedAt: null,
                    deliveredAt: null,
                    receivedAt: null,
                    notes: 'Weekly restock - stock below minimums',
                    supplier: 'Vendor ABC',
                    estimatedDelivery: minNow(240),
                    trackingNumber: null
                },
                {
                    id: 'SR2',
                    siteId: 'L4',
                    items: [
                        { itemName: 'Medical-Grade Disinfectant', qty: 10, unit: 'gallons', reason: 'low_stock' },
                        { itemName: 'PPE Gloves', qty: 20, unit: 'boxes', reason: 'routine' }
                    ],
                    status: 'approved',
                    requestedBy: 'S4',
                    requestedAt: minNow(-300),
                    approvedBy: 'U1',
                    approvedAt: minNow(-180),
                    orderedAt: null,
                    deliveredAt: null,
                    receivedAt: null,
                    notes: 'Medical facility - critical supplies',
                    supplier: 'MedSupply Corp',
                    estimatedDelivery: minNow(360),
                    trackingNumber: null
                },
                {
                    id: 'SR3',
                    siteId: 'L2',
                    items: [
                        { itemName: 'Latex Gloves', qty: 15, unit: 'boxes', reason: 'low_stock' },
                        { itemName: 'Disinfectant Spray', qty: 12, unit: 'cans', reason: 'routine' }
                    ],
                    status: 'ordered',
                    requestedBy: 'S2',
                    requestedAt: minNow(-600),
                    approvedBy: 'U1',
                    approvedAt: minNow(-480),
                    orderedAt: minNow(-240),
                    deliveredAt: null,
                    receivedAt: null,
                    notes: 'Warehouse weekly supplies',
                    supplier: 'Industrial Supplies Inc',
                    estimatedDelivery: minNow(120),
                    trackingNumber: 'TRACK123456'
                },
                {
                    id: 'SR4',
                    siteId: 'L5',
                    items: [
                        { itemName: 'Floor Degreaser', qty: 8, unit: 'gallons', reason: 'low_stock' }
                    ],
                    status: 'delivered',
                    requestedBy: 'S5',
                    requestedAt: minNow(-1200),
                    approvedBy: 'U1',
                    approvedAt: minNow(-1080),
                    orderedAt: minNow(-960),
                    deliveredAt: minNow(-60),
                    receivedAt: null,
                    notes: 'Awaiting staff confirmation of delivery',
                    supplier: 'EastCoast Chemical',
                    estimatedDelivery: minNow(-120),
                    trackingNumber: 'TRACK789012'
                }
            ],
            shifts: [
                { id: 'SH1', staffIds: ['S1'], siteId: 'L1', targetTime: minNow(-25),  status: 'late',      type: 'shift', isRecurring: false, notes: 'Needs critical attention.',         completedTasks: [], createdAt: now.toISOString() },
                { id: 'SH2', staffIds: ['S2'], siteId: 'L2', targetTime: minNow(-120), status: 'active',    type: 'shift', isRecurring: false, clockInTime: minNow(-120), notes: '',        completedTasks: [], createdAt: now.toISOString() },
                { id: 'SH3', staffIds: ['S3'], siteId: 'L3', targetTime: minNow(30),   status: 'upcoming',  type: 'shift', isRecurring: false, notes: 'VIP cleaning protocol required.',    completedTasks: [], createdAt: now.toISOString() },
                { id: 'SH4', staffIds: ['S4'], siteId: 'L4', targetTime: minNow(-45),  status: 'active',    type: 'shift', isRecurring: false, clockInTime: minNow(-45),  notes: '',        completedTasks: [], createdAt: now.toISOString() },
                { id: 'SH5', staffIds: ['S5'], siteId: 'L5', targetTime: minNow(140),  status: 'upcoming',  type: 'shift', isRecurring: false, notes: '',                                  completedTasks: [], createdAt: now.toISOString() },
                { id: 'SH6', staffIds: ['S6'], siteId: 'L1', targetTime: minNow(-300), status: 'completed', type: 'shift', isRecurring: false, clockInTime: minNow(-300), clockOutTime: minNow(-120), notes: '', completedTasks: ['Vacuum all carpeted areas', 'Mop hard floors', 'Empty trash bins'], createdAt: now.toISOString() },
                { id: 'SH7', staffIds: ['S7'], siteId: 'L2', targetTime: minNow(60),   status: 'upcoming',  type: 'shift', isRecurring: false, notes: '',                                  completedTasks: [], createdAt: now.toISOString() },
                { id: 'SH8', staffIds: ['S8'], siteId: 'L3', targetTime: minNow(-10),  status: 'late',      type: 'shift', isRecurring: false, notes: 'Traffic reported on highway.',       completedTasks: [], createdAt: now.toISOString() },
                { id: 'SH9', staffIds: ['S2'], siteId: 'L4', targetTime: minNow(240),  status: 'upcoming',  type: 'shift', isRecurring: false, notes: '',                                  completedTasks: [], createdAt: now.toISOString() }
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
            staffList: (s.staffIds || [s.staffId]).map(sid => this.data.staff.find(m => m.id === sid)),
            staff: this.data.staff.find(m => m.id === (s.staffIds ? s.staffIds[0] : s.staffId)), // Primary staff
            site:  this.data.sites.find(l => l.id === s.siteId)
        });
        return {
            shifts:    this.data.shifts.filter(s => !s.isRecurringTemplate).map(enrich),
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
        const staffShifts    = this.data.shifts.filter(s => {
            const staffIds = s.staffIds || [s.staffId];
            return staffIds.includes(staffId) && !s.isRecurringTemplate;
        });
        const nextShift      = staffShifts.find(s => s.status === 'upcoming' || s.status === 'late');
        const activeShift    = staffShifts.find(s => s.status === 'active');
        const completedShifts = staffShifts
            .filter(s => s.status === 'completed')
            .sort((a, b) => new Date(b.clockOutTime || b.targetTime) - new Date(a.clockOutTime || a.targetTime));

        const expand = (s) => {
            if (!s) return null;
            const site      = this.data.sites.find(l => l.id === s.siteId);
            const primaryStaffId = (s.staffIds || [s.staffId])[0];
            const staff     = this.data.staff.find(m => m.id === primaryStaffId);
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
            id:        'S' + Date.now(),
            name,
            avatar:    name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
            hours:     0,
            type,
            roles:     [type],
            phone:     phone || '',
            email:     email || '',
            isActive:  true,
            startDate: new Date().toISOString(),
            notes:     ''
        };
        this.data.staff.push(newStaff);
        this.addFeedEvent('info', `New employee ${name} added as ${type}.`);
        this.saveData();
        return newStaff;
    }

    deleteStaff(staffId) {
        this.data.staff  = this.data.staff.filter(s => s.id !== staffId);
        this.data.shifts = this.data.shifts.filter(s => {
            const staffIds = s.staffIds || [s.staffId];
            return !staffIds.includes(staffId);
        });
        this.saveData();
    }

    updateStaff(staffId, updates) {
        const staff = this.data.staff.find(s => s.id === staffId);
        if (staff) {
            Object.assign(staff, updates);
            this.addFeedEvent('info', `${staff.name} information updated.`);
            this.saveData();
        }
    }

    addRoleToStaff(staffId, role) {
        const staff = this.data.staff.find(s => s.id === staffId);
        if (staff && !staff.roles.includes(role)) {
            staff.roles.push(role);
            this.addFeedEvent('info', `${staff.name} assigned role: ${role}.`);
            this.saveData();
        }
    }

    removeRoleFromStaff(staffId, role) {
        const staff = this.data.staff.find(s => s.id === staffId);
        if (staff) {
            staff.roles = staff.roles.filter(r => r !== role);
            if (staff.roles.length === 0) staff.roles = ['cleaner'];
            this.addFeedEvent('info', `${staff.name} role removed: ${role}.`);
            this.saveData();
        }
    }

    getStaffAssignments(staffId) {
        // Returns all current and upcoming shifts assigned to this staff
        const now = new Date();
        return this.data.shifts.filter(shift => {
            const staffIds = shift.staffIds || [shift.staffId];
            if (!staffIds.includes(staffId)) return false;
            if (shift.isRecurringTemplate) return false;
            const shiftDate = new Date(shift.targetTime);
            return shiftDate >= now && (shift.status === 'active' || shift.status === 'upcoming');
        }).sort((a, b) => new Date(a.targetTime) - new Date(b.targetTime));
    }

    getStaffByRole(role) {
        return this.data.staff.filter(staff => staff.roles && staff.roles.includes(role));
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

    updateFacility(siteId, updates) {
        const facility = this.data.sites.find(s => s.id === siteId);
        if (!facility) return null;
        Object.assign(facility, updates);
        const clientId = facility.clientId;
        const client = clientId ? this.data.clients.find(c => c.id === clientId) : null;
        this.addFeedEvent('info', `Facility "${facility.name}" updated${client ? ' (' + client.name + ')' : ''}.`);
        this.saveData();
        return facility;
    }

    getFacilityDetails(siteId) {
        const facility = this.data.sites.find(s => s.id === siteId);
        if (!facility) return null;

        const client = facility.clientId ? this.data.clients.find(c => c.id === facility.clientId) : null;

        // Get assigned staff from shifts
        const assignedShifts = this.data.shifts.filter(s => s.siteId === siteId && (s.status === 'active' || s.status === 'upcoming'));
        const assignedStaffIds = new Set();
        assignedShifts.forEach(s => {
            const staffIds = s.staffIds || [s.staffId];
            staffIds.forEach(id => assignedStaffIds.add(id));
        });
        const assignedStaff = Array.from(assignedStaffIds).map(id => this.data.staff.find(s => s.id === id)).filter(Boolean);

        // Get tasks for this facility
        const siteTasks = this.data.siteTasks.find(t => t.siteId === siteId) || { cleanerTasks: [], maintenanceTasks: [] };

        // Get inventory for this facility
        const inventory = this.data.inventory.filter(i => i.siteId === siteId);
        const lowStockItems = inventory.filter(i => i.qty < i.minQty);

        return {
            ...facility,
            client,
            assignedStaff,
            siteTasks,
            inventory,
            lowStockItems
        };
    }

    getFacilitiesByClient(clientId) {
        return this.data.sites.filter(s => s.clientId === clientId);
    }

    // ─── Clients CRUD ────────────────────────────────────────────────────────────

    addClient(name, contact, phone, email, address, notes) {
        const id = 'C' + Date.now();
        const newClient = {
            id,
            name: name.trim(),
            contact: contact.trim(),
            phone: phone.trim(),
            email: email.trim(),
            address: address.trim(),
            notes: notes.trim(),
            createdAt: new Date().toISOString()
        };
        this.data.clients.push(newClient);
        this.addFeedEvent('success', `New client "${name}" added.`);
        this.saveData();
        return newClient;
    }

    updateClient(clientId, updates) {
        const client = this.data.clients.find(c => c.id === clientId);
        if (!client) return null;
        Object.assign(client, updates);
        this.addFeedEvent('info', `Client "${client.name}" information updated.`);
        this.saveData();
        return client;
    }

    deleteClient(clientId) {
        const client = this.data.clients.find(c => c.id === clientId);
        if (!client) return null;

        const facilitiesCount = this.data.sites.filter(s => s.clientId === clientId).length;

        if (facilitiesCount > 0) {
            // Prevent deletion if client has facilities
            return { success: false, error: `Cannot delete client with ${facilitiesCount} assigned facilities. Reassign or delete facilities first.` };
        }

        this.data.clients = this.data.clients.filter(c => c.id !== clientId);
        this.addFeedEvent('info', `Client "${client.name}" deleted.`);
        this.saveData();
        return { success: true, client };
    }

    getClientFacilities(clientId) {
        const facilities = this.data.sites.filter(s => s.clientId === clientId);
        return facilities.map(f => ({
            ...f,
            staffCount: new Set(
                this.data.shifts
                    .filter(s => s.siteId === f.id && (s.status === 'active' || s.status === 'upcoming'))
                    .flatMap(s => s.staffIds || [s.staffId])
            ).size,
            lowStockCount: this.data.inventory.filter(i => i.siteId === f.id && i.qty < i.minQty).length
        }));
    }

    // ─── Shifts CRUD ─────────────────────────────────────────────────────────────

    createShift(staffId, siteId, targetTime, notes, type = 'shift') {
        const id = 'SH' + Date.now();
        const staffIds = Array.isArray(staffId) ? staffId : [staffId];
        const shift = {
            id, staffIds, siteId, targetTime,
            status: 'upcoming',
            type: type,
            isRecurring: false,
            notes: notes || '',
            completedTasks: [],
            createdAt: new Date().toISOString()
        };
        this.data.shifts.push(shift);
        const staffNames = staffIds.map(sid => this.data.staff.find(s => s.id === sid)?.name || sid).join(', ');
        const site  = this.data.sites.find(s => s.id === siteId);
        this.addFeedEvent('info', `${type.charAt(0).toUpperCase() + type.slice(1)} created: ${staffNames} → ${site ? site.name : siteId}.`);
        this.saveData();
        return shift;
    }

    cancelShift(shiftId) {
        const shift = this.data.shifts.find(s => s.id === shiftId);
        if (shift) {
            const staffNames = (shift.staffIds || [shift.staffId]).map(sid => this.data.staff.find(s => s.id === sid)?.name || sid).join(', ');
            this.addFeedEvent('info', `Shift cancelled${staffNames ? ' for ' + staffNames : ''}.`);
        }
        this.data.shifts = this.data.shifts.filter(s => s.id !== shiftId);
        this.saveData();
    }

    updateShift(shiftId, updates) {
        const shift = this.data.shifts.find(s => s.id === shiftId);
        if (!shift) return;
        ['staffIds', 'staffId', 'siteId', 'targetTime', 'notes', 'status', 'type', 'isRecurring', 'recurringPattern'].forEach(k => {
            if (k in updates) {
                if (k === 'staffId' && !('staffIds' in updates)) {
                    shift.staffIds = [updates[k]];
                } else if (k !== 'staffId') {
                    shift[k] = updates[k];
                }
            }
        });
        const staffNames = (shift.staffIds || [shift.staffId]).map(sid => this.data.staff.find(s => s.id === sid)?.name || sid).join(', ');
        const site  = this.data.sites.find(s => s.id === shift.siteId);
        this.addFeedEvent('info', `Shift updated${staffNames ? ' for ' + staffNames : ''}${site ? ' at ' + site.name : ''}.`);
        this.saveData();
    }

    // Returns the conflicting shift or null. Flags overlaps within 4 h same day.
    hasShiftConflict(staffId, targetTime, excludeShiftId = null) {
        const targetMs  = new Date(targetTime).getTime();
        const targetDay = new Date(targetTime).toDateString();
        return this.data.shifts.find(s => {
            if (s.id === excludeShiftId) return false;
            const staffIds = s.staffIds || [s.staffId];
            if (!staffIds.includes(staffId)) return false;
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

    // ─── Recurring Shifts ────────────────────────────────────────────────────

    createRecurringShift(staffIds, siteId, targetTime, pattern, duration, notes) {
        const id = 'SH' + Date.now();
        const staffIdArray = Array.isArray(staffIds) ? staffIds : [staffIds];
        const recurringShift = {
            id,
            staffIds: staffIdArray,
            siteId,
            targetTime,
            status: 'upcoming',
            type: 'shift',
            isRecurring: true,
            isRecurringTemplate: true,
            recurringPattern: {
                type: pattern.type,
                endDate: pattern.endDate || null,
                occurrences: pattern.occurrences || null,
                parentId: null
            },
            notes: notes || '',
            completedTasks: [],
            createdAt: new Date().toISOString()
        };
        this.data.shifts.push(recurringShift);
        this.expandRecurringShift(id, new Date(), pattern.endDate ? new Date(pattern.endDate) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));
        const staffNames = staffIdArray.map(sid => this.data.staff.find(s => s.id === sid)?.name || sid).join(', ');
        const site = this.data.sites.find(s => s.id === siteId);
        this.addFeedEvent('info', `Recurring shift created: ${staffNames} → ${site ? site.name : siteId} (${pattern.type}).`);
        this.saveData();
        return recurringShift;
    }

    expandRecurringShift(recurringShiftId, fromDate, toDate) {
        const template = this.data.shifts.find(s => s.id === recurringShiftId);
        if (!template || !template.isRecurring) return;

        const pattern = template.recurringPattern;
        let current = new Date(template.targetTime);
        const endDate = toDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        let count = 0;

        while (current <= endDate && (!pattern.occurrences || count < pattern.occurrences)) {
            if (current >= fromDate) {
                const instanceId = 'SH' + Date.now() + '_' + count;
                const instance = {
                    ...template,
                    id: instanceId,
                    isRecurringTemplate: false,
                    targetTime: current.toISOString(),
                    recurringPattern: { ...pattern, parentId: recurringShiftId }
                };
                this.data.shifts.push(instance);
            }

            // Calculate next occurrence
            switch (pattern.type) {
                case 'daily':
                    current.setDate(current.getDate() + 1);
                    break;
                case 'weekly':
                    current.setDate(current.getDate() + 7);
                    break;
                case 'biweekly':
                    current.setDate(current.getDate() + 14);
                    break;
                case 'monthly':
                    current.setMonth(current.getMonth() + 1);
                    break;
            }
            count++;
        }
    }

    getRecurringShifts() {
        return this.data.shifts.filter(s => s.isRecurringTemplate);
    }

    getShiftsByDate(dateStr) {
        const targetDate = new Date(dateStr).toDateString();
        return this.data.shifts.filter(s => {
            const shiftDate = new Date(s.targetTime).toDateString();
            return shiftDate === targetDate && !s.isRecurringTemplate;
        });
    }

    addStaffToShift(shiftId, staffId) {
        const shift = this.data.shifts.find(s => s.id === shiftId);
        if (!shift) return;
        if (!shift.staffIds) shift.staffIds = [shift.staffId];
        if (!shift.staffIds.includes(staffId)) {
            shift.staffIds.push(staffId);
            const staffName = this.data.staff.find(s => s.id === staffId)?.name || staffId;
            this.addFeedEvent('info', `${staffName} added to shift.`);
            this.saveData();
        }
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

    // ─── Inventory Templates ────────────────────────────────────────────────────────

    getInventoryTemplate(serviceType) {
        return this.data.inventoryTemplates.find(t => t.serviceTypes.includes(serviceType)) || null;
    }

    getAllInventoryTemplates() {
        return this.data.inventoryTemplates || [];
    }

    applyTemplateToFacility(siteId, templateId) {
        const facility = this.data.sites.find(s => s.id === siteId);
        const template = this.data.inventoryTemplates.find(t => t.id === templateId);

        if (!facility || !template) return null;

        // Add items from template to inventory (if not already present)
        template.items.forEach(templateItem => {
            const existingItem = this.data.inventory.find(
                i => i.siteId === siteId && i.item === templateItem.itemName
            );
            if (!existingItem) {
                const newItem = {
                    id: 'INV' + Date.now(),
                    siteId,
                    item: templateItem.itemName,
                    qty: templateItem.defaultQty,
                    minQty: templateItem.minQty,
                    reorderQty: templateItem.defaultQty,
                    unit: templateItem.unit,
                    lastRestocked: new Date().toISOString(),
                    restockFrequency: 'weekly',
                    notes: ''
                };
                this.data.inventory.push(newItem);
            }
        });

        // Mark template as applied to facility
        if (!facility.appliedTemplate) facility.appliedTemplate = templateId;

        this.addFeedEvent('info', `Applied "${template.name}" template to ${facility.name}.`);
        this.saveData();
        return template;
    }

    addItemToTemplate(templateId, itemName, defaultQty, minQty, unit) {
        const template = this.data.inventoryTemplates.find(t => t.id === templateId);
        if (!template) return null;

        // Check if item already exists in template
        const existingItem = template.items.find(i => i.itemName.toLowerCase() === itemName.toLowerCase());
        if (existingItem) {
            // Update existing item
            existingItem.defaultQty = defaultQty;
            existingItem.minQty = minQty;
            existingItem.unit = unit;
        } else {
            // Add new item to template
            template.items.push({
                itemName,
                defaultQty: parseInt(defaultQty) || 0,
                minQty: parseInt(minQty) || 0,
                unit
            });
        }

        this.addFeedEvent('info', `Added "${itemName}" to "${template.name}" template.`);
        this.saveData();
        return template;
    }

    // ─── Supply Requests ────────────────────────────────────────────────────────────

    createSupplyRequest(siteId, items, requestedBy, notes = '', supplier = null, estimatedDelivery = null) {
        const id = 'SR' + Date.now();
        const supplyRequest = {
            id,
            siteId,
            items,  // Array of {itemName, qty, unit, reason}
            status: 'pending',
            requestedBy,
            requestedAt: new Date().toISOString(),
            approvedBy: null,
            approvedAt: null,
            orderedAt: null,
            deliveredAt: null,
            receivedAt: null,
            notes: notes.trim(),
            supplier: supplier ? supplier.trim() : null,
            estimatedDelivery,
            trackingNumber: null
        };
        this.data.supplyRequests.push(supplyRequest);
        const site = this.data.sites.find(s => s.id === siteId);
        const staff = this.data.staff.find(s => s.id === requestedBy);
        this.addFeedEvent('info', `Supply request created for ${site ? site.name : siteId} by ${staff ? staff.name : 'staff'} - ${items.length} items.`);
        this.saveData();
        return supplyRequest;
    }

    updateSupplyRequestStatus(requestId, newStatus, metadata = {}) {
        const request = this.data.supplyRequests.find(r => r.id === requestId);
        if (!request) return null;

        const oldStatus = request.status;
        request.status = newStatus;
        const now = new Date().toISOString();

        switch (newStatus) {
            case 'approved':
                request.approvedBy = metadata.approvedBy || null;
                request.approvedAt = now;
                break;
            case 'ordered':
                request.orderedAt = now;
                request.trackingNumber = metadata.trackingNumber || null;
                break;
            case 'delivered':
                request.deliveredAt = now;
                break;
            case 'received':
                request.receivedAt = now;
                // Auto-update inventory quantities
                request.items.forEach(item => {
                    const invItem = this.data.inventory.find(
                        i => i.siteId === request.siteId && i.item === item.itemName
                    );
                    if (invItem) {
                        invItem.qty += item.qty;
                        invItem.lastRestocked = now;
                    }
                });
                break;
        }

        const site = this.data.sites.find(s => s.id === request.siteId);
        const statusMessages = {
            approved: 'Manager approved',
            ordered: 'Supply order placed',
            delivered: 'Supply delivery arrived',
            received: 'Supply order received and inventory updated'
        };
        const message = statusMessages[newStatus] || `Status changed to ${newStatus}`;
        this.addFeedEvent('info', `${message} at ${site ? site.name : request.siteId}.`);
        this.saveData();
        return request;
    }

    getSupplyRequestsForSite(siteId) {
        return this.data.supplyRequests.filter(r => r.siteId === siteId);
    }

    getSupplyRequests(statusFilter = null) {
        if (!statusFilter) return this.data.supplyRequests || [];
        return (this.data.supplyRequests || []).filter(r => r.status === statusFilter);
    }

    approveSupplyRequest(requestId, managerId) {
        return this.updateSupplyRequestStatus(requestId, 'approved', { approvedBy: managerId });
    }

    cancelSupplyRequest(requestId, reason = '') {
        const request = this.data.supplyRequests.find(r => r.id === requestId);
        if (!request) return null;
        request.status = 'cancelled';
        const site = this.data.sites.find(s => s.id === request.siteId);
        this.addFeedEvent('alert', `Supply request cancelled at ${site ? site.name : request.siteId}${reason ? ' - ' + reason : ''}.`);
        this.saveData();
        return request;
    }

    getItemsNeedingReorder(siteId) {
        return this.data.inventory.filter(i => i.siteId === siteId && i.qty < i.minQty);
    }

    updateRestockFrequency(invId, frequency) {
        const item = this.data.inventory.find(i => i.id === invId);
        if (!item) return null;
        item.restockFrequency = frequency;
        this.saveData();
        return item;
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
