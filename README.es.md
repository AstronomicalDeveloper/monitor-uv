<div align="center">

[English](README.md) | [Español](README.es.md)

# ☀️ Monitor UV

**Sensores ambientales, visualización en tiempo real y reportes de sesiones en una aplicación de escritorio.**

![Electron](https://img.shields.io/badge/Electron-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Arduino](https://img.shields.io/badge/Arduino-00979D?logo=arduino&logoColor=white)
![MariaDB](https://img.shields.io/badge/MariaDB-003545?logo=mariadb&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)

**UNMSM · Arquitectura de Computadoras · Proyecto universitario**

</div>

---

## ¿Qué es Monitor UV?

Monitor Ambiental UV conecta un prototipo Arduino con una interfaz de escritorio para explorar mediciones ambientales: desde la lectura de sensores hasta el historial de sesiones y sus reportes.

Desarrollado como trabajo grupal del curso de **Arquitectura de Computadoras** de la **Universidad Nacional Mayor de San Marcos**, el proyecto integra hardware, comunicación serial, almacenamiento y visualización. Se presenta como un proyecto académico de portafolio.

> **Sobre la medición UV:** el ADC, el voltaje y los niveles BAJO/MEDIO/ALTO del prototipo no equivalen por sí solos a un índice UV calibrado. La interpretación de los datos requiere conocer el sensor y su calibración.

## Funcionalidades principales

| Funcionalidad               | Qué permite hacer                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Adquisición de sensores** | Listar, probar y conectar puertos a 9600 baudios; recibir UV, luminosidad, temperatura, humedad, presión, presencia y fecha del prototipo. |
| **Visualización**           | Consultar las lecturas recibidas y su evolución mediante indicadores y gráficos.                                                           |
| **Sesiones e historial**    | Crear capturas manuales o temporizadas, configurar el intervalo de almacenamiento y consultar mediciones y estadísticas en MariaDB.        |
| **Reportes PDF/CSV**        | Seleccionar una o varias sesiones y exportar reportes agrupados mediante un diálogo de guardado.                                           |

---

## Arquitectura y tecnologías

La adquisición y la base de datos se gestionan en el proceso principal de Electron. La interfaz React accede a funciones específicas mediante el preload y mensajes IPC.

| Capa                           | Tecnologías y responsabilidad                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| **Prototipo**                  | Arduino y sensores: adquisición de variables ambientales y envío por USB/serial.                       |
| **Proceso principal**          | Electron, Node.js, TypeScript y SerialPort: conexión, procesamiento de lecturas y gestión de sesiones. |
| **Puente entre procesos**      | Preload con `contextBridge` e IPC: funciones específicas, aislamiento de contexto y sandbox.           |
| **Interfaz**                   | React, React Router y Tailwind CSS: conexión, monitoreo, historial y reportes.                         |
| **Persistencia y exportación** | MariaDB con mysql2; generación CSV y PDF mediante `printToPDF` de Electron.                            |
| **Desarrollo**                 | electron-vite/Vite, TypeScript, ESLint y pruebas con `node:test`.                                      |

### Componentes del prototipo

La documentación del proyecto describe un sensor UV analógico, un BH1750 de luminosidad, un BME280 ambiental, un RTC DS3231 y un sensor PIR de presencia, además de LCD I2C, LEDs y buzzer.

El firmware, el cableado, los modelos exactos de placa y sensor UV y su calibración **no están versionados**. La [guía de instalación](docs/setup.es.md#formato-serial) documenta el formato esperado por el receptor de escritorio.

## Ejecutar localmente

**Requisitos:** Node.js 22.12 o posterior compatible con las dependencias, npm, MariaDB Server con InnoDB y el prototipo con sus controladores USB/serial para capturas físicas. Arduino IDE solo es necesario para cargar o modificar el firmware.

1. Clonar el proyecto e instalar las dependencias:

   ```bash
   git clone https://github.com/AstronomicalDeveloper/monitor-uv.git
   cd monitor-uv
   npm ci
   ```

2. Seguir la [configuración de MariaDB y del JSON local](docs/setup.es.md#configurar-mariadb). Utilizar [database.example.json](database.example.json) como plantilla y definir `MONITOR_UV_DB_CONFIG` con la ruta al archivo privado.

3. Ejecutar la aplicación:

   ```bash
   npm run dev
   ```

4. Probar la conexión a MariaDB desde la interfaz, conectar el prototipo y crear una captura. Cerrar el monitor serial de Arduino IDE antes de abrir el mismo puerto desde Monitor UV.

En PowerShell con ejecución de scripts restringida, utilizar `npm.cmd`. Para configuración detallada, pruebas, compilación e instaladores, consultar la [guía de instalación y desarrollo](docs/setup.es.md).

---

## Estado y limitaciones

La autora reportó una prueba manual de la aplicación con MariaDB y la conservación de las mediciones históricas. Esta validación es independiente de las pruebas automatizadas y no confirma todos los escenarios de hardware ni el funcionamiento de un instalador en otro equipo.

- **Requiere MariaDB disponible.** No hay almacenamiento offline; las muestras recibidas mientras existe una escritura pendiente no se acumulan.
- **La validación física sigue siendo necesaria.** Comprobar sensores, protocolo y calibración con el firmware real antes de interpretar resultados. Un cierre forzado o una caída de MariaDB puede dejar una sesión activa.
- **Los reportes se procesan en memoria.** Exportaciones muy grandes pueden requerir paginación o procesamiento por flujo.
- **Las fechas conservan el comportamiento local.** La recepción se guarda en hora local del equipo y la fecha del RTC como texto; no hay normalización entre zonas horarias.
- **La distribución requiere pruebas propias.** El instalador Windows no está firmado; macOS y Linux cuentan con scripts, pero requieren validación en esos sistemas. No hay actualizaciones automáticas configuradas.

Antes de distribuir una nueva compilación, revisar los avisos de dependencias con `npm audit`. Las pruebas automatizadas no sustituyen las pruebas de integración física.

## Créditos académicos

Trabajo grupal de la **Universidad Nacional Mayor de San Marcos**.

| Participación                                                                                      | Contribución                                                                                                                         |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Landry Bardales Guadalupe** · [@AstronomicalDeveloper](https://github.com/AstronomicalDeveloper) | Desarrollo técnico del software; programación e integración de Arduino y sensores; base de datos, pruebas e integración del sistema. |
| **Otros integrantes del grupo**                                                                    | Participación en la presentación física del prototipo.                                                                               |

## Licencia

Distribuido bajo la [licencia MIT](LICENSE).
