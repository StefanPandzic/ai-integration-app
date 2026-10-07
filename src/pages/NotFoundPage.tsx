import { Button } from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import { EmptyState, Panel } from '../components';

export const NotFoundPage = () => (
  <Panel>
    <EmptyState
      title='Page not found'
      action={
        <Button as={Link} to='/calls' size='sm' colorScheme='brand' mt={2}>
          Go to calls
        </Button>
      }
    />
  </Panel>
);
