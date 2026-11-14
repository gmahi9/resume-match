import { describeProgress, embedTexts, type ModelProgress } from './embeddings';
import { extractRequirements, extractResumeLines } from './requirements';
import { scoreMatch } from './scoring';
import { cosineSimilarity, meanNormalize } from './similarity';
import { chunkForEmbedding, clipInput } from './text';
import type { MatchReport } from '../types';

export async function analyze(options: {
  resume: string;
  jobDescription: string;
  onProgress?: (ratio: number, label: string) => void;
  embed?: (texts: string[], onProgress?: (event: ModelProgress) => void) => Promise<number[][]>;
}): Promise<MatchReport> {
  const resume = clipInput(options.resume).text;
  const jobDescription = clipInput(options.jobDescription).text;
  const resumeChunks = chunkForEmbedding(resume);
  const jdChunks = chunkForEmbedding(jobDescription);
  const requirements = extractRequirements(jobDescription);
  const lines = extractResumeLines(resume);
  const texts = [...resumeChunks, ...jdChunks, ...requirements, ...lines];

  try {
    if (texts.length === 0) throw new Error('Nothing to embed.');
    const tracker = new Map<string, number>();
    const embed = options.embed ?? embedTexts;
    const vectors = await embed(texts, (event) => {
      if (!options.onProgress) return;
      const progress = describeProgress(event, tracker);
      options.onProgress(progress.ratio, progress.label);
    });
    if (vectors.length !== texts.length) throw new Error('Embedding count did not match the input.');
    options.onProgress?.(1, 'Scoring on this device');

    let offset = 0;
    const take = (count: number) => {
      const slice = vectors.slice(offset, offset + count);
      offset += count;
      return slice;
    };
    const semanticCosine = cosineSimilarity(meanNormalize(take(resumeChunks.length)), meanNormalize(take(jdChunks.length)));
    const requirementVectors = take(requirements.length);
    const lineVectors = take(lines.length);
    const lineCosines = requirementVectors.map((requirement) =>
      lineVectors.map((line) => cosineSimilarity(requirement, line)),
    );
    return scoreMatch({
      resume,
      jobDescription,
      semanticCosine,
      lineCosines,
      mode: 'embedding',
    });
  } catch (error) {
    console.error('Embedding scoring was skipped.', error);
    return scoreMatch({ resume, jobDescription, mode: 'lexical' });
  }
}
