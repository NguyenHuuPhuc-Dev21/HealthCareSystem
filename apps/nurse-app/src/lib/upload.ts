/**
 * Shared presigned URL upload helper for Nurse App (used by A02 Onboarding & A15 Disputes).
 */
export async function putFileToPresignedUrl(
  url: string,
  fileUri: string,
  contentType: string = 'image/jpeg',
  isMock: boolean = false
): Promise<boolean> {
  if (isMock || url.startsWith('mock://') || fileUri.startsWith('mock://')) {
    await new Promise((r) => setTimeout(r, 100));
    return true;
  }

  try {
    const fileResponse = await fetch(fileUri);
    const blob = await fileResponse.blob();

    const uploadRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: blob,
    });

    return uploadRes.ok;
  } catch {
    return false;
  }
}
