import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLatestQueueEntry } from './transition-latest-queue-entry.resource';
import AddPatientToQueueModal from './add-patient-to-queue-modal/add-patient-to-queue-entry.modal';
import TransitionQueueEntryModal from '../queue-table/queue-entry-actions/transition-queue-entry.modal';

interface TransitionLatestQueueEntryProps {
  patientUuid: string;
  closeModal: () => void;
}

const TransitionLatestQueueEntry: React.FC<TransitionLatestQueueEntryProps> = ({ closeModal, patientUuid }) => {
  const { t } = useTranslation();
  const { data: queueEntry } = useLatestQueueEntry(patientUuid);

  return (
    <>
      {queueEntry ? (
        <TransitionQueueEntryModal
          queueEntry={queueEntry}
          closeModal={closeModal}
          modalTitle={t('transitionLatestQueueEntry', "Transition patient's latest queue entry")}
        />
      ) : (
        <AddPatientToQueueModal
          modalTitle={t('addPatientToQueue', 'Add patient to queue')}
          patientUuid={patientUuid}
          closeModal={closeModal}
        />
      )}
    </>
  );
};

export default TransitionLatestQueueEntry;
