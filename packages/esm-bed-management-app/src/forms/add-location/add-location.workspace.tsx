import React, { useEffect } from 'react';
import { type DefaultWorkspaceProps, ResponsiveWrapper, useLayoutType, showSnackbar } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import {
  ButtonSet,
  Button,
  InlineLoading,
  TextInput,
  FormGroup,
  Stack,
  Form,
  FilterableMultiSelect,
} from '@carbon/react';
import classNames from 'classnames';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { mutate } from 'swr';
import styles from './add-location.workspace.scss';
import { saveLocation } from '../../hooks/useLocation';
import { type locationFormData } from '../../types/index';
import { useLocationTags } from '../../hooks/useLocationTags';
import { extractErrorMessagesFromResponse } from '../../helpers';

type AddLocationWorkspaceProps = DefaultWorkspaceProps & {
  location?: locationFormData;
};

const locationFormSchema = z.object({
  name: z.string().min(1, { message: 'Location name is required' }),
  tags: z
    .object({
      uuid: z.string().uuid(),
      display: z.string(),
    })
    .array()
    .nonempty('At least one tag is required'),
});

type LocationFormType = z.infer<typeof locationFormSchema>;

const AddLocationWorkspace: React.FC<AddLocationWorkspaceProps> = ({
  closeWorkspace,
  closeWorkspaceWithSavedChanges,
  promptBeforeClosing,
  location,
}) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';

  const { locationTagList: Tags } = useLocationTags();

  const {
    handleSubmit,
    control,
    getValues,
    formState: { isSubmitting, isDirty, errors },
  } = useForm<LocationFormType>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      tags: [],
      name: '',
    },
  });

  const onSubmit = async (data: LocationFormType) => {
    const formDataFormSubmission = getValues();

    const locationTagsUuid = formDataFormSubmission?.tags?.map((tag) => tag.uuid) || [];

    const locationPayload = {
      name: formDataFormSubmission.name,
      tags: locationTagsUuid,
    };

    try {
      await saveLocation(locationPayload);

      showSnackbar({
        title: t('success', 'Success'),
        kind: 'success',
        subtitle: location
          ? t('locationUpdated', 'Location {{locationName}} was updated successfully.', {
              locationName: data.name,
            })
          : t('locationCreated', 'Location {{locationName}} was created successfully.', {
              locationName: data.name,
            }),
      });

      ['/location', '/bed'].forEach((endpoint) => {
        mutate((key) => typeof key === 'string' && key.includes(endpoint), undefined, { revalidate: true });
      });

      closeWorkspaceWithSavedChanges();
    } catch (error: any) {
      const errorMessages = extractErrorMessagesFromResponse(error);
      showSnackbar({
        title: t('error', 'Error'),
        kind: 'error',
        subtitle: errorMessages.join(', ') || t('locationSaveError', 'Error saving location'),
      });
    }
  };

  useEffect(() => {
    promptBeforeClosing(() => isDirty);
  }, [isDirty, promptBeforeClosing]);

  return (
    <Form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
      <div className={styles.formContainer}>
        <Stack gap={3}>
          <ResponsiveWrapper>
            <FormGroup legendText="">
              <Controller
                control={control}
                name="name"
                render={({ field }) => (
                  <TextInput
                    id="locationName"
                    placeholder={t('locationPlaceholder', 'Add a location')}
                    labelText={t('locationName', 'Location Name')}
                    value={field.value}
                    onChange={field.onChange}
                    invalid={!!errors.name?.message}
                    invalidText={errors.name?.message}
                  />
                )}
              />
            </FormGroup>
          </ResponsiveWrapper>

          <ResponsiveWrapper>
            <FormGroup legendText="">
              <Controller
                control={control}
                name="tags"
                render={({ field: { onChange, value, ...restField } }) => (
                  <FilterableMultiSelect
                    id="locationTags"
                    titleText={t('selectTags', 'Select tag(s)')}
                    placeholder={t('selectTagPlaceholder', 'Select a tag')}
                    items={Tags || []}
                    selectedItems={value}
                    onChange={({ selectedItems }) => onChange(selectedItems ?? [])}
                    itemToString={(item) => (item && typeof item === 'object' ? item.display : '')}
                    selectionFeedback="top-after-reopen"
                    invalid={!!errors.tags?.message}
                    invalidText={errors.tags?.message}
                    disabled={!Tags?.length}
                    {...restField}
                  />
                )}
              />
            </FormGroup>
          </ResponsiveWrapper>
        </Stack>
      </div>

      <ButtonSet
        className={classNames({
          [styles.tablet]: isTablet,
          [styles.desktop]: !isTablet,
        })}>
        <Button className={styles.buttonContainer} kind="secondary" onClick={() => closeWorkspace()}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button className={styles.buttonContainer} disabled={isSubmitting || !isDirty} kind="primary" type="submit">
          {isSubmitting ? (
            <span className={styles.inlineLoading}>
              {t('submitting', 'Submitting' + '...')}
              <InlineLoading status="active" iconDescription="Loading" />
            </span>
          ) : (
            t('saveAndClose', 'Save & close')
          )}
        </Button>
      </ButtonSet>
    </Form>
  );
};

export default AddLocationWorkspace;
