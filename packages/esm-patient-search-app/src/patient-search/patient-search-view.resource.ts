import { FetchResponse, makeUrl, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { useState } from 'react';
import { PATIENT_API_NO_CREDENTIALS, PATIENT_NOT_FOUND, RESOURCE_NOT_FOUND, UNKNOWN } from '../constants';
import { Patient } from '../patient-search-page/patient-banner/types';
import { type LocalResponse, type LocalPatientApiResponse } from './types';

export const searchPatientFromHIE = async (identifierType: string, searchQuery: string) => {
  const url = `${restBaseUrl}/kenyaemr/getSHAPatient/${searchQuery}/${identifierType}`;
  const response = await fetch(makeUrl(url));
  if (response.ok) {
    const responseData = await response.json();
    if (responseData?.issue) {
      throw new Error(PATIENT_NOT_FOUND);
    }
    return responseData;
  }
  if (response.status === 401) {
    throw new Error(PATIENT_API_NO_CREDENTIALS);
  } else if (response.status === 404) {
    throw new Error(RESOURCE_NOT_FOUND);
  }
  throw new Error(UNKNOWN);
};

export const usePatient = (searchQuery: string) => {
  console.log('Searching for patient with query:', searchQuery);
  const customRepresentation =
    'custom:(patientId,uuid,identifiers,display,patientIdentifier:(uuid,identifier),person:(gender,age,birthdate,birthdateEstimated,personName,addresses,display,dead,deathDate),attributes:(value,attributeType:(uuid,display)))';
  const url = `${restBaseUrl}/patient?q=${searchQuery}&v=${customRepresentation}`;

  // Fixed: Use the correct response type that matches the actual API response
  const { isLoading, error, data } = useSWR<FetchResponse<LocalPatientApiResponse>>(
    searchQuery ? url : null, // Only fetch when searchQuery exists
    openmrsFetch,
  );

  // Extract the results array from the API response
  const person = data?.data?.results || null;
  console.log('Fetched patient data:', person);

  return { isLoading, error, person };
};


