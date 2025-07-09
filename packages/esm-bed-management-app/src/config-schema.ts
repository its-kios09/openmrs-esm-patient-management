import { Type } from '@openmrs/esm-framework';

export const configSchema = {
  admissionLocationTagName: {
    _type: Type.String,
    _description: 'Patients may only be admitted to inpatient care in a location with this tag',
    _default: 'Admission Location',
  },
  allowedTags: {
    _type: Type.Object,
    _description: 'Allowed location tags',
    _default: {
      admissionLocationTagUuid: 'f5b9737b-14d5-402b-8475-dd558808e172',
    },
  },
};

export type ConfigObject = {
  allowedTags: {
    admissionLocationTagUuid: string;
    loginLocationTagUuid: string;
    transferLocationTagUuid: string;
  };
};
export interface BedManagementConfig {
  admissionLocationTagName: string;
}
