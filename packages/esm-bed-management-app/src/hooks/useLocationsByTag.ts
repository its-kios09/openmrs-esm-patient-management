import { openmrsFetch } from '@openmrs/esm-framework';
import useSWR from 'swr';

export const useLocationsByTag = (tagUuid: string) => {
  const locationsUrl = `/ws/rest/v1/location?tag=${tagUuid}&v=full`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data }, Error>(
    tagUuid ? locationsUrl : null,
    openmrsFetch,
  );

  return {
    data: data?.data?.results ?? [],
    error,
    isLoading,
    isValidating,
    mutate,
  };
};
