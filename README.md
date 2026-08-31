# Sara Modo Maestro v0.1.0

Sara es una asistente argentina personal que corre en Electron con voz (Deepgram TTS) y cerebro (IA vía Nous).

---

## ⚠️ Importante: Cada uno necesita sus propias API Keys

Este proyecto **no incluye** las claves de API. Para usarlo necesitás:

1. **Nous Portal** (proxy local) — para el modelo de lenguaje
2. **Deepgram** — para la voz TTS

---

## Requisitos

- Node.js (v18+)
- npm
- Cuenta en [Nous Portal](https://nousresearch.com) (gratis)
- Cuenta en [Deepgram](https://deepgram.com) (gratis, con créditos iniciales)

## Instalación

```bash
git clone https://github.com/MaritoAkd/sara-master.git
cd sara-master
npm install
```

## Configuración

### 1. Configurá `apis.json` (sin tocar código)

El proyecto usa `apis.json` para centralizar todas las claves y configuraciones. **Este archivo no se sube a git** (está en `.gitignore`).

Creá el archivo `apis.json` en la raíz del proyecto:

```json
{
  "deepgram": "tu-key-deepgram",
  "nous": "tu-key-de-nous",
  "nombre_usuario": "Tu Nombre",
  "modelo_voz": "aura-2-agustina-es",
  "modelo_cerebro": "meituan/longcat-2.0:free",
  "modelo_fallback": "openrouter/auto"
}
```

**Qué hace cada campo:**

| Campo | Qué hace | Opciones |
|-------|----------|----------|
| `deepgram` | API Key de Deepgram (TTS) | La creás en [deepgram.com](https://deepgram.com) |
| `nous` | API Key de Nous Portal | La creás en [nousresearch.com](https://nousresearch.com) |
| `nombre_usuario` | Tu nombre en el prompt de Sara | El que quieras |
| `modelo_voz` | Voz de Deepgram | `aura-2-agustina-es` (argentina), `aura-2-celeste-es` (mexicana), `aura-2-selena-es` (latinoamericana) |
| `modelo_cerebro` | Modelo de lenguaje principal | `meituan/longcat-2.0:free`, `google/gemma-4-31b-it:free`, etc. |
| `modelo_fallback` | Modelo si falla el principal | `openrouter/auto` |

> **Nota:** Si no creás `apis.json`, el sistema cae al archivo `.env` de siempre (`~/.hermes/.env`).

### 2. Proxy de Nous

```bash
hermes proxy start
```

Deja el proxy corriendo en `http://127.0.0.1:8645`.

### 3. Listo

```bash
npm start
```

O hacé doble click en `SaraModoMaestro.bat` (Windows).

---

## ¿Qué hace?

- **Ventana principal** con un reactor azul central y partículas flotando
- **Input de texto** (escribí y apretá Enter)
- **Voz continua** (decí "Sara..." y el comando)
- **Reproduce respuestas** de Deepgram con lip-sync (el núcleo pulsa con el audio)
- **Feed de noticias** (Google News RSS)
- **Lector de artículos** (hacé click en una nota)
- **Estadísticas del sistema** (CPU, RAM, tokens, uptime)
- **Atajo Ctrl+Alt+S** para cerrar

---

## Versión web (celular)

Desde otra PC en la misma WiFi: `http://TU-IP:8765`

---

## Cambios en v0.1

- Avatar Live2D (Haru) reemplazado por reactor CSS puro + partículas
- Voz de Agustina (Deepgram) reemplazando a Celeste
- Cerebro Longcat-2.0 free (Nous) con fallback a OpenRouter
- Eliminado todo el formato de chat (sin globos, sin log, sin emojis)
- Input simple y directo
- Sin avatar femenino — solo energía/partículas
- Configuración centralizada en `apis.json` (no tocar código)

---

## Roadmap (pendiente)

- [ ] Subtítulos visibles mientras habla
- [ ] Animación del avatar mientras escucha (pulso en partículas)
- [ ] Atajo de voz activado por "Sara..." que funcione sin escribir
- [ ] Indicador visual de "pensando" vs "hablando"
- [ ] Mejor soporte de errores y reconexión
- [ ] Personalización de temas/colores
- [ ] Integración con control de TV vía ADB

---

## Autor

MaritoAkd — [@MaritoAkd](https://github.com/MaritoAkd)
