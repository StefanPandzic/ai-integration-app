import { HStack, Input, Link, Select, Spinner, Text, VStack } from '@chakra-ui/react';
import { useState } from 'react';
import { useAppColors } from '../../../constants/colors';
import type { SlackChannel, SlackChannelOptions } from '../types';
import { isSlackChannelId } from '../utils/channelId';

interface SlackChannelSelectProps {
  options: SlackChannelOptions;
  /** Channel ID; '' for none (the default client channel when allowed) */
  value: string;
  onChange: (channelId: string) => void;
  /** Offer "Default client channel" as the empty choice */
  allowDefault?: boolean;
}

const PASTE = '__paste';

const channelLabel = (channel: SlackChannel): string =>
  `${channel.is_private ? '🔒' : '#'} ${channel.name}` +
  (!channel.is_private && !channel.is_member ? ' (bot will join)' : '');

/** Picks a client's Slack channel from the workspace, or takes a pasted ID */
export const SlackChannelSelect = ({
  options,
  value,
  onChange,
  allowDefault = false,
}: SlackChannelSelectProps) => {
  const colors = useAppColors();
  const { channels, mode, isLoading, error, onRefresh } = options;
  const [pasting, setPasting] = useState(false);
  const selected = channels.find((c) => c.id === value);
  const isPasting = pasting || (!!value && !selected);

  const hint = (() => {
    if (error) return error;
    if (isPasting) {
      if (value && !isSlackChannelId(value)) return 'Use the channel ID (like C0123ABCD), not its name.';
      return 'Private channel? Run /invite @<bot> in it first; otherwise it is rejected.';
    }
    if (selected && !selected.is_private && !selected.is_member) {
      return 'The bot joins this channel when you save.';
    }
    if (mode === 'mock') return 'Slack mock: messages go to the outbox, not Slack.';
    return null;
  })();

  const choose = (next: string) => {
    if (next === PASTE) {
      setPasting(true);
      onChange('');
      return;
    }
    onChange(next);
  };

  const backToList = () => {
    setPasting(false);
    onChange('');
  };

  return (
    <VStack align='stretch' spacing={1}>
      {isPasting ? (
        <Input
          size='sm'
          borderRadius='md'
          placeholder='Slack channel ID, e.g. C0123ABCD'
          value={value}
          isInvalid={!!value && !isSlackChannelId(value)}
          onChange={(e) => onChange(e.target.value.trim())}
        />
      ) : (
        <Select
          size='sm'
          borderRadius='md'
          placeholder={allowDefault ? 'Slack channel: default client channel' : 'Slack channel…'}
          value={value}
          isDisabled={isLoading && channels.length === 0}
          onChange={(e) => choose(e.target.value)}
        >
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channelLabel(channel)}
            </option>
          ))}
          <option value={PASTE}>Other: paste channel ID…</option>
        </Select>
      )}
      <HStack justify='space-between' align='flex-start' spacing={3}>
        <Text fontSize='xs' color={colors.textSecondary}>
          {hint}
        </Text>
        <HStack spacing={3} flexShrink={0}>
          {isPasting && (
            <Link fontSize='xs' color={colors.textAccent} onClick={backToList}>
              Pick from list
            </Link>
          )}
          {isLoading ? (
            <Spinner size='xs' color={colors.textSecondary} />
          ) : (
            <Link fontSize='xs' color={colors.textAccent} onClick={onRefresh}>
              Refresh
            </Link>
          )}
        </HStack>
      </HStack>
    </VStack>
  );
};
