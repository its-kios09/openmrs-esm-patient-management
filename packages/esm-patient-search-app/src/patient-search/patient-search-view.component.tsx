import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Column, Search, ComboBox, InlineLoading } from '@carbon/react';
import styles from './patient-search-view.scss';
import { useConfig, showToast, showModal, PatientPhoto, OpenmrsResource } from '@openmrs/esm-framework';
import { PatientSearchConfig } from '../config-schema';
import { Tile } from '@carbon/react';
import { PATIENT_API_NO_CREDENTIALS, PATIENT_NOT_FOUND, RESOURCE_NOT_FOUND, UNKNOWN } from '../constants';
import { searchPatientFromHIE, usePatient } from './patient-search-view.resource';
import { Search as SearchIcon, TwoFactorAuthentication, ChevronDown, ChevronUp } from '@carbon/react/icons';
import { HIEBundle, LocalResponse } from './types';
import classNames from 'classnames';
import ErrorState from './empty-state/empty-state.component';
import { EnhancedPatientBannerPatientInfo } from './patient-banner-patient-info/patient-banner-patient-info.component';
import { comparePatients } from './utils/patientComparison';
import { Address, Identifier, SearchedPatient } from '../types';
import DependentsComponent from './dependants/dependants.component';
import { EligibilityResponse, useSHAEligibility } from './hooks/useHIESHAEligibility';
import { EmptySvg } from './components/empty-svg/empty-svg.component';
import { PatientSyncButton } from './components/sync-button/PatientSyncButton';

interface PatientSearchTileProps {}

