# Monitor Ambiental UV

Aplicación de escritorio desarrollada con Electron, React, TypeScript y MariaDB para monitorear un prototipo físico de radiación ultravioleta y variables ambientales.

El sistema recibe datos reales desde Arduino mediante puerto serial, permite iniciar sesiones de captura, almacenar mediciones en MariaDB, consultar historial y generar reportes agrupados en PDF y CSV.

## Tecnologías utilizadas

- Electron
- React
- TypeScript
- Vite
- Tailwind CSS
- SerialPort
- MariaDB
- mysql2
- Arduino

## Sensores del prototipo

El prototipo trabaja con:

- Sensor UV analógico
- Sensor de luminosidad BH1750
- Sensor ambiental BME280
- RTC DS3231
- Sensor PIR de presencia
- LCD I2C
- LEDs de alerta
- Buzzer

## Requisitos previos

Antes de ejecutar el proyecto, instalar:

- Node.js
- npm
- MariaDB Server
- Arduino IDE, solo para cargar el código al prototipo

Verificar instalación:

```bash
node --version
npm --version
npm install mysql2 serialport react-router-dom