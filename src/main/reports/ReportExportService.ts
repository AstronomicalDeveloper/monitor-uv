import { BrowserWindow, dialog } from 'electron'
import { writeFile } from 'node:fs/promises'
import type {
  ReportSummary,
  SessionSummary,
  StoredMeasurement
} from '../../renderer/src/types/database'

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? '')

  if (/[",\n\r;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

function formatNumber(
  value: number | null | undefined,
  decimals = 2
): string {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(value)
  ) {
    return '--'
  }

  return value.toFixed(decimals)
}

function getSessionMap(
  report: ReportSummary
): Map<number, SessionSummary> {
  return new Map(
    report.sessions.map((session) => [
      session.sessionId,
      session
    ])
  )
}

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

function buildExportTimestamp(
  date = new Date()
): string {
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())

  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`
}

function buildDefaultFileName(
  extension: 'csv' | 'pdf'
): string {
  return `reporte-uv-agrupado_${buildExportTimestamp()}.${extension}`
}

function buildCsv(report: ReportSummary): string {
  const sessionMap = getSessionMap(report)

  const headers = [
    'session_id',
    'session_name',
    'session_location',
    'session_description',
    'session_started_at',
    'measurement_id',
    'prototype_datetime',
    'received_at',
    'uv_adc',
    'uv_voltage',
    'uv_level',
    'luminosity_lux',
    'temperature_c',
    'humidity_percent',
    'pressure_hpa',
    'presence_detected'
  ]

  const rows = report.measurements.map((measurement) => {
    const session = sessionMap.get(measurement.sessionId)

    return [
      measurement.sessionId,
      session?.name ?? '',
      session?.location ?? '',
      session?.description ?? '',
      session?.startedAt ?? '',
      measurement.measurementId,
      measurement.dateTime ?? '',
      measurement.receivedAt ?? '',
      measurement.uvAdc ?? '',
      measurement.uvVoltage ?? '',
      measurement.level ?? '',
      measurement.luminosity ?? '',
      measurement.temperature ?? '',
      measurement.humidity ?? '',
      measurement.pressure ?? '',
      measurement.presence === null
        ? ''
        : measurement.presence
          ? '1'
          : '0'
    ].map(escapeCsv)
  })

  return [headers.map(escapeCsv), ...rows]
    .map((row) => row.join(';'))
    .join('\n')
}

function buildChartSvg(
  title: string,
  measurements: StoredMeasurement[],
  key: keyof Pick<
    StoredMeasurement,
    | 'uvVoltage'
    | 'temperature'
    | 'humidity'
    | 'pressure'
    | 'luminosity'
  >,
  unit: string,
  yLabel: string
): string {
  const validPoints = measurements
    .map((measurement, index) => ({
      index,
      label:
        measurement.dateTime ||
        measurement.receivedAt ||
        `Muestra ${index + 1}`,
      value: measurement[key]
    }))
    .filter(
      (
        point
      ): point is {
        index: number
        label: string
        value: number
      } =>
        point.value !== null &&
        point.value !== undefined &&
        !Number.isNaN(point.value)
    )

  if (validPoints.length < 2) {
    return `
      <section class="chart-block">
        <h3>${escapeHtml(title)}</h3>
        <div class="empty-chart">
          No hay suficientes mediciones para graficar.
        </div>
      </section>
    `
  }

  const width = 920
  const height = 260

  const paddingLeft = 66
  const paddingRight = 26
  const paddingTop = 34
  const paddingBottom = 56

  const innerWidth =
    width - paddingLeft - paddingRight

  const innerHeight =
    height - paddingTop - paddingBottom

  const values = validPoints.map(
    (point) => point.value
  )

  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)

  /*
   * Si todos los valores son iguales, agregamos margen.
   * Así la línea horizontal no desaparece pegada al borde.
   */
  const domainPadding =
    rawMax === rawMin
      ? Math.max(Math.abs(rawMax) * 0.08, 1)
      : (rawMax - rawMin) * 0.08

  const min = rawMin - domainPadding
  const max = rawMax + domainPadding
  const range = max - min || 1

  const coordinates = validPoints.map(
    (point, index) => {
      const x =
        paddingLeft +
        (index /
          Math.max(validPoints.length - 1, 1)) *
          innerWidth

      const y =
        paddingTop +
        innerHeight -
        ((point.value - min) / range) *
          innerHeight

      return {
        ...point,
        x,
        y
      }
    }
  )

  const polyline = coordinates
    .map(
      (point) =>
        `${point.x.toFixed(2)},${point.y.toFixed(2)}`
    )
    .join(' ')

  const first = coordinates[0]
  const last = coordinates[coordinates.length - 1]

  const middleGridY =
    paddingTop + innerHeight / 2

  const pointStep = Math.max(
    Math.ceil(coordinates.length / 8),
    1
  )

  return `
    <section class="chart-block">
      <div class="chart-header">
        <h3>${escapeHtml(title)}</h3>
        <span>
          Último: ${escapeHtml(formatNumber(last.value, 2))}
          ${escapeHtml(unit)}
        </span>
      </div>

      <svg
        viewBox="0 0 ${width} ${height}"
        class="chart-svg"
        role="img"
        aria-label="${escapeHtml(title)}"
      >
        <line
          x1="${paddingLeft}"
          y1="${paddingTop}"
          x2="${width - paddingRight}"
          y2="${paddingTop}"
          class="grid-line"
        />

        <line
          x1="${paddingLeft}"
          y1="${middleGridY}"
          x2="${width - paddingRight}"
          y2="${middleGridY}"
          class="grid-line"
        />

        <line
          x1="${paddingLeft}"
          y1="${height - paddingBottom}"
          x2="${width - paddingRight}"
          y2="${height - paddingBottom}"
          class="axis"
        />

        <line
          x1="${paddingLeft}"
          y1="${paddingTop}"
          x2="${paddingLeft}"
          y2="${height - paddingBottom}"
          class="axis"
        />

        <text
          x="${paddingLeft}"
          y="19"
          class="axis-label"
        >
          ${escapeHtml(yLabel)} (${escapeHtml(unit)})
        </text>

        <text
          x="${width / 2}"
          y="${height - 12}"
          text-anchor="middle"
          class="axis-label"
        >
          Tiempo
        </text>

        <text
          x="10"
          y="${paddingTop + 4}"
          class="tick"
        >
          ${escapeHtml(formatNumber(rawMax, 2))}
          ${escapeHtml(unit)}
        </text>

        <text
          x="10"
          y="${height - paddingBottom + 4}"
          class="tick"
        >
          ${escapeHtml(formatNumber(rawMin, 2))}
          ${escapeHtml(unit)}
        </text>

        <text
          x="${paddingLeft}"
          y="${height - 31}"
          class="tick"
        >
          ${escapeHtml(first.label)}
        </text>

        <text
          x="${width - paddingRight}"
          y="${height - 31}"
          text-anchor="end"
          class="tick"
        >
          ${escapeHtml(last.label)}
        </text>

        <polyline
          points="${polyline}"
          fill="none"
          class="line"
        />

        ${coordinates
          .filter(
            (_, index) =>
              index === 0 ||
              index === coordinates.length - 1 ||
              index % pointStep === 0
          )
          .map(
            (point) => `
              <circle
                cx="${point.x.toFixed(2)}"
                cy="${point.y.toFixed(2)}"
                r="3.2"
                class="dot"
              />
            `
          )
          .join('')}
      </svg>
    </section>
  `
}

function buildReportHtml(report: ReportSummary): string {
  const { sessions, stats, measurements } = report

  const locations =
    Array.from(
      new Set(
        sessions
          .map((session) => session.location)
          .filter(Boolean)
      )
    ).join(', ') || '--'

  const descriptions = sessions.filter(
    (session) => session.description?.trim()
  )

  const generatedAt =
    new Date().toLocaleString('es-PE')

  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Reporte agrupado UV</title>

        <style>
          @page {
            size: A4;
            margin: 18mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            background: #ffffff;
            color: #202124;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12px;
          }

          .page {
            width: 100%;
          }

          h1 {
            margin: 0 0 22px;
            color: #202124;
            font-size: 30px;
            font-weight: 400;
            line-height: 1.25;
          }

          h2 {
            margin: 28px 0 14px;
            color: #202124;
            font-size: 22px;
            font-weight: 400;
            line-height: 1.35;
          }

          h3 {
            margin: 0 0 8px;
            color: #3c4043;
            font-size: 16px;
            font-weight: 600;
          }

          h4 {
            margin: 18px 0 8px;
            color: #5f6368;
            font-size: 14px;
            font-weight: 600;
          }

          p {
            margin: 0 0 8px;
            line-height: 1.55;
          }

          .meta {
            margin-bottom: 22px;
            color: #5f6368;
            font-size: 11px;
            line-height: 1.6;
          }

          .section-label {
            margin: 0 0 6px;
            color: #5f6368;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin: 16px 0 22px;
          }

          .summary-card {
            border: 1px solid #dadce0;
            padding: 10px 12px;
          }

          .summary-card span {
            display: block;
            color: #5f6368;
            font-size: 10px;
          }

          .summary-card strong {
            display: block;
            margin-top: 5px;
            color: #202124;
            font-size: 18px;
            font-weight: 600;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            font-size: 11px;
          }

          th,
          td {
            border: 1px solid #9aa0a6;
            padding: 7px 8px;
            vertical-align: top;
          }

          thead th {
            color: #202124;
            background: #f1f3f4;
            font-weight: 700;
            text-align: left;
          }

          tbody td {
            background: #ffffff;
          }

          .notes {
            border: 1px solid #dadce0;
            padding: 12px 14px;
          }

          .note {
            margin-bottom: 12px;
            padding-bottom: 10px;
            border-bottom: 1px solid #e8eaed;
          }

          .note:last-child {
            margin-bottom: 0;
            padding-bottom: 0;
            border-bottom: none;
          }

          .note strong {
            display: block;
            margin-bottom: 4px;
            color: #202124;
            font-size: 12px;
          }

          .muted {
            color: #5f6368;
          }

          .chart-block {
            margin: 18px 0 24px;
            page-break-inside: avoid;
          }

          .chart-header {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 8px;
          }

          .chart-header span {
            color: #5f6368;
            font-size: 11px;
            font-weight: 600;
          }

          .chart-svg {
            width: 100%;
            height: auto;
            border: 1px solid #dadce0;
            background: #ffffff;
          }

          .axis {
            stroke: #9aa0a6;
            stroke-width: 1.2;
          }

          .grid-line {
            stroke: #e8eaed;
            stroke-width: 1;
          }

          .axis-label,
          .tick {
            fill: #5f6368;
            font-size: 10px;
          }

          .line {
            stroke: #3c4043;
            stroke-width: 2.6;
            stroke-linecap: round;
            stroke-linejoin: round;
          }

          .dot {
            fill: #3c4043;
            stroke: #ffffff;
            stroke-width: 1.2;
          }

          .empty-chart {
            height: 140px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #5f6368;
            border: 1px dashed #9aa0a6;
            background: #ffffff;
          }

          .footer {
            margin-top: 28px;
            padding-top: 10px;
            border-top: 1px solid #dadce0;
            color: #5f6368;
            font-size: 10px;
          }
        </style>
      </head>

      <body>
        <main class="page">
          <h1>Reporte agrupado de sesiones</h1>

          <section class="meta">
            <p>
              <strong>Sistema:</strong>
              Monitor Ambiental UV
            </p>

            <p>
              <strong>Exportado:</strong>
              ${escapeHtml(generatedAt)}
            </p>

            <p>
              <strong>Sesiones incluidas:</strong>
              ${escapeHtml(sessions.length)}
              &nbsp; | &nbsp;
              <strong>Mediciones:</strong>
              ${escapeHtml(stats.samples)}
              &nbsp; | &nbsp;
              <strong>Lugares:</strong>
              ${escapeHtml(locations)}
            </p>
          </section>

          <h2>1. Resumen general</h2>

          <div class="summary-grid">
            <div class="summary-card">
              <span>UV máximo</span>
              <strong>
                ${formatNumber(stats.uvMax, 3)} V
              </strong>
            </div>

            <div class="summary-card">
              <span>Temperatura promedio</span>
              <strong>
                ${formatNumber(stats.temperatureAvg)} °C
              </strong>
            </div>

            <div class="summary-card">
              <span>Luminosidad promedio</span>
              <strong>
                ${formatNumber(stats.luminosityAvg)} lux
              </strong>
            </div>

            <div class="summary-card">
              <span>Humedad promedio</span>
              <strong>
                ${formatNumber(stats.humidityAvg)} %
              </strong>
            </div>

            <div class="summary-card">
              <span>Presión promedio</span>
              <strong>
                ${formatNumber(stats.pressureAvg)} hPa
              </strong>
            </div>

            <div class="summary-card">
              <span>Presencia detectada</span>
              <strong>
                ${stats.presenceCount}
              </strong>
            </div>
          </div>

          <h2>2. Sesiones incluidas</h2>

          <table>
            <thead>
              <tr>
                <th>Sesión</th>
                <th>Lugar</th>
                <th>Inicio</th>
                <th>Muestras</th>
                <th>UV máx.</th>
                <th>Luz prom.</th>
              </tr>
            </thead>

            <tbody>
              ${sessions
                .map(
                  (session) => `
                    <tr>
                      <td>${escapeHtml(session.name)}</td>
                      <td>${escapeHtml(session.location || '--')}</td>
                      <td>${escapeHtml(session.startedAt)}</td>
                      <td>${escapeHtml(session.totalSamples)}</td>
                      <td>${escapeHtml(formatNumber(session.uvMax, 3))} V</td>
                      <td>${escapeHtml(formatNumber(session.luminosityAvg))} lux</td>
                    </tr>
                  `
                )
                .join('')}
            </tbody>
          </table>

          <h2>3. Observaciones</h2>

          <section class="notes">
            ${
              descriptions.length
                ? descriptions
                    .map(
                      (session) => `
                        <div class="note">
                          <strong>${escapeHtml(session.name)}</strong>
                          <p>${escapeHtml(session.description)}</p>
                        </div>
                      `
                    )
                    .join('')
                : `
                  <p class="muted">
                    No se registraron observaciones en las sesiones seleccionadas.
                  </p>
                `
            }
          </section>

          <h2>4. Gráficas agrupadas</h2>

          ${buildChartSvg(
            'Radiación UV',
            measurements,
            'uvVoltage',
            'V',
            'Voltaje UV'
          )}

          ${buildChartSvg(
            'Temperatura',
            measurements,
            'temperature',
            '°C',
            'Temperatura'
          )}

          ${buildChartSvg(
            'Humedad',
            measurements,
            'humidity',
            '%',
            'Humedad'
          )}

          ${buildChartSvg(
            'Luminosidad',
            measurements,
            'luminosity',
            'lux',
            'Luminosidad'
          )}

          ${buildChartSvg(
            'Presión atmosférica',
            measurements,
            'pressure',
            'hPa',
            'Presión'
          )}

          <p class="footer">
            Reporte generado por el sistema de monitoreo de radiación ultravioleta.
          </p>
        </main>
      </body>
    </html>
  `
}

