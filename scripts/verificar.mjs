#!/usr/bin/env node
// Revisa que la practica 2 cumpla con lo que pide la guia. NO genera nada: solo comprueba.
// Uso (desde la carpeta practica2-mcp):  node scripts/verificar.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = (...r) => path.join(raiz, ...r);
let errores = 0, avisos = 0;
const ok = (m) => console.log('  ✔ ' + m);
const mal = (m) => { errores++; console.log('  ✘ ' + m); };
const ojo = (m) => { avisos++; console.log('  ⚠ ' + m); };
const leer = (f) => fs.readFileSync(f, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
const existe = (f) => fs.existsSync(p(f));

console.log('\n[Estructura]');
for (const f of ['README.md', 'mcp.json', 'cliente_mcp.mjs', 'datos/calificaciones.csv', 'salida/historial_inspector.json', 'salida/traza.jsonl']) {
  existe(f) ? ok(f) : mal(`Falta ${f}`);
}
if (existe('mcp.json')) {
  try {
    const cfg = JSON.parse(leer(p('mcp.json')));
    const a = cfg.mcpServers?.filesystem?.args || [];
    a.includes('@modelcontextprotocol/server-filesystem') && a.at(-1) === '.' ? ok('mcp.json describe filesystem con acceso a "."') : mal('mcp.json no coincide con el de la guía');
  } catch (e) { mal('mcp.json no es JSON válido: ' + e.message); }
}

console.log('\n[Actividad A: salida/historial_inspector.json]');
if (existe('salida/historial_inspector.json')) {
  const texto = leer(p('salida/historial_inspector.json'));
  try {
    JSON.parse(texto);
    ok('Es JSON válido');
  } catch { mal('No es JSON válido (¿lo editaste a mano?)'); }
  for (const m of ['initialize', 'tools/list', 'tools/call']) {
    texto.includes(m) ? ok(`Contiene ${m}`) : mal(`No contiene ${m}`);
  }
  const n = (texto.match(/\\?"method\\?"\s*:/g) || []).length;
  n >= 4 ? ok(`${n} mensajes con "method" (solicitudes y notificaciones); más sus respuestas`) : ojo(`Solo ${n} mensajes con "method": ¿exportaste después de ejecutar las herramientas?`);
}

console.log('\n[Actividades B y C: salida/traza.jsonl]');
let traza = [];
if (existe('salida/traza.jsonl')) {
  try {
    traza = leer(p('salida/traza.jsonl')).split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch (e) { mal('Una línea de la traza no es JSON válido: ' + e.message); }
  const cli = traza.filter((e) => e.direccion?.startsWith('CLIENTE'));
  const srv = traza.filter((e) => e.direccion?.startsWith('SERVIDOR'));
  traza.length === 13 ? ok('13 mensajes') : mal(`Hay ${traza.length} mensajes; deben ser 13 (7 = solo actividad B, sin las solicitudes de la C)`);
  cli.length === 7 && srv.length === 6 ? ok('7 del cliente y 6 del servidor') : mal(`${cli.length} del cliente y ${srv.length} del servidor; se esperan 7 y 6`);
  const ini = cli.find((e) => e.mensaje.method === 'initialize');
  ini?.mensaje.params?.protocolVersion === '1999-01-01'
    ? mal('La traza tiene protocolVersion 1999-01-01: restaura 2025-06-18 y vuelve a ejecutar el cliente (actividad D, paso 2)')
    : ok(`initialize con protocolVersion ${ini?.mensaje.params?.protocolVersion}`);
  const porId = new Map(srv.map((e) => [e.mensaje.id, e.mensaje]));
  const llamada = (tool, pred) => cli.find((e) => e.mensaje.params?.name === tool && pred(e.mensaje.params.arguments || {}));
  const ld = llamada('list_directory', () => true);
  ld && JSON.stringify(porId.get(ld.mensaje.id) || {}).includes('calificaciones.csv') ? ok('list_directory devolvió calificaciones.csv') : mal('La respuesta a list_directory no menciona calificaciones.csv');
  const okRead = llamada('read_text_file', (a) => /calificaciones\.csv$/.test(a.path || ''));
  okRead && JSON.stringify(porId.get(okRead.mensaje.id) || {}).includes('matricula,nombre') ? ok('read_text_file devolvió el contenido del CSV') : mal('Falta la lectura correcta de datos/calificaciones.csv o no devolvió su contenido');
  const prohibida = llamada('read_text_file', (a) => /win\.ini|\/etc\/hosts/i.test(a.path || ''));
  const rp = prohibida && porId.get(prohibida.mensaje.id);
  rp?.result?.isError === true ? ok('Lectura prohibida → result con isError: true (error de ejecución)') : mal('La lectura prohibida no devolvió un result con isError: true');
  const inventada = cli.find((e) => e.mensaje.id !== undefined && !['initialize', 'tools/list', 'tools/call'].includes(e.mensaje.method));
  const ri = inventada && porId.get(inventada.mensaje.id);
  ri?.error ? ok(`Método inventado (${inventada.mensaje.method}) → error ${ri.error.code} "${ri.error.message}" (error de protocolo)`) : mal('Falta la solicitud con método inventado o no devolvió un campo error');
  const usuario = os.userInfo().username;
  if (usuario && usuario.length > 2 && leer(p('salida/traza.jsonl')).includes(usuario)) {
    ojo(`La traza contiene tu usuario del sistema ("${usuario}"). Opcional: node scripts/anonimizar.mjs`);
  }
}
if (existe('cliente_mcp.mjs')) {
  const cod = leer(p('cliente_mcp.mjs'));
  cod.includes('read_text_file') ? ok('cliente_mcp.mjs es la versión final (con la actividad C)') : mal('cliente_mcp.mjs no tiene las solicitudes de la actividad C');
  cod.includes("'1999-01-01'") ? mal("cliente_mcp.mjs todavía tiene '1999-01-01': restaura '2025-06-18'") : ok('protocolVersion restaurado en el código');
}

console.log('\n[README.md]');
if (existe('README.md')) {
  const r = leer(p('README.md'));
  const pend = (r.match(/✏️/g) || []).length;
  pend === 0 ? ok('Sin marcas ✏️ pendientes') : mal(`Quedan ${pend} marcas ✏️ por completar`);
  const secciones = ['Descripción', 'Requisitos y reproducción', 'Actividad A', 'Actividad B', 'Actividad C', 'Actividad D', 'Actividad E', 'Problemas encontrados', 'Fuentes'];
  let ultimo = -1, enOrden = true;
  const faltan = secciones.filter((s) => {
    const i = r.search(new RegExp('^##.*' + s, 'm'));
    if (i < 0) return true;
    if (i < ultimo) enOrden = false;
    ultimo = i;
    return false;
  });
  faltan.length ? mal(`Faltan secciones: ${faltan.join(', ')}`) : enOrden ? ok('Las 9 secciones, en orden') : mal('Las secciones no están en el orden de la guía');
  const bloque = r.match(/```mermaid\n([\s\S]*?)```/);
  if (!bloque) mal('No hay bloque ```mermaid (actividad E)');
  else {
    const d = bloque[1];
    const flechas = d.split('\n').filter((l) => /(->>|-->>|-\))/.test(l)).length;
    flechas >= 13 ? ok(`Diagrama con ${flechas} mensajes`) : mal(`El diagrama tiene ${flechas} mensajes; deben ser 13`);
    ['Inicializacion|Inicialización', 'Operacion|Operación', 'Cierre'].every((f) => new RegExp('Note over.*(' + f + ')').test(d)) ? ok('Diagrama con las tres fases') : mal('Al diagrama le falta alguna nota de fase (Inicialización, Operación, Cierre)');
    /;/.test(d.split('\n').filter((l) => /->>|-->>|-\)/.test(l)).join('\n')) ? mal('Hay un punto y coma en el texto de una flecha: Mermaid lo corta') : ok('Sin punto y coma en las flechas');
  }
  const imgs = [...r.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]);
  const rotas = imgs.filter((i) => !/^https?:/.test(i) && !fs.existsSync(p(decodeURI(i))));
  rotas.length ? mal(`Imágenes que no existen: ${rotas.join(', ')}`) : ok(`${imgs.length} imágenes referenciadas, todas existen`);
}

console.log('\n[Git]');
try {
  const log = execSync('git log --oneline', { cwd: raiz, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split('\n').filter(Boolean);
  log.length >= 7 ? ok(`${log.length} commits`) : ojo(`${log.length} commits: se espera inicial + A, B, C, D, E + README (7)`);
  const tracked = execSync('git ls-files', { cwd: raiz, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  if (tracked.includes('analisis.md')) ojo('analisis.md está en el repositorio: es solo de apoyo, puedes quitarlo con git rm --cached analisis.md');
  execSync('git remote -v', { cwd: raiz }).toString().includes('github.com') ? ok('Remoto de GitHub configurado') : ojo('Aún no hay remoto de GitHub');
} catch { ojo('Esta carpeta todavía no es un repositorio de Git'); }

console.log(`\nResultado: ${errores} error(es), ${avisos} aviso(s).` + (errores === 0 ? ' ¡Listo para entregar!' : ''));
process.exit(errores ? 1 : 0);
