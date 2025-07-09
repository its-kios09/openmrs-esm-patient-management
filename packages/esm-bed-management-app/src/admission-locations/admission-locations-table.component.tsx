import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DataTable,
  DataTableSkeleton,
  Dropdown,
  InlineLoading,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  Tile,
} from '@carbon/react';
import { Add, Edit } from '@carbon/react/icons';
import {
  ErrorState,
  WorkspaceContainer,
  isDesktop as desktopLayout,
  launchWorkspace,
  useLayoutType,
  usePagination,
} from '@openmrs/esm-framework';
import CardHeader from '../card-header/card-header.component';
import styles from './admission-locations-table.scss';
import { type AdmissionLocation } from '../types';

interface AdmissionLocationProps {
  admissionLocations: Array<AdmissionLocation>;
  mutate: () => void;
  isLoading: boolean;
  error: Error | null;
}

const AdmissionLocationsTable: React.FC<AdmissionLocationProps> = ({
  admissionLocations,
  mutate,
  isLoading,
  error,
}) => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const isTablet = layout === 'tablet';
  const responsiveSize = isTablet ? 'lg' : 'sm';
  const isDesktop = desktopLayout(layout);

  const [filterOption, setFilterOption] = useState('ALL');

  const handleLocationFilterChange = ({ selectedItem }: { selectedItem: string }) =>
    setFilterOption(selectedItem.trim().toUpperCase());

  const wardSummaryData = useMemo(() => {
    if (!admissionLocations || !Array.isArray(admissionLocations)) {
      return [];
    }

    return admissionLocations.map((location) => ({
      uuid: location.ward?.uuid || '',
      wardName: location.ward?.display || location.ward?.name || 'Unknown Ward',
      totalBeds: location.totalBeds || 0,
      occupiedBeds: location.occupiedBeds || 0,
      availableBeds: (location.totalBeds || 0) - (location.occupiedBeds || 0),
      ward: location.ward,
      description: location.ward?.description || '',
    }));
  }, [admissionLocations]);

  const locationOptions = useMemo(() => {
    const uniqueLocations = [...new Set(wardSummaryData.map((ward) => ward.wardName))];
    return ['All', ...uniqueLocations.sort()];
  }, [wardSummaryData]);

  const filteredData = useMemo(() => {
    if (filterOption === 'ALL') {
      return wardSummaryData;
    }
    return wardSummaryData.filter(
      (ward) =>
        ward.wardName.toUpperCase().includes(filterOption.toUpperCase()) ||
        ward.wardName.toUpperCase() === filterOption.toUpperCase(),
    );
  }, [wardSummaryData, filterOption]);

  const [pageSize, setPageSize] = useState(10);
  const { results: paginatedData, currentPage, goTo } = usePagination(filteredData, pageSize);

  const handleAddLocationWorkspace = () => {
    launchWorkspace('add-location-workspace', {
      workspaceTitle: t('addLocation', 'Add Location'),
      mutateLocation: mutate,
    });
  };

  const getOccupancyStatus = (occupancyRate: number) => {
    if (occupancyRate >= 90) return { status: 'high', color: 'red' };
    if (occupancyRate >= 70) return { status: 'medium', color: 'yellow' };
    return { status: 'low', color: 'green' };
  };

  const tableHeaders = [
    {
      key: 'wardName',
      header: t('locationName', 'Location Name'),
    },
    {
      key: 'totalBeds',
      header: t('totalBeds', 'Total Beds'),
    },
    {
      key: 'occupiedBeds',
      header: t('occupiedBeds', 'Occupied Beds'),
    },
    {
      key: 'availableBeds',
      header: t('availableBeds', 'Available Beds'),
    },
    {
      key: 'occupancyRate',
      header: t('occupancyRate', 'Occupancy Rate'),
    },
    {
      key: 'actions',
      header: t('actions', 'Actions'),
    },
  ];

  const tableRows = useMemo(() => {
    return paginatedData.map((ward) => {
      const occupancyRate = ward.totalBeds > 0 ? ((ward.occupiedBeds / ward.totalBeds) * 100).toFixed(1) : '0.0';
      const occupancyStatus = getOccupancyStatus(parseFloat(occupancyRate));

      return {
        id: ward.uuid,
        wardName: ward.wardName,
        totalBeds: ward.totalBeds,
        occupiedBeds: ward.occupiedBeds,
        availableBeds: ward.availableBeds,
        occupancyRate: (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{occupancyRate}%</span>
            <Tag type={occupancyStatus.color} size="sm">
              {occupancyStatus.status}
            </Tag>
          </div>
        ),
        actions: (
          <>
            <Button
              enterDelayMs={300}
              renderIcon={Edit}
              onClick={() => {
                launchWorkspace('add-location-workspace', {
                  workspaceTitle: t('editLocation', 'Edit location'),
                  ward,
                  mutateLocation: mutate,
                });
              }}
              kind={'ghost'}
              iconDescription={t('editLocation', 'Edit location')}
              hasIconOnly
              size={responsiveSize}
              tooltipPosition="right"
            />
          </>
        ),
      };
    });
  }, [paginatedData, responsiveSize, mutate, t]);

  if (isLoading && !admissionLocations?.length) {
    return (
      <>
        <div className={styles.widgetCard}>
          <DataTableSkeleton role="progressbar" compact={isDesktop} zebra />
        </div>
      </>
    );
  }

  if (error) {
    const headerTitle = t('errorFetchingBedsGroupedByLocation', 'Error fetching beds grouped by location');
    return (
      <>
        <div className={styles.widgetCard}>
          <ErrorState error={error} headerTitle={headerTitle} />
        </div>
      </>
    );
  }

  return (
    <>
      <div className={styles.widgetCard}>
        <CardHeader title={t('admissionLocations', 'Admission Locations')}>
          <span className={styles.backgroundDataFetchingIndicator}>
            <span>{isLoading ? <InlineLoading /> : null}</span>
          </span>
          <div className={styles.headerActions}>
            {wardSummaryData?.length ? (
              <>
                <div className={styles.filterContainer}>
                  <Dropdown
                    id="locationFilter"
                    initialSelectedItem={'All'}
                    label=""
                    titleText={t('filterByLocation', 'Filter by location') + ':'}
                    type="inline"
                    items={locationOptions}
                    onChange={handleLocationFilterChange}
                  />
                </div>
                <Button
                  kind="ghost"
                  renderIcon={(props) => <Add size={16} {...props} />}
                  onClick={handleAddLocationWorkspace}>
                  {t('addLocation', 'Add Location')}
                </Button>
              </>
            ) : null}
          </div>
        </CardHeader>
        <DataTable rows={tableRows} headers={tableHeaders} isSortable size={isTablet ? 'lg' : 'sm'} useZebraStyles>
          {({ rows, headers, getTableProps }) => {
            return (
              <TableContainer>
                <Table {...getTableProps()}>
                  <TableHead>
                    <TableRow>
                      {headers.map((header) => (
                        <TableHeader key={header.key}>{header.header?.content ?? header.header}</TableHeader>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id}>{cell.value}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {rows.length === 0 ? (
                  <div className={styles.tileContainer}>
                    <Tile className={styles.tile}>
                      <div className={styles.tileContent}>
                        <p className={styles.content}>{t('No data', 'No data to display')}</p>
                        <p className={styles.helper}>{t('checkFilters', 'Check the filters above')}</p>
                      </div>
                      <p className={styles.separator}>{t('or', 'or')}</p>
                      <Button
                        kind="ghost"
                        size="sm"
                        renderIcon={(props) => <Add size={16} {...props} />}
                        onClick={handleAddLocationWorkspace}>
                        {t('addLocation', 'Add Location')}
                      </Button>
                    </Tile>
                  </div>
                ) : null}
                <Pagination
                  backwardText="Previous page"
                  forwardText="Next page"
                  page={currentPage}
                  pageNumberText="Page Number"
                  pageSize={pageSize}
                  pageSizes={[10, 20, 30, 40, 50]}
                  totalItems={filteredData.length}
                  onChange={({ pageSize: newPageSize, page }) => {
                    if (newPageSize !== pageSize) {
                      setPageSize(newPageSize);
                      goTo(1);
                    }
                    if (page !== currentPage) {
                      goTo(page);
                    }
                  }}
                />
              </TableContainer>
            );
          }}
        </DataTable>
      </div>
      <WorkspaceContainer contextKey="bed-management" />
    </>
  );
};

export default AdmissionLocationsTable;
