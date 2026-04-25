# KBVS - Kampeonato de Batetaha de Velocidad de Skrìta

## 📋 Descripción General

**KBVS** es una plataforma de competencia de mecanografía en tiempo real diseñada para eventos masivos con múltiples jugadores simultáneos. Permite a los usuarios competir en pruebas de velocidad y precisión de escritura en un entorno conectado a través de una red local (WiFi) o internet.

El proyecto fue desarrollado con enfoque en rendimiento ultra-bajo-latencia para garantizar una experiencia competitiva justa, donde cada pulsación de tecla se transmite en tiempo real sin retrasos perceptibles.

---

## 🎯 Objetivos Principales

1. **Competencia en Tiempo Real:** Múltiples jugadores escribiendo simultáneamente con sincronización instantánea
2. **Bajo Latencia:** Protocolo optimizado para minimizar retrasos entre pulsaciones de tecla
3. **Modo Maestro:** Control centralizado donde un conductor/árbitro gestiona las rondas
4. **Juego Offline:** Funciona completamente sin conexión a internet, solo necesita WiFi local
5. **Análisis de Rendimiento:** Métricas detalladas de velocidad (WPM), precisión, errores y ranking

---

## 🏗️ Arquitectura Técnica

### Stack Tecnológico

- **Frontend:** Next.js 16 con React, TypeScript
- **Backend/WebSocket:** Node.js + ws (WebSocket library)
- **Base de Datos:** MySQL (para persistencia de puntajes/historial)
- **Styling:** Tailwind CSS con diseño moderno glassmorphic
- **Deployment:** Vercel (frontend), servidor local (WebSocket relay)

### ¿Por qué se eligieron estas tecnologías?

- **Next.js 16 + React:** permite construir interfaz rápida, rutas claras (`/master`, `/player`, `/clasificacion`) y mezclar rendering de servidor/cliente de forma controlada.
- **TypeScript:** evita muchos errores antes de ejecutar, especialmente en mensajes en tiempo real (`typing-update`, `room-snapshot`) y tipos compartidos entre cliente y servidor.
- **Node.js + ws (WebSocket):** ideal para comunicación bidireccional continua. En vez de hacer polling HTTP, el servidor y clientes quedan conectados y envían eventos al instante.
- **MySQL:** base sólida para guardar historial de partidas y calcular ranking con consultas agregadas (`SUM`, `AVG`, `COUNT`) de forma simple y confiable.
- **Tailwind CSS:** acelera diseño responsive y consistente sin escribir gran cantidad de CSS repetitivo.

### Ejemplificación por tecnología (simple y directa)

#### Next.js + React

- **Cómo se usa aquí:** cada rol tiene su vista/ruta (`/master`, `/player/[seat]`, `/clasificacion`).
- **Ejemplo real:** cuando el usuario entra a `/player/B?room=2461`, React monta la arena con el rol B y se conecta al relay.
- **Valor práctico:** separar por rutas hizo más fácil depurar errores de rol (A/B) sin romper toda la app.

#### TypeScript

- **Cómo se usa aquí:** los mensajes del socket tienen tipos estrictos (`join-room`, `typing`, `room-snapshot`, `typing-update`).
- **Ejemplo real:** si se envía `typingVersion` con tipo incorrecto, TypeScript avisa antes de ejecutar.
- **Valor práctico:** reduce errores sutiles en tiempo real, donde un campo mal escrito rompe sincronización.

#### WebSocket (`ws`)

- **Cómo se usa aquí:** conexión persistente entre cliente y relay para enviar/recibir cambios de escritura casi al instante.
- **Ejemplo real:** jugador A escribe "h", se manda evento `typing`, el relay actualiza sala y jugador B/maestro lo ven al momento.
- **Valor práctico:** evita polling cada segundo y reduce latencia percibida en competencia.

#### MySQL

- **Cómo se usa aquí:** guarda resultados de partidas y arma ranking agregado.
- **Ejemplo real:** al terminar la ronda se hace POST a `match-result`; luego `match-results` hace `GROUP BY player_name` y devuelve posiciones.
- **Valor práctico:** persistencia histórica para ranking real, no solo datos en memoria.

