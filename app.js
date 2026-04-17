// GCS Command Center — Manager Dashboard Logic

// ─── State ───────────────────────────────────────────────────────────────────
let currentFeedFilter    = 'all';
let currentShiftFilter   = 'all';
let currentShiftDateRange = 'all';
let shiftDateFrom        = null;
let shiftDateTo          = null;
let currentDirFilter     = 'all';
let currentInvSiteFilter = 'all';
let schedulerWeekOffset  = 0;
let schedulerFilterSite  = 'all';
let schedulerFilterStaff = 'all';
let schedulerDragStaffId = null;
let schedulerDragDateStr = null;
let shiftDonutChart      = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
    if (!window.db) return;
    const session = window.db.getSession();
    if (!session || session.role !== 'manager') { window.location.href = 'login.html'; return; }

    const display = document.getElementById('user-name-display');
    if (display) display.textContent = session.username;

    renderDashboard();
    window.addEventListener('db-update', renderDashboard);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

window.logout = function () {
    if (window.db) window.db.clearSession();
    window.location.href = 'login.html';
};

window.changeRole = function (roleValue) {
    const session = { ...window.db.getSession() };
    if (roleValue === 'cleaner') {
        session.role    = 'staff';
        session.staffId = 'S1';
        try { localStorage.setItem('gcs_session', JSON.stringify(session)); } catch (e) {}
        window.location.href = 'mobile.html';
        return;
    }
    if (roleValue === 'maintenance') {
        session.role    = 'staff';
        session.staffId = 'S2';
        try { localStorage.setItem('gcs_session', JSON.stringify(session)); } catch (e) {}
        window.location.href = 'mobile.html';
        return;
    }
    // manager / supervisor — stay on dashboard
    session.role    = 'manager';
    session.staffId = null;
    try { localStorage.setItem('gcs_session', JSON.stringify(session)); } catch (e) {}
    window.location.reload();
};

// ─── Navigation ───────────────────────────────────────────────────────────────

const VIEW_TITLES = {
    cscenter:    'CS Center (Live)',
    overview:    'Overview Dashboard',
    shiftmgt:    'Shift Management',
    scheduler:   'Advanced Scheduler',
    staffdir:    'Staff Directory',
    locationsmgt:'Facilities & Clients',
    inventory:   'Inventory & Supply',
    alerts:      'Alerts & Configs',
    exceptions:  'Exceptions Drill-down',
    reports:     'Reports & Billing',
    messagecenter:'AI Message Center'
};

window.navigateView = function (viewId, el) {
    document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-master-btn').forEach(b => b.classList.remove('active'));

    const target = document.getElementById('view-' + viewId);
    if (target) target.classList.add('active');
    if (el)     el.classList.add('active');

    const titleEl = document.getElementById('top-nav-title');
    if (titleEl) titleEl.textContent = VIEW_TITLES[viewId] || 'Dashboard';

    // Lazy renders for data-heavy views
    if (viewId === 'overview')     renderOverview();
    if (viewId === 'inventory')    renderInventory();
    if (viewId === 'exceptions')   renderExceptions();
    if (viewId === 'shiftmgt')     renderShiftManagement();
    if (viewId === 'messagecenter') renderAIMessageCenter();
    if (viewId === 'scheduler')    renderScheduler();
};

// ─── Drawer ───────────────────────────────────────────────────────────────────

window.openDrawer = function (title, html) {
    document.getElementById('drawer-title').textContent   = title;
    document.getElementById('drawer-content').innerHTML   = html;
    document.getElementById('global-drawer').classList.add('open');
    document.getElementById('drawer-overlay').classList.add('open');
};

