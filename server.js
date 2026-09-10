const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// PIN équipe : donne accès à la lecture et à l'ajout de lots.
const PIN = process.env.TEAM_PIN || '';
// PIN admin : donne en plus le droit de modifier / supprimer un lot existant.
// Doit être différent du PIN équipe et configuré sur Render (Environment > ADMIN_PIN).
const ADMIN_PIN = process.env.ADMIN_PIN || '';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL manquante. Ajoute une base Postgres et configure cette variable.');
}
if (!PIN) {
  console.warn('TEAM_PIN non configuré : la page sera accessible sans code, pour toute personne ayant le lien.');
}
if (!ADMIN_PIN) {
  console.warn('ADMIN_PIN non configuré : personne ne pourra modifier ou supprimer un lot.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lots (
      id SERIAL PRIMARY KEY,
      nom TEXT,
      date TEXT,
      ingredients NUMERIC,
      paye NUMERIC,
      quantite NUMERIC,
      prix_vente NUMERIC,
      vendues NUMERIC,
      cout_total NUMERIC,
      cout_par_portion NUMERIC,
      benefice_reel NUMERIC,
      saved_at BIGINT
    );
  `);
}

function rowToLot(row) {
  return {
    id: String(row.id),
    nom: row.nom,
    date: row.date,
    ingredients: row.ingredients !== null ? Number(row.ingredients) : 0,
    paye: row.paye !== null ? Number(row.paye) : 0,
    quantite: row.quantite !== null ? Number(row.quantite) : 0,
    prixVente: row.prix_vente !== null ? Number(row.prix_vente) : 0,
    vendues: row.vendues !== null ? Number(row.vendues) : null,
    coutTotal: row.cout_total !== null ? Number(row.cout_total) : 0,
    coutParPortion: row.cout_par_portion !== null ? Number(row.cout_par_portion) : 0,
    beneficeReel: row.benefice_reel !== null ? Number(row.benefice_reel) : null,
    savedAt: Number(row.saved_at),
  };
}

// Accès équipe : lecture + ajout de lots.
function checkPin(req, res, next) {
  if (!PIN) return next();
  const pin = req.header('x-pin');
  if (pin !== PIN) return res.status(401).json({ error: 'PIN invalide' });
  next();
}

// Accès admin : modification + suppression d'un lot existant.
// Si ADMIN_PIN n'est pas configuré côté serveur, ces actions sont désactivées pour tout le monde
// (plutôt que de les laisser ouvertes par erreur).
function checkAdminPin(req, res, next) {
  if (!ADMIN_PIN) return res.status(403).json({ error: 'Fonction admin non configurée sur le serveur' });
  const pin = req.header('x-admin-pin');
  if (pin !== ADMIN_PIN) return res.status(401).json({ error: 'PIN admin invalide' });
  next();
}

// Vrai seulement si le header x-admin-pin correspond au PIN admin configuré.
// Ne bloque jamais la requête : sert juste à décider quelles infos renvoyer.
function isAdmin(req) {
  if (!ADMIN_PIN) return false;
  return req.header('x-admin-pin') === ADMIN_PIN;
}

app.get('/api/lots', checkPin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM lots ORDER BY saved_at DESC');
    const lots = result.rows.map(rowToLot);
    if (isAdmin(req)) {
      // Admin : détail complet de chaque lot.
      res.json(lots);
    } else {
      // Équipe : seulement de quoi afficher le résumé (nom, date, bénéfice).
      // Le détail des coûts/marges n'est jamais envoyé à quelqu'un qui n'a pas le PIN admin.
      res.json(lots.map(l => ({ id: l.id, nom: l.nom, date: l.date, beneficeReel: l.beneficeReel, savedAt: l.savedAt })));
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur base de données' });
  }
});

app.post('/api/lots', checkPin, async (req, res) => {
  const b = req.body || {};
  const savedAt = Date.now();
  try {
    const result = await pool.query(
      `INSERT INTO lots
        (nom, date, ingredients, paye, quantite, prix_vente, vendues, cout_total, cout_par_portion, benefice_reel, saved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        b.nom || 'Lot sans nom',
        b.date || null,
        b.ingredients || 0,
        b.paye || 0,
        b.quantite || 0,
        b.prixVente || 0,
        b.vendues === undefined ? null : b.vendues,
        b.coutTotal || 0,
        b.coutParPortion || 0,
        b.beneficeReel === undefined ? null : b.beneficeReel,
        savedAt,
      ]
    );
    res.json(rowToLot(result.rows[0]));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur base de données' });
  }
});

// Modifier un lot existant — réservé à l'admin.
app.put('/api/lots/:id', checkAdminPin, async (req, res) => {
  const b = req.body || {};
  try {
    const result = await pool.query(
      `UPDATE lots SET
        nom = $1, date = $2, ingredients = $3, paye = $4, quantite = $5,
        prix_vente = $6, vendues = $7, cout_total = $8, cout_par_portion = $9, benefice_reel = $10
       WHERE id = $11
       RETURNING *`,
      [
        b.nom || 'Lot sans nom',
        b.date || null,
        b.ingredients || 0,
        b.paye || 0,
        b.quantite || 0,
        b.prixVente || 0,
        b.vendues === undefined ? null : b.vendues,
        b.coutTotal || 0,
        b.coutParPortion || 0,
        b.beneficeReel === undefined ? null : b.beneficeReel,
        req.params.id,
      ]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Lot introuvable' });
    res.json(rowToLot(result.rows[0]));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur base de données' });
  }
});

// Supprimer un lot — réservé à l'admin.
app.delete('/api/lots/:id', checkAdminPin, async (req, res) => {
  try {
    await pool.query('DELETE FROM lots WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur base de données' });
  }
});

// Utilisé par la page pour vérifier un PIN admin saisi, sans rien modifier.
app.get('/api/admin/verify', checkAdminPin, (req, res) => res.json({ ok: true }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    app.listen(PORT, () => console.log('Serveur thieb lancé sur le port ' + PORT));
  })
  .catch((e) => {
    console.error('Impossible d\'initialiser la base de données :', e);
    process.exit(1);
  });
