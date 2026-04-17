// GCS Login Logic

document.addEventListener('DOMContentLoaded', () => {
    // If already logged in, redirect them immediately
    const session = window.db ? window.db.getSession() : null;
    if (session) {
        redirectBasedOnRole(session.role);
    }

    const form = document.getElementById('login-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const user = document.getElementById('username').value.trim().toLowerCase();
        const pass = document.getElementById('password').value;
        const err = document.getElementById('login-error');
        
        // Use Mock Authentication
        const result = window.db.authenticateUser(user, pass);
        
        if (result.success) {
            err.style.display = 'none';
            redirectBasedOnRole(result.user.role);
        } else {
            err.style.display = 'block';
        }
    });
});

function redirectBasedOnRole(role) {
    if (role === 'manager') {
        window.location.href = 'index.html';
    } else if (role === 'staff') {
        window.location.href = 'mobile.html';
    }
}