window.closeDrawer = function () {
    document.getElementById('global-drawer').classList.remove('open');
    document.getElementById('drawer-overlay').classList.remove('open');
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHTML(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const colors = {
        success: 'bg-emerald-600 text-white',
        error:   'bg-red-600 text-white',
        info:    'bg-blue-600 text-white',
        warning: 'bg-amber-500 text-white'
    };
    const icons = { success: 'check_circle', error: 'error', info: 'info', warning: 'warning' };
    const toast = document.createElement('div');
    toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold ${colors[type] || colors.info} transition-all duration-300 translate-y-2 opacity-0`;
    toast.innerHTML = `<span class="material-symbols-outlined text-[18px]" style="font-variation-settings:'FILL' 1">${icons[type] || 'info'}</span><span>${escapeHTML(message)}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => { toast.classList.remove('translate-y-2', 'opacity-0'); });
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function timeAgo(isoStr) {
    const diff = Math.floor((Date.now() - new Date(isoStr)) / 60000);
    if (diff < 1)  return 'just now';
    if (diff < 60) return `${diff}m ago`;
    const h = Math.floor(diff / 60);
    if (h < 24)    return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

function statusBadge(status) {
    const map = {
        active:    'bg-emerald-100 text-emerald-700 border-emerald-200',
        late:      'bg-red-100    text-red-700    border-red-200',
        upcoming:  'bg-blue-100   text-blue-700   border-blue-200',
        completed: 'bg-slate-100  text-slate-600  border-slate-200'
    };
    const cls = map[status] || 'bg-slate-100 text-slate-600 border-slate-200';
    return `<span class="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${cls}">${escapeHTML(status)}</span>`;
}

window.confirmResetData = function () {
    document.getElementById('reset-modal').classList.remove('hidden');
};

// ─── Master Render ────────────────────────────────────────────────────────────

function renderDashboard() {
    const data = window.db.getDashboardData();
    renderAlerts(data.shifts);
    renderCSCenterFeed(data.feed);
    renderMap(data.shifts);
    renderLocations(data.sites, data.shifts);
    renderStaffDirectory(data.staffList, data.shifts);
    renderDirectoryStats(data.staffList, data.shifts);
    renderInvoices(data.sites);
    renderOperationsFeed(data.feed);
    populateShiftFormDropdowns(data.staffList, data.sites);
    renderSchedulerPool(data.staffList);
    updateAlertDot(data.shifts);
}

// ─── Alert Dot & Counter ──────────────────────────────────────────────────────

function updateAlertDot(shifts) {
    const lateCount = shifts.filter(s => s.status === 'late').length;
    const dot       = document.getElementById('alert-dot');
    const counter   = document.getElementById('alert-counter');
    if (dot)     dot.classList.toggle('hidden', lateCount === 0);
    if (counter) counter.textContent = lateCount > 0 ? `${lateCount} active alert${lateCount > 1 ? 's' : ''}` : 'All clear';
}

// ─── CS Center: Alerts Ribbon ─────────────────────────────────────────────────

function renderAlerts(shifts) {
    const bar = document.getElementById('alerts-bar');
    if (!bar) return;
    const late = shifts.filter(s => s.status === 'late');

    if (late.length === 0) {
        bar.innerHTML = `<div class="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm font-semibold"><span class="material-symbols-outlined text-[18px]">check_circle</span> All shifts on time</div>`;
        return;
    }
    bar.innerHTML = late.map(s => {
        const lateMin = Math.max(0, Math.floor((Date.now() - new Date(s.targetTime)) / 60000));
        return `
        <button onclick="openShiftAlertDetail('${escapeHTML(s.id)}')"
            class="flex flex-col shrink-0 w-60 bg-error-bg rounded-xl p-4 text-left border border-red-200 hover:shadow-lg hover:-translate-y-0.5 transition-all relative overflow-hidden group">
            <div class="absolute left-0 top-0 bottom-0 w-1 bg-error-text rounded-l-xl"></div>
            <div class="flex items-start justify-between w-full mb-1 pl-2">
                <span class="text-error-text font-bold text-sm leading-tight truncate">${escapeHTML(s.site ? s.site.name : '')}</span>
                <span class="material-symbols-outlined text-error-text text-[18px] ml-2" style="font-variation-settings:'FILL' 1">warning</span>
            </div>
            <span class="text-error-text font-bold text-xs pl-2">${escapeHTML(s.staff ? s.staff.name : '')}</span>
            <span class="text-error-text/70 text-[10px] pl-2 font-medium">${lateMin}m late — Missed Clock-in</span>
            <span class="text-error-text text-[10px] pl-2 mt-1 font-bold group-hover:underline">Click for details & actions →</span>
        </button>`;
    }).join('');
}

window.openShiftAlertDetail = function (shiftId) {
    const data  = window.db.getDashboardData();
    const s     = data.shifts.find(sh => sh.id === shiftId);
    if (!s) return;
    const staff    = s.staff   || {};
    const site     = s.site    || {};
    const lateMin  = Math.max(0, Math.floor((Date.now() - new Date(s.targetTime)) / 60000));
    const schedTime = new Date(s.targetTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const mapsUrl  = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(site.address || site.name || '')}`;

    openDrawer(`⚠ Late Alert — ${site.name || ''}`, `
        <div class="space-y-4">
            <div class="flex items-center gap-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                <div class="w-14 h-14 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-black text-xl shrink-0">${escapeHTML(staff.avatar || '?')}</div>
                <div>
                    <h3 class="font-black text-slate-900 text-base">${escapeHTML(staff.name || 'Unknown')}</h3>
                    <p class="text-sm text-slate-500 capitalize">${escapeHTML(staff.type || '')} · ID ${escapeHTML(staff.id || '')}</p>
                    <span class="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded-md text-[10px] font-black uppercase">${lateMin}m Late</span>
                </div>
            </div>

            <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-sm">
                <p class="font-bold text-slate-800">${escapeHTML(site.name || '')}</p>
                <p class="text-slate-500 text-xs">${escapeHTML(site.address || 'No address on file')}</p>
                <p class="text-slate-500 text-xs">Scheduled: ${schedTime} · Notes: ${escapeHTML(s.notes || 'None')}</p>
            </div>

            <div class="grid grid-cols-2 gap-2">
                ${staff.phone ? `<a href="tel:${escapeHTML(staff.phone)}" class="flex items-center justify-center gap-2 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold rounded-xl text-sm hover:bg-emerald-100 transition-colors">
                    <span class="material-symbols-outlined text-[18px]">call</span> Call</a>` : ''}
                ${staff.email ? `<a href="mailto:${escapeHTML(staff.email)}?subject=Missed+Clock-In+Alert&body=Hi+${encodeURIComponent(staff.name || '')}%2C+you+missed+your+clock-in+at+${encodeURIComponent(site.name || '')}." class="flex items-center justify-center gap-2 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 font-bold rounded-xl text-sm hover:bg-blue-100 transition-colors">
                    <span class="material-symbols-outlined text-[18px]">mail</span> Email</a>` : ''}
                <button onclick="closeDrawer(); openEditShiftDrawer('${escapeHTML(shiftId)}')" class="flex items-center justify-center gap-2 py-2.5 bg-amber-50 border border-amber-200 text-amber-700 font-bold rounded-xl text-sm hover:bg-amber-100 transition-colors col-span-${staff.phone && staff.email ? '1' : '1'}">
                    <span class="material-symbols-outlined text-[18px]">swap_horiz</span> Reassign Shift</button>
                <button onclick="window.db.notifyStaff('${escapeHTML(staff.id || '')}', 'You have a missed clock-in alert at ${escapeHTML(site.name || '')}. Please respond immediately.'); showToast('Alert sent to ${escapeHTML(staff.name || '')}', 'info')" class="flex items-center justify-center gap-2 py-2.5 bg-purple-50 border border-purple-200 text-purple-700 font-bold rounded-xl text-sm hover:bg-purple-100 transition-colors">
                    <span class="material-symbols-outlined text-[18px]">notifications_active</span> Send Alert</button>
            </div>

            <a href="${escapeHTML(mapsUrl)}" target="_blank" rel="noopener" class="flex items-center justify-center gap-2 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-100 transition-colors w-full">
                <span class="material-symbols-outlined text-[18px]">directions</span> Get Directions to Site</a>
        </div>`);
};

// ─── CS Center: Feed ──────────────────────────────────────────────────────────

function feedItemHTML(item) {
    const themes = {
        alert:   { bar: 'bg-red-500',     icon: 'warning',       bg: 'bg-red-50',     text: 'text-red-600' },
        success: { bar: 'bg-emerald-500', icon: 'check_circle',  bg: 'bg-emerald-50', text: 'text-emerald-600' },
        info:    { bar: 'bg-blue-500',    icon: 'info',          bg: 'bg-blue-50',    text: 'text-blue-600' },
        warning: { bar: 'bg-amber-500',   icon: 'warning',       bg: 'bg-amber-50',   text: 'text-amber-600' }
    };
    const t = themes[item.type] || themes.info;
    return `
        <button onclick="openFeedDetail('${escapeHTML(item.id)}')" class="w-full text-left relative bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div class="absolute left-0 top-0 bottom-0 w-1 ${t.bar}"></div>
            <div class="flex items-start gap-3 pl-3 pr-3 py-3">
                <div class="${t.bg} ${t.text} p-1.5 rounded-full flex-shrink-0 mt-0.5">
                    <span class="material-symbols-outlined text-[16px]" style="font-variation-settings:'FILL' 1">${t.icon}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start gap-2">
                        <span class="text-[10px] font-black uppercase tracking-wider ${t.text}">${escapeHTML(item.type)}</span>
                        <span class="text-[10px] text-slate-400 shrink-0">${timeAgo(item.timestamp)}</span>
                    </div>
                    <p class="text-xs text-slate-700 leading-relaxed mt-0.5">${escapeHTML(item.message)}</p>
                </div>
            </div>
        </button>`;
}

function renderCSCenterFeed(feed) {
    const el = document.getElementById('feed-list');
    if (!el) return;
    const filtered = currentFeedFilter === 'issues'
        ? feed.filter(f => f.type === 'alert' || f.type === 'warning')
        : feed;
    el.innerHTML = filtered.length
        ? filtered.map(feedItemHTML).join('')
        : `<p class="text-xs text-slate-400 text-center py-6 italic">No activity yet.</p>`;
}

window.openFeedDetail = function (eventId) {
    const data  = window.db.getDashboardData();
    const item  = data.feed.find(f => f.id === eventId);
    if (!item) return;

    const themes = {
        alert:   { bg: 'bg-red-50 border-red-200',     text: 'text-red-700',     label: 'Alert' },
        success: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'Success' },
        info:    { bg: 'bg-blue-50 border-blue-200',    text: 'text-blue-700',    label: 'Info' },
        warning: { bg: 'bg-amber-50 border-amber-200',  text: 'text-amber-700',   label: 'Warning' }
    };
    const t = themes[item.type] || themes.info;
    const ts = new Date(item.timestamp).toLocaleString([], { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });

    // Detect staff mentions and build action buttons
    const msg = item.message || '';
    let actionHTML = '';
    const staffMatch = data.staffList.find(s => msg.includes(s.name));
    const siteMatch  = data.sites.find(s => msg.includes(s.name));
    const shiftMatch = staffMatch ? data.shifts.find(sh => sh.staffId === staffMatch.id && (sh.status === 'late' || sh.status === 'active' || sh.status === 'upcoming')) : null;

    if (staffMatch) {
        actionHTML += `<button onclick="closeDrawer(); viewStaffProfile('${escapeHTML(staffMatch.id)}')" class="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-700 font-bold rounded-lg text-xs hover:bg-blue-100 transition-colors">
            <span class="material-symbols-outlined text-[14px]">person</span> View ${escapeHTML(staffMatch.name)}'s Profile</button>`;
        if (staffMatch.phone)
            actionHTML += `<a href="tel:${escapeHTML(staffMatch.phone)}" class="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold rounded-lg text-xs hover:bg-emerald-100 transition-colors">
                <span class="material-symbols-outlined text-[14px]">call</span> Call ${escapeHTML(staffMatch.name)}</a>`;
        if (staffMatch.email)
            actionHTML += `<a href="mailto:${escapeHTML(staffMatch.email)}" class="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-lg text-xs hover:bg-slate-100 transition-colors">
                <span class="material-symbols-outlined text-[14px]">mail</span> Email ${escapeHTML(staffMatch.name)}</a>`;
    }
    if (shiftMatch && (item.type === 'alert' || msg.toLowerCase().includes('late') || msg.toLowerCase().includes('miss')))
        actionHTML += `<button onclick="closeDrawer(); openEditShiftDrawer('${escapeHTML(shiftMatch.id)}')" class="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 font-bold rounded-lg text-xs hover:bg-amber-100 transition-colors">
            <span class="material-symbols-outlined text-[14px]">swap_horiz</span> Reassign Shift</button>`;
    if (siteMatch && siteMatch.address)
        actionHTML += `<a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(siteMatch.address)}" target="_blank" rel="noopener" class="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-lg text-xs hover:bg-slate-100 transition-colors">
            <span class="material-symbols-outlined text-[14px]">directions</span> Directions to ${escapeHTML(siteMatch.name)}</a>`;
    if (msg.toLowerCase().includes('stock') || msg.toLowerCase().includes('restock') || msg.toLowerCase().includes('supply'))
        actionHTML += `<button onclick="closeDrawer(); navigateView('inventory', document.querySelector('[onclick*=inventory]'))" class="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-lg text-xs hover:bg-slate-100 transition-colors">
            <span class="material-symbols-outlined text-[14px]">inventory_2</span> View Inventory</button>`;

    openDrawer('Event Detail', `
        <div class="space-y-4">
            <div class="p-4 ${t.bg} border rounded-xl">
                <span class="text-[10px] font-black uppercase tracking-wider ${t.text}">${t.label}</span>
                <p class="text-sm font-semibold text-slate-800 mt-1 leading-relaxed">${escapeHTML(msg)}</p>
                <p class="text-xs text-slate-400 mt-2">${ts}</p>
            </div>
            ${actionHTML ? `<div class="space-y-2"><p class="text-xs font-bold text-slate-500 uppercase tracking-wide">Actions</p><div class="flex flex-col gap-2">${actionHTML}</div></div>` : '<p class="text-xs text-slate-400 italic">No direct actions available for this event.</p>'}
        </div>`);
};

window.setFeedFilter = function (filter) {
    currentFeedFilter = filter;
    const data = window.db.getDashboardData();
    renderCSCenterFeed(data.feed);
    document.getElementById('feed-filter-all').className    = filter === 'all'
        ? 'px-3 py-1 bg-slate-900 text-white rounded-full text-xs font-semibold'
        : 'px-3 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-full text-xs font-semibold';
    document.getElementById('feed-filter-issues').className = filter === 'issues'
        ? 'px-3 py-1 bg-slate-900 text-white rounded-full text-xs font-semibold'
        : 'px-3 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-full text-xs font-semibold';
};

// ─── CS Center: Map ───────────────────────────────────────────────────────────

function renderMap(shifts) {
    const map = document.getElementById('map-pins');
    if (!map) return;
    map.innerHTML = '';
    const cols = 4, rows = 3;
    shifts.forEach((s, i) => {
        const col  = i % cols;
        const row  = Math.floor(i / cols) % rows;
        const left = 12 + col * 22;
        const top  = 15 + row * 28;
        const color = s.status === 'active' ? '#10b981' : s.status === 'late' ? '#ef4444' : '#94a3b8';
        const pin   = document.createElement('div');
        pin.style.cssText = `position:absolute;top:${top}%;left:${left}%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;z-index:1`;
        pin.title = `${s.staff ? s.staff.name : ''} — ${s.site ? s.site.name : ''}`;
        pin.innerHTML = `
            <div style="background:white;border:1px solid #e2e8f0;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;color:#1e293b;box-shadow:0 1px 4px rgba(0,0,0,0.1);white-space:nowrap;">${escapeHTML(s.site ? s.site.name : '')}</div>
            <div style="width:32px;height:32px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:11px;">${escapeHTML(s.staff ? s.staff.avatar : '?')}</div>`;
        pin.addEventListener('click', () => openMapPinDetail(s.id));
        map.appendChild(pin);
    });
}

window.openMapPinDetail = function (shiftId) {
    const data  = window.db.getDashboardData();
    const s     = data.shifts.find(sh => sh.id === shiftId);
    if (!s) return;
    const staff    = s.staff || {};
    const site     = s.site  || {};
    const mapsUrl  = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(site.address || site.name || '')}`;
    const clockInStr = s.clockInTime ? new Date(s.clockInTime).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : null;
    const schedStr   = new Date(s.targetTime).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    const statusColor = s.status === 'active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                      : s.status === 'late'   ? 'bg-red-100 text-red-700 border-red-200'
                      : 'bg-blue-100 text-blue-700 border-blue-200';
    const tasks     = s.tasks || [];
    const done      = s.completedTasks || [];
    const pct       = tasks.length ? Math.round((done.length / tasks.length) * 100) : null;

    openDrawer(`${site.name || 'Site'} — Live`, `
        <div class="space-y-4">
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <h3 class="font-black text-slate-900 text-base">${escapeHTML(site.name || '')}</h3>
                <p class="text-xs text-slate-500">${escapeHTML(site.address || 'Address not set')}</p>
                <span class="inline-block mt-1 px-2 py-0.5 border rounded-md text-[10px] font-black uppercase ${statusColor}">${s.status}</span>
            </div>

            <div class="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl">
                <div class="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-lg shrink-0">${escapeHTML(staff.avatar || '?')}</div>
                <div class="flex-1 min-w-0">
                    <p class="font-bold text-slate-900">${escapeHTML(staff.name || 'Unknown')}</p>
                    <p class="text-xs text-slate-500 capitalize">${escapeHTML(staff.type || '')} · Scheduled ${schedStr}${clockInStr ? ' · Clocked in ' + clockInStr : ''}</p>
                    ${pct !== null ? `<div class="flex items-center gap-2 mt-1.5"><div class="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-emerald-500 rounded-full" style="width:${pct}%"></div></div><span class="text-[10px] font-bold text-slate-500">${pct}% tasks</span></div>` : ''}
                </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
                ${staff.phone ? `<a href="tel:${escapeHTML(staff.phone)}" class="flex items-center justify-center gap-2 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold rounded-xl text-sm hover:bg-emerald-100 transition-colors">
                    <span class="material-symbols-outlined text-[18px]">call</span> Call</a>` : ''}
                ${staff.email ? `<a href="mailto:${escapeHTML(staff.email)}" class="flex items-center justify-center gap-2 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 font-bold rounded-xl text-sm hover:bg-blue-100 transition-colors">
                    <span class="material-symbols-outlined text-[18px]">mail</span> Email</a>` : ''}
                <button onclick="closeDrawer(); viewStaffProfile('${escapeHTML(staff.id || '')}')" class="flex items-center justify-center gap-2 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-100 transition-colors">
                    <span class="material-symbols-outlined text-[18px]">person</span> Profile</button>
                ${s.status !== 'completed' ? `<button onclick="closeDrawer(); openEditShiftDrawer('${escapeHTML(shiftId)}')" class="flex items-center justify-center gap-2 py-2.5 bg-amber-50 border border-amber-200 text-amber-700 font-bold rounded-xl text-sm hover:bg-amber-100 transition-colors">
                    <span class="material-symbols-outlined text-[18px]">edit</span> Edit Shift</button>` : ''}
            </div>

            <a href="${escapeHTML(mapsUrl)}" target="_blank" rel="noopener" class="flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-100 transition-colors w-full">
                <span class="material-symbols-outlined text-[18px]">directions</span> Get Directions</a>
        </div>`);
};

// ─── Overview Dashboard ───────────────────────────────────────────────────────

function renderOverview() {
    const stats = window.db.getOverviewStats();

    // KPI cards
    const kpiGrid = document.getElementById('overview-kpi-grid');
    if (kpiGrid) {
        const kpis = [
            { label: 'Total Shifts',     value: stats.total,       suffix: '',   trend: null,              color: 'text-slate-900' },
            { label: 'Active Now',       value: stats.active,      suffix: '',   trend: null,              color: 'text-emerald-600' },
            { label: 'Late Exceptions',  value: stats.late,        suffix: '',   trend: null,              color: stats.late > 0 ? 'text-red-600' : 'text-slate-900' },
            { label: 'Compliance Rate',  value: stats.compliance,  suffix: '%',  trend: null,              color: stats.compliance >= 90 ? 'text-emerald-600' : 'text-amber-600' }
        ];
        kpiGrid.innerHTML = kpis.map(k => `
            <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p class="text-xs font-bold text-slate-500 uppercase tracking-widest">${escapeHTML(k.label)}</p>
                <p class="text-3xl font-extrabold ${k.color} mt-1">${k.value}${escapeHTML(k.suffix)}</p>
            </div>`).join('');
    }

    // Donut chart
    const canvas = document.getElementById('shift-donut-chart');
    if (canvas) {
        if (shiftDonutChart) shiftDonutChart.destroy();
        shiftDonutChart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: ['Active', 'Upcoming', 'Late', 'Completed'],
                datasets: [{
                    data: [stats.active, stats.upcoming, stats.late, stats.completed],
                    backgroundColor: ['#10b981', '#3b82f6', '#ef4444', '#94a3b8'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12 } } },
                cutout: '68%'
            }
        });
    }

    // Exception site bars
    const barsEl = document.getElementById('exception-site-bars');
    if (barsEl) {
        const entries = Object.entries(stats.latesBySite).sort((a, b) => b[1] - a[1]);
        if (entries.length === 0) {
            barsEl.innerHTML = `<p class="text-sm text-emerald-600 font-medium flex items-center gap-2"><span class="material-symbols-outlined text-[16px]">check_circle</span>No late exceptions recorded</p>`;
        } else {
            barsEl.innerHTML = entries.map(([site, count]) => {
                const pct = Math.round((count / stats.maxLate) * 100);
                return `
                    <div>
                        <div class="flex justify-between text-xs font-medium text-slate-600 mb-1">
                            <span class="truncate max-w-[220px]">${escapeHTML(site)}</span>
                            <span class="font-bold text-red-600 ml-2">${count}</span>
                        </div>
                        <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div class="h-full bg-red-400 rounded-full transition-all" style="width:${pct}%"></div>
                        </div>
                    </div>`;
            }).join('');
        }
    }

    // Recent feed
    const feedEl = document.getElementById('overview-feed');
    if (feedEl) {
        const data = window.db.getDashboardData();
        feedEl.innerHTML = data.feed.slice(0, 8).map(item => {
            const dotColor = item.type === 'alert' ? 'bg-red-500' : item.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500';
            return `<div class="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                <div class="w-2 h-2 rounded-full ${dotColor} mt-1.5 shrink-0"></div>
                <p class="text-xs text-slate-700 flex-1">${escapeHTML(item.message)}</p>
                <span class="text-[10px] text-slate-400 shrink-0">${timeAgo(item.timestamp)}</span>
            </div>`;
        }).join('');
    }
}

// ─── Shift Management ─────────────────────────────────────────────────────────

function getShiftDateRange() {
    const now = new Date();
    if (currentShiftDateRange === 'today') {
        return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999) };
    }
    if (currentShiftDateRange === 'week') {
        const day = now.getDay();
        const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1)); mon.setHours(0,0,0,0);
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23,59,59,999);
        return { start: mon, end: sun };
    }
    if (currentShiftDateRange === 'month') {
        return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999) };
    }
    if (currentShiftDateRange === 'custom' && shiftDateFrom && shiftDateTo) {
        return { start: new Date(shiftDateFrom + 'T00:00:00'), end: new Date(shiftDateTo + 'T23:59:59') };
    }
    return { start: null, end: null };
}

window.setShiftDateRange = function (range) {
    currentShiftDateRange = range;
    if (range === 'custom') {
        shiftDateFrom = (document.getElementById('shift-from-date') || {}).value || null;
        shiftDateTo   = (document.getElementById('shift-to-date')   || {}).value || null;
    }
    document.querySelectorAll('.shift-date-range-btn').forEach(b => {
        b.className = b.id === 'sdr-' + range
            ? 'shift-date-range-btn px-3 py-1 bg-slate-900 text-white rounded-full text-xs font-bold'
            : 'shift-date-range-btn px-3 py-1 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-full text-xs font-bold';
    });
    renderShiftManagement();
};

function renderShiftManagement() {
    const data  = window.db.getDashboardData();
    let all     = data.shifts;
    const tbody = document.getElementById('shift-table-body');
    if (!tbody) return;

    // Date range filter
    const { start, end } = getShiftDateRange();
    if (start && end) {
        all = all.filter(s => {
            const t = new Date(s.targetTime);
            return t >= start && t <= end;
        });
    }

    // Type filter
    let filtered = all;
    if (window.currentShiftTypeFilter) {
        filtered = all.filter(s => s.type === window.currentShiftTypeFilter);
    }

    // Status filter
    if (currentShiftFilter !== 'all') {
        filtered = filtered.filter(s => s.status === currentShiftFilter);
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="px-5 py-8 text-center text-sm text-slate-400 italic">No shifts match this filter.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(s => {
        const time = new Date(s.targetTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const canCancel = s.status !== 'completed';
        const isTask = s.type === 'task';

        // Handle multi-staff display
        const staffList = s.staffList || [s.staff];
        const staffDisplay = staffList.length > 1
            ? `<div class="flex items-center gap-2">
                <div class="flex -space-x-2">
                  ${staffList.slice(0, 3).map((st, i) => `<div title="${escapeHTML(st?.name || '')}" class="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs border border-white">${escapeHTML(st?.avatar || '?')}</div>`).join('')}
                </div>
                <span class="text-xs font-semibold text-slate-600">${staffList.length} staff</span>
              </div>`
            : `<div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">${escapeHTML(s.staff ? s.staff.avatar : '?')}</div>
                <span class="font-semibold text-slate-900 group-hover:text-primary transition-colors">${escapeHTML(s.staff ? s.staff.name : s.staffId)}</span>
              </div>`;

        const statusDisplay = isTask
            ? '<span class="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">TASK</span>'
            : statusBadge(s.status);

        const rowClass = isTask ? 'bg-orange-50' : 'hover:bg-slate-50';

        return `<tr class="${rowClass} transition-colors cursor-pointer group" onclick="openEditShiftDrawer('${escapeHTML(s.id)}')">
            <td class="px-5 py-3">${staffDisplay}</td>
            <td class="px-5 py-3 text-slate-600 text-sm">${escapeHTML(s.site ? s.site.name : s.siteId)}</td>
            <td class="px-5 py-3 text-slate-600 text-xs">${time}</td>
            <td class="px-5 py-3">${statusDisplay}</td>
            <td class="px-5 py-3 text-slate-500 text-xs max-w-[160px] truncate">${escapeHTML(s.notes || '—')}</td>
            <td class="px-5 py-3 text-right" onclick="event.stopPropagation()">
                <div class="flex items-center justify-end gap-1">
                    <button onclick="openEditShiftDrawer('${escapeHTML(s.id)}')" class="px-2 py-1 text-xs font-bold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">Edit</button>
                    ${canCancel ? `<button onclick="cancelShiftItem('${escapeHTML(s.id)}')" class="px-2 py-1 text-xs font-bold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">Cancel</button>` : ''}
                </div>
            </td>
        </tr>`;
    }).join('');
}

// ─── Shift Form Helpers ──────────────────────────────────────────────────

window.selectShiftType = function (type) {
    document.querySelectorAll('.shift-type-btn').forEach(b => {
        const isSelected = b.getAttribute('data-type') === type;
        b.className = isSelected
            ? 'shift-type-btn px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold'
            : 'shift-type-btn px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-bold';
    });

    document.getElementById('shift-form-fields').style.display = type === 'shift' ? 'block' : 'none';
    document.getElementById('task-form-fields').style.display = type === 'task' ? 'block' : 'none';

    window.currentShiftType = type;
};

window.toggleRecurringOptions = function () {
    const recurring = document.getElementById('shift-recurring').checked;
    document.getElementById('recurring-options').style.display = recurring ? 'grid' : 'none';
};

window.toggleRecurringEndOption = function () {
    const endType = document.getElementById('recurring-end-type').value;
    const field = document.getElementById('recurring-end-field');
    if (endType === 'date') {
        field.innerHTML = '<label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">End Date</label><input type="date" id="shift-end-date" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none"/>';
    } else {
        field.innerHTML = '<label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Number of Shifts</label><input type="number" id="shift-end-occurrences" min="1" value="10" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none"/>';
    }
};

window.getSelectedStaffIds = function () {
    const staffSelect = document.getElementById('shift-staff');
    if (!staffSelect) return [];
    const selected = Array.from(staffSelect.selectedOptions || []).map(o => o.value);
    return selected.length > 0 ? selected : [];
};

window.filterShifts = function (filter) {
    // Check if this is a type filter (all, shift, task) or status filter (active, upcoming, late, completed)
    if (['all', 'shift', 'task'].includes(filter)) {
        currentShiftTypeFilter = filter === 'all' ? null : filter;
        document.getElementById('sft-all').className = filter === 'all'
            ? 'shift-filter-btn px-4 py-1.5 bg-slate-900 text-white rounded-full text-xs font-bold'
            : 'shift-filter-btn px-4 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-full text-xs font-bold';
        document.getElementById('sft-shift').className = filter === 'shift'
            ? 'shift-filter-btn px-4 py-1.5 bg-slate-900 text-white rounded-full text-xs font-bold'
            : 'shift-filter-btn px-4 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-full text-xs font-bold';
        document.getElementById('sft-task').className = filter === 'task'
            ? 'shift-filter-btn px-4 py-1.5 bg-slate-900 text-white rounded-full text-xs font-bold'
            : 'shift-filter-btn px-4 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-full text-xs font-bold';
    } else {
        currentShiftFilter = filter;
        ['active', 'upcoming', 'late', 'completed'].forEach(status => {
            const btn = document.getElementById('sft-' + status);
            if (btn) {
                btn.className = status === filter
                    ? 'shift-filter-btn px-4 py-1.5 bg-slate-900 text-white rounded-full text-xs font-bold'
                    : 'shift-filter-btn px-4 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-full text-xs font-bold';
            }
        });
    }
    renderShiftManagement();
};

window.toggleCreateShiftForm = function () {
    const form = document.getElementById('create-shift-form');
    form.classList.toggle('hidden');

    if (!form.classList.contains('hidden')) {
        // Initialize form
        window.currentShiftType = 'shift';
        selectShiftType('shift');

        // Set default time to now + 30min
        const dt = document.getElementById('shift-time');
        const taskDt = document.getElementById('task-time');
        if ((dt || taskDt) && (!dt?.value || !taskDt?.value)) {
            const d = new Date(Date.now() + 30 * 60000);
            const timeStr = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            if (dt) dt.value = timeStr;
            if (taskDt) taskDt.value = timeStr;
        }

        // Populate dropdowns
        const data = window.db.getDashboardData();
        populateShiftFormDropdowns(data.staffList, data.sites);
    }
};

function populateShiftFormDropdowns(staffList, sites) {
    // Populate shift form (multi-select)
    const staffSel = document.getElementById('shift-staff');
    if (staffSel && staffSel.options.length < 2) {
        staffSel.innerHTML = staffList.map(s => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.name)} (${escapeHTML(s.type)})</option>`).join('');
    }

    // Populate shift sites
    const siteSel = document.getElementById('shift-site');
    if (siteSel && siteSel.options.length < 2) {
        siteSel.innerHTML = '<option value="">Select Site…</option>' +
            sites.map(s => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.name)}</option>`).join('');
    }

    // Populate task form (single-select)
    const taskStaffSel = document.getElementById('task-staff');
    if (taskStaffSel && taskStaffSel.options.length < 2) {
        taskStaffSel.innerHTML = '<option value="">Select Staff…</option>' +
            staffList.map(s => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.name)} (${escapeHTML(s.type)})</option>`).join('');
    }

    // Populate task sites
    const taskSiteSel = document.getElementById('task-site');
    if (taskSiteSel && taskSiteSel.options.length < 2) {
        taskSiteSel.innerHTML = '<option value="">Select Site…</option>' +
            sites.map(s => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.name)}</option>`).join('');
    }
}

window.submitCreateShift = function () {
    const shiftType = window.currentShiftType || 'shift';

    if (shiftType === 'shift') {
        const staffIds = getSelectedStaffIds();
        const siteId  = document.getElementById('shift-site').value;
        const time    = document.getElementById('shift-time').value;
        const notes   = document.getElementById('shift-notes').value;
        const isRecurring = document.getElementById('shift-recurring')?.checked || false;

        if (staffIds.length === 0 || !siteId || !time) {
            showToast('Please select Staff, Site, and Time.', 'error');
            return;
        }

        if (isRecurring) {
            const pattern = document.getElementById('recurring-end-type').value;
            const patternType = document.getElementById('shift-pattern').value;
            const recurringPattern = {
                type: patternType,
                endDate: pattern === 'date' ? document.getElementById('shift-end-date').value : null,
                occurrences: pattern === 'count' ? parseInt(document.getElementById('shift-end-occurrences')?.value || 10) : null
            };
            window.db.createRecurringShift(staffIds, siteId, new Date(time).toISOString(), recurringPattern, null, notes);
            showToast(`Recurring shift created for ${staffIds.length} staff member(s)!`, 'success');
        } else {
            staffIds.forEach(staffId => {
                window.db.createShift(staffId, siteId, new Date(time).toISOString(), notes, 'shift');
            });
            showToast(`Shift created for ${staffIds.length} staff member(s)!`, 'success');
        }
    } else {
        // Task creation
        const staffId = document.getElementById('task-staff').value;
        const siteId  = document.getElementById('task-site').value;
        const time    = document.getElementById('task-time').value;
        const notes   = document.getElementById('task-notes').value;

        if (!staffId || !siteId || !time) {
            showToast('Please fill in Staff, Site, and Time.', 'error');
            return;
        }

        window.db.createShift(staffId, siteId, new Date(time).toISOString(), notes, 'task');
        showToast('Task created and staff notified!', 'success');
    }

    // Reset form
    document.getElementById('create-shift-form').classList.add('hidden');
    document.getElementById('shift-staff').value = '';
    document.getElementById('shift-site').value  = '';
    document.getElementById('shift-time').value  = '';
    document.getElementById('shift-notes').value = '';
    document.getElementById('task-staff').value = '';
    document.getElementById('task-site').value = '';
    document.getElementById('task-time').value = '';
    document.getElementById('task-notes').value = '';
    document.getElementById('shift-recurring').checked = false;
    document.getElementById('recurring-options').style.display = 'none';

    renderShiftManagement();
};

window.cancelShiftItem = function (shiftId) {
    if (confirm('Cancel this shift? This cannot be undone.')) window.db.cancelShift(shiftId);
};

window.openEditShiftDrawer = function (shiftId) {
    const data  = window.db.getDashboardData();
    const s     = data.shifts.find(sh => sh.id === shiftId);
    if (!s) return;
    const staff = s.staff || {};
    const site  = s.site  || {};
    const tVal  = new Date(new Date(s.targetTime).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const conflict = window.db.hasShiftConflict(s.staffId, s.targetTime, shiftId);

    const staffOpts = data.staffList.map(m => `<option value="${escapeHTML(m.id)}" ${m.id === s.staffId ? 'selected' : ''}>${escapeHTML(m.name)} (${escapeHTML(m.type)})</option>`).join('');
    const siteOpts  = data.sites.map(l => `<option value="${escapeHTML(l.id)}" ${l.id === s.siteId ? 'selected' : ''}>${escapeHTML(l.name)}</option>`).join('');

    openDrawer(`Edit Shift — ${staff.name || ''}`, `
        <div class="space-y-4">
            ${conflict ? `<div class="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-xs font-medium flex items-start gap-2">
                <span class="material-symbols-outlined text-[16px] shrink-0 mt-0.5">warning</span>
                Overlap: this staff already has a shift within 4h (${window.db.data.sites.find(l=>l.id===conflict.siteId)?.name || conflict.siteId} at ${new Date(conflict.targetTime).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}).
            </div>` : ''}
            <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Staff Member</label>
                <select id="edit-shift-staff" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none">${staffOpts}</select>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Facility / Site</label>
                <select id="edit-shift-site" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none">${siteOpts}</select>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Scheduled Time</label>
                <input type="datetime-local" id="edit-shift-time" value="${escapeHTML(tVal)}" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none"/>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Notes</label>
                <input type="text" id="edit-shift-notes" value="${escapeHTML(s.notes || '')}" placeholder="Optional notes…" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none"/>
            </div>
            <div id="edit-conflict-warn" class="hidden bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-xs font-medium"></div>
            <div class="flex gap-2 pt-2">
                <button onclick="saveEditShift('${escapeHTML(shiftId)}')" class="flex-1 px-4 py-2 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg text-sm shadow-sm transition-colors">Save Changes</button>
                <button onclick="closeDrawer()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-sm transition-colors">Cancel</button>
            </div>
            <div class="pt-1">
                <button onclick="if(confirm('Notify staff of this shift update?')){window.db.notifyStaff('${escapeHTML(s.staffId)}','Your shift at ${escapeHTML(site.name||'')} has been updated. Please check your schedule.');showToast('Notification sent','info')}" class="w-full flex items-center justify-center gap-2 py-2 bg-purple-50 border border-purple-200 text-purple-700 font-bold rounded-xl text-sm hover:bg-purple-100 transition-colors">
                    <span class="material-symbols-outlined text-[16px]">notifications_active</span> Notify Staff of Changes</button>
            </div>
        </div>`);
};

window.saveEditShift = function (shiftId) {
    const staffId = document.getElementById('edit-shift-staff').value;
    const siteId  = document.getElementById('edit-shift-site').value;
    const time    = document.getElementById('edit-shift-time').value;
    const notes   = document.getElementById('edit-shift-notes').value;
    if (!staffId || !siteId || !time) { showToast('Please fill all required fields.', 'error'); return; }
    const targetTime = new Date(time).toISOString();
    const conflict   = window.db.hasShiftConflict(staffId, targetTime, shiftId);
    const warnEl     = document.getElementById('edit-conflict-warn');
    if (conflict) {
        const cSite = window.db.data.sites.find(l => l.id === conflict.siteId);
        if (warnEl) { warnEl.textContent = `⚠ Overlap with existing shift at ${cSite ? cSite.name : conflict.siteId} (${new Date(conflict.targetTime).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}). Save anyway?`; warnEl.classList.remove('hidden'); }
        if (!confirm('This staff member already has a shift within 4 hours on the same day. Save anyway?')) return;
    }
    window.db.updateShift(shiftId, { staffId, siteId, targetTime, notes });
    closeDrawer();
    showToast('Shift updated successfully!', 'success');
};

// ─── Advanced Scheduler ───────────────────────────────────────────────────────

function getWeekDates(offset) {
    const now    = new Date();
    const day    = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
    const days = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        days.push(d);
    }
    return days;
}

function renderScheduler() {
    const days  = getWeekDates(schedulerWeekOffset);
    const label = document.getElementById('scheduler-week-label');
    if (label) {
        const opts = { month: 'short', day: 'numeric' };
        label.textContent = `${days[0].toLocaleDateString('en-US', opts)} – ${days[6].toLocaleDateString('en-US', opts)}, ${days[6].getFullYear()}`;
    }

    const data = window.db.getDashboardData();

    // Populate filter dropdowns
    const siteFilter  = document.getElementById('scheduler-filter-site');
    const staffFilter = document.getElementById('scheduler-filter-staff');
    if (siteFilter && siteFilter.options.length <= 1) {
        data.sites.forEach(s => { const o = new Option(s.name, s.id); siteFilter.appendChild(o); });
    }
    if (staffFilter && staffFilter.options.length <= 1) {
        data.staffList.forEach(s => { const o = new Option(s.name, s.id); staffFilter.appendChild(o); });
    }

    const grid = document.getElementById('scheduler-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    days.forEach((date, i) => {
        const isToday  = date.toDateString() === new Date().toDateString();
        const dateStr  = date.toISOString().slice(0, 10);
        let dayShifts  = data.shifts.filter(s => new Date(s.targetTime).toDateString() === date.toDateString());

        // Apply filters
        if (schedulerFilterSite  !== 'all') dayShifts = dayShifts.filter(s => s.siteId  === schedulerFilterSite);
        if (schedulerFilterStaff !== 'all') dayShifts = dayShifts.filter(s => s.staffId === schedulerFilterStaff);

        const cell = document.createElement('div');
        cell.className = `bg-white p-2 border-b border-r border-slate-200 flex flex-col gap-1.5 min-h-[120px] transition-colors`;
        cell.setAttribute('data-date', dateStr);

        // Drag-over handlers
        cell.addEventListener('dragover',  schedulerDragOver);
        cell.addEventListener('dragleave', e => { e.currentTarget.classList.remove('bg-blue-50'); });
        cell.addEventListener('drop',      e => schedulerDrop(e, dateStr));

        const dateLabel  = `${DAY_NAMES[i]} ${date.getDate()}`;
        const headerCls  = isToday ? 'font-black text-primary text-[11px]' : 'font-bold text-slate-400 text-[11px]';
        cell.innerHTML   = `<div class="${headerCls} uppercase tracking-wider mb-0.5">${dateLabel}</div>`;

        dayShifts.forEach(s => {
            const color = s.status === 'late'   ? 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100' :
                          s.status === 'active' ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100' :
                          s.status === 'completed' ? 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100' :
                          'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100';
            const timeStr = new Date(s.targetTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const chip = document.createElement('button');
            chip.className = `w-full border rounded-lg p-1.5 flex flex-col gap-0.5 text-[10px] text-left cursor-pointer transition-colors ${color}`;
            chip.innerHTML = `
                <span class="font-bold truncate">${escapeHTML(s.staff ? s.staff.name.split(' ')[0] : '?')}</span>
                <span class="opacity-70 truncate">${escapeHTML(s.site ? s.site.name : '')}</span>
                <span class="font-semibold">${timeStr}</span>`;
            chip.addEventListener('click', e => { e.stopPropagation(); openSchedulerShiftDetail(s.id); });
            cell.appendChild(chip);
        });

        grid.appendChild(cell);
    });

    renderSchedulerPool(data.staffList, days);
}

function renderSchedulerPool(staffList, weekDays) {
    const pool = document.getElementById('scheduler-staff-pool');
    if (!pool) return;
    const data     = window.db.getDashboardData();
    const query    = (document.getElementById('scheduler-search') || {}).value || '';
    const filtered = staffList.filter(s => !query || s.name.toLowerCase().includes(query.toLowerCase()));
    const maxHours = 40;

    // Build a set of staffIds already assigned during the current week
    const days    = weekDays || getWeekDates(schedulerWeekOffset);
    const dayStrs = days.map(d => d.toDateString());
    const assignedThisWeek = {};
    data.shifts.forEach(sh => {
        if (dayStrs.includes(new Date(sh.targetTime).toDateString())) {
            assignedThisWeek[sh.staffId] = (assignedThisWeek[sh.staffId] || 0) + 1;
        }
    });

    pool.innerHTML = filtered.map(s => {
        const activeNow     = data.shifts.find(sh => sh.staffId === s.id && sh.status === 'active');
        const weekCount     = assignedThisWeek[s.id] || 0;
        const statusDot     = activeNow
            ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1"></span>'
            : '<span class="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block mr-1"></span>';
        const pct           = Math.min(100, Math.round((s.hours / maxHours) * 100));
        const weekBadge     = weekCount > 0 ? `<span class="text-[9px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-full">${weekCount} shift${weekCount > 1 ? 's' : ''} this wk</span>` : '';

        return `<div draggable="true"
                ondragstart="schedulerDragStart(event, '${escapeHTML(s.id)}')"
                class="bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm flex flex-col gap-1 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-blue-300 transition-all select-none">
            <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px] shrink-0">${escapeHTML(s.avatar)}</div>
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-xs text-slate-900 truncate">${escapeHTML(s.name)}</div>
                    <div class="text-[10px] text-slate-500 flex items-center gap-1">${statusDot}${escapeHTML(s.type)}</div>
                </div>
            </div>
            ${weekBadge ? `<div>${weekBadge}</div>` : ''}
            <div class="flex items-center gap-1.5">
                <div class="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div class="h-full ${pct >= 100 ? 'bg-red-400' : 'bg-emerald-400'} rounded-full" style="width:${pct}%"></div>
                </div>
                <span class="text-[10px] font-bold text-slate-500">${s.hours}h</span>
            </div>
        </div>`;
    }).join('') || '<p class="text-xs text-slate-400 italic p-2">No staff found</p>';
}

window.navigateSchedulerWeek = function (dir) {
    schedulerWeekOffset += dir;
    renderScheduler();
};

window.filterSchedulerPool = function (query) {
    const data = window.db.getDashboardData();
    renderSchedulerPool(data.staffList);
};

window.setSchedulerFilter = function (type, value) {
    if (type === 'site')  schedulerFilterSite  = value;
    if (type === 'staff') schedulerFilterStaff = value;
    renderScheduler();
};

// ─── Drag-and-Drop ─────────────────────────────────────────────────────────────

window.schedulerDragStart = function (e, staffId) {
    schedulerDragStaffId = staffId;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', staffId);
};

function schedulerDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    e.currentTarget.classList.add('bg-blue-50');
}

function schedulerDrop(e, dateStr) {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-blue-50');
    const staffId = schedulerDragStaffId || e.dataTransfer.getData('text/plain');
    if (!staffId) return;
    schedulerDragDateStr = dateStr;
    openSchedulerDropConfirm(staffId, dateStr);
}

window.openSchedulerDropConfirm = function (staffId, dateStr) {
    const data  = window.db.getDashboardData();
    const staff = data.staffList.find(s => s.id === staffId);
    if (!staff) return;
    const modal    = document.getElementById('scheduler-drop-modal');
    const subtitle = document.getElementById('drop-modal-subtitle');
    const siteEl   = document.getElementById('drop-modal-site');
    const warnEl   = document.getElementById('drop-conflict-warning');
    if (!modal) return;

    const displayDate = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' });
    if (subtitle) subtitle.textContent = `Scheduling ${staff.name} on ${displayDate}`;
    if (siteEl) {
        siteEl.innerHTML = data.sites.map(s => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.name)}</option>`).join('');
    }

    // Check for existing conflict at 08:00
    const testTime = dateStr + 'T08:00:00';
    const conflict = window.db.hasShiftConflict(staffId, testTime);
    if (warnEl) {
        if (conflict) {
            const cSite = data.sites.find(l => l.id === conflict.siteId);
            warnEl.textContent = `⚠ ${staff.name} already has a shift at ${cSite ? cSite.name : ''} around this time. You can still proceed.`;
            warnEl.classList.remove('hidden');
        } else {
            warnEl.classList.add('hidden');
        }
    }

    modal.setAttribute('data-staff-id', staffId);
    modal.setAttribute('data-date-str', dateStr);
    modal.classList.remove('hidden');
};

