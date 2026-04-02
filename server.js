const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'heartland-secret-2026';
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const initial = {
      users: [
        { id: 1, username: 'owner', password: bcrypt.hashSync('heartland2026', 10), role: 'owner', name: 'Lane (Owner)' },
        { id: 2, username: 'secretary', password: bcrypt.hashSync('secretary2026', 10), role: 'secretary', name: 'Secretary' },
        { id: 3, username: 'greg', password: bcrypt.hashSync('greg2026', 10), role: 'employee', name: 'Greg Kahler', rate: 50, color: '#E6F1FB', tc: '#0C447C' },
        { id: 4, username: 'ty', password: bcrypt.hashSync('ty2026', 10), role: 'employee', name: 'Ty Rodgers', rate: 40, color: '#EAF3DE', tc: '#27500A' },
        { id: 5, username: 'seth', password: bcrypt.hashSync('seth2026', 10), role: 'employee', name: 'Seth Hamilton', rate: 40, color: '#EEEDFE', tc: '#3C3489' },
        { id: 6, username: 'brayden', password: bcrypt.hashSync('brayden2026', 10), role: 'employee', name: 'Brayden Pankonen', rate: 40, color: '#FAEEDA', tc: '#633806' },
        { id: 7, username: 'colby', password: bcrypt.hashSync('colby2026', 10), role: 'employee', name: 'Colby Dillenbeck', rate: 40, color: '#E1F5EE', tc: '#085041' },
        { id: 8, username: 'braxton', password: bcrypt.hashSync('braxton2026', 10), role: 'employee', name: 'Braxton Hess', rate: 40, color: '#FAECE7', tc: '#712B13' },
        { id: 9, username: 'jordan', password: bcrypt.hashSync('jordan2026', 10), role: 'employee', name: 'Jordan Kiner', rate: 40, color: '#F1EFE8', tc: '#444441' },
        { id: 10, username: 'braeden', password: bcrypt.hashSync('braeden2026', 10), role: 'employee', name: 'Braeden Vanbockern', rate: 40, color: '#FBEAF0', tc: '#72243E' },
      ],
      sales: [], goals: [], posts: [], ownerSales: { revenue: 0, installs: 0 }
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
  }
  return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }

