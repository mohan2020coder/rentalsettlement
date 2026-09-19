import React, { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

import { evidenceApi } from '../../api/endpoints';
import { Button, Card, Screen, Section } from '../../components';
import { theme } from '../../theme';

export function EvidenceScreen({ route }: any) {
  const { tenancyId } = route.params as { tenancyId: string };
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const { blob, filename } = await evidenceApi.download(tenancyId);
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = document as any;
        const url = URL.createObjectURL(blob);
        const a = doc.createElement('a') as HTMLAnchorElement;
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setStatus('Download started.');
        return;
      }
      // React Native: convert the blob to a file and offer it for sharing.
      const base64 = await blobToBase64(blob);
      const uri = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Evidence dossier' });
      } else {
        setStatus(`Saved to ${uri}`);
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Section title="Evidence dossier" />
      <Card>
        <Text style={styles.intro}>
          Download a PDF bundling every record of this tenancy — agreement,
          inspections, maintenance, claims, disputes, settlement and the full
          audit trail. The dossier is for record keeping; it is not a mandate
          to move money.
        </Text>
        <Button title="Download PDF" onPress={download} loading={busy} />
        {status ? <Text style={styles.status}>{status}</Text> : null}
      </Card>
    </Screen>
  );
}

async function blobToBase64(blob: Blob): Promise<string> {
  const reader = new FileReader();
  return new Promise<string>((resolve, reject) => {
    reader.onerror = () => reject(new Error('Failed to read download.'));
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

const styles = StyleSheet.create({
  intro: {
    fontSize: theme.text.body,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    lineHeight: 22,
  },
  status: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.caption,
    marginTop: theme.spacing.md,
  },
});