const EnhancedPatientSearchTile: React.FC<PatientSearchTileProps> = () => {
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<HIEBundle[] | null>(null);
  const [localSearchResults, setLocalSearchResults] = useState<LocalResponse | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncedPatients, setSyncedPatients] = useState<Set<string>>(new Set());

  // Add state for managing dependents visibility
  const [showDependentsForPatient, setShowDependentsForPatient] = useState<Set<string>>(new Set());

  const [eligibilityData, setEligibilityData] = useState<EligibilityResponse | null>(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [searchedNationalId, setSearchedNationalId] = useState<string>('');

  const config = useConfig<PatientSearchConfig>();
  const { identifierTypes } = config;

  const { isLoading: isLocalLoading, person: localPatient } = usePatient(searchQuery);

  const { data: eligibilityResponse, isLoading: isEligibilityLoading } = useSHAEligibility(searchedNationalId);

  const identifierTypeItems = identifierTypes.map((item) => ({
    id: item.identifierValue,
    key: item.identifierValue,
    name: item.identifierType,
    text: item.identifierType,
  }));

  const defaultIdentifierType =
    identifierTypeItems.find((item) => item.key !== 'select-identifier-type') || identifierTypeItems[0];

  const [identifierType, setIdentifierType] = useState(defaultIdentifierType?.key || '');

  const handleIdentifierTypeChange = (selectedItem: any) => {
    setIdentifierType(selectedItem?.key || '');
  };

  const getNationalIdFromPatient = (patient: fhir.Patient): string | null => {
    const nationalIdIdentifier = patient.identifier?.find(
      (identifier) =>
        identifier.type?.coding?.[0]?.code === 'national-id' || identifier.type?.coding?.[0]?.display === 'National ID',
    );
    return nationalIdIdentifier?.value || null;
  };

  // Convert local patient to FHIR format
  const convertLocalPatientToFHIR = (localPatient: any): fhir.Patient => {
    return {
      resourceType: 'Patient',
      id: localPatient.uuid,
      identifier:
        localPatient.identifiers?.map((id: any) => ({
          value: id.identifier,
          type: {
            coding: [
              {
                display: id.identifierType?.display || '',
                code: id.identifierType?.uuid || '',
              },
            ],
          },
        })) || [],
      name: [
        {
          text: localPatient.person?.personName?.display || '',
          given: localPatient.person?.personName?.givenName ? [localPatient.person.personName.givenName] : [],
          family: localPatient.person?.personName?.familyName || '',
        },
      ],
      gender: localPatient.person?.gender?.toLowerCase() as 'male' | 'female' | 'other' | 'unknown',
      birthDate: localPatient.person?.birthdate ? localPatient.person.birthdate.split('T')[0] : undefined,
    };
  };

  const handleSyncSuccess = (patientUuid: string) => {
    setSyncedPatients((prev) => new Set(prev).add(patientUuid));
    showToast({
      title: t('syncCompleted', 'Sync Completed'),
      kind: 'success',
      description: t('patientDataUpdated', 'Patient data has been updated successfully'),
    });

    setLocalSearchResults(null);
  };

  const handleOtpVerification = (hiePatient: fhir.Patient) => {
    console.log('🔍 OTP verification initiated for patient:', hiePatient);

    const searchedPatient: SearchedPatient = {
      uuid: hiePatient.id || '',
      externalId: hiePatient.id || '',
      person: {
        addresses:
          hiePatient.address?.map(
            (addr): Address => ({
              preferred: false,
              voided: false,
              address1: addr.line?.[0] || '',
              cityVillage: addr.city || '',
              country: addr.country || '',
              postalCode: addr.postalCode || '',
              stateProvince: addr.state || '',
            }),
          ) || [],
        age: hiePatient.birthDate
          ? Math.floor(
              (new Date().getTime() - new Date(hiePatient.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
            )
          : 0,
        birthdate: hiePatient.birthDate || '',
        gender: hiePatient.gender || 'unknown',
        dead: hiePatient.deceasedBoolean || false,
        deathDate: hiePatient.deceasedDateTime || null,
        personName: {
          display:
            hiePatient.name?.[0]?.text ||
            `${hiePatient.name?.[0]?.given?.join(' ') || ''} ${hiePatient.name?.[0]?.family || ''}`.trim() ||
            'Unknown Patient',
          givenName: hiePatient.name?.[0]?.given?.[0] || '',
          middleName: hiePatient.name?.[0]?.given?.[1] || '',
          familyName: hiePatient.name?.[0]?.family || '',
        },
      },
      identifiers:
        hiePatient.identifier?.map(
          (id): Identifier => ({
            display: `${id.type?.coding?.[0]?.display || 'Unknown'}: ${id.value || ''}`,
            identifier: id.value || '',
            identifierType: {
              uuid: id.type?.coding?.[0]?.code || '',
              display: id.type?.coding?.[0]?.display || '',
            } as OpenmrsResource,
            location: {
              uuid: '',
              display: '',
            } as OpenmrsResource,
            uuid: id.id || '',
            preferred: id.use === 'usual' || false,
          }),
        ) || [],
      attributes: [
        {
          attributeType: {
            uuid: 'b2c38640-2603-4629-aebd-3b54f33f1e3a',
            display: 'phone',
          },
          value: hiePatient.telecom?.find((contact) => contact.system === 'phone')?.value || '',
        },
      ],
    };

    const dispose = showModal('otp-authentication-modal', {
      onClose: () => dispose(),
      patient: searchedPatient,
    });
  };

  const hasDifferences = (localPatient: fhir.Patient, hiePatient: fhir.Patient): boolean => {
    const differences = comparePatients(localPatient, hiePatient);
    return Object.keys(differences).length > 0;
  };

  const getHiePatientCount = (hieResults: HIEBundle[] | null): number => {
    if (!hieResults || !Array.isArray(hieResults)) return 0;
    return hieResults.reduce((total, bundle) => total + (bundle?.total || 0), 0);
  };

  const toggleDependentsVisibility = (patientId: string) => {
    setShowDependentsForPatient((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(patientId)) {
        newSet.delete(patientId);
      } else {
        newSet.add(patientId);
      }
      return newSet;
    });
  };

  const hasDependents = (patient: fhir.Patient): boolean => {
    return patient?.contact && Array.isArray(patient.contact) && patient.contact.length > 0;
  };
  const renderPatientCard = (bundle: HIEBundle, bundleIndex: number) => {
    if (!bundle.entry || bundle.entry.length === 0) return null;

    return bundle.entry.map((entry, entryIndex) => {
      const patient = entry.resource;
      const patientName =
        patient.name?.[0]?.text ||
        `${patient.name?.[0]?.given?.join(' ') || ''} ${patient.name?.[0]?.family || ''}`.trim() ||
        'Unknown Patient';
      const patientUuid = patient.id;
      const patientKey = `${bundleIndex}-${entryIndex}`;
      const showDependents = showDependentsForPatient.has(patientKey);
      const patientHasDependents = hasDependents(patient);

      const localFHIRPatient =
        localSearchResults && localSearchResults.length > 0 ? convertLocalPatientToFHIR(localSearchResults[0]) : null;

      const hasLocal = !!localFHIRPatient;
      const needsSync = hasLocal && hasDifferences(localFHIRPatient, patient);
      const isSynced = localFHIRPatient ? syncedPatients.has(localFHIRPatient.id) : false;

      return (
        <div key={patientKey} className={classNames(styles.container)} role="banner">
          <div className={styles.patientInfo}>
            <div className={styles.patientAvatar} role="img">
              <PatientPhoto patientUuid={patientUuid} patientName={patientName} />
            </div>

            <EnhancedPatientBannerPatientInfo
              patient={patient}
              renderedFrom="hie-search"
              eligibilityData={eligibilityResponse || undefined}
              isEligibilityLoading={isEligibilityLoading}
            />
          </div>

          <div className={styles.buttonCol}>
            <div className={styles.actionButtons}>
              {needsSync && !isSynced && (
                <PatientSyncButton
                  localPatient={localFHIRPatient}
                  hiePatient={patient}
                  onSyncSuccess={handleSyncSuccess}
                  size="sm"
                  kind="tertiary"
                />
              )}
              {(!hasLocal || isSynced) && (
                <Button
                  kind="primary"
                  size="sm"
                  renderIcon={TwoFactorAuthentication}
                  onClick={() => handleOtpVerification(patient)}>
                  {t('sendOtp', 'Send OTP')}
                </Button>
              )}
              {patientHasDependents && (
                <Button
                  iconDescription={showDependents ? 'Hide dependents' : 'Show dependents'}
                  kind="secondary"
                  size="sm"
                  onClick={() => toggleDependentsVisibility(patientKey)}
                  renderIcon={showDependents ? ChevronUp : ChevronDown}>
                  {showDependents ? t('showLess', 'Show less') : t('showDependents', 'Show dependents')}
                </Button>
              )}
            </div>
          </div>

          {showDependents && (
            <div className={styles.dependentsSection}>
              <div className={styles.dependentsContainer}>
                <DependentsComponent patient={patient} />
              </div>
            </div>
          )}
        </div>
      );
    });
  };

  const renderLocalPatientCard = () => {
    if (!localSearchResults || !Array.isArray(localSearchResults) || localSearchResults.length === 0) {
      return null;
    }

    const patient = localSearchResults[0];
    const fhirPatient = convertLocalPatientToFHIR(patient);
    const isSynced = syncedPatients.has(fhirPatient.id);

    if (isSynced) return null;

    const patientUuid = patient.uuid;
    const patientName =
      patient.person?.personName?.display ||
      `${patient.person?.personName?.givenName || ''} ${patient.person?.personName?.middleName || ''} ${patient.person?.personName?.familyName || ''}`.trim() ||
      'Unknown Patient';

    const localPatientKey = 'local-patient';
    const showDependents = showDependentsForPatient.has(localPatientKey);
    const patientHasDependents = hasDependents(fhirPatient);

    return (
      <div className={classNames(styles.container)} role="banner">
        <div className={styles.patientInfo}>
          <div className={styles.patientAvatar} role="img">
            <PatientPhoto patientUuid={patientUuid} patientName={patientName} />
          </div>

          <EnhancedPatientBannerPatientInfo
            patient={fhirPatient}
            renderedFrom="local-search"
            eligibilityData={eligibilityResponse || undefined}
            isEligibilityLoading={isEligibilityLoading}
          />
        </div>

        <div className={classNames(patientHasDependents ? styles.buttonCol : styles.noDependents)}>
          <div className={styles.actionButtons}>
            {patientHasDependents && (
              <Button
                iconDescription={showDependents ? 'Hide dependents' : 'Show dependents'}
                kind="secondary"
                size="sm"
                onClick={() => toggleDependentsVisibility(localPatientKey)}
                renderIcon={showDependents ? ChevronUp : ChevronDown}>
                {showDependents ? t('showLess', 'Show less') : t('showDependents', 'Show dependents')}
              </Button>
            )}
          </div>
        </div>

        {showDependents && (
          <div className={styles.dependentsSection}>
            <div className={styles.dependentsContainer}>
              <DependentsComponent patient={fhirPatient} />
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleSearchPatient = async () => {
    if (!identifierType || !identifier.trim()) {
      showToast({
        title: t('validationError', 'Validation Error'),
        kind: 'warning',
        description: t('selectIdentifierAndNumber', 'Please select an identifier type and enter an identifier number'),
      });
      return;
    }

    setIsSearching(true);
    setSearchResults(null);
    setLocalSearchResults(null);
    setHasSearched(false);
    setSyncedPatients(new Set());
    setEligibilityData(null);
    setSearchedNationalId(''); // Reset eligibility check
    setShowDependentsForPatient(new Set()); // Reset dependents visibility

    try {
      console.log('Step 1: Searching HIE...');
      const hiePatientData = await searchPatientFromHIE(identifierType, identifier.trim());
      console.log('HIE Results:', hiePatientData);

      let normalizedHieResults: HIEBundle[] | null = null;
      if (hiePatientData) {
        if (Array.isArray(hiePatientData)) {
          normalizedHieResults = hiePatientData;
        } else {
          normalizedHieResults = [hiePatientData];
        }
      }

      setSearchResults(normalizedHieResults);

      // Step 2: Check for eligibility if we have HIE results
      if (normalizedHieResults && normalizedHieResults.length > 0) {
        const firstPatient = normalizedHieResults[0]?.entry?.[0]?.resource;
        if (firstPatient) {
          const nationalId = getNationalIdFromPatient(firstPatient);
          if (nationalId) {
            console.log('Step 2a: Checking eligibility for National ID:', nationalId);
            setSearchedNationalId(nationalId); // This will trigger the eligibility check
          }
        }
      }

      console.log('Step 3: Triggering local search...');
      setSearchQuery(identifier.trim());
      setHasSearched(true);
    } catch (error: any) {
      setHasSearched(true);
      console.error('Search error:', error);

      let errorMessage = t('searchFailed', 'Failed to search for patient. Please try again.');
      let errorTitle = t('searchError', 'Search Error');

      if (error?.message === PATIENT_NOT_FOUND) {
        errorMessage = t('patientNotFound', 'No patient found with the provided identifier');
        errorTitle = t('patientNotFound', 'Patient Not Found');
      } else if (error?.message === PATIENT_API_NO_CREDENTIALS) {
        errorMessage = t('authenticationError', 'Authentication required. Please log in again.');
        errorTitle = t('authenticationError', 'Authentication Error');
      } else if (error?.message === RESOURCE_NOT_FOUND) {
        errorMessage = t('resourceNotFound', 'The requested resource was not found');
        errorTitle = t('resourceNotFound', 'Resource Not Found');
      } else if (error?.message === UNKNOWN) {
        errorMessage = t('unknownError', 'An unknown error occurred. Please try again later.');
        errorTitle = t('unknownError', 'Unknown Error');
      }

      showToast({ title: errorTitle, kind: 'error', description: errorMessage });
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchResults(null);
    setLocalSearchResults(null);
    setHasSearched(false);
    setIdentifier('');
    setSearchQuery('');
    setSyncedPatients(new Set());
    setEligibilityData(null);
    setSearchedNationalId('');
    setShowDependentsForPatient(new Set()); // Reset dependents visibility
  };

  useEffect(() => {
    if (!isLocalLoading && searchQuery && hasSearched) {
      console.log('Local search completed:', localPatient);
      setLocalSearchResults(localPatient);
    }
  }, [isLocalLoading, localPatient, searchQuery, hasSearched]);

  // Update eligibility data when the response comes back
  useEffect(() => {
    if (eligibilityResponse) {
      setEligibilityData(eligibilityResponse);
      console.log('Eligibility data received:', eligibilityResponse);
    }
  }, [eligibilityResponse]);

  const renderSearchResults = () => {
    if (!hasSearched) return null;

    const hasHieResults =
      searchResults &&
      Array.isArray(searchResults) &&
      searchResults.length > 0 &&
      searchResults.some((bundle) => bundle.total > 0 && bundle.entry && bundle.entry.length > 0);

    const hasLocalResults = localSearchResults && Array.isArray(localSearchResults) && localSearchResults.length > 0;

    if (!hasHieResults && !hasLocalResults) {
      return <ErrorState subTitle={t('checkFilters', 'Please check the filters above and try again')} />;
    }

    return (
      <div className={styles.searchResultsContainer}>
        {hasHieResults && (
          <div className={styles.hieResultsSection}>
            <div className={styles.resultsHeader}>
              <span className={styles.identifierTypeHeader}>
                {t('hieResults', 'Patient(s) found {{count}}', {
                  count: getHiePatientCount(searchResults),
                })}
              </span>
            </div>
            <div>{searchResults!.map((bundle, index) => renderPatientCard(bundle, index))}</div>
          </div>
        )}

        {hasLocalResults && !syncedPatients.has(convertLocalPatientToFHIR(localSearchResults[0]).id) && (
          <div className={styles.localResultsSection}>
            <div className={styles.resultsHeader}>
              <span className={styles.identifierTypeHeader}>{t('revisitPatient', 'Revisit patient')}</span>
            </div>
            <div>{renderLocalPatientCard()}</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Tile className={styles.patientSearchTile}>
        <span className={styles.formHeaderSection}>{t('clientRegistry', 'Client registry verification')}</span>
        <div className={styles.searchForm}>
          <div className={styles.searchRow}>
            <Column className={styles.identifierTypeColumn}>
              <ComboBox
                onChange={({ selectedItem }) => handleIdentifierTypeChange(selectedItem)}
                id="formIdentifierType"
                titleText={t('identificationType', 'Identification Type')}
                placeholder={t('chooseIdentifierType', 'Choose identifier type')}
                items={identifierTypeItems}
                itemToString={(item) => (item ? item.name : '')}
                className={styles.comboBox}
                selectedItem={defaultIdentifierType}
                initialSelectedItem={defaultIdentifierType}
              />
            </Column>

            <Column className={styles.identifierNumberColumn}>
              <span className={styles.identifierTypeHeader}>{t('identifierNumber', 'Identifier number*')}</span>
              <Search
                labelText={t('enterIdentifierNumber', 'Enter identifier number')}
                className={styles.formSearch}
                value={identifier}
                placeholder={t('enterIdentifierNumber', 'Enter identifier number')}
                id="formSearchHealthWorkers"
                onChange={(value) => setIdentifier(value.target.value)}
                onKeyPress={(event) => {
                  if (event.key === 'Enter' && !isSearching && identifierType && identifier.trim()) {
                    handleSearchPatient();
                  }
                }}
              />
            </Column>
          </div>

          <div className={styles.buttonContainer}>
            <Button
              kind="primary"
              onClick={handleSearchPatient}
              size="md"
              renderIcon={isSearching ? undefined : SearchIcon}
              disabled={isSearching || !identifierType || !identifier.trim()}
              className={styles.searchButton}>
              {isSearching ? (
                <div style={{ alignItems: 'center' }}>
                  <InlineLoading status="active" description={t('pullFromHIE', 'Pulling from registry...')} size="sm" />
                </div>
              ) : (
                t('searchPatient', 'Search for Patient')
              )}
            </Button>

            <Button
              kind="danger"
              onClick={handleClearSearch}
              size="md"
              className={styles.clearButton}
              disabled={isSearching || (!hasSearched && !identifier.trim())}>
              {t('clearAll', 'Clear All')}
            </Button>
          </div>
        </div>
      </Tile>
      <div className={styles.searchResults}>
        {renderSearchResults() ?? (
          <div className={styles.emptyStateContainer}>
            <EmptySvg />
            <p className={styles.title}>{t('searchForAPatient', 'Search for a patient')}</p>
            <p className={styles.subTitle}>
              {t('enterPatientIdentifier', 'Enter patient identifier number to search for a patient')}
            </p>
          </div>
        )}
      </div>
    </>
  );
};

export default EnhancedPatientSearchTile;