function auth(roles = []) {
  return (req, res, next) => {
    const token = req.cookies.token || (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (roles.length && !roles.includes(decoded.role)) return res.status(403).json({ error: 'Forbidden' });
      req.user = decoded;
      next();
    } catch { res.status(401).json({ error: 'Invalid token' }); }
  };
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const data = loadData();
  const user = data.users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid username or password' });
  const token = jwt.sign({ id: user.id, role: user.role, name: user.name, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
  res.cookie('token', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.json({ role: user.role, name: user.name });
});

app.post('/api/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: true }); });
app.get('/api/me', auth(), (req, res) => { res.json(req.user); });

app.get('/api/employees', auth(['owner', 'secretary']), (req, res) => {
  const data = loadData();
  const employees = data.users.filter(u => u.role === 'employee').map(u => {
    const empSales = data.sales.filter(s => s.userId === u.id);
    const revenue = empSales.reduce((s, x) => s + x.amount, 0);
    return { id: u.id, name: u.name, username: u.username, rate: u.rate, color: u.color, tc: u.tc, revenue, installs: empSales.length, earned: revenue * (u.rate / 100) };
  });
  res.json({ employees, ownerSales: data.ownerSales });
});

app.get('/api/my-stats', auth(['employee']), (req, res) => {
  const data = loadData();
  const user = data.users.find(u => u.id === req.user.id);
  const mySales = data.sales.filter(s => s.userId === req.user.id);
  const revenue = mySales.reduce((s, x) => s + x.amount, 0);
  res.json({ name: user.name, rate: user.rate, color: user.color, tc: user.tc, revenue, installs: mySales.length, earned: revenue * (user.rate / 100), sales: mySales.slice(-10).reverse(), goal: data.goals.find(g => g.userId === req.user.id) || null, posts: data.posts.slice(0, 10) });
});

app.post('/api/sales', auth(['secretary', 'owner']), (req, res) => {
  const { userId, amount, address, date } = req.body;
  if (!userId || !amount) return res.status(400).json({ error: 'Missing fields' });
  const data = loadData();
  data.sales.push({ id: Date.now(), userId: parseInt(userId), amount: parseFloat(amount), address: address || '', date: date || new Date().toISOString().split('T')[0] });
  saveData(data); res.json({ ok: true });
});

app.delete('/api/sales/:id', auth(['secretary', 'owner']), (req, res) => {
  const data = loadData(); data.sales = data.sales.filter(s => s.id !== parseInt(req.params.id)); saveData(data); res.json({ ok: true });
});

app.post('/api/owner-sales', auth(['owner']), (req, res) => {
  const data = loadData(); data.ownerSales = { revenue: parseFloat(req.body.revenue) || 0, installs: parseInt(req.body.installs) || 0 }; saveData(data); res.json({ ok: true });
});

app.get('/api/goals', auth(['owner', 'secretary']), (req, res) => { res.json(loadData().goals); });

app.post('/api/goals', auth(['owner']), (req, res) => {
  const { userId, target, prize } = req.body;
  const data = loadData();
  data.goals = data.goals.filter(g => g.userId !== parseInt(userId));
  data.goals.push({ id: Date.now(), userId: parseInt(userId), target: parseFloat(target), prize });
  saveData(data); res.json({ ok: true });
});

app.delete('/api/goals/:id', auth(['owner']), (req, res) => {
  const data = loadData(); data.goals = data.goals.filter(g => g.id !== parseInt(req.params.id)); saveData(data); res.json({ ok: true });
});

app.get('/api/posts', auth(), (req, res) => { res.json(loadData().posts.slice(0, 20)); });

app.post('/api/posts', auth(['owner']), (req, res) => {
  const { type, body, author, target, pin } = req.body;
  const data = loadData();
  const d = new Date();
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  data.posts.unshift({ id: Date.now(), type, body, author, target, pin, date: days[d.getDay()]+', '+months[d.getMonth()]+' '+d.getDate() });
  saveData(data); res.json({ ok: true });
});

app.delete('/api/posts/:id', auth(['owner']), (req, res) => {
  const data = loadData(); data.posts = data.posts.filter(p => p.id !== parseInt(req.params.id)); saveData(data); res.json({ ok: true });
});

app.post('/api/employees', auth(['owner']), (req, res) => {
  const { name, username, password, rate } = req.body;
  const data = loadData();
  const colors = [["#E6F1FB","#0C447C"],["#EAF3DE","#27500A"],["#EEEDFE","#3C3489"],["#FAEEDA","#633806"],["#E1F5EE","#085041"],["#FAECE7","#712B13"],["#F1EFE8","#444441"],["#FBEAF0","#72243E"],["#FCEBEB","#791F1F"]];
  const c = colors[data.users.filter(u => u.role === 'employee').length % colors.length];
  data.users.push({ id: Date.now(), username, password: bcrypt.hashSync(password, 10), role: 'employee', name, rate: parseFloat(rate) || 40, color: c[0], tc: c[1] });
  saveData(data); res.json({ ok: true });
});

app.patch('/api/employees/:id', auth(['owner']), (req, res) => {
  const data = loadData();
  const user = data.users.find(u => u.id === parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (req.body.rate !== undefined) user.rate = parseFloat(req.body.rate);
  if (req.body.password) user.password = bcrypt.hashSync(req.body.password, 10);
  saveData(data); res.json({ ok: true });
});

app.get('/{*path}', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

app.listen(PORT, () => console.log(`Heartland running on http://localhost:${PORT}`));

// Mark sale as paid
app.patch('/api/sales/:id/paid', auth(['secretary', 'owner']), (req, res) => {
  const data = loadData();
  const sale = data.sales.find(s => s.id === parseInt(req.params.id));
  if (!sale) return res.status(404).json({ error: 'Not found' });
  sale.paid = req.body.paid;
  saveData(data);
  res.json({ ok: true });
});

// Weekly summary
app.get('/api/summary', auth(['owner']), (req, res) => {
  const data = loadData();
  const now = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const weekSales = data.sales.filter(s => new Date(s.date) >= weekAgo);
  const weekRev = weekSales.reduce((s, x) => s + x.amount, 0);
  const todaySales = data.sales.filter(s => s.date === now.toISOString().split('T')[0]);
  const todayRev = todaySales.reduce((s, x) => s + x.amount, 0);
  const unpaid = data.sales.filter(s => !s.paid);
  const unpaidTotal = unpaid.reduce((s, x) => s + x.amount, 0);
  const employees = data.users.filter(u => u.role === 'employee').map(u => {
    const empSales = data.sales.filter(s => s.userId === u.id);
    const revenue = empSales.reduce((s, x) => s + x.amount, 0);
    return { id: u.id, name: u.name, revenue, earned: revenue * (u.rate / 100) };
  });
  const topPerformer = employees.sort((a, b) => b.revenue - a.revenue)[0];
  res.json({ weekRev, todayRev, weekSales: weekSales.length, todaySales: todaySales.length, unpaidTotal, unpaidCount: unpaid.length, topPerformer });
});

app.get('/api/all-sales', auth(['owner', 'secretary']), (req, res) => {
  const data = loadData();
  res.json(data.sales.sort((a,b) => new Date(b.date) - new Date(a.date)));
});

// Submit quote
app.post('/api/quotes', auth(['employee', 'owner']), (req, res) => {
  const data = loadData();
  if(!data.quotes) data.quotes = [];
  const d = new Date();
  data.quotes.unshift({
    id: Date.now(),
    userId: req.user.id,
    employeeName: req.user.name,
    address: req.body.address,
    building: req.body.building,
    footage: req.body.footage,
    price: req.body.price,
    discount: req.body.discount || 0,
    finalPrice: req.body.finalPrice,
    status: 'new',
    notes: '',
    date: d.toISOString().split('T')[0]
  });
  saveData(data);
  res.json({ ok: true });
});

// Get all quotes
app.get('/api/quotes', auth(['owner', 'secretary']), (req, res) => {
  const data = loadData();
  res.json(data.quotes || []);
});

// Update quote status/notes
app.patch('/api/quotes/:id', auth(['owner', 'secretary']), (req, res) => {
  const data = loadData();
  if(!data.quotes) data.quotes = [];
  const quote = data.quotes.find(q => q.id === parseInt(req.params.id));
  if(!quote) return res.status(404).json({ error: 'Not found' });
  if(req.body.status !== undefined) quote.status = req.body.status;
  if(req.body.notes !== undefined) quote.notes = req.body.notes;
  saveData(data);
  res.json({ ok: true });
});

// Delete quote
app.delete('/api/quotes/:id', auth(['owner', 'secretary']), (req, res) => {
  const data = loadData();
  if(!data.quotes) data.quotes = [];
  data.quotes = data.quotes.filter(q => q.id !== parseInt(req.params.id));
  saveData(data);
  res.json({ ok: true });
});
