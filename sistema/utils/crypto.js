import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

const ALGORITMO = 'aes-256-cbc';
const KEY = Buffer.from(process.env.CRYPTO_KEY, 'hex');
const IV = Buffer.from(process.env.CRYPTO_IV, 'hex');

export function criptografarCPF(cpf) {
  const apenasNumeros = String(cpf).replace(/\D/g, '');
  const cipher = crypto.createCipheriv(ALGORITMO, KEY, IV);
  let criptografado = cipher.update(apenasNumeros, 'utf8', 'hex');
  criptografado += cipher.final('hex');
  return criptografado;
}

export function descriptografarCPF(cpfCriptografado) {
  try {
    const decipher = crypto.createDecipheriv(ALGORITMO, KEY, IV);
    let original = decipher.update(cpfCriptografado, 'hex', 'utf8');
    original += decipher.final('utf8');
    return original;
  } catch {
    return cpfCriptografado;
  }
}