#### APIs HTTP

- **Cómo se usa aquí:** catálogo de textos y clasificación se consultan por endpoints REST.
- **Ejemplo real:** `GET /api/text-catalog` carga texto activo; `GET /api/admin/match-results` pinta tabla de clasificación.
- **Valor práctico:** desacopla frontend de base de datos y permite reusar datos desde otras vistas.

#### Tailwind CSS

- **Cómo se usa aquí:** layouts rápidos para maestro/jugador, tarjetas, estados visuales y responsive.
- **Ejemplo real:** ajustar 5-10 px de ancho de panel fue directo cambiando clases de grid.
- **Valor práctico:** iteración de UI muy rápida durante pruebas en dos dispositivos.

### Conceptualización Técnica (explicado fácil)

Piensa KBVS en 4 capas:

1. **Capa de Interfaz (Frontend):** muestra lo que ve el maestro y los jugadores.
2. **Capa de Tiempo Real (Relay WebSocket):** distribuye eventos de escritura y estado de sala.
3. **Capa de APIs HTTP:** endpoints para catálogo de textos y clasificación.
4. **Capa de Persistencia (MySQL):** guarda resultados históricos para leaderboard.

#### Relay WebSocket: ¿qué hace exactamente?

- Es un "orquestador" de salas.
- Cada cliente se une con `join-room` indicando rol (`master`, `A`, `B`).
- El relay mantiene un estado de sala en memoria (jugadores, texto activo, estado de partida, historial reciente).
- Cuando alguien escribe, recibe un `typing` y retransmite actualización a los demás.
- Cuando se cumple condición de victoria, marca partida como `finished` y publica snapshot final.

#### Relay WebSocket en 3 mini-escenas (ejemplos)

1. **Ingreso de sala**
    - Cliente envia: `{ type: "join-room", roomCode: "2461", role: "B", name: "Ocar" }`
    - Relay hace: marca `players.B.connected = true` y publica snapshot.
    - Resultado visible: maestro ve a B conectado en el panel compacto.

2. **Escritura en vivo**
    - Cliente envia: `{ type: "typing", playerId: "A", input: "hola", typingVersion: 12 }`
    - Relay hace: valida version, actualiza input de A y emite `typing-update`.
    - Resultado visible: en pantalla de B aparece avance de A en tiempo real.

3. **Fin de partida**
    - Relay detecta ganador (`winnerFromSnapshot`) y cambia estado a `finished`.
    - Cliente guarda resultado por API (`POST /api/admin/match-result`).
    - Clasificación consulta agregado (`GET /api/admin/match-results`).
    - Resultado visible: ganador y estadisticas ya aparecen en leaderboard.

#### ¿Por qué usar WebSocket y no solo API REST?

- REST es excelente para operaciones puntuales (guardar/consultar datos), pero no para flujos de milisegundos.
- WebSocket evita pedir datos cada segundo; empuja cambios instantáneamente.
- Resultado: menor latencia percibida y mejor sensación competitiva.

#### API REST vs Relay WebSocket (resumen conceptual)

- **Relay WebSocket:** "canal continuo" para eventos de milisegundos (teclas, estado live).
- **API REST:** "operaciones puntuales" para leer/guardar datos (catalogo, ranking, admin).
- **Combinación en KBVS:** WebSocket para jugar, REST para persistir y consultar.

#### APIs usadas en el proyecto (rol conceptual)

- **`/api/text-catalog`**: devuelve textos activos para jugar.
- **`/api/admin/match-result`**: guarda resultado al terminar una partida.
- **`/api/admin/match-results`**: devuelve clasificación agregada para mostrar ranking.
- **`/api/admin/texts` y `/api/admin/text-difficulty`**: administración de contenidos y dificultad.

#### Flujo de datos de extremo a extremo

1. Maestro arranca sala y selecciona texto.
2. Jugadores A/B escriben en sus clientes.
3. Cliente envía `typing-update` al relay.
4. Relay valida y publica actualización al resto.
5. Al finalizar, cliente/API guarda resultados en MySQL.
6. Vista de clasificación consulta API y renderiza ranking actualizado.

