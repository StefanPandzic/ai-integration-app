import {
  Box,
  Text,
  VStack,
  HStack,
  IconButton,
  Badge,
  Spinner,
} from '@chakra-ui/react';
import { DeleteIcon, ChatIcon } from '@chakra-ui/icons';
import { useAppColors } from '../../../constants/colors';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { deleteTranscription } from '../../../store/slices/transcriptionSlice';

/**
 * ConversationHistory - AI conversation history display
 *
 * Redux-connected component that displays chat-style conversation history
 * (user messages + AI responses). Owned by the AI feature since it manages
 * the conversation flow and response generation.
 *
 * No props needed - reads directly from Redux store.
 */

export const ConversationHistory = () => {
  const colors = useAppColors();
  const dispatch = useAppDispatch();
  const history = useAppSelector((state) => state.transcription.history);

  const handleDelete = (id: string) => {
    dispatch(deleteTranscription(id));
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <Box
      bg={colors.bgPrimary}
      borderRadius='2xl'
      borderWidth='1px'
      borderColor={colors.borderPrimary}
      boxShadow='base'
      h='625px'
      display='flex'
      flexDirection='column'
      overflow='hidden'
    >
      <Box
        p={6}
        borderBottomWidth='1px'
        borderColor={colors.borderPrimary}
        position='sticky'
        top={0}
        bg={colors.bgPrimary}
        zIndex={1}
      >
        <HStack justify='space-between' align='center'>
          <HStack spacing={2}>
            <ChatIcon boxSize={5} color='purple.500' />
            <Text fontSize='xl' fontWeight='bold' color={colors.textPrimary}>
              Chat History
            </Text>
          </HStack>
          <Badge
            colorScheme='purple'
            fontSize='sm'
            px={3}
            py={1}
            borderRadius='full'
          >
            {history.length}
          </Badge>
        </HStack>
      </Box>

      <Box flex='1' overflowY='auto' p={6}>
        {history.length === 0 ? (
          <VStack h='100%' justify='center' spacing={4}>
            <Box
              w='80px'
              h='80px'
              bg={colors.bgSecondary}
              borderRadius='full'
              display='flex'
              alignItems='center'
              justifyContent='center'
            >
              <ChatIcon boxSize={10} color={colors.textSecondary} />
            </Box>
            <Text
              fontSize='lg'
              fontWeight='semibold'
              color={colors.textPrimary}
            >
              No messages yet
            </Text>
            <Text
              color={colors.textSecondary}
              fontSize='sm'
              textAlign='center'
              maxW='300px'
            >
              Start recording to chat with AI. Your transcription will be sent
              and AI will respond!
            </Text>
          </VStack>
        ) : (
          <VStack spacing={6} align='stretch'>
            {history
              .slice()
              .reverse()
              .map((transcription) => (
                <Box key={transcription.id}>
                  <HStack justify='flex-end' mb={2} spacing={2}>
                    <Text fontSize='xs' color={colors.textSecondary}>
                      {formatDate(transcription.timestamp)}
                    </Text>
                    <IconButton
                      aria-label='Delete message'
                      icon={<DeleteIcon />}
                      size='xs'
                      colorScheme='red'
                      variant='ghost'
                      borderRadius='full'
                      onClick={() => handleDelete(transcription.id)}
                    />
                  </HStack>
                  <HStack justify='flex-end' align='start' mb={4}>
                    <Box maxW='85%'>
                      <Box
                        bg='purple.600'
                        color='white'
                        px={4}
                        py={3}
                        borderRadius='2xl'
                        borderBottomRightRadius='md'
                        boxShadow='md'
                      >
                        <Text fontSize='md' lineHeight='tall'>
                          {transcription.text}
                        </Text>
                      </Box>
                      <HStack justify='flex-end' mt={1} spacing={2}>
                        <Badge
                          colorScheme='blue'
                          fontSize='xs'
                          px={2}
                          borderRadius='full'
                        >
                          You
                        </Badge>
                      </HStack>
                    </Box>
                  </HStack>

                  {transcription.isGeneratingResponse && (
                    <HStack justify='flex-start' align='start'>
                      <Box maxW='85%'>
                        <Box
                          bg={colors.bgAiBubble}
                          px={4}
                          py={3}
                          borderRadius='2xl'
                          borderBottomLeftRadius='md'
                          boxShadow='md'
                        >
                          <HStack spacing={3}>
                            <Spinner size='sm' color='purple.500' />
                            <Text
                              fontSize='sm'
                              fontStyle='italic'
                              color={colors.textPurple}
                            >
                              AI is thinking...
                            </Text>
                          </HStack>
                        </Box>
                        <Badge
                          colorScheme='green'
                          fontSize='xs'
                          px={2}
                          mt={1}
                          borderRadius='full'
                        >
                          🤖 AI Assistant
                        </Badge>
                      </Box>
                    </HStack>
                  )}

                  {transcription.aiResponse &&
                    !transcription.isGeneratingResponse && (
                      <HStack justify='flex-start' align='start'>
                        <Box maxW='85%'>
                          <Box
                            bg={colors.bgAiBubble}
                            px={4}
                            py={3}
                            borderRadius='2xl'
                            borderBottomLeftRadius='md'
                            boxShadow='md'
                            borderWidth='1px'
                            borderColor={colors.borderGreen}
                          >
                            <Text
                              fontSize='md'
                              lineHeight='tall'
                              color={colors.textPrimary}
                            >
                              {transcription.aiResponse}
                            </Text>
                          </Box>
                          <Badge
                            colorScheme='green'
                            fontSize='xs'
                            px={2}
                            mt={1}
                            borderRadius='full'
                          >
                            🤖 AI Assistant
                          </Badge>
                        </Box>
                      </HStack>
                    )}
                </Box>
              ))}
          </VStack>
        )}
      </Box>
    </Box>
  );
};
