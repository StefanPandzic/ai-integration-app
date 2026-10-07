import { ArrowBackIcon } from '@chakra-ui/icons';
import { HStack, Text } from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import { useAppColors } from '../constants/colors';

interface BackLinkProps {
  to: string;
  label: string;
}

export const BackLink = ({ to, label }: BackLinkProps) => {
  const colors = useAppColors();
  return (
    <Link to={to}>
      <HStack spacing={1} color={colors.textSecondary} _hover={{ color: colors.textAccent }}>
        <ArrowBackIcon />
        <Text fontSize='sm'>{label}</Text>
      </HStack>
    </Link>
  );
};
