// Structured decisions only: scores and choices about text, never generated text.
export type Question =
  | { type: "score"; instructions: string; criteria: string[] }
  | { type: "choice"; instructions: string; criteria: Record<string, string | null> };

export type Answer =
  | { type: "score"; score: number; confidence: number }
  | { type: "choice"; choice: string; confidence: number; probabilities: Record<string, number> };

export interface Classifier {
  version: string;
  ask(state: unknown, questions: Record<string, Question>, signal?: AbortSignal): Promise<{ model: string; answers: Record<string, Answer> }>;
}

export class ClassifierError extends Error {}

interface JevOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  retries?: number;
  fetcher?: typeof fetch;
}

// https://docs.typesafe.ai/api
export function jevClassifier({ apiKey, baseUrl = "https://api.typesafe.ai", model = "jev-latest", timeoutMs = 2000, retries = 1, fetcher = fetch }: JevOptions): Classifier {
  return {
    version: model,
    async ask(state, questions, signal) {
      const deadline = Date.now() + timeoutMs;
      let lastError: unknown;
      for (let attempt = 0; attempt <= retries; attempt++) {
        const left = deadline - Date.now();
        if (left <= 0) break;
        try {
          const timeout = AbortSignal.timeout(left);
          const response = await fetcher(new URL("/v1/systemone", baseUrl), {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model, state, questions }),
            signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
          });
          if (response.ok) return (await response.json()) as { model: string; answers: Record<string, Answer> };
          lastError = new ClassifierError(`Classifier answered ${response.status}`);
          if (response.status < 500 && response.status !== 429) break;
        } catch (error) {
          lastError = error;
          if (signal?.aborted) break;
        }
      }
      throw lastError instanceof Error ? lastError : new ClassifierError("Classifier timed out");
    },
  };
}

export interface ClassifiableIdea {
  title: string;
  problem: string;
}

// Only the title and problem text are sent, whatever else the idea carries.
export async function classifyIdea(idea: ClassifiableIdea, schema: Record<string, Question>, classifier: Classifier) {
  const { model, answers } = await classifier.ask({ idea: { title: idea.title, problem: idea.problem } }, schema);
  return { classifierVersion: model, answers };
}
