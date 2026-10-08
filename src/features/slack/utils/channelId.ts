/** Public (C…) or private (G…) Slack channel ID, as the backend accepts */
export const isSlackChannelId = (value: string): boolean => /^[CG][A-Z0-9]{6,}$/.test(value);
