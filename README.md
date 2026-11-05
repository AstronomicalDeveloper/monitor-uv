# Monitor Ambiental UV

Aplicación de escritorio para recibir mediciones de un prototipo Arduino por puerto serial, visualizar variables ambientales y almacenar sesiones en MariaDB. Permite consultar el historial y generar reportes agrupados en PDF y CSV.

Proyecto académico grupal del curso de Arquitectura de Computadoras de la Universidad Nacional Mayor de San Marcos (UNMSM). Su objetivo es integrar adquisición de sensores, comunicación con una aplicación de escritorio, persistencia y presentación de resultados.

## Funcionalidades

- Listado, prueba, conexión y desconexión de puertos seriales a 9600 baudios.
- Visualización de ADC y voltaje UV, nivel BAJO/MEDIO/ALTO, luminosidad, temperatura, humedad, presión, presencia y fecha del prototipo.
- Capturas manuales y temporizadas, con intervalos configurables de almacenamiento.
- Historial de sesiones, detalle de mediciones, estadísticas y gráficos.
- Selección de sesiones para reportes agrupados y exportación PDF/CSV mediante diálogo de guardado.

Estas funciones están implementadas en el código. La integración física requiere verificar Arduino y MariaDB en el equipo de destino. El voltaje UV y el nivel del prototipo no equivalen por sí solos a un índice UV calibrado.

## Tecnologías

Electron, React, TypeScript, electron-vite/Vite, Tailwind CSS, React Router, SerialPort y mysql2 para conexión con MariaDB. La exportación PDF utiliza `printToPDF` de Electron.

## Prototipo

Componentes descritos en la documentación original: Arduino, sensor UV analógico, BH1750 de luminosidad, BME280 ambiental, RTC DS3231, sensor PIR de presencia, LCD I2C, LEDs de alerta y buzzer. El receptor implementa los campos correspondientes a las mediciones; el firmware, modelos exactos de placa/sensor UV, cableado y calibración no están versionados en este repositorio.

El formato actualmente esperado es un ciclo de líneas como este:

```text
UV ADC: 100 | Voltaje: 0.489 V
Nivel: BAJO
Luz: 120.0 lux
Temperatura: 25.0 C
Humedad: 60.0 %
Presion: 1013.0 hPa
Presencia: NO DETECTADA
Fecha y hora: 2026-11-04 12:00:00
```

El encabezado UV inicia el ciclo y `Fecha y hora` lo termina. Los campos intermedios pueden llegar en distinto orden. Se descartan ciclos incompletos, duplicados, con números no finitos o de más de diez segundos, para evitar mezclar lecturas. El ejemplo describe el receptor; verificar el contrato con el firmware antes de modificar el protocolo.

## Requisitos

- Node.js 22 LTS (22.12 o posterior) o una versión compatible con las dependencias, y npm.
- MariaDB Server con tablas InnoDB y una cuenta de aplicación.
- Puerto USB/serial y controladores de la placa para las pruebas físicas.
- Arduino IDE solo si se necesita cargar o modificar el firmware.
- En Windows, herramientas de compilación nativa si SerialPort no dispone de un binario compatible. Usar una ruta sin espacios si node-gyp presenta problemas.

## Configuración de MariaDB

1. Con una cuenta administradora, ejecutar [src/main/database/schema.sql](src/main/database/schema.sql) en MariaDB. Crea la base `monitor_uv`, sus tablas e índices; no crea usuarios ni modifica contraseñas.
2. Crear una cuenta dedicada con contraseña propia. Para usar la aplicación bastan permisos `SELECT`, `INSERT` y `UPDATE` sobre `monitor_uv.*`. No usar una cuenta administradora en la aplicación.
3. Copiar [database.example.json](database.example.json) como `database.json`, completar los datos locales y asignar una contraseña real a la cuenta y al archivo. No versionar ese archivo.
4. Elegir una ubicación externa al código y al instalador. De forma predeterminada se busca `database.json` en `app.getPath('userData')`; en Windows corresponde a una carpeta dentro de `%APPDATA%` con el nombre de la aplicación (`monitor-uv` en desarrollo; el nombre puede variar en distribución). Para una ubicación explícita y estable, definir `MONITOR_UV_DB_CONFIG` con la ruta absoluta al JSON antes de iniciar.

El archivo privado también puede llamarse `database.local.json`: está excluido por `.gitignore`, pero `MONITOR_UV_DB_CONFIG` debe apuntar expresamente a él. La aplicación no busca ese nombre automáticamente; sin la variable utiliza únicamente `database.json` en los datos de usuario.

Para crear el esquema desde el cliente MariaDB, abrir una sesión administrativa con `mariadb -h 127.0.0.1 -u <administrador> -p` desde la raíz del proyecto y ejecutar:

```sql
SOURCE src/main/database/schema.sql;
SHOW TABLE STATUS FROM monitor_uv;
```

Comprobar que ambas tablas usan InnoDB. `CREATE TABLE IF NOT EXISTS` no convierte tablas antiguas de otro motor; revisar y respaldar una base existente antes de migrarla. El código no importa el esquema automáticamente.

Ejemplo en PowerShell desde el proyecto, con un archivo privado ubicado en la carpeta del usuario:

```powershell
$privateDirectory = Join-Path $env:USERPROFILE 'monitor-uv-private'
New-Item -ItemType Directory -Path $privateDirectory -Force
$privateConfig = Join-Path $privateDirectory 'database.json'
if (-not (Test-Path -LiteralPath $privateConfig)) {
  Copy-Item database.example.json $privateConfig
}
# Editar el JSON y completar la contraseña nueva antes de ejecutar la aplicación.
$env:MONITOR_UV_DB_CONFIG = "$env:USERPROFILE\monitor-uv-private\database.json"
npm.cmd run dev
```

