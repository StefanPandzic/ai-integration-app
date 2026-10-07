import { Box, Center, Grid, HStack, Spinner, Text, VStack } from '@chakra-ui/react';
import { EmptyState } from '../../../components';
import { useAppColors } from '../../../constants/colors';
import { formatDateTime } from '../../calls';
import type { OutboxItem } from '../types';
import { groupByTarget } from './SlackOutbox';

interface DriveOutboxProps {
  items: OutboxItem[];
  selectedItemId: string | null;
  /** The selected document with its HTML (loaded separately) */
  document: OutboxItem | null;
  isLoadingDocument: boolean;
  onSelect: (itemId: string) => void;
}

/** Folder tree of saved documents and a sandboxed preview */
export const DriveOutbox = ({ items, selectedItemId, document, isLoadingDocument, onSelect }: DriveOutboxProps) => {
  const colors = useAppColors();

  if (items.length === 0) {
    return (
      <EmptyState
        title='No documents yet'
        description='Weekly reports are archived here as the mock Google Drive connector "saves" them.'
      />
    );
  }

  // Newest folder first
  const folders = groupByTarget(items).reverse();

  return (
    <Grid templateColumns={{ base: '1fr', lg: '280px minmax(0, 1fr)' }} minH='560px'>
      <VStack
        align='stretch'
        spacing={3}
        p={3}
        borderRightWidth={{ base: 0, lg: '1px' }}
        borderBottomWidth={{ base: '1px', lg: 0 }}
        borderColor={colors.border}
      >
        {folders.map(([folder, docs]) => (
          <Box key={folder}>
            <Text fontSize='xs' fontWeight='semibold' color={colors.textSecondary} px={3} mb={1}>
              📁 {folder}
            </Text>
            {docs.map((doc) => (
              <HStack
                key={doc.id}
                pl={6}
                pr={3}
                py={1.5}
                borderRadius='md'
                cursor='pointer'
                bg={doc.id === selectedItemId ? colors.bgActive : undefined}
                _hover={{ bg: doc.id === selectedItemId ? colors.bgActive : colors.bgHover }}
                onClick={() => onSelect(doc.id)}
              >
                <Text fontSize='sm' noOfLines={1} color={doc.id === selectedItemId ? colors.textAccent : colors.textPrimary}>
                  📄 {doc.title}
                </Text>
              </HStack>
            ))}
          </Box>
        ))}
      </VStack>

      <Box p={5} minW={0}>
        {!selectedItemId ? (
          <EmptyState title='Select a document' />
        ) : isLoadingDocument || !document ? (
          <Center py={16}>
            <Spinner color='brand.500' />
          </Center>
        ) : (
          <VStack align='stretch' spacing={3} h='100%'>
            <Text fontSize='xs' color={colors.textSecondary}>
              {document.target}/{document.title} · saved {formatDateTime(document.created_at)} · file ID{' '}
              {document.external_id}
            </Text>
            <Box
              as='iframe'
              title={document.title}
              srcDoc={document.payload.html ?? ''}
              sandbox=''
              w='100%'
              flex={1}
              minH='520px'
              bg='white'
              borderWidth='1px'
              borderColor={colors.border}
              borderRadius='md'
            />
          </VStack>
        )}
      </Box>
    </Grid>
  );
};
