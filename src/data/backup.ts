import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { localDateKey } from '../domain/types';
export async function saveBackup(raw: string) {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('No hay aplicaciones disponibles para compartir el respaldo.');
  const file = new File(Paths.cache, `shim-shim-${localDateKey()}.json`);
  await file.create({ overwrite: true });
  await file.write(raw);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Guardar respaldo de SHIM-SHIM',
    UTI: 'public.json',
  });
}
