const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const PIN = process.env.TEAM_PIN || '';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL manquante. Ajoute une base Postgres et configure cette variable.');
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

function checkPin(req, res, next) {
  if (!PIN) return next();
  const pin = req.header('x-pin');
  if (pin !== PIN) return res.status(401).json({ error: 'PIN invalide' });
  next();
}

app.get('/api/lots', checkPin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM lots ORDER BY saved_at DESC');
    res.json(result.rows.map(rowToLot));
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

app.delete('/api/lots/:id', checkPin, async (req, res) => {
  try {
    await pool.query('DELETE FROM lots WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur base de données' });
  }
});

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
