import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './config/db.js';
import { criptografarCPF, descriptografarCPF } from './utils/crypto.js';
import { verificarLogin } from './middlewares/auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'chave_padrao_clinica',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 15 }, // Expira em 15 minutos
  })
);

// Funções auxiliares para formatar datas sem erro de fuso horário
function dataISO(valor) {
  if (!valor) return '';
  if (valor instanceof Date) return valor.toISOString().split('T')[0];
  return String(valor).split('T')[0];
}

function dataBR(valor) {
  const iso = dataISO(valor);
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

// ================= ROTAS DE AUTENTICAÇÃO =================

app.get('/login', (req, res) => {
  res.render('login', { erro: null });
});

app.post('/login', async (req, res) => {
  const { cpf, senha } = req.body;

  if (!cpf || !senha) {
    return res.render('login', { erro: 'CPF ou senha inválidos.' });
  }

  try {
    const cpfCifrado = criptografarCPF(cpf);
    const resultado = await pool.query('SELECT * FROM usuarios WHERE cpf = $1', [cpfCifrado]);

    if (resultado.rows.length === 0) {
      return res.render('login', { erro: 'CPF ou senha inválidos.' });
    }

    const usuario = resultado.rows[0];
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);

    if (!senhaCorreta) {
      return res.render('login', { erro: 'CPF ou senha inválidos.' });
    }

    req.session.usuario = { id: usuario.id, nome: usuario.nome };
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.render('login', { erro: 'Erro ao realizar login.' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// ================= PÁGINA INICIAL =================

app.get('/', verificarLogin, (req, res) => {
  res.render('home', { usuario: req.session.usuario });
});

// ================= MÓDULO RESPONSÁVEIS =================

app.get('/responsaveis', verificarLogin, async (req, res) => {
  const busca = req.query.busca || '';
  const editarId = req.query.editar || null;
  const erro = req.query.erro || null;

  try {
    const resultado = await pool.query(
      'SELECT * FROM responsaveis WHERE nome ILIKE $1 ORDER BY nome ASC',
      [`%${busca}%`]
    );

    const responsaveis = resultado.rows.map((r) => ({
      ...r,
      cpf: descriptografarCPF(r.cpf),
    }));

    const responsavelEditando = editarId
      ? responsaveis.find((r) => String(r.id) === String(editarId))
      : null;

    res.render('responsaveis', {
      usuario: req.session.usuario,
      responsaveis,
      busca,
      responsavelEditando,
      erro,
    });
  } catch (err) {
    console.error(err);
    res.send('Erro ao listar responsáveis.');
  }
});

app.post('/responsaveis', verificarLogin, async (req, res) => {
  const { nome, cpf, email, telefone } = req.body;
  if (!nome || !cpf || !email || !telefone) {
    return res.redirect('/responsaveis?erro=Preencha todos os campos.');
  }

  try {
    const cpfCifrado = criptografarCPF(cpf);
    await pool.query(
      'INSERT INTO responsaveis (nome, cpf, email, telefone) VALUES ($1, $2, $3, $4)',
      [nome.trim(), cpfCifrado, email.trim(), telefone.trim()]
    );
    res.redirect('/responsaveis');
  } catch (err) {
    console.error(err);
    res.redirect('/responsaveis?erro=Erro ao cadastrar (verifique se o CPF já existe).');
  }
});

app.post('/responsaveis/editar/:id', verificarLogin, async (req, res) => {
  const { id } = req.params;
  const { nome, cpf, email, telefone } = req.body;
  if (!nome || !cpf || !email || !telefone) {
    return res.redirect('/responsaveis?erro=Preencha todos os campos.');
  }

  try {
    const cpfCifrado = criptografarCPF(cpf);
    await pool.query(
      'UPDATE responsaveis SET nome = $1, cpf = $2, email = $3, telefone = $4 WHERE id = $5',
      [nome.trim(), cpfCifrado, email.trim(), telefone.trim(), id]
    );
    res.redirect('/responsaveis');
  } catch (err) {
    console.error(err);
    res.redirect('/responsaveis?erro=Erro ao atualizar responsável.');
  }
});

app.post('/responsaveis/excluir/:id', verificarLogin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM responsaveis WHERE id = $1', [id]);
    res.redirect('/responsaveis');
  } catch (err) {
    if (err.code === '23503') {
      return res.redirect(
        '/responsaveis?erro=Não é possível excluir: existem crianças vinculadas a este responsável.'
      );
    }
    res.redirect('/responsaveis?erro=Erro ao excluir responsável.');
  }
});

// ================= MÓDULO CRIANÇAS =================

app.get('/criancas', verificarLogin, async (req, res) => {
  const editarId = req.query.editar || null;
  const erro = req.query.erro || null;

  try {
    const resCriancas = await pool.query(`
      SELECT c.*, r.nome AS responsavel_nome
      FROM criancas c
      JOIN responsaveis r ON c.responsavel_id = r.id
      ORDER BY c.nome ASC
    `);

    const resResponsaveis = await pool.query('SELECT id, nome FROM responsaveis ORDER BY nome ASC');

    const criancas = resCriancas.rows.map((c) => ({
      ...c,
      data_nascimento_iso: dataISO(c.data_nascimento),
      data_nascimento_br: dataBR(c.data_nascimento),
    }));

    const criancaEditando = editarId
      ? criancas.find((c) => String(c.id) === String(editarId))
      : null;

    res.render('criancas', {
      usuario: req.session.usuario,
      criancas,
      responsaveis: resResponsaveis.rows,
      criancaEditando,
      erro,
    });
  } catch (err) {
    console.error(err);
    res.send('Erro ao carregar crianças.');
  }
});

app.post('/criancas', verificarLogin, async (req, res) => {
  const { nome, data_nascimento, responsavel_id } = req.body;
  if (!nome || !data_nascimento || !responsavel_id) {
    return res.redirect('/criancas?erro=Preencha todos os campos.');
  }

  try {
    await pool.query(
      'INSERT INTO criancas (nome, data_nascimento, responsavel_id) VALUES ($1, $2, $3)',
      [nome.trim(), data_nascimento, responsavel_id]
    );
    res.redirect('/criancas');
  } catch (err) {
    console.error(err);
    res.redirect('/criancas?erro=Erro ao cadastrar criança.');
  }
});

app.post('/criancas/editar/:id', verificarLogin, async (req, res) => {
  const { id } = req.params;
  const { nome, data_nascimento, responsavel_id } = req.body;
  if (!nome || !data_nascimento || !responsavel_id) {
    return res.redirect('/criancas?erro=Preencha todos os campos.');
  }

  try {
    await pool.query(
      'UPDATE criancas SET nome = $1, data_nascimento = $2, responsavel_id = $3 WHERE id = $4',
      [nome.trim(), data_nascimento, responsavel_id, id]
    );
    res.redirect('/criancas');
  } catch (err) {
    console.error(err);
    res.redirect('/criancas?erro=Erro ao atualizar criança.');
  }
});

app.post('/criancas/excluir/:id', verificarLogin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM criancas WHERE id = $1', [id]);
    res.redirect('/criancas');
  } catch (err) {
    if (err.code === '23503') {
      return res.redirect(
        '/criancas?erro=Não é possível excluir: existem atendimentos vinculados a esta criança.'
      );
    }
    res.redirect('/criancas?erro=Erro ao excluir criança.');
  }
});

// ================= MÓDULO ATENDIMENTOS =================

app.get('/atendimentos', verificarLogin, async (req, res) => {
  const editarId = req.query.editar || null;
  const erro = req.query.erro || null;

  try {
    const resAtendimentos = await pool.query(`
      SELECT a.*, c.nome AS crianca_nome, r.nome AS responsavel_nome
      FROM atendimentos a
      JOIN criancas c ON a.crianca_id = c.id
      JOIN responsaveis r ON c.responsavel_id = r.id
      ORDER BY a.data_atendimento ASC, a.horario ASC
    `);

    const resCriancas = await pool.query('SELECT id, nome FROM criancas ORDER BY nome ASC');

    const atendimentos = resAtendimentos.rows.map((a) => ({
      ...a,
      data_iso: dataISO(a.data_atendimento),
      data_br: dataBR(a.data_atendimento),
      horario_curto: String(a.horario).slice(0, 5),
    }));

    const atendimentoEditando = editarId
      ? atendimentos.find((a) => String(a.id) === String(editarId))
      : null;

    res.render('atendimentos', {
      usuario: req.session.usuario,
      atendimentos,
      criancas: resCriancas.rows,
      atendimentoEditando,
      erro,
    });
  } catch (err) {
    console.error(err);
    res.send('Erro ao carregar atendimentos.');
  }
});

app.post('/atendimentos', verificarLogin, async (req, res) => {
  const { crianca_id, data_atendimento, horario, motivo, situacao } = req.body;
  if (!crianca_id || !data_atendimento || !horario || !motivo || !situacao) {
    return res.redirect('/atendimentos?erro=Preencha todos os campos.');
  }

  try {
    await pool.query(
      'INSERT INTO atendimentos (crianca_id, data_atendimento, horario, motivo, situacao) VALUES ($1, $2, $3, $4, $5)',
      [crianca_id, data_atendimento, horario, motivo.trim(), situacao]
    );
    res.redirect('/atendimentos');
  } catch (err) {
    console.error(err);
    res.redirect('/atendimentos?erro=Erro ao cadastrar atendimento.');
  }
});

app.post('/atendimentos/editar/:id', verificarLogin, async (req, res) => {
  const { id } = req.params;
  const { crianca_id, data_atendimento, horario, motivo, situacao } = req.body;
  if (!crianca_id || !data_atendimento || !horario || !motivo || !situacao) {
    return res.redirect('/atendimentos?erro=Preencha todos os campos.');
  }

  try {
    await pool.query(
      'UPDATE atendimentos SET crianca_id = $1, data_atendimento = $2, horario = $3, motivo = $4, situacao = $5 WHERE id = $6',
      [crianca_id, data_atendimento, horario, motivo.trim(), situacao, id]
    );
    res.redirect('/atendimentos');
  } catch (err) {
    console.error(err);
    res.redirect('/atendimentos?erro=Erro ao atualizar atendimento.');
  }
});

app.post('/atendimentos/excluir/:id', verificarLogin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM atendimentos WHERE id = $1', [id]);
    res.redirect('/atendimentos');
  } catch (err) {
    console.error(err);
    res.redirect('/atendimentos?erro=Erro ao excluir atendimento.');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});