import React from 'react';
import { DataTableSkeleton , ContentSwitcher , Switch } from '@carbon/react';
import { ArrowRight } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';
import { ConfigurableLink, ErrorState } from '@openmrs/esm-framework';
import { useAdmissionLocations } from './summary.resource';
import EmptyState from '../empty-state/empty-state.component';
import WardCard from '../ward-card/ward-card.component';
import styles from './summary.scss';
import CardHeader from '../card-header/card-header.component';
import AdmissionLocationsTable from '../admission-locations/admission-locations-table.component';

const Summary: React.FC = () => {
  const { t } = useTranslation();
  const [selectedView, setSelectedView] = React.useState(0);
  const { data: admissionLocations, isLoading, error, mutate } = useAdmissionLocations();

  if (isLoading) {
    return (
      <div className={styles.loader}>
        <DataTableSkeleton role="progressbar" zebra />
      </div>
    );
  }

  if (admissionLocations?.length) {
    return (
      <>
        <div className={styles.switcherContainer}>
          <CardHeader title={t('summary', 'Summary')}>
            <ContentSwitcher
              size="sm"
              className={styles.switcher}
              selectedIndex={selectedView}
              onChange={({ index }) => {
                setSelectedView(index);
              }}>
              <Switch>{t('listView', 'List')}</Switch>
              <Switch>{t('cardView', 'Card')}</Switch>
            </ContentSwitcher>
          </CardHeader>
        </div>
        {selectedView === 0 ? (
          <div className={styles.switcherContainer}>
            <AdmissionLocationsTable
              admissionLocations={admissionLocations}
              mutate={mutate}
              isLoading={isLoading}
              error={error}
            />
          </div>
        ) : (
          <div className={styles.cardContainer}>
            {admissionLocations.map((admissionLocation) => {
              const routeSegment = `${window.getOpenmrsSpaBase()}bed-management/location/${
                admissionLocation.ward.uuid
              }`;

              return (
                <WardCard
                  headerLabel={admissionLocation.ward.display}
                  label={t('beds', 'Beds')}
                  value={admissionLocation?.totalBeds}>
                  {admissionLocation?.totalBeds && (
                    <div className={styles.link}>
                      <ConfigurableLink className={styles.link} to={routeSegment}>
                        {t('viewBeds', 'View beds')}
                      </ConfigurableLink>
                      <ArrowRight size={16} />
                    </div>
                  )}
                </WardCard>
              );
            })}
          </div>
        )}
      </>
    );
  }

  if (!isLoading && admissionLocations?.length === 0 && !error) {
    return <EmptyState msg="No data to display" helper={''} />;
  }

  if (error) {
    return (
      <ErrorState headerTitle={t('errorFetchingbedInformation', 'Error fetching bed information')} error={error} />
    );
  }
};

export default Summary;
