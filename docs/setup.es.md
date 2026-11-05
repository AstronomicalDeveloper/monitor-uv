# Instalación y desarrollo

[English](setup.md) | [Español](setup.es.md) · [Volver a Monitor UV](../README.es.md)

Esta guía cubre la aplicación de escritorio. No incluye firmware Arduino ni instrucciones de cableado.

## Requisitos previos

- Node.js 22.12 o posterior compatible con las dependencias del proyecto y npm.
- MariaDB Server y una cuenta administradora para crear el esquema y la cuenta de aplicación.
- Controladores USB/serial de la placa si se conectará el prototipo.
- Herramientas de compilación nativa si SerialPort no dispone de un binario compatible. En Windows, una ruta sin espacios puede ayudar si node-gyp informa un fallo relacionado con la ruta.
- Arduino IDE solo si se necesita cargar o modificar el firmware; el firmware no está incluido aquí.

Clonar e instalar desde la raíz del repositorio:

```bash
git clone https://github.com/AstronomicalDeveloper/monitor-uv.git
cd monitor-uv
npm ci
```

`npm ci` utiliza el lockfile y ejecuta la preparación de dependencias nativas de Electron. Usar `npm.cmd` en PowerShell si la política de ejecución bloquea `npm`.

## Configurar MariaDB

### 1. Crear el esquema

Desde la raíz del repositorio, abrir el cliente MariaDB con la cuenta administradora. Sustituir `YOUR_ADMIN_USER` por el nombre de esa cuenta; `-p` solicita la contraseña de forma interactiva.

```bash
mariadb -h 127.0.0.1 -u YOUR_ADMIN_USER -p
```

En el cliente MariaDB:

```sql
SOURCE src/main/database/schema.sql;
SHOW TABLE STATUS FROM monitor_uv;
```

El [esquema](../src/main/database/schema.sql) crea `monitor_uv`, sus tablas de sesiones y mediciones y los índices. No crea usuarios ni modifica contraseñas. Comprobar que ambas tablas utilizan **InnoDB**. `CREATE TABLE IF NOT EXISTS` no convierte tablas antiguas de otro motor; respaldar una base existente antes de considerar una migración. La aplicación no importa el esquema automáticamente.

### 2. Utilizar una cuenta dedicada

Crear una cuenta de aplicación con una contraseña nueva y exclusiva para este proyecto. Necesita **`SELECT`, `INSERT` y `UPDATE` sobre `monitor_uv.*`**, no permisos de gestión del esquema ni de administración de usuarios. Restringir el host de la cuenta al equipo u origen de conexión que se utilice. No ejecutar la aplicación con una cuenta administradora.

Mantener las contraseñas fuera de los argumentos de comandos, archivos SQL versionados y grabaciones de terminal compartidas. Si una contraseña se expuso o reutilizó, cambiarla donde se haya utilizado; pasar a una cuenta nueva no revoca la anterior.

### 3. Crear el JSON privado

Utilizar [database.example.json](../database.example.json) como plantilla. Configurar `host`, `port` numérico, `user`, `password` y `database` con los datos de conexión local. La contraseña vacía del ejemplo es un marcador, no una cuenta lista para utilizar.

Guardar el JSON completo **fuera del repositorio y del directorio de instalación**, con permisos del sistema operativo limitados a las personas que lo necesitan. Este ejemplo de PowerShell copia la plantilla solo si el destino no existe:

```powershell
$privateDirectory = Join-Path $env:USERPROFILE 'monitor-uv-private'
New-Item -ItemType Directory -Path $privateDirectory -Force
$privateConfig = Join-Path $privateDirectory 'database.json'
if (-not (Test-Path -LiteralPath $privateConfig)) {
  Copy-Item database.example.json $privateConfig
}
```

Editar el JSON copiado antes de ejecutar la aplicación. No sobrescribir una configuración funcional con la plantilla.

### 4. Definir la ruta de configuración

En la terminal desde la que se iniciará la aplicación:

```powershell
$env:MONITOR_UV_DB_CONFIG = "$env:USERPROFILE\monitor-uv-private\database.json"
npm.cmd run dev
```

En una shell POSIX, el equivalente es:

```bash
export MONITOR_UV_DB_CONFIG="/absolute/path/to/database.json"
npm run dev
```

Sustituir la ruta del ejemplo por la ruta absoluta del archivo propio. `MONITOR_UV_DB_CONFIG` contiene **la ruta, no la contraseña**. En Windows se puede conservar la ruta actual para el usuario:

```powershell
[Environment]::SetEnvironmentVariable('MONITOR_UV_DB_CONFIG', $env:MONITOR_UV_DB_CONFIG, 'User')
```

