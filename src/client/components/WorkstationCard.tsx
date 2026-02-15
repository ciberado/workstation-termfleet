import { Card, Badge, Text, Button, Group, Stack } from '@mantine/core';
import { IconExternalLink, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Workstation, WorkstationStatus } from '@/shared/types';
import { deleteWorkstation } from '@/client/services/api';
import { notifications } from '@mantine/notifications';

dayjs.extend(relativeTime);

interface WorkstationCardProps {
  workstation: Workstation;
  onDeleted?: () => void;
}

export function WorkstationCard({ workstation, onDeleted }: WorkstationCardProps) {
  const statusColor = getStatusColor(workstation.status);

  const handleOpenTtyd = () => {
    const url = `https://${workstation.domain_name}`;
    window.open(url, '_blank');
  };

  const handleHide = async () => {
    try {
      await deleteWorkstation(workstation.name);
      notifications.show({
        title: 'Success',
        message: `Workstation "${workstation.name}" hidden`,
        color: 'green',
      });
      onDeleted?.();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to hide workstation',
        color: 'red',
      });
    }
  };

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="sm">
        {/* Header */}
        <Group justify="space-between">
          <Text fw={700} size="lg">
            {workstation.name}
          </Text>
          <Badge color={statusColor} variant="filled">
            {workstation.status}
          </Badge>
        </Group>

        {/* Info */}
        <Stack gap="xs">
          <Text size="sm">
            <Text component="span" fw={600}>
              IP:
            </Text>{' '}
            {workstation.ip_address}
          </Text>
          <Text size="sm">
            <Text component="span" fw={600}>
              Domain:
            </Text>{' '}
            <Text
              component="a"
              href={`https://${workstation.domain_name}`}
              target="_blank"
              rel="noopener noreferrer"
              c="blue"
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
            >
              {workstation.domain_name}
            </Text>
          </Text>
          {workstation.last_check && (
            <Text size="sm" c="dimmed">
              Last check: {dayjs(workstation.last_check).fromNow()}
            </Text>
          )}
          {workstation.dns_error && (
            <Text size="xs" c="red">
              DNS Error: {workstation.dns_error}
            </Text>
          )}
        </Stack>

        {/* Actions */}
        {workstation.status === WorkstationStatus.ONLINE ? (
          <Button
            fullWidth
            variant="filled"
            color="blue"
            rightSection={<IconExternalLink size={16} />}
            onClick={handleOpenTtyd}
          >
            Open Terminal
          </Button>
        ) : (
          <Group grow>
            <Button
              variant="filled"
              color="blue"
              rightSection={<IconExternalLink size={16} />}
              onClick={handleOpenTtyd}
              disabled={workstation.status === WorkstationStatus.TERMINATED || workstation.status === WorkstationStatus.DNS_FAILED}
            >
              Open Terminal
            </Button>
            <Button
              variant="light"
              color="red"
              rightSection={<IconTrash size={16} />}
              onClick={handleHide}
            >
              Hide
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  );
}

function getStatusColor(status: WorkstationStatus): string {
  switch (status) {
    case WorkstationStatus.ONLINE:
      return 'green';
    case WorkstationStatus.STARTING:
      return 'yellow';
    case WorkstationStatus.UNKNOWN:
      return 'red';
    case WorkstationStatus.DNS_FAILED:
      return 'orange';
    case WorkstationStatus.TERMINATED:
      return 'gray';
    default:
      return 'gray';
  }
}
