export function comparePatients(localPatient: fhir.Patient, hiePatient: fhir.Patient): Record<string, unknown> {
  const differences: Record<string, unknown> = {};

  const localName = localPatient.name?.[0];
  const hieName = hiePatient.name?.[0];

  if (localName || hieName) {
    const nameDiffs: any = {};

    if (localName?.family !== hieName?.family) {
      nameDiffs.family = { local: localName?.family, hie: hieName?.family };
    }

    const localGiven = localName?.given || [];
    const hieGiven = hieName?.given || [];
    if (JSON.stringify(localGiven) !== JSON.stringify(hieGiven)) {
      nameDiffs.given = { local: localGiven, hie: hieGiven };
    }

    const localPrefix = localName?.prefix || [];
    const hiePrefix = hieName?.prefix || [];
    if (JSON.stringify(localPrefix) !== JSON.stringify(hiePrefix)) {
      nameDiffs.prefix = { local: localPrefix, hie: hiePrefix };
    }

    const localSuffix = localName?.suffix || [];
    const hieSuffix = hieName?.suffix || [];
    if (JSON.stringify(localSuffix) !== JSON.stringify(hieSuffix)) {
      nameDiffs.suffix = { local: localSuffix, hie: hieSuffix };
    }

    if (Object.keys(nameDiffs).length > 0) {
      differences.name = nameDiffs;
    }
  }

  const normalizeGender = (gender: string | undefined): string => {
    if (!gender) return '';
    const g = gender.toLowerCase();
    if (g === 'male' || g === 'm') return 'M';
    if (g === 'female' || g === 'f') return 'F';
    return g.toUpperCase();
  };

  const localGender = normalizeGender(localPatient.gender);
  const hieGender = normalizeGender(hiePatient.gender);

  if (localGender !== hieGender) {
    differences.gender = { local: localPatient.gender, hie: hiePatient.gender };
  }

  if (localPatient.birthDate !== hiePatient.birthDate) {
    differences.birthDate = { local: localPatient.birthDate, hie: hiePatient.birthDate };
  }

  const identifierDiffs: any = {};
  const localIds = localPatient.identifier || [];
  const hieIds = hiePatient.identifier || [];

  localIds.forEach((localId) => {
    const idType = localId.type?.coding?.[0]?.code;
    const hieId = hieIds.find((h) => h.type?.coding?.[0]?.code === idType);

    if (hieId && localId.value !== hieId.value) {
      identifierDiffs[idType] = {
        local: localId.value,
        hie: hieId.value,
      };
    }
  });

  if (Object.keys(identifierDiffs).length > 0) {
    differences.identifiers = identifierDiffs;
  }

  return differences;
}
