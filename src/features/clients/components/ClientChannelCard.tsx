import { Button, HStack, Link, Text, VStack } from '@chakra-ui/react';
import { useState } from 'react';
import { Panel } from '../../../components';
import { useAppColors } from '../../../constants/colors';
import { SlackChannelSelect, isSlackChannelId, type SlackChannelOptions } from '../../slack';

interface ClientChannelCardProps {
  channelId: string;
  slackChannels: SlackChannelOptions;
  isSaving: boolean;
  /** Resolves true once saved, to close the editor */
  onSave: (channelId: string) => Promise<boolean>;
}

/** Stat card with the client's Slack channel and a picker to change it */
export const ClientChannelCard = ({
  channelId,
  slackChannels,
  isSaving,
  onSave,
}: ClientChannelCardProps) => {
  const colors = useAppColors();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const channel = slackChannels.channels.find((c) => c.id === channelId);

  const save = async () => {
    if (await onSave(draft)) setIsEditing(false);
  };

  return (
    <Panel px={5} py={4}>
      <HStack justify='space-between'>
        <Text fontSize='sm' color={colors.textSecondary}>
          Slack channel
        </Text>
        {!isEditing && (
          <Link
            fontSize='sm'
            color={colors.textAccent}
            onClick={() => {
              setDraft('');
              setIsEditing(true);
            }}
          >
            Change
          </Link>
        )}
      </HStack>
      {isEditing ? (
        <VStack align='stretch' spacing={2} mt={2}>
          <SlackChannelSelect options={slackChannels} value={draft} onChange={setDraft} />
          <HStack justify='flex-end' spacing={2}>
            <Button size='xs' variant='ghost' onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button
              size='xs'
              colorScheme='brand'
              isDisabled={!isSlackChannelId(draft) || draft === channelId}
              isLoading={isSaving}
              onClick={save}
            >
              Save
            </Button>
          </HStack>
        </VStack>
      ) : (
        <Text fontSize='2xl' fontWeight='semibold' color={colors.heading} noOfLines={1} wordBreak='break-all'>
          {channel ? `${channel.is_private ? '🔒' : '#'} ${channel.name}` : channelId}
        </Text>
      )}
    </Panel>
  );
};
