import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Grid,
  Select,
  Group,
  Text,
  Loader,
  Alert,
  Badge,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { WorkstationCard } from '../components/WorkstationCard';
import { fetchWorkstations } from '../services/api';
import { Workstation, WorkstationStatus } from '../../../shared/types';

function Dashboard() {
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Filters
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<string>('asc');

  // Fetch workstations
  const loadWorkstations = async () => {
    try {
      setError(null);
      const data = await fetchWorkstations({
        status: statusFilter as WorkstationStatus | undefined,
        sort: sortField,
        order: sortOrder,
      });
      setWorkstations(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workstations');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadWorkstations();
  }, [statusFilter, sortField, sortOrder]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadWorkstations();
    }, 5000);

    return () => clearInterval(interval);
  }, [statusFilter, sortField, sortOrder]);

  // Count by status
  const statusCounts = workstations.reduce((acc, ws) => {
    acc[ws.status] = (acc[ws.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading && workstations.length === 0) {
    return (
      <Container size="xl" py="xl">
        <Group justify="center" mt={100}>
          <Loader size="lg" />
          <Text size="lg">Loading workstations...</Text>
        </Group>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Title order={1} mb="md">
        Termfleet Dashboard
      </Title>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
          {error}
        </Alert>
      )}

      {/* Summary bar */}
      <Group mb="xl">
        <Badge size="lg" variant="filled" color="gray">
          Total: {workstations.length}
        </Badge>
        {Object.entries(statusCounts).map(([status, count]) => (
          <Badge
            key={status}
            size="lg"
            variant="filled"
            color={getStatusColor(status as WorkstationStatus)}
          >
            {status}: {count}
          </Badge>
        ))}
      </Group>

      {/* Filters */}
      <Group mb="xl">
        <Select
          label="Status Filter"
          placeholder="All"
          clearable
          value={statusFilter}
          onChange={setStatusFilter}
          data={[
            { value: WorkstationStatus.ONLINE, label: 'Online' },
            { value: WorkstationStatus.STARTING, label: 'Starting' },
            { value: WorkstationStatus.UNKNOWN, label: 'Unknown' },
            { value: WorkstationStatus.DNS_FAILED, label: 'DNS Failed' },
            { value: WorkstationStatus.TERMINATED, label: 'Terminated' },
          ]}
        />
        <Select
          label="Sort By"
          value={sortField}
          onChange={(value) => setSortField(value || 'name')}
          data={[
            { value: 'name', label: 'Name' },
            { value: 'status', label: 'Status' },
            { value: 'created_at', label: 'Created' },
            { value: 'last_check', label: 'Last Check' },
          ]}
        />
        <Select
          label="Order"
          value={sortOrder}
          onChange={(value) => setSortOrder(value || 'asc')}
          data={[
            { value: 'asc', label: 'Ascending' },
            { value: 'desc', label: 'Descending' },
          ]}
        />
      </Group>

      <Text size="sm" c="dimmed" mb="md">
        Last updated: {lastUpdated.toLocaleTimeString()} (auto-refreshes every 5s)
      </Text>

      {/* Workstation cards */}
      {workstations.length === 0 ? (
        <Alert color="blue" mt="xl">
          No workstations found
        </Alert>
      ) : (
        <Grid>
          {workstations.map((ws) => (
            <Grid.Col key={ws.id} span={{ base: 12, md: 6, lg: 4 }}>
              <WorkstationCard workstation={ws} />
            </Grid.Col>
          ))}
        </Grid>
      )}
    </Container>
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

export default Dashboard;
