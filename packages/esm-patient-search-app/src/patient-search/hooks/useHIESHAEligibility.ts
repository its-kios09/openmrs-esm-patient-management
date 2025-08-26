import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { useMemo } from 'react';

export interface EligibilityResponse {
  requestIdType: number;
  requestIdNumber: string;
  memberCrNumber: string;
  fullName: string;
  memberType: string;
  coverageStartDate: Date;
  coverageEndDate: Date;
  status: number;
  message: string;
  reason: string;
  possibleSolution: null;
  coverageType: string;
  primaryContributor: null;
  employerDetails: EmployerDetails;
  dependants: Array<unknown>;
  active: boolean;
}

export interface EmployerDetails {
  employerName: string;
  jobGroup: string;
  scheme: Scheme;
}

export interface Scheme {
  schemeCode: string;
  schemeName: string;
  schemeCategoryCode: string;
  schemeCategoryName: string;
  memberPolicyStartDate: string;
  memberPolicyEndDate: string;
  joinDate: string;
  leaveDate: string;
}

type HIEEligibilityResponse = {
  insurer: string;
  inforce: boolean;
  start: string;
  eligibility_response: EligibilityResponse | string;
  end: string;
};

export const useSHAEligibility = (nationalId: string) => {
  // Only make the request if nationalId is provided and not empty
  const shouldFetch = nationalId && nationalId.trim().length > 0;
  const url = shouldFetch ? `${restBaseUrl}/insuranceclaims/CoverageEligibilityRequest?nationalId=${nationalId}` : null;

  const { data, error, isLoading, mutate } = useSWR<{ data: Array<HIEEligibilityResponse> }>(url, openmrsFetch, {
    errorRetryCount: 0,
    // Don't revalidate on focus since this data doesn't change frequently
    revalidateOnFocus: false,
    // Cache the response for 5 minutes
    dedupingInterval: 300000,
  });

  const processedData = useMemo(() => {
    if (!data?.data?.length) return undefined;

    const eligibilityResponse = data.data[0]?.eligibility_response;

    // Handle case where eligibility_response might be a string (JSON)
    if (typeof eligibilityResponse === 'string') {
      try {
        return JSON.parse(eligibilityResponse) as EligibilityResponse;
      } catch (e) {
        console.error('Failed to parse eligibility response:', e);
        return undefined;
      }
    }

    return eligibilityResponse as EligibilityResponse;
  }, [data]);

  return {
    data: processedData,
    isLoading: shouldFetch ? isLoading : false,
    error,
    mutate,
  };
};

// Additional helper functions for eligibility checking
export const getEligibilityStatus = (eligibilityData?: EligibilityResponse) => {
  if (!eligibilityData) return null;

  return {
    isPHCEligible:
      eligibilityData.status === 1 ||
      eligibilityData.memberCrNumber?.startsWith('CR') ||
      eligibilityData.memberCrNumber?.startsWith('SHA'),
    isSHIFEligible: eligibilityData.status === 1,
    isECCIFEligible: eligibilityData.status === 1,
    isCivilServantEligible: eligibilityData.status === 1 && eligibilityData.coverageType === 'CIVIL_SERVANT',
    coverageType: eligibilityData.coverageType,
    status: eligibilityData.status,
    message: eligibilityData.message,
    reason: eligibilityData.reason,
  };
};
