import { Alert, AlertDescription, AlertIcon, Center, Spinner } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { getErrorMessage } from '../store/api';

interface QueryStateProps {
  isLoading: boolean;
  error: unknown;
  children: ReactNode;
}

/** Spinner on first load, alert on error, otherwise the content */
export const QueryState = ({ isLoading, error, children }: QueryStateProps) => {
  if (isLoading) {
    return (
      <Center py={16}>
        <Spinner color='brand.500' />
      </Center>
    );
  }

  const message = getErrorMessage(error);
  if (message) {
    return (
      <Alert status='error' borderRadius='lg'>
        <AlertIcon />
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
};
