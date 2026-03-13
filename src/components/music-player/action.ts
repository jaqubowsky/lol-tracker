"use server";

interface VideoTitle {
  videoId: string;
  title: string;
}

export async function resolveVideoTitles(
  videoIds: string[]
): Promise<VideoTitle[]> {
  const results: VideoTitle[] = [];

  // Process in batches of 10
  for (let i = 0; i < videoIds.length; i += 10) {
    const batch = videoIds.slice(i, i + 10);
    const promises = batch.map(async (videoId) => {
      try {
        const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const res = await fetch(url, {
          next: { revalidate: 86400 },
        });
        if (!res.ok) return { videoId, title: "" };
        const data = await res.json();
        return { videoId, title: data.title ?? "" };
      } catch {
        return { videoId, title: "" };
      }
    });
    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
  }

  return results;
}
