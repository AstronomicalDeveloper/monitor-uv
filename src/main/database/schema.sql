CREATE DATABASE IF NOT EXISTS monitor_uv
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE monitor_uv;

CREATE TABLE IF NOT EXISTS sesion_medicion (
    sesion_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    lugar VARCHAR(150) NULL,
    descripcion TEXT NULL,
    modo_finalizacion ENUM('MANUAL', 'TEMPORIZADA') NOT NULL,
    duracion_programada_segundos INT NULL,
    frecuencia_almacenamiento_segundos INT NOT NULL,
    fecha_inicio DATETIME(3) NOT NULL,
    fecha_fin DATETIME(3) NULL,
    estado ENUM('ACTIVA', 'FINALIZADA', 'CANCELADA') NOT NULL DEFAULT 'ACTIVA',
    total_muestras INT NOT NULL DEFAULT 0,
    creado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS medicion_ambiental (
    medicion_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sesion_id BIGINT NOT NULL,
    fecha_hora_prototipo VARCHAR(30) NULL,
    fecha_hora_recepcion DATETIME(3) NOT NULL,
    uv_adc INT NULL,
    voltaje_uv DECIMAL(8, 4) NULL,
    nivel_uv VARCHAR(20) NULL,
    luminosidad_lux DECIMAL(10, 2) NULL,
    temperatura_c DECIMAL(6, 2) NULL,
    humedad_porcentaje DECIMAL(6, 2) NULL,
    presion_hpa DECIMAL(8, 2) NULL,
    presencia_detectada BOOLEAN NULL,
    CONSTRAINT fk_medicion_sesion
        FOREIGN KEY (sesion_id)
        REFERENCES sesion_medicion(sesion_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_medicion_sesion_fecha
ON medicion_ambiental(sesion_id, fecha_hora_recepcion);

CREATE INDEX IF NOT EXISTS idx_sesion_fecha_inicio
ON sesion_medicion(fecha_inicio);