Volver a abrir la aplicación o la terminal después de definir una variable persistente. Sin esa variable, la aplicación lee `database.json` desde `app.getPath('userData')` de Electron. En Windows corresponde a una carpeta de la aplicación dentro de `%APPDATA%`; su nombre puede variar entre desarrollo y distribución.

El archivo privado también puede llamarse `database.local.json`, pero la variable debe apuntar expresamente a él. Ese nombre no se detecta automáticamente. Los archivos `.env` tampoco se cargan de forma automática.

Git ignora los nombres previstos de JSON privados y el empaquetador los excluye. Mantener también fuera del proyecto las copias con otros nombres. El archivo no está cifrado: una aplicación de escritorio no puede ocultar las credenciales de conexión a quien controla el equipo. La configuración se lee en el proceso principal de Electron y no se envía al renderer.

## Conectar el prototipo

1. Comprobar que MariaDB esté en ejecución y utilizar la prueba de conexión de la aplicación.
2. Conectar el Arduino y cerrar cualquier otra aplicación que utilice su puerto serial, incluido el monitor serial de Arduino IDE.
3. Listar puertos, seleccionar el del prototipo, probarlo y conectar a **9600 baudios**.
4. Crear una sesión manual o temporizada y elegir el intervalo de almacenamiento. Utilizar el historial y los reportes para consultar las lecturas guardadas.

### Formato serial

Este ciclo ilustrativo coincide con las etiquetas esperadas por el receptor de escritorio; no es una medición registrada:

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

El encabezado UV inicia el ciclo y `Fecha y hora` lo termina. Los campos intermedios pueden llegar en distinto orden. El receptor descarta ciclos incompletos o duplicados, números no finitos y ciclos de más de diez segundos, en lugar de reutilizar lecturas de un ciclo anterior. Confirmar el contrato con el firmware real antes de modificar el protocolo. La fecha del RTC se conserva como texto; la aplicación no impone un nuevo formato de RTC.

## Comandos de desarrollo

Ejecutar desde la raíz del repositorio:

| Comando                 | Propósito                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`           | Iniciar la aplicación en desarrollo.                                                                                                              |
| `npm run typecheck`     | Comprobar los tipos de main, preload y renderer.                                                                                                  |
| `npm run lint`          | Ejecutar ESLint.                                                                                                                                  |
| `npm test`              | Ejecutar pruebas focalizadas con servicios simulados.                                                                                             |
| `npm run build`         | Comprobar tipos y compilar main, preload y renderer en `out/`.                                                                                    |
| `npm start`             | Abrir la compilación local después de compilar.                                                                                                   |
| `npm run test:electron` | Después de compilar, comprobar sandbox, preload, validación de origen IPC, carga nativa de SerialPort y generación PDF mediante ventanas ocultas. |
| `npm audit`             | Revisar avisos de dependencias.                                                                                                                   |

Las pruebas automatizadas no verifican un servidor MariaDB real ni abren el puerto del prototipo. Si el entorno define `ELECTRON_RUN_AS_NODE`, quitar esa variable antes de ejecutar Electron como aplicación. En PowerShell:

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
```

## Compilación e instaladores

```bash
npm run build:win
```

Este comando compila un instalador Windows en `dist/`. `npm run build:unpack` crea una carpeta de distribución sin instalador. También hay scripts para macOS y Linux, pero necesitan su propio entorno y validación.

Para conservar una distribución existente, elegir una carpeta de salida separada e inspeccionar después su paquete:

```bash
npm run build:win -- --publish never --config.directories.output=dist/local-build
npm run test:package -- dist/local-build/win-unpacked
```

Configurar el JSON privado por separado en el equipo destino. La publicación está deshabilitada en la configuración de compilación; no hay un servicio de actualización automática. El instalador Windows no está firmado y la notarización de macOS no está configurada. La inspección del paquete no sustituye las pruebas de instalación, desinstalación y hardware en el sistema destino.

No distribuir paquetes antiguos que puedan contener una configuración de conexión obsoleta. Revisar los avisos de dependencias antes de compartir una nueva compilación.

## Estructura del proyecto

```text
src/main/database/  Configuración en ejecución, consultas y esquema MariaDB
src/main/serial/    Gestión de puertos y procesamiento serial
src/main/ipc/       Operaciones y validación entre procesos
src/main/reports/   Generación CSV y HTML/PDF
src/preload/        Funciones específicas expuestas a React
src/renderer/      Interfaz, navegación, captura y visualización
tests/             Pruebas automatizadas e inspección de paquetes
```
