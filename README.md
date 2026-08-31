# Sara Modo Maestro v0.1.0

Sara es una asistente argentina personal que corre en Electron con voz (Deepgram TTS) y cerebro (Longcat-2.0 free vía Nous).

## Requisitos

- Node.js (v18+)
- npm
- Cuenta en Nous Portal (proxy local corriendo en puerto 8645)
- API Key de Deepgram con modelo `aura-2-agustina-es`

## Instalación

```bash
git clone https://github.com/MaritoAkd/sara-master.git
cd sara-master
npm install
```

## Configuración

Creá un archivo `.env` en `~/.hermes/` con:

```
DEEPGRAM_API_KEY=tu-key-deepgram
```

Para el proxy de Hermes:

```bash
hermes proxy start
```

## Uso

```bash
npm start
```

O hacé doble click en `SaraModoMaestro.bat`.

## ¿Qué hace?

- **Ventana principal** con un reactor azul central y partículas flotando
- **Input de texto** (escribí y apretá Enter)
- **Voz continua** (decí "Sara..." y el comando)
- **Reproduce respuestas** de Deepgram con lip-sync en el núcleo
- **Feed de noticias** (Google News RSS)
- **Lector de artículos** (hacé click en una nota)
- **Estadísticas del sistema** (CPU, RAM, tokens, uptime)
- **Atajo Ctrl+Alt+S** para cerrar

## Versión web (celular)

Desde otra PC en la misma WiFi: `http://TU-IP:8765`

## Cambios en v0.1

- Avatar Live2D (Haru) reemplazado por reactor CSS puro + partículas
- Voz de Agustina (Deepgram) reemplazando a Celeste
- Cerebro Longcat-2.0 free (Nous) con fallback a OpenRouter
- Eliminado todo el formato de chat (sin globos, sin log, sin emojis)
- Input simple y directo
- Sin avatar femenino — solo energía/partículas

## Roadmap (pendiente)

- [ ] Subtítulos visibles mientras habla
- [ ] Animación del avatar mientras escucha (pulso en partículas)
- [ ] Atajo de voz activado por "Sara..." que funcione sin escribir
- [ ] Indicador visual de "pensando" vs "hablando"
- [ ] Mejor soporte de errores y reconexión
- [ ] Personalización de temas/colores
- [ ] Integración con control de TV vía ADB

## Autor

MaritoAkd — [@MaritoAkd](https://github.com/MaritoAkd)
