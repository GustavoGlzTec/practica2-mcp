# Práctica 2 · Ver el protocolo MCP por dentro

> ✏️ **Antes de entregar:** completa cada marca ✏️ con tus datos reales y bórrala. Las tablas, las respuestas fallidas y el diagrama los genera `node scripts/analizar.mjs` a partir de **tus** archivos (queda en `analisis.md`). `node scripts/verificar.mjs` te avisa si falta algo.

## 1. Descripción

En la práctica 1 un agente usó servidores MCP sin que viéramos los mensajes. En esta práctica los observé y los escribí yo misma, sin ningún agente de por medio:

- **Actividad A:** observé una sesión con el **MCP Inspector**, el cliente oficial de prueba.
- **Actividades B y C:** ejecuté un **cliente propio** de unas 70 líneas, sin bibliotecas, que habla JSON-RPC 2.0 por stdio con el servidor `filesystem`.
- **Actividad D:** comparé cómo se inicializan los dos clientes.
- **Actividad E:** representé la sesión completa en un diagrama de secuencia.

| Dato | Valor |
|---|---|
| Sistema operativo | ✏️ Windows 11, PowerShell |
| Node.js | ✏️ salida de `node --version` |
| MCP Inspector | ✏️ versión que muestra su interfaz |
| Servidor | `@modelcontextprotocol/server-filesystem` ✏️ versión (`serverInfo.version` en la respuesta a `initialize`) |
| Navegador | ✏️ |
| Fecha | ✏️ |

## 2. Requisitos y reproducción

**Requisitos:** Node.js **22.19 o superior** (lo exige el Inspector), un navegador (Chrome, Edge o Firefox), Git y conexión a internet para descargar el Inspector y el servidor la primera vez. No se necesita un agente de IA ni una cuenta de pago.

**Para repetir la práctica** (en Windows, desde PowerShell, no desde Git Bash):

```
git clone https://github.com/✏️TU_USUARIO/practica2-mcp.git
cd practica2-mcp
```

1. Inspector (actividad A). Abre el navegador; activa el interruptor del servidor `filesystem`:
   ```
   npx -y "@modelcontextprotocol/inspector" --config mcp.json
   ```
2. Cliente propio (actividades B y C). Sobrescribe `salida/traza.jsonl`:
   ```
   node cliente_mcp.mjs
   ```
3. Tablas y diagrama a partir de los archivos de `salida/`:
   ```
   node scripts/analizar.mjs
   ```
4. Comprobación de la estructura y de los resultados:
   ```
   node scripts/verificar.mjs
   ```

No hay rutas que cambiar: `mcp.json` y el cliente le dan al servidor acceso a la carpeta actual (`.`), así que funcionan en cualquier equipo siempre que se ejecuten desde la carpeta de la práctica.

```
practica2-mcp/
  README.md
  mcp.json                     configuración del servidor para el Inspector
  cliente_mcp.mjs              cliente mínimo, versión final (actividad C)
  datos/calificaciones.csv
  salida/historial_inspector.json   (actividad A)
  salida/traza.jsonl                (actividad C, trece mensajes)
  evidencias/                  capturas
  scripts/                     analizar.mjs, verificar.mjs, anonimizar.mjs (apoyo)
```

## 3. Actividad A · El protocolo visto con el MCP Inspector

Conecté el Inspector al servidor `filesystem` con `mcp.json`, ejecuté dos herramientas y exporté el historial a [`salida/historial_inspector.json`](salida/historial_inspector.json).

![Inspector conectado](evidencias/01_conectado.png)

### Mensajes en orden cronológico

El panel del Inspector los muestra del más reciente al más antiguo; aquí están del más antiguo al más reciente.

| # | Dirección | Método | Tipo |
|---|---|---|---|
| 1 | Cliente → Servidor | `initialize` | Solicitud |
| 2 | ✏️ | ✏️ `notifications/initialized` | ✏️ Notificación |
| 3 | ✏️ | ✏️ | ✏️ |
| … | ✏️ agrega una fila por mensaje | | |

✏️ *Anota cuál mensaje fue del servidor al cliente; probablemente `roots/list`.*

### Datos de la inicialización

| Dato | Valor |
|---|---|
| Versión del protocolo que propuso el cliente | ✏️ |
| Versión del protocolo que aceptó el servidor | ✏️ |
| Servidor (`serverInfo`) | ✏️ nombre y versión |
| Capacidades del servidor | ✏️ por ejemplo `tools` |
| Capacidades del cliente (el Inspector) | ✏️ por ejemplo `roots`, `sampling`, `elicitation` |
| Mensaje en dirección servidor → cliente | ✏️ |
| Número de herramientas (pestaña *Tools*) | ✏️ |

