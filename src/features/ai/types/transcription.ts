export interface Transcription {
  id: string;
  text: string;
  timestamp: number;
  language: string;
  aiResponse?: string;
  isGeneratingResponse?: boolean;
  embedding: number[] | null;
}
