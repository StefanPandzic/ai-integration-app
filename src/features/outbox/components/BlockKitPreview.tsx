import { Box, Button, Divider, HStack, Link, SimpleGrid, Text, VStack } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { useAppColors } from '../../../constants/colors';
import type { SlackBlock, SlackButton, SlackText } from '../types';

const unescape = (text: string): string =>
  text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const isButton = (element: SlackText | SlackButton): element is SlackButton =>
  element.type === 'button';

// <url|label>, *bold*, _italic_
const TOKEN = /<([^|>]+)\|([^>]+)>|\*([^*\n]+)\*|_([^_\n]+)_/g;

/** Approximate mrkdwn rendering: links, bold, italic, quotes, line breaks */
const Mrkdwn = ({ text }: { text: string }) => {
  const colors = useAppColors();

  const renderInline = (line: string, lineKey: number): ReactNode[] => {
    const nodes: ReactNode[] = [];
    let last = 0;
    for (const match of line.matchAll(TOKEN)) {
      const index = match.index ?? 0;
      if (index > last) nodes.push(unescape(line.slice(last, index)));
      const key = `${lineKey}-${index}`;
      if (match[1]) {
        nodes.push(
          <Link key={key} href={match[1]} color={colors.textAccent} isExternal>
            {unescape(match[2])}
          </Link>,
        );
      } else if (match[3]) {
        nodes.push(<strong key={key}>{unescape(match[3])}</strong>);
      } else if (match[4]) {
        nodes.push(<em key={key}>{unescape(match[4])}</em>);
      }
      last = index + match[0].length;
    }
    if (last < line.length) nodes.push(unescape(line.slice(last)));
    return nodes;
  };

  return (
    <VStack align='stretch' spacing={0.5}>
      {text.split('\n').map((line, i) =>
        line.startsWith('> ') ? (
          <Box key={i} borderLeftWidth='3px' borderColor={colors.quoteBorder} pl={3} fontSize='sm' color={colors.textPrimary}>
            {renderInline(line.slice(2), i)}
          </Box>
        ) : (
          <Text key={i} fontSize='sm' color={colors.textPrimary} minH={line ? undefined : 2}>
            {renderInline(line, i)}
          </Text>
        ),
      )}
    </VStack>
  );
};

const renderText = (text: SlackText) =>
  text.type === 'mrkdwn' ? <Mrkdwn text={text.text} /> : <Text fontSize='sm'>{text.text}</Text>;

/** Renders the Block Kit subset our message builders produce */
export const BlockKitPreview = ({ blocks }: { blocks: SlackBlock[] }) => {
  const colors = useAppColors();

  return (
    <VStack align='stretch' spacing={3}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'header':
            return (
              <Text key={i} fontWeight='bold' fontSize='md' color={colors.heading}>
                {block.text?.text}
              </Text>
            );
          case 'section':
            return (
              <Box key={i}>
                {block.text && renderText(block.text)}
                {block.fields && (
                  <SimpleGrid columns={2} spacingX={6} spacingY={2} mt={block.text ? 2 : 0}>
                    {block.fields.map((field, j) => (
                      <Box key={j}>{renderText(field)}</Box>
                    ))}
                  </SimpleGrid>
                )}
              </Box>
            );
          case 'context':
            return (
              <HStack key={i} spacing={2} fontSize='xs' color={colors.textSecondary}>
                {(block.elements ?? []).map((element, j) =>
                  isButton(element) ? null : (
                    <Box key={j} fontSize='xs' sx={{ '& p': { fontSize: 'xs', color: colors.textSecondary } }}>
                      {renderText(element)}
                    </Box>
                  ),
                )}
              </HStack>
            );
          case 'actions':
            return (
              <HStack key={i} spacing={2}>
                {(block.elements ?? []).filter(isButton).map((button, j) => (
                  <Button key={j} as='a' href={button.url} target='_blank' rel='noreferrer' size='xs' variant='outline'>
                    {button.text.text}
                  </Button>
                ))}
              </HStack>
            );
          case 'divider':
            return <Divider key={i} />;
          default:
            return (
              <Text key={i} fontSize='xs' color={colors.textSecondary}>
                [{block.type} block]
              </Text>
            );
        }
      })}
    </VStack>
  );
};
