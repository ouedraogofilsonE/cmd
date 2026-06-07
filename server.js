// ============================================================
//  FILSON ELECTRONICS - Serveur Express (server.js)
//  Express 5 + CORS + JSON database locale
// ============================================================

const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = 5000;
const DB_PATH = path.join(__dirname, 'database.json');

// ── Middlewares ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // sert index.html depuis la racine

// ── Helpers base de données ──────────────────────────────────
function readDB() {
    try {
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    } catch {
        return { users: [], products: [] };
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function isAdmin(email) {
    const db = readDB();
    const user = db.users.find(u => u.email === email);
    return user && user.role === 'admin';
}

// ── Routes Auth ──────────────────────────────────────────────

// POST /api/auth/register
app.post('/api/auth/register', (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }

    const db = readDB();
    if (!db.users) db.users = [];

    if (db.users.find(u => u.email === email)) {
        return res.status(409).json({ message: 'Un compte existe déjà avec cet email.' });
    }

    const newUser = {
        id:       Date.now(),
        name,
        email,
        password, // ⚠️ En production : utiliser bcrypt pour hasher
        role:     'client'
    };

    db.users.push(newUser);
    writeDB(db);
    res.status(201).json({ message: '✅ Compte créé avec succès ! Vous pouvez vous connecter.' });
});

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const db = readDB();
    if (!db.users) db.users = [];

    const user = db.users.find(u => u.email === email && u.password === password);
    if (!user) {
        return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
    }

    const { password: _, ...safeUser } = user; // ne pas renvoyer le mot de passe
    res.json({ message: 'Connexion réussie !', user: safeUser });
});

// ── Routes Produits ──────────────────────────────────────────

// GET /api/products?category=&search=
app.get('/api/products', (req, res) => {
    const db = readDB();
    let products = db.products || [];

    const { category, search } = req.query;

    if (category) {
        products = products.filter(p => p.category === category);
    }

    if (search) {
        const q = search.toLowerCase();
        products = products.filter(p =>
            p.name.toLowerCase().includes(q) ||
            (p.specs && p.specs.toLowerCase().includes(q))
        );
    }

    res.json(products);
});

// GET /api/products/:id
app.get('/api/products/:id', (req, res) => {
    const db = readDB();
    const product = (db.products || []).find(p => p.id === parseInt(req.params.id));
    if (!product) return res.status(404).json({ message: 'Produit introuvable.' });
    res.json(product);
});

// POST /api/products/add
app.post('/api/products/add', (req, res) => {
    const { name, category, price, specs, image, adminEmail } = req.body;

    if (!isAdmin(adminEmail)) {
        return res.status(403).json({ message: 'Accès refusé. Réservé aux administrateurs.' });
    }

    if (!name || !category || price === undefined || price === '') {
        return res.status(400).json({ message: 'Nom, catégorie et prix sont obligatoires.' });
    }

    const db = readDB();
    if (!db.products) db.products = [];

    const newProduct = {
        id:       Date.now(),
        name:     name.trim(),
        category,
        price:    parseInt(price) || 0,
        specs:    specs || '',
        image:    image || ''
    };

    db.products.push(newProduct);
    writeDB(db);
    res.status(201).json({ message: `✅ "${newProduct.name}" ajouté au catalogue !`, product: newProduct });
});

// PUT /api/products/update/:id
app.put('/api/products/update/:id', (req, res) => {
    const { name, category, price, specs, image, adminEmail } = req.body;

    if (!isAdmin(adminEmail)) {
        return res.status(403).json({ message: 'Accès refusé. Réservé aux administrateurs.' });
    }

    const db = readDB();
    const idx = (db.products || []).findIndex(p => p.id === parseInt(req.params.id));

    if (idx === -1) return res.status(404).json({ message: 'Produit introuvable.' });

    db.products[idx] = {
        ...db.products[idx],
        name:     name?.trim()     ?? db.products[idx].name,
        category: category         ?? db.products[idx].category,
        price:    parseInt(price)  ?? db.products[idx].price,
        specs:    specs            ?? db.products[idx].specs,
        image:    image            ?? db.products[idx].image
    };

    writeDB(db);
    res.json({ message: `✅ "${db.products[idx].name}" mis à jour avec succès !`, product: db.products[idx] });
});

// DELETE /api/products/delete/:id   ← SUPPRESSION
app.delete('/api/products/delete/:id', (req, res) => {
    const { adminEmail } = req.body;

    if (!isAdmin(adminEmail)) {
        return res.status(403).json({ message: 'Accès refusé. Réservé aux administrateurs.' });
    }

    const db = readDB();
    const productId = parseInt(req.params.id);
    const productIndex = (db.products || []).findIndex(p => p.id === productId);

    if (productIndex === -1) {
        return res.status(404).json({ message: 'Produit introuvable.' });
    }

    const deletedName = db.products[productIndex].name;
    db.products.splice(productIndex, 1);
    writeDB(db);

    res.json({ message: `🗑️ "${deletedName}" supprimé du catalogue avec succès.` });
});

// ── Démarrage ────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 FILSON Electronics — Serveur démarré`);
    console.log(`   → http://localhost:${PORT}`);
    console.log(`   → API : http://localhost:${PORT}/api/products\n`);
});
