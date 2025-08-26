// types.ts

// This represents the actual API response structure
export interface LocalPatientApiResponse {
  results: LocalResponse;
}

// This is the array of patient objects returned in the results
export type LocalResponse = LocalPatient[];

// Individual patient object structure
export interface LocalPatient {
  patientId: number;
  uuid: string;
  identifiers: {
    display: string;
    uuid: string;
    identifier: string;
    identifierType: {
      uuid: string;
      display: string;
      links: {
        rel: string;
        uri: string;
        resourceAlias: string;
      }[];
    };
    location: {
      uuid: string;
      display: string;
      links: {
        rel: string;
        uri: string;
        resourceAlias: string;
      }[];
    };
    preferred: boolean;
    voided: boolean;
    links: {
      rel: string;
      uri: string;
      resourceAlias: string;
    }[];
    resourceVersion: string;
  }[];
  display: string;
  patientIdentifier: {
    uuid: string;
    identifier: string;
  };
  person: {
    gender: string;
    age: number;
    birthdate: string;
    birthdateEstimated: boolean;
    personName: {
      display: string;
      uuid: string;
      givenName: string;
      middleName: string;
      familyName: string;
      familyName2: null;
      voided: boolean;
      links: {
        rel: string;
        uri: string;
        resourceAlias: string;
      }[];
      resourceVersion: string;
    };
    addresses: {
      display: null;
      uuid: string;
      preferred: boolean;
      address1: null;
      address2: string;
      cityVillage: string;
      stateProvince: null;
      country: null;
      postalCode: null;
      countyDistrict: null;
      address3: null;
      address4: null;
      address5: string;
      address6: string;
      startDate: null;
      endDate: null;
      latitude: null;
      longitude: null;
      voided: boolean;
      address7: null;
      address8: null;
      address9: null;
      address10: null;
      address11: null;
      address12: null;
      address13: null;
      address14: null;
      address15: null;
      links: {
        rel: string;
        uri: string;
        resourceAlias: string;
      }[];
      resourceVersion: string;
    }[];
    display: string;
    dead: boolean;
    deathDate: null;
  };
  attributes: {
    value: string;
    attributeType: {
      uuid: string;
      display: string;
    };
  }[];
}

export interface HIEBundle {
  resourceType: string;
  id: string;
  meta: { lastUpdated: string };
  type: string;
  total: number;
  link?: { relation: string; url: string }[];
  entry?: {
    resource: {
      resourceType: string;
      id: string;
      extension?: { url: string; valueString?: string }[];
      identifier: {
        use: string;
        type: { coding: { system: string; code: string; display: string }[] };
        value: string;
      }[];
      active: boolean;
      name: { text: string; family: string; given: string[] }[];
      telecom?: { system: string; value: string }[];
      gender: string;
      birthDate: string;
      address: { extension?: { url: string; valueString?: string }[]; city: string; country: string }[];
      contact?: {
        id: string;
        extension?: {
          url: string;
          valueString?: string;
          valueIdentifier?: {
            use: string;
            type: { coding: { system: string; code: string; display: string }[] };
            value: string;
          };
        }[];
        relationship: { coding: { system: string; code: string; display: string }[] }[];
        name: { text: string; family: string; given: string[] };
        address: { extension?: { url: string; valueString?: string }[]; city: string; country: string };
        gender: string;
        telecom?: { system: string; value: string }[];
      }[];
    };
  }[];
}

export interface SearchComparisonResult {
  hieResults: HIEBundle[] | null;
  localResults: LocalResponse | null;
  comparisonStatus: 'match' | 'partial-match' | 'no-match' | 'hie-only' | 'local-only';
  matchedFields?: string[];
  unmatchedFields?: string[];
}
