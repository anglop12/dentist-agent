import { config as dotenv } from 'dotenv';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { createSqliteConnection } from './connection';
import { Doctor } from '../../domain/identity/doctor.entity';
import {
  specialties as specialtiesTable,
  doctors as doctorsTable,
  statusMedicalAppointments as statusTable,
} from './schema';
import { eq } from 'drizzle-orm';

// Cargar .env desde la raíz del monorepo (subir hasta encontrar .env).
function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 5; i++) {
    if (existsSync(resolve(dir, '.env'))) return dir;
    dir = dirname(dir);
  }
  return start;
}
const repoRoot = findRepoRoot(process.cwd());
dotenv({ path: resolve(repoRoot, '.env') });
process.chdir(repoRoot);

const DATABASE_URL = process.env.DATABASE_URL ?? './storage/clinic.sqlite';
console.log('[seed] cwd:', process.cwd());
console.log('[seed] DATABASE_URL:', DATABASE_URL);

const SPECIALTIES = [
  { name: 'Odontología General', description: 'Diagnóstico, prevención y restauración' },
  { name: 'Ortodoncia', description: 'Corrección de malposiciones dentales' },
  { name: 'Endodoncia', description: 'Tratamiento de conductos' },
  { name: 'Periodoncia', description: 'Enfermedades de las encías' },
  { name: 'Cirugía Maxilofacial', description: 'Cirugía oral y facial' },
  { name: 'Odontopediatría', description: 'Atención dental infantil' },
];

const APPOINTMENT_STATUSES = [
  { id: 'sma-pending', name: 'pending' },
  { id: 'sma-confirmed', name: 'confirmed' },
  { id: 'sma-checked_in', name: 'checked_in' },
  { id: 'sma-completed', name: 'completed' },
  { id: 'sma-no_show', name: 'no_show' },
  { id: 'sma-cancelled', name: 'cancelled' },
  { id: 'sma-expired', name: 'expired' },
];

async function main(): Promise<void> {
  const { db, close } = createSqliteConnection(DATABASE_URL);

  console.log(`[seed] Seeding ${DATABASE_URL}…`);
  const now = new Date();

  try {
    // Especialidades
    for (const s of SPECIALTIES) {
      const id = `spec-${s.name.toLowerCase().replace(/\s+/g, '-').replace(/[áéíóúñ]/g, (m) => ({ 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n' }[m] ?? m))}`;
      try {
        await db
          .insert(specialtiesTable)
          .values({
            id,
            name: s.name,
            description: s.description,
            active: true,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing();
      } catch (e) {
        console.warn(`  specialty ${s.name}: ${(e as Error).message}`);
      }
    }
    console.log(`[seed] ${SPECIALTIES.length} specialties`);

    // Estados
    for (const s of APPOINTMENT_STATUSES) {
      try {
        await db
          .insert(statusTable)
          .values({
            id: s.id,
            name: s.name,
            active: true,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing();
      } catch (e) {
        console.warn(`  status ${s.name}: ${(e as Error).message}`);
      }
    }
    console.log(`[seed] ${APPOINTMENT_STATUSES.length} appointment statuses`);

    // Doctor por defecto
    const doctorId = 'doctor-default';
    try {
      const existing = await db
        .select()
        .from(doctorsTable)
        .where(eq(doctorsTable.id, doctorId))
        .limit(1);
      if (!existing[0]) {
        const specId = `spec-odontologia-general`;
        const doctor = Doctor.create({
          id: doctorId,
          name: process.env.DOCTOR_NAME ?? 'Dra. María',
          lastname: process.env.DOCTOR_LASTNAME ?? 'Rodríguez',
          cedula: parseInt(process.env.DOCTOR_CEDULA ?? '12345678', 10),
          email: process.env.DOCTOR_EMAIL ?? 'doctor@clinica.local',
          phone: process.env.DOCTOR_PHONE ?? '+584141234567',
          specialtyId: specId,
          dailyLimit: 12,
        });
        await db.insert(doctorsTable).values({
          id: doctor.id,
          name: doctor.name.name,
          lastname: doctor.name.lastname,
          cedula: doctor.cedula.value,
          email: doctor.email.value,
          phone: doctor.phone.value,
          specialtyId: doctor.specialtyId,
          dailyLimit: doctor.dailyLimit,
          active: true,
          createdAt: now,
          updatedAt: now,
        });
        console.log('[seed] Default doctor inserted');
      } else {
        console.log('[seed] Default doctor already exists, skipping');
      }
    } catch (e) {
      console.warn(`  default doctor: ${(e as Error).message}`);
    }

    console.log('[seed] ✅ Done.');
  } catch (err) {
    console.error('[seed] � Failed:', err);
    process.exit(1);
  } finally {
    close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
