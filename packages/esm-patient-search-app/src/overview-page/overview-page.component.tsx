import React from 'react';
import { launchWorkspace, PageHeader, PageHeaderContent } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import styles from './overview-page.scss';
import OverviewIllustration from './overview-illustration.component';
import PatientSearchTile from '../patient-search/patient-search-view.component';

const OverViewComponent: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className={`omrs-main-content`}>
      <PageHeader className={styles.header} data-testid="patient-queue-header">
        <PageHeaderContent
          title={t('registration', 'Registration')}
          illustration={<OverviewIllustration />}
        />
      </PageHeader>
      <div>
        <PatientSearchTile/>
      </div>
    </div>
  );
};

export default OverViewComponent;
