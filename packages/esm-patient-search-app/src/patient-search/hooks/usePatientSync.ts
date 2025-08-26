// hooks/usePatientSync.ts - Complete fix with all interfaces
import { useState, useCallback } from 'react';
import { showSnackbar, navigate, useSession, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { addPatientIdentifier } from '../../mpi/otp-authentication.resource';
import { useTranslation } from 'react-i18next';

interface PatientSyncHookOptions {
  onSyncSuccess?: (patientUuid: string) => void;
  onSyncError?: (error: Error) => void;
  navigateAfterSync?: boolean;
}

interface OpenMRSIdentifier {
  display: string;
  uuid: string;
  identifier: string;
  identifierType: {
    uuid: string;
    display: string;
    links: Array<{
      rel: string;
      uri: string;
      resourceAlias: string;
    }>;
  };
  location: {
    uuid: string;
    display: string;
    links: Array<{
      rel: string;
      uri: string;
      resourceAlias: string;
    }>;
  };
  preferred: boolean;
  voided: boolean;
  links: Array<{
    rel: string;
    uri: string;
    resourceAlias: string;
  }>;
  resourceVersion: string;
}

interface OpenMRSPatient {
  uuid: string;
  display: string;
  identifiers: OpenMRSIdentifier[];
  person: {
    uuid: string;
    display: string;
    gender: string;
    age: number;
    birthdate: string;
    birthdateEstimated: boolean;
    dead: boolean;
    deathDate: string | null;
    causeOfDeath: string | null;
    preferredName: {
      display: string;
      uuid: string;
      givenName: string;
      middleName: string | null;
      familyName: string;
      familyName2: string | null;
      voided: boolean;
      links: Array<{
        rel: string;
        uri: string;
        resourceAlias: string;
      }>;
      resourceVersion: string;
    };
    preferredAddress: {
      display: string | null;
      uuid: string;
      preferred: boolean;
      address1: string | null;
      address2: string | null;
      cityVillage: string | null;
      stateProvince: string | null;
      country: string | null;
      postalCode: string | null;
      countyDistrict: string | null;
      address3: string | null;
      address4: string | null;
      address5: string | null;
      address6: string | null;
      startDate: string | null;
      endDate: string | null;
      latitude: string | null;
      longitude: string | null;
      voided: boolean;
      [key: string]: any; // For address7-address15
      links: Array<{
        rel: string;
        uri: string;
        resourceAlias: string;
      }>;
      resourceVersion: string;
    };
    names: Array<{
      display: string;
      uuid: string;
      givenName: string;
      middleName: string | null;
      familyName: string;
      familyName2: string | null;
      voided: boolean;
      links: Array<{
        rel: string;
        uri: string;
        resourceAlias: string;
      }>;
      resourceVersion: string;
    }>;
    addresses: Array<{
      display: string | null;
      uuid: string;
      preferred: boolean;
      [key: string]: any; // For all address fields
      voided: boolean;
      links: Array<{
        rel: string;
        uri: string;
        resourceAlias: string;
      }>;
      resourceVersion: string;
    }>;
    attributes: Array<{
      display: string;
      uuid: string;
      value: string;
      attributeType: {
        uuid: string;
        display: string;
        links: Array<{
          rel: string;
          uri: string;
          resourceAlias: string;
        }>;
      };
      voided: boolean;
      links: Array<{
        rel: string;
        uri: string;
        resourceAlias: string;
      }>;
      resourceVersion: string;
    }>;
    voided: boolean;
    auditInfo: {
      creator: {
        uuid: string;
        display: string;
        links: Array<{
          rel: string;
          uri: string;
          resourceAlias: string;
        }>;
      };
      dateCreated: string;
      changedBy: any;
      dateChanged: string | null;
    };
    birthtime: string | null;
    deathdateEstimated: boolean;
    causeOfDeathNonCoded: string | null;
    links: Array<{
      rel: string;
      uri: string;
      resourceAlias: string;
    }>;
    resourceVersion: string;
  };
  voided: boolean;
  auditInfo: {
    creator: {
      uuid: string;
      display: string;
      links: Array<{
        rel: string;
        uri: string;
        resourceAlias: string;
      }>;
    };
    dateCreated: string;
    changedBy: any;
    dateChanged: string | null;
  };
  links: Array<{
    rel: string;
    uri: string;
    resourceAlias: string;
  }>;
  resourceVersion: string;
}

export function usePatientSync(options: PatientSyncHookOptions = {}) {
  const { t } = useTranslation();
  const session = useSession();
  const [isSyncing, setIsSyncing] = useState(false);

  // Get current patient with all identifiers
  const getCurrentPatientWithIdentifiers = async (patientId: string): Promise<OpenMRSPatient | null> => {
    try {
      const response = await openmrsFetch(`${restBaseUrl}/patient/${patientId}?v=full`);
      return response.data as OpenMRSPatient;
    } catch (error) {
      console.error('Error fetching current patient:', error);
      return null;
    }
  };

  // Check if identifier already exists (exact match)
  const identifierExists = (
    currentPatient: OpenMRSPatient,
    identifierValue: string,
    identifierTypeUuid: string
  ): boolean => {
    return currentPatient.identifiers.some(existing => 
      existing.identifierType.uuid === identifierTypeUuid &&
      existing.identifier === identifierValue &&
      !existing.voided
    );
  };

  // Create update payload with ZERO duplicate identifiers
  const createSafeUpdatePayload = async (
    localPatient: fhir.Patient,
    hiePatient: fhir.Patient,
    locationUuid: string
  ) => {
    const updatedPayload: any = {};

    // Handle demographic updates (names, gender)
    const localName = localPatient.name?.[0] || {};
    const hieName = hiePatient.name?.[0] || {}; // Fixed typo: was "hie"

    const isNameDifferent =
      localName.given?.[0] !== hieName.given?.[0] ||
      localName.given?.[1] !== hieName.given?.[1] ||
      localName.family !== hieName.family;

    // Normalize gender for comparison
    const normalizeGender = (gender: string | undefined): string => {
      if (!gender) return '';
      const g = gender.toLowerCase();
      if (g === 'male' || g === 'm') return 'M';
      if (g === 'female' || g === 'f') return 'F';
      return g.toUpperCase();
    };

    const localGender = normalizeGender(localPatient.gender);
    const hieGender = normalizeGender(hiePatient.gender);
    const isGenderDifferent = localGender !== hieGender;

    // Compare birthdate
    const localBirthDate = localPatient.birthDate;
    const hieBirthDate = hiePatient.birthDate;
    const isBirthDateDifferent = localBirthDate !== hieBirthDate;

    // Add demographic updates if needed
    if (isNameDifferent || isGenderDifferent || isBirthDateDifferent) {
      updatedPayload.uuid = localPatient.id;
      
      // Build the person update payload properly
      const personPayload: any = {
        uuid: localPatient.id,
      };

      // Add names if different
      if (isNameDifferent) {
        personPayload.names = [
          {
            preferred: true,
            givenName: hieName.given?.[0] || '',
            middleName: hieName.given?.[1] || '',
            familyName: hieName.family || '',
          },
        ];
      }

      // Add gender if different
      if (isGenderDifferent) {
        personPayload.gender = hieGender || localGender;
      }

      // Add birthdate if different
      if (isBirthDateDifferent && hieBirthDate) {
        personPayload.birthdate = hieBirthDate;
        personPayload.birthdateEstimated = false; // Assuming HIE data is accurate
      }

      updatedPayload.person = personPayload;
    }

    // Get current patient data to check existing identifiers
    const currentPatient = await getCurrentPatientWithIdentifiers(localPatient.id);
    if (!currentPatient) {
      console.error('Could not fetch current patient data');
      return updatedPayload; // Return without identifiers
    }

    // Process identifiers - only add ones that DON'T exist
    const identifiersToAdd: any[] = [];

    // HIE identifier type mappings
    const identifierMappings = [
      {
        hieCode: 'sha-number',
        openmrsUuid: '24aedd37-b5be-4e08-8311-3721b8d5100d',
        name: 'SHA'
      },
      {
        hieCode: 'sha',
        openmrsUuid: '24aedd37-b5be-4e08-8311-3721b8d5100d',
        name: 'SHA'
      },
      {
        hieCode: 'national-id',
        openmrsUuid: '49af6cdc-7968-4abb-bf46-de10d7f4859f',
        name: 'National ID'
      },
      {
        hieCode: 'nationalid',
        openmrsUuid: '49af6cdc-7968-4abb-bf46-de10d7f4859f',
        name: 'National ID'
      },
      {
        hieCode: 'passport',
        openmrsUuid: 'be9beef6-aacc-4e1f-ac4e-5babeaa1e303',
        name: 'Passport'
      },
      {
        hieCode: 'passport-number',
        openmrsUuid: 'be9beef6-aacc-4e1f-ac4e-5babeaa1e303',
        name: 'Passport'
      },
      {
        hieCode: 'birth-certificate',
        openmrsUuid: '68449e5a-8829-44dd-bfef-c9c8cf2cb9b2',
        name: 'Birth Certificate'
      },
      {
        hieCode: 'birth-certificate-number',
        openmrsUuid: '68449e5a-8829-44dd-bfef-c9c8cf2cb9b2',
        name: 'Birth Certificate'
      }
    ];

    // Process each HIE identifier
    if (hiePatient.identifier) {
      for (const hieId of hiePatient.identifier) {
        if (!hieId.value || !hieId.type?.coding?.[0]?.code) continue;

        const hieTypeCode = hieId.type.coding[0].code.toLowerCase();
        const mapping = identifierMappings.find(m => 
          m.hieCode === hieTypeCode || 
          m.hieCode === hieTypeCode.replace('-', '') ||
          hieTypeCode.includes(m.hieCode.replace('-', '')) ||
          hieTypeCode.includes('sha') // Special handling for SHA variations
        );

        if (!mapping) {
          console.log(`No mapping found for HIE identifier type: ${hieTypeCode}`);
          continue;
        }

        // Check if this exact identifier already exists
        const alreadyExists = identifierExists(
          currentPatient,
          hieId.value,
          mapping.openmrsUuid
        );

        if (alreadyExists) {
          console.log(`✓ ${mapping.name} identifier ${hieId.value} already exists - SKIPPING`);
          continue;
        }

        // Safe to add this identifier
        identifiersToAdd.push({
          identifier: hieId.value,
          location: locationUuid,
          identifierType: mapping.openmrsUuid,
          preferred: false,
        });

        console.log(`+ Will add ${mapping.name} identifier: ${hieId.value}`);
      }
    }

    // Only add identifiers array if we have new ones to add
    if (identifiersToAdd.length > 0) {
      updatedPayload.identifiers = identifiersToAdd;
      console.log(`Prepared ${identifiersToAdd.length} new identifier(s) for addition`);
    } else {
      console.log('No new identifiers to add - all already exist');
    }

    return updatedPayload;
  };

    const syncPatientData = useCallback(
    async (localPatient: fhir.Patient, hiePatient: fhir.Patient) => {
      setIsSyncing(true);
      console.log('🔄 Starting patient sync...');

      try {
        // Create safe payload that avoids all duplicates
        const payload = await createSafeUpdatePayload(
          localPatient,
          hiePatient,
          session?.sessionLocation?.uuid || ''
        );

        // Check what updates are being made
        const hasNameUpdates = payload.person?.names && payload.person.names.length > 0;
        const hasGenderUpdates = payload.person?.gender !== undefined;
        const hasBirthDateUpdates = payload.person?.birthdate !== undefined;

        console.log('📦 Sync payload prepared:', {
          hasPersonUpdates: !!payload.person,
          identifierCount: payload.identifiers?.length || 0,
          hasNameUpdates,
          hasGenderUpdates,
          hasBirthDateUpdates
        });

        // Update demographic data (excluding identifiers)
        if (payload.person && Object.keys(payload.person).length > 1) { // More than just uuid
          console.log('📝 Updating patient demographics...');
          console.log('Person payload:', JSON.stringify(payload.person, null, 2));
          
          try {
            const personUpdateUrl = `${restBaseUrl}/person/${localPatient.id}`;
            await openmrsFetch(personUpdateUrl, {
              method: 'POST',
              body: payload.person,
              headers: { 'Content-Type': 'application/json' },
            });
            console.log('✅ Demographics updated successfully');
          } catch (personError: any) {
            console.error('❌ Failed to update person demographics:', personError);
            
            // Try alternative approach - update patient instead of person
            console.log('🔄 Trying patient update instead...');
            const patientUpdatePayload = { 
              uuid: localPatient.id,
              person: payload.person 
            };
            
            const patientRegistrationUrl = `${restBaseUrl}/patient/${localPatient.id}`;
            await openmrsFetch(patientRegistrationUrl, {
              method: 'POST',
              body: patientUpdatePayload,
              headers: { 'Content-Type': 'application/json' },
            });
            console.log('✅ Demographics updated via patient endpoint');
          }
        } else {
          console.log('ℹ️  No demographic updates needed');
        }

        // Add only the verified new identifiers
        if (payload?.identifiers && payload.identifiers.length > 0) {
          console.log(`🏷️  Adding ${payload.identifiers.length} new identifier(s)...`);
          
          for (const [index, identifier] of payload.identifiers.entries()) {
            try {
              console.log(`Adding identifier ${index + 1}/${payload.identifiers.length}: ${identifier.identifier}`);
              
              await addPatientIdentifier(localPatient.id, identifier);
              
              console.log(`✅ Successfully added: ${identifier.identifier}`);
            } catch (identifierError: any) {
              console.error(`❌ Failed to add identifier ${identifier.identifier}:`, identifierError);
              
              // Even if pre-checked, still handle potential duplicates gracefully
              if (identifierError?.message?.includes('identical identifiers') || 
                  identifierError?.message?.includes('duplicate')) {
                console.log(`⚠️  Duplicate detected during addition - continuing...`);
                continue;
              } else {
                // For other errors, log but continue with remaining identifiers
                console.error(`Unexpected error adding identifier:`, identifierError);
                continue;
              }
            }
          }
        }

        console.log('🎉 Patient sync completed successfully');

        showSnackbar({
          title: t('patientUpdated', 'Patient Updated'),
          subtitle: t('patientUpdatedSubtitle', 'Patient has been successfully updated with HIE data'),
          kind: 'success',
        });

        options.onSyncSuccess?.(localPatient.id);

        if (options.navigateAfterSync) {
          navigate({ to: `${window['getOpenmrsSpaBase']()}patient/${localPatient.id}/chart` });
        }

      } catch (error) {
        const errorObj = error as Error;
        console.error('💥 Patient sync failed:', errorObj);

        // Enhanced error logging
        if ((errorObj as any)?.responseBody) {
          console.error('📋 Server response body:', (errorObj as any).responseBody);
        }
        
        if ((errorObj as any)?.response?.status) {
          console.error('🔢 HTTP Status:', (errorObj as any).response.status);
        }

        showSnackbar({
          title: t('syncError', 'Sync Error'),
          subtitle: t('syncErrorSubtitle', 'An error occurred while syncing patient data'),
          kind: 'error',
        });
        
        options.onSyncError?.(errorObj);
      } finally {
        setIsSyncing(false);
        console.log('🏁 Sync process finished');
      }
    },
    [session, t, options],
  );

  return {
    isSyncing,
    syncPatientData,
  };
}

// Enhanced difference checking function using the LocalPatient type
export function checkPatientDifferences(localPatient: any, hiePatient: fhir.Patient): Record<string, unknown> {
  const differences: Record<string, unknown> = {};

  // Compare names
  const localName = localPatient.person?.preferredName;
  const hieName = hiePatient.name?.[0];

  if (localName || hieName) {
    const nameDiffs: any = {};

    if (localName?.familyName !== hieName?.family) {
      nameDiffs.family = { local: localName?.familyName, hie: hieName?.family };
    }

    const localGiven = [localName?.givenName, localName?.middleName].filter(Boolean);
    const hieGiven = hieName?.given || [];
    if (JSON.stringify(localGiven) !== JSON.stringify(hieGiven)) {
      nameDiffs.given = { local: localGiven, hie: hieGiven };
    }

    if (Object.keys(nameDiffs).length > 0) {
      differences.name = nameDiffs;
    }
  }

  // Compare gender with normalization
  const normalizeGender = (gender: string | undefined): string => {
    if (!gender) return '';
    const g = gender.toLowerCase();
    if (g === 'male' || g === 'm') return 'M';
    if (g === 'female' || g === 'f') return 'F';
    return g.toUpperCase();
  };

  const localGender = normalizeGender(localPatient.person?.gender);
  const hieGender = normalizeGender(hiePatient.gender);

  if (localGender !== hieGender) {
    differences.gender = { local: localPatient.person?.gender, hie: hiePatient.gender };
  }

  // Compare birthdate - normalize for comparison
  const normalizeDate = (dateStr: string | undefined): string => {
    if (!dateStr) return '';
    // Extract just the date part (YYYY-MM-DD) and ignore time/timezone
    return dateStr.split('T')[0];
  };

  const localBirthDate = normalizeDate(localPatient.person?.birthdate);
  const hieBirthDate = normalizeDate(hiePatient.birthDate);

  if (localBirthDate !== hieBirthDate && hieBirthDate) {
    differences.birthDate = { 
      local: localBirthDate || null, 
      hie: hieBirthDate 
    };
  }

  // Check for missing identifiers (important ones)
  const identifierDiffs: any = {};
  const localIds = localPatient.identifiers || [];
  const hieIds = hiePatient.identifier || [];

  // Check specifically for SHA identifier
  const localHasSha = localIds.some((id: any) => 
    id.identifierType?.uuid === '24aedd37-b5be-4e08-8311-3721b8d5100d' && !id.voided
  );
  
  const hieShaId = hieIds.find((id: any) => 
    id.type?.coding?.some((code: any) => 
      code.code?.toLowerCase().includes('sha') || code.code === 'sha-number'
    )
  );

  if (hieShaId?.value && !localHasSha) {
    identifierDiffs.sha = {
      local: null,
      hie: hieShaId.value,
    };
  }

  if (Object.keys(identifierDiffs).length > 0) {
    differences.identifiers = identifierDiffs;
  }

  return differences;
}