window.closeDropModal = function () {
    const modal = document.getElementById('scheduler-drop-modal');
    if (modal) modal.classList.add('hidden');
    schedulerDragStaffId = null;
    schedulerDragDateStr = null;
};

window.confirmSchedulerDrop = function () {
    const modal   = document.getElementById('scheduler-drop-modal');
    if (!modal) return;
    const staffId = modal.getAttribute('data-staff-id');
    const dateStr = modal.getAttribute('data-date-str');
    const siteId  = document.getElementById('drop-modal-site').value;
    const timeVal = document.getElementById('drop-modal-time').value || '08:00';
    const notes   = document.getElementById('drop-modal-notes').value;
    if (!staffId || !siteId || !dateStr) return;

    const [h, m]   = timeVal.split(':').map(Number);
    const target   = new Date(dateStr + 'T12:00:00');
    target.setHours(h, m, 0, 0);
    const targetTime = target.toISOString();

    // Final conflict check at chosen time
    const conflict = window.db.hasShiftConflict(staffId, targetTime);
    if (conflict) {
        const cSite = window.db.data.sites.find(l => l.id === conflict.siteId);
        if (!confirm(`${window.db.data.staff.find(s=>s.id===staffId)?.name} already has a shift at ${cSite?.name || ''} near this time. Add anyway?`)) return;
    }

    const shift = window.db.createShift(staffId, siteId, targetTime, notes || 'Drag-scheduled');
    const staff = window.db.data.staff.find(s => s.id === staffId);
    const site  = window.db.data.sites.find(s => s.id === siteId);
    window.db.notifyStaff(staffId, `New shift scheduled: ${site ? site.name : ''} on ${target.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})} at ${target.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}.`);
    showToast(`Shift created for ${staff ? staff.name : ''} — notification sent!`, 'success');

    closeDropModal();
    renderScheduler();
};

