/**
 * Slack Channels
 *
 * Lists the workspace's channels for the client channel picker and checks
 * a channel before a client is pointed at it, so a bad ID fails on save
 * instead of when the summary is posted.
 * - live: conversations.list / conversations.info with SLACK_BOT_TOKEN. The
 *   bot joins public channels by itself (conversations.join, scope
 *   channels:join). Private channels are only visible once someone has
 *   run `/invite @bot` in them, so an unknown ID is rejected with that hint.
 * - mock: a few fake channels; any well-formed ID is accepted.
 */

import { z } from 'zod';
import { getDefaultClientChannel, getSlackMode } from '../../config/integrations';
import { createLogger } from '../../lib/logger';

const log = createLogger('slack');

const API_URL = 'https://slack.com/api';
const LIST_CACHE_MS = 5 * 60_000;
const LIST_PAGE_SIZE = 200;
const LIST_MAX_PAGES = 10;

/** Public (C…) or private (G…, older workspaces) channel ID */
export const slackChannelIdSchema = z
  .string()
  .trim()
  .regex(/^[CG][A-Z0-9]{6,}$/, 'Use a Slack channel ID like C0123ABCD, not the channel name');

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  /** Whether the bot is in the channel (it posts without joining public ones) */
  is_member: boolean;
}

/** A channel that cannot be used; `status` is the HTTP status for the API */
export class SlackChannelError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'SlackChannelError';
  }
}

interface ApiChannel {
  id: string;
  name: string;
  is_private?: boolean;
  is_member?: boolean;
  is_archived?: boolean;
}

interface ApiResponse {
  ok: boolean;
  error?: string;
  channel?: ApiChannel;
  channels?: ApiChannel[];
  response_metadata?: { next_cursor?: string };
}

const toChannel = (c: ApiChannel): SlackChannel => ({
  id: c.id,
  name: c.name,
  is_private: !!c.is_private,
  is_member: !!c.is_member,
});

const byName = (a: SlackChannel, b: SlackChannel) => a.name.localeCompare(b.name);

/** Slack Web API call; form-encoded, which every method accepts */
const callApi = async (method: string, params: Record<string, string>): Promise<ApiResponse> => {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new SlackChannelError('SLACK_MODE=live requires SLACK_BOT_TOKEN', 503);

  const response = await fetch(`${API_URL}/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });
  if (response.status === 429) {
    throw new SlackChannelError('Slack is rate limiting channel lookups; try again in a minute', 503);
  }
  if (!response.ok) {
    throw new SlackChannelError(`Slack HTTP ${response.status} ${response.statusText}`, 502);
  }
  return (await response.json()) as ApiResponse;
};

const listPages = async (types: string): Promise<ApiResponse & { all: ApiChannel[] }> => {
  const all: ApiChannel[] = [];
  let cursor = '';
  for (let page = 0; page < LIST_MAX_PAGES; page++) {
    const body = await callApi('conversations.list', {
      types,
      exclude_archived: 'true',
      limit: String(LIST_PAGE_SIZE),
      ...(cursor && { cursor }),
    });
    if (!body.ok) return { ...body, all };
    all.push(...(body.channels ?? []));
    cursor = body.response_metadata?.next_cursor ?? '';
    if (!cursor) break;
  }
  return { ok: true, all };
};

const listLive = async (): Promise<SlackChannel[]> => {
  let result = await listPages('public_channel,private_channel');
  // Without groups:read, list public channels only
  if (!result.ok && result.error === 'missing_scope') {
    log.warn('⚠️ Slack bot lacks groups:read; listing public channels only');
    result = await listPages('public_channel');
  }
  if (!result.ok) {
    throw new SlackChannelError(`Slack error listing channels: ${result.error ?? 'unknown_error'}`, 502);
  }
  return result.all.map(toChannel).sort(byName);
};

const prepareLive = async (channelId: string): Promise<SlackChannel> => {
  const info = await callApi('conversations.info', { channel: channelId });
  if (!info.ok || !info.channel) {
    if (info.error === 'channel_not_found') {
      throw new SlackChannelError(
        `Channel ${channelId} not found. If it is private, run /invite @<bot> in it first`,
        400,
      );
    }
    throw new SlackChannelError(`Slack error checking channel: ${info.error ?? 'unknown_error'}`, 502);
  }
  if (info.channel.is_archived) {
    throw new SlackChannelError(`#${info.channel.name} is archived`, 400);
  }

  const channel = toChannel(info.channel);
  if (channel.is_member || channel.is_private) return channel;

  const joined = await callApi('conversations.join', { channel: channelId });
  if (joined.ok) {
    log.info(`🤝 Joined #${channel.name}`);
    return { ...channel, is_member: true };
  }
  // chat:write.public still lets the bot post without joining
  log.warn(`⚠️ Could not join #${channel.name}: ${joined.error ?? 'unknown_error'}`);
  return channel;
};

const mockChannels = (): SlackChannel[] => {
  const channels: SlackChannel[] = [
    { id: 'C0MOCKACME01', name: 'client-acme', is_private: false, is_member: true },
    { id: 'C0MOCKNWIND1', name: 'client-northwind', is_private: false, is_member: false },
    { id: 'G0MOCKPRIV01', name: 'client-globex-private', is_private: true, is_member: true },
  ];
  const fallback = getDefaultClientChannel();
  if (slackChannelIdSchema.safeParse(fallback).success) {
    channels.push({ id: fallback, name: 'coaching-demo', is_private: false, is_member: true });
  }
  return channels.sort(byName);
};

let cache: { at: number; channels: SlackChannel[] } | null = null;

/** Workspace channels by name; cached for a few minutes unless `refresh` */
export const listSlackChannels = async (refresh = false): Promise<SlackChannel[]> => {
  if (getSlackMode() === 'mock') return mockChannels();
  if (!refresh && cache && Date.now() - cache.at < LIST_CACHE_MS) return cache.channels;
  const channels = await listLive();
  cache = { at: Date.now(), channels };
  return channels;
};

/**
 * Checks that a client can post to the channel and, for a public channel,
 * adds the bot to it. Throws SlackChannelError when it cannot be used.
 */
export const prepareClientChannel = async (channelId: string): Promise<SlackChannel> => {
  if (getSlackMode() === 'mock') {
    return (
      mockChannels().find((c) => c.id === channelId) ?? {
        id: channelId,
        name: channelId,
        is_private: false,
        is_member: true,
      }
    );
  }
  const channel = await prepareLive(channelId);
  cache = null;
  return channel;
};