![Mensaje initialize desplegado](evidencias/02_initialize.png)

### Herramientas ejecutadas

1. **List Directory** con `path = datos`: devolvió `[FILE] calificaciones.csv` y generó un mensaje `tools/call`.
2. ✏️ La segunda herramienta que elegiste, con qué argumentos y qué devolvió.

![tools/call de list_directory](evidencias/03_tools_call.png)
![Segunda herramienta](evidencias/04_segunda_herramienta.png)

## 4. Actividad B · Un cliente MCP mínimo

[`cliente_mcp.mjs`](cliente_mcp.mjs) lanza el servidor como proceso hijo (`spawn`) y le escribe cada mensaje como **una línea de JSON** en su entrada estándar. Lee sus respuestas, una por línea, de su salida estándar. Las líneas como `Secure MCP Filesystem Server running on stdio` van por **stderr** y no forman parte del protocolo.

Cada respuesta se empareja con su solicitud por el `id`. `solicitar()` asigna un `id` nuevo y guarda en el mapa `pendientes` una promesa con ese `id`. Cuando llega una línea del servidor, el cliente busca en el mapa la promesa con el mismo `id` y la resuelve, así que el `await` continúa. `notificar()` no asigna `id` ni espera nada.

![Salida del cliente en la terminal](evidencias/05_cliente_actividad_b.png)

### Los siete mensajes

| # | Dirección | Método o contenido | Función que lo produjo | Tipo | id |
|---|---|---|---|---|---|
| 1 | Cliente → Servidor | `initialize` | `solicitar()` | Solicitud | 1 |
| 2 | Servidor → Cliente | result: versión, capacidades e identidad | respuesta leída por `createInterface` | Respuesta | 1 |
| 3 | Cliente → Servidor | `notifications/initialized` | `notificar()` | Notificación | — |
| 4 | Cliente → Servidor | `tools/list` | `solicitar()` | Solicitud | 2 |
| 5 | Servidor → Cliente | result con ✏️ N herramientas | respuesta | Respuesta | 2 |
| 6 | Cliente → Servidor | `tools/call` → `list_directory({"path":"datos"})` | `solicitar()` | Solicitud | 3 |
| 7 | Servidor → Cliente | result: `[FILE] calificaciones.csv` | respuesta | Respuesta | 3 |

✏️ *Confirma la tabla contra tu terminal o contra la sección "Mensajes" de `analisis.md`.*

### La herramienta `list_directory`, según su definición en `tools/list`

- **Descripción:** ✏️ escríbela con tus palabras. Qué hace la herramienta, qué prefijos usa para distinguir archivos y carpetas, y a qué carpetas está limitada.
- **Parámetros (`inputSchema`):** ✏️ es un objeto con la propiedad `path` de tipo texto; indica cuáles son obligatorios (`required`).
- **Anotaciones (`annotations`):** ✏️ por ejemplo `readOnlyHint: true`, que avisa al cliente que la herramienta solo lee y no modifica nada. Describe las que veas en tu traza.

## 5. Actividad C · Ampliar la conversación

Antes del paso 5 del cliente agregué tres solicitudes:

```js
// --- Actividad C: tres solicitudes nuevas ---
// 4.1 Una lectura correcta: el CSV de la practica.
await solicitar('tools/call', {
  name: 'read_text_file',
  arguments: { path: 'datos/calificaciones.csv' },
});

// 4.2 Una lectura prohibida: una ruta fuera de la carpeta permitida.
//     En Windows se usa C:/Windows/win.ini y en macOS o Linux /etc/hosts.
const RUTA_PROHIBIDA = process.platform === 'win32' ? 'C:/Windows/win.ini' : '/etc/hosts';
await solicitar('tools/call', {
  name: 'read_text_file',
  arguments: { path: RUTA_PROHIBIDA },
});

// 4.3 Un metodo que no existe en el protocolo.
await solicitar('herramientas/inventada', {});
```

Con eso la traza quedó en **13 mensajes**: 7 del cliente y 6 del servidor. La primera solicitud nueva devolvió el contenido del CSV.

![Salida del cliente, actividad C](evidencias/06_cliente_actividad_c.png)

### Las dos respuestas fallidas, copiadas de `salida/traza.jsonl`

**Lectura prohibida (id 5):**
```json
✏️ pega aquí la línea exacta (está en analisis.md)
```

**Método inventado (id 6):**
```json
✏️ pega aquí la línea exacta (está en analisis.md)
```

### En qué se diferencian