// ─── Scheduler: Shift Detail Click ─────────────────────────────────────────────

window.openSchedulerShiftDetail = function (shiftId) {
    const data = window.db.getDashboardData();
    const s    = data.shifts.find(sh => sh.id === shiftId);
    if (!s) return;
    const staff   = s.staff || {};
    const site    = s.site  || {};
    const timeStr = new Date(s.targetTime).toLocaleString([], { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });

    openDrawer(`Shift — ${staff.name || ''}`, `
        <div class="space-y-4">
            <div class="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div class="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-lg">${escapeHTML(staff.avatar || '?')}</div>
                <div>
                    <h3 class="font-black text-slate-900">${escapeHTML(staff.name || '')}</h3>
                    <p class="text-xs text-slate-500 capitalize">${escapeHTML(staff.type || '')}</p>
                </div>
            </div>
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-sm">
                <p class="font-bold text-slate-800">${escapeHTML(site.name || '')}</p>
                <p class="text-xs text-slate-500">${escapeHTML(site.address || '')}</p>
                <p class="text-xs text-slate-500">🕐 ${timeStr}</p>
                ${s.notes ? `<p class="text-xs text-slate-500">📝 ${escapeHTML(s.notes)}</p>` : ''}
            </div>
            <div>${statusBadge(s.status)}</div>
            <div class="flex gap-2">
                <button onclick="closeDrawer(); openEditShiftDrawer('${escapeHTML(shiftId)}')" class="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 font-bold rounded-xl text-sm hover:bg-blue-100 transition-colors">
                    <span class="material-symbols-outlined text-[16px]">edit</span> Edit Shift</button>
                ${staff.phone ? `<a href="tel:${escapeHTML(staff.phone)}" class="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold rounded-xl text-sm hover:bg-emerald-100 transition-colors">
                    <span class="material-symbols-outlined text-[16px]">call</span> Call</a>` : ''}
            </div>
        </div>`);
};

