// GCS Command Center — Mobile Field Staff App

let CURRENT_USER_ID = null;
let CURRENT_SHIFT_ID = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
    if (!window.db) return;
    const session = window.db.getSession();
    if (!session || session.role !== 'staff') { window.location.href = 'login.html'; return; }
    CURRENT_USER_ID = session.staffId;
    renderMobileApp();
    window.addEventListener('db-update', renderMobileApp);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

window.logout = function () {
    if (window.db) window.db.clearSession();
    window.location.href = 'login.html';
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHTML(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
}

/**
 * Calculate distance between two geographic coordinates using Haversine formula
 * @param {number} lat1 - User latitude
 * @param {number} lon1 - User longitude
 * @param {number} lat2 - Facility latitude
 * @param {number} lon2 - Facility longitude
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Check if user is within the geofence for a facility
 * @param {number} userLat - User latitude
 * @param {number} userLon - User longitude
 * @param {Object} facility - Facility object with lat, lng, geofenceEnabled, geofenceRadius
 * @returns {Object} { isWithin: boolean, distance: number }
 */
function isWithinGeofence(userLat, userLon, facility) {
    if (!facility || !facility.lat || !facility.lng) {
        return { isWithin: true, distance: 0 }; // No coordinates = no geofence check
    }

    if (!facility.geofenceEnabled) {
        return { isWithin: true, distance: 0 }; // Geofence disabled
    }

    const distance = calculateDistance(userLat, userLon, facility.lat, facility.lng);
    const radius = facility.geofenceRadius || 50;
    return { isWithin: distance <= radius, distance: Math.round(distance) };
}

/**
 * Request user location and validate geofence before clock-in
 * @param {string} staffId - Staff ID
 * @param {Object} shift - Shift object with site and other info
 */
window.requestLocationAndClockIn = function (staffId, shift) {
    const hint = document.getElementById('clock-in-hint');
    if (!shift || !shift.site) {
        if (hint) hint.textContent = 'Error: Shift information missing';
        return;
    }

    // Check if geolocation is available
    if (!navigator.geolocation) {
        if (hint) hint.textContent = 'Geolocation not available on this device';
        return;
    }

    // Request location with high accuracy
    if (hint) hint.textContent = 'Getting your location...';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const userLat = position.coords.latitude;
            const userLon = position.coords.longitude;
            const accuracy = Math.round(position.coords.accuracy);

            // Check if user is within geofence
            const facility = shift.site;
            const geofenceCheck = isWithinGeofence(userLat, userLon, facility);

            if (geofenceCheck.isWithin) {
                // User is within geofence, proceed with clock-in
                if (hint) {
                    hint.innerHTML = `📍 At ${escapeHTML(facility.name)} • ${accuracy}m accuracy`;
                }
                window.db.clockIn(staffId, shift.id);
            } else {
                // User is outside geofence
                const distanceAway = geofenceCheck.distance;
                const radiusRequired = facility.geofenceRadius || 50;
                const metersOutside = distanceAway - radiusRequired;

                if (hint) {
                    hint.innerHTML = `⚠️ Outside zone by ${metersOutside}m (need to be within ${radiusRequired}m)`;
                    hint.classList.add('text-red-500', 'font-semibold');
                    setTimeout(() => {
                        hint.classList.remove('text-red-500', 'font-semibold');
                        hint.textContent = 'Hold for 1.5 seconds to confirm';
                    }, 3000);
                }
            }
        },
        (error) => {
            // Geolocation error
            let errorMsg = 'Location error';
            if (error.code === 1) {
                errorMsg = 'Location permission denied';
            } else if (error.code === 2) {
                errorMsg = 'Location unavailable';
            } else if (error.code === 3) {
                errorMsg = 'Location request timeout';
            }

            if (hint) {
                hint.textContent = errorMsg;
                hint.classList.add('text-red-500', 'font-semibold');
                setTimeout(() => {
                    hint.classList.remove('text-red-500', 'font-semibold');
                    hint.textContent = 'Hold for 1.5 seconds to confirm';
                }, 3000);
            }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
};

// ─── Master Render ────────────────────────────────────────────────────────────

function renderMobileApp() {
    if (!CURRENT_USER_ID) return;
    const data    = window.db.getMobileStaffData(CURRENT_USER_ID);
    const avatar  = document.getElementById('user-avatar');
    const dot     = document.getElementById('status-dot');
    const statusTxt = document.getElementById('status-text');
    const content = document.getElementById('main-content');

    if (avatar && data.staff) avatar.textContent = data.staff.avatar;

    if (data.activeShift) {
        if (dot)       { dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-300'; }
        if (statusTxt) { statusTxt.textContent = 'Shift Active — Checked In'; }
        CURRENT_SHIFT_ID = data.activeShift.id;
        renderActiveShift(content, data.activeShift);
    } else if (data.nextShift) {
        if (dot)       { dot.className = 'w-2.5 h-2.5 rounded-full bg-white/50'; }
        if (statusTxt) { statusTxt.textContent = data.nextShift.status === 'late' ? 'Late — Clock In Now' : 'Off Shift'; }
        renderClockIn(content, data.nextShift);
    } else if (data.lastCompleted) {
        if (dot)       { dot.className = 'w-2.5 h-2.5 rounded-full bg-white/50'; }
        if (statusTxt) { statusTxt.textContent = 'Off Shift'; }
        renderShiftComplete(content, data.lastCompleted);
    } else {
        if (dot)       { dot.className = 'w-2.5 h-2.5 rounded-full bg-white/50'; }
        if (statusTxt) { statusTxt.textContent = 'Off Shift'; }
        renderNoShifts(content);
    }
}

// ─── View: Clock In ───────────────────────────────────────────────────────────

function renderClockIn(container, shift) {
    const isLate     = shift.status === 'late';
    const timeStr    = new Date(shift.targetTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr    = new Date(shift.targetTime).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    const lateMin    = isLate ? Math.floor((Date.now() - new Date(shift.targetTime)) / 60000) : 0;

    container.innerHTML = `
        <!-- Shift Info Card -->
        <div class="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6">
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Next Shift</p>
            <h2 class="font-black text-slate-900 text-lg leading-tight">${escapeHTML(shift.site ? shift.site.name : '')}</h2>
            <p class="text-slate-500 text-xs mt-0.5">${escapeHTML(shift.site ? shift.site.address : '')}</p>
            <div class="flex items-center gap-4 mt-3 pt-3 border-t border-slate-200">
                <div>
                    <p class="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Time</p>
                    <p class="font-bold text-slate-800 text-sm">${timeStr}</p>
                </div>
                <div>
                    <p class="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Date</p>
                    <p class="font-bold text-slate-800 text-sm">${dateStr}</p>
                </div>
                ${isLate ? `<div class="ml-auto">
                    <span class="bg-red-100 text-red-700 border border-red-200 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">${lateMin}m Late</span>
                </div>` : ''}
            </div>
        </div>

        <!-- Hold-to-Clock-In -->
        <div class="flex flex-col items-center gap-3 mb-6">
            <button id="clock-in-btn"
                class="fab-clock-in w-44 h-44 rounded-full bg-primary text-white font-black text-lg flex flex-col items-center justify-center gap-1 shadow-xl shadow-primary/30 select-none touch-none">
                <span class="material-symbols-outlined text-[36px]" style="font-variation-settings:'FILL' 1">fingerprint</span>
                <span>CLOCK IN</span>
            </button>
            <p id="clock-in-hint" class="text-xs text-slate-400 font-medium">Hold for 1.5 seconds to confirm</p>
        </div>

        <!-- Staff Info -->
        <div class="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
            <p class="text-xs text-slate-500">Shift type: <span class="font-bold text-slate-800 capitalize">${escapeHTML(shift.staff ? shift.staff.type : '')}</span></p>
            <p class="text-xs text-slate-500 mt-1">${(shift.tasks || []).length} tasks assigned for this shift</p>
        </div>
    `;

    const btn  = document.getElementById('clock-in-btn');
    const hint = document.getElementById('clock-in-hint');
    let holdTimer;
    let holding = false;

    const startHold = (e) => {
        e.preventDefault();
        holding = true;
        btn.classList.add('holding');
        if (hint) hint.textContent = 'Keep holding…';
        holdTimer = setTimeout(() => {
            if (holding) {
                btn.disabled = true;
                btn.innerHTML = `<span class="material-symbols-outlined text-[36px]" style="font-variation-settings:'FILL' 1">check_circle</span><span>CLOCKED IN</span>`;
                // Use geolocation-enabled clock-in that validates geofence
                window.requestLocationAndClockIn(CURRENT_USER_ID, shift);
            }
        }, 1500);
    };

    const endHold = (e) => {
        e.preventDefault();
        holding = false;
        clearTimeout(holdTimer);
        if (!btn.disabled) {
            btn.classList.remove('holding');
            if (hint) hint.textContent = 'Hold for 1.5 seconds to confirm';
        }
    };

    btn.addEventListener('mousedown',  startHold);
    btn.addEventListener('mouseup',    endHold);
    btn.addEventListener('mouseleave', endHold);
    btn.addEventListener('touchstart', startHold, { passive: false });
    btn.addEventListener('touchend',   endHold,   { passive: false });
    btn.addEventListener('touchcancel',endHold,   { passive: false });
}

// ─── View: Active Shift ───────────────────────────────────────────────────────

function renderActiveShift(container, shift) {
    const clockInTime = shift.clockInTime
        ? new Date(shift.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '—';
    const tasks          = shift.tasks || [];
    const savedCompleted = shift.completedTasks || [];
    const totalTasks     = tasks.length;

    const tasksHTML = tasks.length === 0
        ? `<p class="text-sm text-slate-400 italic py-4 text-center">No tasks configured for this site.</p>`
        : tasks.map((task, i) => {
            const done = savedCompleted.includes(task);
            return `
            <label class="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0 cursor-pointer group">
                <div class="w-5 h-5 rounded border-2 ${done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 group-hover:border-primary'} flex items-center justify-center transition-colors shrink-0">
                    ${done ? '<span class="material-symbols-outlined text-white text-[14px]" style="font-variation-settings:\'FILL\' 1">check</span>' : ''}
                </div>
                <input type="checkbox" class="hidden" id="task-${i}" ${done ? 'checked' : ''} onchange="toggleTask(${i}, this.checked, '${escapeHTML(shift.id)}')"/>
                <span class="text-sm font-medium ${done ? 'text-slate-400 line-through' : 'text-slate-800'} flex-1 leading-snug">${escapeHTML(task)}</span>
            </label>`;
        }).join('');

    // Compute completion
    const completedCount = savedCompleted.filter(t => tasks.includes(t)).length;
    const pct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
    const ringColor = pct === 100 ? '#10b981' : pct >= 50 ? '#3b82f6' : '#f59e0b';

    // SVG progress ring
    const r = 22, circ = 2 * Math.PI * r;
    const dash = Math.round((pct / 100) * circ);
    const ringHTML = `
        <svg width="60" height="60" viewBox="0 0 60 60">
            <circle cx="30" cy="30" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="5"/>
            <circle cx="30" cy="30" r="${r}" fill="none" stroke="${ringColor}" stroke-width="5"
                stroke-dasharray="${dash} ${circ}"
                stroke-dashoffset="${circ / 4}"
                stroke-linecap="round"
                transform="rotate(-90 30 30)"
                style="transition:stroke-dasharray 0.4s ease"/>
            <text x="30" y="35" text-anchor="middle" font-size="12" font-weight="900" fill="${ringColor}" font-family="Public Sans,sans-serif">${pct}%</text>
        </svg>`;

    container.innerHTML = `
        <!-- Site Header -->
        <div class="w-full flex items-start justify-between mb-5">
            <div>
                <h2 class="font-black text-slate-900 text-xl leading-tight">${escapeHTML(shift.site ? shift.site.name : '')}</h2>
                <p class="text-emerald-600 font-semibold text-sm mt-0.5 flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                    Clocked in at ${clockInTime}
                </p>
            </div>
            <div title="${pct}% complete">${ringHTML}</div>
        </div>

        <!-- Task Checklist -->
        <div class="w-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm mb-5">
            <div class="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h3 class="font-bold text-slate-800 text-sm">Required Tasks</h3>
                <span class="text-xs font-bold text-slate-500">${completedCount}/${totalTasks} done</span>
            </div>
            <div class="px-4">${tasksHTML}</div>
        </div>

        <!-- Clock Out -->
        <button onclick="handleClockOut('${escapeHTML(shift.id)}')"
            class="w-full py-4 bg-white border-2 border-red-400 text-red-600 font-black text-base rounded-2xl hover:bg-red-50 active:scale-95 transition-all mt-auto shadow-sm">
            <span class="material-symbols-outlined align-middle mr-1 text-[20px]">logout</span>
            CLOCK OUT
        </button>
    `;
}

// ─── Task Toggle ──────────────────────────────────────────────────────────────

window.toggleTask = function (taskIndex, checked, shiftId) {
    const data  = window.db.getMobileStaffData(CURRENT_USER_ID);
    const shift = data.activeShift;
    if (!shift) return;

    const tasks         = shift.tasks || [];
    const taskName      = tasks[taskIndex];
    let completed       = [...(shift.completedTasks || [])];

    if (checked && !completed.includes(taskName)) {
        completed.push(taskName);
    } else if (!checked) {
        completed = completed.filter(t => t !== taskName);
    }

    window.db.saveTaskProgress(shiftId, completed);
};

// ─── Clock Out ────────────────────────────────────────────────────────────────

window.handleClockOut = function (shiftId) {
    const data  = window.db.getMobileStaffData(CURRENT_USER_ID);
    const shift = data.activeShift;
    const tasks = shift ? (shift.tasks || []) : [];
    const done  = shift ? (shift.completedTasks || []) : [];
    const incomplete = tasks.filter(t => !done.includes(t));

    if (incomplete.length > 0) {
        const go = confirm(`You have ${incomplete.length} incomplete task(s):\n• ${incomplete.join('\n• ')}\n\nClock out anyway?`);
        if (!go) return;
    }

    window.db.clockOut(CURRENT_USER_ID, shiftId);
};

// ─── View: Shift Completed ────────────────────────────────────────────────────

function renderShiftComplete(container, lastShift) {
    const tasks    = lastShift.tasks || [];
    const done     = lastShift.completedTasks || [];
    const donePct  = tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 100;

    container.innerHTML = `
        <div class="flex flex-col items-center text-center pt-4">
            <div class="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4 shadow-sm">
                <span class="material-symbols-outlined text-emerald-600 text-[42px]" style="font-variation-settings:'FILL' 1">check_circle</span>
            </div>
            <h2 class="font-black text-slate-900 text-2xl mb-1">Shift Complete!</h2>
            <p class="text-slate-500 text-sm mb-6">Great work today. No more shifts scheduled.</p>
        </div>

        <div class="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4">
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Last Shift Summary</p>
            <h3 class="font-black text-slate-900 text-base">${escapeHTML(lastShift.site ? lastShift.site.name : '')}</h3>
            <div class="flex items-center gap-4 mt-3 pt-3 border-t border-slate-200">
                <div>
                    <p class="text-[10px] text-slate-400 uppercase font-bold">Tasks Completed</p>
                    <p class="font-black text-slate-900">${done.length} / ${tasks.length}</p>
                </div>
                <div>
                    <p class="text-[10px] text-slate-400 uppercase font-bold">Completion</p>
                    <p class="font-black ${donePct === 100 ? 'text-emerald-600' : 'text-amber-600'}">${donePct}%</p>
                </div>
            </div>
        </div>

        <a href="index.html" class="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white font-bold rounded-2xl text-sm hover:bg-primary-dark transition-colors shadow-sm">
            <span class="material-symbols-outlined text-[18px]">open_in_new</span> Open Manager Dashboard
        </a>
    `;
}

// ─── View: No Shifts ──────────────────────────────────────────────────────────

function renderNoShifts(container) {
    container.innerHTML = `
        <div class="flex flex-col items-center text-center pt-10">
            <div class="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <span class="material-symbols-outlined text-slate-400 text-[42px]">event_available</span>
            </div>
            <h2 class="font-black text-slate-900 text-xl mb-2">No Shifts Today</h2>
            <p class="text-slate-500 text-sm max-w-[240px]">You're all caught up. Check back later for your next assignment.</p>
        </div>
    `;
}
