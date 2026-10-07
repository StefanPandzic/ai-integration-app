import { Box, Text, VStack } from '@chakra-ui/react';
import { useAppColors } from '../../../constants/colors';

interface TranscriptViewProps {
  transcript: string;
}

// "Speaker Name: what they said"
const SPEAKER_LINE = /^([^:]{1,60}):\s+(.*)$/;

/** Transcript with speaker turns; unrecognised lines render as-is */
export const TranscriptView = ({ transcript }: TranscriptViewProps) => {
  const colors = useAppColors();
  const lines = transcript.split('\n').filter((line) => line.trim());

  return (
    <VStack align='stretch' spacing={3}>
      {lines.map((line, index) => {
        const match = SPEAKER_LINE.exec(line);
        return (
          <Box key={index}>
            {match ? (
              <>
                <Text fontSize='sm' fontWeight='semibold' color={colors.textAccent}>
                  {match[1]}
                </Text>
                <Text color={colors.textPrimary}>{match[2]}</Text>
              </>
            ) : (
              <Text color={colors.textPrimary}>{line}</Text>
            )}
          </Box>
        );
      })}
    </VStack>
  );
};
