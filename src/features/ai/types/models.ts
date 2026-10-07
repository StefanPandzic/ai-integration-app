/**
 * AI Model Types
 *
 * Shared type definitions for AI model metadata
 */

export interface ModelMetadata {
  name: string;
  type: 'local' | 'cloud';
  requiresAuth: boolean;
  supportsVision?: boolean;
  apiUrl: string;
}
