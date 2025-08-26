import React, { useState } from 'react';
import { Button, TextInput, ModalHeader, ModalBody, ModalFooter } from '@carbon/react';
import { type SearchedPatient } from '../types';
import { useTranslation } from 'react-i18next';
import styles from './otp-authentication.scss';
import {
  createPatientPayload,
  generateOTP,
  searchPatientByNationalId,
  sendOtp,
  createPatientUpdatePayload,
  addPatientIdentifier,
} from './otp-authentication.resource';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { launchWorkspace, navigate, openmrsFetch, restBaseUrl, showSnackbar, useSession } from '@openmrs/esm-framework';
import { Password } from '@carbon/react/icons';

// Identifier type mapping for OpenMRS UUIDs
const IDENTIFIER_TYPE_MAPPING = {
  'national-id': '05a29f94-c0ed-11e2-94be-8c13b969e334',
  'sha-number': '3ff0063c-dd45-4d98-8af4-0c094f26166c',
  'household-number': '8d79403a-c2cc-11de-8d13-0010c6dffd0f',
  'patient-id': 'dfacd928-0370-4315-99d7-6ec1c9f7ae76',
  'client-registry': '52c3c0c3-05b8-4b26-930e-2a6a54e14c90',
  // Add more mappings as needed
};

// Default location UUID (update this to match your facility's location)
const DEFAULT_LOCATION_UUID = '44c3efb0-2583-4c80-a79e-1f756a03c0a1';

const authFormSchema = z.object({
  phoneNumber: z
    .string()
    .min(9, 'Phone number must be at least 9 digits')
    .max(15, 'Phone number must not exceed 15 digits')
    .regex(/^(?:\+254|254|0)\d{9}$/, 'Please enter a valid Kenyan phone number'),
  otp: z.string().min(5, 'OTP must be 5 digits'),
});

const formatPhoneNumber = (phone: string): string => {
  // Remove any existing '+' or country code
  let cleanNumber = phone.replace(/^\+?254/, '').replace(/^0/, '');
  return `+254${cleanNumber}`;
};

const normalizePhoneInput = (value: string): string => {
  // Remove all non-digit characters
  return value.replace(/\D/g, '');
};

// Helper function to validate and map identifier types
const validateIdentifierType = (identifierType: string): string => {
  // If it's already a UUID (contains hyphens), return as is
  if (identifierType.includes('-')) {
    return identifierType;
  }

  // Map string identifier types to UUIDs
  const mappedType = IDENTIFIER_TYPE_MAPPING[identifierType.toLowerCase()];
  if (!mappedType) {
    console.warn(`Unknown identifier type: ${identifierType}. Using default.`);
    return IDENTIFIER_TYPE_MAPPING['patient-id']; // fallback to patient-id
  }

  return mappedType;
};

// Helper function to ensure location UUID is valid
const validateLocationUuid = (location: string): string => {
  if (!location || location.trim() === '') {
    return DEFAULT_LOCATION_UUID;
  }

  // If it's already a UUID, return as is
  if (location.includes('-')) {
    return location;
  }

  // Otherwise, return default location
  return DEFAULT_LOCATION_UUID;
};