#### Consistencia de datos en tiempo real

Para evitar desorden de mensajes:

- Cada jugador tiene `typingVersion` incremental.
- Si llega un paquete viejo, se descarta.
- Se prioriza estado más nuevo sin pisar progreso válido.

#### Resiliencia y operación local

- Si el puerto del relay ya está ocupado, el sistema detecta instancia existente y evita duplicar servicio.
- Se permite uso en LAN sin internet (misma red WiFi), ideal para demos y eventos escolares.
- La resolución de URL WebSocket se adapta al host local para simplificar conexión entre dispositivos.

### Puntos en contra (trade-offs reales)

- **Estado en memoria del relay:** si el proceso se reinicia, se pierde estado de sala en curso.
- **Acoplamiento a red local en demo:** en entornos con firewall estricto puede requerir apertura de puertos.
- **Complejidad de sincronización:** tiempo real implica casos borde (paquetes fuera de orden, reconexiones).
- **Dependencia de calidad de WiFi:** la experiencia puede degradar con redes saturadas.
- **UI con animaciones continuas:** en equipos modestos puede impactar rendimiento si no se pausan efectos.

### Mejoras recomendadas (priorizadas)

1. **Persistir estado de sala en Redis** para tolerar reinicios del relay.
2. **Autenticación simple por sala** (token corto) para evitar accesos no deseados.
3. **Idempotencia en guardado de resultados** con `match_id` unico por ronda.
4. **Métricas de red/latencia** (RTT, jitter) visibles para diagnóstico en vivo.
5. **Modo degradado visual** (animaciones reducidas) para hardware lento.
6. **Escalado horizontal** del relay con broker (Redis pub/sub) si crecen salas simultáneas.
7. **Pruebas E2E multi-cliente** automatizadas para validar A/B, reconexión y leaderboard.

### Componentes Principales

#### 1. **Vista Maestro** (`/master`)
- Panel de control para conductores/árbitros
- Iniciar/resetear rondas
- Seleccionar textos de competencia
- Ver estado en vivo de ambos jugadores
- Carrusel de sponsors

#### 2. **Vista Jugador** (`/player/A` y `/player/B`)
- Interfaz de escritura con validación en tiempo real
- Visualización del texto objetivo con resaltado de progreso
- Indicador de conexión (conectado/desconectado)
- Métricas en vivo: velocidad, errores, precisión
- Carrusel de sponsors

#### 3. **Leaderboard** (`/clasificacion`)
- Ranking histórico de jugadores
- Filtrado por nivel de habilidad (novato, aprendiz, competente, experto, maestro, leyenda)
- Tabla de clasificación con puntos, WPM, precisión
- Galería de sponsors destacados

#### 4. **Relay WebSocket** (`scripts/typing-ws-server.ts`)
- Servidor Node.js que sincroniza estado en tiempo real
- Maneja múltiples salas simultáneamente
- Detección de duplicados con reuso de puerto (EADDRINUSE handling)
- TCP_NODELAY para latencia ultra-baja
- Protocolo de mensajes livianos para typing-updates

---

## 🎮 Flujo de Juego

### Fase de Configuración
1. **Maestro** inicia en `/master?room=XXXX`
2. **Jugadores** entran en `/player/A` o `/player/B` con el código de sala
3. Se establece conexión WebSocket con el relay

### Fase de Cuenta Regresiva
1. Maestro selecciona un texto del catálogo
2. Se envía a ambos jugadores (room snapshot)
3. Cuenta regresiva: 3, 2, 1... ¡YA!

### Fase de Competencia (LIVE)
1. Ambos jugadores escriben simultáneamente
2. Cada pulsación se envía en tiempo real (typing-update)
3. Validación de caracteres en el servidor
4. Cálculo en vivo de WPM, errores, precisión
5. Actualización del estado visual en ambos clientes

