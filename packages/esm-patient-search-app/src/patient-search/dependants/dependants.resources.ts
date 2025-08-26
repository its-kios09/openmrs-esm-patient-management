import {
  getSessionLocation,
  launchWorkspace,
  navigate,
  openmrsFetch,
  restBaseUrl,
  showSnackbar,
} from '@openmrs/esm-framework';

export interface Dependent {
  name: string | undefined;
  relationship: string | undefined;
  phoneNumber: string | undefined;
  gender: string | undefined;
  dependentInfo: fhir.Patient;
}

interface FHIRResponse {
  data: {
    entry: Array<{
      resource: fhir.Patient;
    }>;
  };
}

interface DependentInfo {
  id: string;
  extension: Array<{
    url: string;
    valueIdentifier?: {
      use: string;
      type: {
        coding: Array<{
          system: string;
          code: string;
          display: string;
        }>;
      };
      value: string;
    };
    valueString?: string;
  }>;
  relationship: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  }>;
  name: {
    text: string;
    family: string;
    given: string[];
  };
  address: {
    country: string;
  };
  gender: string;
}

interface DependentPayload {
  name: string;
  relationship: string;
  gender: string;
  dependentInfo: DependentInfo;
}

function getIdentifierTypeUUID(code: string): string {
  const identifierTypeMap = {
    'sha-number': '24aedd37-b5be-4e08-8311-3721b8d5100d',
    'national-id': '49af6cdc-7968-4abb-bf46-de10d7f4859f',
    'passport-number': 'be9beef6-aacc-4e1f-ac4e-5babeaa1e303',
    'birth-certificate-number': '68449e5a-8829-44dd-bfef-c9c8cf2cb9b2',
  };

  return identifierTypeMap[code] || '';
}

function generateIdentifier(source: string) {
  const abortController = new AbortController();

  return openmrsFetch(`${restBaseUrl}/idgen/identifiersource/${source}/identifier`, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: {},
    signal: abortController.signal,
  });
}

export async function createDependentPatient(dependent: DependentPayload, t) {
  try {
    const { dependentInfo } = dependent;
    const locationUuid = (await getSessionLocation()).uuid;

    // Extract identifiers from extensions
    const identifiers = dependentInfo.extension
      .filter((ext) => ext.url === 'identifiers' && ext.valueIdentifier)
      .map((ext, index) => ({
        identifier: ext.valueIdentifier.value,
        identifierType: getIdentifierTypeUUID(ext.valueIdentifier.type.coding[0].code),
        location: locationUuid,
        preferred: false, // Set all to false initially, we'll set one as preferred later
      }))
      .filter((identifier) => identifier.identifierType); // Filter out invalid identifier types

    // Set the first valid identifier as preferred
    if (identifiers.length > 0) {
      identifiers[0].preferred = true;
    }

    // Extract birth date from extensions
    const birthdate = dependentInfo.extension.find(
      (ext) => ext.url === 'https://ts.kenya-hie.health/fhir/StructureDefinition/date_of_birth',
    )?.valueString;

    // Parse names properly
    const givenNames = dependentInfo.name.given || [];
    let familyName = dependentInfo.name.family || '';

    // If no proper name structure, try to parse from text
    let givenName = '';
    let middleName = '';

    if (givenNames.length > 0) {
      givenName = givenNames[0];
      middleName = givenNames.slice(1).join(' ');
    } else if (dependentInfo.name.text) {
      // Try to parse from full name text
      const nameParts = dependentInfo.name.text.trim().split(' ');
      givenName = nameParts[0] || '';
      middleName = nameParts.slice(1, -1).join(' ');
      // Use the last part as family name if not already set
      if (!familyName && nameParts.length > 1) {
        familyName = nameParts[nameParts.length - 1];
      }
    }

    // Create the payload structure
    const payload = {
      person: {
        names: [
          {
            preferred: true,
            givenName: givenName || 'Unknown',
            middleName: middleName || '',
            familyName: familyName || 'Unknown',
          },
        ],
        gender: dependentInfo.gender.charAt(0).toUpperCase(),
        birthdate: birthdate || null,
        birthdateEstimated: !birthdate,
        attributes: [],
        addresses: [
          {
            address1: '',
            cityVillage: '',
            country: dependentInfo.address?.country || '',
            postalCode: '',
            stateProvince: '',
          },
        ],
      },
      identifiers: [...identifiers],
    };

    // Generate OpenMRS identifier
    const openmrsIdentifierSource = 'fb034aac-2353-4940-abe2-7bc94e7c1e71';

    try {
      const identifierResponse = await generateIdentifier(openmrsIdentifierSource);
      const location = await getSessionLocation();

      const openmrsIdentifier = {
        identifier: identifierResponse.data.identifier,
        identifierType: 'dfacd928-0370-4315-99d7-6ec1c9f7ae76', // OpenMRS ID UUID
        location: location.uuid,
        preferred: identifiers.length === 0, // Only set as preferred if no other identifiers exist
      };

      payload.identifiers.push(openmrsIdentifier);

      // If we added the OpenMRS identifier and there were existing identifiers,
      // make sure only one is preferred
      if (identifiers.length > 0) {
        // Set all existing identifiers to non-preferred
        payload.identifiers.forEach((id) => {
          if (id.identifierType !== 'dfacd928-0370-4315-99d7-6ec1c9f7ae76') {
            id.preferred = false;
          }
        });
        // Set the OpenMRS identifier as preferred
        openmrsIdentifier.preferred = true;
      }
    } catch (identifierError) {
      console.warn('Failed to generate OpenMRS identifier, proceeding without it:', identifierError);
    }

    // Ensure we have at least one identifier
    if (payload.identifiers.length === 0) {
      throw new Error('No valid identifiers found for the dependent');
    }

    // Create the patient
    const response = await openmrsFetch(`${restBaseUrl}/patient`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: payload,
    });

    showSnackbar({
      title: t('dependentRegisteredSuccessfully', 'Dependent registered successfully'),
      subtitle: t('dependentRegisteredSuccessfullySubtitle', 'You can now start a visit for the dependent'),
      kind: 'success',
      isLowContrast: true,
    });

    const startVisitWorkspaceForm = 'start-visit-workspace-form';
    const patientUuid = response.data.uuid;

    launchWorkspace(startVisitWorkspaceForm, {
      patientUuid,
      openedFrom: 'patient-chart-start-visit',
    });

    return response.data;
  } catch (error) {
    console.error('Error creating dependent patient:', error);

    let errorMessage = t('dependentRegistrationFailedSubtitle', 'Please try again or contact support');

    if (error?.response?.data?.error?.message) {
      errorMessage = error.response.data.error.message;
    } else if (error?.message) {
      errorMessage = error.message;
    }

    showSnackbar({
      title: t('dependentRegistrationFailed', 'Dependent registration failed'),
      subtitle: errorMessage,
      kind: 'error',
      isLowContrast: true,
    });

    throw error; // Re-throw so the component can handle the error state
  }
}
