import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { api } from '../api/client';
import { extractError } from '../api/client';

export async function downloadEvidencePdf(tenancyId: string): Promise<string> {
  try {
    const resp = await api.get(`/evidence/tenancy/${tenancyId}/download`, {
      responseType: 'blob',
    });
    const blob = resp.data as Blob;
    if (Platform.OS === 'web') {
      throw new Error('Downloading PDFs is not supported on web yet. Use the demo app on a device.');
    }
    const base64 = await blobToBase64(blob);
    const dir = FileSystem.cacheDirectory;
    if (!dir) {
      throw new Error('No cache directory available');
    }
    const path = `${dir}evidence-${tenancyId}.pdf`;
    await FileSystem.writeAsStringAsync(path, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return path;
  } catch (err) {
    throw extractError(err);
  }
}

export async function shareFile(path: string, mimeType = 'application/pdf') {
  if (!(await Sharing.isAvailableAsync())) {
    return;
  }
  await Sharing.shareAsync(path, { mimeType });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onloadend = () => {
      const result = reader.result as string;
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}