### Fase de Resultados
1. Primer jugador que completa el texto gana
2. Muestra ranking: 1º, 2º (con puntos bonificados)
3. Opción de reiniciar para nueva ronda
4. Historial se guarda en base de datos

---

## ⚡ Optimizaciones de Latencia

### 1. **Protocolo Ligero**
- En lugar de enviar snapshot completo (~2KB) por cada keystroke
- Se envía `typing-update` (~100 bytes): `{playerId, input, typingVersion, updatedAt}`
- Reducción del ~95% en bytes transmitidos

### 2. **TCP_NODELAY**
- Socket WebSocket configurado con `setNoDelay(true)`
- Desactiva algoritmo de Nagle en capa de transporte
- Evita buffering innecesario

### 3. **RAF Queueing**
- Batching de pulsaciones por frame (requestAnimationFrame)
- En display 60Hz = ~16ms por frame
- Agrupa múltiples keystroke en 1 mensaje por frame
- Reduce overhead de frames vacíos

### 4. **Memoización de Renders**
- Texto resaltado pre-computado con useMemo
- Evita recalcular spans DOM en cada estado
- Buffering de updates remotos para no interrumpir escritura local

### 5. **Per-Player Versioning**
- Cada jugador tiene `typingVersion` incremental
- Cliente rechaza snapshots "viejos" que lleguen fuera de orden
- Garantiza consistencia sin reconexiones

---

## 🌐 Configuración LAN (Offline)

### Requisitos
- Dos o más máquinas en la **misma red WiFi**
- **No requiere internet** entre ellas
- Necesita un "host" ejecutando `npm run dev`

### Pasos para Jugar
1. En la PC anfitriona: `npm run dev`
2. Encuentre la IP local del host (ej: `192.168.1.100`)
3. En segunda PC, abra: `http://192.168.1.100:3000/player/A`
4. El maestro accede a: `http://192.168.1.100:3000/master?room=7868`

### Configuración Automática
- `next.config.ts` acepta IPs privadas: `10.*.*.*`, `172.*.*.*`, `192.168.*.*`, `*.local`
- `typing-ws-url.ts` resuelve automáticamente hostname del navegador
- Sin necesidad de configuración manual de IPs

---

## 📊 Métricas y Puntuación

### Cálculo de WPM (Palabras Por Minuto)
```
WPM = (caracteres correctos / 5) / minutos_transcurridos
```

### Precisión
```
Precisión = (caracteres correctos / total de caracteres) × 100%
```

### Sistema de Puntos (Skill Tier)
- **Novato:** 0-100 puntos
- **Aprendiz:** 101-300 puntos
- **Competente:** 301-600 puntos
- **Experto:** 601-1000 puntos
- **Maestro:** 1001-1500 puntos
- **Leyenda:** 1501+ puntos

### Bonificación de Victoria
- 1er lugar: +100 puntos + (WPM / 10)
- 2do lugar: +50 puntos + (WPM / 20)

---

## 🎨 Características Visuales

- **Diseño Glassmorphic:** Bordes redondeados, fondo translúcido, blur backdrop
- **Tema Oscuro/Claro:** Soporta preferencia del sistema
- **Responsive:** Optimizado para móviles, tablets, desktops
- **Animaciones Fluidas:** Transiciones con Tailwind, marquee para sponsors
- **Indicadores en Tiempo Real:** Colores de conexión, estado de escritura, progreso

---

## 🔐 Seguridad y Validación

- **Código de Sala:** Almacenado en URL para acceso compartido
- **Validación de Entrada:** Servidor valida cada keystroke contra el texto esperado
- **Prevención de Duplicados:** No se permiten salas con mismo código activo
- **Timeout de Conexión:** Desconexión automática después de inactividad
- **CORS Configurado:** Solo acepta orígenes de red local

---

## 📁 Estructura de Archivos Clave