const OtpAuthenticationModal: React.FC<{ patient: SearchedPatient; onClose: () => void }> = ({ patient, onClose }) => {
  const { t } = useTranslation();
  const session = useSession();
  const patientPhoneNumber =
    (patient.attributes?.find((attribute) => attribute.attributeType.display === 'phone')?.value as string) ?? '';
  const [serverOtp, setServerOtp] = useState<string>('');
  const [otpStatus, setOtpStatus] = useState<'idle' | 'loadingOtp' | 'otpSendSuccessfull' | 'otpFetchError'>('idle');
  const [isOtpValid, setIsOtpValid] = useState(false);
  const [otpError, setOtpError] = useState<string>('');
  const [showResendButton, setShowResendButton] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    getValues,
    watch,
    setValue,
  } = useForm<z.infer<typeof authFormSchema>>({
    mode: 'all',
    defaultValues: { phoneNumber: formatPhoneNumber(patientPhoneNumber), otp: '' },
    resolver: zodResolver(authFormSchema),
  });

  // Watch the OTP input to validate it in real-time
  const watchOtp = watch('otp');
  React.useEffect(() => {
    if (serverOtp && watchOtp) {
      const isValid = serverOtp === watchOtp;
      setIsOtpValid(isValid);

      if (watchOtp.length === 5) {
        if (!isValid) {
          setOtpError(t('invalidOtp', 'Invalid OTP. Please check and try again.'));
          setShowResendButton(true);
        } else {
          setOtpError('');
          setShowResendButton(false);
        }
      } else {
        setOtpError('');
        setShowResendButton(false);
      }
    } else {
      setIsOtpValid(false);
      setOtpError('');
      setShowResendButton(false);
    }
  }, [watchOtp, serverOtp, t]);

  const handleClose = () => {
    onClose();
  };

  const handleRequestOtp = async () => {
    try {
      const otp = generateOTP(5);
      setServerOtp(otp);
      setOtpStatus('loadingOtp');
      setValue('otp', '');
      setOtpError('');
      setShowResendButton(false);

      const formData = getValues();
      const formattedPhoneNumber = formatPhoneNumber(formData.phoneNumber);
      await sendOtp({ receiver: formattedPhoneNumber, otp }, patient.person.personName.display);

      setOtpStatus('otpSendSuccessfull');
      showSnackbar({
        title: t('otpSent', 'OTP Sent'),
        subtitle: t('otpSentSubtitle', 'Please check your phone for the OTP'),
        kind: 'success',
        isLowContrast: true,
      });
    } catch (error) {
      setOtpStatus('otpFetchError');
      showSnackbar({
        title: t('otpSendFailed', 'Failed to send OTP'),
        subtitle: t('otpSendFailedSubtitle', 'Please check your phone for the OTP'),
        kind: 'error',
        isLowContrast: true,
      });
    }
  };

  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>, onChange: (value: string) => void) => {
    const normalizedValue = normalizePhoneInput(e.target.value);
    onChange(normalizedValue);
  };

  const handleOtpInput = (e: React.ChangeEvent<HTMLInputElement>, onChange: (value: string) => void) => {
    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 5);
    onChange(value);
  };

  // Enhanced payload creation with proper validation
  const createValidatedPatientPayload = async (patientData: SearchedPatient) => {
    try {
      // Get the base payload from existing function
      const basePayload = await createPatientPayload(patientData);

      // Validate and fix identifiers
      if (basePayload.identifiers && Array.isArray(basePayload.identifiers)) {
        basePayload.identifiers = basePayload.identifiers.map((identifier: any) => {
          const validatedIdentifier = {
            ...identifier,
            identifierType: validateIdentifierType(identifier.identifierType),
            location: validateLocationUuid(identifier.location),
          };

          console.log('Validated identifier:', validatedIdentifier);
          return validatedIdentifier;
        });
      }

      // Ensure required fields are present
      if (!basePayload.person) {
        throw new Error('Person data is required');
      }

      console.log('Final validated payload:', basePayload);
      return basePayload;
    } catch (error) {
      console.error('Error creating validated payload:', error);
      throw error;
    }
  };

  const createValidatedPatientUpdatePayload = async (localPatient: any, hiePatient: SearchedPatient) => {
    try {
      // Get the base payload from existing function
      const basePayload = await createPatientUpdatePayload(localPatient, hiePatient);

      // Validate and fix identifiers if they exist
      if (basePayload.identifiers && Array.isArray(basePayload.identifiers)) {
        basePayload.identifiers = basePayload.identifiers.map((identifier: any) => {
          const validatedIdentifier = {
            ...identifier,
            identifierType: validateIdentifierType(identifier.identifierType),
            location: validateLocationUuid(identifier.location),
          };

          console.log('Validated update identifier:', validatedIdentifier);
          return validatedIdentifier;
        });
      }

      console.log('Final validated update payload:', basePayload);
      return basePayload;
    } catch (error) {
      console.error('Error creating validated update payload:', error);
      throw error;
    }
  };

  const handlePatientRegistrationAndNavigateToPatientChart = async () => {
    setIsRegistering(true);
    try {
      const localPatient = await searchPatientByNationalId(patient.identifiers[0].identifier);
      const isUpdate = Boolean(localPatient?.uuid);

      let patientPayload;

      if (isUpdate) {
        patientPayload = await createValidatedPatientUpdatePayload(localPatient, patient);
      } else {
        patientPayload = await createValidatedPatientPayload(patient);
      }

      const patientRegistrationUrl = isUpdate
        ? `${restBaseUrl}/patient/${localPatient.uuid}`
        : `${restBaseUrl}/patient`;

      console.log('Final patientPayload:', JSON.stringify(patientPayload, null, 2));

      if (isUpdate) {
        // Update patient information (excluding identifiers)
        const patientUpdatePayload = { ...patientPayload };
        delete patientUpdatePayload.identifiers;
        console.log('Patient update payload:', JSON.stringify(patientUpdatePayload, null, 2));

        if (Object.keys(patientUpdatePayload).length > 0) {
          await openmrsFetch(patientRegistrationUrl, {
            method: 'POST',
            body: patientUpdatePayload,
            headers: {
              'Content-Type': 'application/json',
            },
          });
        }

        // Add identifiers separately if they exist
        if (patientPayload?.identifiers && patientPayload.identifiers.length > 0) {
          for (const identifier of patientPayload.identifiers) {
            // Validate identifier before adding
            const validatedIdentifier = {
              ...identifier,
              identifierType: validateIdentifierType(identifier.identifierType),
              location: validateLocationUuid(identifier.location),
            };

            console.log('Adding validated identifier:', validatedIdentifier);
            await addPatientIdentifier(localPatient.uuid, validatedIdentifier);
          }
        }

        showSnackbar({
          title: t('patientUpdated', 'Patient Updated'),
          subtitle: t('patientUpdatedSubtitle', 'Patient has been successfully updated'),
          kind: 'success',
          isLowContrast: true,
        });
        navigate({ to: `${window['getOpenmrsSpaBase']()}patient/${localPatient.uuid}/chart` });
      } else {
        // Create new patient
        const registeredPatient = await openmrsFetch(patientRegistrationUrl, {
          method: 'POST',
          body: patientPayload,
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!registeredPatient?.data?.uuid) {
          throw new Error('Patient registration failed - no UUID returned');
        }

        showSnackbar({
          title: t('patientCreated', 'Patient Created'),
          subtitle: t('patientCreatedSubtitle', 'Patient has been successfully created'),
          kind: 'success',
          isLowContrast: true,
        });

        const startVisitWorkspaceForm = 'start-visit-workspace-form';
        const patientUuid = registeredPatient.data.uuid;
        launchWorkspace(startVisitWorkspaceForm, {
          patientUuid,
          openedFrom: 'patient-chart-start-visit',
        });
      }

      onClose();
    } catch (error: any) {
      console.error('Patient registration error:', error);

      let errorMessage = error?.message || 'An unexpected error occurred. Please try again';

      // Handle specific OpenMRS API errors
      if (error?.message?.includes('identifierType')) {
        errorMessage = 'Invalid identifier type. Please contact system administrator.';
      } else if (error?.message?.includes('ConversionException')) {
        errorMessage = 'Data format error. Please check patient information and try again.';
      }

      showSnackbar({
        title: t('patientSaveFailed', 'Failed to save patient'),
        subtitle: t('patientSaveFailedSubtitle', errorMessage),
        kind: 'error',
        isLowContrast: true,
      });
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div>
      <ModalHeader closeModal={onClose} title={t('otpVerification', 'OTP Verification')} />
      <ModalBody>
        {patientPhoneNumber ? (
          <div className={styles.otpForm}>
            <Controller
              control={control}
              name="phoneNumber"
              render={({ field }) => (
                <TextInput
                  labelText={t('phoneNumber', 'Phone Number')}
                  placeholder="Enter Phone Number e.g. 0717417867"
                  invalidText={
                    errors.phoneNumber?.message || t('phoneNumberInvalid', 'Please enter a valid phone number')
                  }
                  invalid={!!errors.phoneNumber}
                  {...field}
                  onChange={(e) => handlePhoneInput(e, field.onChange)}
                />
              )}
            />
            <Controller
              control={control}
              name="otp"
              render={({ field }) => (
                <TextInput
                  labelText={t('otp', 'OTP')}
                  placeholder="Enter 5-digit OTP"
                  disabled={otpStatus !== 'otpSendSuccessfull'}
                  invalid={!!otpError}
                  invalidText={otpError}
                  {...field}
                  onChange={(e) => handleOtpInput(e, field.onChange)}
                />
              )}
            />
            <Button
              size="sm"
              kind="tertiary"
              renderIcon={Password}
              onClick={handleRequestOtp}
              disabled={otpStatus === 'loadingOtp'}>
              {otpStatus === 'loadingOtp'
                ? t('sending', 'Sending...')
                : showResendButton
                  ? t('resendOtp', 'Resend OTP')
                  : t('requestOtp', 'Request OTP')}
            </Button>
          </div>
        ) : (
          <p>
            {t(
              'faulureVerifyingPatient',
              'Verification failed. Patient missing phone number. Kindly advice patient to update their details on Afya Yangu and try again',
            )}
          </p>
        )}
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={handleClose}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button
          onClick={handlePatientRegistrationAndNavigateToPatientChart}
          disabled={(!isOtpValid && otpStatus !== 'otpSendSuccessfull') || isRegistering}>
          {isRegistering ? t('saving', 'Saving...') : t('continueToChart', 'Continue to Chart')}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default OtpAuthenticationModal;
