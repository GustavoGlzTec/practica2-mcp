#!/usr/bin/env node
// Lee TUS archivos reales (salida/traza.jsonl y salida/historial_inspector.json)
// y genera, en analisis.md, el material para el README:
//   - la tabla de mensajes de tu cliente (actividades B y C)
//   - los datos de la inicializacion de ambos clientes (actividad D)
//   - la definicion de list_directory (actividad B)
//   - las dos respuestas fallidas, copiadas tal cual (actividad C)
//   - el diagrama de secuencia en Mermaid (actividad E)
// No inventa nada: si un dato no esta en tus archivos, lo marca como "no encontrado".
//
// Uso (desde la carpeta practica2-mcp):  node scripts/analizar.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = (...r) => path.join(raiz, ...r);
const salidaMd = [];
const out = (s = '') => salidaMd.push(s);
const json = (o) => JSON.stringify(o);
const bonito = (o) => JSON.stringify(o, null, 2);
const mermaidSeguro = (s) => String(s).replace(/[;#]/g, ',').replace(/\s+/g, ' ').trim();
const corto = (s, n = 70) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// ------------------------------------------------------------------ traza
const rutaTraza = p('salida', 'traza.jsonl');
if (!fs.existsSync(rutaTraza)) {
  console.error('No existe salida/traza.jsonl. Ejecuta primero: node cliente_mcp.mjs');
  process.exit(1);
}
const traza = fs.readFileSync(rutaTraza, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
const esCliente = (e) => e.direccion.startsWith('CLIENTE');

// Para cada id, que pidio el cliente (metodo y, si es tools/call, la herramienta)
const solicitudes = new Map();
for (const e of traza) {
  if (esCliente(e) && e.mensaje.id !== undefined) solicitudes.set(e.mensaje.id, e.mensaje);
}

function tipoDe(m) {
  if (m.method !== undefined) return m.id !== undefined ? 'Solicitud' : 'Notificación';
  if (m.error) return 'Respuesta (error)';
  if (m.result?.isError) return 'Respuesta (result con isError)';
  return 'Respuesta';
}

function describirRespuesta(m) {
  const sol = solicitudes.get(m.id) || {};
  if (m.error) return `error code ${m.error.code} "${m.error.message}"`;
  const r = m.result || {};
  if (sol.method === 'initialize') return `result: protocolVersion ${r.protocolVersion}, serverInfo ${r.serverInfo?.name} ${r.serverInfo?.version}`;
  if (sol.method === 'tools/list') return `result: ${r.tools?.length ?? '?'} herramientas`;
  const texto = (r.content || []).map((c) => c.text || '').join(' ').replace(/\s+/g, ' ');
  return `result${r.isError ? ' con isError: true' : ''}: ${corto(texto, 60)}`;
}

function describirSolicitud(m) {
  if (m.method === 'tools/call') return `tools/call → ${m.params?.name}(${json(m.params?.arguments || {})})`;
  return m.method;
}

out('# Análisis generado a partir de tus archivos');
out('');
out(`> Generado por \`scripts/analizar.mjs\` el ${new Date().toLocaleString('es-MX')}. Copia al README lo que necesites y **revísalo contra tu terminal**.`);
out('');
out(`## Mensajes de salida/traza.jsonl (${traza.length} mensajes)`);
out('');
out('| # | Dirección | Método o contenido | Tipo de mensaje | id |');
out('|---|---|---|---|---|');
traza.forEach((e, i) => {
  const m = e.mensaje;
  const cont = m.method !== undefined ? describirSolicitud(m) : describirRespuesta(m);
  out(`| ${i + 1} | ${esCliente(e) ? 'Cliente → Servidor' : 'Servidor → Cliente'} | ${cont.replace(/\|/g, '\\|')} | ${tipoDe(m)} | ${m.id ?? '— (sin id)'} |`);
});
const nCli = traza.filter(esCliente).length;
out('');
out(`Total: ${nCli} del cliente y ${traza.length - nCli} del servidor.`);

// ------------------------------------------------------- list_directory
const respLista = traza.find((e) => !esCliente(e) && solicitudes.get(e.mensaje.id)?.method === 'tools/list');
const herramientas = respLista?.mensaje.result?.tools || [];
const ld = herramientas.find((t) => t.name === 'list_directory');
out('');
out('## Definición de list_directory (de la respuesta a tools/list)');
out('');
out(`El servidor ofrece ${herramientas.length} herramientas: ${herramientas.map((t) => '`' + t.name + '`').join(', ') || 'no encontradas'}.`);
out('');
if (ld) {
  out('```json');
  out(bonito({ name: ld.name, description: ld.description, inputSchema: ld.inputSchema, annotations: ld.annotations }));
  out('```');
} else out('No se encontró list_directory en la traza.');

// --------------------------------------------------------------- errores
out('');
out('## Respuestas fallidas (actividad C), copiadas de tu traza');
const fallidas = traza.filter((e) => !esCliente(e) && (e.mensaje.error || e.mensaje.result?.isError));
if (!fallidas.length) out('\nNo hay respuestas fallidas en la traza: ¿ya agregaste las solicitudes de la actividad C?');
for (const e of fallidas) {
  const clase = e.mensaje.error ? 'Error de protocolo (campo `error`, sin `result`)' : 'Error de ejecución de herramienta (`result` con `"isError": true`)';
  out('');
  out(`**id ${e.mensaje.id}: ${clase}.** Respondía a: \`${describirSolicitud(solicitudes.get(e.mensaje.id) || {})}\``);
  out('');
  out('```json');
  out(json(e.mensaje));
  out('```');
}

// ------------------------------------------------- inicializacion cliente
const iniCli = solicitudes.get(traza.find((e) => esCliente(e) && e.mensaje.method === 'initialize')?.mensaje.id);
const iniSrv = traza.find((e) => !esCliente(e) && solicitudes.get(e.mensaje.id)?.method === 'initialize')?.mensaje;

// --------------------------------------------- historial del Inspector
// El formato del archivo exportado cambia entre versiones del Inspector, asi que se
// recorre completo buscando objetos con "method" (solicitudes y notificaciones) y la
// respuesta que trae "serverInfo".
let insp = null;
const rutaHist = p('salida', 'historial_inspector.json');
if (fs.existsSync(rutaHist)) {
  try {
    const hist = JSON.parse(fs.readFileSync(rutaHist, 'utf8'));
    const metodos = [];
    let iniReq = null, iniRes = null;
    const visitar = (o) => {
      if (typeof o === 'string' && /^\s*[[{]/.test(o)) {
        try { return visitar(JSON.parse(o)); } catch { return; }
      }
      if (Array.isArray(o)) return o.forEach(visitar);
      if (!o || typeof o !== 'object') return;
      if (typeof o.method === 'string') {
        metodos.push(o.method);
        if (o.method === 'initialize' && o.params && !iniReq) iniReq = o.params;
      }
      if (o.serverInfo && o.protocolVersion && !iniRes) iniRes = o;
      Object.values(o).forEach(visitar);
    };
    visitar(hist);
    insp = { metodos, iniReq, iniRes };
  } catch (e) {
    insp = { error: e.message };
  }
}

const CLIENTE_A_SERVIDOR = new Set(['initialize', 'notifications/initialized', 'tools/list', 'tools/call', 'ping', 'resources/list', 'prompts/list', 'logging/setLevel', 'notifications/roots/list_changed', 'notifications/cancelled', 'completion/complete', 'resources/templates/list']);
const solicitudesDelServidor = (insp?.metodos || []).filter((m) => !CLIENTE_A_SERVIDOR.has(m) && !m.startsWith('notifications/'));

const nd = 'no encontrado';
const caps = (c) => (c ? (Object.keys(c).length ? Object.keys(c).map((k) => '`' + k + '`').join(', ') : 'ninguna (`{}`)') : nd);

out('');
out('## Comparación de la inicialización (actividad D)');
out('');
if (!insp) out('> ⚠ No existe salida/historial_inspector.json: la columna del Inspector queda vacía.\n');
if (insp?.error) out(`> ⚠ No se pudo leer salida/historial_inspector.json: ${insp.error}\n`);
out('| | Inspector | Cliente mínimo |');
out('|---|---|---|');
out(`| Nombre y versión del cliente (clientInfo) | ${insp?.iniReq?.clientInfo ? insp.iniReq.clientInfo.name + ' ' + insp.iniReq.clientInfo.version : nd} | ${iniCli?.params?.clientInfo ? iniCli.params.clientInfo.name + ' ' + iniCli.params.clientInfo.version : nd} |`);
out(`| Versión del protocolo que propuso el cliente | ${insp?.iniReq?.protocolVersion ?? nd} | ${iniCli?.params?.protocolVersion ?? nd} |`);
out(`| Versión del protocolo que respondió el servidor | ${insp?.iniRes?.protocolVersion ?? nd} | ${iniSrv?.result?.protocolVersion ?? nd} |`);
out(`| Capacidades que declaró el cliente | ${caps(insp?.iniReq?.capabilities)} | ${caps(iniCli?.params?.capabilities)} |`);
out(`| ¿El servidor envió una solicitud al cliente? ¿Cuál? | ${insp ? (solicitudesDelServidor.length ? 'Sí: ' + [...new Set(solicitudesDelServidor)].map((m) => '`' + m + '`').join(', ') : 'No se encontró ninguna') : nd} | ${traza.some((e) => !esCliente(e) && e.mensaje.method) ? 'Sí: ' + traza.filter((e) => !esCliente(e) && e.mensaje.method).map((e) => '`' + e.mensaje.method + '`').join(', ') : 'No'} |`);
out('');
out(`Servidor (serverInfo): ${iniSrv?.result?.serverInfo ? iniSrv.result.serverInfo.name + ' ' + iniSrv.result.serverInfo.version : nd}. Capacidades del servidor: ${caps(iniSrv?.result?.capabilities)}.`);
if (insp?.iniReq) {
  out('');
  out('<details><summary>initialize del Inspector (parámetros y respuesta)</summary>');
  out('');
  out('```json');
  out(bonito({ params: insp.iniReq, result: insp.iniRes }));
  out('```');
  out('</details>');
}
if (insp?.metodos?.length) {
  out('');
  out(`Métodos encontrados en el historial del Inspector, en el orden del archivo: ${insp.metodos.map((m) => '`' + m + '`').join(' → ')}.`);
  out('> El Inspector lista los mensajes del más reciente al más antiguo: revisa el orden en su panel antes de copiar la tabla de la actividad A.');
}

// --------------------------------------------------------------- mermaid
const lineas = ['sequenceDiagram', '    participant C as Cliente', '    participant S as Servidor', '    Note over C,S: Inicializacion'];
let enOperacion = false;
for (const e of traza) {
  const m = e.mensaje;
  if (!enOperacion && esCliente(e) && m.method && !['initialize', 'notifications/initialized'].includes(m.method)) {
    lineas.push('    Note over C,S: Operacion');
    enOperacion = true;
  }
  if (esCliente(e)) {
    const etiqueta = m.method === 'tools/call' ? `tools/call ${m.params?.name} ${m.params?.arguments?.path ?? ''}` : m.method;
    lineas.push(m.id !== undefined ? `    C->>S: ${mermaidSeguro(etiqueta)} (id ${m.id})` : `    C-)S: ${mermaidSeguro(etiqueta)}`);
    continue;
  }
  if (m.method) { // solicitud o notificacion que inicia el servidor
    lineas.push(m.id !== undefined ? `    S->>C: ${mermaidSeguro(m.method)} (id ${m.id})` : `    S-)C: ${mermaidSeguro(m.method)}`);
    continue;
  }
  const sol = solicitudes.get(m.id) || {};
  if (m.error) {
    lineas.push('    rect rgba(255, 0, 0, 0.12)');
    lineas.push(`    S-->>C: ERROR DE PROTOCOLO - error ${m.error.code} ${mermaidSeguro(m.error.message)} (id ${m.id})`);
    lineas.push('    end');
  } else if (m.result?.isError) {
    lineas.push('    rect rgba(255, 165, 0, 0.18)');
    lineas.push(`    S-->>C: ERROR DE EJECUCION - result con isError true, acceso denegado (id ${m.id})`);
    lineas.push('    end');
  } else if (sol.method === 'initialize') {
    lineas.push(`    S-->>C: result con version ${mermaidSeguro(m.result?.protocolVersion)}, capacidades e identidad (id ${m.id})`);
  } else if (sol.method === 'tools/list') {
    lineas.push(`    S-->>C: result con ${m.result?.tools?.length ?? '?'} herramientas (id ${m.id})`);
  } else if (sol.params?.name === 'list_directory') {
    lineas.push(`    S-->>C: result con el listado, FILE calificaciones.csv (id ${m.id})`);
  } else if (sol.params?.name === 'read_text_file') {
    lineas.push(`    S-->>C: result con el contenido del CSV (id ${m.id})`);
  } else {
    lineas.push(`    S-->>C: result (id ${m.id})`);
  }
}
lineas.push('    Note over C,S: Cierre - el cliente cierra stdin y el servidor termina');

out('');
out('## Diagrama de secuencia (actividad E)');
out('');
out('Rojo = error de protocolo. Naranja = error de ejecución de herramienta. Pruébalo en https://mermaid.live antes de publicarlo.');
out('');
out('```mermaid');
lineas.forEach((l) => out(l));
out('```');

fs.writeFileSync(p('analisis.md'), salidaMd.join('\n') + '\n', 'utf8');
console.log(salidaMd.join('\n'));
console.log('\n✔ También quedó guardado en analisis.md (no se sube a GitHub: está en .gitignore).');
