#!/usr/bin/env node
// OPCIONAL. Sustituye tu nombre de usuario del sistema por TU_USUARIO en los
// archivos de salida, para no publicarlo (sección 11.3 de la guía).
// Uso (desde la carpeta practica2-mcp):  node scripts/anonimizar.mjs
// Si lo usas, acláralo en la sección "Problemas encontrados" o "Actividad C" del README.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const usuario = os.userInfo().username;
if (!usuario || usuario.length < 3) {
  console.log('No se pudo determinar un nombre de usuario seguro de reemplazar. No se cambió nada.');
  process.exit(0);
}
for (const f of ['salida/traza.jsonl', 'salida/historial_inspector.json']) {
  const ruta = path.join(raiz, f);
  if (!fs.existsSync(ruta)) continue;
  const texto = fs.readFileSync(ruta, 'utf8');
  const n = texto.split(usuario).length - 1;
  fs.writeFileSync(ruta, texto.split(usuario).join('TU_USUARIO'), 'utf8');
  console.log(`${f}: ${n} reemplazo(s) de "${usuario}" por TU_USUARIO`);
}