// ─── Auto-Assign (with settings drawer) ────────────────────────────────────────

window.autoAssignSchedule = function () {
    const data  = window.db.getDashboardData();
    const sites = data.sites;
    const staff = data.staffList;

    const siteOpts  = sites.map(s  => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.name)}</option>`).join('');
    const staffOpts = staff.map(s  => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.name)} (${escapeHTML(s.type)})</option>`).join('');

    openDrawer('Auto-Assign Settings', `
        <div class="space-y-4">
            <p class="text-sm text-slate-600">Configure how shifts are auto-generated for the current week.</p>
            <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Days to Schedule</label>
                <div class="flex gap-2 flex-wrap">
                    ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d,i) => `<label class="flex items-center gap-1 text-xs font-medium text-slate-700 cursor-pointer"><input type="checkbox" id="aa-day-${i}" ${i < 5 ? 'checked' : ''} class="rounded"/> ${d}</label>`).join('')}
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Start Time</label>
                <input type="time" id="aa-time" value="08:00" class="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none"/>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Assign from Staff</label>
                <select id="aa-staff-filter" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none">
                    <option value="all">All Staff (round-robin)</option>
                    <option value="cleaner">Cleaners only</option>
                    <option value="maintenance">Maintenance only</option>
                </select>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Assign to Sites</label>
                <select id="aa-site-filter" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none">
                    <option value="all">All Sites (round-robin)</option>
                    ${siteOpts}
                </select>
            </div>
            <div>
                <label class="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" id="aa-notify" checked class="rounded"/> Notify staff automatically after assignment
                </label>
            </div>
            <button onclick="runAutoAssign()" class="w-full py-2.5 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl text-sm shadow-sm transition-colors">Run Auto-Assign</button>
        </div>`);
};

