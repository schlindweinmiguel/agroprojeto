const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('.'));

const db = new sqlite3.Database('./siscampo.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        cpf TEXT,
        telefone TEXT,
        endereco TEXT,
        tipo_cliente TEXT,
        area_ha REAL,
        atividade TEXT,
        email TEXT,
        whatsapp TEXT,
        observacoes TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS produtos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        descricao TEXT,
        preco REAL,
        estoque INTEGER
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS vendas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER,
        data TEXT,
        total REAL,
        FOREIGN KEY (cliente_id) REFERENCES clientes (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS itens_venda (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venda_id INTEGER,
        produto_id INTEGER,
        quantidade INTEGER,
        preco_unitario REAL,
        FOREIGN KEY (venda_id) REFERENCES vendas (id),
        FOREIGN KEY (produto_id) REFERENCES produtos (id)
    )`);
});

// ROTAS DE CLIENTES
app.post('/salvar-cliente', (req, res) => {
    const { nome, cpf, telefone, endereco, tipo_cliente, area_ha, atividade, email, whatsapp, observacoes } = req.body;
    db.run(`INSERT INTO clientes (nome, cpf, telefone, endereco, tipo_cliente, area_ha, atividade, email, whatsapp, observacoes) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
        [nome, cpf, telefone, endereco, tipo_cliente, area_ha, atividade, email, whatsapp, observacoes], 
        (err) => {
            if (err) return res.status(500).send(err.message);
            res.redirect('/clientes.html');
        });
});

app.get('/listar-clientes', (req, res) => {
    db.all("SELECT * FROM clientes", [], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows);
    });
});

// ROTAS DE PRODUTOS
app.post('/salvar-produto', (req, res) => {
    const { descricao, preco, estoque } = req.body;
    db.run(`INSERT INTO produtos (descricao, preco, estoque) VALUES (?, ?, ?)`, [descricao, preco, estoque], (err) => {
        if (err) return res.status(500).send(err.message);
        res.redirect('/produtos.html');
    });
});

app.get('/listar-produtos', (req, res) => {
    db.all("SELECT * FROM produtos", [], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows);
    });
});

// ROTAS DE VENDAS
app.post('/finalizar-venda', (req, res) => {
    const { cliente_id, total, itens } = req.body;
    const data = new Date().toLocaleString('pt-BR');

    db.run(`INSERT INTO vendas (cliente_id, data, total) VALUES (?, ?, ?)`, [cliente_id, data, total], function (err) {
        if (err) return res.status(500).json(err);
        const vendaId = this.lastID;
        const stmt = db.prepare(`INSERT INTO itens_venda (venda_id, produto_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)`);

        itens.forEach(item => {
            stmt.run(vendaId, item.id, item.qtd, item.preco);
            db.run(`UPDATE produtos SET estoque = estoque - ? WHERE id = ?`, [item.qtd, item.id]);
        });
        stmt.finalize();
        res.json({ success: true });
    });
});

app.get('/listar-vendas', (req, res) => {
    const sql = `SELECT v.id, v.data, v.total, c.nome as nome_cliente 
                 FROM vendas v INNER JOIN clientes c ON v.cliente_id = c.id ORDER BY v.id DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows);
    });
});

app.get('/detalhes-venda/:id', (req, res) => {
    const sql = `SELECT i.*, p.descricao FROM itens_venda i 
                 INNER JOIN produtos p ON i.produto_id = p.id WHERE i.venda_id = ?`;
    db.all(sql, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows);
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`SISAGRO RODANDO EM: http://localhost:${PORT}`);
    console.log(`=========================================`);
});