```
src/
├── app/
│   ├── master/          # Vista del conductor
│   ├── player/          # Vista del jugador
│   ├── clasificacion/   # Leaderboard público
│   └── api/             # Endpoints de admin y catálogo
├── components/
│   ├── typing-arena.tsx      # Arena de juego principal
│   ├── leaderboard-view.tsx  # Tabla de clasificación
│   └── role-shell.tsx        # Contenedor compartido
└── lib/
    ├── typing-room.ts       # Lógica de salas y puntuación
    ├── typing-ws-url.ts     # Resolución de WebSocket URL
    └── text-catalog.ts      # Gestor de textos de competencia

scripts/
└── typing-ws-server.ts  # Servidor WebSocket relay

database/
└── KBVS.mwb           # Modelo MySQL
```

---

## 🚀 Inicio Rápido para Desarrollo

```bash
# Clonar y dependencias
git clone [repo]
cd KBVS
npm install

# Iniciar servidores de desarrollo
npm run dev
# Inicia Next.js (puerto 3000) + WebSocket (puerto 8787)

# Linter y validación
npm run lint

# Build para producción
npm run build

# Start producción
npm start
```

---

## 🎓 Lecciones de Ingeniería Aplicadas

### 1. **Real-Time Synchronization**
- Versionamiento por jugador para manejo de mensajes fuera de orden
- Snapshots de estado para recuperación
- Validación en servidor para autoridad

### 2. **Network Optimization**
- Diferenciación de mensajes por peso (typing-update vs snapshot)
- Batching de paquetes con RAF
- TCP_NODELAY para latencia ultra-baja

### 3. **React Performance**
- Memoización de renders costosos
- Refs para estado que no requiere rerender
- useCallback para estabilizar dependencias de hooks

### 4. **Local Area Network Dev**
- Wildcard patterns en CORS para flexibilidad de IP
- Resolución automática de hostname
- Soporte offline sin internet

### 5. **TypeScript Type Safety**
- Tipos compartidos (ClientMessage, ServerMessage)
- Discriminated unions para manejo de eventos
- Strict null checks

---

## 📝 Casos de Uso

- **Competencias Escolares:** Torneos de mecanografía en aulas
- **Eventos Corporativos:** Team building competitivo
- **Espectáculos Públicos:** Campeonatos en vivo con público
- **Entrenamiento de Escritura:** Seguimiento de progreso en tiempo real
- **Gamificación Educativa:** Aprendizaje de idiomas mediante typing races

---

## 🔮 Mejoras Futuras

- [ ] Soporte para +2 jugadores simultáneamente
- [ ] Poder guardar historial de partidas en BD
- [ ] Replay de partidas (grabación de keystrokes)
- [ ] Multiplayer global (internet, no solo LAN)
- [ ] Sistema de logros y badges
- [ ] Modo práctica con IA
- [ ] Integración con teclados mecánicos RGB (notificaciones)
- [ ] Análisis de patrones de error (dactilografía)

---

## 🎤 Guion de Presentación (Fácil de Exponer)

Esta sección está pensada para presentar KBVS en clase, demo técnica o evento.

### 1. Apertura (30-45 segundos)

**Presentador:**
"Hoy les presentamos KBVS, un sistema de competencias de mecanografía en tiempo real. Dos jugadores escriben al mismo tiempo, un maestro controla la ronda, y todo se sincroniza por WebSocket con baja latencia."

**Presentador:**
"Lo más interesante es que funciona en red local, incluso sin internet. Es ideal para ferias, torneos escolares y demostraciones en vivo."

### 2. Problema que Resuelve

**Presentador:**
"Normalmente, los juegos de mecanografía no están diseñados para competencia local en tiempo real con control de árbitro. KBVS resuelve eso con tres vistas: maestro, jugador y clasificación."

### 3. ¿Cómo Funciona? (Explicación simple)

1. El maestro crea/abre una sala.
2. Jugador A y Jugador B entran con el código de sala.
3. El maestro selecciona el texto y lanza cuenta regresiva.
4. Durante la partida, cada tecla se transmite en tiempo real.
5. Al terminar, se calcula ganador, precisión, WPM y se guarda resultado.
6. La clasificación se actualiza consultando la base de datos.

### 4. Diálogo de Demo en Vivo

**Presentador:**
"Ahora vamos a iniciar una ronda. En esta pantalla está la vista maestro. Aquí elijo el texto y presiono Empezar."

