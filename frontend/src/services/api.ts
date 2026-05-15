export const processFrame = async (blob: Blob): Promise<string> => {
  const formData = new FormData();
  formData.append('file', blob, 'frame.jpg');

  const response = await fetch('http://localhost:8000/process-frame', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error('Failed to process frame');

  const imageBlob = await response.blob();
  return URL.createObjectURL(imageBlob);
};