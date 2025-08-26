import React from 'react';
import { Button } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { usePatientSync } from '../../hooks/usePatientSync';

interface PatientSyncButtonProps {
  localPatient: fhir.Patient;
  hiePatient: fhir.Patient;
  size?: 'sm' | 'md' | 'lg';
  kind?: 'primary' | 'secondary' | 'tertiary' | 'ghost';
  disabled?: boolean;
  onSyncSuccess?: (patientUuid: string) => void;
  onSyncError?: (error: Error) => void;
}

export const PatientSyncButton: React.FC<PatientSyncButtonProps> = ({
  localPatient,
  hiePatient,
  size = 'sm',
  kind = 'secondary',
  disabled = false,
  onSyncSuccess,
  onSyncError,
}) => {
  const { t } = useTranslation();
  const { isSyncing, syncPatientData } = usePatientSync({
    onSyncSuccess,
    onSyncError,
  });

  const handleSyncClick = () => {
    console.log('🔘 Sync button clicked');
    syncPatientData(localPatient, hiePatient);
  };

  return (
    <Button
      kind={kind}
      size={size}
      onClick={handleSyncClick}
      disabled={disabled || isSyncing}
      iconDescription={t('syncPatientData', 'Sync patient data with HIE')}>
      {isSyncing ? t('syncing', 'Syncing...') : t('update', 'Update')}
    </Button>
  );
};