window.runAutoAssign = function () {
    const data       = window.db.getDashboardData();
    const days       = getWeekDates(schedulerWeekOffset);
    const timeVal    = (document.getElementById('aa-time') || {}).value || '08:00';
    const staffType  = (document.getElementById('aa-staff-filter') || {}).value || 'all';
    const siteFilter = (document.getElementById('aa-site-filter') || {}).value || 'all';
    const doNotify   = document.getElementById('aa-notify')?.checked !== false;

    const [h, m]    = timeVal.split(':').map(Number);
    let useStaff    = staffType === 'all' ? data.staffList : data.staffList.filter(s => s.type === staffType);
    let useSites    = siteFilter === 'all' ? data.sites : data.sites.filter(s => s.id === siteFilter);
    if (!useStaff.length || !useSites.length) { showToast('No staff or sites match your filters.', 'error'); return; }

    const selectedDays = days.filter((_, i) => document.getElementById('aa-day-' + i)?.checked);
    if (!selectedDays.length) { showToast('Please select at least one day.', 'error'); return; }

    let created = 0;
    selectedDays.forEach((date, i) => {
        const st  = useStaff[i % useStaff.length];
        const si  = useSites[i % useSites.length];
        const conflict = window.db.hasShiftConflict(st.id, date.toISOString().slice(0,10) + `T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);
        if (conflict) return; // skip conflicts silently
        const t = new Date(date); t.setHours(h, m, 0, 0);
        window.db.createShift(st.id, si.id, t.toISOString(), 'Auto-assigned');
        if (doNotify) window.db.notifyStaff(st.id, `Auto-assigned shift at ${si.name} on ${t.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}.`);
        created++;
    });

    closeDrawer();
    showToast(`${created} shift${created !== 1 ? 's' : ''} created${doNotify ? ' & staff notified' : ''}.`, 'success');
    renderScheduler();
};

// ─── Publish Schedule ──────────────────────────────────────────────────────────

window.publishSchedule = function () {
    const data      = window.db.getDashboardData();
    const days      = getWeekDates(schedulerWeekOffset);
    const dayStrs   = days.map(d => d.toDateString());
    const weekShifts = data.shifts.filter(s => dayStrs.includes(new Date(s.targetTime).toDateString()) && (s.status === 'upcoming' || s.status === 'active'));

    if (!weekShifts.length) { showToast('No upcoming shifts this week to publish.', 'warning'); return; }

    const rows = weekShifts.map(s => {
        const staff = s.staff || {};
        const site  = s.site  || {};
        const t     = new Date(s.targetTime).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
        return `<div class="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-xs">
            <div>
                <span class="font-bold text-slate-800">${escapeHTML(staff.name || '')}</span>
                <span class="text-slate-400"> → ${escapeHTML(site.name || '')}</span>
                <div class="text-slate-400">${t}</div>
            </div>
            <label class="flex items-center gap-1 cursor-pointer text-slate-600">
                <input type="checkbox" checked class="publish-notify-check rounded" data-shift-id="${escapeHTML(s.id)}" data-staff-id="${escapeHTML(s.staffId)}"/> Notify
            </label>
        </div>`;
    }).join('');

    openDrawer('Publish & Notify', `
        <div class="space-y-4">
            <p class="text-sm text-slate-600">${weekShifts.length} shift${weekShifts.length !== 1 ? 's' : ''} will be published for this week. Check which staff to notify.</p>
            <div class="bg-white border border-slate-200 rounded-xl overflow-hidden px-4">${rows}</div>
            <button onclick="confirmPublish()" class="w-full py-2.5 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl text-sm shadow-sm transition-colors flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-[16px]">publish</span> Confirm & Send Notifications</button>
        </div>`);
};

window.confirmPublish = function () {
    let notified = 0;
    document.querySelectorAll('.publish-notify-check:checked').forEach(cb => {
        const staffId = cb.getAttribute('data-staff-id');
        const shift   = window.db.data.shifts.find(s => s.id === cb.getAttribute('data-shift-id'));
        const site    = shift ? window.db.data.sites.find(s => s.id === shift.siteId) : null;
        const target  = shift ? new Date(shift.targetTime).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}) : '';
        if (staffId) { window.db.notifyStaff(staffId, `Schedule published: your shift at ${site ? site.name : ''} on ${target} is confirmed.`); notified++; }
    });
    window.db.addFeedEvent('success', `Schedule published for week of ${new Date().toLocaleDateString()}. ${notified} staff notified.`);
    closeDrawer();
    showToast(`Schedule published! ${notified} notification${notified !== 1 ? 's' : ''} sent.`, 'success');
};

// ─── Staff Directory ──────────────────────────────────────────────────────────

function renderDirectoryStats(staffList, shifts) {
    const total     = staffList.length;
    const clockedIn = shifts.filter(s => s.status === 'active').length;
    const cleaners  = staffList.filter(s => s.type === 'cleaner').length;
    const openShifts = shifts.filter(s => s.status === 'upcoming').length;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('stat-total-staff', total);
    set('stat-clocked-in',  clockedIn);
    set('stat-cleaners',    cleaners);
    set('stat-open-shifts', openShifts);
}

function renderStaffDirectory(staffList, shifts) {
    const tbody = document.getElementById('directory-list');
    if (!tbody) return;
    const maxHours = Math.max(1, ...staffList.map(s => s.hours));
    const query    = (document.getElementById('global-search') || {}).value || '';
    let filtered   = currentDirFilter === 'all' ? staffList : staffList.filter(s => s.type === currentDirFilter);
    if (query) filtered = filtered.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-8 text-center text-sm text-slate-400 italic">No staff found.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(s => {
        const activeShift = shifts.find(sh => sh.staffId === s.id && sh.status === 'active');
        const statusHTML  = activeShift
            ? `<span class="flex items-center gap-1 text-emerald-600 font-semibold text-xs"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>On Site</span>`
            : `<span class="text-slate-400 text-xs">Off Shift</span>`;
        const pct = Math.round((s.hours / maxHours) * 100);
        return `<tr class="hover:bg-slate-50 transition-colors group">
            <td class="px-5 py-3">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">${escapeHTML(s.avatar)}</div>
                    <div>
                        <div class="font-bold text-slate-900">${escapeHTML(s.name)}</div>
                        <div class="text-[10px] text-slate-400">${escapeHTML(s.id)}</div>
                    </div>
                </div>
            </td>
            <td class="px-5 py-3">
                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">${escapeHTML(s.type)}</span>
                <div class="mt-0.5">${statusHTML}</div>
            </td>
            <td class="px-5 py-3 text-xs text-slate-500">
                <div>${escapeHTML(s.phone || '—')}</div>
                <div class="text-slate-400">${escapeHTML(s.email || '—')}</div>
            </td>
            <td class="px-5 py-3">
                <div class="flex items-center gap-2">
                    <div class="flex-1 h-2 bg-slate-100 rounded-full max-w-[80px] overflow-hidden">
                        <div class="h-full bg-emerald-500 rounded-full" style="width:${pct}%"></div>
                    </div>
                    <span class="text-sm font-black text-slate-900">${s.hours}h</span>
                </div>
            </td>
            <td class="px-5 py-3 text-right">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="viewStaffProfile('${escapeHTML(s.id)}')" class="px-3 py-1 text-xs font-bold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">View</button>
                    <button onclick="deleteStaffItem('${escapeHTML(s.id)}')" class="px-3 py-1 text-xs font-bold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">Remove</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

window.filterDirectory = function (filter) {
    currentDirFilter = filter;
    document.querySelectorAll('.dir-filter').forEach(b => {
        b.className = b.id === 'dir-' + filter
            ? 'dir-filter px-3 py-1.5 bg-slate-900 text-white rounded-full text-xs font-bold'
            : 'dir-filter px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-full text-xs font-bold';
    });
    const data = window.db.getDashboardData();
    renderStaffDirectory(data.staffList, data.shifts);
};

window.createNewStaff = function () {
    const name  = document.getElementById('new-staff-name').value.trim();
    const type  = document.getElementById('new-staff-type').value;
    const phone = document.getElementById('new-staff-phone').value.trim();
    const email = document.getElementById('new-staff-email').value.trim();
    if (!name) { alert('Staff must have a name.'); return; }
    window.db.addStaff(name, type, phone, email);
    ['new-staff-name','new-staff-phone','new-staff-email'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('add-staff-form').classList.add('hidden');
};

window.deleteStaffItem = function (staffId) {
    if (confirm('Remove this employee? Their shifts will also be removed.')) window.db.deleteStaff(staffId);
};

window.viewStaffProfile = function (staffId) {
    const data  = window.db.getDashboardData();
    const staff = data.staffList.find(s => s.id === staffId);
    if (!staff) return;
    const staffShifts = data.shifts.filter(s => s.staffId === staffId);
    const activeShift = staffShifts.find(s => s.status === 'active');

    const shiftsHTML = staffShifts.length
        ? staffShifts.slice(0, 6).map(s => `
            <div class="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-sm">
                <div>
                    <span class="font-medium text-slate-800">${escapeHTML(s.site ? s.site.name : s.siteId)}</span>
                    <div class="text-xs text-slate-400">${new Date(s.targetTime).toLocaleDateString([], {weekday:'short',month:'short',day:'numeric'})}</div>
                </div>
                ${statusBadge(s.status)}
            </div>`).join('')
        : '<p class="text-sm text-slate-400 italic py-2">No shifts assigned.</p>';

    openDrawer(`${staff.name}`, `
        <div class="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-xl">
            <div class="w-14 h-14 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xl">${escapeHTML(staff.avatar)}</div>
            <div>
                <h3 class="font-black text-slate-900 text-lg">${escapeHTML(staff.name)}</h3>
                <p class="text-sm text-slate-500 capitalize">${escapeHTML(staff.type)}</p>
                ${activeShift ? '<span class="text-xs font-bold text-emerald-600 flex items-center gap-1 mt-1"><span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>Currently on site</span>' : ''}
            </div>
        </div>
        <div class="grid grid-cols-2 gap-3 mb-6 text-sm">
            <div class="bg-slate-50 rounded-lg p-3"><p class="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Phone</p><p class="font-semibold mt-0.5">${escapeHTML(staff.phone || 'Not set')}</p></div>
            <div class="bg-slate-50 rounded-lg p-3"><p class="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Email</p><p class="font-semibold mt-0.5 truncate">${escapeHTML(staff.email || 'Not set')}</p></div>
            <div class="bg-slate-50 rounded-lg p-3"><p class="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Hours</p><p class="font-semibold mt-0.5">${staff.hours}h this week</p></div>
            <div class="bg-slate-50 rounded-lg p-3"><p class="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Staff ID</p><p class="font-semibold mt-0.5">${escapeHTML(staff.id)}</p></div>
        </div>
        <h4 class="font-bold text-slate-800 mb-2 text-sm">Shift History</h4>
        ${shiftsHTML}`);
};

// ─── Locations ────────────────────────────────────────────────────────────────

function renderLocations(sites, shifts) {
    const tbody = document.getElementById('locations-list');
    if (!tbody) return;
    tbody.innerHTML = sites.map(site => {
        const siteShifts = shifts.filter(s => s.siteId === site.id);
        const hasLate    = siteShifts.some(s => s.status === 'late');
        const hasActive  = siteShifts.some(s => s.status === 'active');
        const status     = hasLate ? 'Critical' : hasActive ? 'Active' : 'Standby';
        const statusCls  = hasLate
            ? 'bg-red-100 text-red-700 border-red-200'
            : hasActive
            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
            : 'bg-slate-100 text-slate-600 border-slate-200';
        const todayCount = siteShifts.filter(s => s.status === 'active' || s.status === 'upcoming').length;
        return `<tr class="hover:bg-slate-50 transition-colors group">
            <td class="px-5 py-3 font-semibold text-slate-900">${escapeHTML(site.name)}</td>
            <td class="px-5 py-3 text-xs text-slate-500">${escapeHTML(site.address || 'Pending')}</td>
            <td class="px-5 py-3"><span class="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${statusCls}">${status}</span></td>
            <td class="px-5 py-3 text-sm text-slate-600">${todayCount} staff</td>
            <td class="px-5 py-3 text-right">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="openTaskManager('${escapeHTML(site.id)}')" class="px-3 py-1 text-xs font-bold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">Tasks</button>
                    <button onclick="deleteSiteItem('${escapeHTML(site.id)}')" class="px-3 py-1 text-xs font-bold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">Remove</button>
                </div>
            </td>
        </tr>`;
    }).join('') || `<tr><td colspan="5" class="px-5 py-8 text-center text-sm text-slate-400 italic">No facilities registered.</td></tr>`;
}

window.createNewSite = function () {
    const name = document.getElementById('new-site-name').value.trim();
    const addr = document.getElementById('new-site-address').value.trim();
    if (!name) { alert('Facility must have a name.'); return; }
    window.db.addSite(name, addr);
    document.getElementById('new-site-name').value    = '';
    document.getElementById('new-site-address').value = '';
    document.getElementById('add-site-form').classList.add('hidden');
};

window.deleteSiteItem = function (siteId) {
    if (confirm('Remove this facility and all its shifts and inventory?')) window.db.deleteSite(siteId);
};

window.openTaskManager = function (siteId) {
    const site  = window.db.data.sites.find(s => s.id === siteId);
    if (!site) return;

    const buildTaskManager = () => {
        const tasks = window.db.getSiteTasks(siteId);
        return `
        <div class="space-y-6">
            ${['cleanerTasks', 'maintenanceTasks'].map(key => {
                const label = key === 'cleanerTasks' ? 'Cleaner Tasks' : 'Maintenance Tasks';
                const icon  = key === 'cleanerTasks' ? 'cleaning_services' : 'handyman';
                return `
                <div>
                    <div class="flex items-center gap-2 mb-3">
                        <span class="material-symbols-outlined text-primary text-[18px]">${icon}</span>
                        <h4 class="font-bold text-slate-800 text-sm">${label}</h4>
                    </div>
                    <div class="space-y-2 mb-3" id="tasks-${key}">
                        ${tasks[key].map((task, i) => `
                        <div class="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 text-sm">
                            <span class="material-symbols-outlined text-slate-400 text-[14px]">drag_indicator</span>
                            <span class="flex-1 text-slate-700">${escapeHTML(task)}</span>
                            <button onclick="removeSiteTaskUI('${escapeHTML(siteId)}','${key}',${i})" class="text-red-400 hover:text-red-600 transition-colors">
                                <span class="material-symbols-outlined text-[16px]">close</span>
                            </button>
                        </div>`).join('')}
                    </div>
                    <div class="flex gap-2">
                        <input type="text" id="new-task-${key}" placeholder="Add new task…" class="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none"/>
                        <button onclick="addSiteTaskUI('${escapeHTML(siteId)}','${key}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors">Add</button>
                    </div>
                </div>`;
            }).join('<hr class="border-slate-200"/>')}
        </div>`;
    };

    openDrawer(`Task Config — ${site.name}`, buildTaskManager());
};

window.addSiteTaskUI = function (siteId, taskType) {
    const input = document.getElementById('new-task-' + taskType);
    if (!input || !input.value.trim()) { alert('Task name cannot be empty.'); return; }
    window.db.addSiteTask(siteId, taskType, input.value);
    input.value = '';
    // Refresh drawer
    const site = window.db.data.sites.find(s => s.id === siteId);
    if (site) window.openTaskManager(siteId);
};

window.removeSiteTaskUI = function (siteId, taskType, index) {
    window.db.removeSiteTask(siteId, taskType, index);
    window.openTaskManager(siteId);
};

// ─── Inventory ────────────────────────────────────────────────────────────────

function renderInventory() {
    const data  = window.db.getDashboardData();
    const sites = data.sites;

    // Populate site filter tabs
    const tabs = document.getElementById('inventory-site-tabs');
    if (tabs && tabs.children.length === 0) {
        const allBtn = document.createElement('button');
        allBtn.id        = 'inv-tab-all';
        allBtn.className = 'inv-tab-btn px-4 py-1.5 bg-slate-900 text-white rounded-full text-xs font-bold';
        allBtn.textContent = 'All Sites';
        allBtn.onclick   = () => setInvFilter('all');
        tabs.appendChild(allBtn);

        sites.forEach(s => {
            const btn    = document.createElement('button');
            btn.id       = 'inv-tab-' + s.id;
            btn.className = 'inv-tab-btn px-4 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-full text-xs font-bold';
            btn.textContent = s.name;
            btn.onclick   = () => setInvFilter(s.id);
            tabs.appendChild(btn);
        });

        // Populate add-form site dropdown
        const invSite = document.getElementById('inv-site');
        if (invSite) {
            invSite.innerHTML = sites.map(s => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.name)}</option>`).join('');
        }
    }

    renderInventoryTable();
}

function renderInventoryTable() {
    const items = window.db.getInventory(currentInvSiteFilter === 'all' ? null : currentInvSiteFilter);
    const sites = window.db.data.sites;
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) return;

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-5 py-8 text-center text-sm text-slate-400 italic">No inventory items found.</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(item => {
        const site      = sites.find(s => s.id === item.siteId);
        const isCritical = item.qty === 0;
        const isLow      = !isCritical && item.qty < item.minQty;
        const statusCls  = isCritical ? 'bg-red-100 text-red-700 border-red-200' : isLow ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200';
        const statusTxt  = isCritical ? 'Critical' : isLow ? 'Low Stock' : 'OK';
        return `<tr class="hover:bg-slate-50 transition-colors group">
            <td class="px-5 py-3 font-semibold text-slate-900">${escapeHTML(item.item)}</td>
            <td class="px-5 py-3 text-xs text-slate-500">${escapeHTML(site ? site.name : item.siteId)}</td>
            <td class="px-5 py-3">
                <div class="flex items-center gap-2">
                    <input type="number" value="${item.qty}" min="0" onchange="updateInvQty('${escapeHTML(item.id)}', this.value)"
                        class="w-16 px-2 py-1 border border-slate-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-400 outline-none"/>
                    <span class="text-xs text-slate-400">${escapeHTML(item.unit)}</span>
                </div>
            </td>
            <td class="px-5 py-3 text-sm text-slate-600">${item.minQty} ${escapeHTML(item.unit)}</td>
            <td class="px-5 py-3"><span class="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${statusCls}">${statusTxt}</span></td>
            <td class="px-5 py-3 text-right">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="requestRestock('${escapeHTML(item.id)}')" class="px-3 py-1 text-xs font-bold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">Restock</button>
                    <button onclick="removeInvItem('${escapeHTML(item.id)}')" class="px-3 py-1 text-xs font-bold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">Remove</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function setInvFilter(siteId) {
    currentInvSiteFilter = siteId;
    document.querySelectorAll('.inv-tab-btn').forEach(b => {
        b.className = b.id === 'inv-tab-' + siteId
            ? 'inv-tab-btn px-4 py-1.5 bg-slate-900 text-white rounded-full text-xs font-bold'
            : 'inv-tab-btn px-4 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-full text-xs font-bold';
    });
    renderInventoryTable();
}

window.toggleAddInventoryForm = function () {
    document.getElementById('add-inventory-form').classList.toggle('hidden');
};

window.submitAddInventory = function () {
    const siteId = document.getElementById('inv-site').value;
    const item   = document.getElementById('inv-item').value.trim();
    const qty    = document.getElementById('inv-qty').value;
    const minQty = document.getElementById('inv-minqty').value;
    const unit   = document.getElementById('inv-unit').value.trim();
    if (!item || !qty || !minQty || !unit) { alert('Please fill in all fields.'); return; }
    window.db.addInventoryItem(siteId, item, qty, minQty, unit);
    ['inv-item','inv-qty','inv-minqty','inv-unit'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('add-inventory-form').classList.add('hidden');
    renderInventoryTable();
};

window.updateInvQty = function (invId, qty) {
    window.db.updateInventoryQty(invId, qty);
    renderInventoryTable();
};

window.removeInvItem = function (invId) {
    if (confirm('Remove this inventory item?')) { window.db.removeInventoryItem(invId); renderInventoryTable(); }
};

window.requestRestock = function (invId) {
    const item = window.db.data.inventory.find(i => i.id === invId);
    if (!item) return;
    const site = window.db.data.sites.find(s => s.id === item.siteId);
    window.db.addFeedEvent('info', `Restock requested: "${item.item}" at ${site ? site.name : 'unknown site'}.`);
    alert(`Restock requested for "${item.item}". Feed event logged.`);
};

// ─── Exceptions ───────────────────────────────────────────────────────────────

function renderExceptions() {
    const data       = window.db.getDashboardData();
    const allShifts  = data.shifts;
    const lateShifts = allShifts.filter(s => s.status === 'late');

    // Summary cards
    const summary = document.getElementById('exception-summary');
    if (summary) {
        const lateRate = allShifts.length ? Math.round((lateShifts.length / allShifts.length) * 100) : 0;
        summary.innerHTML = [
            { label: 'Late Shifts',     value: lateShifts.length,  color: 'text-red-600' },
            { label: 'Exception Rate',  value: `${lateRate}%`,     color: lateRate > 20 ? 'text-red-600' : 'text-amber-600' },
            { label: 'Active Shifts',   value: allShifts.filter(s => s.status === 'active').length, color: 'text-emerald-600' },
            { label: 'Completed Today', value: allShifts.filter(s => s.status === 'completed').length, color: 'text-slate-900' }
        ].map(k => `
            <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">${k.label}</p>
                <p class="text-3xl font-extrabold ${k.color} mt-1">${k.value}</p>
            </div>`).join('');
    }

    const label = document.getElementById('exception-total-label');
    if (label) label.textContent = lateShifts.length + ' exceptions found';

    const tbody = document.getElementById('exceptions-table-body');
    if (!tbody) return;

    if (lateShifts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-5 py-8 text-center text-sm text-emerald-600 font-semibold">No late exceptions — all shifts on time!</td></tr>`;
        return;
    }

    tbody.innerHTML = lateShifts.map(s => {
        const scheduledTime = new Date(s.targetTime);
        const delayMin      = Math.max(0, Math.floor((Date.now() - scheduledTime) / 60000));
        const delayColor    = delayMin > 30 ? 'text-red-600 font-black' : 'text-amber-600 font-bold';
        return `<tr class="hover:bg-slate-50 transition-colors">
            <td class="px-5 py-3">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs">${escapeHTML(s.staff ? s.staff.avatar : '?')}</div>
                    <span class="font-semibold text-slate-900">${escapeHTML(s.staff ? s.staff.name : s.staffId)}</span>
                </div>
            </td>
            <td class="px-5 py-3 text-slate-600 text-sm">${escapeHTML(s.site ? s.site.name : s.siteId)}</td>
            <td class="px-5 py-3 text-xs text-slate-500">${scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
            <td class="px-5 py-3 text-sm ${delayColor}">${delayMin}m late</td>
            <td class="px-5 py-3">${statusBadge(s.status)}</td>
            <td class="px-5 py-3 text-xs text-slate-500 max-w-[160px] truncate">${escapeHTML(s.notes || '—')}</td>
        </tr>`;
    }).join('');
}

// ─── Reports & Billing ────────────────────────────────────────────────────────

function renderInvoices(sites) {
    const tbody = document.getElementById('invoices-list');
    if (!tbody) return;
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const month  = months[new Date().getMonth()];
    const year   = new Date().getFullYear();

    tbody.innerHTML = sites.map((site, i) => {
        const amount  = window.db.computeInvoiceAmount(site.id);
        const statuses = [
            { label: 'PAID',    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
            { label: 'PENDING', cls: 'bg-amber-100   text-amber-700   border-amber-200' },
            { label: 'OVERDUE', cls: 'bg-red-100     text-red-700     border-red-200' }
        ];
        const s = statuses[i % 3];
        return `<tr class="hover:bg-slate-50 transition-colors">
            <td class="px-5 py-3">
                <div class="font-semibold text-slate-900">${escapeHTML(site.name)}</div>
                <div class="text-[10px] text-slate-400">${escapeHTML(site.id)}</div>
            </td>
            <td class="px-5 py-3 text-sm text-slate-600">Monthly Flat Rate</td>
            <td class="px-5 py-3 text-sm text-slate-600">${month} ${year}</td>
            <td class="px-5 py-3 text-right font-black text-slate-900">$${amount.toLocaleString()}.00</td>
            <td class="px-5 py-3 text-center"><span class="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${s.cls}">${s.label}</span></td>
        </tr>`;
    }).join('');
}

function renderOperationsFeed(feed) {
    const el = document.getElementById('operations-feed-list');
    if (!el) return;
    el.innerHTML = feed.slice(0, 20).map(feedItemHTML).join('')
        || `<p class="text-xs text-slate-400 text-center py-6 italic">No activity yet.</p>`;
}

// ─── AI Message Center ────────────────────────────────────────────────────────

function renderAIMessageCenter() {
    const thread  = document.getElementById('ai-chat-thread');
    if (!thread) return;
    const history = window.db.getChatHistory();

    const welcomeMsg = `
        <div class="flex justify-start">
            <div class="max-w-[70%] bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <p class="text-[10px] font-bold text-primary mb-1 uppercase tracking-wide">GCS Knowledge AI</p>
                <p class="text-sm text-slate-700 leading-relaxed">Hello! I'm your GCS operations assistant. Ask me anything — cleaning protocols, site procedures, scheduling questions, or supply management tips.</p>
            </div>
        </div>`;

    if (history.length === 0) {
        thread.innerHTML = welcomeMsg;
        return;
    }

    thread.innerHTML = welcomeMsg + history.map(msg => {
        if (msg.role === 'user') {
            return `<div class="flex justify-end">
                <div class="max-w-[70%] bg-primary text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
                    <p class="text-[10px] font-bold opacity-70 mb-1 uppercase tracking-wide">You</p>
                    <p class="text-sm leading-relaxed">${escapeHTML(msg.text)}</p>
                </div>
            </div>`;
        } else {
            return `<div class="flex justify-start">
                <div class="max-w-[70%] bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                    <p class="text-[10px] font-bold text-primary mb-1 uppercase tracking-wide">GCS Knowledge AI</p>
                    <p class="text-sm text-slate-700 leading-relaxed">${msg.text}</p>
                </div>
            </div>`;
        }
    }).join('');
    thread.scrollTop = thread.scrollHeight;
}

window.sendPromptToAI = async function () {
    const input   = document.getElementById('ai-chat-input');
    const thread  = document.getElementById('ai-chat-thread');
    const key     = localStorage.getItem('gcs_gemini_key');
    const message = input ? input.value.trim() : '';
    if (!message) return;

    if (!key) {
        alert('Please set your Gemini API Key in Alerts & Configs first.');
        navigateView('alerts', document.querySelector('[onclick*=alerts]'));
        return;
    }

    input.value = '';
    window.db.saveChatMessage('user', message);

    // Append user bubble
    thread.innerHTML += `
        <div class="flex justify-end">
            <div class="max-w-[70%] bg-primary text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
                <p class="text-[10px] font-bold opacity-70 mb-1 uppercase tracking-wide">You</p>
                <p class="text-sm leading-relaxed">${escapeHTML(message)}</p>
            </div>
        </div>`;

    const loadingId = 'ai-loading-' + Date.now();
    thread.innerHTML += `
        <div id="${loadingId}" class="flex justify-start">
            <div class="max-w-[70%] bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <p class="text-[10px] font-bold text-primary mb-1 uppercase tracking-wide">GCS Knowledge AI</p>
                <p class="text-sm text-slate-400 italic animate-pulse">Thinking…</p>
            </div>
        </div>`;
    thread.scrollTop = thread.scrollHeight;

    // Inject current context into system prompt
    const stats = window.db.getOverviewStats();
    const systemContext = `You are the GCS Command Center Knowledge AI. You help cleaning managers and field staff with operational issues. Current context: ${stats.active} active shifts, ${stats.late} late shifts, ${stats.total} total shifts today. Keep answers concise (2-3 sentences max). Use plain text only.`;

    try {
        const res  = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemContext }] },
                contents: [{ parts: [{ text: message }] }]
            })
        });
        const data = await res.json();
        let reply  = 'Sorry, I could not process that request.';
        if (data.candidates && data.candidates[0]) {
            reply = data.candidates[0].content.parts[0].text
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');
        }
        if (data.error) reply = `API Error: ${escapeHTML(data.error.message)}`;

        window.db.saveChatMessage('assistant', reply);
        const loading = document.getElementById(loadingId);
        if (loading) loading.innerHTML = `
            <div class="max-w-[70%] bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <p class="text-[10px] font-bold text-primary mb-1 uppercase tracking-wide">GCS Knowledge AI</p>
                <p class="text-sm text-slate-700 leading-relaxed">${reply}</p>
            </div>`;
    } catch (err) {
        const loading = document.getElementById(loadingId);
        if (loading) loading.innerHTML = `
            <div class="max-w-[70%] bg-white border border-red-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <p class="text-[10px] font-bold text-red-600 mb-1 uppercase tracking-wide">Connection Error</p>
                <p class="text-sm text-slate-600">Network error. Check your API key and internet connection.</p>
            </div>`;
    }
    thread.scrollTop = thread.scrollHeight;
};

window.clearChatHistoryUI = function () {
    if (confirm('Clear all chat history?')) {
        window.db.clearChatHistory();
        renderAIMessageCenter();
    }
};

// ─── Alerts & Configs ─────────────────────────────────────────────────────────

window.saveApiKey = function () {
    const key = document.getElementById('gemini-api-key').value.trim();
    if (!key) { alert('Please enter a valid API key.'); return; }
    localStorage.setItem('gcs_gemini_key', key);
    const status = document.getElementById('api-key-status');
    if (status) { status.textContent = 'Key saved successfully.'; setTimeout(() => { status.textContent = ''; }, 3000); }
};

// ─── Global Search ────────────────────────────────────────────────────────────

window.handleSearch = function (query) {
    const data = window.db.getDashboardData();
    // Re-render whichever view is currently active
    const active = document.querySelector('.app-view.active');
    if (!active) return;
    if (active.id === 'view-staffdir')    renderStaffDirectory(data.staffList, data.shifts);
    if (active.id === 'view-locationsmgt') renderLocations(data.sites, data.shifts);
    if (active.id === 'view-shiftmgt')    renderShiftManagement();
};
