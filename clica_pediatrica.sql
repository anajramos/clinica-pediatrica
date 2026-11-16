-- Script de criação e povoamento do banco de dados
-- Clínica Pediátrica Pequenos Passos

-- 1. Tabela de usuários (operadores do sistema)
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    cpf VARCHAR(255) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL
);

-- 2. Tabela de responsáveis
CREATE TABLE IF NOT EXISTS responsaveis (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    cpf VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL,
    telefone VARCHAR(20) NOT NULL
);

-- 3. Tabela de crianças (1:N com responsáveis)
CREATE TABLE IF NOT EXISTS criancas (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    data_nascimento DATE NOT NULL,
    responsavel_id INT NOT NULL REFERENCES responsaveis(id) ON DELETE RESTRICT
);

-- 4. Tabela de atendimentos (1:N com crianças)
CREATE TABLE IF NOT EXISTS atendimentos (
    id SERIAL PRIMARY KEY,
    crianca_id INT NOT NULL REFERENCES criancas(id) ON DELETE CASCADE,
    data_atendimento DATE NOT NULL,
    horario TIME NOT NULL,
    motivo VARCHAR(255) NOT NULL,
    situacao VARCHAR(50) NOT NULL
);

-- ================= POVOAMENTO DE TESTE =================

-- Inserção de 3 usuários/operadores (Senha para todos: 123456)
-- CPFs: 111.222.333-44, 222.333.444-55, 333.444.555-66 (criptografados com AES-256-CBC)
INSERT INTO usuarios (nome, cpf, senha_hash) VALUES
('Dra. Ana Paula Silveira', 'c3119bda3a482fa2561281a70aace964', '$2b$10$0ygzi8hdg/oA4UqM6AJhpeh.z1FFWvFnzz/3ZASeR4iLyIeToYbcG'),
('Dr. Carlos Eduardo Lima', 'b0b1401a5198533acc7c47fcc159cee6', '$2b$10$0ygzi8hdg/oA4UqM6AJhpeh.z1FFWvFnzz/3ZASeR4iLyIeToYbcG'),
('Recepcionista Marina Costa', '0411acf70817a1fe033c89d431439c64', '$2b$10$0ygzi8hdg/oA4UqM6AJhpeh.z1FFWvFnzz/3ZASeR4iLyIeToYbcG')
ON CONFLICT (cpf) DO NOTHING;

-- Inserção de 3 responsáveis
-- CPFs: 444.555.666-77, 555.666.777-88, 666.777.888-99 (criptografados com AES-256-CBC)
INSERT INTO responsaveis (nome, cpf, email, telefone) VALUES
('Juliana Mendes Oliveira', '4c1e33bbcdcfffc072119d31d93402cb', 'juliana.mendes@email.com', '(11) 98765-4321'),
('Roberto Santos Ferreira', '538e55d6dc13c7a48b9770673b41b91d', 'roberto.santos@email.com', '(11) 97654-3210'),
('Patricia Almeida Ramos', 'b16971aa72878016bf9b0d90152a574d', 'patricia.ramos@email.com', '(11) 96543-2109')
ON CONFLICT (cpf) DO NOTHING;

-- Inserção de 3 crianças vinculadas aos responsáveis
INSERT INTO criancas (nome, data_nascimento, responsavel_id)
SELECT 'Lucas Mendes Ferreira', '2020-05-15', id FROM responsaveis WHERE cpf = '4c1e33bbcdcfffc072119d31d93402cb'
AND NOT EXISTS (SELECT 1 FROM criancas WHERE nome = 'Lucas Mendes Ferreira');

INSERT INTO criancas (nome, data_nascimento, responsavel_id)
SELECT 'Beatriz Santos Rocha', '2019-11-20', id FROM responsaveis WHERE cpf = '538e55d6dc13c7a48b9770673b41b91d'
AND NOT EXISTS (SELECT 1 FROM criancas WHERE nome = 'Beatriz Santos Rocha');

INSERT INTO criancas (nome, data_nascimento, responsavel_id)
SELECT 'Gabriel Almeida Ramos', '2022-03-08', id FROM responsaveis WHERE cpf = 'b16971aa72878016bf9b0d90152a574d'
AND NOT EXISTS (SELECT 1 FROM criancas WHERE nome = 'Gabriel Almeida Ramos');

-- Inserção de 3 atendimentos vinculados às crianças
INSERT INTO atendimentos (crianca_id, data_atendimento, horario, motivo, situacao)
SELECT id, '2026-11-20', '09:00:00', 'Consulta de rotina e acompanhamento de crescimento', 'Agendado'
FROM criancas WHERE nome = 'Lucas Mendes Ferreira'
AND NOT EXISTS (SELECT 1 FROM atendimentos WHERE motivo LIKE 'Consulta de rotina%' AND crianca_id = criancas.id);

INSERT INTO atendimentos (crianca_id, data_atendimento, horario, motivo, situacao)
SELECT id, '2026-11-20', '10:30:00', 'Febre persistente e tosse seca', 'Em Espera'
FROM criancas WHERE nome = 'Beatriz Santos Rocha'
AND NOT EXISTS (SELECT 1 FROM atendimentos WHERE motivo LIKE 'Febre persistente%' AND crianca_id = criancas.id);

INSERT INTO atendimentos (crianca_id, data_atendimento, horario, motivo, situacao)
SELECT id, '2026-11-21', '14:00:00', 'Aplicação de vacinas e avaliação pediátrica geral', 'Agendado'
FROM criancas WHERE nome = 'Gabriel Almeida Ramos'
AND NOT EXISTS (SELECT 1 FROM atendimentos WHERE motivo LIKE 'Aplicação de vacinas%' AND crianca_id = criancas.id);
