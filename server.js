const express    = require('express');
const bodyParser = require('body-parser');
const path       = require('path');
const session    = require('express-session');
const db         = require('./db');
const upload     = require('./multer');

const app = express();

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/upload', express.static(path.join(__dirname, 'upload')));
app.use(session({
    secret: 'sms_secret_2024',
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 4 * 60 * 60 * 1000 }
}));

// ── GUARDS ────────────────────────────────────────────────────────────────────
function requireStudent(req, res, next) {
    if (req.session && req.session.role === 'student') return next();
    res.redirect('/login?error=Please+log+in+as+a+student');
}
function requireTeacher(req, res, next) {
    if (req.session && req.session.role === 'teacher') return next();
    res.redirect('/login?error=Teacher+login+required');
}

// ── PUBLIC PAGES ──────────────────────────────────────────────────────────────
app.get('/',         (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login',    (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/logout',   (req, res) => { req.session.destroy(); res.redirect('/login?success=Logged+out'); });

// ── LOGIN POST ────────────────────────────────────────────────────────────────
app.post('/login', (req, res) => {
    const { role, reg_no, t_id, password } = req.body;

    if (role === 'student') {
        if (!reg_no || !password)
            return res.redirect('/login?error=Enter+Register+Number+and+Password');
        db.query('SELECT * FROM students WHERE reg_no = ? AND password = ?', [reg_no, password], (err, rows) => {
            if (err)   return res.redirect('/login?error=' + encodeURIComponent(err.message));
            if (!rows || rows.length === 0)
                return res.redirect('/login?error=Wrong+Register+Number+or+Password');
            req.session.role        = 'student';
            req.session.studentId   = rows[0].id;
            req.session.studentName = rows[0].name;
            req.session.save(() => res.redirect('/student/dashboard'));
        });

    } else if (role === 'teacher') {
        if (!t_id || !password)
            return res.redirect('/login?error=Enter+Employee+ID+and+Password');
        db.query('SELECT * FROM teachers WHERE employee_id = ? AND password = ?', [t_id, password], (err, rows) => {
            if (err)   return res.redirect('/login?error=' + encodeURIComponent(err.message));
            if (!rows || rows.length === 0)
                return res.redirect('/login?error=Wrong+Employee+ID+or+Password');
            req.session.role        = 'teacher';
            req.session.teacherName = rows[0].name;
            req.session.save(() => res.redirect('/teacher/dashboard'));
        });

    } else {
        res.redirect('/login?error=Please+select+a+role');
    }
});

// ── REGISTER POST ─────────────────────────────────────────────────────────────
app.post('/submit', upload.single('photo'), (req, res) => {
    const { name, email, city, reg_no, dob, age, department, address, password } = req.body;
    const photo = req.file ? req.file.filename : '';
    const sql = `INSERT INTO students (name,email,city,reg_no,dob,age,department,address,password,photos,status,created_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?,'active',NOW())`;
    db.query(sql, [name, email, city, reg_no, dob, age, department, address, password, photo], (err) => {
        if (err) return res.send(`<h3 style="font-family:Arial;color:red;padding:40px">Error: ${err.message}<br><a href="/register">Go Back</a></h3>`);
        res.redirect('/login?success=Registered+successfully!+Please+log+in');
    });
});

// ════════════════════════════════════════════════════════════════════════════════
// ── STUDENT DASHBOARD ── shows ONLY their own profile
// ════════════════════════════════════════════════════════════════════════════════
app.get('/student/dashboard', requireStudent, (req, res) => {
    db.query('SELECT * FROM students WHERE id = ?', [req.session.studentId], (err, rows) => {
        if (err || !rows || rows.length === 0)
            return res.redirect('/login?error=Profile+not+found');
        const s = rows[0];
        const photo = s.photos ? '/upload/' + s.photos.split(',')[0].trim() : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23dce8ff'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%23a8c0f0'/%3E%3Cellipse cx='50' cy='92' rx='32' ry='28' fill='%23a8c0f0'/%3E%3C/svg%3E";
        let dob = '-';
        if (s.dob) { const d = new Date(s.dob); if (!isNaN(d)) dob = d.toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'}); }

        res.send(`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>My Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:'Inter',sans-serif;}
body{background:#eef2ff;min-height:100vh;}

/* NAV */
nav{background:#1a3a8f;padding:14px 40px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 12px rgba(0,0,0,0.15);}
.nav-brand{display:flex;align-items:center;gap:10px;color:white;font-size:18px;font-weight:800;}
.nav-logo{width:36px;height:36px;background:white;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;}
.nav-right{display:flex;align-items:center;gap:12px;}
.nav-right span{color:rgba(255,255,255,0.8);font-size:13px;background:rgba(255,255,255,0.12);padding:6px 14px;border-radius:20px;}
.nav-right a{color:white;text-decoration:none;font-size:13px;font-weight:600;background:rgba(255,255,255,0.18);padding:7px 18px;border-radius:20px;border:1px solid rgba(255,255,255,0.25);transition:0.2s;}
.nav-right a:hover{background:rgba(255,255,255,0.3);}

/* PAGE */
.page{padding:36px 24px 60px;display:flex;justify-content:center;}
.layout{display:flex;gap:24px;width:100%;max-width:960px;align-items:flex-start;flex-wrap:wrap;}

/* LEFT CARD */
.left-card{background:white;border-radius:20px;padding:32px 24px;text-align:center;width:260px;flex-shrink:0;box-shadow:0 4px 24px rgba(26,58,143,0.10);}
.photo-ring{width:130px;height:130px;border-radius:50%;border:4px solid #1a3a8f;padding:3px;margin:0 auto 16px;display:block;overflow:hidden;}
.photo-ring img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;}
.left-card h2{font-size:20px;font-weight:800;color:#1a3a8f;margin-bottom:4px;}
.left-card .dept{color:#888;font-size:13px;margin-bottom:14px;}
.status-badge{display:inline-block;padding:5px 18px;border-radius:20px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;}
.active{background:#e0f0ff;color:#1a3a8f;}
.inactive{background:#ffebee;color:#b91c1c;}
.left-card .reg{margin-top:16px;font-size:12px;color:#aaa;font-weight:500;}
.left-card .reg span{color:#1a3a8f;font-weight:700;font-size:14px;}

/* RIGHT CARD */
.right-card{background:white;border-radius:20px;flex:1;min-width:300px;box-shadow:0 4px 24px rgba(26,58,143,0.10);overflow:hidden;}
.right-card .card-header{background:linear-gradient(135deg,#1a3a8f,#2a5adf);padding:20px 28px;}
.right-card .card-header h3{color:white;font-size:16px;font-weight:700;}
.right-card .card-header p{color:rgba(255,255,255,0.7);font-size:12px;margin-top:2px;}
.info-section{padding:8px 28px 4px;}
.section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1a3a8f;margin:20px 0 10px;padding-bottom:8px;border-bottom:2px solid #eef2ff;}
.info-row{display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid #f5f7ff;}
.info-row:last-child{border-bottom:none;}
.info-label{font-size:13px;color:#888;font-weight:500;}
.info-value{font-size:13px;color:#1a1a2e;font-weight:600;text-align:right;max-width:60%;word-break:break-word;}
.card-footer{padding:20px 28px 28px;}
.btn-logout{display:block;width:100%;text-align:center;padding:13px;background:#fff0f0;color:#b91c1c;border:2px solid #fecaca;border-radius:12px;font-weight:700;font-size:14px;text-decoration:none;transition:0.2s;}
.btn-logout:hover{background:#b91c1c;color:white;border-color:#b91c1c;}

@media(max-width:640px){.left-card{width:100%;}.layout{flex-direction:column;}}
</style></head><body>

<nav>
  <div class="nav-brand"><div class="nav-logo">🎓</div>Student Portal</div>
  <div class="nav-right">
    <span>👋 ${s.name}</span>
  </div>
</nav>

<div class="page"><div class="layout">

  <!-- LEFT -->
  <div class="left-card">
    <div class="photo-ring"><img src="${photo}" alt="${s.name}"></div>
    <h2>${s.name}</h2>
    <p class="dept">${s.department || '—'} Student</p>
    <span class="status-badge ${s.status || 'active'}">${s.status || 'active'}</span>
    <div class="reg">Reg No<br><span>${s.reg_no}</span></div>
  </div>

  <!-- RIGHT -->
  <div class="right-card">
    <div class="card-header">
      <h3>Academic &amp; Personal Records</h3>
      <p>Your complete student profile</p>
    </div>
    <div class="info-section">
      <div class="section-title">Personal Information</div>
      <div class="info-row"><span class="info-label">Register Number</span><span class="info-value">${s.reg_no}</span></div>
      <div class="info-row"><span class="info-label">Full Name</span><span class="info-value">${s.name}</span></div>
      <div class="info-row"><span class="info-label">Email Address</span><span class="info-value">${s.email || '—'}</span></div>
      <div class="info-row"><span class="info-label">Date of Birth</span><span class="info-value">${dob}</span></div>
      <div class="info-row"><span class="info-label">Age</span><span class="info-value">${s.age ? s.age + ' Years Old' : '—'}</span></div>
      <div class="info-row"><span class="info-label">City</span><span class="info-value">${s.city || '—'}</span></div>
      <div class="info-row"><span class="info-label">Residential Address</span><span class="info-value">${s.address || '—'}</span></div>

      <div class="section-title">Academic Details</div>
      <div class="info-row"><span class="info-label">Department / Branch</span><span class="info-value">${s.department || '—'}</span></div>
      <div class="info-row"><span class="info-label">Status</span><span class="info-value"><span class="status-badge ${s.status || 'active'}">${s.status || 'active'}</span></span></div>
    </div>
    <div class="card-footer">
      <a href="/logout" class="btn-logout">🚪 Logout</a>
    </div>
  </div>

</div></div>
</body></html>`);
    });
});

// ════════════════════════════════════════════════════════════════════════════════
// ── TEACHER DASHBOARD ── shows all students with search, edit, delete
// ════════════════════════════════════════════════════════════════════════════════
app.get('/teacher/dashboard', requireTeacher, (req, res) => {
    const q = req.query.q ? req.query.q.trim() : '';
    const sql = q
        ? `SELECT * FROM students WHERE name LIKE ? OR reg_no LIKE ? OR department LIKE ? OR city LIKE ? OR email LIKE ? ORDER BY id DESC`
        : `SELECT * FROM students ORDER BY id DESC`;
    const params = q ? Array(5).fill(`%${q}%`) : [];

    db.query(sql, params, (err, rows) => {
        if (err) return res.send('DB Error: ' + err.message);
        const teacherName = req.session.teacherName || 'Teacher';

        const cards = rows.length === 0
            ? `<div class="empty">No students found${q ? ` for "<b>${q}</b>"` : ''}.</div>`
            : rows.map(s => {
                const photo = s.photos ? '/upload/' + s.photos.split(',')[0].trim() : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23dce8ff'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%23a8c0f0'/%3E%3Cellipse cx='50' cy='92' rx='32' ry='28' fill='%23a8c0f0'/%3E%3C/svg%3E";
                const dot   = s.status === 'active' ? '#22c55e' : '#ef4444';
                return `
                <div class="card">
                  <div class="card-top"></div>
                  <div class="card-body">
                    <div class="avatar-wrap">
                      <img src="${photo}" alt="${s.name}">
                      <span class="dot" style="background:${dot}"></span>
                    </div>
                    <h3>${s.name}</h3>
                    <p class="dept">${s.department || '—'}</p>
                    <div class="meta">
                      <div class="meta-row"><span>Reg No</span><span>${s.reg_no}</span></div>
                      <div class="meta-row"><span>Email</span><span>${s.email || '—'}</span></div>
                      <div class="meta-row"><span>City</span><span>${s.city || '—'}</span></div>
                      <div class="meta-row"><span>Status</span><span class="badge ${s.status}">${s.status}</span></div>
                    </div>
                    <div class="btns">
                      <a href="/teacher/view/${s.id}" class="btn-view">👁 View</a>
                      <a href="/teacher/edit/${s.id}" class="btn-edit">✏️ Edit</a>
                      <a href="/teacher/delete/${s.id}" class="btn-del" onclick="return confirm('Delete ${s.name}?')">🗑</a>
                    </div>
                  </div>
                </div>`;
            }).join('');

        res.send(`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Teacher Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:'Inter',sans-serif;}
body{background:linear-gradient(135deg,#0a1f5c,#1a3a8f);min-height:100vh;}
nav{background:white;padding:14px 40px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;box-shadow:0 2px 12px rgba(0,0,0,0.08);}
.nav-brand{color:#1a3a8f;font-size:18px;font-weight:800;}
.nav-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.search-form{display:flex;background:#eef2ff;border-radius:24px;padding:6px 8px 6px 16px;border:2px solid #c7d7ff;gap:6px;align-items:center;}
.search-form input{border:none;background:transparent;outline:none;font-size:14px;width:200px;color:#333;}
.search-form button{background:#1a3a8f;color:white;border:none;border-radius:18px;padding:6px 16px;font-size:13px;font-weight:600;cursor:pointer;}
.nav-btns a{text-decoration:none;padding:8px 18px;border-radius:20px;font-size:13px;font-weight:700;margin-left:6px;}
.btn-add{background:#1a3a8f;color:white;}
.btn-logout{background:white;color:#1a3a8f;border:2px solid #1a3a8f;}
.info-bar{color:rgba(255,255,255,0.8);padding:14px 40px 0;font-size:13px;}
.info-bar a{color:white;}
.container{padding:24px 40px 60px;}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:22px;}
.empty{color:rgba(255,255,255,0.7);text-align:center;padding:80px;font-size:16px;grid-column:1/-1;}
.card{background:white;border-radius:18px;overflow:hidden;box-shadow:0 6px 20px rgba(0,0,0,0.12);transition:0.25s;}
.card:hover{transform:translateY(-6px);box-shadow:0 14px 36px rgba(0,0,0,0.18);}
.card-top{height:72px;background:linear-gradient(135deg,#1a3a8f,#2a5adf);}
.card-body{padding:0 18px 18px;text-align:center;}
.avatar-wrap{position:relative;display:inline-block;margin-top:-44px;}
.avatar-wrap img{width:88px;height:88px;border-radius:50%;border:4px solid white;object-fit:cover;display:block;}
.dot{position:absolute;bottom:4px;right:4px;width:14px;height:14px;border-radius:50%;border:2px solid white;}
.card-body h3{margin-top:10px;color:#1a1a2e;font-size:15px;font-weight:700;}
.dept{color:#888;font-size:12px;margin-top:2px;}
.meta{margin:12px 0;text-align:left;}
.meta-row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f0f5ff;font-size:12px;color:#555;}
.meta-row:last-child{border-bottom:none;}
.badge{padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;}
.active{background:#e0f0ff;color:#1a3a8f;}
.inactive{background:#ffebee;color:#b91c1c;}
.btns{display:flex;gap:6px;margin-top:12px;}
.btns a{flex:1;text-align:center;text-decoration:none;padding:8px;border-radius:8px;font-size:12px;font-weight:700;color:white;transition:0.2s;}
.btn-view{background:#1a3a8f;}
.btn-edit{background:#c27c0e;}
.btn-del{background:#b91c1c;flex:0;padding:8px 12px;}
.btns a:hover{opacity:0.85;}
@media(max-width:600px){nav{padding:14px 20px;}.container{padding:16px 16px 40px;}}
</style></head><body>

<nav>
  <div class="nav-brand">👨‍🏫 Teacher Dashboard</div>
  <div class="nav-right">
    <form class="search-form" method="GET" action="/teacher/dashboard">
      <input type="text" name="q" value="${q}" placeholder="Search name, reg no, dept…">
      <button type="submit">Search</button>
    </form>
    <div class="nav-btns">
      <a href="/" class="btn-add">🏠 Home</a>
      <a href="/register" class="btn-add">+ Add Student</a>
      <a href="/logout" class="btn-logout">Logout</a>
    </div>
  </div>
</nav>

${q ? `<div class="info-bar">Showing ${rows.length} result(s) for "<b>${q}</b>" · <a href="/teacher/dashboard">Clear</a></div>` : ''}

<div class="container"><div class="grid">${cards}</div></div>
</body></html>`);
    });
});

// ── TEACHER VIEW STUDENT ──────────────────────────────────────────────────────
app.get('/teacher/view/:id', requireTeacher, (req, res) => {
    db.query('SELECT * FROM students WHERE id = ?', [req.params.id], (err, rows) => {
        if (err || !rows || rows.length === 0) return res.send('Student not found');
        const s = rows[0];
        const photo = s.photos ? '/upload/' + s.photos.split(',')[0].trim() : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23dce8ff'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%23a8c0f0'/%3E%3Cellipse cx='50' cy='92' rx='32' ry='28' fill='%23a8c0f0'/%3E%3C/svg%3E";
        let dob = '-';
        if (s.dob) { const d = new Date(s.dob); if (!isNaN(d)) dob = d.toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'}); }

        res.send(`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${s.name} - Profile</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:'Inter',sans-serif;}
body{background:#eef2ff;min-height:100vh;}
nav{background:#1a3a8f;padding:14px 40px;display:flex;justify-content:space-between;align-items:center;}
.nav-brand{color:white;font-size:17px;font-weight:800;}
.nav-right a{color:white;text-decoration:none;font-size:13px;font-weight:600;background:rgba(255,255,255,0.18);padding:7px 18px;border-radius:20px;margin-left:8px;border:1px solid rgba(255,255,255,0.25);}
.page{padding:36px 24px 60px;display:flex;justify-content:center;}
.layout{display:flex;gap:24px;width:100%;max-width:900px;align-items:flex-start;flex-wrap:wrap;}
.left-card{background:white;border-radius:20px;padding:32px 24px;text-align:center;width:250px;flex-shrink:0;box-shadow:0 4px 24px rgba(26,58,143,0.10);}
.photo-ring{width:130px;height:130px;border-radius:50%;border:4px solid #1a3a8f;padding:3px;margin:0 auto 16px;overflow:hidden;}
.photo-ring img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;}
.left-card h2{font-size:19px;font-weight:800;color:#1a3a8f;margin-bottom:4px;}
.left-card .dept{color:#888;font-size:13px;margin-bottom:14px;}
.badge{display:inline-block;padding:5px 18px;border-radius:20px;font-size:12px;font-weight:700;text-transform:uppercase;}
.active{background:#e0f0ff;color:#1a3a8f;}
.inactive{background:#ffebee;color:#b91c1c;}
.left-card .reg{margin-top:16px;font-size:12px;color:#aaa;} .left-card .reg span{color:#1a3a8f;font-weight:700;font-size:14px;}
.action-btns{margin-top:20px;display:flex;flex-direction:column;gap:8px;}
.action-btns a{display:block;text-align:center;text-decoration:none;padding:10px;border-radius:10px;font-size:13px;font-weight:700;}
.btn-edit{background:#1a3a8f;color:white;}
.btn-back{background:#eef2ff;color:#1a3a8f;border:2px solid #c7d7ff;}
.btn-del{background:#ffebee;color:#b91c1c;border:2px solid #fecaca;}
.right-card{background:white;border-radius:20px;flex:1;min-width:300px;box-shadow:0 4px 24px rgba(26,58,143,0.10);overflow:hidden;}
.card-header{background:linear-gradient(135deg,#1a3a8f,#2a5adf);padding:20px 28px;}
.card-header h3{color:white;font-size:16px;font-weight:700;}
.card-header p{color:rgba(255,255,255,0.7);font-size:12px;margin-top:2px;}
.info-section{padding:8px 28px 20px;}
.sec-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1a3a8f;margin:18px 0 8px;padding-bottom:7px;border-bottom:2px solid #eef2ff;}
.info-row{display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid #f5f7ff;}
.info-row:last-child{border-bottom:none;}
.info-label{font-size:13px;color:#888;font-weight:500;}
.info-value{font-size:13px;color:#1a1a2e;font-weight:600;text-align:right;max-width:60%;word-break:break-word;}
@media(max-width:640px){.left-card{width:100%;}.layout{flex-direction:column;}}
</style></head><body>
<nav>
  <div class="nav-brand">👨‍🏫 Teacher Dashboard</div>
  <div class="nav-right">
    <a href="/teacher/dashboard">← Back</a>
    <a href="/logout">Logout</a>
  </div>
</nav>
<div class="page"><div class="layout">
  <div class="left-card">
    <div class="photo-ring"><img src="${photo}" alt="${s.name}"></div>
    <h2>${s.name}</h2>
    <p class="dept">${s.department || '—'} Student</p>
    <span class="badge ${s.status || 'active'}">${s.status || 'active'}</span>
    <div class="reg">Reg No<br><span>${s.reg_no}</span></div>
    <div class="action-btns">
      <a href="/teacher/edit/${s.id}" class="btn-edit">✏️ Edit Profile</a>
      <a href="/teacher/dashboard" class="btn-back">← Back to Dashboard</a>
      <a href="/teacher/delete/${s.id}" class="btn-del" onclick="return confirm('Delete ${s.name}?')">🗑 Delete Student</a>
    </div>
  </div>
  <div class="right-card">
    <div class="card-header"><h3>Academic &amp; Personal Records</h3><p>Full student profile</p></div>
    <div class="info-section">
      <div class="sec-title">Personal Information</div>
      <div class="info-row"><span class="info-label">Register Number</span><span class="info-value">${s.reg_no}</span></div>
      <div class="info-row"><span class="info-label">Full Name</span><span class="info-value">${s.name}</span></div>
      <div class="info-row"><span class="info-label">Email Address</span><span class="info-value">${s.email || '—'}</span></div>
      <div class="info-row"><span class="info-label">Date of Birth</span><span class="info-value">${dob}</span></div>
      <div class="info-row"><span class="info-label">Age</span><span class="info-value">${s.age ? s.age + ' Years Old' : '—'}</span></div>
      <div class="info-row"><span class="info-label">City</span><span class="info-value">${s.city || '—'}</span></div>
      <div class="info-row"><span class="info-label">Residential Address</span><span class="info-value">${s.address || '—'}</span></div>
      <div class="sec-title">Academic Details</div>
      <div class="info-row"><span class="info-label">Department / Branch</span><span class="info-value">${s.department || '—'}</span></div>
      <div class="info-row"><span class="info-label">Status</span><span class="info-value"><span class="badge ${s.status || 'active'}">${s.status || 'active'}</span></span></div>
    </div>
  </div>
</div></div>
</body></html>`);
    });
});

// ── TEACHER EDIT GET ──────────────────────────────────────────────────────────
app.get('/teacher/edit/:id', requireTeacher, (req, res) => {
    db.query('SELECT * FROM students WHERE id = ?', [req.params.id], (err, rows) => {
        if (err || !rows || rows.length === 0) return res.send('Student not found');
        const s = rows[0];
        const currentPhoto = s.photos ? '/upload/' + s.photos.split(',')[0].trim() : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23dce8ff'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%23a8c0f0'/%3E%3Cellipse cx='50' cy='92' rx='32' ry='28' fill='%23a8c0f0'/%3E%3C/svg%3E";
        let dobVal = '';
        if (s.dob) { const d = new Date(s.dob); if (!isNaN(d)) dobVal = d.toISOString().split('T')[0]; }

        res.send(`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Edit - ${s.name}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:'Inter',sans-serif;}
body{background:#eef2ff;min-height:100vh;}
nav{background:#1a3a8f;padding:14px 40px;display:flex;justify-content:space-between;align-items:center;}
.nav-brand{color:white;font-size:17px;font-weight:800;}
.nav-right a{color:white;text-decoration:none;font-size:13px;font-weight:600;background:rgba(255,255,255,0.18);padding:7px 18px;border-radius:20px;margin-left:8px;border:1px solid rgba(255,255,255,0.25);}
.page{padding:36px 24px 60px;display:flex;justify-content:center;}
.form-card{background:white;border-radius:20px;width:100%;max-width:560px;box-shadow:0 4px 24px rgba(26,58,143,0.10);overflow:hidden;}
.form-header{background:linear-gradient(135deg,#1a3a8f,#2a5adf);padding:22px 32px;}
.form-header h2{color:white;font-size:18px;font-weight:800;}
.form-header p{color:rgba(255,255,255,0.7);font-size:13px;margin-top:3px;}
.form-body{padding:28px 32px;}
.photo-sec{text-align:center;margin-bottom:24px;}
.photo-sec img{width:100px;height:100px;border-radius:50%;border:4px solid #1a3a8f;object-fit:cover;margin-bottom:10px;display:block;margin-left:auto;margin-right:auto;}
.photo-btn{display:inline-block;background:#1a3a8f;color:white;padding:7px 18px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;}
.photo-btn input{display:none;}
.fg{margin-bottom:16px;}
.fg label{display:block;font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;}
.fg input,.fg select,.fg textarea{width:100%;padding:10px 14px;border:2px solid #dce8ff;border-radius:10px;font-size:14px;color:#333;outline:none;transition:border 0.2s;}
.fg input:focus,.fg select:focus,.fg textarea:focus{border-color:#1a3a8f;}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.btn-row{display:flex;gap:12px;margin-top:8px;}
.btn-save{flex:1;padding:13px;background:#1a3a8f;color:white;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;}
.btn-save:hover{background:#0f2d6b;}
.btn-cancel{padding:13px 22px;background:#eef2ff;color:#1a3a8f;border:2px solid #c7d7ff;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;}
</style></head><body>
<nav>
  <div class="nav-brand">👨‍🏫 Teacher Dashboard</div>
  <div class="nav-right"><a href="/teacher/dashboard">← Back</a><a href="/logout">Logout</a></div>
</nav>
<div class="page">
<div class="form-card">
  <div class="form-header"><h2>✏️ Edit Student</h2><p>Update the student's information below</p></div>
  <div class="form-body">
    <form method="POST" action="/teacher/edit/${s.id}" enctype="multipart/form-data">
      <div class="photo-sec">
        <img id="prev" src="${currentPhoto}" alt="Photo">
        <label class="photo-btn">📷 Change Photo<input type="file" name="photo" accept="image/*" onchange="prev.src=URL.createObjectURL(this.files[0])"></label>
      </div>
      <div class="row2">
        <div class="fg"><label>Full Name</label><input name="name" value="${s.name}" required></div>
        <div class="fg"><label>Email</label><input name="email" type="email" value="${s.email||''}"></div>
      </div>
      <div class="row2">
        <div class="fg"><label>Register Number</label><input name="reg_no" value="${s.reg_no}"></div>
        <div class="fg"><label>City</label><input name="city" value="${s.city||''}"></div>
      </div>
      <div class="row2">
        <div class="fg"><label>Date of Birth</label><input name="dob" type="date" value="${dobVal}"></div>
        <div class="fg"><label>Age</label><input name="age" type="number" value="${s.age||''}"></div>
      </div>
      <div class="row2">
        <div class="fg"><label>Department</label>
          <select name="department">
            ${['CSE','ECE','EEE','IT','MECH','CIVIL','MBA'].map(d=>`<option ${s.department===d?'selected':''}>${d}</option>`).join('')}
          </select>
        </div>
        <div class="fg"><label>Status</label>
          <select name="status">
            <option ${s.status==='active'?'selected':''}>active</option>
            <option ${s.status==='inactive'?'selected':''}>inactive</option>
          </select>
        </div>
      </div>
      <div class="fg"><label>Address</label><textarea name="address" rows="2">${s.address||''}</textarea></div>
      <div class="btn-row">
        <button type="submit" class="btn-save">💾 Save Changes</button>
        <button type="button" class="btn-cancel" onclick="history.back()">Cancel</button>
      </div>
    </form>
  </div>
</div>
</div>
</body></html>`);
    });
});

// ── TEACHER EDIT POST ─────────────────────────────────────────────────────────
app.post('/teacher/edit/:id', requireTeacher, upload.single('photo'), (req, res) => {
    const { name, email, city, reg_no, dob, age, department, address, status } = req.body;
    if (req.file) {
        db.query(`UPDATE students SET name=?,email=?,city=?,reg_no=?,dob=?,age=?,department=?,address=?,status=?,photos=? WHERE id=?`,
            [name,email,city,reg_no,dob,age,department,address,status,req.file.filename,req.params.id],
            err => { if(err) return res.send('Update failed: '+err.message); res.redirect('/teacher/dashboard'); });
    } else {
        db.query(`UPDATE students SET name=?,email=?,city=?,reg_no=?,dob=?,age=?,department=?,address=?,status=? WHERE id=?`,
            [name,email,city,reg_no,dob,age,department,address,status,req.params.id],
            err => { if(err) return res.send('Update failed: '+err.message); res.redirect('/teacher/dashboard'); });
    }
});

// ── TEACHER DELETE ────────────────────────────────────────────────────────────
app.get('/teacher/delete/:id', requireTeacher, (req, res) => {
    db.query('DELETE FROM students WHERE id=?', [req.params.id], (err) => {
        if (err) return res.send('Delete failed: ' + err.message);
        res.redirect('/teacher/dashboard');
    });
});

// ── START ─────────────────────────────────────────────────────────────────────
app.listen(3000, () => console.log(' Server running on http://localhost:3000'));