class ReportExportService {
  async exportCsv(
    report: ReportSummary
  ): Promise<string | null> {
    const result = await dialog.showSaveDialog({
      title: 'Exportar reporte agrupado en CSV',
      defaultPath: buildDefaultFileName('csv'),
      filters: [
        {
          name: 'CSV',
          extensions: ['csv']
        }
      ]
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    await writeFile(
      result.filePath,
      buildCsv(report),
      'utf8'
    )

    return result.filePath
  }

  async exportPdf(
    report: ReportSummary
  ): Promise<string | null> {
    const result = await dialog.showSaveDialog({
      title: 'Exportar reporte agrupado en PDF',
      defaultPath: buildDefaultFileName('pdf'),
      filters: [
        {
          name: 'PDF',
          extensions: ['pdf']
        }
      ]
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    const window = new BrowserWindow({
      show: false,
      width: 1024,
      height: 1400,
      webPreferences: {
        sandbox: false
      }
    })

    try {
      const html = buildReportHtml(report)

      await window.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
      )

      const pdf =
        await window.webContents.printToPDF({
          printBackground: true,
          pageSize: 'A4',
          margins: {
            marginType: 'none'
          }
        })

      await writeFile(result.filePath, pdf)

      return result.filePath
    } finally {
      window.close()
    }
  }
}

export const reportExportService =
  new ReportExportService()