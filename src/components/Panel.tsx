import { Box, BoxProps, Flex, Heading } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { useAppColors } from '../constants/colors';

interface PanelProps extends BoxProps {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/** Bordered surface used for every content block */
export const Panel = ({ title, actions, children, ...boxProps }: PanelProps) => {
  const colors = useAppColors();

  return (
    <Box
      bg={colors.bgSurface}
      borderWidth='1px'
      borderColor={colors.border}
      borderRadius='xl'
      {...boxProps}
    >
      {(title || actions) && (
        <Flex
          align='center'
          justify='space-between'
          gap={3}
          flexWrap='wrap'
          px={5}
          py={3}
          borderBottomWidth='1px'
          borderColor={colors.border}
        >
          {title && (
            <Heading size='sm' color={colors.heading}>
              {title}
            </Heading>
          )}
          {actions}
        </Flex>
      )}
      {children}
    </Box>
  );
};
