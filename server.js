const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('.'));

const db = new sqlite3.Database('./sisagro.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        nome TEXT, 
        cpf TEXT, 
        telefone TEXT,
        email TEXT,
        endereco TEXT,
        cidade TEXT,
        observacoes TEXT
    )`);

    db.run(`ALTER TABLE clientes ADD COLUMN email TEXT`, () => {});
    db.run(`ALTER TABLE clientes ADD COLUMN endereco TEXT`, () => {});
    db.run(`ALTER TABLE clientes ADD COLUMN cidade TEXT`, () => {});
    db.run(`ALTER TABLE clientes ADD COLUMN observacoes TEXT`, () => {});

    db.run(`CREATE TABLE IF NOT EXISTS produtos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        descricao TEXT, 
        preco REAL, 
        estoque INTEGER,
        categoria TEXT,
        unidade TEXT,
        estoque_minimo INTEGER,
        fornecedor TEXT
    )`);

    db.run(`ALTER TABLE produtos ADD COLUMN categoria TEXT`, () => {});
    db.run(`ALTER TABLE produtos ADD COLUMN unidade TEXT`, () => {});
    db.run(`ALTER TABLE produtos ADD COLUMN estoque_minimo INTEGER`, () => {});
    db.run(`ALTER TABLE produtos ADD COLUMN fornecedor TEXT`, () => {});

    db.run(`CREATE TABLE IF NOT EXISTS vendas (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        cliente_id INTEGER, 
        data TEXT, 
        total REAL,
        status_pagamento TEXT DEFAULT 'Pendente',
        FOREIGN KEY (cliente_id) REFERENCES clientes (id)
    )`);

    db.run(`ALTER TABLE vendas ADD COLUMN status_pagamento TEXT DEFAULT 'Pendente'`, () => {});

    db.run(`CREATE TABLE IF NOT EXISTS itens_venda (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        venda_id INTEGER, 
        produto_id INTEGER, 
        quantidade INTEGER, 
        preco_unitario REAL, 
        FOREIGN KEY (venda_id) REFERENCES vendas (id), 
        FOREIGN KEY (produto_id) REFERENCES produtos (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS servicos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        descricao TEXT,
        preco REAL,
        categoria TEXT,
        duracao_estimada TEXT,
        profissional TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS pagamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venda_id INTEGER,
        data_pagamento TEXT,
        valor_pago REAL,
        metodo_pagamento TEXT,
        observacoes TEXT,
        FOREIGN KEY (venda_id) REFERENCES vendas (id)
    )`);
});

// ROTAS DE CLIENTES
app.post('/salvar-cliente', (req, res) => {
    const { nome, cpf, telefone, email, endereco, cidade, observacoes } = req.body;
    db.run(`INSERT INTO clientes (nome, cpf, telefone, email, endereco, cidade, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
        [nome, cpf, telefone, email || '', endereco || '', cidade || '', observacoes || ''], (err) => {
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
    const { descricao, preco, estoque, categoria, unidade, estoque_minimo, fornecedor } = req.body;
    db.run(`INSERT INTO produtos (descricao, preco, estoque, categoria, unidade, estoque_minimo, fornecedor) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
        [descricao, preco, estoque, categoria || '', unidade || '', estoque_minimo || 0, fornecedor || ''], (err) => {
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

    db.run(`INSERT INTO vendas (cliente_id, data, total, status_pagamento) VALUES (?, ?, ?, 'Pendente')`, [cliente_id, data, total], function (err) {
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
    const sql = `
        SELECT v.id, v.data, v.total, v.status_pagamento, c.nome as nome_cliente 
        FROM vendas v 
        INNER JOIN clientes c ON v.cliente_id = c.id 
        ORDER BY v.id DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows);
    });
});

app.get('/detalhes-venda/:id', (req, res) => {
    const { id } = req.params;
    const sql = `
        SELECT i.*, p.descricao 
        FROM itens_venda i 
        INNER JOIN produtos p ON i.produto_id = p.id 
        WHERE i.venda_id = ?`;

    db.all(sql, [id], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows);
    });
});

// ROTAS DE SERVIÇOS
app.post('/salvar-servico', (req, res) => {
    const { nome, descricao, preco, categoria, duracao_estimada, profissional } = req.body;
    db.run(`INSERT INTO servicos (nome, descricao, preco, categoria, duracao_estimada, profissional) VALUES (?, ?, ?, ?, ?, ?)`, 
        [nome, descricao, preco, categoria, duracao_estimada, profissional], (err) => {
        if (err) return res.status(500).send(err.message);
        res.redirect('/servicos.html');
    });
});

app.get('/listar-servicos', (req, res) => {
    db.all("SELECT * FROM servicos ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows);
    });
});

app.put('/atualizar-servico/:id', (req, res) => {
    const { id } = req.params;
    const { nome, descricao, preco, categoria, duracao_estimada, profissional } = req.body;
    db.run(`UPDATE servicos SET nome=?, descricao=?, preco=?, categoria=?, duracao_estimada=?, profissional=? WHERE id=?`,
        [nome, descricao, preco, categoria, duracao_estimada, profissional, id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.delete('/excluir-servico/:id', (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM servicos WHERE id=?`, [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ROTAS DE PAGAMENTOS
app.post('/registrar-pagamento', (req, res) => {
    const { venda_id, valor_pago, metodo_pagamento, observacoes } = req.body;
    const data_pagamento = new Date().toLocaleString('pt-BR');

    db.run(`INSERT INTO pagamentos (venda_id, data_pagamento, valor_pago, metodo_pagamento, observacoes) 
            VALUES (?, ?, ?, ?, ?)`,
        [venda_id, data_pagamento, valor_pago, metodo_pagamento, observacoes || ''], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        db.get(`SELECT SUM(valor_pago) as total_pago FROM pagamentos WHERE venda_id = ?`, [venda_id], (err, row) => {
            if (!err && row) {
                db.get(`SELECT total FROM vendas WHERE id = ?`, [venda_id], (err2, venda) => {
                    if (!err2 && venda && row.total_pago >= venda.total) {
                        db.run(`UPDATE vendas SET status_pagamento = 'Pago' WHERE id = ?`, [venda_id]);
                    }
                });
            }
        });

        res.json({ success: true });
    });
});

app.get('/pagamentos-venda/:venda_id', (req, res) => {
    const { venda_id } = req.params;
    db.all(`SELECT * FROM pagamentos WHERE venda_id = ? ORDER BY id DESC`, [venda_id], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows);
    });
});

app.get('/listar-pagamentos', (req, res) => {
    const sql = `
        SELECT p.*, v.total as total_venda, c.nome as nome_cliente
        FROM pagamentos p
        INNER JOIN vendas v ON p.venda_id = v.id
        INNER JOIN clientes c ON v.cliente_id = c.id
        ORDER BY p.id DESC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows);
    });
});

// Iniciar Servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`AGROVERDE RODANDO EM: http://localhost:${PORT}`);
    console.log(`=========================================`);
});