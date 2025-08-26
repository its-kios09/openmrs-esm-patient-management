import React, { useMemo } from 'react';
import classNames from 'classnames';
import { getCoreTranslation } from '@openmrs/esm-translations';
import { GenderFemale, GenderMale } from '@carbon/react/icons';
import { age, ExtensionSlot, formatDate, getPatientName, parseDate } from '@openmrs/esm-framework';
import { maskName } from '../../mpi/utils';
import styles from './patient-banner-patient-info.scss';
import { Accordion, AccordionItem, Tag } from '@carbon/react';
import { t } from 'i18next';
import DependentsComponent from '../dependants/dependants.component';
import { EligibilityResponse } from '../hooks/useHIESHAEligibility';

interface EnhancedPatientBannerPatientInfoProps {
  patient: fhir.Patient;
  hiePatient?: fhir.Patient;
  renderedFrom?: string;
  showSyncButton?: boolean;
  onSyncSuccess?: (patientUuid: string) => void;
  eligibilityData?: EligibilityResponse;
  isEligibilityLoading?: boolean;
}

type Gender = 'female' | 'male';

const GENDER_ICONS = {
  Female: <GenderFemale />,
  Male: <GenderMale />,
} as const;

const GENDER_MAP = {
  male: 'Male',
  female: 'Female',
} as const;

const getGender = (gender: string) => {
  const normalizedGender = gender.toLowerCase() as Gender;
  const iconKey = GENDER_MAP[normalizedGender] ?? 'Unknown';
  return {
    displayText: getCoreTranslation(normalizedGender, gender),
    iconKey,
  };
};

// Helper function to extract National ID from patient identifiers
const getNationalId = (patient: fhir.Patient): string | null => {
  const nationalIdIdentifier = patient.identifier?.find(
    (identifier) =>
      identifier.type?.coding?.[0]?.code === 'national-id' || identifier.type?.coding?.[0]?.display === 'National ID',
  );
  return nationalIdIdentifier?.value || null;
};

// Helper function to check if patient has dependents
const hasDependents = (patient: fhir.Patient): boolean => {
  return patient.contact && patient.contact.length > 0;
};

// Helper function to check if patient has CR/SHA number
const hasCROrSHANumber = (patient: fhir.Patient): boolean => {
  return (
    patient.identifier?.some(
      (identifier) =>
        identifier.type?.coding?.[0]?.code === 'sha-number' ||
        identifier.type?.coding?.[0]?.display === 'SHA Number' ||
        identifier.value?.startsWith('CR') ||
        identifier.value?.startsWith('SHA'),
    ) || false
  );
};

// Function to determine eligibility and return appropriate tags
const getEligibilityTags = (patient: fhir.Patient, eligibilityData?: any) => {
  const tags: Array<{ text: string; type: 'red' | 'green' | 'blue' | 'purple' }> = [];

  // Check if patient has CR/SHA number
  const hasValidCRSHA = hasCROrSHANumber(patient);

  if (hasValidCRSHA) {
    // Anyone with a CR/SHA number is eligible for PHC
    tags.push({ text: 'Eligible for PHC', type: 'green' });
  }

  if (eligibilityData) {
    const { status, coverageType } = eligibilityData;

    if (status === 1) {
      // Anyone with status of 1 is eligible for PHC, SHIF and ECCIF
      if (!hasValidCRSHA) {
        tags.push({ text: 'Eligible for PHC', type: 'green' });
      }
      tags.push({ text: 'Eligible for SHIF', type: 'blue' });
      tags.push({ text: 'Eligible for ECCIF', type: 'blue' });

      // Check for civil servant coverage
      if (coverageType === 'CIVIL_SERVANT') {
        tags.push({ text: 'Eligible for Civil Servants Scheme', type: 'purple' });
      }
    } else if (!hasValidCRSHA) {
      // No CR/SHA number and status is not 1
      tags.push({ text: 'Not eligible for PHC', type: 'red' });
    }
  } else if (!hasValidCRSHA) {
    // No eligibility data and no CR/SHA number
    tags.push({ text: 'Not eligible for PHC', type: 'red' });
  }

  return tags;
};

export function EnhancedPatientBannerPatientInfo({
  patient,
  renderedFrom,
  eligibilityData,
  isEligibilityLoading,
}: EnhancedPatientBannerPatientInfoProps) {
  const name = getPatientName(patient);
  const genderInfo = patient?.gender && getGender(patient.gender);

  const extensionState = useMemo(
    () => ({ patientUuid: patient.id, patient, renderedFrom }),
    [patient.id, patient, renderedFrom],
  );

  // Get eligibility tags based on patient data and eligibility response
  const eligibilityTags = useMemo(() => {
    if (isEligibilityLoading) return [];
    return getEligibilityTags(patient, eligibilityData);
  }, [patient, eligibilityData, isEligibilityLoading]);

  return (
    <div className={styles.patientInfo}>
      <div className={classNames(styles.row, styles.patientNameRow)}>
        <div className={styles.flexRow}>
          <span className={styles.patientName}>{maskName(name)}</span>

          {genderInfo && (
            <div className={styles.gender}>
              {GENDER_ICONS[genderInfo.iconKey as keyof typeof GENDER_ICONS]}
              <span>{genderInfo.displayText}</span>
            </div>
          )}

          <ExtensionSlot className={styles.tagsSlot} name="patient-banner-tags-slot" state={extensionState} />

          {/* Render eligibility tags */}
          <div className={styles.eligibilityTags}>
            {isEligibilityLoading ? (
              <Tag type="blue" size="md">
                Checking eligibility...
              </Tag>
            ) : (
              eligibilityTags.map((tag, index) => (
                <Tag key={index} type={tag.type} size="md">
                  {tag.text}
                </Tag>
              ))
            )}
          </div>
        </div>
      </div>
      <div className={styles.demographics}>
        {patient.birthDate && (
          <>
            <span>{age(patient.birthDate)}</span>
            <span className={styles.separator}>&middot;</span>
            <span>{formatDate(parseDate(patient.birthDate))}</span>
            <span className={styles.separator}>&middot;</span>
          </>
        )}
        <div>
          <div className={styles.identifiers}>
            {patient.identifier?.length ? patient.identifier.map((identifier) => identifier.value).join(', ') : '--'}
          </div>
        </div>
        <ExtensionSlot className={styles.extensionSlot} name="patient-banner-bottom-slot" state={extensionState} />
      </div>
    </div>
  );
}
