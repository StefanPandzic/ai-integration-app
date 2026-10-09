import { Badge, Tab, TabList, TabPanel, TabPanels, Tabs } from '@chakra-ui/react';
import { skipToken } from '@reduxjs/toolkit/query';
import { useSearchParams } from 'react-router-dom';
import { PageHeader, Panel, QueryState } from '../components';
import {
  DriveOutbox,
  SlackOutbox,
  useGetOutboxItemQuery,
  useListOutboxQuery,
  type OutboxService,
} from '../features/outbox';
import { useLivePollInterval } from '../features/live';

const TABS: OutboxService[] = ['slack', 'drive'];

/**
 * What the mock Slack and Drive connectors sent and saved. Selection
 * lives in the URL (?tab=&item=&channel=) so reports and calls can link here.
 */
export const OutboxPage = () => {
  const pollingInterval = useLivePollInterval();
  const [params, setParams] = useSearchParams();
  const tab: OutboxService = params.get('tab') === 'drive' ? 'drive' : 'slack';
  const itemId = params.get('item');

  const slack = useListOutboxQuery({ service: 'slack' }, { pollingInterval });
  const drive = useListOutboxQuery({ service: 'drive' }, { pollingInterval });

  const slackItems = slack.data ?? [];
  const driveItems = drive.data ?? [];
  const selectedTarget =
    params.get('channel') ??
    slackItems.find((item) => item.id === itemId)?.target ??
    slackItems[0]?.target ??
    null;
  const selectedDocId = tab === 'drive' ? (itemId ?? driveItems[0]?.id ?? null) : null;
  const document = useGetOutboxItemQuery(selectedDocId ?? skipToken);

  const update = (next: Record<string, string>) => setParams(next, { replace: true });

  return (
    <>
      <PageHeader
        title='Outbox'
        subtitle='Slack and Google Drive are mocked in this demo: everything they would have sent or saved is shown here.'
      />
      <Panel>
        <Tabs
          colorScheme='brand'
          index={TABS.indexOf(tab)}
          onChange={(index) => update({ tab: TABS[index] })}
          isLazy
        >
          <TabList px={5}>
            <Tab py={3}>
              Slack <Badge ml={2}>{slackItems.length}</Badge>
            </Tab>
            <Tab py={3}>
              Drive <Badge ml={2}>{driveItems.length}</Badge>
            </Tab>
          </TabList>
          <TabPanels>
            <TabPanel p={0}>
              <QueryState isLoading={slack.isLoading} error={slack.error}>
                <SlackOutbox
                  items={slackItems}
                  selectedTarget={selectedTarget}
                  highlightedItemId={itemId}
                  onSelectTarget={(channel) => update({ tab: 'slack', channel })}
                />
              </QueryState>
            </TabPanel>
            <TabPanel p={0}>
              <QueryState isLoading={drive.isLoading} error={drive.error}>
                <DriveOutbox
                  items={driveItems}
                  selectedItemId={selectedDocId}
                  document={document.data ?? null}
                  isLoadingDocument={document.isFetching}
                  onSelect={(item) => update({ tab: 'drive', item })}
                />
              </QueryState>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Panel>
    </>
  );
};