| | Lectura prohibida (id 5) | Método inventado (id 6) |
|---|---|---|
| Clase de error | **Error de ejecución de herramienta** | **Error de protocolo** |
| Campo que lo indica | La respuesta trae `result`, como una llamada exitosa, pero con `"isError": true` | La respuesta no trae `result`: trae `error` con `code` y `message` |
| Detalle | El texto del contenido explica el fallo: `Access denied - path outside allowed directories` | `code: -32601`, `message: "Method not found"`, el código estándar de JSON-RPC para un método inexistente |
| Qué pasó | El servidor **sí entendió** la solicitud y ejecutó `read_text_file`, pero la herramienta se negó porque la ruta está fuera de la carpeta permitida | El servidor **no pudo atender** el mensaje: `herramientas/inventada` no es un método del protocolo, así que nunca llegó a ninguna herramienta |

Lo reconocí por el campo de nivel superior de la respuesta: `result` con `isError` en el primer caso y `error` en el segundo. El error de ejecución está pensado para que lo lea el modelo, que puede corregir su siguiente intento. El de protocolo indica que el propio mensaje estaba mal formado o no existía.

## 6. Actividad D · Comparar dos clientes

| | Inspector | Cliente mínimo |
|---|---|---|
| Nombre y versión del cliente (`clientInfo`) | ✏️ | `cliente-minimo 1.0.0` |
| Versión del protocolo que propuso el cliente | ✏️ | `2025-06-18` |
| Versión del protocolo que respondió el servidor | ✏️ | ✏️ |
| Capacidades que declaró el cliente | ✏️ | ninguna (`{}`) |
| ¿El servidor envió una solicitud al cliente? ¿Cuál? | ✏️ | ✏️ |

✏️ *La tabla con tus datos reales está en la sección "Comparación" de `analisis.md`.*

**Por qué el servidor se comportó distinto:** en `initialize` cada lado declara lo que soporta, y ninguno debe usar algo que el otro no declaró. ✏️ *Ajusta lo siguiente a lo que observaste.* El Inspector declaró la capacidad `roots`: puede decirle al servidor cuáles son sus carpetas de trabajo. Por eso el servidor `filesystem`, después de inicializar, le envió la solicitud `roots/list` para conocerlas. Mi cliente declaró `capabilities: {}`, así que el servidor no le pidió nada y se quedó con la carpeta que recibió como argumento al arrancar (`.`). Las versiones también difieren porque cada cliente propuso la suya, y el servidor contestó con la que acordó para cada uno.

**Experimento con `protocolVersion: '1999-01-01'`:** ✏️ el servidor respondió con la versión `____`. Una versión que no conoce no hace que el servidor rechace la conexión: contesta con una versión que sí soporta (la más reciente), y es el cliente quien decide si puede trabajar con ella o debe desconectarse. Después restauré `'2025-06-18'` y volví a ejecutar el cliente, así que la traza final tiene otra vez los 13 mensajes de la actividad C.

![Experimento con una versión inexistente](evidencias/07_experimento_version.png)

## 7. Actividad E · Diagrama de secuencia

Sesión completa del cliente de la actividad C. Las notas separan las tres fases. El fondo **naranja** marca el error de ejecución de herramienta y el **rojo**, el error de protocolo.

```mermaid
✏️ pega aquí el diagrama que generó analisis.md, desde sequenceDiagram hasta la nota de Cierre
```

## 8. Problemas encontrados

✏️ Describe lo que te pasó. Ejemplos:
- *El Inspector tardó en pasar de Connecting a Connected:* era la primera descarga del servidor.
- *Mi interfaz del Inspector no coincide con las figuras de la guía:* describe la diferencia.
- *El orden del panel Messages es del más reciente al más antiguo:* lo invertí para la tabla.
- *Ruta con mi usuario en la traza:* la reemplacé por `TU_USUARIO` con `node scripts/anonimizar.mjs`. Bórralo si no lo hiciste.

Lo que verifiqué para estar segura:
- `salida/traza.jsonl` tiene 13 líneas, 7 del cliente y 6 del servidor, y el `initialize` final usa `2025-06-18`.
- La lectura correcta devuelve el CSV; la prohibida trae `isError: true`; el método inventado trae `error -32601`.
- El diagrama se dibuja en <https://mermaid.live> y en GitHub.
- `node scripts/verificar.mjs` termina sin errores.

## 9. Fuentes

- Especificación de MCP: <https://modelcontextprotocol.io/specification>
- Especificación de JSON-RPC 2.0: <https://www.jsonrpc.org/specification>
- MCP Inspector: <https://github.com/modelcontextprotocol/inspector>
- Servidor `filesystem`: <https://github.com/modelcontextprotocol/servers>
- Diagramas de secuencia en Mermaid: <https://mermaid.js.org/syntax/sequenceDiagram.html>