La copia del ejemplo es un paso inicial: no sobrescribir un JSON ya configurado. En Windows, para conservar la ruta entre sesiones se puede establecer la variable del usuario con `[Environment]::SetEnvironmentVariable('MONITOR_UV_DB_CONFIG', $env:MONITOR_UV_DB_CONFIG, 'User')` y abrir de nuevo la aplicación o la terminal. Esto guarda la ruta, no la contraseña.

La variable solo indica la ruta: no contiene la contraseña. En una instalación distribuida puede establecerse como variable del usuario de Windows y reiniciar la aplicación. No se cargan archivos `.env` automáticamente.

La configuración se lee en el proceso principal y no se envía al renderer. Git y el empaquetador excluyen los nombres locales previstos. No guardar copias con otros nombres dentro del proyecto. El JSON no está cifrado: restringir sus permisos a la persona que utiliza la aplicación. Ninguna aplicación de escritorio puede ocultar de forma absoluta los secretos a quien controla el equipo.

**Credenciales históricas:** una versión anterior contenía una contraseña en el código. Cambiar esa contraseña donde se haya utilizado. Esta preparación del repositorio no elimina las credenciales del historial anterior.

## Instalación y ejecución

```bash
git clone https://github.com/AstronomicalDeveloper/monitor-uv.git
cd monitor-uv
npm ci
npm run dev
```

En PowerShell con ejecución de scripts restringida, utilizar `npm.cmd` en lugar de `npm`. `npm ci` instala las versiones del lockfile y reconstruye las dependencias nativas para Electron.

Una vez configurada MariaDB, probar la conexión desde la aplicación, conectar el prototipo y crear una captura. Cerrar el monitor serial de Arduino IDE antes de abrir el mismo puerto desde Monitor Ambiental UV.

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:electron
npm start
```

`npm start` abre la compilación local. `npm run test:electron`, después de compilar, comprueba el preload con sandbox, el origen IPC, la carga nativa de SerialPort y la generación PDF usando ventanas ocultas. No conecta el prototipo ni consulta MariaDB. Si el entorno establece `ELECTRON_RUN_AS_NODE`, quitar esa variable para ejecutar Electron en modo aplicación.

Para generar un instalador Windows: `npm run build:win`; para una carpeta de distribución: `npm run build:unpack`. Los resultados se generan en `dist/`. El JSON privado debe configurarse por separado en el equipo destino. La publicación está deshabilitada explícitamente; no hay servicios de actualización automática configurados.

Para conservar artefactos anteriores y generar una revisión separada:

```bash
npm run build:win -- --publish never --config.directories.output=dist/round2
npm run test:package -- dist/round2/win-unpacked
```

La segunda ronda generó un instalador NSIS para Windows x64 y comprobó la estructura del paquete. No se ejecutó la instalación ni se comprobó desde el instalador la conexión al prototipo o a MariaDB. El instalador no está firmado. Los artefactos antiguos de `dist/` pueden contener la configuración histórica: no distribuirlos.

## Estructura

```text
src/main/database/  Configuración, consultas y esquema MariaDB
src/main/serial/    Conexión y procesamiento del protocolo serial
src/main/ipc/       Operaciones y validaciones entre procesos
src/main/reports/   Generación CSV y HTML/PDF
src/preload/        Puente de funciones específicas hacia React
src/renderer/      Interfaz, navegación, captura y visualización
tests/             Pruebas automatizadas con servicios simulados
```

## Estado y limitaciones

Proyecto académico preparado para revisión de portafolio. Las pruebas automatizadas con servicios simulados no sustituyen la validación física ni garantizan el funcionamiento de un instalador en otro equipo.

Validación manual reportada por la autora: la aplicación se probó con MariaDB y conserva sus mediciones históricas. Esta comprobación es independiente de las pruebas automatizadas y no confirma por sí sola el funcionamiento del instalador ni de todos los escenarios con hardware.

- Requiere MariaDB disponible; no incluye almacenamiento offline. Ante un fallo de guardado, la siguiente medición puede reintentar sin avanzar el intervalo. Las muestras recibidas mientras hay una escritura pendiente no se acumulan.
- La finalización normal y la desconexión esperan escrituras pendientes. Un cierre forzado, corte de energía o fallo de MariaDB puede dejar una sesión activa; revisar el historial y la base de datos.
- Los reportes cargan las mediciones en memoria. Para volúmenes muy grandes se necesitaría paginación o exportación por flujo.
- Las fechas de recepción se guardan en hora local del equipo; la fecha del RTC se conserva como texto. No hay normalización de zona horaria entre equipos.
- macOS y Linux conservan scripts de empaquetado, pero requieren pruebas propias. El proyecto no configura firma de instaladores ni notarización.
- La segunda ronda utiliza Electron 45.2.3 y conserva Electron Vite 5, Electron Builder 26 y SerialPort 13, con reconstrucción nativa y pruebas en Windows x64. `npm audit` informa 12 avisos moderados en herramientas de desarrollo y ninguno alto; `npm audit --omit=dev` no informa avisos en dependencias de producción. No se aplicaron overrides ni supresiones. El informe explica el alcance y las actualizaciones pendientes.

## Créditos y contribuciones

Trabajo grupal de la Universidad Nacional Mayor de San Marcos. **Landry Bardales Guadalupe** ([AstronomicalDeveloper](https://github.com/AstronomicalDeveloper)) asumió el desarrollo técnico del software, la programación e integración de Arduino y sensores, la base de datos, las pruebas y la integración del sistema. Otros integrantes participaron en la presentación física del prototipo.

Licencia: consultar [LICENSE](LICENSE).
