import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './empty-state.scss';
import { Tile } from '@carbon/react';

interface ErrorStateSearchProps {
  subTitle: string;
}

const ErrorState: React.FC<ErrorStateSearchProps> = ({ subTitle }) => {
  const { t } = useTranslation();

  return (
    <div className={styles.tileContainer}>
      <Tile className={styles.tile}>
        <div className={styles.tileContent}>
          <p className={styles.content}>{t('registryError', 'Registry Error')}</p>
          <p className={styles.ErrorStateHelperText}>{subTitle}</p>
        </div>
      </Tile>
    </div>
  );
};

export default ErrorState;
