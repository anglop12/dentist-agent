-- Seed inicial idempotente del catÃ¡logo.
-- Se aplica una sola vez vÃ­a _migrations (docker/migrate.cjs o pnpm migrate).

INSERT OR IGNORE INTO `specialties` (`id`,`name`,`description`,`active`,`created_at`,`updated_at`) VALUES
 ('spec-odontologia-general','OdontologÃ­a General','DiagnÃ³stico, prevenciÃ³n y restauraciÃ³n',1,strftime('%s','now'),strftime('%s','now')),
 ('spec-ortodoncia','Ortodoncia','CorrecciÃ³n de malposiciones dentales',1,strftime('%s','now'),strftime('%s','now')),
 ('spec-endodoncia','Endodoncia','Tratamiento de conductos',1,strftime('%s','now'),strftime('%s','now')),
 ('spec-periodoncia','Periodoncia','Enfermedades de las encÃ­as',1,strftime('%s','now'),strftime('%s','now')),
 ('spec-cirugia-maxilofacial','CirugÃ­a Maxilofacial','CirugÃ­a oral y facial',1,strftime('%s','now'),strftime('%s','now')),
 ('spec-odontopediatria','OdontopediatrÃ­a','AtenciÃ³n dental infantil',1,strftime('%s','now'),strftime('%s','now'));
--> statement-breakpoint
INSERT OR IGNORE INTO `status_medical_appointments` (`id`,`name`,`active`,`created_at`,`updated_at`) VALUES
 ('sma-pending','pending',1,strftime('%s','now'),strftime('%s','now')),
 ('sma-confirmed','confirmed',1,strftime('%s','now'),strftime('%s','now')),
 ('sma-checked_in','checked_in',1,strftime('%s','now'),strftime('%s','now')),
 ('sma-completed','completed',1,strftime('%s','now'),strftime('%s','now')),
 ('sma-no_show','no_show',1,strftime('%s','now'),strftime('%s','now')),
 ('sma-cancelled','cancelled',1,strftime('%s','now'),strftime('%s','now')),
 ('sma-expired','expired',1,strftime('%s','now'),strftime('%s','now'));
--> statement-breakpoint
-- Doctor por defecto del consultorio (editable luego vÃ­a API).
INSERT OR IGNORE INTO `doctors` (`id`,`name`,`lastname`,`cedula`,`email`,`phone`,`specialty_id`,`daily_limit`,`active`,`created_at`,`updated_at`) VALUES
 ('doctor-default','Dra. MarÃ­a','RodrÃ­guez',12345678,'doctor@clinica.local','+584141234567','spec-odontologia-general',12,1,strftime('%s','now'),strftime('%s','now'));
