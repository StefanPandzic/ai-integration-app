/**
 * Slack types (mirror backend/src/services/slack/slackChannels.ts)
 */

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  /** Whether the bot is in the channel; it joins public ones on save */
  is_member: boolean;
}

export interface SlackChannelList {
  mode: 'mock' | 'live';
  channels: SlackChannel[];
}

/** Everything a channel picker needs; built by useSlackChannels() */
export interface SlackChannelOptions {
  channels: SlackChannel[];
  mode: SlackChannelList['mode'] | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}
