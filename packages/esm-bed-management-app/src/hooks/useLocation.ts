import { restBaseUrl, openmrsFetch } from '@openmrs/esm-framework';

export const saveLocation = async (locationPayload) => {
  const url = `${restBaseUrl}/location`;
  return await openmrsFetch(url, {
    method: 'POST',
    body: locationPayload,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
