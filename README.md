<div align="center">

[English](README.md) | [Español](README.es.md)

# ☀️ Monitor UV

**Environmental sensing, live visualization, and session reports in one desktop app.**

![Electron](https://img.shields.io/badge/Electron-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Arduino](https://img.shields.io/badge/Arduino-00979D?logo=arduino&logoColor=white)
![MariaDB](https://img.shields.io/badge/MariaDB-003545?logo=mariadb&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)

**UNMSM · Computer Architecture · University project**

</div>

---

## What is Monitor UV?

Monitor Ambiental UV connects an Arduino prototype to a desktop interface for exploring environmental measurements, from sensor readings to session history and reports.

Developed as a group assignment for the **Computer Architecture** course at **Universidad Nacional Mayor de San Marcos**, the project brings together hardware, serial communication, storage, and visualization. It is presented as an academic portfolio project.

> **About UV measurements:** the prototype's ADC, voltage, and BAJO/MEDIO/ALTO levels do not by themselves represent a calibrated UV index. Interpreting the data requires understanding the sensor and its calibration.

## Main features

| Feature                  | What it provides                                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sensor acquisition**   | List, test, and connect ports at 9600 baud; receive UV, light, temperature, humidity, pressure, presence, and the prototype's date and time. |
| **Visualization**        | Explore incoming readings and their evolution through indicators and charts.                                                                 |
| **Sessions and history** | Create manual or timed captures, configure the storage interval, and browse measurements and statistics in MariaDB.                          |
| **PDF/CSV reports**      | Select one or more sessions and export grouped reports through a save dialog.                                                                |

---

## Architecture and technologies

Acquisition and database access run in Electron's main process. The React interface calls specific functions through the preload bridge and IPC messages.

| Layer                  | Technologies and responsibility                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| **Prototype**          | Arduino and sensors: acquire environmental readings and transmit them over USB/serial.                  |
| **Main process**       | Electron, Node.js, TypeScript, and SerialPort: connections, reading processing, and session management. |
| **Process bridge**     | Preload with `contextBridge` and IPC: specific functions, context isolation, and sandboxing.            |
| **Interface**          | React, React Router, and Tailwind CSS: connection, monitoring, history, and reports.                    |
| **Storage and export** | MariaDB through mysql2; CSV generation and PDF export using Electron's `printToPDF`.                    |
| **Development**        | electron-vite/Vite, TypeScript, ESLint, and tests using `node:test`.                                    |

### Prototype components

The project documentation describes an analog UV sensor, a BH1750 light sensor, a BME280 environmental sensor, a DS3231 RTC, and a PIR presence sensor, alongside an I2C LCD, LEDs, and a buzzer.

The firmware, wiring, exact board and UV sensor models, and calibration are **not versioned**. The [setup guide](docs/setup.md#serial-format) documents the format expected by the desktop receiver.

## Run locally

**Requirements:** Node.js 22.12 or later compatible with the dependencies, npm, MariaDB Server with InnoDB, and the prototype with its USB/serial drivers for physical captures. Arduino IDE is only needed to upload or modify firmware.

1. Clone the project and install dependencies:

   ```bash
   git clone https://github.com/AstronomicalDeveloper/monitor-uv.git
   cd monitor-uv
   npm ci
   ```

2. Follow the [MariaDB and local JSON configuration steps](docs/setup.md#configure-mariadb). Use [database.example.json](database.example.json) as the template and set `MONITOR_UV_DB_CONFIG` to the private file's path.

3. Start the app:

   ```bash
   npm run dev
   ```

4. Test the MariaDB connection in the interface, connect the prototype, and create a capture. Close the Arduino IDE serial monitor before opening the same port from Monitor UV.

In PowerShell with restricted script execution, use `npm.cmd`. For detailed configuration, tests, builds, and installers, see the [setup and development guide](docs/setup.md).

---

## Status and limitations

The author reported manual verification of the app with MariaDB and preservation of historical measurements. This validation is separate from automated tests and does not confirm every hardware scenario or installer behavior on another computer.

- **MariaDB must be available.** There is no offline storage; readings received while a write is pending are not queued.
- **Physical validation remains necessary.** Check sensors, protocol, and calibration against the real firmware before interpreting results. A forced shutdown or MariaDB outage may leave a session active.
- **Reports are processed in memory.** Very large exports may require pagination or streaming.
- **Dates retain local behavior.** Reception times use the computer's local time and RTC dates remain text; there is no cross-time-zone normalization.
- **Distribution needs its own testing.** The Windows installer is unsigned; macOS and Linux scripts are available but require validation on those systems. Automatic updates are not configured.

Before distributing a new build, review dependency advisories with `npm audit`. Automated tests do not replace physical integration testing.

## Academic credits

A group project at **Universidad Nacional Mayor de San Marcos**.

| Contributor                                                                                        | Contribution                                                                                                               |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Landry Bardales Guadalupe** · [@AstronomicalDeveloper](https://github.com/AstronomicalDeveloper) | Technical software development; Arduino and sensor programming and integration; database, testing, and system integration. |
| **Other group members**                                                                            | Participation in the physical presentation of the prototype.                                                               |

## License

Distributed under the [MIT License](LICENSE).