**Operador Demo:**
"Jugadores conectados en A y B. Inicia la cuenta regresiva en 3, 2, 1..."

**Presentador:**
"Noten cómo ambos progresos cambian en paralelo. Esto viaja por WebSocket y se renderiza casi al instante."

**Operador Demo:**
"Finaliza la ronda. El sistema guarda los resultados y podemos verlos en clasificación."

**Presentador:**
"Aquí aparece el ganador y su rendimiento agregado."

### 5. Fragmentos de Código para Mostrar (y Explicar)

#### a) Envío de escritura en vivo

```ts
send({
    type: "typing",
    playerId: activePlayerId,
    input: pendingTyping.input,
    typingVersion: pendingTyping.typingVersion,
});
```

Explicación para decir:
"Cada actualización de escritura se envía con versión para evitar que lleguen datos viejos y sobrescriban datos nuevos."

#### b) Guardado de resultado al finalizar

```ts
await fetch("/api/admin/match-result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerName, wpm, accuracy, errors, matchTime, winner }),
});
```

Explicación para decir:
"Cuando la partida termina, se persiste el resultado y luego el leaderboard consulta esos datos agregados."

#### c) Consulta de leaderboard

```sql
SELECT player_name, SUM(wpm) AS total_wpm, AVG(accuracy) AS avg_accuracy,
             COUNT(*) AS matches, SUM(CASE WHEN winner = 1 THEN 1 ELSE 0 END) AS wins
FROM match_results
GROUP BY player_name
ORDER BY wins DESC, avg_accuracy DESC, total_wpm DESC;
```

Explicación para decir:
"La clasificación no es estática, se calcula por rendimiento acumulado real."

### 6. Puntos Curiosos para Mencionar

- Funciona en LAN sin internet, útil para lugares con conectividad limitada.
- Soporta detección de puertos ocupados en WebSocket para evitar caída por duplicados.
- Usa animación y UI en tiempo real, pero con optimizaciones para no bloquear escritura.
- La arquitectura separa claramente: interfaz, lógica de juego, relay WebSocket y APIs.
- El sistema puede usarse como base para torneos, eSports educativos o entrenamiento.

### 7. Tecnologías Utilizadas (para decir en una sola diapositiva)

- Next.js 16 + React + TypeScript
- WebSocket (`ws`) para sincronización en tiempo real
- MySQL para persistencia de resultados
- Tailwind CSS para diseño responsivo
- Node.js para el relay y endpoints de administración

### 8. Preguntas Frecuentes en Exposición (con respuesta rápida)

**Pregunta:** "¿Necesita internet para jugar?"
**Respuesta:** "No. Puede jugarse 100% en red local WiFi."

**Pregunta:** "¿Cómo evitan inconsistencias?"
**Respuesta:** "Con versionado de escritura (`typingVersion`) y validación de estado en servidor."

**Pregunta:** "¿El ranking se guarda?"
**Respuesta:** "Sí, en MySQL, y la vista de clasificación consulta esos datos en tiempo real."

### 9. Cierre de Presentación

**Presentador:**
"KBVS combina competencia en tiempo real, analítica de rendimiento y operación local offline. Es una solución práctica, escalable y lista para eventos educativos o competitivos."

---

## 👨‍💻 Créditos y Auspiciadores

Gracias a los sponsors que han hecho posible este proyecto:

- Dicosta
- Kaa Soft
- La Fortuna
- SG Creaciones
- Sin Fronteras
- Silvi Modas
- Sericentro Tajy
- Pizzería Campeonato
- Montaña Sierra
- MD Veterinaria
- MabuPlay
- Lapachos
- JT Consulting
- DRV Seguros
- Agrope Santarita

---

## 📞 Contacto y Soporte

Para preguntas, sugerencias o reportar bugs:
- GitHub Issues: [repo]/issues
- Email: [contact info]
- Discord: [server link]

---

**Última actualización:** Abril 2026  
**Versión:** 1.0.0  
**Estado:** En desarrollo y testing de LAN
